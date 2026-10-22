/* Real unpacked-extension timing test, with Sakai readiness deliberately delayed. */
const {chromium}=require('playwright'),{fixture,origin}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),extension=path.resolve(process.env.AETHER_EXTENSION||root);
const version=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8')).version;
const measureOnly=process.argv.includes('--measure-only');
// Hosted VMs have variable cold-browser startup; still enforce immediate visuals
// relative to the workspace and before the deliberately delayed page readiness.
const sharedRunner=process.env.AETHER_SHARED_RUNNER==='1';
const dir=path.join(root,'reports','startup-v'+version);fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-startup-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--load-extension=${extension}`,`--disable-extensions-except=${extension}`],viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 context.setDefaultTimeout(12000);const results=[],errors=[];
 await context.addInitScript(()=>{
  window.aetherStartup={};const times=window.aetherStartup;
  const scan=()=>{
   const t=performance.now(),workspace=document.querySelector('#aether-workspace'),ambient=document.querySelector('.ae-global-canvas'),preview=document.querySelector('.ae-scene-first-frame'),field=document.querySelector('.ae-living-canvas:not(.ae-scene-first-frame)');
   if(workspace&&!times.workspaceMs)times.workspaceMs=t;
   if(ambient?.width>500&&!times.starsMs)times.starsMs=t;
   if(preview?.dataset.aeRendered&&!times.firstFieldMs)times.firstFieldMs=t;
   if((field?.dataset.aeRendered||field?.width>500)&&!times.actualFieldMs){times.actualFieldMs=t;times.firstFieldMs ||= t;}
  };
  new MutationObserver(scan).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['width','data-ae-rendered']});
  document.addEventListener('DOMContentLoaded',()=>{times.domContentLoadedMs=performance.now();scan();},{once:true});
 });
 await context.route('https://**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
  if(u.pathname==='/startup-delayed.js'){await new Promise(r=>setTimeout(r,3000));return route.fulfill({contentType:'text/javascript',body:'/* Fixture readiness delay completed. */'}).catch(()=>{});}
  return route.fulfill({contentType:'text/html',body:fixture(u.href).replace('</body>','<script src="/startup-delayed.js"></script></body>')});
 });
 async function run(name,fn){try{const extra=await fn();results.push({name,passed:true,...extra});console.log('PASS',name,JSON.stringify(extra||{}));}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL',name,e.message);}}
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await run(measureOnly?'Previous release startup timing':'Stars and folded field appear before delayed Sakai readiness',async()=>{
  await page.goto(origin+'/portal/site/home',{waitUntil:'commit'});
  await page.waitForFunction(()=>window.aetherStartup?.starsMs&&window.aetherStartup?.firstFieldMs);
  const early=await page.evaluate(()=>({...window.aetherStartup,readyState:document.readyState}));
  fs.writeFileSync(path.join(dir,'first-load-timing.json'),JSON.stringify({sharedRunner,absoluteTimingEnforced:!sharedRunner,...early},null,2));
  if(!measureOnly){assert(!early.domContentLoadedMs,'Visuals waited for DOMContentLoaded');if(!sharedRunner){assert(early.starsMs<1500,'Stars took over 1.5 seconds');assert(early.firstFieldMs<1500,'First field took over 1.5 seconds');}assert(early.starsMs-early.workspaceMs<150,'Stars lagged the workspace');assert(early.firstFieldMs-early.workspaceMs<150,'First field lagged the workspace');}
  await page.screenshot({path:path.join(dir,'first-visuals.png')});
  await page.waitForFunction(()=>window.aetherStartup?.actualFieldMs);await page.waitForLoadState('domcontentloaded');
  const timing=await page.evaluate(()=>window.aetherStartup);return {timing,visibleBeforeDomContentLoaded:!early.domContentLoadedMs};
 });
 if(!measureOnly){
  await run('GPU handoff removes the first-frame canvas without duplicates',async()=>{assert.equal(await page.locator('.ae-scene-first-frame').count(),0);assert.equal(await page.locator('.ae-living-canvas').count(),1);assert.equal(await page.locator('#aether-global-ambient').count(),1);assert(await page.locator('.ae-living-canvas').getAttribute('data-ae-rendered'));});
  await run('Reduced motion receives the same immediate first visuals',async()=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin+'/portal/site/home?reduced=1',{waitUntil:'commit'});await page.waitForFunction(()=>window.aetherStartup?.starsMs&&window.aetherStartup?.firstFieldMs);const timing=await page.evaluate(()=>window.aetherStartup);assert(!timing.domContentLoadedMs);assert(await page.locator('html.aether-reduced-motion').count());await page.waitForLoadState('domcontentloaded');return {timing};});
  await run('Early OFF cancels the pending GPU upgrade and ON restarts cleanly',async()=>{
   await page.addInitScript(()=>{const observer=new MutationObserver(()=>{if(document.querySelector('.ae-scene-first-frame')){observer.disconnect();document.querySelector('#aether-native-toggle')?.click();}});observer.observe(document,{subtree:true,childList:true});});
   await page.goto(origin+'/portal/site/home?early-off=1',{waitUntil:'commit'});await page.waitForFunction(()=>document.querySelector('#aether-native-toggle')?.getAttribute('aria-pressed')==='false');await page.waitForTimeout(100);assert.equal(await page.locator('#aether-global-ambient,.ae-scene-first-frame').count(),0);assert.equal(await page.locator('.ae-living-canvas[data-ae-rendered]').count(),0);await page.locator('#aether-native-toggle').click();await page.locator('.ae-living-canvas[data-ae-scene-target][data-ae-rendered]').waitFor();assert.equal(await page.locator('#aether-global-ambient').count(),1);assert.equal(await page.locator('.ae-scene-first-frame').count(),0);await page.waitForLoadState('domcontentloaded');
  });
  await run('Startup produces no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
 }
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify({version,fixtureOnly:true,readinessDelayMs:3000,browser:context.browser().version(),results,errors},null,2));await context.close();console.log(`${results.filter(r=>r.passed).length}/${results.length} startup checks passed`);process.exitCode=results.some(r=>!r.passed)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
