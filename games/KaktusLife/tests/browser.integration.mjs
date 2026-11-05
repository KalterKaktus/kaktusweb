import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startIntegrationServer,PEOPLE} from './fixtures/integration-server.mjs';
const {chromium}=await import(process.env.KAKTUSLIFE_PLAYWRIGHT_MODULE || 'playwright');
const output=resolve(process.env.KAKTUSLIFE_QA_OUTPUT || new URL('../test-results/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));
await mkdir(output,{recursive:true});
const fixture=await startIntegrationServer({port:0});
const base=`http://127.0.0.1:${fixture.server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.KAKTUSLIFE_BROWSER_EXECUTABLE?{executablePath:process.env.KAKTUSLIFE_BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'chrome'}:{})});
const errors=[],responses=[];
const context=async(person,mobile=false)=>{
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1050},reducedMotion:'reduce',locale:'de-DE',...(mobile?{isMobile:true,hasTouch:true}:{} )});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 if(person)await context.addInitScript(person=>localStorage.setItem('fixture-person',JSON.stringify(person)),person);
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))responses.push({url:new URL(response.url()).pathname,status:response.status()});});
 await page.goto(`${base}/games/KaktusLife/`);await page.locator('#practice-form').waitFor({state:'attached'});
 return {context,page};
};
const noOverflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page must fit viewport');
const noRawKeys=async page=>assert.ok(!/\blife\.[a-zA-Z]+\./.test(await page.locator('body').innerText()),'no unresolved UI translations');
async function clickMutation(page,selector,op='action'){
 await page.bringToFront();
 const response=page.waitForResponse(response=>{
  if(!response.url().endsWith('/api/kaktuslife')||response.request().method()!=='POST')return false;
  try{return response.request().postDataJSON()?.op===op;}catch{return false;}
 },{timeout:30000});
 const touch=await page.evaluate(()=>matchMedia('(pointer: coarse)').matches);
 const [result]=await Promise.all([response,touch?page.locator(selector).tap():page.locator(selector).click()]);
 assert.equal(result.status(),200,await result.text());
 return (await result.json()).room;
}
async function snapshot(person,roomId){
 const result=await fixture.handler(new Request(`${base}/api/kaktuslife`,{method:'POST',headers:{Authorization:`Bearer ${person.token}`,'Content-Type':'application/json'},body:JSON.stringify({op:'snapshot',roomId})}));
 assert.equal(result.status,200);return (await result.json()).room;
}
try{
 const host=await context(PEOPLE[0]),guest=await context(PEOPLE[1],true);
 await noOverflow(host.page);await noOverflow(guest.page);await noRawKeys(host.page);
 await host.page.screenshot({path:resolve(output,'kaktuslife-desktop-start.png'),fullPage:true});
 let room=await clickMutation(host.page,'[data-action="create"]','create');
 await guest.page.locator('[name="code"]').fill(room.code);
 room=await clickMutation(guest.page,'#join-form button[type="submit"]','join');
 room=await clickMutation(guest.page,'[data-action="ready"]');
 room=await clickMutation(host.page,'[data-action="start-online"]');
 await host.page.locator('[data-choice]:enabled').first().waitFor();
 await host.page.screenshot({path:resolve(output,'kaktuslife-desktop-spiel.png'),fullPage:true});
 await guest.page.locator('.player-card').first().waitFor();
 await noOverflow(guest.page);await noRawKeys(guest.page);
 await guest.page.screenshot({path:resolve(output,'kaktuslife-mobile-spiel.png'),fullPage:true});
 let turns=0;
 while(room.state.status!=='finished'){
  assert.ok(turns<600,'browser game must terminate');
  const state=room.state;
  const owner=state.players[state.turn].id===PEOPLE[0].id?host:guest;
  let selector;
  if(state.stage==='choice'){
   const preferences=state.turn===0?['study','career_engineer','safe','partner','house_townhouse','children1','promotion','invest60','memories']:
    ['career','career_maker','adventure','solo','rent','children2','sabbatical','repay','community'];
   const choice=preferences.find(id=>state.pending.options.some(option=>option.id===id))||state.pending.options[0].id;
   selector=`[data-choice="${choice}"]:enabled`;
  }else selector=`[data-action="${state.stage==='roll'?'roll':'end-turn'}"]:enabled`;
  if(process.env.KAKTUSLIFE_QA_VERBOSE)console.log(`Action ${turns}: seat ${state.turn} ${state.stage}/${state.pending?.type||''} rev${room.revision} ${selector}`);
  try{room=await clickMutation(owner.page,selector);}catch(error){
   const boxes=await owner.page.evaluate(async selector=>{const samples=[];for(let i=0;i<8;i++){const button=document.querySelector(selector.replace(':enabled','')),r=button?.getBoundingClientRect();samples.push({y:r?.y,x:r?.x,width:r?.width,height:r?.height,scrollY,animations:document.getAnimations().length,hidden:document.hidden});await new Promise(yes=>setTimeout(yes,100));}return samples;},selector);
   console.error(JSON.stringify({action:turns,stage:state.stage,pending:state.pending?.type,revision:room.revision,errors,boxes,visible:(await owner.page.locator('body').innerText()).slice(0,5000)},null,2));throw error;
  }turns++;
  if(turns===20){
   await guest.page.reload();await guest.page.locator('.player-card').first().waitFor();
   const restored=await snapshot(PEOPLE[1],room.id);assert.deepEqual(restored.state,room.state);
  }
  if(turns%30===0)console.log(`Browser match: ${turns} confirmed actions`);
 }
 await host.page.locator('.result-card').first().waitFor();await guest.page.locator('.result-card').first().waitFor();
 assert.equal(await host.page.locator('.result-card').count(),2);assert.equal(await guest.page.locator('.result-card').count(),2);
 await host.page.screenshot({path:resolve(output,'kaktuslife-ergebnis.png'),fullPage:true});
 await noOverflow(host.page);await noOverflow(guest.page);
 room=await clickMutation(guest.page,'[data-action="rematch"]','rematch');assert.equal(room.state,null);assert.equal(room.guestReady,false);
 await host.page.locator('.lobby-card').waitFor();
 await host.page.locator('[data-action="home"]').first().click();
 // Russian and narrow-screen layout use the same site switcher as the rest of the website.
 await guest.page.locator('[data-action="home"]').first().click();
 await guest.page.locator('.lang-btn[data-lang="ru"]').click();
 await guest.page.locator('details.practice-details').evaluate(node=>node.open=true);
 await noOverflow(guest.page);await noRawKeys(guest.page);
 await guest.page.screenshot({path:resolve(output,'kaktuslife-mobile-ru.png'),fullPage:true});
 // CDN/auth unavailable must not block local two-person play or restore.
 const local=await context(null);
 await local.context.route('**/js/supabase-client.js',route=>route.abort());
 await local.page.reload();await local.page.locator('details.practice-details').evaluate(node=>node.open=true);
 await local.page.locator('[name="one"]').fill('Ada');await local.page.locator('[name="two"]').fill('Ben');
 await local.page.locator('#practice-form button[type="submit"]').click();
 await local.page.locator('[data-choice]').first().click();
 const saved=await local.page.evaluate(()=>JSON.parse(localStorage.getItem('kk-life-practice-v1')));
 assert.equal(saved.players[0].name,'Ada');assert.ok(saved.serial>0);
 await local.page.reload();await local.page.locator('[data-action="resume-local"]').click();
 assert.equal(await local.page.locator('.player-card h3').first().innerText(),'Ada');
 await noRawKeys(local.page);
 assert.deepEqual(errors,[],'no browser runtime exceptions');
 assert.deepEqual(responses,[],'no unexpected HTTP failures');
 console.log(JSON.stringify({pass:true,confirmedBrowserActions:turns,desktop:'1440x1050',mobile:'390x844',russian:true,localAuthOffline:true,reloadRecovery:true,rematch:true,realSQL:true,screenshots:output},null,2));
}finally{await browser.close();await fixture.close();}
