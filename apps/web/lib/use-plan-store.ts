'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validStore, type Store } from './model';
function fingerprint(value:unknown):string{
 const ordered=(input:unknown):unknown=>Array.isArray(input)?input.map(ordered):input&&typeof input==='object'?Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)).map(([key,val])=>[key,ordered(val)])):input;
 return JSON.stringify(ordered(value));
}
const empty:Store={version:1,months:{}};
export function usePlanStore(userId:string){
 const [store,setStore]=useState<Store>(empty),[ready,setReady]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Carregando dados…');
 const generation=useRef(0);
 const revision=useRef(0),saved=useRef(''),pending=useRef<Store|null>(null),running=useRef(false),blocked=useRef(false),active=useRef(true);
 const key=`financemed.account.${userId}.pending`;
 const load=useCallback(async(ignorePending=false)=>{
  const requestId=++generation.current;setError('');blocked.current=true;if(ignorePending)pending.current=null;
  try{
   const response=await fetch('/api/plan',{cache:'no-store',headers:{'X-FinanceMed-Account':userId}});const data=await response.json();if(!response.ok)throw Error(data.detail||'Não foi possível carregar seus dados.');if(!validStore(data.store))throw Error('O servidor retornou um planejamento inválido.');
   if(!active.current||requestId!==generation.current)return;
   blocked.current=false;
   revision.current=data.revision;saved.current=fingerprint(data.store);let selected=data.store;
   try{
    if(ignorePending)localStorage.removeItem(key);
    const raw=localStorage.getItem(key);
    if(raw){const backup=JSON.parse(raw);if(validStore(backup.store)){
     if(fingerprint(backup.store)===saved.current)localStorage.removeItem(key);
     else if(backup.revision===data.revision)selected=backup.store;
     else {selected=backup.store;blocked.current=true;setError('Há alterações locais pendentes e uma versão mais nova no servidor. Exporte sua cópia antes de escolher usar os dados do servidor.');}
    }}
   }catch{/* Server persistence continues when browser storage is unavailable. */}
   setStore(selected);setReady(true);setStatus(blocked.current?'Conflito ao salvar':'Salvo no servidor');
  }catch(e){if(active.current&&requestId===generation.current){setError(e instanceof Error?e.message:'Falha ao conectar ao servidor.');setStatus('Falha ao carregar');}}
 },[key,userId]);
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;generation.current++;pending.current=null;};},[load]);
 const flush=useCallback(async()=>{
  if(running.current||blocked.current||!active.current)return;
  running.current=true;
  try{
   while(pending.current&&active.current&&!blocked.current){
    const next=pending.current;pending.current=null;setStatus('Salvando no servidor…');
    try{
     const response=await fetch('/api/plan',{method:'PUT',headers:{'Content-Type':'application/json','X-FinanceMed-Account':userId},body:JSON.stringify({store:next,revision:revision.current})});const data=await response.json();
     if(!response.ok){if(response.status===409)blocked.current=true;throw Error(data.detail||'Não foi possível salvar seus dados.');}
     revision.current=data.revision;saved.current=fingerprint(next);
     if(active.current){
      try{if(!pending.current)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({store:pending.current,revision:revision.current}));}catch{}
      setError('');setStatus(pending.current?'Salvando no servidor…':'Salvo no servidor');
     }
    }catch(e){if(active.current){pending.current=pending.current??next;setError(e instanceof Error&&e.name!=='TypeError'?e.message:'Não foi possível salvar no servidor. Suas alterações continuam nesta sessão; tente novamente ou exporte uma cópia.');setStatus('Falha ao salvar');}break;}
   }
  }finally{running.current=false;}
 },[key,userId]);
 useEffect(()=>{
  if(!ready||blocked.current||fingerprint(store)===saved.current)return;
  pending.current=store;
  try{localStorage.setItem(key,JSON.stringify({store,revision:revision.current}));}catch{}
  setStatus('Salvando no servidor…');const timer=setTimeout(()=>void flush(),250);return()=>clearTimeout(timer);
 },[store,ready,key,flush]);
 return {store,setStore,ready,error,status,retry:()=>pending.current?flush():load(),useServer:()=>load(true)};
}
