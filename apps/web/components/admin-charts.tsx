'use client';
import { useEffect, useRef, useState } from 'react';
export type DailyMetric={date:string;new_users:number;active_users:number|null};
const number=(value:number)=>new Intl.NumberFormat('pt-BR').format(value);
const date=(value:string)=>value.slice(8,10)+'/'+value.slice(5,7);
function Timeline({title,rows,field,kind}:{title:string;rows:DailyMetric[];field:'new_users'|'active_users';kind:'bar'|'line'}){
 const [width,setWidth]=useState(340),[selected,setSelected]=useState(rows.length-1);
 const canvas=useRef<HTMLDivElement>(null);
 useEffect(()=>{const element=canvas.current;if(!element)return;const measure=()=>setWidth(Math.max(220,Math.round(element.clientWidth)));measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
 const values=rows.map(row=>row[field]);
 const peak=Math.max(0,...values.filter((value):value is number=>value!==null));
 const step=Math.max(1,Math.ceil(peak/4)),ceiling=step*4;
 const left=36,right=12,top=14,bottom=170,area=width-left-right;
 const x=(index:number)=>left+index*area/Math.max(1,rows.length-1);
 const y=(value:number)=>bottom-value/ceiling*(bottom-top);
 const current=Math.min(selected,rows.length-1),point=rows[current];
 const total=values.reduce<number>((sum,value)=>sum+(value||0),0);
 const anyKnown=values.some(value=>value!==null);
 let path='';let segment=false;
 values.forEach((value,index)=>{if(value===null){segment=false;return;}path+=`${segment?'L':'M'}${x(index)},${y(value)} `;segment=true;});
 return <article className="admin-panel admin-chart"><header><div><h3>{title}</h3><p>{field==='new_users'?'Cadastros no período':'Pico de usuários ativos por dia'}</p></div><strong>{anyKnown?number(field==='new_users'?total:peak):'—'}</strong></header>
 <div ref={canvas} className="admin-chart-canvas"><svg viewBox={`0 0 ${width} 202`} role="img" aria-label={`${title}, ${rows.length} dias. ${anyKnown?`Máximo diário: ${peak}.`:'Sem histórico de atividade.'} Consulte os dados na tabela abaixo.`} onPointerMove={event=>{const bounds=event.currentTarget.getBoundingClientRect();const pointer=(event.clientX-bounds.left)*width/bounds.width;setSelected(Math.min(rows.length-1,Math.max(0,Math.round((pointer-left)/area*(rows.length-1)))));}}>
 {[0,1,2,3,4].map(index=><g key={index}><line x1={left} x2={width-right} y1={y(index*step)} y2={y(index*step)} className="chart-grid"/><text x={left-8} y={y(index*step)+4} textAnchor="end" className="chart-axis">{number(index*step)}</text></g>)}
 {kind==='bar'?values.map((value,index)=>value===null?null:<rect key={rows[index].date} x={x(index)-Math.min(14,area/rows.length*.6)/2} y={y(value)} width={Math.min(14,area/rows.length*.6)} height={bottom-y(value)} rx="2" className={index===current?'chart-bar selected':'chart-bar'}/>):<><path d={path} className="chart-line"/>{values.map((value,index)=>value===null?null:<circle key={rows[index].date} cx={x(index)} cy={y(value)} r={index===current?4:2} className="chart-dot"/>)}</>}
 <line x1={x(current)} x2={x(current)} y1={top} y2={bottom} className="chart-cursor"/>
 {[0,Math.floor((rows.length-1)/2),rows.length-1].map((index,position)=><text key={index} x={x(index)} y={194} textAnchor={position===0?'start':position===2?'end':'middle'} className="chart-axis">{date(rows[index].date)}</text>)}
 </svg></div>
 <div className="chart-reading" aria-live="polite"><span>{date(point.date)}</span><strong>{point[field]===null?'Sem histórico':`${number(point[field])} usuário(s)`}</strong></div>
 <input type="range" min={0} max={rows.length-1} value={current} onChange={event=>setSelected(Number(event.target.value))} aria-label={`Selecionar dia: ${title}`} aria-valuetext={`${point.date}: ${point[field]===null?'sem histórico':`${point[field]} usuários`}`} className="chart-range"/>
 {!anyKnown&&<p className="chart-empty">O histórico aparece quando houver uso registrado.</p>}{anyKnown&&peak===0&&<p className="chart-empty">Nenhum {field==='new_users'?'cadastro':'usuário ativo'} neste período.</p>}
 <details className="chart-data"><summary>Ver dados em tabela</summary><div><table aria-label={`Dados: ${title}`}><thead><tr><th scope="col">Data (UTC)</th><th scope="col">Usuários</th></tr></thead><tbody>{rows.map(row=><tr key={row.date}><th scope="row">{row.date}</th><td>{row[field]===null?'Sem histórico':number(row[field])}</td></tr>)}</tbody></table></div></details>
 </article>;
}
export default function AdminCharts({history,events7,events30}:{history?:DailyMetric[];events7:Record<string,number>;events30:Record<string,number>}){
 const [days,setDays]=useState<7|30>(30);
 if(!history?.length)return <section className="admin-panel"><h2>Gráficos</h2><p>Histórico indisponível. Atualize a API do servidor para carregar os gráficos.</p></section>;
 const rows=history.slice(-days),events=days===7?events7:events30;
 const features=[{label:'Planejamentos salvos',value:events.plan_saved||0},{label:'Simulações',value:events.optimizer_used||0},{label:'Primeiras configurações',value:events.onboarding_completed||0}];
 const max=Math.max(1,...features.map(item=>item.value));
 return <section className="admin-charts" aria-label="Gráficos administrativos"><div className="admin-charts-heading"><div><h2>Crescimento e atividade</h2><p>Últimos {days} dias de calendário UTC, incluindo hoje.</p></div><div className="chart-period" role="group" aria-label="Período dos gráficos">{([7,30] as const).map(value=><button key={value} onClick={()=>setDays(value)} aria-pressed={days===value}>{value} dias</button>)}</div></div><div className="admin-timelines"><Timeline key={`new-${days}`} title="Novos usuários por dia" rows={rows} field="new_users" kind="bar"/><Timeline key={`active-${days}`} title="Usuários ativos por dia" rows={rows} field="active_users" kind="line"/></div><section className="admin-panel admin-feature-chart"><h3>Uso das funcionalidades no período</h3><ul>{features.map(item=><li key={item.label}><div><span>{item.label}</span><strong>{number(item.value)}</strong></div><div className="feature-track" aria-hidden="true"><div style={{width:`${item.value/max*100}%`}}/></div></li>)}</ul>{features.every(item=>item.value===0)&&<p className="chart-empty">Nenhum evento registrado no período.</p>}<p className="admin-explanation">São execuções, não usuários únicos. Salvamentos automáticos também contam.</p></section><p className="admin-explanation">Ativos por dia são usuários distintos que salvaram um planejamento ou concluíram uma simulação. Antes do primeiro registro de uso, mostramos “Sem histórico”. Os cartões acima usam janelas móveis; os gráficos usam dias de calendário UTC e consideram contas ainda existentes.</p></section>;
}
