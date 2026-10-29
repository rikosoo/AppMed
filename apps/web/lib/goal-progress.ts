import type {Plan} from './model';
export function goalProgress(plan:Plan){
 const revenue=plan.works.reduce((sum,w)=>sum+(w.completed??0)*w.net_cents,0);
 const expenses=plan.expenses.reduce((sum,e)=>sum+e.cents,0);
 const net=revenue-expenses;
 const percent=plan.target>0?Math.max(0,Math.floor(net/plan.target*100)):0;
 return {revenue,expenses,net,percent,achieved:plan.target>0&&net>=plan.target,gap:Math.max(0,plan.target-net)};
}
export function copyForNewMonth(source:Plan):Plan{
 const copy=structuredClone(source);
 return {...copy,works:copy.works.map(w=>({...w,completed:0})),saved:[],demo:false,onboardingComplete:true};
}
