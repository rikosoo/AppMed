import sqlite3
import time
from fastapi.testclient import TestClient
from main import app
from accounts import connect, password_hash


def account(client,name='owner'):
    result=client.post('/api/auth/register',json={'username':name,'password':'Valid-password-123'})
    assert result.status_code==201
    return result.json()['user']['id']


def test_admin_requires_server_role():
    client=TestClient(app)
    assert client.get('/api/admin/metrics').status_code==401
    uid=account(client)
    assert client.get('/api/admin/users').status_code==403
    assert client.get('/api/admin/metrics').status_code==403
    with connect() as db: db.execute("UPDATE users SET role='admin' WHERE id=?",(uid,))
    response=client.get('/api/admin/metrics')
    assert response.status_code==200
    assert response.headers['cache-control']=='no-store'
    assert response.json()['users_total']==1
    assert response.json()['active_users_7d']==0
    assert response.json()['new_users_30d']==1
    row=client.get('/api/admin/users').json()['users'][0]
    assert set(row)=={'id','username','role','status','created_at','last_login_at','last_active_at'}
    assert client.get('/api/admin/users?limit=101').status_code==422


def test_activity_distinct_windows_and_onboarding():
    from admin import record_event
    client=TestClient(app);uid=account(client)
    other=TestClient(app);older=account(other,'older')
    with connect() as db:
        db.execute("UPDATE users SET role='admin' WHERE id=?",(uid,))
        db.execute('UPDATE users SET created_at=?,last_active_at=? WHERE id=?',(int(time.time())-10*86400,int(time.time())-10*86400,older))
        record_event(db,uid,'optimizer_used');record_event(db,uid,'optimizer_used')
    store={'version':1,'months':{'2026-10':{'works':[],'expenses':[],'target':10000,'available':100,'saved':[],'onboardingComplete':True}}}
    assert client.put('/api/plan',json={'store':store,'revision':0}).status_code==200
    assert client.put('/api/plan',json={'store':store,'revision':1}).status_code==200
    result=client.get('/api/admin/metrics').json()
    assert result['new_users_7d']==1 and result['new_users_30d']==2
    assert result['active_users_7d']==1 and result['active_users_30d']==2
    assert result['onboarding_completed']==1
    assert result['events_7d']=={'optimizer_used':2,'plan_saved':2,'onboarding_completed':1}
    assert client.put('/api/plan',json={'store':store,'revision':0}).status_code==409
    assert client.get('/api/admin/metrics').json()['events_7d']['plan_saved']==2


def test_blocked_session_and_login_are_rejected():
    client=TestClient(app);uid=account(client)
    with connect() as db: db.execute("UPDATE users SET status='blocked' WHERE id=?",(uid,))
    assert client.get('/api/auth/me').status_code==401
    assert client.post('/api/auth/login',json={'username':'owner','password':'Valid-password-123'}).status_code==401


def test_existing_database_migrates_without_data_loss(monkeypatch,tmp_path):
    path=tmp_path/'legacy.sqlite3'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL)')
        db.execute('INSERT INTO users VALUES (?,?,?,?)',('old','legacy',password_hash('Valid-password-123'),1))
    monkeypatch.setenv('DATABASE_PATH',str(path))
    client=TestClient(app)
    assert client.post('/api/auth/login',json={'username':'legacy','password':'Valid-password-123'}).status_code==200
    assert client.get('/api/auth/me').json()['user']['role']=='user'
    assert client.get('/api/admin/metrics').status_code==403


def test_admin_search_filters_block_and_revocation():
    admin=TestClient(app);uid=account(admin,'manager')
    member=TestClient(app);member_id=account(member,'doctor')
    with connect() as db: db.execute("UPDATE users SET role='admin' WHERE id=?",(uid,))
    path=f'/api/admin/users/{member_id}/status'
    assert member.patch(path,json={'status':'blocked'}).status_code==403
    assert admin.patch(path,json={'status':'blocked'},headers={'Origin':'https://evil.example'}).status_code==403
    assert admin.patch(f'/api/admin/users/{uid}/status',json={'status':'blocked'}).status_code==409
    assert admin.patch(path,json={'status':'blocked','role':'admin'}).status_code==422
    assert admin.patch(path,json={'status':'blocked'}).status_code==200
    assert member.get('/api/plan').status_code==401
    assert admin.get('/api/admin/users?q=DOCT&status=blocked').json()['total']==1
    assert admin.get('/api/admin/users?q=%').json()['total']==0
    assert admin.get('/api/admin/users?status=active').json()['total']==1
    assert admin.get('/api/admin/users?offset=50').json()['users']==[]
    assert admin.patch(path,json={'status':'active'}).status_code==200
    assert member.get('/api/plan').status_code==401 # Unblocking must not revive revoked sessions.
    assert member.post('/api/auth/login',json={'username':'doctor','password':'Valid-password-123'}).status_code==200
    with connect() as db:
        assert db.execute('SELECT COUNT(*) FROM admin_audit').fetchone()[0]==2
    assert admin.patch('/api/admin/users/missing/status',json={'status':'blocked'}).status_code==404


def test_daily_history_distinct_activity_zero_days_and_utc_window(monkeypatch):
    from datetime import datetime,timezone,timedelta
    import admin
    client=TestClient(app);uid=account(client,'manager')
    alice=account(TestClient(app),'alice');bob=account(TestClient(app),'bob')
    now=int(datetime(2026,10,26,12,tzinfo=timezone.utc).timestamp())
    today=datetime.fromtimestamp(now,timezone.utc).date()
    with connect() as db:
        db.execute("UPDATE users SET role='admin',created_at=? WHERE id=?",(now-40*86400,uid))
        db.execute('UPDATE users SET created_at=? WHERE id=?',(now-86400,alice))
        db.execute('UPDATE users SET created_at=? WHERE id=?',(now,bob))
        for user,offset,event,count in [(alice,40,'plan_saved',1),(alice,1,'plan_saved',1),(alice,0,'plan_saved',3),(alice,0,'optimizer_used',2),(bob,0,'optimizer_used',1),(bob,0,'onboarding_completed',1)]:
            db.execute('INSERT INTO usage_daily VALUES (?,?,?,?)',(user,(today-timedelta(days=offset)).isoformat(),event,count))
    monkeypatch.setattr(admin.time,'time',lambda:now)
    data=client.get('/api/admin/metrics').json()
    history=data['daily_history']
    assert len(history)==30
    assert history[0]=={'date':(today-timedelta(days=29)).isoformat(),'new_users':0,'active_users':0}
    assert history[-2]=={'date':(today-timedelta(days=1)).isoformat(),'new_users':1,'active_users':1}
    assert history[-1]=={'date':today.isoformat(),'new_users':1,'active_users':2}
    assert all(set(day)=={'date','new_users','active_users'} for day in history)
    assert sum(day['new_users'] for day in history)==2


def test_daily_history_does_not_invent_activity_before_tracking():
    from admin import record_event
    client=TestClient(app);uid=account(client)
    with connect() as db:db.execute("UPDATE users SET role='admin' WHERE id=?",(uid,))
    history=client.get('/api/admin/metrics').json()['daily_history']
    assert all(day['active_users'] is None for day in history)
    with connect() as db:record_event(db,uid,'plan_saved')
    history=client.get('/api/admin/metrics').json()['daily_history']
    assert all(day['active_users'] is None for day in history[:-1])
    assert history[-1]['active_users']==1
