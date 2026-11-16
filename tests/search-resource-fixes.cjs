/* User regressions only: filename discovery, published grades and extension-preserving ZIPs. */
const {chromium}=require('playwright'),JSZip=require('jszip'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.env.AETHER_EXTENSION||path.resolve(__dirname,'..'),{fixture,pdf,origin}=require(path.join(root,'tests/fixtures.cjs'));
const box={TextEncoder,Blob,WritableStream,ReadableStream,DOMException,URL,AbortController};vm.runInNewContext(fs.readFileSync(path.join(root,'src/download-archive.js'),'utf8'),box);const A=box.AetherDownloadArchive;
const nodes=[{id:'/group/chain/',parent:null,type:'folder',name:'Blockchain'},{id:'/group/chain/a.pdf',parent:'/group/chain/',name:'Quiz 3 solution',type:'file'},{id:'/group/chain/b',parent:'/group/chain/',name:'Notes',type:'file',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},{id:'/group/chain/c',parent:'/group/chain/',name:'notes.docx',type:'file'},{id:'/group/chain/d',parent:'/group/chain/',name:'Lecture v1.0',type:'file'}];
const tree={nodes:new Map(nodes.map(n=>[n.id,n]))},mapping=A.paths(tree,nodes.slice(1));
assert.equal(mapping.get(nodes[1].id),'Blockchain/Quiz 3 solution.pdf');assert.equal(mapping.get(nodes[2].id),'Blockchain/Notes.docx');assert.equal(mapping.get(nodes[3].id),'Blockchain/notes (2).docx');assert.equal(mapping.file(nodes[4],{disposition:"attachment; filename*=UTF-8''lecture%20one.pdf"}),'Blockchain/Lecture v1.0.pdf');
assert.equal(A.fileName({...nodes[4],name:'Already.PDF'},{mime:'text/plain'}),'Already.PDF');assert.equal(A.fileName(nodes[4],{mime:'application/octet-stream',detectedExtension:'pdf'}),'Lecture v1.0.pdf');
assert.equal(A.fileName({...nodes[4],name:'Archive.7z'}),'Archive.7z');
if(process.argv.includes('--names-only')){console.log('PASS extension/collision regression checks');process.exit(0);}
const bytes=pdf(),zipEngine=require(path.join(root,'vendor/zip/zip-core.min.js'));zipEngine.configure({useWebWorkers:false});
const courses=[{id:'cs200',title:'CS200 Fictional Systems',type:'course'},{id:'math101',title:'Fictional Maths',type:'course'},{id:'ss100',title:'Fictional Writing',type:'course'},...Array.from({length:6},(_,i)=>({id:'extra'+i,title:'Fictional course '+i,type:'course'})),{id:'chain',title:'Blockchain',type:'course'}];
const chainRoot='/group/chain/',folders=['Resources','Assessments','2026','Quizzes','Solutions'];let parent=chainRoot;const listings=new Map(courses.map(c=>['/group/'+c.id+'/',[]]));
for(const name of folders){const id=parent+name+'/';listings.set(parent,[{resourceId:id,title:name}]);listings.set(id,[]);parent=id;}
const resourceId=parent+'quiz-3.pdf';listings.set(parent,[{resourceId:resourceId,title:'Quiz 3 solution',mimeType:'application/pdf'}]);
const requests=[],errors=[];let user='fictional-A';
function html(u){
 const sid=u.pathname.match(/\/site\/([^/]+)/)?.[1]||'cs200',copy=new URL(u.href);if(copy.searchParams.get('tool')==='Gradebook')copy.searchParams.set('tool','Gradebook student');
 let value=fixture(copy.href);if(sid!=='home')value=value.replaceAll('/portal/site/cs200','/portal/site/'+sid);
 if(u.searchParams.get('tool')==='Gradebook'){
  value=value.replace('Problem set 1','Quiz 3 grade item').replace('<tr class="gb-summary-grade-row" id="grade-item-1">','<tr hidden class="gb-summary-grade-row" id="grade-item-1">').replace('Problem set 2','HIDDEN GRADE SECRET');
  if(sid==='chain'){const body=value.match(/<div class="Mrphs-sakai-gradebookng">[\s\S]*?<\/table><\/div><\/div>/)[0];return value.replace(body,`<iframe class="portletMainIframe" src="${origin}/tool/chain-gradebook"></iframe>`);}
 }
 return value;
}
(async()=>{
 const archive=await A.create(null,new AbortController().signal,zipEngine);await archive.add(mapping.get(nodes[1].id),new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));const zipped=await JSZip.loadAsync(await (await archive.finish()).blob.arrayBuffer());assert.deepEqual(await zipped.file('Blockchain/Quiz 3 solution.pdf').async('nodebuffer'),bytes);console.log('PASS ZIP URL/MIME/response filename/PDF-signature extension recovery, existing extensions, collisions and byte-exact PDF extraction');
 const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-search-fix-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
 try{
  await ctx.route('https://**/*',async r=>{
   const u=new URL(r.request().url());requests.push(u.href);assert.equal(r.request().method(),'GET');if(u.origin!==origin)return r.abort();
   if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:user}});
   if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:courses}});
   if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[]}});
   if(u.pathname.startsWith('/direct/announcement/'))return r.fulfill({json:{announcement_collection:[]}});
   if(u.pathname.startsWith('/direct/content/resources/')){const id=decodeURIComponent(u.pathname.slice('/direct/content/resources'.length).replace(/\.json$/,''))+'/';return r.fulfill({json:{content_collection:[{resourceId:id,resourceChildren:listings.get(id)||[]}]}});}
   if(u.pathname==='/tool/chain-gradebook'){let value=fixture(origin+'/tool/gradebook');value=value.replace('Problem set 1','Quiz 3 grade item').replace('<tr class="gb-summary-grade-row" id="grade-item-1">','<tr hidden class="gb-summary-grade-row" id="grade-item-1">').replace('Problem set 2','HIDDEN GRADE SECRET');return r.fulfill({contentType:'text/html',body:value});}
   if(u.pathname.startsWith('/access/content/'))return r.fulfill({contentType:'application/pdf',body:bytes});
   if(/^\/+portal/.test(u.pathname))return r.fulfill({contentType:'text/html',body:html(u)});
   return r.fulfill({status:404});
  });
  const page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const isolated=async expression=>{const cdp=await ctx.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');const main=(await cdp.send('Page.getFrameTree')).frameTree.frame.id;try{for(const w of worlds){if(w.auxData?.frameId!==main)continue;const p=await cdp.send('Runtime.evaluate',{contextId:w.id,expression:'typeof AetherSpotlight!=="undefined"',returnByValue:true});if(p.result.value){const result=await cdp.send('Runtime.evaluate',{contextId:w.id,expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}}throw Error('Missing extension world');}finally{await cdp.detach();}};
  await page.goto(origin+'//portal/site/home');await page.locator('#aether-spotlight-trigger').waitFor();await page.getByRole('button',{name:'Open Aether Spotlight',exact:true}).click();
  const query=page.locator('#ae-spot-input'),palette=page.locator('#aether-spotlight');await query.fill('quiz');
  await palette.getByText('Quiz 3 solution',{exact:true}).waitFor();await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});
  assert.equal(requests.filter(u=>u.includes('/access/content/')).length,0,'Automatic filename discovery fetched file contents');
  assert(requests.filter(u=>u.includes('/direct/content/resources/')).length<=32);assert(await page.locator('.ae-spot-option').filter({hasText:'Quiz 3 solution'}).count());
  await page.getByRole('combobox',{name:'Search course',exact:true}).selectOption('chain');await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Gradebook',exact:true}).click();
  assert.equal(await page.locator('.ae-spot-result-title').count(),1);assert.equal(await page.locator('.ae-spot-result-title').innerText(),'Quiz 3 grade item');assert.match(await page.locator('.ae-spot-native').getAttribute('href'),/\/portal\/site\/chain\/page\/Gradebook/);
  await query.fill('HIDDEN GRADE SECRET');assert.equal(await page.locator('.ae-spot-option').count(),0);await query.fill('Final reflection');assert.equal(await page.locator('.ae-spot-option').count(),0,'Unreleased grades indexed');
  await page.getByRole('button',{name:'Files',exact:true}).click();await query.fill('quiz');assert.equal(await page.locator('.ae-spot-result-title').innerText(),'Quiz 3 solution');
  const count=requests.length;for(const q of ['quiz','quiz 3','quiz 3 solution'])await query.fill(q);assert.equal(requests.length,count,'Query caused requests after source discovery completed');
  const out=process.env.AETHER_REPORT_DIR;if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'quiz-resource-search.png')});}
  console.log('PASS automatic nested filename search beyond eight courses, explicit Blockchain scope, published gradebook iframe results, hidden/unreleased exclusion, double-slash portal and no content/query fetches');
  // Use the actual controller/export path on the shared discovered tree.
  await page.keyboard.press('Escape');await isolated(`(async()=>{const c=AetherDownloads.get();c.tree.set(${JSON.stringify(resourceId)},true);await c.prepare();c.smallAvailable=true;AetherDownloadUI.open(document);c.emit();})()`);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download small ZIP (64 MiB)',exact:true}).click();const file=await download,contents=await JSZip.loadAsync(fs.readFileSync(await file.path())),names=Object.keys(contents.files).filter(n=>!contents.files[n].dir);
  assert.equal(names.length,1);assert(names[0].endsWith('/Quiz 3 solution.pdf'));assert.deepEqual(await contents.file(names[0]).async('nodebuffer'),bytes);
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.locator('#aether-native-toggle').click();await page.locator('#aether-native-toggle').click();await page.locator('#aether-spotlight-trigger').waitFor();user='fictional-B';await isolated('AetherFileState.session()');
  await page.locator('#aether-spotlight-trigger').click();await page.locator('#ae-spot-input').fill('quiz');assert.equal(await page.locator('.ae-spot-option').filter({hasText:'Quiz 3 grade item'}).count(),0);assert.match(await page.locator('.ae-spot-status').innerText(),/Session changed/);
  assert(!requests.some(u=>new URL(u).origin!==origin));assert.deepEqual(errors,[]);console.log('PASS actual mass-download ZIP preserves PDF extension and bytes; OFF/account clearing and no external or academic writes');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
