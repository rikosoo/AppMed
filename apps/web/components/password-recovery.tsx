'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {apiFetch} from '@/lib/api-client';
export default function PasswordRecovery({onBack}:{onBack:()=>void}){
 const [token,setToken]=useState(''),[purpose,setPurpose]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{const hash=new URLSearchParams(location.hash.slice(1));const purpose=hash.has('verify')?'verify':hash.has('reset')?'reset':'';setPurpose(purpose);setToken(hash.get(purpose)||'');if(purpose)history.replaceState(null,'',location.pathname+location.search);},[]);
 useEffect(()=>{const back=(event:Event)=>{event.preventDefault();onBack();};document.addEventListener('financemed:back',back);return()=>document.removeEventListener('financemed:back',back);},[onBack]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setMessage('');const form=new FormData(event.currentTarget);
  if(purpose==='reset'&&form.get('password')!==form.get('confirm')){setError('As senhas não coincidem.');return;}
  setBusy(true);
  try{
   const action=purpose==='verify'?'confirm-email':purpose==='reset'?'reset-password':'forgot-password';
   const body=purpose==='verify'?{token}:purpose==='reset'?{token,new_password:form.get('password')}:{email:form.get('email')};
   const response=await apiFetch(`/api/auth/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Não foi possível continuar. Revise os campos.');
   setMessage(data.message);setDone(true);setToken('');
  }catch(e){setError(e instanceof Error&&e.name!=='TypeError'?e.message:'Sem conexão. Tente novamente.');}finally{setBusy(false);}
 }
 return <section className="welcome-form recovery-form"><h2>{purpose==='verify'?'Confirme seu e-mail':purpose==='reset'?'Escolha sua nova senha':'Esqueceu a senha?'}</h2><p>{purpose==='verify'?'Confirme para habilitar a recuperação da sua conta.':purpose==='reset'?'A nova senha encerrará as sessões em todos os dispositivos.':'Informe o e-mail confirmado em Minha conta. Contas antigas precisam cadastrar e confirmar um e-mail enquanto ainda têm acesso.'}</p>
 {message&&<p className="account-notice" role="status">{message}</p>}
 {!done&&<form onSubmit={submit}>{!purpose&&<label>E-mail de recuperação<input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={254} required disabled={busy}/></label>}{purpose==='reset'&&<><label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy}/></label><label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy}/></label></>}{error&&<div className="alert error" role="alert">{error}</div>}<button className="primary-button full" disabled={busy} type="submit">{busy?'Aguarde…':purpose==='verify'?'Confirmar e-mail':purpose==='reset'?'Salvar nova senha':'Enviar link de recuperação'}</button></form>}
 <button className="outline-button full auth-switch" disabled={busy} onClick={onBack}>Voltar para entrar</button>{error&&purpose==='verify'&&<p>Para reenviar a confirmação, entre e cadastre o e-mail novamente em Minha conta.</p>}{error&&purpose==='reset'&&<button className="text-link" disabled={busy} onClick={()=>{setPurpose('');setToken('');setError('');setDone(false);}}>Solicitar novo link</button>}</section>;
}
