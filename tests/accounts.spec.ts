import { test, expect, type Page } from '@playwright/test';
import { accountLogin } from './helpers/auth';
import { examplePlan } from '../apps/web/lib/model';
const month=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name,exact:true});
async function filledAccount(page:Page){
 const data={version:1,months:{[month()]:{...examplePlan(),demo:false,onboardingComplete:true}}};await page.addInitScript(data=>{if(!localStorage.getItem('financemed.v1'))localStorage.setItem('financemed.v1',JSON.stringify(data));},data);await page.goto('/');await accountLogin(page);
}
test('registration validates confirmation and creates a server session without browser token storage',async({page})=>{
 const username=`doctor-${crypto.randomUUID()}`;const password='Real-account-tests-123!';
 await page.goto('/');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByLabel('Usuário',{exact:true}).fill(username);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByLabel('Confirmar senha').fill('different-password');await page.getByRole('button',{name:'Criar minha conta'}).click();await expect(page.getByRole('alert').filter({hasText:'As senhas não coincidem'})).toBeVisible();
 await page.getByLabel('Confirmar senha').fill(password);await page.getByRole('button',{name:'Criar minha conta'}).click();await expect(page.getByRole('heading',{name:'Como você ganha sua renda?'})).toBeVisible();
 expect((await (await page.request.get('/api/auth/me')).json()).user.username).toBe(username);
 expect((await page.context().cookies()).find(c=>c.name==='financemed_session')?.httpOnly).toBe(true);
 expect(await page.evaluate(()=>document.cookie.includes('financemed_session'))).toBe(false);
 expect(await page.evaluate(()=>localStorage.getItem('financemed.demo-session'))).toBeNull();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
test('database plan survives a different browser and is not visible to another account',async({page,browser})=>{
 await filledAccount(page);const me=(await (await page.request.get('/api/auth/me')).json()).user;
 // Set a known password by creating a separate test account through the real API.
 const username=`shared-${crypto.randomUUID()}`,password='Cross-browser-tests-123!';
 await page.request.post('/api/auth/register',{data:{username,password}});
 const source=(await (await page.request.get('/api/plan')).json());expect(source.store.months).toEqual({});
 const own={version:1,months:{[month()]:{...examplePlan(),demo:false,onboardingComplete:true,target:1234500}}};
 expect((await page.request.put('/api/plan',{data:{store:own,revision:0}})).status()).toBe(200);
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3000'});const other=await context.newPage();
 await other.goto('/');await other.getByLabel('Usuário',{exact:true}).fill(username);await other.getByLabel('Senha',{exact:true}).fill(password);await other.getByRole('button',{name:'Entrar',exact:true}).click();await expect(other.getByRole('heading',{name:'Seu dinheiro, com propósito.'})).toBeVisible();
 expect((await (await other.request.get('/api/plan')).json()).store.months[month()].target).toBe(1234500);
 await other.getByRole('button',{name:'Sair',exact:true}).click();await expect(other.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();await accountLogin(other);await expect(other.getByRole('heading',{name:'Como você ganha sua renda?'})).toBeVisible();
 expect((await (await other.request.get('/api/plan')).json()).store.months).toEqual({});
 expect((await (await page.request.get('/api/auth/me')).json()).user.id).not.toBe(me.id);
 expect((await (await page.request.get('/api/plan')).json()).store.months[month()].target).toBe(1234500);
 await context.close();
});
test('failed saves retain a per-account copy and retry saves to the database',async({page})=>{
 await filledAccount(page);await nav(page,test.info().project.name==='mobile'?'Meta':'Minha meta').click();
 await page.route('**/api/plan',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Falha simulada de conexão.'})}):route.continue());
 await page.getByLabel('Renda líquida desejada').fill('45000');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Falha simulada'})).toBeVisible();
 const user=(await (await page.request.get('/api/auth/me')).json()).user;
 const backup=await page.evaluate(id=>JSON.parse(localStorage.getItem(`financemed.account.${id}.pending`)! ),user.id);expect(backup.store.months[month()].target).toBe(4500000);
 expect((await (await page.request.get('/api/plan')).json()).store.months[month()].target).toBe(4000000);
 await page.unroute('**/api/plan');await page.getByRole('button',{name:'Tentar salvar novamente'}).click();await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 expect((await (await page.request.get('/api/plan')).json()).store.months[month()].target).toBe(4500000);
});
test('a concurrent edit is not silently overwritten',async({page})=>{
 await filledAccount(page);const current=await (await page.request.get('/api/plan')).json();current.store.months[month()].target=6000000;
 expect((await page.request.put('/api/plan',{data:current})).status()).toBe(200);
 await nav(page,test.info().project.name==='mobile'?'Meta':'Minha meta').click();await page.getByLabel('Renda líquida desejada').fill('45000');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'outra aba ou dispositivo'})).toBeVisible();expect((await (await page.request.get('/api/plan')).json()).store.months[month()].target).toBe(6000000);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Usar dados do servidor'}).click();await expect(page.getByLabel('Renda líquida desejada')).toHaveValue('60000');
});
