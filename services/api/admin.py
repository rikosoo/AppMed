"""Server-authorized aggregate metrics. Never exposes financial plans or credentials."""
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from accounts import connect, require_user

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
    response.headers['Cache-Control']='no-store'
    return result

@router.get('/users')
def users(response:Response,limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0),user=Depends(require_admin)):
    with connect() as db:
        rows=db.execute('SELECT id,username,role,status,created_at,last_login_at,last_active_at FROM users ORDER BY created_at DESC,id LIMIT ? OFFSET ?',(limit,offset)).fetchall()
        total=db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    response.headers['Cache-Control']='no-store'
    return {'users':[dict(row) for row in rows],'total':total,'limit':limit,'offset':offset}
