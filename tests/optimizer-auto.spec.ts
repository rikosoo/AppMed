import {test,expect,type Page} from '@playwright/test';
import {examplePlan} from '../apps/web/lib/model';
import {accountLogin} from './helpers/auth';
async function seed(page:Page){
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),{version:1,months:{[month]:{...examplePlan(),demo:false,onboardingComplete:true}}});
 await page.goto('/');await accountLogin(page);
}
test('home optimizer button calculates automatically and priority changes recalculate',async({page})=>{
 await seed(page);const requests:string[]=[];
 page.on('request',request=>{if(request.url().endsWith('/api/optimizer'))requests.push(request.postDataJSON().preference);});
 await page.getByRole('button',{name:'Otimizar minha renda',exact:true}).click();
 await expect(page.locator('.results .scenario')).toHaveCount(3);expect(requests).toEqual(['balanced']);
 await expect(page.getByLabel('Limite adicional Consultório particular')).toHaveValue('40');
 const response=page.waitForResponse(response=>response.url().endsWith('/api/optimizer')&&response.request().postDataJSON().preference==='variety');
 await page.getByRole('button',{name:'Mais variedade',exact:true}).click();
 expect((await (await response).json()).preference).toBe('variety');
 await expect(page.locator('.results .scenario')).toHaveCount(3);expect(requests).toEqual(['balanced','variety']);await page.screenshot({path:`/tmp/financemed-auto-${test.info().project.name}.png`});
 const next=page.waitForResponse(response=>response.url().endsWith('/api/optimizer'));
 await page.getByLabel('Limite adicional Consultório particular').fill('20');await next;
 await expect(page.locator('.results .scenario')).toHaveCount(3);expect(requests).toEqual(['balanced','variety','variety']);
});
test('an obsolete automatic result cannot replace a newer priority result',async({page})=>{
 await seed(page);let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let held=false,finished=false;
 await page.route('**/api/optimizer',async route=>{
  const preference=route.request().postDataJSON().preference;
  if(preference==='balanced'){held=true;await gate;try{await route.fulfill({json:{status:'infeasible',scenarios:[],maximum_extra_cents:11100,engine_version:'test'}});}catch{}finished=true;}
  else await route.fulfill({json:{status:'achieved',scenarios:[],maximum_extra_cents:0,engine_version:'test'}});
 });
 await page.getByRole('button',{name:'Otimizar minha renda',exact:true}).click();await expect.poll(()=>held).toBeTruthy();
 await page.getByRole('button',{name:'Mais variedade',exact:true}).click();await expect(page.getByRole('heading',{name:'Você já chegou lá!'})).toBeVisible();
 release();await expect.poll(()=>finished).toBeTruthy();await expect(page.getByRole('heading',{name:'Você já chegou lá!'})).toBeVisible();await expect(page.getByRole('heading',{name:'A meta precisa de um ajuste'})).toHaveCount(0);
});


test('opening optimization from a scrolled page starts at the top after automatic results',async({page})=>{
 await seed(page);
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
 const nav=page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'});
 await nav.getByRole('button',{name:'Otimizar',exact:true}).click();
 await expect(page.locator('.results .scenario')).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await nav.getByRole('button',{name:'Início',exact:true}).click();
 await page.getByRole('button',{name:'Otimizar minha renda',exact:true}).click();
 await expect(page.locator('.results .scenario')).toHaveCount(3);
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});
