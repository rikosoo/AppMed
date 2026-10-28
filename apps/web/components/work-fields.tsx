'use client';
import {useState} from 'react';
import type {Work} from '@/lib/model';
import WorkTaxFields from './work-tax-fields';
import WorkDurationField from './work-duration-field';
export default function WorkFields({work,onboarding=false}:{work?:Work|null;onboarding?:boolean}){
 const [type,setType]=useState(work?.type||'');
 const [canIncrease,setCanIncrease]=useState(work?work.max_extra>0:true);
 const [extra,setExtra]=useState(String(work?.max_extra||''));
 const monthly=type==='Serviço mensal';
 return <><label>{onboarding?'Tipo de trabalho':'Tipo'}<select aria-label={onboarding?'Tipo de trabalho':'Tipo'} name="type" required value={type} onChange={event=>setType(event.target.value)}><option value="" disabled>Selecione o tipo</option>{['Consulta','Plantão','Sobreaviso','Telemedicina','Procedimento','Serviço mensal','Outro'].map(t=><option key={t}>{t}</option>)}</select></label>
 <WorkTaxFields work={work} monthly={monthly}/>
 <div className="form-row"><WorkDurationField key={String(monthly)} minutes={work&&monthly===(work.type==='Serviço mensal')?work.minutes:undefined} label={monthly?'Horas de trabalho no mês':onboarding?'Horas por unidade':'Horas / unidade'}/></div>
 {monthly?<><input type="hidden" name="quantity" value="1"/><input type="hidden" name="extra" value="0"/><p className="info-note">Renda mensal fixa: entra uma vez no mês e não gera unidades extras no otimizador.</p></>:<><div className="form-row"><label>Unidades previstas no mês<input name="quantity" type="number" min="0" max="1000" step="1" required defaultValue={work?.type==='Serviço mensal'?undefined:work?.quantity} placeholder={onboarding?'Pode ser zero':undefined}/></label></div><label className="work-increase"><input type="checkbox" checked={canIncrease} onChange={event=>setCanIncrease(event.target.checked)}/>Posso fazer unidades extras deste trabalho</label>{canIncrease?<label>Máximo de unidades extras<input name="extra" type="number" min="0" max="100" step="1" required value={extra} onChange={event=>setExtra(event.target.value)} placeholder="Limite para otimização"/><small>Zero impede aumentar este trabalho.</small></label>:<><input type="hidden" name="extra" value="0"/><p className="form-hint">Mantém a renda prevista, sem sugerir trabalho extra.</p></>}</>}
 </>;
}
