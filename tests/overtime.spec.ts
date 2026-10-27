import { accountLogin } from './helpers/auth';
import { test, expect, type Page } from '@playwright/test';
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name,exact:true});
async function seed(page:Page,available=110*60){
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const data={version:1,months:{[month]:{target:7000000,available,demo:false,onboardingComplete:true,saved:[],expenses:[],works:[{id:'c',name:'Consultório particular',type:'Consulta',net_cents:50000,minutes:60,quantity:100,max_extra:100},{id:'p',name:'Plantão',type:'Plantão',net_cents:120000,minutes:720,quantity:0,max_extra:4}]}}};
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);
 await page.goto('/');await accountLogin(page);
}
test('overtime is a separate red alert with explicit excess and total hours',async({page})=>{
 await seed(page);await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.locator('.results .scenario')).toHaveCount(3);
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});
 await expect(warning).toBeVisible();await expect(warning.locator('.overtime-card')).toHaveCount(3);await expect(warning).toContainText('40 × Consultório particular');await expect(warning).toContainText('30h');await expect(warning.locator('.overtime-card').first()).toContainText('140h');await expect(warning).toContainText('360h');await expect(warning).toContainText('teto: 360h');await expect(warning).toContainText('Alcança a meta');await expect(warning).toContainText('Trabalho adicional necessário');await expect(warning).toContainText('atingir sua meta');
 expect(await page.locator('.overtime-card').first().evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(206, 116, 106)');
 await expect(warning.getByRole('button',{name:'Salvar cenário'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`/tmp/financemed-overtime-${test.info().project.name}.png`,fullPage:true});
});
test('monthly availability rejects 361 hours and legacy over-limit values can be corrected',async({page})=>{
 await seed(page,400*60);await expect(page.locator('.alert.error')).toContainText('360h');
 await page.getByRole('button',{name:'Ajustar disponibilidade'}).click();const field=page.getByLabel('Horas disponíveis no mês');
 await expect(field).toHaveAttribute('max','360');await field.fill('361');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();expect(await field.evaluate(el=>(el as HTMLInputElement).validity.rangeOverflow)).toBeTruthy();
 await field.fill('360');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();await expect(page.locator('.alert.error')).toHaveCount(0);
 await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();await expect(page.locator('.results')).toBeVisible();await expect(page.locator('.overtime-card')).toHaveCount(0);
});

test('expanded capacity respects 360h and remains mobile first at narrow widths',async({page})=>{
 await seed(page);await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});await expect(warning).toBeVisible();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  await expect(warning).toContainText('40 × Consultório particular');await expect(warning).toContainText('360h');await expect(warning).toContainText('Trabalho adicional necessário');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 const unchanged=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('financemed.v1')!);return Object.values(data.months).map((p:any)=>p.works[0].max_extra);});
 expect(unchanged).toEqual([100]);
});

test('unreachable goals are labeled partial and never require more than 360h',async({page})=>{
 await seed(page);await nav(page,test.info().project.name==='mobile'?'Meta':'Minha meta').click();await page.getByLabel('Renda líquida desejada').fill('1000000');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();
 await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});
 await expect(warning.getByRole('heading',{name:'O que é possível até 360h'})).toBeVisible();
 await expect(warning.locator('.overtime-card').first()).toContainText('meta não alcançada');await expect(warning.locator('.overtime-card').first()).toContainText('820.000,00');await expect(warning.locator('.overtime-card').first()).toContainText('Total do mês: 360h');
});

test('three job types produce meaningfully different regular and target-reaching mixes',async({page})=>{
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const work=(id:string,name:string,net_cents:number,minutes:number,quantity:number,max_extra:number)=>({id,name,type:'Outro',net_cents,minutes,quantity,max_extra});
 const data={version:1,months:{[month]:{target:3500000,available:220*60,demo:false,onboardingComplete:true,saved:[],expenses:[],works:[work('base','Trabalho previsto',1000000,8700,1,0),work('c','Consultório',38000,60,0,10),work('p','Plantão',125000,720,0,4),work('t','Telemedicina',9000,15,0,15)]}}};
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);
 await page.goto('/');await accountLogin(page);await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 const regular=page.locator('.results .scenario');await expect(regular).toHaveCount(3);
 await expect(regular.first()).toContainText('10 × Consultório');await expect(regular.first()).toContainText('4 × Plantão');
 const compositions=await regular.locator('.scenario-composition').allTextContents();
 expect(new Set(compositions).size).toBe(3);
 const expanded=page.getByRole('region',{name:'Combinações para atingir a meta'}).locator('.overtime-card');
 await expect(expanded).toHaveCount(3);await expect(expanded.first()).toContainText('66 × Consultório');
 await expect(expanded.nth(1).locator('.scenario-composition li')).toHaveCount(3);
 await expect(expanded.nth(1)).toContainText('Plantão');await expect(expanded.nth(1)).toContainText('Telemedicina');
 for(const index of [1,2]){await expect(expanded.nth(index)).not.toContainText('66 × Consultório');await expect(expanded.nth(index)).toContainText('Alcança a meta');}
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 await page.setViewportSize({width:390,height:844});await page.getByRole('region',{name:'Combinações para atingir a meta'}).screenshot({path:`/tmp/financemed-diverse-mixes-${test.info().project.name}.png`});
});
