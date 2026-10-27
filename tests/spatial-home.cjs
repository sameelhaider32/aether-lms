/* Focused v1.7 smoke: real extension; all LMS responses are intercepted fixtures. */
const {chromium}=require('playwright'),{fixture,origin,route}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const extension=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..'));
const out=path.resolve(process.env.AETHER_REPORT_DIR||path.join(extension,'reports/spatial-home'));fs.mkdirSync(out,{recursive:true});
function homeFixture(url){
 let html=fixture(url);
 if(!html.includes('id="pageBody"'))return html;
 html=html.replace('<nav id="toolMenu"','<aside id="portal-nav-sidebar" class="portal-nav-sidebar" aria-label="Sakai sidebar"><nav id="toolMenu"').replace('</nav><main','</nav><a id="native-all-sites" href="/portal/site/!gateway">View all sites</a></aside><main');
 html=html.replace('<header class="portal-header">','<header class="portal-header"><button id="toggle-sidebar" aria-label="Toggle sidebar" aria-controls="portal-nav-sidebar" onclick="this.dataset.nativeClicks=String(Number(this.dataset.nativeClicks||0)+1)">☰</button>');
 html=html.replace('</header>','<button id="fixture-notifications" aria-label="Notifications" onclick="this.dataset.nativeOpened=\'true\'">Notifications</button><button id="fixture-account" aria-label="Account menu" onclick="this.dataset.nativeOpened=\'true\'">Account</button></header>');
 return html.replace('</head>','<style>#portal-nav-sidebar{width:240px;flex:none}#portal-nav-sidebar #toolMenu{width:100%}#native-all-sites{display:block;padding:12px}.portal-header .header-tool-title{flex:1}@media(max-width:640px){#portal-nav-sidebar{width:100%}.portal-header #fixture-notifications,.portal-header #fixture-account{font-size:10px;padding:6px}}</style></head>');
}
async function launch(fallback=false){
 const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-home17-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,...(fallback?['--disable-webgl']:[])],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await ctx.route('https://**/*',r=>{
  const u=new URL(r.request().url());assert.equal(r.request().method(),'GET');
  if(u.origin!==origin)return r.abort();
  if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-home-user'}});
  if(u.pathname.startsWith('/portal')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:homeFixture(u.href)});
  return r.fulfill({contentType:'application/json',body:'{}'});
 });return ctx;
}
(async()=>{
 const ctx=await launch(),errors=[];let metrics=[];
 try{
  const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const home=origin+'/portal/site/home';
  await page.goto(home);await page.locator('html.ae-spatial-home').waitFor();
  await page.evaluate(()=>{window.originalSidebar=document.querySelector('#portal-nav-sidebar');window.originalNativeLink=document.querySelector('#native-all-sites');});
  for(const [width,height]of [[1920,1080],[1440,1000],[1024,850],[775,900],[390,844]]){
   await page.setViewportSize({width,height});
   await page.locator('.ae-living-canvas[data-ae-rendered]').waitFor();
   const geometry=await page.evaluate(()=>{
    const hero=document.querySelector('.ae-hero-home'),copy=document.querySelector('.ae-hero-copy'),header=document.querySelector('.portal-header'),actions=document.querySelector('.ae-hero-actions'),focal=document.querySelector('.ae-home-focus');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
    return {viewport:innerWidth,body:document.documentElement.scrollWidth,hero:rect(hero),copy:rect(copy),header:rect(header),actions:rect(actions),focal:rect(focal),border:getComputedStyle(hero).borderTopWidth,fonts:getComputedStyle(document.querySelector('.ae-hero-heading')).fontFamily};
   });metrics.push({width,height,...geometry});
   assert(geometry.body<=width+1,JSON.stringify(geometry));assert.equal(geometry.border,'0px');assert(geometry.hero.width>=width-1);
   assert(Math.abs(geometry.copy.x+geometry.copy.width/2-width/2)<2);assert(geometry.actions.bottom<=geometry.hero.bottom);assert(geometry.focal.y>=geometry.copy.bottom-1);assert(geometry.focal.bottom<=geometry.actions.y+1);
   assert.match(geometry.fonts,/Aether Oswald/);assert(await page.locator('#aether-home-menu').isVisible());assert.equal(await page.locator('#portal-nav-sidebar').evaluate(e=>e.inert),true);
   await page.screenshot({path:path.join(out,`original-${width}.png`)});
  }
  console.log('PASS full-width centered composition, separate focal/actions, native navigation availability and no horizontal overflow at all five viewports');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#aether-home-menu').click();await page.locator('#portal-nav-sidebar').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement.classList.contains('ae-home-nav-close'));
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close Home navigation');
  assert(await page.evaluate(()=>window.originalSidebar===document.querySelector('#portal-nav-sidebar')&&window.originalNativeLink===document.querySelector('#native-all-sites')));
  await page.locator('#native-all-sites').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'ae-home-nav-close');
  await page.screenshot({path:path.join(out,'drawer-1440.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'aether-home-menu');
  await page.evaluate(()=>document.querySelector('#native-all-sites').addEventListener('click',event=>{event.preventDefault();const dialog=document.createElement('dialog');dialog.id='fixture-sites-dialog';dialog.innerHTML='<button id="fixture-sites-close">Close sites</button>';document.body.append(dialog);dialog.showModal();}));
  await page.locator('#aether-home-menu').click();await page.locator('#native-all-sites').click();assert.equal(await page.getAttribute('#aether-home-menu','aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'fixture-sites-close');await page.evaluate(()=>document.querySelector('#fixture-sites-dialog').remove());
  await page.locator('#aether-home-menu').click();await page.locator('.ae-home-nav-backdrop').click({position:{x:600,y:400}});assert.equal(await page.getAttribute('#aether-home-menu','aria-expanded'),'false');
  await page.locator('#aether-home-menu').click();await page.locator('#fixture-notifications').click();assert.equal(await page.getAttribute('#aether-home-menu','aria-expanded'),'false');await page.locator('#fixture-account').click();assert.equal(await page.getAttribute('#fixture-account','data-native-opened'),'true');
  console.log('PASS original sidebar/link identity, drawer focus loop, Escape/click-away and original header controls');
  const dockLinks=await page.locator('.ae-course-link').evaluateAll(nodes=>nodes.map(e=>e.href));assert.equal(dockLinks.length,3);assert(dockLinks.every(u=>u.startsWith(origin+'/portal/site/')));
  await page.getByRole('button',{name:'EXPLORE COURSES',exact:true}).click();assert(await page.locator('#aether-course-dock').evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}));
  await page.getByRole('button',{name:'VIEW DEADLINES',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'aether-mission-control');
  await page.evaluate(()=>window.scrollTo(0,0));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});await page.selectOption('#aether-theme-select','monochrome');await page.locator('html[data-aether-theme="monochrome"]').waitFor();
   assert.match(await page.locator('.ae-home-focus').evaluate(e=>getComputedStyle(e).color),/^rgb\((\d+), \1, \1\)$/);
   await page.screenshot({path:path.join(out,`monochrome-${width}.png`)});
  }
  await page.reload();await page.locator('html.ae-spatial-home[data-aether-theme="monochrome"]').waitFor();
  assert.equal(await page.locator('.ae-home-focus-core').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.ae-motion-btn').filter({hasText:'ON'}).waitFor();await page.locator('.ae-motion-btn').click();assert.equal(await page.locator('.ae-home-focus-core').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('#aether-home-menu').click();await page.waitForFunction(()=>document.activeElement.classList.contains('ae-home-nav-close'));await page.keyboard.press('Escape');
  await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('html.ae-spatial-home').count(),0);
  assert.equal(await page.locator('#portal-nav-sidebar').evaluate(e=>e.inert),false);assert.equal(await page.getAttribute('#portal-nav-sidebar','role'),null);assert(await page.locator('#toggle-sidebar').isVisible());assert.equal(await page.locator('#aether-home-menu').count(),0);
  await page.reload();assert.equal(await page.locator('html.ae-spatial-home').count(),0);await page.locator('#aether-native-toggle').click();await page.locator('html.ae-spatial-home').waitFor();
  console.log('PASS real course targets, course/deadline actions, both themes, persisted choice, motion/reduced-motion and native OFF restoration');
  await page.goto(route('Assignments'));await page.locator('#assignments .ae-record-card').first().waitFor();assert.equal(await page.locator('html.ae-spatial-home').count(),0);assert(await page.locator('#toggle-sidebar').isVisible());await page.locator('#toggle-sidebar').click();assert.equal(await page.getAttribute('#toggle-sidebar','data-native-clicks'),'1');
  await page.goto(home+'?tool=Resources');await page.locator('#aether-workspace').waitFor();assert.equal(await page.locator('html.ae-spatial-home').count(),0);
  await page.goto(home);await page.locator('html.ae-spatial-home').waitFor();
  const courseHTML=homeFixture(route('Gradebook student'));
  await page.evaluate(({html,url})=>{const d=new DOMParser().parseFromString(html,'text/html');document.querySelector('main#content').replaceChildren(...d.querySelector('main#content').childNodes);document.querySelector('.header-tool-title').textContent='Gradebook';document.querySelectorAll('.site-list-item').forEach(e=>e.classList.toggle('is-current-site',e.textContent.includes('CS200')));history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'));},{html:courseHTML,url:route('Gradebook student')});
  await page.locator('html.ae-spatial-home').waitFor({state:'detached'});assert.equal(await page.locator('#portal-nav-sidebar').evaluate(e=>e.inert),false);
  await page.evaluate(html=>{window.addEventListener('popstate',()=>{const d=new DOMParser().parseFromString(html,'text/html');document.querySelector('main#content').replaceChildren(...d.querySelector('main#content').childNodes);document.querySelector('.header-tool-title').textContent='Overview';document.querySelectorAll('.site-list-item').forEach(e=>e.classList.toggle('is-current-site',e.dataset.type==='home'));},{once:true});},homeFixture(home));
  await page.goBack();await page.locator('html.ae-spatial-home').waitFor();assert.equal(await page.locator('#aether-home-menu').count(),1);
  // A delayed replacement shell must regain the composition without duplicated controls.
  await page.evaluate(()=>{const main=document.querySelector('main#content');const copy=main.cloneNode(false);copy.innerHTML='<div class="Mrphs-container"><p>Delayed native Home widget</p></div>';main.replaceWith(copy);});
  await page.locator('html.ae-spatial-home #aether-workspace').waitFor();assert.equal(await page.locator('#aether-home-menu').count(),1);
  await page.evaluate(()=>{const parent=document.querySelector('#toolMenu>ul'),source=parent.querySelector('[data-type="pinned"]');for(let i=0;i<18;i++){const item=source.cloneNode(true),a=item.querySelector('.sidebar-site-title');a.textContent='Fictional pinned course '+i;a.href='/portal/site/fictional-'+i;parent.append(item);}});
  await page.waitForFunction(()=>document.querySelectorAll('.ae-course-card').length===21);
  assert(await page.locator('.ae-course-deck').evaluate(e=>e.scrollWidth>e.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.ae-course-link').last().focus();assert(await page.locator('.ae-course-link').last().evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  assert.deepEqual(errors,[]);console.log('PASS practical course/Home-tool layouts, native hamburger, SPA-like transitions, Back and delayed main replacement');
 }finally{await ctx.close();fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(metrics,null,2));}
 const fallback=await launch(true);
 try{const p=await fallback.newPage();await p.goto(origin+'/portal/site/home');await p.locator('html.ae-spatial-home canvas.ae-living-canvas[data-ae-rendered="2d"]').first().waitFor();assert(await p.locator('.ae-home-focus').isVisible());assert(await p.locator('#aether-home-menu').isVisible());console.log('PASS WebGL-disabled Canvas fallback and static focal composition');}finally{await fallback.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
