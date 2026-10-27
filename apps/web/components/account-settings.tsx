'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import RecoveryEmail from './recovery-email';
import { X, Trash2 } from 'lucide-react';
import { apiFetch, mobileApiOrigin } from '@/lib/api-client';
import { Capacitor } from '@capacitor/core';
export default function AccountSettings({account,onClose,onDeleted,onUpdated}:{account:{id:string;username:string};onUpdated:(user:{id:string;username:string;role?:'admin'|'user'})=>void;onClose:()=>void;onDeleted:(message:string)=>void}){
 const [editing,setEditing]=useState<'username'|'password'|null>(null),[success,setSuccess]=useState('');
 const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;panel.current?.focus();const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;previous?.focus();};},[]);
 useEffect(()=>{const back=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();if(!busy)onClose();};document.addEventListener('financemed:back',back,true);return()=>document.removeEventListener('financemed:back',back,true);},[busy,onClose]);
 async function update(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setSuccess('');const form=new FormData(event.currentTarget);
  if(editing==='password'&&form.get('new_password')!==form.get('confirm_password')){setError('As novas senhas não coincidem.');return;}
  setBusy(true);
  try{
   const payload=editing==='username'?{username:form.get('username'),current_password:form.get('current_password')}:{new_password:form.get('new_password'),current_password:form.get('current_password')};
   const response=await apiFetch('/api/auth/update-account',{method:'POST',headers:{'Content-Type':'application/json','X-FinanceMed-Account':account.id},body:JSON.stringify(payload)});
   const result=await response.json().catch(()=>null);if(!response.ok)throw Error(typeof result?.detail==='string'?result.detail:'Revise os campos e tente novamente.');
   if(result?.user?.id!==account.id)throw Error('A resposta da conta é inválida. Recarregue a página.');
   onUpdated(result.user);setSuccess(editing==='username'?'Usuário atualizado. Use esse nome para entrar. As outras sessões foram encerradas.':'Senha atualizada. Entre novamente nos outros dispositivos.');setEditing(null);panel.current?.focus();
  }catch(e){setError(e instanceof Error&&e.name!=='TypeError'?e.message:'Não foi possível salvar a alteração. Tente novamente.');}finally{setBusy(false);}
 }
 async function remove(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError('');
  try{
   const response=await apiFetch('/api/auth/delete-account',{method:'POST',headers:{'Content-Type':'application/json','X-FinanceMed-Account':account.id},body:JSON.stringify({password:data.get('password'),confirmation:data.get('confirmation')})});
   if(!response.ok){const result=await response.json();throw Error(result.detail||'Não foi possível excluir a conta.');}
   window.dispatchEvent(new CustomEvent('financemed:account-deleted',{detail:account.id}));
   let cleaned=true;
   try{localStorage.removeItem(`financemed.account.${account.id}.pending`);}catch{cleaned=false;}
   if(Capacitor.isNativePlatform()){
    try{const {Filesystem,Directory}=await import('@capacitor/filesystem');await Filesystem.rmdir({path:`financemed-exports/${account.id}`,directory:Directory.Cache,recursive:true});}catch{/* No exports may exist. Externally shared files remain under the user's control. */}
   }
   onDeleted(cleaned?'Conta e planejamento excluídos. As sessões foram encerradas.':'Conta excluída no servidor. Limpe os dados deste navegador para remover eventuais cópias locais.');
  }catch(e){setError(e instanceof Error&&e.name!=='TypeError'?e.message:'Sem conexão com o servidor. A exclusão não foi confirmada; tente novamente.');setBusy(false);}
 }
 const origin=mobileApiOrigin()||'';
 return <div className="account-overlay"><section ref={panel} tabIndex={-1} className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" onKeyDown={event=>{
  if(event.key==='Escape'){event.stopPropagation();if(!busy)onClose();}
  if(event.key==='Tab'){const fields=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]');if(!fields?.length)return;const first=fields[0],last=fields[fields.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 }}><header><h2 id="account-title">Minha conta</h2><button className="icon-button" aria-label="Fechar conta" disabled={busy} onClick={onClose}><X size={21}/></button></header><p>Usuário: <strong>{account.username}</strong></p><p>Seu planejamento é compartilhado entre celular e web quando você usa a mesma conta e o salvamento no servidor é confirmado.</p><div className="account-edit-actions"><button className="outline-button" disabled={busy} onClick={()=>{setEditing('username');setConfirming(false);setError('');setSuccess('');}}>Alterar usuário</button><button className="outline-button" disabled={busy} onClick={()=>{setEditing('password');setConfirming(false);setError('');setSuccess('');}}>Alterar senha</button></div>
 {success&&<p className="account-notice" role="status">{success}</p>}
 {editing&&<form className="account-edit" onSubmit={update} key={editing}><h3>{editing==='username'?'Alterar nome de usuário':'Alterar senha'}</h3>{editing==='username'?<><label>Novo usuário<input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={3} maxLength={80} required defaultValue={account.username} disabled={busy}/></label><label>Confirme sua senha<input name="current_password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy}/></label></>:<><label>Senha anterior<input name="current_password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy}/></label><label>Nova senha<input name="new_password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy}/></label><label>Confirmar nova senha<input name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy}/></label></>}{error&&<div className="alert error" role="alert">{error}</div>}<p>Seu planejamento permanece na mesma conta. A alteração exige sua senha atual e encerra as outras sessões.</p><div className="account-actions"><button className="outline-button" type="button" disabled={busy} onClick={()=>{setEditing(null);setError('');}}>Cancelar alteração</button><button className="primary-button" disabled={busy} type="submit">{busy?'Salvando…':editing==='username'?'Salvar usuário':'Salvar nova senha'}</button></div></form>}
 <RecoveryEmail accountId={account.id}/><div className="account-links"><a href={`${origin}/privacidade`}>Privacidade</a><a href="mailto:contact@dresslikeme.store">Contato Suporte</a></div>
 {!confirming?<section className="account-delete"><h3>Excluir conta</h3><p>A exclusão é permanente e remove seu planejamento e histórico. Você também pode solicitar pelo site, sem instalar o aplicativo.</p><button className="outline-button account-danger" disabled={busy} onClick={()=>{setConfirming(true);setEditing(null);setError('');setSuccess('');}}><Trash2 size={16}/> Excluir minha conta</button></section>:<form className="account-delete" onSubmit={remove}><h3>Confirmar exclusão permanente</h3><p>A conta, os planejamentos e os cenários serão removidos do serviço. Todas as sessões serão encerradas. Backups locais antigos expiram em até 30 dias; arquivos que você exportou ou compartilhou precisam ser apagados por você.</p><p>Exporte uma cópia antes de continuar, se quiser guardar seus dados.</p><label>Senha atual<input name="password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy}/></label><label>Digite EXCLUIR<input name="confirmation" required pattern="EXCLUIR" autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy}/></label>{error&&<div className="alert error" role="alert">{error}</div>}<div className="account-actions"><button className="outline-button" type="button" disabled={busy} onClick={()=>{setConfirming(false);setError('');}}>Cancelar</button><button className="primary-button account-danger-button" disabled={busy} type="submit">{busy?'Excluindo…':'Excluir permanentemente'}</button></div></form>}
 </section></div>;
}
