/* Focused theme smoke. Every LMS response is fictional and intercepted. */
const {chromium}=require('playwright');
const {fixture,origin,route,pdf}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const extension=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..'));
const out=path.resolve(process.env.AETHER_REPORT_DIR||path.join(extension,'reports/theme'));
fs.mkdirSync(out,{recursive:true});
const neutral=value=>[...value.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].every(m=>m[1]===m[2]&&m[2]===m[3]);
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-theme-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[],requests=[];
 try {
  await context.route('https://**/*',r=>{
   const u=new URL(r.request().url());requests.push({method:r.request().method(),url:u.href});
   if(u.origin!==origin)return r.abort();
   if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-theme-user'}});
   if(u.pathname.endsWith('.pdf'))return r.fulfill({contentType:'application/pdf',body:pdf()});
   if(u.pathname.startsWith('/portal')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:fixture(u.href)});
   return r.fulfill({contentType:'text/plain',body:'Fictional resource'});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const go=async(tool,home=false)=>{await page.goto(home?origin+'/portal/site/home':route(tool));await page.locator('#aether-theme-select').waitFor();};
  const choose=async value=>{await page.selectOption('#aether-theme-select',value);await page.waitForFunction(v=>document.documentElement.dataset.aetherTheme===v,value);};
  const appearance=()=>page.locator('.ae-hero-heading').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,width:r.width,height:r.height};});
  const gray=async(selector,frame=page)=>{
   const colors=await frame.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.backgroundImage,s.borderTopColor,s.boxShadow];});
   assert(colors.every(neutral),`${selector} contains chromatic ink: ${colors.join(' / ')}`);
  };
  await go('Overview',true);
  const original=await appearance();
  const originalColors=await page.locator('.ae-hero-cta').first().evaluate(e=>getComputedStyle(e).backgroundColor);
  assert(!neutral(originalColors));
  await choose('monochrome');assert.deepEqual(await appearance(),original);
  await gray('.portal-header');await gray('.ae-course-card');await gray('.ae-hero-cta');
  await gray('.mc-tick');
  const remaining=await page.locator('body *').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length&&!e.closest('[inert]')&&getComputedStyle(e).visibility!=='hidden').flatMap(e=>{const s=getComputedStyle(e);return ['color','backgroundColor','borderTopColor'].filter(k=>/rgba?\(/.test(s[k])&&[...s[k].matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].some(m=>m[1]!==m[2]||m[2]!==m[3])).map(k=>({tag:e.tagName,id:e.id,class:e.className,property:k,value:s[k]}));}));
  assert.deepEqual(remaining,[],'Home contains unexpected chromatic UI colors');
  assert.match(await page.locator('#aether-mission-control select').first().evaluate(e=>getComputedStyle(e).backgroundImage),/%23dddddd/);
  assert(await page.locator('html.aether-reduced-motion').count());
  assert.match(await page.locator('.ae-living-canvas').evaluate(e=>getComputedStyle(e).filter),/grayscale\(1\)/);
  await page.screenshot({path:path.join(out,'monochrome-home.png'),fullPage:true});
  // Remove the page cache to prove chrome.storage.local restores the selection.
  await page.evaluate(()=>localStorage.removeItem('aether:v16:theme'));await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.aetherTheme==='monochrome');
  assert.equal(await page.inputValue('#aether-theme-select'),'monochrome');
  const other=await context.newPage();await other.goto(route('Resources'));await other.locator('#aether-theme-select').waitFor();
  await choose('aether');await other.waitForFunction(()=>document.documentElement.dataset.aetherTheme==='aether');
  assert.equal(await page.locator('.ae-hero-cta').first().evaluate(e=>getComputedStyle(e).backgroundColor),originalColors);
  await choose('monochrome');await other.close();
  console.log('PASS instant switching, original typography/layout/colors, storage restore, cross-tab sync and reduced motion');
  for(const tool of ['Resources','Assignments','Announcements','Gradebook student']){
   await go(tool);await page.locator('.ae-record-card').first().waitFor();await gray('.ae-record-card');
   if(tool==='Resources'){
    const href=await page.locator('#resource-0 a[download]').getAttribute('href');
    await page.locator('#resource-0 .dropdown-toggle').click();assert(await page.locator('#resource-0 .dropdown-menu.show').isVisible());
    await page.locator('#resource-0 input').check();assert(await page.locator('#resource-0 input').isChecked());
    assert.equal(await page.locator('#resource-0 a[download]').getAttribute('href'),href);
    await page.screenshot({path:path.join(out,'monochrome-resources.png'),fullPage:true});
    await page.locator('.ae-dl-global').click();await gray('#aether-download-manager');
    await page.locator('#aether-download-manager').getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('#resource-0 [data-ae-preview-open]').click();
    const reader=page.frameLocator('.ae-preview-pdf');await reader.locator('html[data-aether-theme="monochrome"]').waitFor();
    await gray('button',reader);await choose('aether');await reader.locator('html[data-aether-theme="aether"]').waitFor();
    await choose('monochrome');await page.keyboard.press('Escape');
   }
   if(tool==='Gradebook student'){
    await page.locator('#grade-item-0 .gb-summary-grade-stats').click();await gray('.gb-modal-dialog');
    const rect=await page.locator('.gb-modal-dialog canvas').boundingBox();await choose('aether');await choose('monochrome');assert.deepEqual(await page.locator('.gb-modal-dialog canvas').boundingBox(),rect);
    await page.screenshot({path:path.join(out,'monochrome-statistics.png')});
   }
  }
  console.log('PASS resources, native actions/checkbox/href, assignments, announcements, gradebook/statistics and live PDF chrome');
  await go('Frame');const frame=page.frameLocator('iframe[title="Resources tool frame"]');
  await frame.locator('.ae-record-card').first().waitFor();await gray('.ae-record-card',frame);
  await choose('aether');await frame.locator('html[data-aether-theme="aether"]').waitFor();await choose('monochrome');
  await page.locator('#aether-native-toggle').click();await frame.locator('.ae-record-card').waitFor({state:'detached'});
  assert.equal(await page.locator('#aether-theme-control').isVisible(),false);
  await page.reload();assert.equal(await page.locator('html.aether-enabled').count(),0);
  await page.locator('#aether-native-toggle').click();await frame.locator('.ae-record-card').first().waitFor();await gray('.ae-record-card',frame);
  await go('Assignment detail');assert.equal(await page.locator('input[name=csrf]').inputValue(),'fixture-only-token');assert.equal(await page.locator('#academic-form .ae-record-card').count(),0);assert(await page.locator('#answer').isEditable());
  assert(requests.every(r=>r.method==='GET'),'Unexpected operational request');assert.deepEqual(errors,[]);
  console.log('PASS same-origin frame switching, OFF/reload/ON, native form and GET-only fixture traffic');
 } finally {await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
