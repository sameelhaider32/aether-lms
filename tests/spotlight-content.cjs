/* Focused v1.8 smoke. Fictional documents, intercepted LMS GETs, real unpacked extension. */
const {chromium}=require('playwright'),JSZip=require('jszip');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..')),{fixture,origin,route}=require(path.join(root,'tests/fixtures.cjs'));
const out=process.env.AETHER_REPORT_DIR||path.join(root,'reports/fulltext');fs.mkdirSync(out,{recursive:true});
const docs=new Map(),requests=[],errors=[];let user='fictional-content-A',accepted=false,slow=false;
const url=name=>origin+'/access/content/group/cs200/'+encodeURIComponent(name);
async function modified(name,change){const z=await JSZip.loadAsync(fs.readFileSync(path.join(root,'tests/data',name)));await change(z);return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
// Tiny valid PDF fixture, using the same self-contained approach as fixtures.cjs.
function pdf(texts){
 let s='%PDF-1.4\n',offsets=[0];const stream=t=>`<< /Length ${t.length} >>\nstream\n${t}\nendstream`;
 const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',...['6','7'].map(n=>'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Resources << /Font << /F1 5 0 R >> >> /Contents '+n+' 0 R >>'),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',...texts.map(t=>stream('BT /F1 14 Tf 40 420 Td ('+t+') Tj ET'))];
 objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const x=Buffer.byteLength(s);s+=`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return Buffer.from(s);
}
async function fixtures(){
 docs.set('lecture.pdf',{type:'application/pdf',bytes:pdf(['Introduction to fictional systems','Vector clocks capture causal relationships between processes.'])});
 docs.set('scanned.pdf',{type:'application/pdf',bytes:pdf(['',''])});
 docs.set('encrypted.pdf',{type:'application/pdf',bytes:fs.readFileSync(path.join(root,'tests/data/fulltext-encrypted.pdf'))});
 docs.set('seminar.docx',{bytes:await modified('preview.docx',async z=>z.file('word/document.xml',(await z.file('word/document.xml').async('string')).replace('Fictional Word preview text.','Azure Blob Storage stores fictional objects.').replace('Discussion','vector clocks in a table')))});
 docs.set('slides.pptx',{bytes:await modified('preview.pptx',async z=>{z.file('ppt/slides/slide1.xml',(await z.file('ppt/slides/slide1.xml').async('string')).replace('Static lecture preview','Azure Blob Storage lecture'));z.file('ppt/slides/slide2.xml',(await z.file('ppt/slides/slide2.xml').async('string')).replace('First example','vector clocks'));z.file('ppt/slides/slide3.xml',(await z.file('ppt/slides/slide3.xml').async('string')).replace('<p:sld ','<p:sld show="0" ').replace('Final slide','HIDDENSLIDESECRET'));})});
 docs.set('workbook.xlsx',{bytes:await modified('preview.xlsx',async z=>{let s=await z.file('xl/worksheets/sheet1.xml').async('string');s=s.replace('<sheetData>','<cols><col min="3" max="3" hidden="1"/></cols><sheetData>').replace('Topic','vector clocks').replace('</row>','<c r="C1" t="inlineStr"><is><t>HIDDENCOLUMNSECRET</t></is></c></row>').replace('</sheetData>','<row r="4" hidden="1"><c r="A4" t="inlineStr"><is><t>HIDDENROWSECRET</t></is></c></row></sheetData>');z.file('xl/worksheets/sheet1.xml',s);})});
 docs.set('notes.txt',{type:'text/plain',bytes:Buffer.from('Fictional introduction\nVector clocks explain the causal order.\n<script>window.contentInjected=true</script><form action="/fictional"><input type=password></form>')});
 docs.set('table.csv',{type:'text/csv',bytes:Buffer.from('topic,value\nAzure Blob Storage,17\n')});
 docs.set('code.py',{type:'text/plain',bytes:Buffer.from('# vector clocks\nprint("inert fixture")')});
 docs.set('copyright.txt',{copyright:true,type:'text/plain',bytes:Buffer.from('Consented fictional copyright concept')});
 docs.set('denied.txt',{denied:true});docs.set('too-big.docx',{huge:true});docs.set('malformed.docx',{bytes:Buffer.from('PK damaged fictional archive')});
 const bomb=new JSZip();bomb.file('word/document.xml','X'.repeat(9*1024**2));docs.set('expanded.docx',{bytes:await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
 const malicious=new JSZip();malicious.file('word/document.xml','<!DOCTYPE root [<!ENTITY x SYSTEM "https://example.invalid/entity">]><root>&x;</root>');docs.set('unsafe.docx',{bytes:await malicious.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
 docs.set('picture.png',{bytes:Buffer.from('unsupported')});docs.set('slow.txt',{bytes:Buffer.from('cancelled fixture')});
}
(async()=>{
 await fixtures();const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-content-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 try{
  await ctx.route('https://**/*',async r=>{
   const req=r.request(),u=new URL(req.url());requests.push({url:u.href,method:req.method()});assert.equal(req.method(),'GET');if(u.origin!==origin)return r.abort();
   if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:user}});
   if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:[{id:'cs200',title:'Fictional Distributed Systems',type:'course'}]}});
   if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[]}});
   if(u.pathname.startsWith('/direct/announcement/'))return r.fulfill({json:{announcement_collection:[]}});
   if(u.pathname.startsWith('/direct/content/resources/')){const id=decodeURIComponent(u.pathname.slice('/direct/content/resources'.length).replace(/\.json$/,''))+'/';return r.fulfill({json:{content_collection:[{resourceId:id,resourceChildren:id==='/group/cs200/'?[...docs].map(([name,d])=>({resourceId:id+name,title:name,mimeType:d.type||'application/octet-stream'})):[]}]}});}
   if(u.pathname==='/access/accept'){accepted=true;return r.fulfill({status:200,body:'Accepted fictional notice'});}
   if(u.pathname.startsWith('/access/content/')){
    const name=decodeURIComponent(u.pathname.split('/').pop()),d=docs.get(name);if(!d)return r.fulfill({status:404});
    if(d.denied)return r.fulfill({status:403});if(d.huge)return r.fulfill({headers:{'content-length':String(9*1024**2)},body:'oversize'});
    if(d.copyright&&!accepted){const ref='/content/group/cs200/'+name,accept='/access/accept?'+new URLSearchParams({ref,url:ref});return r.fulfill({contentType:'text/html',body:`<!doctype html><html><body>Fictional copyright terms <a href="${accept.replaceAll('&','&amp;')}">Yes</a></body></html>`});}
    if(name==='slow.txt'&&slow)await new Promise(resolve=>setTimeout(resolve,1200));return r.fulfill({contentType:d.type||'application/octet-stream',body:d.bytes}).catch(()=>{});
   }
   if(u.pathname.startsWith('/portal')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:fixture(u.href)});
   return r.fulfill({status:404});
  });
  const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  const isolated=async expression=>{const cdp=await ctx.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');const main=(await cdp.send('Page.getFrameTree')).frameTree.frame.id;try{for(const w of worlds){if(w.auxData?.frameId!==main)continue;const p=await cdp.send('Runtime.evaluate',{contextId:w.id,expression:'typeof AetherSpotlightContent!=="undefined"',returnByValue:true});if(p.result.value){const r=await cdp.send('Runtime.evaluate',{contextId:w.id,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}}throw Error('Content isolated world unavailable');}finally{await cdp.detach();}};
  const snap=()=>isolated('AetherSpotlightContent.snapshot()');
  const done=async()=>{await page.waitForFunction(()=>!document.querySelector('[data-content-cancel]')||document.querySelector('[data-content-cancel]').hidden,{},{timeout:45000});};
  const palette=page.locator('#aether-spotlight'),query=page.locator('#ae-spot-input');
  await page.goto(origin+'/portal/site/home');await page.locator('#aether-spotlight-trigger').waitFor();
  assert.equal(requests.filter(r=>r.url.includes('/access/content/')).length,0);
  await page.locator('#aether-spotlight-trigger').click();await page.getByRole('button',{name:'Search more available resources',exact:true}).click();await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});
  assert.equal(requests.filter(r=>r.url.includes('/access/content/')).length,0,'Metadata discovery downloaded documents');
  await page.getByRole('button',{name:'Index document contents',exact:true}).click();await page.getByRole('button',{name:'Select up to 100 supported files',exact:true}).click();assert(await page.getByRole('checkbox',{name:'Index picture.png',exact:true}).isDisabled());
  await page.getByRole('checkbox',{name:'Index slow.txt',exact:true}).uncheck();await page.getByRole('button',{name:'Start indexing',exact:true}).click();await done();
  const s=await snap(),statuses=Object.fromEntries(s.report.map(r=>[r.meta.title,r.status]));console.log('File statuses',statuses);
  for(const n of ['lecture.pdf','seminar.docx','slides.pptx','workbook.xlsx','notes.txt','table.csv','code.py'])assert.equal(statuses[n],'Indexed',n);
  assert.match(statuses['scanned.pdf'],/No extractable text/);assert.match(statuses['encrypted.pdf'],/Encrypted/);assert.match(statuses['too-big.docx'],/Too large/);assert.match(statuses['expanded.docx'],/Too large/);assert.match(statuses['malformed.docx'],/archive|damaged/i);assert.equal(statuses['copyright.txt'],'Copyright acknowledgment required');assert.equal(statuses['denied.txt'],'Permission denied');assert.match(statuses['unsafe.docx'],/Malformed|unsupported/i);assert(!accepted);
  const search=async q=>isolated(`AetherSpotlightContent.query(${JSON.stringify(q)})`);
  assert.equal((await search('causal relationships'))[0].location,'Page 2');assert.equal((await search('Azure Blob Storage')).find(r=>r.title==='slides.pptx').location,'Slide 1');assert.equal((await search('42'))[0].location,'Overview · B2');assert.equal((await search('clocks')).find(r=>r.title==='workbook.xlsx').location,'Overview · A1');
  for(const q of ['HIDDENSLIDESECRET','HIDDENCOLUMNSECRET','HIDDENROWSECRET','Hidden fixture cell','UNSAFE ALT CHUNK','SUM 20'])assert.equal((await search(q)).length,0,q);
  assert.equal((await search('vector clocks')).find(r=>r.title==='notes.txt').location,'Line 2');assert.equal((await search('Azure Blob Storage')).find(r=>r.title==='table.csv').location,'Line 2');
  console.log('PASS PDF page, DOCX/table, PPTX slide/hidden, XLSX stored values/hidden, text/CSV/source, scanned/encrypted/corrupt/oversize/ZIP and permission/copyright skip');
  await page.locator('.ae-content-panel').evaluate(p=>p.scrollTop=0);await page.screenshot({path:path.join(out,'index-selection.png')});await page.setViewportSize({width:390,height:844});assert(await palette.evaluate(e=>e.getBoundingClientRect().right<=innerWidth));await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Back to search',exact:true}).click();await page.getByRole('button',{name:'Contents',exact:true}).click();await query.fill('vector clocks');assert(await page.locator('.ae-spot-snippet mark').count());assert.match(await page.locator('.ae-spot-snippet').first().innerText(),/vector clocks/i);assert.equal(await page.locator('.ae-spot-option .ae-spot-result-title').count(),new Set(await page.locator('.ae-spot-option .ae-spot-result-title').allTextContents()).size);
  const first=await query.getAttribute('aria-activedescendant');await page.keyboard.press('ArrowDown');assert.notEqual(await query.getAttribute('aria-activedescendant'),first);await page.keyboard.press('ArrowUp');
  await page.screenshot({path:path.join(out,'content-original.png')});await isolated("AetherTheme.set('monochrome')");await page.screenshot({path:path.join(out,'content-monochrome.png')});assert.equal(await page.getAttribute('html','data-aether-theme'),'monochrome');
  const before=requests.length;await query.fill('Azure Blob Storage');await query.fill('vector clocks');assert.equal(requests.length,before,'Query caused network access');
  await page.getByRole('button',{name:'Index document contents',exact:true}).click();await page.getByRole('button',{name:'Handle notice in preview',exact:true}).click();await page.getByRole('button',{name:'Yes, accept and preview',exact:true}).click();await page.getByText('Consented fictional copyright concept',{exact:false}).waitFor();
  for(let i=0;i<50&&(await search('Consented fictional')).length===0;i++)await page.waitForTimeout(60);assert.equal((await search('Consented fictional')).length,1);assert(accepted);
  await page.keyboard.press('Escape');
  console.log('PASS safe snippets, one result/document, keyboard, both themes, no query traffic and explicit existing preview consent');
  // Hover after opt-in must not index. A deliberate preview reuses the same fetched bytes.
  await page.goto(route('Resources'));await page.locator('.ae-record-card').first().waitFor();await isolated('AetherSpotlightContent.optIn()');
  const notes=page.locator('.ae-record-card').filter({has:page.locator('a', {hasText:/^notes.txt$/})});await notes.locator('[data-ae-primary="true"] a').first().hover();await page.getByText('Vector clocks explain the causal order.',{exact:false}).waitFor();assert.equal((await snap()).documents,0);
  const reads=requests.filter(r=>r.url===url('notes.txt')).length;await notes.locator('[data-ae-preview-open]').click();for(let i=0;i<50&&(await snap()).documents===0;i++)await page.waitForTimeout(60);assert.equal((await snap()).documents,1);assert.equal(requests.filter(r=>r.url===url('notes.txt')).length,reads);
  await page.keyboard.press('Escape');
  const metadata=await isolated("({id:'/group/cs200/slow.txt',url:location.origin+'/access/content/group/cs200/slow.txt',title:'slow.txt',scope:AetherAcademicStore.snapshot().scope})");
  slow=true;const pending=page.waitForRequest(url('slow.txt'));await isolated(`AetherSpotlightContent.start([${JSON.stringify(metadata)}])`);await pending;await isolated('AetherSpotlightContent.cancel()');await page.waitForTimeout(100);assert((await snap()).report.some(r=>r.status==='Cancelled'));assert.equal((await search('cancelled fixture')).length,0);
  assert(await isolated("new Promise(resolve=>chrome.storage.local.get(null,v=>resolve(!/causal relationships|Vector clocks explain|Consented fictional/.test(JSON.stringify(v)))))"));assert.equal(await page.evaluate(()=>indexedDB.databases().then(d=>d.length)),0);
  await page.locator('#aether-native-toggle').click();assert.equal((await snap()).documents,0);assert.equal((await snap()).opted,false);await page.locator('#aether-native-toggle').click();await page.locator('#aether-spotlight-trigger').waitFor();
  await isolated('AetherSpotlightContent.optIn()');user='fictional-content-B';await isolated('AetherFileState.session()');assert.equal((await snap()).documents,0);assert.equal((await snap()).opted,false);
  assert(!requests.some(r=>new URL(r.url).origin!==origin));assert(!requests.some(r=>r.method!=='GET'));assert.equal(await page.evaluate(()=>window.contentInjected),undefined);assert.deepEqual(errors,[]);
  console.log('PASS no hover indexing, byte reuse on explicit preview, cancellation, OFF/account clearing, no durable text/external requests or active text execution');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
