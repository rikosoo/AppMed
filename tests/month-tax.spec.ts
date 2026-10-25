import { accountLogin } from './helpers/auth';
import { test, expect, type Page } from '@playwright/test';
import { examplePlan } from '../apps/web/lib/model';
const month=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name,exact:true});
const login = accountLogin;
async function seed(page:Page){const data={version:1,months:{[month()]:{...examplePlan(),demo:false,onboardingComplete:true}}};await page.addInitScript(data=>{if(!localStorage.getItem('financemed.v1'))localStorage.setItem('financemed.v1',JSON.stringify(data));},data);await page.goto('/');await login(page);}
test('PF and PJ estimates update the projection and optimizer without taxing legacy data twice',async({page})=>{
 await seed(page);await expect(page.locator('.metric.net>strong')).toHaveText(/29\.550,00/);
 await nav(page,'Trabalhos').click();await page.getByRole('button',{name:'Adicionar trabalho',exact:true}).click();
 await page.getByLabel('Nome do trabalho').fill('Plantão novo PJ');await page.getByLabel('Tipo',{exact:false}).first().selectOption('Plantão');
 await page.getByLabel('Forma de recebimento').selectOption('PJ');await page.getByLabel('Valor bruto por unidade').fill('1000');
 await expect(page.locator('.tax-preview')).toContainText('850,00');
 await page.getByLabel('Horas / unidade').fill('1');await page.getByLabel('Unidades previstas no mês').fill('1');await page.getByLabel('Máximo de unidades extras').fill('10');await page.getByRole('button',{name:'Salvar trabalho'}).click();
 await nav(page,'Início').click();await expect(page.locator('.metric.net>strong')).toHaveText(/30\.400,00/);
 await expect(page.locator('.metric.net>small')).toContainText('após impostos');
 await nav(page,'Trabalhos').click();await page.getByRole('button',{name:'Editar Plantão novo PJ'}).click();
 await expect(page.getByLabel('Valor bruto por unidade')).toHaveValue('1000');await page.getByLabel('Forma de recebimento').selectOption('PF');
 await expect(page.locator('.tax-preview')).toContainText('730,00');await page.getByRole('button',{name:'Salvar trabalho'}).click();
 await page.getByRole('button',{name:'Editar Consultório particular'}).click();await expect(page.getByLabel('Forma de recebimento')).toHaveValue('legacy');
 await expect(page.getByLabel('Ganho líquido / unidade')).toHaveValue('280');await page.getByRole('button',{name:'Salvar trabalho'}).click();
 await nav(page,'Início').click();await expect(page.locator('.metric.net>strong')).toHaveText(/30\.280,00/);
 await nav(page,'Otimizar').click();await page.getByRole('button',{name:'Encontrar combinações'}).click();await expect(page.locator('.scenario')).toHaveCount(3);
 await page.reload();await nav(page,'Trabalhos').click();await page.getByRole('button',{name:'Editar Plantão novo PJ'}).click();await expect(page.getByLabel('Forma de recebimento')).toHaveValue('PF');await expect(page.getByLabel('Valor bruto por unidade')).toHaveValue('1000');
});
test('new month offers update, keep or empty and preserves previous financial history',async({page})=>{
 await seed(page);await page.getByRole('button',{name:'Próximo mês'}).click();await expect(page.getByRole('heading',{name:'Novo mês, novo planejamento?'})).toBeVisible();
 await page.getByRole('button',{name:'Revisar e atualizar'}).click();await expect(page.getByLabel('Renda líquida desejada')).toHaveValue('40000');
 await page.getByLabel('Renda líquida desejada').fill('45000');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();
 await page.getByRole('button',{name:'Mês anterior'}).click();await expect(page.getByLabel('Renda líquida desejada')).toHaveValue('40000');
 await page.getByRole('button',{name:'Próximo mês'}).click();await expect(page.getByLabel('Renda líquida desejada')).toHaveValue('45000');
 await page.getByRole('button',{name:'Próximo mês'}).click();await page.getByRole('button',{name:'Manter os mesmos dados'}).click();
 await expect(page.locator('.metric.net>strong')).toHaveText(/29\.550,00/);
 await page.getByRole('button',{name:'Próximo mês'}).click();await page.getByRole('button',{name:'Começar do zero',exact:true}).click();
 await expect(page.getByLabel('Nome do trabalho')).toHaveValue('');await expect(page.getByLabel('Valor bruto por unidade')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('a month rollover while the app is open asks before copying data',async({page})=>{
 await page.clock.install({time:new Date('2026-10-31T23:59:30-03:00')});
 await page.addInitScript(plan=>localStorage.setItem('financemed.v1',JSON.stringify({version:1,months:{'2026-10':{...plan,demo:false,onboardingComplete:true}}})),examplePlan());
 await page.goto('/');await login(page);await expect(page.locator('.metric.net>strong')).toHaveText(/29\.550,00/);
 await page.clock.fastForward(61000);await expect(page.getByRole('heading',{name:'Novo mês, novo planejamento?'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('financemed.v1')!).months['2026-11'])).toBeUndefined();
});

test('month rollover waits for an open work form to close',async({page})=>{
 await page.clock.install({time:new Date('2026-10-31T23:59:30-03:00')});
 await page.addInitScript(plan=>localStorage.setItem('financemed.v1',JSON.stringify({version:1,months:{'2026-10':{...plan,demo:false,onboardingComplete:true}}})),examplePlan());
 await page.goto('/');await login(page);await nav(page,'Trabalhos').click();await page.getByRole('button',{name:'Adicionar trabalho',exact:true}).click();
 await page.getByLabel('Nome do trabalho').fill('Rascunho em edição');await page.clock.fastForward(61000);
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Nome do trabalho')).toHaveValue('Rascunho em edição');
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await expect(page.getByRole('heading',{name:'Novo mês, novo planejamento?'})).toBeVisible();
 expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
