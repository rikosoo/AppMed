from fastapi.testclient import TestClient
from main import app
from accounts import connect

PASSWORD='Current-password-123!'
NEW_PASSWORD='Updated-password-456!'
def create(client,name='doctor'):
    result=client.post('/api/auth/register',json={'username':name,'password':PASSWORD})
    assert result.status_code==201
    return result.json()['user']['id']

def test_profile_requires_session_origin_current_password_and_owned_identity():
    client=TestClient(app);body={'username':'new-doctor','current_password':PASSWORD}
    assert client.post('/api/auth/update-account',json=body).status_code==401
    uid=create(client)
    assert client.post('/api/auth/update-account',json=body,headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/auth/update-account',json={**body,'current_password':'wrong'}).status_code==401
    assert client.post('/api/auth/update-account',json={**body,'user_id':'other'}).status_code==422
    assert client.post('/api/auth/update-account',json=body,headers={'X-FinanceMed-Account':'other'}).status_code==409
    assert client.get('/api/auth/me').json()['user']['id']==uid
    assert client.get('/api/auth/me').json()['user']['username']=='doctor'


def test_rename_preserves_id_plan_and_role_and_rotates_sessions():
    client,device=TestClient(app),TestClient(app);uid=create(client)
    plan={'store':{'version':1,'months':{'2026-10':{'works':[],'expenses':[],'target':1234500,'available':600,'saved':[],'onboardingComplete':True}}},'revision':0}
    assert client.put('/api/plan',json=plan).status_code==200
    assert device.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==200
    before=client.get('/api/plan').json()
    result=client.post('/api/auth/update-account',json={'username':'New.Doctor','current_password':PASSWORD})
    assert result.status_code==200
    assert result.json()['user']=={'id':uid,'username':'new.doctor','role':'user'}
    assert 'HttpOnly' in result.headers['set-cookie']
    assert client.get('/api/plan').json()==before
    assert client.get('/api/plan').json()['revision']==1
    assert device.get('/api/plan').status_code==401
    assert device.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==401
    assert device.post('/api/auth/login',json={'username':'new.doctor','password':PASSWORD}).status_code==200


def test_duplicate_username_is_atomic_and_invalid_values_are_rejected():
    client=TestClient(app);uid=create(client);create(TestClient(app),'taken')
    assert client.post('/api/auth/update-account',json={'username':'taken','new_password':NEW_PASSWORD,'current_password':PASSWORD}).status_code==409
    assert client.get('/api/auth/me').json()['user']['username']=='doctor'
    assert client.post('/api/auth/update-account',json={'username':'bad space','current_password':PASSWORD}).status_code==422
    assert client.post('/api/auth/update-account',json={'new_password':'short','current_password':PASSWORD}).status_code==422
    assert client.post('/api/auth/update-account',json={'current_password':PASSWORD}).status_code==422
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==200
    assert client.get('/api/auth/me').json()['user']['id']==uid


def test_password_update_revokes_old_devices_and_does_not_expose_password():
    client,device=TestClient(app),TestClient(app);uid=create(client)
    assert device.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==200
    result=client.post('/api/auth/update-account',json={'new_password':NEW_PASSWORD,'current_password':PASSWORD})
    assert result.status_code==200 and NEW_PASSWORD not in result.text
    assert client.get('/api/auth/me').status_code==200
    assert device.get('/api/auth/me').status_code==401
    with connect() as db:assert db.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0]==1
    assert device.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==401
    assert device.post('/api/auth/login',json={'username':'doctor','password':NEW_PASSWORD}).status_code==200


def test_profile_password_attempts_are_limited():
    client=TestClient(app);create(client)
    for _ in range(8):assert client.post('/api/auth/update-account',json={'username':'updated','current_password':'wrong'}).status_code==401
    assert client.post('/api/auth/update-account',json={'username':'updated','current_password':PASSWORD}).status_code==429
    assert client.get('/api/auth/me').json()['user']['username']=='doctor'
