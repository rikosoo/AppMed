import sqlite3
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from main import app
from accounts import connect,database_path
from account_cleanup import ledger_path,prune_backups

PASSWORD='Deletion-tests-123!'
def signup(client,name):
    result=client.post('/api/auth/register',json={'username':name,'password':PASSWORD})
    assert result.status_code==201
    return result.json()['user']['id']

def document(target):
    return {'store':{'version':1,'months':{'2026-10':{'works':[],'expenses':[],'target':target,'available':1200,'saved':[],'onboardingComplete':True}}},'revision':0}

def test_deletion_requires_owner_session_origin_confirmation_and_password():
    client=TestClient(app);body={'password':PASSWORD,'confirmation':'EXCLUIR'}
    assert client.post('/api/auth/delete-account',json=body).status_code==401
    uid=signup(client,'owner')
    assert client.post('/api/auth/delete-account',json=body,headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/auth/delete-account',json={**body,'confirmation':'no'}).status_code==422
    assert client.post('/api/auth/delete-account',json={**body,'user_id':'other'}).status_code==422
    assert client.post('/api/auth/delete-account',json=body,headers={'X-FinanceMed-Account':'other'}).status_code==409
    assert client.post('/api/auth/delete-account',json={**body,'password':'wrong'}).status_code==401
    assert client.get('/api/auth/me').json()['user']['id']==uid
    for _ in range(7):assert client.post('/api/auth/delete-account',json={**body,'password':'wrong'}).status_code==401
    assert client.post('/api/auth/delete-account',json=body).status_code==429


def test_deletion_removes_data_and_revokes_other_devices():
    owner,other,device=TestClient(app),TestClient(app),TestClient(app)
    uid=signup(owner,'owner');other_id=signup(other,'other')
    assert owner.put('/api/plan',json=document(10000)).status_code==200
    assert other.put('/api/plan',json=document(20000)).status_code==200
    assert device.post('/api/auth/login',json={'username':'owner','password':PASSWORD}).status_code==200
    with connect() as db:db.execute('INSERT INTO admin_audit(actor_id,action,subject_id,created_at) VALUES (?,?,?,?)',(other_id,'account_active',uid,int(time.time())))
    response=owner.post('/api/auth/delete-account',json={'password':PASSWORD,'confirmation':'EXCLUIR'})
    assert response.status_code==204 and 'Max-Age=0' in response.headers['set-cookie']
    assert owner.get('/api/plan').status_code==401
    assert device.get('/api/plan').status_code==401
    assert owner.post('/api/auth/login',json={'username':'owner','password':PASSWORD}).status_code==401
    assert other.get('/api/plan').json()['store']['months']['2026-10']['target']==20000
    with connect() as db:
        for table in ('sessions','plans','usage_daily'):assert db.execute(f'SELECT COUNT(*) FROM {table} WHERE user_id=?',(uid,)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM users WHERE id=?',(uid,)).fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM admin_audit WHERE subject_id=?',(uid,)).fetchone()[0]==0
    with sqlite3.connect(ledger_path(database_path())) as db:
        assert db.execute('SELECT user_id FROM deleted_accounts').fetchone()[0]==uid
        assert [r[1] for r in db.execute('PRAGMA table_info(deleted_accounts)')]==['user_id','deleted_at']


def test_restored_backup_cannot_reactivate_deleted_account(tmp_path):
    owner=TestClient(app);uid=signup(owner,'owner')
    assert owner.put('/api/plan',json=document(10000)).status_code==200
    backup=tmp_path/'before.sqlite3'
    with sqlite3.connect(database_path()) as source,sqlite3.connect(backup) as target:source.backup(target)
    assert owner.post('/api/auth/delete-account',json={'password':PASSWORD,'confirmation':'EXCLUIR'}).status_code==204
    with sqlite3.connect(backup) as source,sqlite3.connect(database_path()) as target:source.backup(target)
    assert owner.post('/api/auth/login',json={'username':'owner','password':PASSWORD}).status_code==401
    with connect() as db:assert db.execute('SELECT 1 FROM users WHERE id=?',(uid,)).fetchone() is None
    assert signup(owner,'owner')!=uid


def test_backup_retention_only_prunes_expired_managed_backups(tmp_path):
    path=tmp_path/'financemed.sqlite3';folder=tmp_path/'backups';folder.mkdir()
    now=datetime(2026,10,26,tzinfo=timezone.utc).timestamp()
    for name in ['financemed-20260901T000000Z.sqlite3','before-update-20260901T000000Z.sqlite3','financemed-20261025T000000Z.sqlite3','manual.sqlite3','financemed-invalid.sqlite3']:(folder/name).touch()
    prune_backups(path,now)
    assert sorted(p.name for p in folder.iterdir())==['financemed-20261025T000000Z.sqlite3','financemed-invalid.sqlite3','manual.sqlite3']
