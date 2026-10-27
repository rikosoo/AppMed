import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('Brazilian thousands and cents persist correctly in work, expenses and goal',async({page})=>{
 await page.goto('/');await accountLogin(page);
 await page.getByLabel('Nome do trabalho').fill('Plantão');await page.getByLabel('Tipo de trabalho').selectOption('Plantão');await page.getByLabel('Forma de recebimento').selectOption('PJ');
 await page.getByLabel('Valor bruto por unidade').fill('15.000');await expect(page.locator('.tax-preview')).toContainText('12.750,00');
 await page.getByLabel('Horas por unidade',{exact:true}).fill('12');await page.getByLabel('Unidades previstas no mês').fill('1');await page.getByLabel('Máximo de unidades extras').fill('2');
 await page.getByRole('button',{name:'Adicionar ao planejamento'}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByLabel('Descrição da despesa').fill('Aluguel');await page.getByLabel('Categoria',{exact:true}).selectOption('Estrutura');await page.getByLabel('Valor mensal (R$)').fill('1.000,50');await page.getByRole('button',{name:'Adicionar despesa',exact:true}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('Renda líquida desejada (R$)').fill('15.000');await page.getByLabel('Horas disponíveis no mês').fill('160');await page.getByRole('button',{name:'Ver meu planejamento'}).click();await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 const plan=await (await page.request.get('/api/plan')).json();const month=Object.values(plan.store.months)[0] as any;
 expect(month.target).toBe(1500000);expect(month.works[0].gross_cents).toBe(1500000);expect(month.expenses[0].cents).toBe(100050);
 const nav=page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'});
 await nav.getByRole('button',{name:test.info().project.name==='mobile'?'Meta':'Minha meta',exact:true}).click();await page.getByLabel('Renda líquida desejada (R$)').fill('15.000,50');const saved=page.waitForResponse(response=>response.url().endsWith('/api/plan')&&response.request().method()==='PUT'&&response.ok());await page.getByRole('button',{name:'Salvar meta',exact:true}).click();await saved;await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 expect((Object.values((await (await page.request.get('/api/plan')).json()).store.months)[0] as any).target).toBe(1500050);
 await page.getByLabel('Renda líquida desejada (R$)').fill('15.1234');await page.getByRole('button',{name:'Salvar meta',exact:true}).click();expect(await page.getByLabel('Renda líquida desejada (R$)').evaluate((el:HTMLInputElement)=>el.checkValidity())).toBe(false);
});
