"""Verified recovery addresses and single-use, hashed email tokens."""
import hashlib
import logging
import os
import re
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage
from urllib.parse import urlsplit
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from accounts import connect, require_user, check_auth_transport, password_matches, password_hash, COOKIE

router=APIRouter(prefix='/api/auth')
GENERIC='Se houver uma conta habilitada com esse e-mail confirmado, enviaremos um link de recuperação. Confira também o spam.'
INVALID='Link inválido ou expirado. Solicite um novo link.'

def normalize_email(value):
    value=value.strip().lower()
    if len(value)>254 or not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}",value) or '..' in value:
        raise HTTPException(422,'Informe um e-mail válido.')
    return value

def mail_settings():
    origin=os.environ.get('APP_ORIGIN','').rstrip('/')
    url=urlsplit(origin)
    host=os.environ.get('SMTP_HOST','')
    sender=os.environ.get('SMTP_FROM','')
    mode=os.environ.get('SMTP_SECURITY','starttls')
    if url.scheme!='https' or not url.netloc or url.path or url.query or url.fragment or url.username or not host or not sender or mode not in ('starttls','ssl'):
        raise HTTPException(503,'O envio de e-mails ainda não foi configurado. Tente mais tarde ou contate o suporte.')
    normalize_email(sender)
    try:port=int(os.environ.get('SMTP_PORT','465' if mode=='ssl' else '587'))
    except ValueError:raise HTTPException(503,'O envio de e-mails ainda não foi configurado.')
    return origin,host,port,sender,mode

def deliver_email(email,purpose,token):
    try:
        origin,host,port,sender,mode=mail_settings()
        link=f'{origin}/recuperar-senha#{purpose}={token}'
        message=EmailMessage();message['From']=sender;message['To']=email
        message['Subject']='Confirme seu e-mail • FinanceMed' if purpose=='verify' else 'Recupere sua senha • FinanceMed'
        duration='24 horas' if purpose=='verify' else '30 minutos'
        message.set_content(f'{"Confirme seu e-mail de recuperação" if purpose=="verify" else "Escolha uma nova senha"}:\n\n{link}\n\nEste link é de uso único e expira em {duration}. Se você não solicitou, ignore esta mensagem. Sua senha não foi alterada.\nFinanceMed • Contato Suporte')
        client=smtplib.SMTP_SSL if mode=='ssl' else smtplib.SMTP
        kwargs={'timeout':15}
        if mode=='ssl':kwargs['context']=ssl.create_default_context()
        with client(host,port,**kwargs) as smtp:
            if mode=='starttls':smtp.starttls(context=ssl.create_default_context())
            username=os.environ.get('SMTP_USERNAME','')
            if username:smtp.login(username,os.environ.get('SMTP_PASSWORD',''))
            smtp.send_message(message)
    except Exception:
        # Never log addresses, credentials or links (SMTP exceptions can contain them).
        logging.getLogger(__name__).error('recovery_email_delivery_failed')

def limited(db,key,limit=5):
    now=int(time.time());digest=hashlib.sha256(key.encode()).hexdigest()
    db.execute('DELETE FROM recovery_attempts WHERE created_at<?',(now-900,))
    if db.execute('SELECT COUNT(*) FROM recovery_attempts WHERE key_hash=?',(digest,)).fetchone()[0]>=limit:return True
    db.execute('INSERT INTO recovery_attempts VALUES (?,?)',(digest,now));return False

def issue_token(db,user,purpose,email):
    now=int(time.time());token=secrets.token_urlsafe(32)
    db.execute('DELETE FROM recovery_tokens WHERE expires_at<=? OR (user_id=? AND purpose=?)',(now,user['id'],purpose))
    db.execute('INSERT INTO recovery_tokens VALUES (?,?,?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user['id'],purpose,email,user['password_hash'],now+(86400 if purpose=='verify' else 1800)))
    return token

class EmailRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:str=Field(min_length=3,max_length=254)
class SetEmail(EmailRequest):
    current_password:str=Field(min_length=1,max_length=128)
class TokenRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    token:str=Field(min_length=20,max_length=200)
class ResetPassword(TokenRequest):
    new_password:str=Field(min_length=8,max_length=128)

@router.get('/recovery-email')
def recovery_email(response:Response,user=Depends(require_user)):
    response.headers['Cache-Control']='no-store'
    with connect() as db:row=db.execute('SELECT recovery_email FROM users WHERE id=?',(user['id'],)).fetchone()
    return {'email':row['recovery_email']}

@router.post('/recovery-email')
def set_email(data:SetEmail,request:Request,response:Response,tasks:BackgroundTasks,user=Depends(require_user)):
    check_auth_transport(request);mail_settings();email=normalize_email(data.email)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if limited(db,'set:'+user['id']):db.commit();raise HTTPException(429,'Aguarde 15 minutos antes de tentar novamente.')
        row=db.execute('SELECT id,password_hash,status FROM users WHERE id=?',(user['id'],)).fetchone()
        if not row or row['status']!='active':raise HTTPException(401,'Entre novamente.')
        if not password_matches(data.current_password,row['password_hash']):db.commit();raise HTTPException(401,'Senha atual incorreta. Nenhum dado foi alterado.')
        if limited(db,'verify-email:'+email):db.commit();raise HTTPException(429,'Aguarde 15 minutos antes de solicitar outro e-mail.')
        token=issue_token(db,row,'verify',email)
    tasks.add_task(deliver_email,email,'verify',token);response.headers['Cache-Control']='no-store'
    return {'message':'Enviamos um link para confirmar o e-mail. O endereço só será usado para recuperação após a confirmação.'}

@router.post('/forgot-password')
def forgot(data:EmailRequest,request:Request,response:Response,tasks:BackgroundTasks):
    check_auth_transport(request);mail_settings();email=normalize_email(data.email)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        throttled=limited(db,'forgot:'+email)
        row=db.execute("SELECT id,password_hash FROM users WHERE recovery_email=? AND status='active'",(email,)).fetchone()
        if row and not throttled:
            token=issue_token(db,row,'reset',email);tasks.add_task(deliver_email,email,'reset',token)
    response.headers['Cache-Control']='no-store'
    return {'message':GENERIC}

def token_row(db,token,purpose):
    row=db.execute('SELECT t.*,u.password_hash AS current_hash,u.recovery_email,u.status FROM recovery_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>?',(hashlib.sha256(token.encode()).hexdigest(),purpose,int(time.time()))).fetchone()
    if not row or row['status']!='active' or row['credential_hash']!=row['current_hash'] or (purpose=='reset' and row['email']!=row['recovery_email']):
        raise HTTPException(400,INVALID)
    return row

@router.post('/confirm-email')
def confirm_email(data:TokenRequest,request:Request,response:Response):
    check_auth_transport(request)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');row=token_row(db,data.token,'verify')
        if db.execute('SELECT id FROM users WHERE recovery_email=? AND id!=?',(row['email'],row['user_id'])).fetchone():raise HTTPException(400,INVALID)
        db.execute('UPDATE users SET recovery_email=? WHERE id=?',(row['email'],row['user_id']))
        db.execute('DELETE FROM recovery_tokens WHERE user_id=?',(row['user_id'],))
    response.headers['Cache-Control']='no-store'
    return {'message':'E-mail confirmado. Você já pode usá-lo para recuperar a senha.'}

@router.post('/reset-password')
def reset_password(data:ResetPassword,request:Request,response:Response):
    check_auth_transport(request)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE');row=token_row(db,data.token,'reset')
        db.execute('UPDATE users SET password_hash=? WHERE id=?',(password_hash(data.new_password),row['user_id']))
        db.execute('DELETE FROM sessions WHERE user_id=?',(row['user_id'],))
        db.execute('DELETE FROM recovery_tokens WHERE user_id=?',(row['user_id'],))
        db.execute('DELETE FROM login_failures WHERE username=(SELECT username FROM users WHERE id=?)',(row['user_id'],))
        db.execute('DELETE FROM login_client_failures WHERE username=(SELECT username FROM users WHERE id=?)',(row['user_id'],))
    response.delete_cookie(COOKIE,path='/',secure=os.environ.get('SESSION_COOKIE_SECURE','false').lower()=='true',httponly=True,samesite='lax');response.headers['Cache-Control']='no-store'
    return {'message':'Senha alterada. Entre novamente com seu usuário e a nova senha.'}
