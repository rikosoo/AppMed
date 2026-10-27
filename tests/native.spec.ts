import { test, expect } from '@playwright/test';
import { examplePlan } from '../apps/web/lib/model';
for(const platform of ['android','ios'])test(`${platform}: bundled login uses native HTTP, shares JSON and handles connection loss`,async({page})=>{
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const store={version:1,months:{[month]:{...examplePlan(),demo:false,onboardingComplete:true}}};
 await page.addInitScript(({platform,store})=>{
  const w=window as any;let signedIn=false;
  w.__calls=[];w.__listeners={};w.CapacitorCustomPlatform={name:platform};
  const methods:Record<string,string[]>={CapacitorHttp:['request'],Network:['getStatus','addListener','removeListener'],App:['addListener','removeListener','minimizeApp'],Filesystem:['writeFile'],Share:['share'],Browser:['open']};
  w.Capacitor={PluginHeaders:Object.entries(methods).map(([name,props])=>({name,methods:props.map(name=>({name,rtype:name==='addListener'?'callback':'promise'}))})),
   nativeCallback:(plugin:string,method:string,options:any,callback:any)=>{w.__listeners[options.eventName]=callback;return Promise.resolve(options.eventName);},
   nativePromise:async(plugin:string,method:string,options:any)=>{
    w.__calls.push({plugin,method,options});
    if(plugin==='Network')return {connected:true,connectionType:'wifi'};
    if(plugin==='Filesystem')return {uri:'file:///private/cache/financemed.json'};
    if(plugin==='CapacitorHttp'){
     const path=new URL(options.url).pathname;
     const user={id:'native-test-account',username:'native-doctor',role:'user'};
     let data:any={},status=200;
     if(path==='/api/auth/me'){status=signedIn?200:401;data=signedIn?{user}:{detail:'Sua sessão expirou.'};}
     if(path==='/api/auth/register'){signedIn=true;status=201;data={user};}
     if(path==='/api/plan')data=options.method==='PUT'?{revision:1}:{store,revision:0};
     return {status,data:JSON.stringify(data),headers:{'content-type':'application/json'},url:options.url};
    }
    return {};
   }
  };
 },{platform,store});
 await page.goto('/');await page.getByRole('button',{name:'Esqueci minha senha',exact:true}).click();await expect(page.getByRole('heading',{name:'Esqueceu a senha?'})).toBeVisible();await page.evaluate(()=>document.dispatchEvent(new Event('financemed:back',{cancelable:true})));await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByLabel('Usuário',{exact:true}).fill('native-doctor');await page.getByLabel('Senha',{exact:true}).fill('Native-tests-123');await page.getByLabel('Confirmar senha').fill('Native-tests-123');await page.getByRole('button',{name:'Criar minha conta'}).click();
 await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 for(const [width,height] of [[320,568],[390,400],[844,390],[768,1024]]){
  await page.setViewportSize({width,height});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Minha conta',exact:true}).click();
  const close=page.getByRole('button',{name:'Fechar conta',exact:true});await close.scrollIntoViewIfNeeded();await expect(close).toBeInViewport();await close.click();
 }
 await page.setViewportSize({width:390,height:844});
 const calls=await page.evaluate(()=>(window as any).__calls.filter((c:any)=>c.plugin==='CapacitorHttp'));
 expect(calls.every((c:any)=>c.options.url.startsWith('https://app.75hard.club/api/'))).toBeTruthy();
 const register=calls.find((c:any)=>c.options.url.endsWith('/auth/register'));
 expect(register.options.headers.Origin).toBe('https://app.75hard.club');
 expect(register.options.data.username).toBe('native-doctor');
 expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>/token|password/i.test(k)))).toBeFalsy();
 if(platform==='android'){
  const nav=page.getByRole('navigation',{name:'Navegação móvel'});
  await nav.getByRole('button',{name:'Trabalhos',exact:true}).click();
  await page.evaluate(()=>(window as any).__listeners.backButton({canGoBack:false}));
  await expect(nav.getByRole('button',{name:'Início',exact:true})).toHaveAttribute('aria-current','page');
 }
 await page.getByRole('button',{name:'Exportar dados',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__calls.some((c:any)=>c.plugin==='Share'&&c.method==='share'))).toBeTruthy();
 await page.evaluate(()=>(window as any).__listeners.networkStatusChange({connected:false}));
 await expect(page.getByRole('status').filter({hasText:'Sem conexão.'})).toBeVisible();
 await page.evaluate(()=>(window as any).__listeners.networkStatusChange({connected:true}));
 await expect(page.getByText('Sem conexão.',{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
