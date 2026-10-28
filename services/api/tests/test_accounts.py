import hashlib
import json
import sqlite3
import time
from fastapi.testclient import TestClient
from main import app
from accounts import database_path

PASSWORD='Account-tests-123!'
def register(client,name='doctor'):
    response=client.post('/api/auth/register',json={'username':name,'password':PASSWORD})
    assert response.status_code==201,response.text
    return response.json()['user']

def plan(target=5000000):
    return {'version':1,'months':{'2026-10':{'works':[],'expenses':[],'target':target,'available':1200,'saved':[],'demo':False,'onboardingComplete':True}}}

def test_registration_password_hash_and_http_only_session():
    client=TestClient(app)
    user=register(client,'Doctor.One')
    assert user['username']=='doctor.one'
    response=client.get('/api/auth/me');assert response.status_code==200
    assert 'password' not in response.text
    with sqlite3.connect(database_path()) as db:
        encoded=db.execute('SELECT password_hash FROM users').fetchone()[0]
        stored_token=db.execute('SELECT token_hash FROM sessions').fetchone()[0]
    assert encoded.startswith('scrypt$') and PASSWORD not in encoded
    assert stored_token==hashlib.sha256(client.cookies.get('financemed_session').encode()).hexdigest()
    second=TestClient(app)
    response=second.post('/api/auth/login',json={'username':'DOCTOR.ONE','password':PASSWORD})
    assert response.status_code==200
    assert 'HttpOnly' in response.headers['set-cookie'] and 'SameSite=lax' in response.headers['set-cookie']

def test_demo_login_removed_wrong_password_and_duplicate_registration():
    client=TestClient(app)
    assert client.post('/api/auth/login',json={'username':'123456','password':'123456'}).status_code==401
    register(client)
    assert client.post('/api/auth/register',json={'username':'DOCTOR','password':PASSWORD}).status_code==409
    assert client.post('/api/auth/login',json={'username':'doctor','password':'wrong'}).status_code==401
    assert client.post('/api/auth/register',json={'username':'short','password':'123456'}).status_code==422

def test_persistent_plans_are_isolated_and_conflicts_do_not_overwrite():
    alice,bob=TestClient(app),TestClient(app)
    register(alice,'alice');register(bob,'bob')
    response=alice.put('/api/plan',json={'store':plan(),'revision':0});assert response.json()['revision']==1
    assert bob.get('/api/plan').json()['store']['months']=={}
    assert bob.put('/api/plan',json={'store':plan(3000000),'revision':0}).status_code==200
    assert alice.get('/api/plan').json()['store']['months']['2026-10']['target']==5000000
    assert alice.put('/api/plan',json={'store':plan(1),'revision':0}).status_code==409
    assert alice.get('/api/plan').json()['store']['months']['2026-10']['target']==5000000
    # A fresh client/session still loads the account's database record.
    other=TestClient(app);other.post('/api/auth/login',json={'username':'alice','password':PASSWORD})
    assert other.get('/api/plan').json()['revision']==1
    assert alice.put('/api/plan',json={'store':plan(),'revision':1,'user_id':'bob'}).status_code==422

def test_unauthenticated_optimizer_and_plan_are_blocked_and_logout_revokes_session():
    client=TestClient(app)
    assert client.get('/api/plan').status_code==401
    assert client.post('/api/optimizer',json={'works':[],'expenses_cents':0,'target_cents':100,'available_minutes':100}).status_code==401
    register(client);token=client.cookies.get('financemed_session')
    assert client.post('/api/auth/logout').status_code==204
    client.cookies.set('financemed_session',token)
    assert client.get('/api/auth/me').status_code==401
    assert client.get('/api/plan').status_code==401

def test_expired_and_fake_sessions_are_rejected():
    client=TestClient(app);register(client)
    with sqlite3.connect(database_path()) as db:db.execute('UPDATE sessions SET expires_at=?',(int(time.time())-1,))
    assert client.get('/api/auth/me').status_code==401
    client.cookies.set('financemed_session','invented-token');assert client.get('/api/auth/me').status_code==401

def test_foreign_origins_cannot_register_login_logout_or_write_plans():
    client=TestClient(app);register(client)
    headers={'origin':'https://attacker.example'}
    assert client.put('/api/plan',json={'store':plan(),'revision':0},headers=headers).status_code==403
    assert client.post('/api/auth/logout',headers=headers).status_code==403
    assert client.post('/api/auth/register',json={'username':'new-account','password':PASSWORD},headers=headers).status_code==403
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD},headers=headers).status_code==403

def test_production_requires_https_and_sets_secure_cookie(monkeypatch):
    monkeypatch.setenv('SESSION_COOKIE_SECURE','true');monkeypatch.setenv('APP_ALLOWED_ORIGINS','https://finance.example');monkeypatch.setenv('INTERNAL_PROXY_TOKEN','test-proxy-token-'+'A'*48)
    client=TestClient(app,base_url='https://finance.example')
    assert client.post('/api/auth/register',json={'username':'doctor','password':PASSWORD}).status_code==403
    response=client.post('/api/auth/register',json={'username':'doctor','password':PASSWORD},headers={'x-forwarded-proto':'https','origin':'https://finance.example','x-financemed-proxy-token':'test-proxy-token-'+'A'*48})
    assert response.status_code==201 and 'Secure' in response.headers['set-cookie']

def test_failed_login_attempts_are_rate_limited():
    client=TestClient(app);register(client)
    for _ in range(8):assert client.post('/api/auth/login',json={'username':'doctor','password':'wrong'}).status_code==401
    assert client.post('/api/auth/login',json={'username':'doctor','password':'wrong'}).status_code==429

def test_invalid_months_are_not_written():
    client=TestClient(app);register(client)
    data=plan();data['months']['2026-99']=data['months'].pop('2026-10')
    assert client.put('/api/plan',json={'store':data,'revision':0}).status_code==422
    assert client.get('/api/plan').json()['revision']==0

def test_stale_account_tab_cannot_read_write_or_logout_a_different_session():
    client=TestClient(app);alice=register(client,'alice');register(client,'bob')
    headers={'x-financemed-account':alice['id']}
    assert client.get('/api/plan',headers=headers).status_code==409
    assert client.put('/api/plan',json={'store':plan(),'revision':0},headers=headers).status_code==409
    assert client.post('/api/auth/logout',headers=headers).status_code==409
    assert client.get('/api/auth/me').json()['user']['username']=='bob'
    assert client.get('/api/plan').json()['store']['months']=={}
