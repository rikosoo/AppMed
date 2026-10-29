import {Check,Minus,Plus} from 'lucide-react';
import {currency,type Work} from '@/lib/model';
export default function WorkCompletion({work,onChange}:{work:Work;onChange:(id:string,delta:number)=>void}){
 const completed=work.completed??0;
 const monthly=work.type==='Serviço mensal';
 return <div className="work-completion" role="group" aria-label={`Serviços realizados: ${work.name}`}>
  <div className="completion-summary"><strong>{monthly?(completed?'Concluído no mês':'Ainda não concluído'):`Realizados: ${completed} de ${work.quantity} previstos`}</strong><small>{currency(completed*work.net_cents)} em serviços concluídos</small></div>
  {monthly?<button className={`completion-monthly ${completed?'is-complete':''}`} aria-pressed={completed===1} onClick={()=>onChange(work.id,completed?-1:1)}><Check size={16}/>{completed?'Desfazer conclusão':'Concluir no mês'}</button>:<div className="completion-buttons"><button aria-label={`Diminuir realizados de ${work.name}`} disabled={completed===0} onClick={()=>onChange(work.id,-1)}><Minus size={18}/></button><button aria-label={`Adicionar realizado de ${work.name}`} disabled={completed>=1000} onClick={()=>onChange(work.id,1)}><Plus size={18}/></button></div>}
 </div>;
}
