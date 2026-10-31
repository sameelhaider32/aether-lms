const activeBrowsers=new Set();
/* Real unpacked extension. All network is intercepted fictional read-only data. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=process.env.AETHER_EXTENSION||path.resolve(__dirname,'..'),{fixture,pdf,origin,route}=require(path.join(root,'tests/fixtures.cjs'));
const out=process.env.AETHER_REPORT_DIR||path.join(root,'reports/v2/visual');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-visual-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--load-extension=${root}`,`--disable-extensions-except=${root}`],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 activeBrowsers.add(ctx);const errors=[],network=[],shots=[];ctx.setDefaultTimeout(12000);
 await ctx.route('https://**/*',r=>{const u=new URL(r.request().url());network.push({url:u.pathname,method:r.request().method()});if(u.origin!==origin)return r.abort();if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-visual'}});if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:[{id:'cs200',title:'Introduction to Programming',type:'course'}]}});if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[]}});if(u.pathname.startsWith('/direct/announcement/'))return r.fulfill({json:{announcement_collection:[]}});if(u.pathname.startsWith('/direct/content/'))return r.fulfill({json:{content_collection:[{resourceChildren:[{resourceId:'/group/cs200/Week 01/notes.txt',title:'notes.txt'}]}]}});if(u.pathname.endsWith('.pdf'))return r.fulfill({contentType:'application/pdf',body:pdf()});if(u.pathname.endsWith('.png'))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'icons/aether-48.png'))});if(u.pathname.startsWith('/access/'))return r.fulfill({contentType:'text/plain',body:'Fictional course notes. Vector clocks and distributed systems.\n\nAether preview content is safe, selectable and readable.'});return r.fulfill({contentType:'text/html',body:fixture(u.href)});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function go(tool){await page.goto(tool==='Home'?origin+'/portal/site/home':route(tool));await page.locator('#aether-workspace').waitFor();await page.waitForTimeout(180);await page.evaluate(()=>document.fonts.ready);}
 async function shot(theme,width,view){await page.waitForTimeout(80);const info=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,font:getComputedStyle(document.body).fontFamily,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)}));const file=`${theme}-${width}-${view}.png`;await page.screenshot({path:path.join(out,file)});shots.push({theme,width,view,file,...info});assert(info.fonts.includes('Geist Sans')&&info.fonts.includes('Geist Mono'),'Bundled fonts must actually load');assert(info.scrollWidth<=width+1,`${file} horizontal overflow: ${info.scrollWidth}`);}
 for(const width of [390,775,1024,1440,1920]){
  await page.setViewportSize({width,height:width===390?844:width===775?940:width===1920?1080:1000});
  for(const theme of ['aether','monochrome']){
   await go('Home');await page.selectOption('#aether-theme-select',theme);await shot(theme,width,'home');
   await page.locator('#aether-mission-control').scrollIntoViewIfNeeded();await shot(theme,width,'mission');
   await go('Overview');await shot(theme,width,'course');
   await go('Assignments');await page.locator('#assignments .ae-record-card').first().scrollIntoViewIfNeeded();await shot(theme,width,'assignments');
   await go('Gradebook student');await page.locator('#gradeSummaryTable').scrollIntoViewIfNeeded();await shot(theme,width,'gradebook');
   await page.locator('#grade-item-0 .gb-summary-grade-stats').click();await shot(theme,width,'statistics');await page.keyboard.press('Escape');
   await go('Resources');await page.locator('#resource-0').scrollIntoViewIfNeeded();await shot(theme,width,'resources');
   await page.locator('#resource-0 .dropdown-toggle').click();assert(await page.locator('#resource-0 .dropdown-menu.show').isVisible());await shot(theme,width,'native-menu');await page.locator('#resource-0 .dropdown-toggle').click();
   await page.locator('#resource-2 [data-ae-preview-open]').click();await page.locator('.ae-preview-text').waitFor();await shot(theme,width,'text-preview');await page.keyboard.press('Escape');
   await page.locator('#resource-0 [data-ae-preview-open]').click();await page.locator('.ae-resource-preview[data-pdf-page="1"]').waitFor();await shot(theme,width,'pdf-preview');await page.keyboard.press('Escape');
   await page.locator('#aether-spotlight-trigger').click();await page.locator('#ae-spot-input').fill('resources');await page.waitForTimeout(160);await shot(theme,width,'spotlight');await page.keyboard.press('Escape');
   await page.locator('[data-ae-download-entry="toolbar"]').click();await page.locator('#aether-download-manager[open]').waitFor();await shot(theme,width,'downloads');await page.keyboard.press('Escape');
   console.log('REVIEW',theme,width);
  }
 }
 assert.equal(errors.length,0,errors.join('\n'));assert(network.every(r=>r.method==='GET'));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({shots,errors,fixtureOnly:true,requests:network.length},null,2));await ctx.close();activeBrowsers.delete(ctx);console.log('PASS',shots.length,'screenshots, no horizontal page overflow or script errors');
})().catch(async e=>{console.error(e);await Promise.allSettled([...activeBrowsers].map(ctx=>ctx.close()));process.exitCode=1;});
