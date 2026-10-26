'use client';
import { useId, useRef, useEffect, useState } from 'react';
import { durationLabel, formatWorkDuration, parseWorkDuration } from '@/lib/work-duration';
export default function WorkDurationField({minutes,label='Horas por unidade'}:{minutes?:number;label?:string}){
 const [value,setValue]=useState(minutes===undefined?'':formatWorkDuration(minutes));
 const input=useRef<HTMLInputElement>(null),hint=useId();
 const parsed=parseWorkDuration(value);
 const message=value.trim()&&parsed===null?'Use horas.minutos: 0,30 = 30 min. Minutos de 00 a 59; máximo 280h.':'';
 useEffect(()=>{input.current?.setCustomValidity(message);},[message]);
 return <div className="work-duration-field"><label>{label}<input ref={input} name="hours" type="text" inputMode="decimal" required maxLength={7} value={value} aria-describedby={hint} placeholder="Ex.: 0,30" onChange={event=>{const next=event.target.value;event.currentTarget.setCustomValidity(next.trim()&&parseWorkDuration(next)===null?'Use horas.minutos: 0,30 = 30 min. Minutos de 00 a 59; máximo 280h.':'');setValue(next);}}/></label><div className="work-duration-hint" id={hint}><small>0,30 = 30 min · 1,30 = 1h30</small>{parsed!==null&&<strong aria-live="polite">{durationLabel(parsed)}</strong>}</div></div>;
}
