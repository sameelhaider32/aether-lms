/* Fictional portal entry pages, exercised by the real unpacked extension. */
const {chromium}=require('playwright'),{fixture,origin}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),extension=path.resolve(process.env.AETHER_EXTENSION||root);
const reportDir=path.join(root,'reports','portal-startup');fs.mkdirSync(reportDir,{recursive:true});
const results=[],errors=[],requests=[];
function entryPage(url){
 const u=new URL(url),gateway=u.searchParams.has('gateway');
 let html=fixture(origin+'/portal/site/home');
 if(gateway){
  html=html.replace('</header>',`<form id="loginForm" action="${origin}/portal/xlogin" method="post"><label>Username <input name="eid" autocomplete="username" required></label><label>Password <input name="pw" type="password" autocomplete="current-password" required></label><button type="submit">Login</button></form></header>`)
   .replace(/<nav id="toolMenu"[\s\S]*?<\/nav>/,'<nav id="toolMenu"><a href="/portal">Gateway welcome</a></nav>')
   .replace(/<main id="content"[\s\S]*?<\/main>/,'<main id="content" class="portal-main-content"><section class="Mrphs-container"><h1>Welcome to Sakai</h1><a id="native-help" href="/portal/help">Sign-in help</a></section></main>')
   .replace('</body>',`<script>window.fixtureLoginForm=document.getElementById('loginForm');window.fixturePassword=window.fixtureLoginForm.elements.pw;window.fixtureSubmissions=0;window.fixtureLoginForm.addEventListener('submit',event=>{event.preventDefault();window.fixtureSubmissions++;});</script></body>`);
 }
 if(u.searchParams.has('delayed'))html=html.replace('<div id="pageBody"','<template id="fixture-late-shell"><div id="pageBody"').replace('</body>','</template><script>setTimeout(()=>{const shell=document.getElementById("fixture-late-shell");shell.replaceWith(shell.content);},200);</script></body>');
 return html;
}
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-entry-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--load-extension=${extension}`,`--disable-extensions-except=${extension}`],viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(5000);
 try{
  await context.route('https://**/*',route=>{
   const u=new URL(route.request().url());requests.push(u.origin+u.pathname);
   if(u.origin!==origin)return route.abort();
   return route.fulfill({contentType:'text/html',body:entryPage(u.href)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  async function run(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.message});console.log('FAIL',name,e.message);}}
  for(const pathname of ['/','/portal','//portal','/portal/','//portal/site/home'])await run('Home activates without interaction at '+pathname,async()=>{
   await page.goto(origin+pathname);
   await page.locator('#aether-workspace .ae-hero-home').waitFor();
   assert(await page.evaluate(()=>window.aetherFirstParserSnapshot.enabled));
   assert.equal(await page.locator('.ae-course-card').count(),3);
   assert.equal(await page.locator('#aether-native-toggle').count(),1);
   assert(await page.evaluate(()=>!!globalThis.chrome&&document.documentElement.classList.contains('aether-enabled')));
   await page.locator('#aether-global-ambient').waitFor();
   if(pathname==='//portal')await page.screenshot({path:path.join(reportDir,'double-slash-home.png')});
  });
  for(const pathname of ['/','//portal'])await run('Late Home shell activates after DOMContentLoaded at '+pathname,async()=>{
   await page.goto(origin+pathname+'?delayed=1');
   await page.locator('#aether-workspace .ae-hero-home').waitFor();
   assert.equal(await page.locator('#aether-workspace').count(),1);
  });
  for(const pathname of ['/','/portal','//portal'])await run('Gateway theme preserves native sign-in at '+pathname,async()=>{
   await page.goto(origin+pathname+'?gateway=1');
   await page.locator('#aether-native-toggle').waitFor();
   await page.locator('#aether-global-ambient').waitFor();
   assert.equal(await page.locator('#aether-workspace').count(),0,'Gateway must not invent a course workspace');
   if(pathname==='//portal')await page.screenshot({path:path.join(reportDir,'double-slash-gateway.png')});
   assert(await page.evaluate(()=>window.fixtureLoginForm===document.getElementById('loginForm')&&window.fixturePassword===document.querySelector('input[type=password]')));
   assert.equal(await page.locator('#loginForm').getAttribute('action'),origin+'/portal/xlogin');
   await page.locator('[name=eid]').fill('fictional-student');
   await page.locator('[name=pw]').fill('fixture-only-password');
   await page.locator('#loginForm button').click();
   assert.equal(await page.evaluate(()=>window.fixtureSubmissions),1);
   await page.locator('#aether-native-toggle').click();
   assert.equal(await page.locator('html.aether-enabled').count(),0);
   assert.equal(await page.locator('#aether-global-ambient').count(),0);
   assert.equal(await page.locator('[name=pw]').inputValue(),'fixture-only-password');
   await page.locator('#aether-native-toggle').click();
   await page.locator('#aether-global-ambient').waitFor();
   assert.equal(await page.locator('#native-help').getAttribute('href'),'/portal/help');
  });
  await run('Root gateway OFF preference survives reload, and ON restores automatic startup',async()=>{
   await page.goto(origin+'/?gateway=1');
   await page.locator('#aether-native-toggle').click();
   await page.reload();
   await page.locator('#aether-native-toggle[aria-pressed="false"]').waitFor();
   assert.equal(await page.locator('html.aether-enabled,#aether-global-ambient').count(),0);
   assert(await page.locator('#loginForm').isVisible());
   await page.locator('#aether-native-toggle').click();
   await page.reload();
   await page.locator('#aether-global-ambient').waitFor();
   assert.equal(await page.locator('#aether-workspace').count(),0);
   await page.goto(origin+'/');
   await page.locator('#aether-workspace .ae-hero-home').waitFor();
  });
  for(const pathname of ['/','//portal/site/cs200/page/Resources?tool=Resources'])await run('Resource cards and previews work under '+pathname,async()=>{
   await context.unroute('https://**/*');
   await context.route('https://**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
    if(u.pathname.startsWith('/access/content/'))return route.fulfill({contentType:'text/plain',body:'Fictional preview on a double-slash portal.'});
    return route.fulfill({contentType:'text/html',body:fixture(origin+'/portal/site/cs200/page/Resources?tool=Resources')});
   });
   await page.goto(origin+pathname);
   await page.locator('#resource-2.ae-record-card [data-ae-preview-open]').waitFor();
   assert.equal(await page.locator('#aether-workspace').count(),1);
   await page.locator('#resource-2 [data-ae-preview-open]').click();
   await page.locator('.ae-preview-text').waitFor();
   assert.match(await page.locator('.ae-preview-text').textContent(),/Fictional preview/);
   await page.keyboard.press('Escape');
   await page.screenshot({path:path.join(reportDir,'double-slash-resources.png')});
  });
  for(const pathname of ['/not-portal','//portalevil'])await run('Unrelated path stays outside Aether: '+pathname,async()=>{
   await page.goto(origin+pathname);
   assert.equal(await page.locator('html.aether-enabled,#aether-workspace,#aether-native-toggle,#aether-global-ambient').count(),0);
  });
  await run('Entry pages produce no uncaught browser errors or external requests',async()=>{assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(origin+'/')));});
 }finally{
  fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify({fixtureOnly:true,results,errors},null,2));
  await context.close();
 }
 console.log(`${results.filter(r=>r.passed).length}/${results.length} portal startup checks passed`);process.exitCode=results.some(r=>!r.passed)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
