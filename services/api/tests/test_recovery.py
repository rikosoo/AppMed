import hashlib
import time
import pytest
from fastapi.testclient import TestClient
from main import app
from accounts import connect
import recovery
PASSWORD='Original-password-123!'
NEW='Updated-password-456!'
@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('APP_ORIGIN','https://app.example.com');monkeypatch.setenv('SMTP_HOST','smtp.example.com');monkeypatch.setenv('SMTP_FROM','sender@example.com')
    sent=[];monkeypatch.setattr(recovery,'deliver_email',lambda *args:sent.append(args))
    client=TestClient(app);client.post('/api/auth/register',json={'username':'doctor','password':PASSWORD})
    return client,sent

def verify(client,sent,email='doctor@example.com'):
    assert client.post('/api/auth/recovery-email',json={'email':email,'current_password':PASSWORD}).status_code==200
    assert client.post('/api/auth/confirm-email',json={'token':sent[-1][2]}).status_code==200

def test_email_is_confirmed_single_use_password_protected_and_not_in_me(setup):
    client,sent=setup
    assert client.post('/api/auth/recovery-email',json={'email':'doctor@example.com','current_password':'bad'}).status_code==401
    assert client.post('/api/auth/recovery-email',json={'email':'doctor@example.com','current_password':PASSWORD},headers={'Origin':'https://evil.example'}).status_code==403
    client.post('/api/auth/recovery-email',json={'email':'Doctor@Example.com','current_password':PASSWORD})
    assert client.get('/api/auth/recovery-email').json()=={'email':None}
    token=sent[-1][2]
    with connect() as db:
        row=db.execute('SELECT * FROM recovery_tokens').fetchone()
        assert row['token_hash']==hashlib.sha256(token.encode()).hexdigest()
        assert token not in str(dict(row))
    assert client.post('/api/auth/confirm-email',json={'token':token}).status_code==200
    assert client.post('/api/auth/confirm-email',json={'token':token}).status_code==400
    assert client.get('/api/auth/recovery-email').json()=={'email':'doctor@example.com'}
    assert 'recovery_email' not in client.get('/api/auth/me').json()['user']

def test_reset_preserves_plan_revokes_all_devices_and_rejects_replay(setup):
    client,sent=setup;verify(client,sent)
    other=TestClient(app);other.post('/api/auth/login',json={'username':'doctor','password':PASSWORD})
    uid=client.get('/api/auth/me').json()['user']['id']
    with connect() as db:db.execute('INSERT INTO plans VALUES (?,?,?)',(uid,'{"version":1,"months":{}}',7))
    before=client.get('/api/plan').json()
    with connect() as db:
        db.executemany('INSERT INTO login_client_failures VALUES (?,?,?)',[('doctor',hashlib.sha256(b'testclient').hexdigest(),int(time.time()))]*8)
    assert client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'}).status_code==200
    token=sent[-1][2]
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':'short'}).status_code==422
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':NEW}).status_code==200
    assert other.get('/api/plan').status_code==401
    assert client.get('/api/plan').status_code==401
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':PASSWORD}).status_code==400
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==401
    assert client.post('/api/auth/login',json={'username':'doctor','password':NEW}).status_code==200
    assert client.get('/api/plan').json()==before

def test_generic_unknown_unverified_blocked_throttled_and_config_missing(setup,monkeypatch):
    client,sent=setup
    known=client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'})
    unknown=client.post('/api/auth/forgot-password',json={'email':'unknown@example.com'})
    assert known.json()==unknown.json();assert not sent
    verify(client,sent);sent.clear()
    for _ in range(7):assert client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'}).json()==unknown.json()
    assert len(sent)==4 # First unverified attempt counts too.
    with connect() as db:db.execute("UPDATE users SET status='blocked'")
    assert client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'}).json()==unknown.json()
    assert len(sent)==4
    monkeypatch.delenv('SMTP_HOST')
    assert client.post('/api/auth/forgot-password',json={'email':'anything@example.com'}).status_code==503

def test_expiration_password_change_email_change_and_deletion_invalidate_tokens(setup):
    client,sent=setup;verify(client,sent)
    client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'});token=sent[-1][2]
    with connect() as db:db.execute('UPDATE recovery_tokens SET expires_at=?',(int(time.time())-1,))
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':NEW}).status_code==400
    client.post('/api/auth/forgot-password',json={'email':'doctor@example.com'});token=sent[-1][2]
    client.post('/api/auth/update-account',json={'current_password':PASSWORD,'new_password':NEW})
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':PASSWORD}).status_code==400
    assert client.post('/api/auth/recovery-email',json={'email':'next@example.com','current_password':NEW}).status_code==200
    assert client.get('/api/auth/recovery-email').json()['email']=='doctor@example.com'
    assert client.post('/api/auth/confirm-email',json={'token':sent[-1][2]}).status_code==200
    client.post('/api/auth/forgot-password',json={'email':'next@example.com'});token=sent[-1][2]
    assert client.post('/api/auth/delete-account',json={'password':NEW,'confirmation':'EXCLUIR'}).status_code==204
    with connect() as db:assert db.execute('SELECT COUNT(*) FROM recovery_tokens').fetchone()[0]==0
    assert client.post('/api/auth/reset-password',json={'token':token,'new_password':PASSWORD}).status_code==400

def test_email_uniqueness_and_newest_link_wins(setup):
    client,sent=setup;verify(client,sent)
    client.post('/api/auth/recovery-email',json={'email':'next@example.com','current_password':PASSWORD});old=sent[-1][2]
    client.post('/api/auth/recovery-email',json={'email':'third@example.com','current_password':PASSWORD});latest=sent[-1][2]
    assert client.post('/api/auth/confirm-email',json={'token':old}).status_code==400
    assert client.post('/api/auth/confirm-email',json={'token':latest}).status_code==200
    other=TestClient(app);other.post('/api/auth/register',json={'username':'other','password':PASSWORD})
    other.post('/api/auth/recovery-email',json={'email':'third@example.com','current_password':PASSWORD})
    assert other.post('/api/auth/confirm-email',json={'token':sent[-1][2]}).status_code==400
    assert other.get('/api/auth/recovery-email').json()['email'] is None

def test_smtp_uses_tls_and_fragment_link_without_logging_secrets(monkeypatch,caplog):
    monkeypatch.setenv('APP_ORIGIN','https://app.example.com');monkeypatch.setenv('SMTP_HOST','smtp.example.com');monkeypatch.setenv('SMTP_FROM','sender@example.com');monkeypatch.setenv('SMTP_USERNAME','smtp-user');monkeypatch.setenv('SMTP_PASSWORD','smtp-secret')
    calls=[]
    class SMTP:
        def __init__(self,*args,**kwargs):calls.append(('connect',args,kwargs))
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def starttls(self,**kwargs):calls.append(('tls',))
        def login(self,*args):calls.append(('login',args))
        def send_message(self,message):calls.append(('message',message))
    monkeypatch.setattr(recovery.smtplib,'SMTP',SMTP)
    recovery.deliver_email('doctor@example.com','reset','secret-token')
    assert [c[0] for c in calls]==['connect','tls','login','message']
    message=calls[-1][1]
    assert 'https://app.example.com/recuperar-senha#reset=secret-token' in message.get_content()
    def broken(*args,**kwargs):raise RuntimeError('smtp-secret doctor@example.com secret-token')
    monkeypatch.setattr(recovery.smtplib,'SMTP',broken)
    recovery.deliver_email('doctor@example.com','reset','secret-token')
    assert 'recovery_email_delivery_failed' in caplog.text
    for secret in ['smtp-secret','doctor@example.com','secret-token']:assert secret not in caplog.text

def test_registration_optional_email_is_unverified_until_confirmed(setup):
    _,sent=setup
    client=TestClient(app)
    response=client.post('/api/auth/register',json={'username':'new-doctor','password':PASSWORD,'email':'new@example.com'})
    assert response.status_code==201
    assert client.get('/api/auth/recovery-email').json()=={'email':None}
    assert sent[-1][0:2]==('new@example.com','verify')
    assert client.post('/api/auth/confirm-email',json={'token':sent[-1][2]}).status_code==200
    assert client.get('/api/auth/recovery-email').json()=={'email':'new@example.com'}

def test_confirmation_email_budget_is_shared_between_new_accounts_and_settings(setup):
    client,sent=setup
    for index in range(4):
        other=TestClient(app)
        assert other.post('/api/auth/register',json={'username':f'new-{index}','password':PASSWORD,'email':'target@example.com'}).status_code==201
    assert client.post('/api/auth/recovery-email',json={'email':'target@example.com','current_password':PASSWORD}).status_code==200
    assert len(sent)==5
    other=TestClient(app)
    assert other.post('/api/auth/register',json={'username':'new-blocked-mail','password':PASSWORD,'email':'target@example.com'}).status_code==201
    assert len(sent)==5
    assert client.post('/api/auth/recovery-email',json={'email':'target@example.com','current_password':PASSWORD}).status_code==429
    assert len(sent)==5
