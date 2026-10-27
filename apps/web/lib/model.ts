import { afterTax, type TaxRegime } from './finance';
export type OptimizerPreference = 'balanced'|'time'|'variety';
export type Work = { gross_cents?: number; tax_regime?: TaxRegime; id: string; name: string; type: string; net_cents: number; minutes: number; quantity: number; max_extra: number };
export type Expense = { id: string; name: string; category: string; cents: number };
export type ScenarioItem = { work_id: string; name: string; quantity: number; extra_cents: number; minutes: number };
export const MAX_MONTHLY_HOURS = 360;
export const MAX_MONTHLY_MINUTES = MAX_MONTHLY_HOURS * 60;
export type Scenario = { unused_capacity_minutes?: number; unit_limit_excess?: { work_id: string; name: string; configured_max: number; simulated_quantity: number; excess_quantity: number }[]; algorithm?: string; objective?: string; exceeds_availability?: boolean; excess_minutes?: number; hard_limit_minutes?: number; items?: ScenarioItem[]; reaches_target?: boolean; shortfall_cents?: number; total_minutes?: number; counts: number[]; extra_cents: number; minutes: number; projected_cents: number; label: string };
export type Result = { overtime_scenarios?: Scenario[]; overtime_scenario?: Scenario | null; overtime_note?: string | null; engine_version: string; status: string; scenarios: Scenario[]; maximum_extra_cents: number; remaining_minutes: number; gap_cents: number; best_partial?: Scenario };
export type Saved = { id: string; date: string; scenario: Scenario; works: Work[]; target: number; expenses: number; available: number; engine: string };
export type Plan = { works: Work[]; expenses: Expense[]; target: number; available: number; saved: Saved[]; demo: boolean; onboardingComplete?: boolean };
export type Store = { version: 1; months: Record<string, Plan> };
export const currency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v / 100);
export const hours = (v: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v / 60)}h`;
export const cents = (value: string) => { const [whole, fraction = ''] = value.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0,2)); };
export const emptyPlan = (): Plan => ({ works: [], expenses: [], target: 0, available: 0, saved: [], demo: false });
export const examplePlan = (): Plan => ({ target: 4000000, available: 14400, demo: true, saved: [], works: [
 { id:'consultas', name:'Consultório particular', type:'Consulta', net_cents:28000, minutes:60, quantity:80, max_extra:40 },
 { id:'plantoes', name:'Plantões · Hospital', type:'Plantão', net_cents:180000, minutes:720, quantity:6, max_extra:4 },
 { id:'sobreavisos', name:'Sobreavisos', type:'Sobreaviso', net_cents:80000, minutes:720, quantity:2, max_extra:4 }
], expenses: [{id:'aluguel',name:'Aluguel do consultório',category:'Estrutura',cents:280000},{id:'secretaria',name:'Secretaria',category:'Equipe',cents:180000},{id:'software',name:'Software e contabilidade',category:'Serviços',cents:65000}] });
export function validStore(value: unknown): value is Store {
 if (!value || typeof value !== 'object') return false;
 const s = value as Store;
 const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
 return s.version === 1 && !!s.months && typeof s.months === 'object' && Object.entries(s.months).every(([key,p]) => /^\d{4}-\d{2}$/.test(key) && p && Array.isArray(p.works) && p.works.length <= 6 && p.works.every(w => typeof w.name === 'string' && typeof w.id === 'string' && typeof w.type === 'string' && integer(w.net_cents) && w.net_cents > 0 && ((w.gross_cents === undefined && w.tax_regime === undefined) || (integer(w.gross_cents!) && w.gross_cents! > 0 && (w.tax_regime === 'PF' || w.tax_regime === 'PJ') && w.net_cents === afterTax(w.gross_cents!, w.tax_regime).net_cents)) && integer(w.minutes) && w.minutes > 0 && integer(w.quantity) && integer(w.max_extra)) && Array.isArray(p.expenses) && p.expenses.every(e => typeof e.name === 'string' && typeof e.id === 'string' && typeof e.category === 'string' && integer(e.cents)) && integer(p.target) && integer(p.available) && Array.isArray(p.saved) && p.saved.every(r => r && typeof r.id === 'string' && typeof r.date === 'string' && Array.isArray(r.works) && r.scenario && Array.isArray(r.scenario.counts) && r.scenario.counts.every(integer) && integer(r.scenario.extra_cents) && integer(r.scenario.minutes) && Number.isSafeInteger(r.scenario.projected_cents)) && typeof p.demo === 'boolean' && (p.onboardingComplete === undefined || typeof p.onboardingComplete === 'boolean'));
}

export const duration = (minutes: number) => { const h=Math.floor(minutes/60), m=minutes%60;return h?`${h}h${m?` ${m}min`:''}`:`${m}min`; };
