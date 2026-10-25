import { test, expect } from '@playwright/test';
import { examplePlan } from '../apps/web/lib/model';
const widths=[320,390,768,1024,1440];
async function noOverflow(page:import('@playwright/test').Page){
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,visible:innerWidth}));
 expect(dimensions.scroll,`horizontal overflow at ${dimensions.visible}px`).toBeLessThanOrEqual(dimensions.visible);
}
async function login(page:import('@playwright/test').Page){
 await page.getByLabel('Usuário',{exact:true}).fill('123456');await page.getByLabel('Senha',{exact:true}).fill('123456');await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
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
 test.setTimeout(60000);
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
  const amount=page.getByLabel('Ganho líquido / unidade');expect(await amount.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
 }
});
