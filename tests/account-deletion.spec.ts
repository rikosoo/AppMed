import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('privacy, support and deletion instructions are public',async({page})=>{
 for(const [path,title] of [['/privacidade','Política de privacidade'],['/excluir-conta','Excluir sua conta do FinanceMed AI'],['/suporte','Contato Suporte']]){
  await page.goto(path);await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute('href',/contact@dresslikeme.store/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
});
test('self-service deletion verifies password and closes every session',async({page,request})=>{
 await page.goto('/');await accountLogin(page);
 const me=await (await page.request.get('/api/auth/me')).json();
 expect((await request.post('/api/auth/login',{data:{username:me.user.username,password:'Financial-tests-123!'}})).status()).toBe(200);
 await page.evaluate(id=>localStorage.setItem(`financemed.account.${id}.pending`,JSON.stringify({revision:0,store:{version:1,months:{}}})),me.user.id);
 await page.getByRole('button',{name:'Minha conta',exact:true}).click();
 await page.getByRole('button',{name:'Excluir minha conta',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();expect((await page.request.get('/api/auth/me')).status()).toBe(200);
 await page.getByRole('button',{name:'Excluir minha conta',exact:true}).click();await page.getByLabel('Senha atual').fill('wrong-password');await page.getByLabel('Digite EXCLUIR').fill('EXCLUIR');await page.getByRole('button',{name:'Excluir permanentemente',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Senha incorreta'})).toBeVisible();
 await page.getByLabel('Senha atual').fill('Financial-tests-123!');await page.getByRole('button',{name:'Excluir permanentemente',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Conta e planejamento excluídos'})).toBeVisible();
 expect((await request.get('/api/plan')).status()).toBe(401);
 expect(await page.evaluate(id=>localStorage.getItem(`financemed.account.${id}.pending`),me.user.id)).toBeNull();
 expect((await page.request.post('/api/auth/login',{data:{username:me.user.username,password:'Financial-tests-123!'}})).status()).toBe(401);
});
