'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api-client';
import { MAX_MONTHLY_MINUTES, type OptimizerPreference, type Plan, type Result } from './model';
export function useOptimizer({accountId,month,plan,expenses,preference,active,ready}:{accountId:string;month:string;plan:Plan;expenses:number;preference:OptimizerPreference;active:boolean;ready:boolean}){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const payload=JSON.stringify({works:plan.works,expenses_cents:expenses,target_cents:plan.target,available_minutes:plan.available,preference});
 const signature=JSON.stringify([accountId,month,payload]);
 const latest=useRef(signature);latest.current=signature;
 const sequence=useRef(0),request=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const run=useCallback(async()=>{
  if(timer.current)clearTimeout(timer.current);
  request.current?.abort();const controller=new AbortController();request.current=controller;
  const id=++sequence.current;const requested=signature;setBusy(true);setError('');setResult(null);
  const timeout=setTimeout(()=>controller.abort(),25000);
  const current=()=>sequence.current===id&&latest.current===requested&&!controller.signal.aborted;
  try{
   const response=await apiFetch('/api/optimizer',{method:'POST',headers:{'Content-Type':'application/json','X-FinanceMed-Account':accountId},body:payload,signal:controller.signal});
   const raw=await response.text();let data;
   try{data=JSON.parse(raw);}catch{throw Error('Não foi possível obter o cálculo. Execute npm run dev para iniciar a interface e a API; confira também o terminal da API na porta 8000.');}
   if(!response.ok)throw Error(typeof data?.detail==='string'?data.detail:'Não foi possível calcular. Revise os dados e tente novamente.');
   if(!data||!Array.isArray(data.scenarios)||!['feasible','infeasible','achieved','over_capacity'].includes(data.status))throw Error('A resposta do motor está incompleta. Atualize o projeto e reinicie a API.');
   if(current())setResult(data as Result);
  }catch(e){
   if(sequence.current===id&&latest.current===requested)setError(e instanceof Error&&!['TypeError','AbortError'].includes(e.name)?e.message:'Não foi possível conectar ao motor de cálculo. Tente novamente.');
  }finally{clearTimeout(timeout);if(sequence.current===id){setBusy(false);request.current=null;}}
 },[accountId,payload,signature]);
 const eligible=ready&&plan.works.length>0&&plan.target>0&&plan.available<=MAX_MONTHLY_MINUTES;
 useEffect(()=>{
  if(!active||!eligible){setBusy(false);return;}
  setResult(null);setError('');setBusy(true);
  timer.current=setTimeout(()=>void run(),250);
  return()=>{if(timer.current)clearTimeout(timer.current);sequence.current++;request.current?.abort();request.current=null;};
 },[active,eligible,run]);
 return {result,setResult,busy,error,setError,run};
}
