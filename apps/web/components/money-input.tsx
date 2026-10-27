'use client';
import {useEffect,useRef,type InputHTMLAttributes} from 'react';
import {parseMoney} from '@/lib/money';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'min'|'max'|'step'>&{max?:number};
export default function MoneyInput({max=10000000,onChange,...props}:Props){
 const ref=useRef<HTMLInputElement>(null);
 function validate(input:HTMLInputElement){const amount=parseMoney(input.value);input.setCustomValidity(input.value===''?'':amount===null||amount<1||amount>max*100?'Informe um valor válido. Ex.: 15.000 ou 15.000,50.':'');}
 useEffect(()=>{if(ref.current)validate(ref.current);});
 return <input {...props} ref={ref} type="text" inputMode="decimal" maxLength={30} onChange={event=>{validate(event.currentTarget);onChange?.(event);}} onBlur={event=>{validate(event.currentTarget);props.onBlur?.(event);}}/>;
}
