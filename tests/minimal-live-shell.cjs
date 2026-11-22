/* Real extension against a fixture that mirrors the live portal shell (docs/live-dom-audit.md).
   Every response is intercepted and invented; no LMS request leaves the machine. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {liveFixture,route,home,origin,tools}=require('./live-shell-fixture.cjs'),root=path.resolve(__dirname,'..'),out=path.join(root,'reports/minimal/live-shell');fs.mkdirSync(out,{recursive:true});
const DARK='rgb(31, 34, 37)',LIGHT='rgb(250, 250, 250)';
(async()=>{
 const c=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-live-shell-')),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--load-extension=${root}`,`--disable-extensions-except=${root}`],viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 try{
 await require('./extension-ready.cjs')(c,root);const requests=[],errors=[],results=[];
 const eventTime=Date.now()+86400000;
 await c.route('https://**/*',r=>{const u=new URL(r.request().url());requests.push({url:u.href,method:r.request().method()});if(u.origin!==origin)return r.abort();
  if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-live-shell'}});
  if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:[{id:'fx200',title:'FX200 Fictional Programming',type:'course'}]}});
  if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[{siteId:'fx200',siteName:'FX200',eventId:'live-shell-event',title:'Invented calendar event',type:'Lecture',firstTime:{time:eventTime}}]}});
  if(u.pathname.startsWith('/direct/'))return r.fulfill({json:{}});
  if(u.pathname.startsWith('/access/'))return r.fulfill({body:'Fictional text content'});
  return r.fulfill({contentType:'text/html',body:liveFixture(u.href)});
 });
 const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 async function test(name,fn){await fn();results.push(name);console.log('PASS',name);}
 const go=async(url=home)=>{await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#aether-theme-select').waitFor();};
 const choose=theme=>p.selectOption('#aether-theme-select',theme);
 const box=s=>p.locator(s).first().evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};});
 const columns=()=>p.locator('#pageBody').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);
 const frameState=()=>p.locator('main#content iframe.portletMainIframe').first().evaluate(f=>({marked:f.contentDocument.documentElement.classList.contains('ae-frame-enabled'),bg:getComputedStyle(f.contentDocument.body).backgroundColor}));
 const fitted=()=>p.waitForFunction(n=>{const c=document.querySelector('.portal-header>.am-context');return c&&c.querySelectorAll('.am-tools>a').length+c.querySelectorAll('.am-more-menu>a').length===n;},tools.length);

 await go(route('Overview'));await choose('minimal');await p.locator('#aether-minimal-nav').waitFor();
 for(const width of [1440,1920]){
  await test(`Shell at ${width}px: one bar, no sidebar column, controls inside the header`,async()=>{
   await p.setViewportSize({width,height:900});await fitted();
   assert.equal(await columns(),1);
   const header=await box('.portal-header'),main=await box('.portal-main-container'),ws=await box('#aether-workspace');
   assert.equal(Math.round(main.x),0);assert(Math.abs(main.y-header.bottom)<1.5,'main container starts under the header');assert(ws.x>=20&&ws.x<=28,'content starts about 24px from the left');
   for(const s of ['#aether-minimal-nav','#aether-native-toggle','#aether-theme-control','#aether-spotlight-trigger','#sakai-system-indicators','.portal-header>.am-context']){const b=await box(s);assert(b.y>=header.y-1&&b.bottom<=header.bottom+1,s+' stays inside the header');}
   const nav=await box('#aether-minimal-nav'),toggle=await box('#aether-native-toggle'),theme=await box('#aether-theme-control'),spot=await box('#aether-spotlight-trigger'),native=await box('#sakai-system-indicators');
   assert(nav.right<=toggle.x&&toggle.right<=theme.x&&theme.right<=spot.x&&spot.right<=native.x,'bar order: nav, toggle, theme, Spotlight, native controls');
   assert(await p.locator('#aether-theme-select').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))||document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n;}),'theme selector is not covered');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:path.join(out,`course-${width}.png`)});
  });
 }
 await test('Native system controls keep their elements and handlers; logout stays reachable',async()=>{
  assert.equal(await p.locator('#sakai-system-indicators button:visible').count(),5);
  await p.getByRole('button',{name:'Calendar',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Calendar',exact:true}).getAttribute('data-opened'),'true');
  await p.locator('#fixture-account').click();await p.locator('#fixture-logout').click();assert.equal(await p.locator('#fixture-logout').getAttribute('data-clicked'),'true');
  await p.locator('#sakai-account-panel').evaluate(n=>n.style.visibility='');
  assert(!(await p.locator('#logoWrapper').isVisible()),'logo block is replaced by Dashboard and All Tools');
  await p.locator('.manage-overview-link').click();assert.equal(await p.locator('.manage-overview-link').getAttribute('data-clicked'),'true');
 });
 await test('Course title sits on its own truncated line above a single tool row',async()=>{
  await p.setViewportSize({width:1440,height:900});await fitted();
  const title=await box('.am-course-title'),row=await box('.am-toolrow');assert(title.bottom<=row.y+1);
  assert.equal(await p.locator('.am-course-title').evaluate(n=>getComputedStyle(n).whiteSpace),'nowrap');
  assert.match(await p.locator('.am-course-title').getAttribute('title'),/Fictional Programming/);
  assert(await p.locator('.am-tools').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'no horizontal overflow in the tool row');
  assert.equal(await p.locator('.portal-header>.am-context').evaluate(n=>getComputedStyle(n).overflowX),'visible');
  assert.equal(await p.locator('#aether-minimal-nav .am-context').count(),0);
  assert.equal(await p.locator('.am-context [aria-current="page"]').count(),1);
 });
 await test('Tools that do not fit move into More; Escape and outside click close it',async()=>{
  await p.setViewportSize({width:900,height:900});
  await p.waitForFunction(()=>document.querySelectorAll('.am-more-menu>a').length>0);
  const inRow=await p.locator('.am-tools>a').count(),inMenu=await p.locator('.am-more-menu>a').count();assert.equal(inRow+inMenu,tools.length);
  assert(await p.locator('.am-tools').evaluate(n=>n.scrollWidth<=n.clientWidth+1));assert(!(await p.locator('.am-more-menu').isVisible()));
  await p.locator('.am-more-toggle').click();assert(await p.locator('.am-more-menu a').last().isVisible());assert.equal(await p.locator('.am-more-toggle').getAttribute('aria-expanded'),'true');
  await p.screenshot({path:path.join(out,'more-menu-900.png')});
  await p.keyboard.press('Escape');assert(!(await p.locator('.am-more-menu').isVisible()));assert(await p.locator('.am-more-toggle').evaluate(n=>n===document.activeElement));
  await p.locator('.am-more-toggle').click();await p.locator('main#content').click({position:{x:5,y:5}});assert(!(await p.locator('.am-more-menu').isVisible()));
  await p.locator('#toolMenu .is-current-site .site-page-list a').filter({hasText:'Site Info'}).evaluate(a=>a.addEventListener('click',e=>{e.preventDefault();sessionStorage.setItem('live-shell-native-click','yes');}));
  await p.locator('.am-more-toggle').click();await p.locator('.am-more-menu a').filter({hasText:'Site Info'}).click();assert.equal(await p.evaluate(()=>sessionStorage.getItem('live-shell-native-click')),'yes');
 });
 await test('390px: no page overflow, More available, All Tools drawer opens below the header',async()=>{
  await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelectorAll('.am-more-menu>a').length>0);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const header=await box('.portal-header');assert(header.h<260,'mobile header stays compact');
  await p.screenshot({path:path.join(out,'course-390.png')});
  await p.setViewportSize({width:1440,height:900});await fitted();
  await p.locator('[data-am-tools]').click();const drawer=await box('#portal-nav-sidebar');assert(drawer.y>=(await box('.portal-header')).bottom,'drawer starts below the whole header');
  await p.keyboard.press('Escape');assert(!(await p.locator('#portal-nav-sidebar').isVisible()));
 });
 await test('Native panels and same-origin tool frames are light under a dark Sakai account theme',async()=>{
  await p.waitForFunction(()=>document.querySelector('main#content iframe')?.contentDocument?.documentElement.classList.contains('ae-frame-enabled'));
  assert.deepEqual(await frameState(),{marked:true,bg:LIGHT});
  const panel=await p.locator('main#content .Mrphs-container').first().evaluate(n=>{const s=getComputedStyle(n);return {bg:s.backgroundColor,border:s.borderTopStyle,width:parseFloat(s.borderTopWidth),radius:s.borderTopLeftRadius};});
  assert.equal(panel.bg,LIGHT);assert.equal(panel.border,'solid');assert(panel.width>0&&panel.width<=1);assert.equal(panel.radius,'13px');
  await p.screenshot({path:path.join(out,'course-panels-1440.png')});
 });
 await test('Dashboard: greeting row is content-height and event days carry a dot, not a box',async()=>{
  await go(home);await p.locator('#aether-minimal-planning').waitFor();await p.locator('.am-calendar .am-has-events').first().waitFor();
  const hero=await box('.ae-hero'),copy=await box('.ae-hero-copy');assert(hero.h-copy.h<6,'no dead space under the greeting');
  const day=await p.locator('.am-calendar .am-has-events:not([aria-current="date"])').first().evaluate(n=>({border:getComputedStyle(n).borderTopColor,dot:getComputedStyle(n,'::after').width}));
  assert.equal(day.border,'rgba(0, 0, 0, 0)');assert.equal(day.dot,'4px');
  assert.equal(await columns(),1);assert.equal(await p.locator('.portal-header>.am-context').count(),0);
  await p.screenshot({path:path.join(out,'dashboard-1440.png')});
 });
 await test('Minimal Dark: fourth selector entry, same layout, dark surfaces, persists over reload',async()=>{
  await go(route('Overview'));assert.deepEqual(await p.locator('#aether-theme-select option').evaluateAll(o=>o.map(n=>n.value)),['aether','monochrome','minimal','minimal-dark']);
  await choose('minimal');await p.locator('.portal-header>.am-context').waitFor();await fitted();
  const light={header:await box('.portal-header'),row:await box('.am-toolrow'),hero:await box('.ae-hero'),panel:await box('main#content .Mrphs-container')};
  assert.equal(await p.locator('main#content .Mrphs-container').first().evaluate(n=>getComputedStyle(n).backgroundColor),LIGHT);
  await choose('minimal-dark');await p.waitForFunction(()=>getComputedStyle(document.querySelector('main#content .Mrphs-container')).backgroundColor==='rgb(0, 0, 0)');
  assert.equal(await p.locator('#aether-minimal-nav').count(),1);assert.equal(await columns(),1);
  const dark={header:await box('.portal-header'),row:await box('.am-toolrow'),hero:await box('.ae-hero'),panel:await box('main#content .Mrphs-container')};
  for(const k of Object.keys(light))for(const d of ['x','y','w','h'])assert(Math.abs(light[k][d]-dark[k][d])<1,k+'.'+d+' is identical in both Minimal variants');
  const c=await p.evaluate(()=>{const g=(s,p)=>getComputedStyle(document.querySelector(s))[p];const f=document.querySelector('main#content iframe').contentDocument;return {body:g('body','backgroundColor'),header:g('.portal-header','backgroundColor'),ink:g('.am-course-title','color'),current:g('.am-context [aria-current=page]','backgroundColor'),currentInk:g('.am-context [aria-current=page]','color'),hero:g('.ae-hero','backgroundColor'),frame:getComputedStyle(f.body).backgroundColor,frameInk:getComputedStyle(f.body).color,scheme:g('html','colorScheme')};});
  assert.deepEqual(c,{body:'rgb(0, 0, 0)',header:'rgb(0, 0, 0)',ink:'rgb(232, 232, 232)',current:'rgb(232, 232, 232)',currentInk:'rgb(11, 11, 11)',hero:'rgb(0, 0, 0)',frame:'rgb(0, 0, 0)',frameInk:'rgb(228, 228, 228)',scheme:'dark'});
  await p.screenshot({path:path.join(out,'dark-course-1440.png')});
  await p.reload({waitUntil:'domcontentloaded'});await p.locator('#aether-minimal-nav').waitFor();assert.equal(await p.locator('#aether-theme-select').inputValue(),'minimal-dark');assert.equal(await p.locator('html').getAttribute('data-aether-theme'),'minimal-dark');
  await go(home);await p.locator('#aether-minimal-planning').waitFor();await p.waitForFunction(()=>document.querySelector('#aether-mission-control')?.dataset.loading==='false');await p.screenshot({path:path.join(out,'dark-dashboard-1440.png'),fullPage:false});
  await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,'dark-dashboard-390.png')});await p.setViewportSize({width:1440,height:900});
  await choose('minimal');await p.waitForFunction(()=>getComputedStyle(document.querySelector('.ae-hero')).backgroundColor==='rgb(250, 250, 250)');
 });
 for(const theme of ['aether','monochrome']){
  await test(`${theme}: native grid, header and frames are untouched by Minimal rules`,async()=>{
   await go(route('Overview'));await choose(theme);await p.locator('#aether-minimal-nav').waitFor({state:'detached'});
   assert.equal(await columns(),2);assert.equal(await p.locator('.am-context,.am-more').count(),0);
   assert(await p.locator('#logoWrapper').isVisible());assert(await p.locator('#toolMenu').isVisible());
   assert(Math.round((await box('.portal-header')).h)<=64,'header keeps its pre-existing height (existing 64px min-height)');assert.equal((await frameState()).bg,DARK);
   assert.equal(await p.locator('main#content .Mrphs-container').first().evaluate(n=>getComputedStyle(n).borderTopLeftRadius==='13px'),false);
  });
 }
 await test('OFF restores the native shell with nothing left behind; ON rebuilds one Minimal bar',async()=>{
  await choose('minimal');await p.locator('.portal-header>.am-context').waitFor();
  await p.locator('#aether-native-toggle').click();await p.locator('#aether-minimal-nav').waitFor({state:'detached'});
  assert.equal(await p.locator('html.aether-enabled').count(),0);assert.equal(await columns(),2);assert.equal(await p.locator('.am-context,.am-more,.am-nav').count(),0);
  assert.equal(Math.round((await box('.portal-header')).h),63);assert(await p.locator('#logoWrapper').isVisible());
  await p.waitForFunction(()=>!document.querySelector('main#content iframe').contentDocument.documentElement.classList.contains('ae-frame-enabled'));
  assert.deepEqual(await frameState(),{marked:false,bg:DARK});
  assert.equal(await p.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),DARK);
  await p.locator('#aether-native-toggle').click();await p.locator('.portal-header>.am-context').waitFor();
  assert.equal(await p.locator('#aether-minimal-nav').count(),1);assert.equal(await p.locator('.portal-header>.am-context').count(),1);assert.equal(await columns(),1);
 });
 await test('No browser errors or non-read-only/external requests',async()=>{assert.deepEqual(errors,[]);assert(requests.every(r=>r.method==='GET'&&new URL(r.url).origin===origin));});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,fixtureOnly:true},null,2));
 }finally{await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
