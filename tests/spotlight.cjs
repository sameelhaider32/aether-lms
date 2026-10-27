/* Short Spotlight smoke: real unpacked extension; fictional intercepted GET traffic only. */
const {chromium}=require('playwright'),{fixture,origin,route}=require('./fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..')),out=path.resolve(process.env.AETHER_REPORT_DIR||path.join(root,'reports/spotlight'));fs.mkdirSync(out,{recursive:true});
const box={};vm.runInNewContext(fs.readFileSync(path.join(root,'src/spotlight-search.js'),'utf8'),box);const S=box.AetherSpotlightSearch;
const nativeTitle=S.compile({key:'native',type:'tool',title:'Resources',course:'2601 SSE Distributed Systems: (CS 582 S1-Lecture)'});assert.equal(S.rank([nativeTitle],'DS resources').length,1);assert.equal(S.rank([nativeTitle],'CS582 resources').length,1);
assert.equal(S.rank([S.compile({key:'cfc',type:'tool',title:'Assignments',course:'Coding for Careers'})],'CFC assignments').length,1);
const ranked=S.rank([{key:'one',type:'tool',title:'Resources',course:'CS582 Distributed Systems',siteId:'ds'},{key:'two',type:'tool',title:'Resources',course:'Cloud Development',siteId:'cloud'}].map(S.compile),'ds resources','all','cloud');assert.equal(ranked[0].siteId,'ds');assert(S.rank([{key:'typo',type:'tool',title:'Resources'}].map(S.compile),'resorces').length);console.log('PASS partial/code/acronym/context ranking and limited typo matching');
if(process.argv.includes('--ranking-only'))process.exit(0);
let user='fictional-A',slowResources=false;const requests=[],errors=[];
const titles={cs200:'CS582 Distributed Systems',math101:'CS487 Cloud Development',ss100:'CS100 Coding for Careers'};
const iso=n=>new Date(Date.now()+n*86400000).toISOString();
function pageFor(u){
 let html=fixture(u.href),sid=u.pathname.match(/\/portal\/site\/([^/]+)/)?.[1]||'cs200';
 html=html.replaceAll('CS200 Introduction to Programming',titles.cs200).replaceAll('MATH101 Calculus I',titles.math101).replaceAll('SS100 Writing & Communication',titles.ss100);
 html=html.replace(/<li data-type="(?:pinned|home)" class="site-list-item[\s\S]*?<\/ul><\/li>/g,block=>{const id=block.match(/class="sidebar-site-title" href="[^\"]*\/portal\/site\/([^/\"]+)/)?.[1];return id?block.replaceAll('/portal/site/cs200/page/','/portal/site/'+id+'/page/'):block;});
 if(sid!=='home')html=html.replace(/class="site-list-item is-current-site"/g,'class="site-list-item "').replace(new RegExp(`class="site-list-item "(><a class="sidebar-site-title" href="${origin}/portal/site/${sid}")`),'class="site-list-item is-current-site"$1');
 if(u.searchParams.get('tool')==='Assignments'){
  const table=`<div class="Mrphs-sakai-assignment-grades"><table id="assignments"><thead><tr><th>Assignment title</th><th>Status</th><th>Due date</th><th>Open date</th></tr></thead><tbody>${[['pa3','PA3 Consensus · '+titles[sid],sid==='math101'?'Submitted':'Draft',-1],['future','UNRELEASED SECRET','Not submitted',3],['hidden','HIDDEN SECRET','Not submitted',-1]].map(([id,title,status,open])=>`<tr ${id==='hidden'?'hidden':''}><td><a href="${origin}/portal/site/${sid}/page/item?id=${id}">${title}</a></td><td>${status}</td><td><time datetime="${iso(2)}">Due</time></td><td><time datetime="${iso(open)}">Open</time></td></tr>`).join('')}</tbody></table></div>`;
  html=html.replace(/<div class="Mrphs-sakai-assignment-grades">[\s\S]*?<\/table><\/div>/,table);
 }
 if(u.pathname.startsWith('/tool/'))html=html.replace('</body>','<button id="frame-key-trigger">Frame navigation</button></body>');return html;
}
(async()=>{
 const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-spotlight-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 try{
  await ctx.route('https://**/*',async r=>{
   const req=r.request(),u=new URL(req.url());requests.push({path:u.pathname,method:req.method()});assert.equal(req.method(),'GET');if(u.origin!==origin)return r.abort();
   if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:user}});
   if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:Object.entries(titles).map(([id,title])=>({id,title,type:'course'}))}});
   if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[{siteId:'cs200',siteName:titles.cs200,eventId:'seminar',title:'Consensus seminar',type:'Lecture',firstTime:{time:Date.now()+86400000}}]}});
   if(u.pathname.startsWith('/direct/announcement/')){const id=u.pathname.split('/')[4].replace('.json','');return r.fulfill({json:{announcement_collection:[{siteId:id,announcementId:'notice',title:(user==='fictional-A'?'A-only':'B-only')+' Maintenance notice',createdOn:iso(-1)}]}});}
   if(u.pathname.startsWith('/direct/content/resources/')){
    if(slowResources)await new Promise(resolve=>setTimeout(resolve,600));
    const id=decodeURIComponent(u.pathname.slice('/direct/content/resources'.length).replace(/\.json$/,''))+'/',nested=id.includes('/Week 01/');
    return r.fulfill({json:{content_collection:[{resourceId:id,resourceChildren:nested?[{resourceId:id+'nested-notes.txt',title:'Nested consensus notes.txt'}]:[{resourceId:id+'consensus-notes.txt',title:'Consensus notes.txt',mimeType:'text/plain'},{resourceId:id+'Week 01/',title:'Week 01'},{resourceId:id+'secret.txt',title:'HIDDEN RESOURCE SECRET',hidden:true}]}]}}).catch(()=>{});
   }
   if(u.pathname.startsWith('/access/content/'))return r.fulfill({contentType:'text/plain',body:'Fictional preview content only.'});
   if(u.pathname.startsWith('/portal')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:pageFor(u)});
   return r.fulfill({status:404,body:'Unsupported fixture'});
  });
  const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const palette=page.locator('#aether-spotlight'),query=page.locator('#ae-spot-input');
  const open=async()=>{await page.locator('#aether-spotlight-trigger').click();await palette.waitFor();assert(await query.evaluate(e=>e===document.activeElement));};
  const close=async()=>{await page.keyboard.press('Escape');await palette.waitFor({state:'detached'});};
  const isolated=async expression=>{const cdp=await ctx.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');try{for(const w of worlds){const p=await cdp.send('Runtime.evaluate',{contextId:w.id,expression:'typeof AetherSpotlight!=="undefined"',returnByValue:true});if(p.result.value){const r=await cdp.send('Runtime.evaluate',{contextId:w.id,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}}throw Error('Spotlight isolated world unavailable');}finally{await cdp.detach();}};
  await page.goto(origin+'/portal/site/home');await page.locator('#aether-spotlight-trigger').waitFor();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.mc-next-list')?.textContent.includes('PA3 Consensus'));
  await open();await query.fill('DS resources');await page.waitForFunction(()=>document.querySelector('.ae-spot-option .ae-spot-result-title')?.textContent==='Resources');
  assert.match(await page.locator('.ae-spot-option').first().innerText(),/Distributed Systems/);assert.equal(await page.locator('.ae-spot-native').getAttribute('href'),origin+'/portal/site/cs200/page/Resources?tool=Resources');
  const before=requests.length;for(const word of ['cloud','CS487','resorces','PA3','consensus','> motion'])await query.fill(word);assert.equal(requests.length,before,'Typing triggered a request');
  await query.fill('PA3');assert.equal(await page.locator('.ae-spot-option').count(),3);assert.equal(await palette.getByText(/SECRET/).count(),0);assert.match(await page.locator('.ae-spot-option').first().innerText(),/Draft saved|Submitted/);assert(await palette.locator('mark').count());
  const first=await query.getAttribute('aria-activedescendant');await page.keyboard.press('ArrowDown');assert.notEqual(await query.getAttribute('aria-activedescendant'),first);await page.keyboard.press('ArrowUp');assert.equal(await query.getAttribute('aria-activedescendant'),first);
  await page.screenshot({path:path.join(out,'spotlight-original.png')});await close();assert.equal(await page.evaluate(()=>document.activeElement.id),'aether-spotlight-trigger');
  console.log('PASS real indexed courses/tools/assignments, ranking, native hrefs, highlights, arrow keys, no query requests and focus restoration');
  await page.keyboard.press('Alt+Shift+k');await palette.waitFor();await palette.getByRole('button',{name:'Files',exact:true}).click();await query.fill('> monochrome');await page.keyboard.press('Enter');await palette.waitFor({state:'detached'});assert.equal(await page.getAttribute('html','data-aether-theme'),'monochrome');
  await open();await query.fill('Consensus');await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await palette.evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
  const colors=await palette.evaluate(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundImage,s.borderTopColor]});assert(colors.every(s=>[...s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].every(m=>m[1]===m[2]&&m[2]===m[3])));
  await page.screenshot({path:path.join(out,'spotlight-monochrome-mobile.png')});await page.mouse.click(2,2);await palette.waitFor({state:'detached'});await page.setViewportSize({width:1440,height:1000});
  await open();const priorAcademic=requests.filter(r=>/\/direct\/(?:site|calendar|announcement)/.test(r.path)).length;await page.getByRole('button',{name:'Check academic sources',exact:true}).click();await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});assert.equal(requests.filter(r=>/\/direct\/(?:site|calendar|announcement)/.test(r.path)).length,priorAcademic,'Duplicated completed Mission Control discovery');
  assert(!requests.some(r=>r.path.startsWith('/direct/content/')));assert(!requests.some(r=>r.path.startsWith('/access/content/')));
  await page.getByRole('button',{name:'Search more available resources',exact:true}).click();await page.getByRole('button',{name:'Cancel discovery',exact:true}).waitFor({state:'hidden'});
  assert(requests.filter(r=>r.path.startsWith('/direct/content/')).length<=12);assert(!requests.some(r=>r.path.startsWith('/access/content/')));
  await query.fill('Consensus notes.txt');assert(await page.locator('.ae-spot-option').count());assert.equal(await palette.getByText(/HIDDEN RESOURCE SECRET/).count(),0);
  await palette.getByRole('button',{name:'Preview',exact:true}).click();await page.getByText('Fictional preview content only.',{exact:false}).waitFor();assert.equal(requests.filter(r=>r.path.startsWith('/access/content/')).length,1);await page.keyboard.press('Escape');
  console.log('PASS both themes, narrow viewport, click-away, shared academic cache, bounded explicit resource metadata and safe existing preview pipeline');
  assert(await isolated('new Promise(resolve=>chrome.storage.local.get(null,values=>resolve(!/Consensus|Maintenance|Coding for Careers/.test(JSON.stringify(values)))))'),'Private search metadata reached durable storage');
  await page.goto(route('Overview'));await page.locator('#aether-spotlight-trigger').waitFor();await open();await query.fill('DS resources');await page.locator('.ae-spot-option').first().waitFor();await page.keyboard.press('Enter');await page.waitForURL(route('Resources'));await page.locator('.ae-record-card').first().waitFor();
  await open();slowResources=true;const pendingResource=page.waitForRequest(r=>r.url().includes('/direct/content/resources/'));await page.getByRole('button',{name:'Search more available resources',exact:true}).click();await pendingResource;await page.getByRole('button',{name:'Cancel discovery',exact:true}).click();assert(await page.getByRole('button',{name:'Cancel discovery',exact:true}).isHidden());await query.fill('notes.txt');assert(await page.locator('.ae-spot-option').count());await close();slowResources=false;
  console.log('PASS Enter follows the original native tool link, explicit discovery cancellation and no private search persistence');
  await page.goto(route('Frame'));const frame=page.frameLocator('iframe[title="Resources tool frame"]');await frame.locator('.ae-record-card').first().waitFor();await frame.locator('#frame-key-trigger').focus();await page.keyboard.press('Alt+Shift+k');await palette.waitFor();assert.equal(await page.locator('#aether-spotlight').count(),1);assert.equal(await frame.locator('#aether-spotlight').count(),0);await close();assert(await frame.locator('#frame-key-trigger').evaluate(e=>document.activeElement===e));
  await page.goto(route('Assignment detail'));await page.locator('#answer').fill('Fixture answer unchanged');await page.keyboard.press('Alt+Shift+k');assert.equal(await palette.count(),0);assert.equal(await page.locator('#answer').inputValue(),'Fixture answer unchanged');
  await page.goto(route('Tests & Quizzes'));await page.locator('#aether-spotlight-trigger').waitFor();await page.locator('body').click({position:{x:1,y:1}});await page.keyboard.press('Alt+Shift+k');assert.equal(await palette.count(),0);
  await page.goto(origin+'/portal/site/home');await page.locator('#aether-spotlight-trigger').waitFor();await open();await page.locator('#aether-native-toggle').evaluate(b=>b.click());assert.equal(await palette.count(),0);assert.equal(await page.locator('#aether-spotlight-trigger').count(),0);await page.locator('#aether-native-toggle').click();await page.locator('#aether-spotlight-trigger').waitFor();
  console.log('PASS one top-level overlay from tool frames, iframe focus return, form/assessment shortcut protection and Aether OFF removal');
  await page.evaluate(()=>{const old=document.querySelector('.portal-header'),fresh=old.cloneNode(true);fresh.querySelectorAll('#aether-native-toggle,#aether-theme-control,#aether-spotlight-trigger').forEach(n=>n.remove());old.replaceWith(fresh);});await page.locator('#aether-spotlight-trigger').waitFor();assert.equal(await page.locator('#aether-spotlight-trigger').count(),1);
  await open();await query.fill('PA3');await page.waitForFunction(()=>document.querySelectorAll('.ae-spot-option').length===3);
  slowResources=true;const accountRequest=page.waitForRequest(r=>r.url().includes('/direct/content/resources/'));await page.getByRole('button',{name:'Search more available resources',exact:true}).click();await accountRequest;user='fictional-B';await isolated('AetherFileState.session()');await palette.waitFor({state:'detached'});await open();await query.fill('PA3');assert.equal(await page.locator('.ae-spot-option').count(),0);assert.match(await page.locator('.ae-spot-status').innerText(),/Session changed/);await query.fill('Maintenance');assert.equal(await page.locator('.ae-spot-option').count(),0);
  assert(await page.getByRole('button',{name:'Search more available resources',exact:true}).isDisabled());
  await close();slowResources=false;await page.getByRole('button',{name:'Refresh academic sources',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#aether-mission-control')?.textContent.includes('B-only Maintenance notice'));await open();await query.fill('B-only');assert.equal(await page.locator('.ae-spot-option').count(),0);
  assert(!requests.some(r=>/\/assignment\/|\/access\/accept/.test(r.path)));assert.deepEqual(errors,[]);
  console.log('PASS account-change cancellation and private-index clearing; no old-account results or academic operations');
 }finally{await ctx.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
