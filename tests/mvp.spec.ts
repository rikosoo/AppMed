import { accountLogin } from './helpers/auth';
import { test, expect, type Page } from '@playwright/test';
import { examplePlan } from '../apps/web/lib/model';
const month = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const nav = (page: Page, name:string) => page.getByRole('navigation', {name: test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name,exact:true});
const login = accountLogin;
async function seed(page:Page) {
 const data = {version:1,months:{[month()]:{...examplePlan(),demo:false,onboardingComplete:true}}};
 await page.addInitScript(data=>{if(!localStorage.getItem('financemed.v1'))localStorage.setItem('financemed.v1',JSON.stringify(data));},data);
 await page.goto('/'); await login(page);
}
test('login rejects wrong credentials and onboarding starts blank', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.getByLabel('Usuário',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Senha',{exact:true})).toHaveValue('');
 await expect(page.getByRole('navigation')).toHaveCount(0);
 await page.getByLabel('Usuário',{exact:true}).fill('123456');
 await page.getByLabel('Senha',{exact:true}).fill('errada');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Usuário ou senha incorretos'})).toBeVisible();
 await login(page);
 await expect(page.getByRole('heading',{name:'Como você ganha sua renda?'})).toBeVisible();
 for(const input of await page.locator('.setup-card input').all())await expect(input).toHaveValue('');
 for(const field of await page.locator('select:not([name="duration_unit"])').all())await expect(field).toHaveValue('');
 await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:`/tmp/financemed-setup-${test.info().project.name}.png`,fullPage:true});
 expect(errors).toEqual([]);
});
test('complete initial setup, save own data, logout and return',async({page})=>{
 await page.goto('/');await login(page);
 await page.getByLabel('Nome do trabalho').fill('Consulta teste');
 await page.getByLabel('Tipo de trabalho').selectOption('Consulta');
 await page.getByLabel('Forma de recebimento').selectOption('PF');
 await page.getByLabel('Valor bruto por unidade').fill('280.01');
 await page.getByLabel('Horas por unidade',{exact:true}).fill('1');
 await page.getByLabel('Unidades previstas no mês').fill('10');
 await page.getByLabel('Máximo de unidades extras').fill('5');
 await page.getByRole('button',{name:'Adicionar ao planejamento'}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByLabel('Descrição da despesa')).toHaveValue('');
 await page.getByLabel('Descrição da despesa').fill('Aluguel teste');
 await page.getByLabel('Categoria',{exact:true}).selectOption('Estrutura');
 await page.getByLabel('Valor mensal').fill('500.10');
 await page.getByRole('button',{name:'Adicionar despesa',exact:true}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await expect(page.getByLabel('Renda líquida desejada')).toHaveValue('');
 await expect(page.getByLabel('Horas disponíveis no mês')).toHaveValue('');
 await page.getByLabel('Renda líquida desejada').fill('5000');
 await page.getByLabel('Horas disponíveis no mês').fill('40');
 await page.getByRole('button',{name:'Ver meu planejamento'}).click();
 await expect(page.locator('.metric.net>strong')).toHaveText(/1\.544,00/);
 await expect(page.getByText('Consultório particular',{exact:true})).toHaveCount(0);
 await nav(page,'Trabalhos').click();
 await page.getByRole('button',{name:'Editar Consulta teste'}).click();
 await page.getByLabel('Unidades previstas no mês').fill('12');
 await page.getByRole('button',{name:'Salvar trabalho'}).click();
 await nav(page,'Início').click();await expect(page.locator('.metric.net>strong')).toHaveText(/1\.952,82/);
 await page.getByRole('button',{name:'Próximo mês'}).click();
 await expect(page.getByRole('heading',{name:'Novo mês, novo planejamento?'})).toBeVisible();
 await page.getByRole('button',{name:'Voltar ao mês anterior'}).click();
 await expect(page.locator('.metric.net>strong')).toHaveText(/1\.952,82/);
 await page.getByRole('button',{name:'Sair',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();
 await expect(page.locator('.metric')).toHaveCount(0);
 await page.reload();await login(page);
 await expect(page.locator('.metric.net>strong')).toHaveText(/1\.952,82/);
 await page.reload();await expect(page.locator('.metric.net>strong')).toHaveText(/1\.952,82/);
 await nav(page,'Trabalhos').click();page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Excluir Consulta teste'}).click();
 await expect(page.getByRole('heading',{name:'Sua renda começa aqui'})).toBeVisible();
});
test('optimizer, snapshot and reload', async ({page}) => {
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await seed(page);
 await expect(page.getByRole('heading',{name:'Seu dinheiro, com propósito.'})).toBeVisible();
 await nav(page,'Otimizar').click();
 await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.getByRole('heading',{name:'Caminhos para a sua meta'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Salvar cenário'})).toHaveCount(3);
 await page.getByRole('button',{name:'Salvar cenário'}).first().click();
 await page.reload();await nav(page,'Otimizar').click();
 await expect(page.getByText('Cenários salvos')).toBeVisible();
 await page.locator('.saved-toggle').click();
 await expect(page.getByText(/Retrato do planejamento ao salvar/)).toBeVisible();
 expect(errors).toEqual([]);
});
test('legacy demo is backed up and replaced by blank setup',async({page})=>{
 const original=JSON.stringify({version:1,months:{[month()]:examplePlan()}});
 await page.goto('/');await page.evaluate(raw=>localStorage.setItem('financemed.v1',raw),original);
 await login(page);
 await expect(page.getByRole('heading',{name:'Como você ganha sua renda?'})).toBeVisible();
 await expect(page.getByLabel('Nome do trabalho')).toHaveValue('');
 expect(await page.evaluate(()=>localStorage.getItem('financemed.legacy-demo.v1'))).toBe(original);
});
test('invalid saved data is preserved',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('financemed.v1','broken'));await login(page);
 await expect(page.locator('.alert.error')).toContainText('Não foi possível ler seus dados locais');
 expect(await page.evaluate(()=>localStorage.getItem('financemed.v1'))).toBe('broken');
});

test('screenshot: partial mixes, expanded limits and readable server failures',async({page})=>{
 const data={version:1,months:{[month()]:{target:5000000,available:138*60,demo:false,onboardingComplete:true,saved:[],expenses:[],works:[
  {id:'consultorio',name:'Consultório particular',type:'Consulta',net_cents:50000,minutes:60,quantity:10,max_extra:9},
  {id:'plantao',name:'Plantão no hospital',type:'Plantão',net_cents:120000,minutes:720,quantity:1,max_extra:2}
 ]}}};
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);
 await page.goto('/');await login(page);await nav(page,'Otimizar').click();
 await expect(page.getByText('R$ 43.800,00',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.getByRole('heading',{name:'A meta precisa de um ajuste'})).toBeVisible();
 await expect(page.locator('.results .scenario')).toHaveCount(3);
 await expect(page.locator('.scenario').first()).toContainText('9 × Consultório particular');
 await expect(page.locator('.scenario').first()).toContainText('2 × Plantão no hospital');
 await expect(page.locator('.scenario').first()).toContainText('33h');
 await expect(page.locator('.scenario-status.partial')).toHaveCount(3);
 await expect(page.locator('.overtime-card').first()).toContainText('88 × Consultório particular');
 await expect(page.locator('.overtime-card')).toHaveCount(3);
 await expect(page.locator('.overtime-card').first()).toContainText('Dentro das suas');
 for(const index of [1,2]){const card=page.locator('.overtime-card').nth(index);await expect(card.locator('.scenario-composition li')).toHaveCount(2);await expect(card).toContainText('Plantão no hospital');await expect(card).not.toContainText('88 × Consultório particular');await expect(card).toContainText('Total no mês');}
 await expect(page.locator('.scenario').first()).toContainText('36.900,00');
 await page.getByLabel('Limite adicional Consultório particular').fill('100');
 await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.getByRole('heading',{name:'Caminhos para a sua meta'})).toBeVisible();
 await expect(page.locator('.scenario-status.met')).toHaveCount(3);
 await expect(page.getByText('88 × Consultório particular',{exact:true})).toBeVisible();
 await expect(page.getByText('83 × Consultório particular',{exact:true})).toBeVisible();
 await expect(page.getByText('86 × Consultório particular',{exact:true})).toBeVisible();
 await page.screenshot({path:`/tmp/financemed-mixes-${test.info().project.name}.png`,fullPage:true});
 await page.route('**/api/optimizer',route=>route.fulfill({status:500,contentType:'text/plain',body:'Internal Server Error'}));
 await page.getByRole('button',{name:'Encontrar combinações'}).click();
 await expect(page.locator('.alert.error')).toContainText('Execute npm run dev');
 await expect(page.locator('.alert.error')).not.toContainText('Unexpected token');
 await expect(page.locator('.scenario')).toHaveCount(0);
});
