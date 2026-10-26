"""Server-authorized aggregate metrics. Never exposes financial plans or credentials."""
import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, Response, HTTPException, Request
from accounts import connect, require_user, check_origin
from pydantic import BaseModel, ConfigDict
from typing import Literal

router=APIRouter(prefix='/api/admin')
EVENTS={'plan_saved','optimizer_used','onboarding_completed'}

def record_event(db,user_id,event):
    if event not in EVENTS: raise ValueError('Unknown event')
    now=int(time.time())
    day=datetime.fromtimestamp(now,timezone.utc).strftime('%Y-%m-%d')
    db.execute('INSERT INTO usage_daily(user_id,day,event) VALUES (?,?,?) ON CONFLICT(user_id,day,event) DO UPDATE SET count=count+1',(user_id,day,event))
    db.execute('UPDATE users SET last_active_at=? WHERE id=?',(now,user_id))

def require_admin(user=Depends(require_user)):
    if user['role']!='admin': raise HTTPException(403,'Acesso exclusivo de administrador.')
    return user

@router.get('/metrics')
def metrics(response:Response,user=Depends(require_admin)):
    now=int(time.time())
    result={'as_of':now,'timezone':'UTC','activity_definition':'Planejamento salvo ou simulação concluída; login isolado não conta como atividade.','tracking_since':None}
    with connect() as db:
        result['users_total']=db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        result['accounts_enabled']=db.execute("SELECT COUNT(*) FROM users WHERE status='active'").fetchone()[0]
        result['accounts_blocked']=db.execute("SELECT COUNT(*) FROM users WHERE status='blocked'").fetchone()[0]
        result['tracking_since']=db.execute('SELECT MIN(day) FROM usage_daily').fetchone()[0]
        result['onboarding_completed']=db.execute("SELECT COUNT(DISTINCT user_id) FROM usage_daily WHERE event='onboarding_completed'").fetchone()[0]
        for days in (7,30):
            since=now-days*86400
            result[f'new_users_{days}d']=db.execute('SELECT COUNT(*) FROM users WHERE created_at>=?',(since,)).fetchone()[0]
            result[f'active_users_{days}d']=db.execute('SELECT COUNT(*) FROM users WHERE last_active_at>=?',(since,)).fetchone()[0]
            # Daily event aggregates use complete UTC calendar days, including today.
            start=datetime.fromtimestamp(now-(days-1)*86400,timezone.utc).strftime('%Y-%m-%d')
            result[f'events_{days}d']={r['event']:r['total'] for r in db.execute('SELECT event,SUM(count) total FROM usage_daily WHERE day>=? GROUP BY event',(start,))}
        today=datetime.fromtimestamp(now,timezone.utc).date()
        start=today-timedelta(days=29)
        start_timestamp=int(datetime.combine(start,datetime.min.time(),tzinfo=timezone.utc).timestamp())
        registrations={row['day']:row['total'] for row in db.execute(
            "SELECT strftime('%Y-%m-%d',created_at,'unixepoch') day,COUNT(*) total FROM users WHERE created_at>=? AND created_at<=? GROUP BY day",(start_timestamp,now))}
        activity={row['day']:row['total'] for row in db.execute(
            "SELECT day,COUNT(DISTINCT user_id) total FROM usage_daily WHERE day>=? AND day<=? AND event IN ('plan_saved','optimizer_used') GROUP BY day",(start.isoformat(),today.isoformat()))}
        result['daily_history']=[]
        for offset in range(30):
            day=(start+timedelta(days=offset)).isoformat()
            tracked=result['tracking_since'] is not None and day>=result['tracking_since']
            result['daily_history'].append({'date':day,'new_users':registrations.get(day,0),'active_users':activity.get(day,0) if tracked else None})
    response.headers['Cache-Control']='no-store'
    return result

@router.get('/users')
def users(response:Response,limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0),q:str=Query('',max_length=80),status:Literal['active','blocked']|None=None,user=Depends(require_admin)):
    where="WHERE instr(username,?)>0"; params=[q.strip().casefold()]
    if status:
        where+=' AND status=?';params.append(status)
    with connect() as db:
        rows=db.execute(f'SELECT id,username,role,status,created_at,last_login_at,last_active_at FROM users {where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?',(*params,limit,offset)).fetchall()
        total=db.execute(f'SELECT COUNT(*) FROM users {where}',params).fetchone()[0]
    response.headers['Cache-Control']='no-store'
    return {'users':[dict(row) for row in rows],'total':total,'limit':limit,'offset':offset}

class AccountStatus(BaseModel):
    model_config=ConfigDict(extra='forbid')
    status:Literal['active','blocked']

@router.patch('/users/{user_id}/status')
def update_status(user_id:str,data:AccountStatus,request:Request,response:Response,user=Depends(require_admin)):
    check_origin(request)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        # Recheck within the transaction so concurrent permission changes cannot bypass it.
        actor=db.execute('SELECT role,status FROM users WHERE id=?',(user['id'],)).fetchone()
        if not actor or actor['role']!='admin' or actor['status']!='active':
            raise HTTPException(403,'Acesso exclusivo de administrador.')
        target=db.execute('SELECT role,status FROM users WHERE id=?',(user_id,)).fetchone()
        if not target: raise HTTPException(404,'Usuário não encontrado.')
        if user_id==user['id'] or target['role']=='admin':
            raise HTTPException(409,'Contas administrativas são gerenciadas pelo responsável no servidor.')
        if target['status']!=data.status:
            db.execute('UPDATE users SET status=? WHERE id=?',(data.status,user_id))
            if data.status=='blocked': db.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
            db.execute('INSERT INTO admin_audit(actor_id,action,subject_id,created_at) VALUES (?,?,?,?)',(user['id'],'account_'+data.status,user_id,int(time.time())))
    response.headers['Cache-Control']='no-store'
    return {'id':user_id,'status':data.status}
