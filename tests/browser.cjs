/* Genuine unpacked MV3 extension tests. All LMS responses are isolated fixtures. */
const { chromium }=require('playwright');
const { fixture,pdf,origin,route }=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const extension=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..'));
const baseline=process.argv.includes('--baseline');
const smoke=process.argv.includes('--smoke');
const releaseVersion=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8')).version;
const reportDir=path.resolve(process.env.AETHER_REPORT_DIR||path.join(__dirname,'..','reports',baseline?'baseline':smoke?'package-v'+releaseVersion:'v'+releaseVersion));
fs.mkdirSync(reportDir,{recursive:true});
const results=[],requests=[],errors=[];
const test=async(name,fn)=>{
 if(process.env.AETHER_TEST_FILTER&&!new RegExp(process.env.AETHER_TEST_FILTER).test(name))return;
 const start=Date.now();if(process.env.CI)console.log('RUN',name);
 // Playwright action timeouts do not bound every evaluate/protocol operation.
 const watchdog=setTimeout(()=>{const error='Test exceeded 60 seconds';results.push({name,passed:false,ms:Date.now()-start,error});fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify({baseline,smoke,extension,fixtureOnly:true,results,requests,errors,timedOut:true},null,2));console.error('FAIL',name,error);process.exit(1);},60000);
 watchdog.unref();
 try{await fn();results.push({name,passed:true,ms:Date.now()-start});console.log('PASS',name);}catch(e){results.push({name,passed:false,ms:Date.now()-start,error:e.message});console.log('FAIL',name,e.message);}finally{clearTimeout(watchdog);}
};
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aether-regression-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,ignoreDefaultArgs:['--disable-extensions'],headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 context.setDefaultTimeout(12000);
 await context.route('https://**/*',async r=>{
  const req=r.request(),u=new URL(req.url());requests.push({url:req.url(),method:req.method(),type:req.resourceType()});
  if(u.origin!==origin)return r.abort();
  if(u.pathname.startsWith('/portal/')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:fixture(u.href)});
  if(u.pathname.startsWith('/direct/content/'))return r.fulfill({json:{content_collection:[{resourceChildren:[{title:'nested-notes.txt',resourceId:'/group/cs200/Week 01/nested-notes.txt'}]}]}});
  if(u.pathname.endsWith('/restricted.pdf'))return r.fulfill({status:403,body:'Permission denied'});
  if(u.pathname.endsWith('/broken.pdf'))return r.fulfill({contentType:'application/pdf',body:'Invalid PDF'});
  if(u.pathname.endsWith('/huge.pdf'))return r.fulfill({headers:{'Content-Length':String(13*1024*1024)},body:'Oversized'});
  if(u.pathname.endsWith('.pdf'))return r.fulfill({contentType:'application/pdf',body:pdf()});
  if(u.pathname.endsWith('.png'))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(extension,'icons','aether-48.png'))});
  return r.fulfill({contentType:'text/plain',body:'<script>window.previewExecuted=true</script>\nSafe text / code / CSV fixture'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const go=async(tool,home=false)=>{await page.goto(home?origin+'/portal/site/home':route(tool));await page.locator('#aether-workspace').waitFor();};
 const card=title=>page.locator('.ae-record-card').filter({has:page.getByRole('link',{name:title,exact:true})});
 const preview=async title=>{await card(title).locator('[data-ae-preview-open]').click();await page.locator('#aether-resource-preview').waitFor();};
 await test('Home: document_start styling, native content and course links',async()=>{await go('Overview',true);assert(await page.locator('html.aether-enabled.aether-paint-ready').count());assert(await page.evaluate(()=>window.aetherFirstParserSnapshot.enabled));assert(await page.evaluate(()=>!!window.aetherFirstParserSnapshot.criticalColor));assert.equal(await page.locator('.ae-course-card').count(),3);assert(await page.getByText('Original Sakai content remains available.').isVisible());assert.equal(await page.locator('.ae-course-link').first().getAttribute('href'),origin+'/portal/site/cs200');await page.screenshot({path:path.join(reportDir,'home-desktop.png'),fullPage:true});});
 await test('Course context and original tool links',async()=>{await go('Resources');assert((await page.locator('.ae-hero-heading').innerText()).includes('Introduction'));assert.equal(await page.locator('.ae-tool-link').count(),6);assert.equal(await page.locator('#resource-0 a[download]').getAttribute('href'),origin+'/access/content/group/cs200/Lecture%2001.pdf');});
 await test('Native Actions, checkbox, sorting and pagination handlers',async()=>{await page.locator('#resource-0 .dropdown-toggle').click();assert(await page.locator('#resource-0 .dropdown-menu.show').isVisible());await page.locator('#resource-0 .dropdown-menu a').click();assert.equal(await page.locator('#resource-0 .dropdown-menu a').getAttribute('data-clicked'),'true');await page.locator('#resource-0 input').check();assert(await page.locator('#resource-0 input').isChecked());await page.locator('#sort').click();assert.equal(await page.locator('#records tbody tr').first().getAttribute('id'),'resource-10');await page.locator('#next-page').click();assert.equal(await page.locator('#next-page').getAttribute('data-clicked'),'true');});
 await test('Text preview is inert; Escape restores keyboard focus',async()=>{await preview('notes.txt');await page.getByText('Safe text / code / CSV fixture',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.previewExecuted),undefined);await page.keyboard.press('Escape');assert.equal(await page.locator('#aether-resource-preview').count(),0);assert(await card('notes.txt').locator('[data-ae-preview-open]').evaluate(e=>e===document.activeElement));});
 await test('Local PDF.js renders and navigates both pages',async()=>{await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor({timeout:20000});const reader=page.frameLocator('.ae-preview-pdf');await reader.locator('#next').click();await page.locator('#aether-resource-preview[data-pdf-page="2"]').waitFor();await reader.locator('#prev').click();await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();await reader.locator('body').press('Escape');assert.equal(await page.locator('#aether-resource-preview').count(),0);});
 await test('Folder preview and native nested folder navigation',async()=>{await preview('Week 01/');await page.getByText('1 item in this folder').waitFor();await page.keyboard.press('Escape');await card('Week 01/').getByRole('link',{name:'Week 01/',exact:true}).click();await card('nested-notes.txt').waitFor();});
 await test('Assignment states preserve baseline semantics',async()=>{await go('Assignments');assert.deepEqual(await page.locator('#assignments .ae-record-card').evaluateAll(es=>es.map(e=>e.dataset.aeAssignmentState)),['submitted-open','submitted-closed','overdue','open','open']);});
 await test('Assignment form, CSRF, upload and native validation retained',async()=>{await go('Assignment detail');assert.equal(await page.locator('input[name=csrf]').inputValue(),'fixture-only-token');await page.locator('#draft').click();assert.equal(await page.locator('#draft').getAttribute('data-saved'),'true');await page.locator('#answer').fill('Isolated test fixture only');await page.locator('#submit').click();assert(await page.locator('#confirmation').isVisible());assert.equal(await page.locator('#academic-form .ae-record-card').count(),0);});
 await test('Same-origin frame resources and top-level preview',async()=>{await go('Frame');const frame=page.frameLocator('iframe[title="Resources tool frame"]');await frame.locator('.ae-record-card').first().waitFor();await frame.locator('#resource-2 [data-ae-preview-open]').click();await page.locator('.ae-preview-text').waitFor();await page.keyboard.press('Escape');});
 await test('OFF restores native records and survives reload',async()=>{await go('Resources');await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('.ae-record-card').count(),0);assert.equal(await page.locator('[data-ae-preview-open]').count(),0);assert.equal(await page.locator('#aether-workspace').isVisible(),false);assert.equal(await page.locator('#records').evaluate(e=>getComputedStyle(e).display),'table');await page.reload();assert.equal(await page.locator('html.aether-enabled').count(),0);await page.locator('#aether-native-toggle').click();await page.locator('.ae-record-card').first().waitFor();});
 if(!baseline&&!smoke)await require('./extended.cjs')({page,context,test,go,card,preview,reportDir,assert,requests,errors});
 if(!baseline&&smoke)await require('./hover-preview.cjs')({page,context,test,go,assert});
 if(!baseline&&smoke)await require('./resource-variants.cjs')({page,context,test,go,reportDir,assert,requests});
 const report={baseline,smoke,extension,browser:context.browser()?.version(),platform:process.platform,arch:process.arch,fixtureOnly:true,results,requests,errors};fs.writeFileSync(path.join(reportDir,'results.json'),JSON.stringify(report,null,2));await context.close();console.log(`${results.filter(x=>x.passed).length}/${results.length} passed`);process.exitCode=results.some(x=>!x.passed)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
