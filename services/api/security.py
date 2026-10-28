"""Bounded API requests and persistent abuse budgets behind the private proxy."""
import asyncio
import hashlib
import ipaddress
import os
import time
from fastapi import HTTPException, Request
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse


def limits_enabled():
    return os.environ.get('RATE_LIMIT_ENABLED',os.environ.get('SESSION_COOKIE_SECURE','false')).lower()=='true'


def client_identity(scope):
    peer=(scope.get('client') or ('unknown',0))[0]
    if os.environ.get('TRUST_PROXY_CLIENT_IP','false').lower()=='true':
        value=dict(scope['headers']).get(b'x-financemed-client-ip',b'').decode('latin1')
        try:
            address=ipaddress.ip_address(value)
            return str(ipaddress.ip_network(str(address)+'/64',strict=False)) if address.version==6 else str(address)
        except ValueError:pass
    return peer


def consume_budget(key,limit,seconds):
    from accounts import connect
    now=int(time.time());window=now//seconds
    digest=hashlib.sha256(key.encode()).hexdigest()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM security_budgets WHERE expires_at<=?',(now,))
        row=db.execute('SELECT window,count FROM security_budgets WHERE key_hash=?',(digest,)).fetchone()
        if row and row['window']==window and row['count']>=limit:
            raise HTTPException(429,'Muitas solicitações. Aguarde antes de tentar novamente.',headers={'Retry-After':str(seconds-now%seconds)})
        db.execute('INSERT INTO security_budgets VALUES (?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET window=excluded.window,count=excluded.count,expires_at=excluded.expires_at',
                   (digest,window,row['count']+1 if row and row['window']==window else 1,(window+1)*seconds))


def client_budget(scope):
    if not limits_enabled():return
    path=scope['path'];ip=client_identity(scope)
    if path=='/api/auth/register':group,limit,seconds='register',20,900
    elif path=='/api/auth/forgot-password':group,limit,seconds='forgot',10,900
    elif path=='/api/auth/login':group,limit,seconds='login',60,300
    elif path=='/api/optimizer':group,limit,seconds='optimizer',30,60
    else:group,limit,seconds='write',120,60
    consume_budget('client:'+ip+':'+group,limit,seconds)


class ApiSecurity:
    def __init__(self,app):self.app=app

    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or not scope['path'].startswith('/api/'):
            return await self.app(scope,receive,send)

        async def safe_send(message):
            if message['type']=='http.response.start':
                message={**message,'headers':[(key,value) for key,value in message.get('headers',[]) if key.lower()!=b'cache-control']+[(b'cache-control',b'no-store'),(b'x-content-type-options',b'nosniff')]}
            await send(message)

        if scope['method'] in ('POST','PUT','PATCH','DELETE'):
            try:
                from accounts import check_origin
                check_origin(Request(scope))
                await run_in_threadpool(client_budget,scope)
                limit=64000 if scope['path']=='/api/optimizer' else 2_000_000 if scope['path']=='/api/plan' else 10000
                chunks=[];size=0
                async def read_body():
                    nonlocal size
                    while True:
                        message=await receive()
                        if message['type']=='http.disconnect':raise HTTPException(400,'A conexão foi interrompida.')
                        chunk=message.get('body',b'');size+=len(chunk)
                        if size>limit:raise HTTPException(413,'Os dados enviados excedem o limite de tamanho.')
                        chunks.append(chunk)
                        if not message.get('more_body',False):break
                try:await asyncio.wait_for(read_body(),timeout=30)
                except asyncio.TimeoutError:raise HTTPException(408,'Tempo esgotado ao receber os dados.')
                if size:
                    media=dict(scope['headers']).get(b'content-type',b'').decode('latin1').split(';',1)[0].strip().lower()
                    if media!='application/json':raise HTTPException(415,'Envie os dados em JSON.')
            except HTTPException as error:
                return await JSONResponse({'detail':error.detail},status_code=error.status_code,headers=error.headers)(scope,receive,safe_send)
            original_receive=receive;delivered=False
            async def replay():
                nonlocal delivered
                if not delivered:
                    delivered=True;return {'type':'http.request','body':b''.join(chunks),'more_body':False}
                return await original_receive()
            receive=replay
        await self.app(scope,receive,safe_send)
