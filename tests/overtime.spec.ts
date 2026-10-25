import { test, expect, type Page } from '@playwright/test';
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name,exact:true});
async function seed(page:Page,available=110*60){
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const data={version:1,months:{[month]:{target:7000000,available,demo:false,onboardingComplete:true,saved:[],expenses:[],works:[{id:'c',name:'Consultório particular',type:'Consulta',net_cents:50000,minutes:60,quantity:100,max_extra:100},{id:'p',name:'Plantão',type:'Plantão',net_cents:120000,minutes:720,quantity:0,max_extra:4}]}}};
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);
 await page.goto('/');await page.getByLabel('Usuário',{exact:true}).fill('123456');await page.getByLabel('Senha',{exact:true}).fill('123456');await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
test('overtime is a separate red alert with explicit excess and total hours',async({page})=>{
 await seed(page);await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.locator('.results .scenario')).toHaveCount(3);
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});
 await expect(warning).toBeVisible();await expect(warning.locator('.overtime-card')).toHaveCount(3);await expect(warning).toContainText('40 × Consultório particular');await expect(warning).toContainText('30h');await expect(warning.locator('.overtime-card').first()).toContainText('140h');await expect(warning).toContainText('280h');await expect(warning).toContainText('teto: 280h');await expect(warning).toContainText('Alcança a meta');await expect(warning).toContainText('Trabalho adicional necessário');await expect(warning).toContainText('atingir sua meta');
 expect(await page.locator('.overtime-card').first().evaluate(el=>getComputedStyle(el).borderTopColor)).toBe('rgb(206, 116, 106)');
 await expect(warning.getByRole('button',{name:'Salvar cenário'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`/tmp/financemed-overtime-${test.info().project.name}.png`,fullPage:true});
});
test('monthly availability rejects 281 hours and legacy over-limit values can be corrected',async({page})=>{
 await seed(page,300*60);await expect(page.locator('.alert.error')).toContainText('280h');
 await page.getByRole('button',{name:'Ajustar disponibilidade'}).click();const field=page.getByLabel('Horas disponíveis no mês');
 await expect(field).toHaveAttribute('max','280');await field.fill('281');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();expect(await field.evaluate(el=>(el as HTMLInputElement).validity.rangeOverflow)).toBeTruthy();
 await field.fill('280');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();await expect(page.locator('.alert.error')).toHaveCount(0);
 await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();await expect(page.locator('.results')).toBeVisible();await expect(page.locator('.overtime-card')).toHaveCount(0);
});

test('expanded capacity respects 280h and remains mobile first at narrow widths',async({page})=>{
 await seed(page);await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});await expect(warning).toBeVisible();
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:844});
  await expect(warning).toContainText('40 × Consultório particular');await expect(warning).toContainText('280h');await expect(warning).toContainText('Trabalho adicional necessário');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
 const unchanged=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('financemed.v1')!);return Object.values(data.months).map((p:any)=>p.works[0].max_extra);});
 expect(unchanged).toEqual([100]);
});

test('unreachable goals are labeled partial and never require more than 280h',async({page})=>{
 await seed(page);await nav(page,test.info().project.name==='mobile'?'Meta':'Minha meta').click();await page.getByLabel('Renda líquida desejada').fill('1000000');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();
 await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();
 const warning=page.getByRole('region',{name:'Combinações para atingir a meta'});
 await expect(warning.getByRole('heading',{name:'O que é possível até 280h'})).toBeVisible();
 await expect(warning.locator('.overtime-card').first()).toContainText('meta não alcançada');await expect(warning.locator('.overtime-card').first()).toContainText('860.000,00');await expect(warning.locator('.overtime-card').first()).toContainText('Total do mês: 280h');
});
