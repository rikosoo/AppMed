import hashlib
import time
from fastapi import Request
from fastapi.testclient import TestClient
import main
from accounts import connect, password_hash, password_matches, require_user
from security import client_identity

PASSWORD='Security-tests-123!'
def account():
    client=TestClient(main.app)
    assert client.post('/api/auth/register',json={'username':'doctor','password':PASSWORD}).status_code==201
    return client


def test_api_rejects_oversized_chunked_and_non_json_bodies_before_validation():
    client=TestClient(main.app)
    for path,size in [('/api/auth/login',10001),('/api/optimizer',64001),('/api/plan',2000001)]:
        response=client.post(path,content=(b'x'*n for n in [size//2,size-size//2]),headers={'Content-Type':'application/json'})
        assert response.status_code==413
        assert response.headers['cache-control']=='no-store'
    assert client.post('/api/auth/login',content='username=doctor&password=secret',headers={'Content-Type':'application/x-www-form-urlencoded'}).status_code==415


def test_all_api_writes_reject_cross_origin_and_missing_origin_browser_requests():
    client=account()
    for path in ['/api/optimizer','/api/auth/logout','/api/auth/forgot-password','/api/plan']:
        for headers in [{'Origin':'https://evil.example'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}]:
            response=client.post(path,json={},headers=headers)
            assert response.status_code==403
    assert client.get('/api/auth/me').status_code==200


def test_validation_errors_do_not_echo_passwords_tokens_or_financial_documents():
    client=account()
    for path,body in [('/api/auth/register',{'username':'ok-user','password':'s3cr3t'}),('/api/auth/reset-password',{'token':'secret-link-token','new_password':'123'}),('/api/plan',{'store':{'sensitive-financial-data':123},'revision':-1})]:
        response=client.request('PUT' if path=='/api/plan' else 'POST',path,json=body)
        assert response.status_code==422
        assert isinstance(response.json()['detail'],str)
        for secret in ['s3cr3t','secret-link-token','sensitive-financial-data']:assert secret not in response.text
        assert response.headers['cache-control']=='no-store'


def test_registration_budget_is_persistent_and_untrusted_ip_headers_cannot_bypass_it(monkeypatch):
    monkeypatch.setenv('RATE_LIMIT_ENABLED','true');monkeypatch.delenv('TRUST_PROXY_CLIENT_IP',raising=False)
    client=TestClient(main.app)
    for index in range(20):
        assert client.post('/api/auth/register',json={},headers={'X-FinanceMed-Client-IP':f'192.0.2.{index}','X-Forwarded-For':f'198.51.100.{index}'}).status_code==422
    # A new client / worker sees the same SQLite budget, not a fresh in-memory counter.
    blocked=TestClient(main.app).post('/api/auth/register',json={})
    assert blocked.status_code==429 and 0<int(blocked.headers['retry-after'])<=900
    with connect() as db:
        row=db.execute('SELECT * FROM security_budgets').fetchone()
        assert row['count']==20 and 'testclient' not in row['key_hash']


def test_login_budget_stops_password_spraying_across_different_usernames(monkeypatch):
    monkeypatch.setenv('RATE_LIMIT_ENABLED','true')
    client=TestClient(main.app)
    # Invalid DTOs count too, without paying a password hash cost in this boundary test.
    for index in range(60):assert client.post('/api/auth/login',json={'username':str(index)}).status_code==422
    assert client.post('/api/auth/login',json={'username':'new-target'}).status_code==429


def test_optimizer_user_budget_survives_new_session_and_recovers_after_window(monkeypatch):
    client=account();monkeypatch.setenv('RATE_LIMIT_ENABLED','true')
    payload={'works':[],'expenses_cents':0,'target_cents':10000,'available_minutes':60}
    for _ in range(20):assert client.post('/api/optimizer',json=payload).status_code==200
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==200
    assert client.post('/api/optimizer',json=payload).status_code==429
    clock=time.time();monkeypatch.setattr('security.time.time',lambda:clock+61)
    assert client.post('/api/optimizer',json=payload).status_code==200


def test_trusted_proxy_normalizes_ip_and_groups_ipv6_clients(monkeypatch):
    token='test-proxy-token-'+'A'*48
    scope={'client':('10.0.0.2',1),'headers':[(b'x-financemed-client-ip',b'192.0.2.1')]}
    monkeypatch.setenv('INTERNAL_PROXY_TOKEN',token)
    monkeypatch.delenv('TRUST_PROXY_CLIENT_IP',raising=False);assert client_identity(scope)=='10.0.0.2'
    monkeypatch.setenv('TRUST_PROXY_CLIENT_IP','true');assert client_identity(scope)=='10.0.0.2'
    scope['headers'].append((b'x-financemed-proxy-token',token.encode()));assert client_identity(scope)=='192.0.2.1'
    scope['headers']=[(b'x-financemed-client-ip',b'not-an-ip'),(b'x-financemed-proxy-token',token.encode())];assert client_identity(scope)=='10.0.0.2'
    scope['headers']=[(b'x-financemed-client-ip',b'2001:db8::1'),(b'x-financemed-proxy-token',token.encode())];assert client_identity(scope)=='2001:db8::/64'
    scope['headers']=[(b'x-financemed-client-ip',b'2001:db8::abcd'),(b'x-financemed-proxy-token',token.encode())];assert client_identity(scope)=='2001:db8::/64'


def test_revoked_session_cannot_finish_a_pending_plan_write():
    client=account()
    def revoked(request:Request):
        user=require_user(request)
        with connect() as db:db.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],))
        return user
    main.app.dependency_overrides[require_user]=revoked
    try:
        response=client.put('/api/plan',json={'revision':0,'store':{'version':1,'months':{}}})
        assert response.status_code==401
        with connect() as db:assert db.execute('SELECT COUNT(*) FROM plans').fetchone()[0]==0
    finally:main.app.dependency_overrides.pop(require_user,None)


def test_password_hash_upgrade_accepts_existing_accounts_without_reset():
    client=account();salt=b'0123456789abcdef'
    old='scrypt$'+salt.hex()+'$'+hashlib.scrypt(PASSWORD.encode(),salt=salt,n=16384,r=8,p=1,dklen=32).hex()
    assert password_matches(PASSWORD,old) and not password_matches('incorrect',old)
    with connect() as db:db.execute('UPDATE users SET password_hash=?',(old,))
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD}).status_code==200
    with connect() as db:updated=db.execute('SELECT password_hash FROM users').fetchone()[0]
    assert updated.startswith('scrypt$v2$') and password_matches(PASSWORD,updated)
    assert PASSWORD not in updated and updated!=old
    for corrupted in ['scrypt$garbage','scrypt$v2$invalid$hash','other$'+salt.hex()+'$'+'0'*64]:assert not password_matches(PASSWORD,corrupted)

def test_parallel_calculations_are_bounded_and_a_slot_is_released():
    client=account();payload={'works':[],'expenses_cents':0,'target_cents':10000,'available_minutes':60}
    with main._optimizer_slots,main._optimizer_slots:
        response=client.post('/api/optimizer',json=payload)
        assert response.status_code==429 and response.headers['retry-after']=='2'
    assert client.post('/api/optimizer',json=payload).status_code==200

def test_admin_search_and_deletion_ledger_treat_sql_fragments_as_values():
    from account_cleanup import record_deletion
    from accounts import database_path
    client=account()
    with connect() as db:
        db.execute("UPDATE users SET role='admin' WHERE username='doctor'")
        uid=db.execute('SELECT id FROM users').fetchone()[0]
    response=client.get('/api/admin/users',params={'q':"' OR 1=1 --"})
    assert response.status_code==200 and response.json()['total']==0
    record_deletion(database_path(),"'); DROP TABLE users; --")
    with connect() as db:
        assert db.execute('SELECT id FROM users').fetchone()[0]==uid

def test_login_lock_is_scoped_to_user_and_authenticated_client_not_global(monkeypatch):
    client=account();token='test-proxy-token-'+'A'*48
    monkeypatch.setenv('INTERNAL_PROXY_TOKEN',token);monkeypatch.setenv('TRUST_PROXY_CLIENT_IP','true')
    attacker={'X-FinanceMed-Client-IP':'192.0.2.1','X-FinanceMed-Proxy-Token':token}
    owner={'X-FinanceMed-Client-IP':'192.0.2.2','X-FinanceMed-Proxy-Token':token}
    for _ in range(8):assert client.post('/api/auth/login',json={'username':'doctor','password':'wrong'},headers=attacker).status_code==401
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD},headers=attacker).status_code==429
    assert client.post('/api/auth/login',json={'username':'doctor','password':PASSWORD},headers=owner).status_code==200
    with connect() as db:
        assert db.execute('SELECT COUNT(*) FROM login_failures WHERE username=?',('doctor',)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM login_client_failures WHERE username=?',('doctor',)).fetchone()[0]==8


def test_production_requires_private_proxy_and_origin_even_without_browser_metadata(monkeypatch):
    token='test-proxy-token-'+'A'*48
    monkeypatch.setenv('SESSION_COOKIE_SECURE','true');monkeypatch.setenv('APP_ALLOWED_ORIGINS','https://finance.example');monkeypatch.setenv('INTERNAL_PROXY_TOKEN',token)
    client=TestClient(main.app,base_url='https://finance.example')
    body={'username':'production-doctor','password':PASSWORD}
    forged={'X-Forwarded-Proto':'https','Origin':'https://finance.example'}
    assert client.post('/api/auth/register',json=body,headers=forged).status_code==403
    headers={**forged,'X-FinanceMed-Proxy-Token':token}
    assert client.post('/api/auth/register',json=body,headers={k:v for k,v in headers.items() if k!='Origin'}).status_code==403
    assert client.post('/api/auth/register',json=body,headers=headers).status_code==201
    payload={'works':[],'expenses_cents':0,'target_cents':10000,'available_minutes':60}
    assert client.post('/api/optimizer',json=payload,headers={k:v for k,v in headers.items() if k!='Origin'}).status_code==403
    assert client.post('/api/optimizer',json=payload,headers=headers).status_code==200
    assert client.get('/api/auth/me',headers=forged).status_code==403
    assert client.get('/api/auth/me',headers=headers).status_code==200
    assert client.get('/api/health').status_code==200
