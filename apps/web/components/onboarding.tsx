'use client';
import { useState, type FormEvent } from 'react';
import { Activity, ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Plus, ReceiptText, Target, Trash2 } from 'lucide-react';
import WorkTaxFields from './work-tax-fields';
import { paymentFields } from '@/lib/finance';
import { cents, currency, emptyPlan, type Plan, type Work, type Expense } from '@/lib/model';

export default function Onboarding({ month, onComplete, onBack }: { month: string; onBack?: () => void; onComplete: (plan: Plan) => void }) {
  const [step, setStep] = useState(0);
  const [works, setWorks] = useState<Work[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showWork, setShowWork] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [error, setError] = useState('');
  const labels = ['Seus trabalhos', 'Suas despesas', 'Sua meta'];
  function addWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get('name')).trim();
    if (!name) { setError('Informe o nome do trabalho.'); return; }
    setWorks([...works, { id: crypto.randomUUID(), name, type: String(f.get('type')), ...paymentFields(f), minutes: Math.round(Number(f.get('hours'))*60), quantity: Number(f.get('quantity')), max_extra: Number(f.get('extra')) }]);
    setShowWork(false); setError('');
  }
  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = String(f.get('name')).trim();
    if (!name) { setError('Informe a descrição da despesa.'); return; }
    setExpenses([...expenses, { id: crypto.randomUUID(), name, category: String(f.get('category')), cents: cents(String(f.get('value'))) }]);
    setShowExpense(false); setError('');
  }
  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    onComplete({ ...emptyPlan(), works, expenses, target: cents(String(f.get('target'))), available: Math.round(Number(f.get('available'))*60), onboardingComplete: true });
  }
  return <main className="setup-shell"><header className="setup-header"><span className="brand"><span className="brand-icon"><Activity size={24}/></span><span>FinanceMed<span className="ai">AI</span></span></span><span>Planejamento de {month.split('-').reverse().join('/')}</span></header>
    <div className="setup-intro"><div className="eyebrow">VAMOS COMEÇAR DO SEU JEITO</div><h1>Conte um pouco sobre sua rotina.</h1><p>Em três passos, seu planejamento ganha os seus números.</p></div>
    <ol className="setup-steps">{labels.map((label, index)=><li key={label} className={index===step?'current':index<step?'completed':''} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={16}/>:index+1}</span>{label}</li>)}</ol>
    <section className="card setup-card"><div className="section-heading"><div><h2>{['Como você ganha sua renda?','Quais são suas despesas?','Aonde você quer chegar?'][step]}</h2><p>{['Adicione pelo menos um trabalho. Você pode cadastrar outros depois.','Informe custos ainda não descontados do ganho por unidade.','Escolha sua renda líquida desejada e o total de horas disponíveis.'][step]}</p></div>{step===0?<BriefcaseBusiness/>:step===1?<ReceiptText/>:<Target/>}</div>
      {error&&<p className="alert error" role="alert">{error}</p>}
      {step===0&&<><div className="setup-items">{works.map(w=><div key={w.id}><span><strong>{w.name}</strong><small>{currency(w.net_cents)} / unidade · {w.quantity} previstas</small></span><button className="icon-button" aria-label={`Remover ${w.name}`} onClick={()=>setWorks(works.filter(x=>x.id!==w.id))}><Trash2 size={16}/></button></div>)}</div>{showWork&&works.length<6?<form onSubmit={addWork}><label>Nome do trabalho<input name="name" required maxLength={100} placeholder="Ex.: Consultório particular"/></label><label>Tipo de trabalho<select aria-label="Tipo de trabalho" name="type" required defaultValue=""><option value="" disabled>Selecione o tipo</option>{['Consulta','Plantão','Sobreaviso','Telemedicina','Procedimento','Outro'].map(t=><option key={t}>{t}</option>)}</select></label><WorkTaxFields/><div className="form-row"><label>Horas por unidade<input name="hours" type="number" min="0.05" max="720" step="0.05" required placeholder="Inclua o tempo de retorno"/></label></div><div className="form-row"><label>Unidades previstas no mês<input name="quantity" type="number" min="0" max="1000" step="1" required placeholder="Pode ser zero"/></label><label>Máximo de unidades extras<input name="extra" type="number" min="0" max="100" step="1" required placeholder="Limite para otimização"/></label></div><p className="form-hint">Para sobreavisos, inclua todas as horas de disponibilidade.</p><div className="setup-actions">{works.length>0&&<button type="button" className="text-link" onClick={()=>{setShowWork(false);setError('');}}>Cancelar novo trabalho</button>}<button className="outline-button" type="submit"><Plus size={16}/> Adicionar ao planejamento</button></div></form>:works.length<6&&<button className="outline-button" onClick={()=>setShowWork(true)}><Plus size={16}/> Adicionar outro trabalho</button>}
      <div className="setup-navigation"><span>Etapa 1 de 3</span><button className="primary-button" disabled={!works.length||showWork} onClick={()=>{setError('');setStep(1);}}>Continuar <ArrowRight size={16}/></button></div></>}
      {step===1&&<><div className="setup-items">{expenses.map(e=><div key={e.id}><span><strong>{e.name}</strong><small>{currency(e.cents)} / mês</small></span><button className="icon-button" aria-label={`Remover ${e.name}`} onClick={()=>setExpenses(expenses.filter(x=>x.id!==e.id))}><Trash2 size={16}/></button></div>)}</div>{showExpense?<form onSubmit={addExpense}><label>Descrição da despesa<input name="name" required maxLength={100} placeholder="Ex.: Aluguel do consultório"/></label><label>Categoria<select aria-label="Categoria" name="category" required defaultValue=""><option value="" disabled>Selecione a categoria</option>{['Estrutura','Equipe','Serviços','Marketing','Transporte','Equipamentos','Outros'].map(t=><option key={t}>{t}</option>)}</select></label><label>Valor mensal (R$)<input name="value" type="number" min="0.01" max="10000000" step="0.01" required placeholder="Informe o valor"/></label><div className="setup-actions">{expenses.length>0&&<button className="text-link" type="button" onClick={()=>setShowExpense(false)}>Cancelar nova despesa</button>}<button className="outline-button" type="submit"><Plus size={16}/> Adicionar despesa</button></div></form>:<button className="outline-button" onClick={()=>setShowExpense(true)}><Plus size={16}/> Adicionar outra despesa</button>}
      <div className="setup-navigation"><button className="text-link" onClick={()=>{setError('');setStep(0);}}><ArrowLeft size={15}/> Voltar</button>{expenses.length>0?<button className="primary-button" disabled={showExpense} onClick={()=>{setError('');setStep(2);}}>Continuar <ArrowRight size={16}/></button>:<button className="primary-button" onClick={()=>{if(!showExpense||confirm('Continuar sem cadastrar despesas? Os campos desta etapa não serão salvos.')){setError('');setStep(2);}}}>Sem despesas por enquanto <ArrowRight size={16}/></button>}</div></>}
      {step===2&&<form onSubmit={finish}><label>Renda líquida desejada (R$)<input name="target" type="number" min="0.01" max="10000000" step="0.01" required placeholder="Quanto você quer ter disponível?"/></label><label>Horas disponíveis no mês<input name="available" type="number" min="0.5" max="720" step="0.5" required placeholder="Total, incluindo os trabalhos previstos"/></label><div className="info-note"><Target size={18}/><span>Sua meta é comparada à receita prevista menos as despesas. As horas incluem plantões, consultas e disponibilidade de sobreavisos.</span></div><div className="setup-navigation"><button type="button" className="text-link" onClick={()=>setStep(1)}><ArrowLeft size={15}/> Voltar</button><button className="primary-button" type="submit">Ver meu planejamento <ArrowRight size={16}/></button></div></form>}
    </section>{onBack&&<button className="outline-button setup-back" onClick={onBack}><ArrowLeft size={15}/> Voltar ao painel</button>}<p className="setup-footnote">Você pode editar todas as informações depois. Dados salvos neste navegador.</p></main>;
}
