import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('same-income button shows three reconciled shorter plans and never changes the saved plan',async({page})=>{
 await page.goto('/');await accountLogin(page);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const works=[{id:'c',name:'Consultório',type:'Consulta',net_cents:40000,minutes:60,quantity:10,max_extra:30,completed:3},{id:'p',name:'Plantão',type:'Plantão',net_cents:100000,minutes:720,quantity:6,max_extra:4},{id:'t',name:'Telemedicina',type:'Telemedicina',net_cents:18000,minutes:30,quantity:20,max_extra:40},{id:'m',name:'Contrato mensal',type:'Serviço mensal',net_cents:200000,minutes:600,quantity:1,max_extra:0,completed:1}];
 const store={version:1,months:{[month]:{works,expenses:[{id:'e',name:'Custos',category:'Outro',cents:12345}],target:2000000,available:15000,saved:[],demo:false,onboardingComplete:true}}};
 expect((await page.request.put('/api/plan',{data:{revision:0,store}})).ok()).toBeTruthy();await page.reload();
 const before=await (await page.request.get('/api/plan')).json();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/optimizer/less-hours')&&r.ok());await page.getByRole('button',{name:'Consigo ganhar o mesmo trabalhando menos horas?',exact:true}).click();const result=await (await response).json();
 await expect(page.getByRole('heading',{name:'Mesma renda. Mais tempo livre.'})).toBeVisible();await expect(page.locator('.less-hours-option')).toHaveCount(3);
 for(const row of result.scenarios){expect(row.revenue_cents).toBeGreaterThanOrEqual(result.baseline_revenue_cents);expect(row.net_cents).toBe(row.revenue_cents-12345);expect(row.minutes).toBeLessThan(result.baseline_minutes);expect(row.saved_minutes+row.minutes).toBe(result.baseline_minutes);expect(row.counts[3]).toBe(1);}
 expect(await (await page.request.get('/api/plan')).json()).toEqual(before);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.getByRole('button',{name:'Aumentar minha renda',exact:true}).click();await expect(page.getByRole('heading',{name:'Um objetivo. Diferentes caminhos.'})).toBeVisible();
});
