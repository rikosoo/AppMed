import { expect, type Page } from '@playwright/test';
const credentials=new WeakMap<Page,{username:string;password:string}>();
export async function accountLogin(page:Page){
 let user=credentials.get(page);
 if(!user){
  user={username:`test-${crypto.randomUUID()}`,password:'Financial-tests-123!'};credentials.set(page,user);
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByLabel('Usuário',{exact:true}).fill(user.username);await page.getByLabel('Senha',{exact:true}).fill(user.password);await page.getByLabel('Confirmar senha',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();
 }else{
  await page.getByLabel('Usuário',{exact:true}).fill(user.username);await page.getByLabel('Senha',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 }
 await expect(page.getByRole('button',{name:'Sair',exact:true})).toBeVisible();
 // Test fixtures use the same explicit import path offered to existing users.
 const raw=await page.evaluate(()=>localStorage.getItem('financemed.v1'));
 let realData=false;try{realData=Object.values(JSON.parse(raw||'{}').months||{}).some((p:any)=>!p.demo);}catch{}
 if(realData){
  const response=await page.request.get('/api/plan');
  if(!Object.keys((await response.json()).store.months).length){await page.getByRole('button',{name:'Importar dados deste navegador',exact:true}).click();await expect.poll(async()=>{const r=await page.request.get('/api/plan');return (await r.json()).revision;}).toBeGreaterThan(0);await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');}
 }
}
