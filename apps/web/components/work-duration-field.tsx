'use client';
import { useId, useRef, useEffect, useState } from 'react';
import { durationLabel, formatWorkDuration, parseWorkDuration, type DurationUnit } from '@/lib/work-duration';
export default function WorkDurationField({minutes,label='Horas por unidade'}:{minutes?:number;label?:string}){
 const [unit,setUnit]=useState<DurationUnit>('hours');
 const [value,setValue]=useState(minutes===undefined?'':formatWorkDuration(minutes));
 const input=useRef<HTMLInputElement>(null),hint=useId(),inputId=useId();
 const parsed=parseWorkDuration(value,unit);
 const invalid=unit==='hours'?'Use horas decimais: 1,5 = 1h30. Informe de 1 min a 360h.':'Informe minutos inteiros, de 1 a 21600 (360h).';
 const message=value.trim()&&parsed===null?invalid:'';
 useEffect(()=>{input.current?.setCustomValidity(message);},[message]);
 function changeUnit(next:DurationUnit){setValue(parsed===null?'':formatWorkDuration(parsed,next));setUnit(next);input.current?.setCustomValidity('');}
 return <div className="work-duration-field"><label htmlFor={inputId}>{unit==='minutes'?label.replace('Horas','Minutos'):label}</label><div className="work-duration-control"><input id={inputId} ref={input} name="hours" type="text" inputMode={unit==='hours'?'decimal':'numeric'} required maxLength={unit==='hours'?10:5} value={value} aria-describedby={hint} placeholder={unit==='hours'?'Ex.: 1,5':'Ex.: 90'} onChange={event=>{const next=event.target.value;event.currentTarget.setCustomValidity(next.trim()&&parseWorkDuration(next,unit)===null?invalid:'');setValue(next);}}/><select name="duration_unit" aria-label="Unidade de tempo" value={unit} onChange={event=>changeUnit(event.target.value as DurationUnit)}><option value="hours">Horas</option><option value="minutes">Minutos</option></select></div><div className="work-duration-hint" id={hint}><small>{unit==='hours'?'0,5 = 30 min · 1,5 = 1h30':'60 min = 1h · 90 min = 1h30'}</small>{parsed!==null&&<strong aria-live="polite">{durationLabel(parsed)}</strong>}</div></div>;
}
