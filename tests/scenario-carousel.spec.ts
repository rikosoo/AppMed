import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('two independent scenario rows slide horizontally on small screens and become grids on desktop',async({page})=>{
 const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const work=(id:string,name:string,net_cents:number,minutes:number,quantity:number,max_extra:number)=>({id,name,type:'Outro',net_cents,minutes,quantity,max_extra});
 const data={version:1,months:{[month]:{target:3500000,available:220*60,demo:false,onboardingComplete:true,saved:[],expenses:[],works:[work('base','Trabalho previsto',1000000,8700,1,0),work('c','Consultório',38000,60,0,10),work('p','Plantão',125000,720,0,4),work('t','Telemedicina',9000,15,0,15)]}}};
 await page.addInitScript(data=>localStorage.setItem('financemed.v1',JSON.stringify(data)),data);await page.goto('/');await accountLogin(page);
 await page.getByRole('navigation',{name:test.info().project.name==='mobile'?'Navegação móvel':'Menu principal'}).getByRole('button',{name:'Otimizar',exact:true}).click();
 await expect(page.locator('.scenario-carousel')).toHaveCount(2);await expect(page.locator('.scenario-carousel').first().locator('article')).toHaveCount(3);
 for(const width of [320,390,768,1023,1440]){
  await page.setViewportSize({width,height:844});
  for(const name of ['Cenários dentro dos limites','Cenários com limites a revisar']){
   const row=page.getByRole('group',{name,exact:true});
   await row.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
   const size=await row.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,snap:getComputedStyle(el).scrollSnapType}));
   if(width<1024){
    expect(size.scroll).toBeGreaterThan(size.width*2);expect(size.snap).toBe('x mandatory');
    const first=await row.locator('article').nth(0).boundingBox(),second=await row.locator('article').nth(1).boundingBox();expect(Math.abs(first!.y-second!.y)).toBeLessThan(2);
    await row.evaluate(el=>el.scrollTo({left:(el.firstElementChild as HTMLElement).offsetWidth+12,behavior:'instant'}));
    await expect.poll(()=>row.evaluate(el=>el.scrollLeft)).toBeGreaterThan(size.width/2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
   }else expect(size.scroll).toBeLessThanOrEqual(size.width+1);
  }
 }
 await page.setViewportSize({width:390,height:844});
 const regular=page.getByRole('group',{name:'Cenários dentro dos limites',exact:true});const expanded=page.getByRole('group',{name:'Cenários com limites a revisar',exact:true});
 await regular.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));await expanded.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
 if(test.info().project.name==='mobile'){
  await regular.scrollIntoViewIfNeeded();const box=(await regular.boundingBox())!;const y=Math.max(20,box.y)+80;
  const cdp=await page.context().newCDPSession(page);
  const finished=regular.evaluate(el=>new Promise<void>(resolve=>el.addEventListener('scrollend',()=>resolve(),{once:true})));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width-20,y}]});
  for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width-20-(box.width-50)*i/6,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await finished;
  await expect.poll(()=>regular.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
  await expect.poll(()=>regular.evaluate(el=>{const box=el.getBoundingClientRect();return Math.min(...Array.from(el.children).flatMap(child=>{const card=child.getBoundingClientRect();return [Math.abs(card.left-box.left),Math.abs(card.right-box.right)];}));})).toBeLessThanOrEqual(2);
  expect(await expanded.evaluate(el=>el.scrollLeft)).toBeLessThanOrEqual(1);
 }
 await regular.evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
 await expect.poll(()=>regular.evaluate(el=>el.scrollLeft)).toBeLessThanOrEqual(1);
 await regular.screenshot({path:`/tmp/financemed-carousel-${test.info().project.name}.png`});
});
