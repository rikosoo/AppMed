"""Persistent local accounts and opaque sessions. No password/token plaintext stored."""
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import unicodedata
import uuid
from contextlib import contextmanager
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

router = APIRouter(prefix='/api')
COOKIE = 'financemed_session'
SESSION_SECONDS = 7*24*3600
SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS plans (user_id TEXT PRIMARY KEY REFERENCES users(id), document TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS login_failures (username TEXT NOT NULL, attempted_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS failures_name ON login_failures(username,attempted_at);
'''

def database_path():
    return Path(os.environ.get('DATABASE_PATH',str(Path(__file__).parent/'data'/'financemed.sqlite3')))

@contextmanager
def connect():
    path=database_path();path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    connection=sqlite3.connect(path,timeout=10)
    os.chmod(path,0o600)
    connection.row_factory=sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    connection.execute('PRAGMA busy_timeout=10000')
    connection.execute('PRAGMA journal_mode=WAL')
    connection.executescript(SCHEMA)
    # Upgrade existing accounts without replacing users or their financial plans.
    columns={row['name'] for row in connection.execute('PRAGMA table_info(users)')}
    for name,definition in [('role', "TEXT NOT NULL DEFAULT 'user'"),('status', "TEXT NOT NULL DEFAULT 'active'"),('last_login_at','INTEGER'),('last_active_at','INTEGER')]:
        if name not in columns:
            try: connection.execute(f'ALTER TABLE users ADD COLUMN {name} {definition}')
            except sqlite3.OperationalError:
                if name not in {r['name'] for r in connection.execute('PRAGMA table_info(users)')}: raise
    connection.executescript('''
    CREATE TABLE IF NOT EXISTS usage_daily (
        user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, event TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(user_id,day,event));
    CREATE INDEX IF NOT EXISTS usage_day ON usage_daily(day,event);
    CREATE TABLE IF NOT EXISTS admin_audit (
        id INTEGER PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
        subject_id TEXT, created_at INTEGER NOT NULL);
    ''')
    try:
        with connection:
            yield connection
    finally:
        connection.close()

def password_hash(password,salt=None):
    salt=salt or secrets.token_bytes(16)
    value=hashlib.scrypt(password.encode(),salt=salt,n=16384,r=8,p=1,dklen=32)
    return 'scrypt$'+salt.hex()+'$'+value.hex()

def password_matches(password,encoded):
    try:
        algorithm,salt,_=encoded.split('$')
        return algorithm=='scrypt' and hmac.compare_digest(password_hash(password,bytes.fromhex(salt)),encoded)
    except (ValueError,TypeError):
        return False

DUMMY_HASH=password_hash('dummy-password-not-an-account')

def normalize_username(value):
    return unicodedata.normalize('NFKC',value).strip().casefold()

def check_origin(request:Request):
    allowed={value.strip().rstrip('/') for value in os.environ.get('APP_ALLOWED_ORIGINS','http://localhost:3000,http://127.0.0.1:3000').split(',')}
    origin=request.headers.get('origin')
    if origin and origin.rstrip('/') not in allowed:
        raise HTTPException(403,'Origem não autorizada para esta operação.')

def secure_cookie():
    return os.environ.get('SESSION_COOKIE_SECURE','false').lower()=='true'

def check_auth_transport(request):
    check_origin(request)
    if secure_cookie() and request.headers.get('x-forwarded-proto')!='https':
        raise HTTPException(403,'Use o endereço HTTPS do aplicativo para criar uma conta ou entrar.')

def require_user(request:Request):
    raw=request.cookies.get(COOKIE,'')
    if not raw or len(raw)>200:
        raise HTTPException(401,'Sua sessão expirou. Entre novamente.')
    digest=hashlib.sha256(raw.encode()).hexdigest()
    with connect() as db:
        row=db.execute('SELECT u.id,u.username,u.role,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',(digest,int(time.time()))).fetchone()
    if not row or row['status']!='active':
        raise HTTPException(401,'Sua sessão expirou. Entre novamente.')
    expected=request.headers.get('x-financemed-account')
    if expected and expected!=row['id']:
        raise HTTPException(409,'A conta da sessão mudou em outra aba. Recarregue a página antes de continuar.')
    return dict(row)

class Credentials(BaseModel):
    username:str=Field(min_length=1,max_length=80)
    password:str=Field(min_length=1,max_length=128)

def issue_session(response,user_id,db):
    token=secrets.token_urlsafe(32)
    now=int(time.time())
    db.execute('UPDATE users SET last_login_at=? WHERE id=?',(now,user_id))
    db.execute('DELETE FROM sessions WHERE expires_at<=?',(now,))
    db.execute('INSERT INTO sessions VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user_id,now+SESSION_SECONDS))
    response.set_cookie(COOKIE,token,max_age=SESSION_SECONDS,httponly=True,secure=secure_cookie(),samesite='lax',path='/')
    response.headers['Cache-Control']='no-store'

@router.post('/auth/register',status_code=201)
def register(data:Credentials,request:Request,response:Response):
    check_auth_transport(request)
    username=normalize_username(data.username)
    if not re.fullmatch(r'[a-z0-9_.@+\-]{3,80}',username):
        raise HTTPException(422,'Use um usuário com 3 a 80 letras, números ou os símbolos . _ @ + - .')
    if len(data.password)<8:
        raise HTTPException(422,'Escolha uma senha com pelo menos 8 caracteres.')
    user_id=str(uuid.uuid4())
    with connect() as db:
        try:
            db.execute('INSERT INTO users (id,username,password_hash,created_at) VALUES (?,?,?,?)',(user_id,username,password_hash(data.password),int(time.time())))
        except sqlite3.IntegrityError:
            raise HTTPException(409,'Este usuário já está cadastrado. Entre na sua conta ou escolha outro nome.')
        issue_session(response,user_id,db)
    return {'user':{'id':user_id,'username':username}}

@router.post('/auth/login')
def login(data:Credentials,request:Request,response:Response):
    check_auth_transport(request)
    username=normalize_username(data.username)
    now=int(time.time())
    with connect() as db:
        db.execute('DELETE FROM login_failures WHERE attempted_at<?',(now-900,))
        count=db.execute('SELECT COUNT(*) FROM login_failures WHERE username=? AND attempted_at>?',(username,now-900)).fetchone()[0]
        if count>=8:
            raise HTTPException(429,'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.',headers={'Retry-After':'900'})
        user=db.execute('SELECT id,username,password_hash,status FROM users WHERE username=?',(username,)).fetchone()
        matches=password_matches(data.password,user['password_hash'] if user else DUMMY_HASH)
        if not user or not matches or user['status']!='active':
            db.execute('INSERT INTO login_failures VALUES (?,?)',(username,now))
            db.commit()
            raise HTTPException(401,'Usuário ou senha incorretos. Confira e tente novamente.')
        db.execute('DELETE FROM login_failures WHERE username=?',(username,))
        issue_session(response,user['id'],db)
    return {'user':{'id':user['id'],'username':user['username']}}

@router.get('/auth/me')
def me(response:Response,user=Depends(require_user)):
    response.headers['Cache-Control']='no-store'
    return {'user':user}

@router.post('/auth/logout',status_code=204)
def logout(request:Request,response:Response):
    check_origin(request)
    if request.headers.get('x-financemed-account'):
        try: require_user(request)
        except HTTPException as error:
            if error.status_code!=401: raise
    token=request.cookies.get(COOKIE,'')
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(COOKIE,path='/',secure=secure_cookie(),httponly=True,samesite='lax')
    response.headers['Cache-Control']='no-store'

@router.get('/plan')
def get_plan(response:Response,user=Depends(require_user)):
    with connect() as db:
        row=db.execute('SELECT document,revision FROM plans WHERE user_id=?',(user['id'],)).fetchone()
    response.headers['Cache-Control']='no-store'
    return {'store':json.loads(row['document']) if row else {'version':1,'months':{}},'revision':row['revision'] if row else 0}
