/* Real-extension session-cache smoke; all LMS data and requests are fictional/intercepted. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=process.env.AETHER_EXTENSION||path.resolve(__dirname,'..'),{fixture,origin}=require(path.join(root,'tests/fixtures.cjs'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aether-session-')),reads=new Map(),errors=[];let user='fictional-A',version='2026-10-29T00:00:00Z',hidden=false;
const key='aether:v182:content-session',id=name=>'/group/cs200/'+name;
async function launch(){
 const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await ctx.route('https://**/*',async r=>{
  const u=new URL(r.request().url());assert.equal(u.origin,origin,'Unexpected external request');assert.equal(r.request().method(),'GET');
  if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:user}});
  if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:[{id:'cs200',title:'Fictional Systems',type:'course'}]}});
  if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[]}});
  if(u.pathname.startsWith('/direct/announcement/'))return r.fulfill({json:{announcement_collection:[]}});
  if(u.pathname.startsWith('/direct/content/resources/')){const parent=decodeURIComponent(u.pathname.slice('/direct/content/resources'.length).replace(/\.json$/,''))+'/';return r.fulfill({json:{content_collection:[{resourceId:parent,resourceChildren:parent==='/group/cs200/'?['notes.txt','change.txt','denied.txt'].map(name=>({resourceId:id(name),title:name,mimeType:'text/plain',modified:name==='change.txt'?version:'2026-10-29T00:00:00Z',hidden:name==='denied.txt'&&hidden})):[]}]}});}
  if(u.pathname.startsWith('/access/content/')){const name=decodeURIComponent(u.pathname.split('/').pop());reads.set(name,(reads.get(name)||0)+1);return r.fulfill({contentType:'text/plain',body:name==='notes.txt'?'Vector clocks cached fictional paragraph':name==='change.txt'?(version.endsWith('00Z')?'Obsolete fictional concept':'Updated fictional concept'):'Private revoked fictional paragraph'});}
  if(u.pathname.startsWith('/portal')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:fixture(u.href)});
  return r.fulfill({status:404});
 });return ctx;
}
async function isolated(ctx,page,expression){
 const cdp=await ctx.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');const main=(await cdp.send('Page.getFrameTree')).frameTree.frame.id;
 try{for(const w of worlds){if(w.auxData?.frameId!==main)continue;const p=await cdp.send('Runtime.evaluate',{contextId:w.id,expression:'typeof AetherSpotlightContent!=="undefined"',returnByValue:true});if(p.result.value){const r=await cdp.send('Runtime.evaluate',{contextId:w.id,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}}throw Error('Missing content world');}finally{await cdp.detach();}
}
const poll=async(fn,test,label)=>{let last;for(let i=0;i<100;i++){const value=await fn();last=value;if(test(value))return value;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Timed out: '+label+' '+JSON.stringify(last));};
async function visit(ctx){const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/portal/site/home');await page.locator('#aether-spotlight-trigger').waitFor();await isolated(ctx,page,'AetherSpotlightContent.restore()');return page;}
async function open(page){await page.locator('#aether-spotlight-trigger').click();await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});}
(async()=>{
 let ctx=await launch();try{
  let page=await visit(ctx);const run=expression=>isolated(ctx,page,expression),snap=()=>run('AetherSpotlightContent.snapshot()'),query=q=>run(`AetherSpotlightContent.query(${JSON.stringify(q)})`);
  await open(page);await page.getByRole('button',{name:'Index document contents',exact:true}).click();await page.getByRole('button',{name:'Select up to 100 supported files',exact:true}).click();await page.getByRole('button',{name:'Start indexing',exact:true}).click();
  await poll(snap,s=>!s.busy&&s.documents===3&&s.cached===3,'initial cache save');await run('AetherSpotlightContent.optIn()');assert.equal(reads.get('notes.txt'),1);assert.equal((await query('vector clocks')).length,1);
  const localClean=await run("new Promise(resolve=>chrome.storage.local.get(null,v=>resolve(!/Vector clocks cached|Obsolete fictional|Private revoked/.test(JSON.stringify(v)))))");assert(localClean);assert.equal(await page.evaluate(()=>indexedDB.databases().then(d=>d.length)),0);
  assert(await run("chrome.storage.session.get('aether:v182:content-session').then(()=>false,()=>true)"),'Content scripts can read trusted session storage directly');
  await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');await poll(snap,s=>s.documents===3&&!s.restoring,'reload restore');assert.equal((await query('vector clocks')).length,1);assert.equal(reads.get('notes.txt'),1);assert((await snap()).opted);
  console.log('PASS reload restores cached text/locations and opt-in without fetching documents; no local/IndexedDB text and session storage stays trusted-only');
  version='2026-10-29T00:00:01Z';hidden=true;await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');await poll(snap,s=>s.documents===1&&!s.restoring,'changed/revoked filtering');assert.equal((await query('Obsolete fictional')).length,0);assert.equal((await query('Private revoked')).length,0);assert.equal(reads.get('change.txt'),1);
  await open(page);await page.getByRole('button',{name:'Index document contents',exact:true}).click();await page.getByRole('button',{name:'Select up to 100 supported files',exact:true}).click();await page.getByRole('button',{name:'Start indexing',exact:true}).click();await poll(snap,s=>!s.busy&&s.documents===2,'incremental update');assert.equal(reads.get('notes.txt'),1);assert.equal(reads.get('change.txt'),2);assert((await snap()).report.some(r=>r.status==='Reused session index'));assert.equal((await query('Updated fictional')).length,1);
  console.log('PASS modified and newly hidden resources are excluded before display; indexing reuses unchanged text and fetches only changed selected documents');
  let other=await visit(ctx);await poll(()=>isolated(ctx,other,'AetherSpotlightContent.snapshot()'),s=>s.documents===2&&!s.restoring,'second-tab restore');await page.close();await other.close();page=await visit(ctx);await poll(snap,s=>s.documents===2&&!s.restoring,'reopened-tab restore');assert.equal(reads.get('notes.txt'),1);
  other=await visit(ctx);await run('AetherSpotlightContent.clear()');await poll(()=>isolated(ctx,other,'AetherSpotlightContent.snapshot()'),s=>s.documents===0,'cross-tab clear');await other.close();await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');assert.equal((await snap()).documents,0);
  console.log('PASS closing/reopening LMS tabs preserves Chrome-session cache; Clear indexed contents propagates across tabs and survives reload');
  const indexOne=async()=>{await run("(async()=>{await AetherSpotlightContent.restore();const scope=AetherAcademicStore.snapshot().scope;await AetherSpotlightContent.start([{id:'/group/cs200/notes.txt',url:location.origin+'/access/content/group/cs200/notes.txt',title:'notes.txt',scope,version:'2026-10-29T00:00:00Z'}]);})()");await poll(snap,s=>!s.busy&&s.documents===1&&s.cached===1,'single document cache');};
  await indexOne();await page.locator('#aether-native-toggle').click();await poll(snap,s=>s.documents===0,'OFF clear');await page.locator('#aether-native-toggle').click();await page.locator('#aether-spotlight-trigger').waitFor();await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');assert.equal((await snap()).documents,0);
  await indexOne();user='.anon';await run('AetherFileState.session()');await poll(snap,s=>s.documents===0,'logout clear');user='fictional-B';await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');assert.equal((await query('vector clocks')).length,0);
  await indexOne();user='fictional-C';await run('AetherFileState.session()');assert.equal((await snap()).documents,0);assert.equal((await snap()).opted,false);
  user='fictional-B';await page.reload();await page.locator('#aether-spotlight-trigger').waitFor();await run('AetherSpotlightContent.restore()');assert.equal((await snap()).documents,0);await indexOne();
  assert.deepEqual(errors,[]);console.log('PASS Aether OFF, anonymous logout and account switches purge cached content; no old-account restoration');
  await ctx.close();ctx=await launch();page=await visit(ctx);assert.equal((await snap()).documents,0);console.log('PASS closing/restarting Chrome with the same profile starts with an empty content session cache');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
