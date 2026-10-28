import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('public pages deny framing and API errors are private and sanitized',async({page})=>{
 const response=await page.request.get('/');
 expect(response.headers()['x-frame-options']).toBe('DENY');expect(response.headers()['x-content-type-options']).toBe('nosniff');expect(response.headers()['referrer-policy']).toBe('no-referrer');expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");expect(response.headers()['x-powered-by']).toBeUndefined();
 const validation=await page.request.post('/api/auth/register',{data:{username:'security-test',password:'s3cr3t'}});expect(validation.status()).toBe(422);expect(validation.headers()['cache-control']).toBe('no-store');expect(await validation.text()).not.toContain('s3cr3t');
 const blocked=await page.request.post('/api/optimizer',{data:{},headers:{Origin:'https://evil.example'}});expect(blocked.status()).toBe(403);
 const oversized=await page.request.post('/api/optimizer',{data:'x'.repeat(64001)});expect(oversized.status()).toBe(413);
});

test('untrusted work names remain plain text and another account cannot read the plan',async({page,request})=>{
 await page.goto('/');await accountLogin(page);
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const name='<img src=x onerror="window.__securityXss=1">';
 const store={version:1,months:{[month]:{works:[{id:'xss',name,type:'Consulta',net_cents:10000,minutes:60,quantity:1,max_extra:0}],expenses:[],target:50000,available:600,saved:[],demo:false,onboardingComplete:true}}};
 expect((await page.request.put('/api/plan',{data:{revision:0,store}})).ok()).toBeTruthy();await page.reload();await expect(page.getByTestId('sync-status')).toHaveText('Salvo no servidor');
 const nav=page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'});await nav.getByRole('button',{name:'Trabalhos',exact:true}).click();
 await expect(page.locator('.work-card h3')).toHaveText(name);expect(await page.evaluate(()=>(window as any).__securityXss)).toBeUndefined();await expect(page.locator('.work-card img')).toHaveCount(0);
 expect((await request.get('/api/plan')).status()).toBe(401);
 const username=`other-${crypto.randomUUID()}`;expect((await request.post('/api/auth/register',{data:{username,password:'Other-security-account-123!'}})).status()).toBe(201);
 const own=await (await request.get('/api/plan')).json();expect(own.store.months).toEqual({});
});
