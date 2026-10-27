import { accountLogin } from './helpers/auth';
import { test, expect } from '@playwright/test';
import { examplePlan } from '../apps/web/lib/model';
const widths=[320,360,375,390,414,600,767,768,820,1023,1024,1280,1440,1920,2560];
async function noOverflow(page:import('@playwright/test').Page){
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,visible:innerWidth}));
 expect(dimensions.scroll,`horizontal overflow at ${dimensions.visible}px`).toBeLessThanOrEqual(dimensions.visible);
}
const login = accountLogin;
test('login and initial setup fit small phones, tablets and desktop',async({page})=>{
 await page.goto('/');
 for(const width of widths){
  await page.setViewportSize({width,height:844});
  await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();
  await noOverflow(page);
  expect(await page.getByLabel('Usuário',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 }
 await login(page);
 for(const width of widths){
  await page.setViewportSize({width,height:844});
  await expect(page.getByRole('heading',{name:'Como você ganha sua renda?'})).toBeVisible();await noOverflow(page);
  const input=page.getByLabel('Nome do trabalho');expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 }
});
test('all five views and edit dialog remain usable across screen sizes',async({page})=>{
 test.setTimeout(120000);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const data={version:1,months:{[month]:{...examplePlan(),demo:false,onboardingComplete:true}}};
 data.months[month].works[0].name='Consultório particular de cardiologia e acompanhamento clínico';
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);
 await page.goto('/');await login(page);
 for(const width of widths){
  await page.setViewportSize({width,height:844});
  const mobile=width<1024;
  const nav=page.getByRole('navigation',{name:mobile?'Navegação móvel':'Menu principal'});
  await expect(nav).toBeVisible();
  await expect(page.getByRole('navigation',{name:mobile?'Menu principal':'Navegação móvel'})).toBeHidden();
  for(const name of ['Início','Trabalhos','Despesas',mobile?'Meta':'Minha meta','Otimizar']){
   await nav.getByRole('button',{name,exact:true}).click();await noOverflow(page);
  }
  await page.getByRole('button',{name:'Encontrar combinações'}).click();
  await expect(page.locator('.scenario')).toHaveCount(3);await noOverflow(page);
  await page.screenshot({path:`/tmp/financemed-responsive-${width}.png`,fullPage:true});
  await nav.getByRole('button',{name:'Trabalhos',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar trabalho',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
  const amount=page.getByLabel('Valor bruto por unidade');expect(await amount.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 }
});


test('registration and public pages fit small, landscape and wide screens',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 for(const [width,height] of [[320,568],[375,667],[844,390],[1024,600],[2560,1440]]){
  await page.setViewportSize({width,height});await noOverflow(page);
  const submit=page.getByRole('button',{name:'Criar minha conta',exact:true});await submit.scrollIntoViewIfNeeded();await expect(submit).toBeInViewport();
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 }
 for(const path of ['/privacidade','/suporte','/excluir-conta']){
  await page.goto(path);
  for(const [width,height] of [[320,568],[844,390],[768,1024],[2560,1440]]){
   await page.setViewportSize({width,height});await noOverflow(page);await expect(page.getByRole('heading',{level:1})).toBeVisible();
  }
 }
});

test('account forms and work dialog remain reachable with short viewports',async({page})=>{
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),{version:1,months:{[month]:{...examplePlan(),demo:false,onboardingComplete:true}}});
 await page.goto('/');await login(page);
 for(const [width,height] of [[320,568],[390,400],[844,390],[1024,600],[2560,1440]]){
  await page.setViewportSize({width,height});
  await page.getByRole('button',{name:'Minha conta',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  for(const name of ['Alterar usuário','Alterar senha','Excluir minha conta']){
   await dialog.getByRole('button',{name,exact:true}).click();await noOverflow(page);
   const submit=dialog.locator('button[type=submit]');await submit.scrollIntoViewIfNeeded();await expect(submit).toBeInViewport();
   const box=await dialog.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(height);
  }
  await dialog.getByRole('button',{name:'Fechar conta',exact:true}).click();
  const nav=page.getByRole('navigation',{name:width<1024?'Navegação móvel':'Menu principal'});
  await nav.getByRole('button',{name:'Trabalhos',exact:true}).click();await page.getByRole('button',{name:'Adicionar trabalho',exact:true}).click();
  await noOverflow(page);const save=page.getByRole('button',{name:'Salvar trabalho',exact:true});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport();
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
 }
});
