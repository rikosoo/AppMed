import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('completed services update the goal, persist across sessions and reset only in a new month',async({page,browser})=>{
 await page.goto('/');await accountLogin(page);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const works=[{id:'c',name:'Consultório',type:'Consulta',net_cents:10000,minutes:60,quantity:10,max_extra:5},{id:'m',name:'Contrato',type:'Serviço mensal',net_cents:50000,minutes:600,quantity:1,max_extra:0}];
 const store={version:1,months:{[month]:{works,expenses:[{id:'e',name:'Custos',category:'Outro',cents:10000}],target:100000,available:9600,saved:[],demo:false,onboardingComplete:true}}};
 expect((await page.request.put('/api/plan',{data:{revision:0,store}})).ok()).toBeTruthy();await page.reload();
 const goal=page.getByTestId('goal-progress');await expect(goal).toContainText('0% da meta alcançada');
 const minus=page.getByRole('button',{name:'Diminuir realizados de Consultório',exact:true});await expect(minus).toBeDisabled();
 for(let i=0;i<6;i++)await page.getByRole('button',{name:'Adicionar realizado de Consultório',exact:true}).click();
 await expect(goal).toContainText('50% da meta alcançada');await expect(goal).toContainText('500,00');
 await page.getByRole('button',{name:'Concluir no mês',exact:true}).click();await expect(goal).toContainText('Meta alcançada!');await expect(page.getByRole('progressbar',{name:'Meta realizada'})).toHaveAttribute('aria-valuenow','100');
 await page.getByRole('button',{name:'Desfazer conclusão',exact:true}).click();await minus.click();await expect(goal).toContainText('40% da meta alcançada');
 await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 const context=await browser.newContext({storageState:await page.context().storageState(),viewport:page.viewportSize()!});const other=await context.newPage();await other.goto('/');await expect(other.getByTestId('goal-progress')).toContainText('40% da meta alcançada');await context.close();
 const nav=page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'});await nav.getByRole('button',{name:'Trabalhos',exact:true}).click();await expect(page.getByRole('group',{name:'Serviços realizados: Consultório'})).toContainText('Realizados: 5 de 10 previstos');
 await page.getByRole('button',{name:'Editar Consultório',exact:true}).click();await page.getByRole('button',{name:'Salvar trabalho',exact:true}).click();await expect(page.getByRole('group',{name:'Serviços realizados: Consultório'})).toContainText('Realizados: 5 de 10 previstos');
 await page.getByRole('button',{name:'Próximo mês',exact:true}).click();await page.getByRole('button',{name:'Manter os mesmos dados',exact:true}).click();await expect(goal).toContainText('0% da meta alcançada');await expect(page.getByRole('group',{name:'Serviços realizados: Consultório'})).toContainText('Realizados: 0 de 10 previstos');
 await page.getByRole('button',{name:'Mês anterior',exact:true}).click();await expect(goal).toContainText('40% da meta alcançada');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
});
