/* Integration regressions run against the actual unpacked extension. */
const {origin}=require('./fixtures.cjs');
module.exports=async({page,context,test,go,preview,assert})=>{
 const panel=page.locator('#aether-resource-preview'),close=()=>panel.getByRole('button',{name:'Close resource preview',exact:true}).click();
 await test('Reliability: unrelated widgets do not rescan resource lists',async()=>{
  await go('Resources');const cdp=await context.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');
  let world;for(const candidate of worlds){const result=await cdp.send('Runtime.evaluate',{contextId:candidate.id,expression:'typeof AetherResourceInfo!=="undefined"&&typeof AetherFileState!=="undefined"',returnByValue:true});if(result.result.value){world=candidate.id;break;}}assert(world,'extension content world');
  await page.waitForTimeout(200);await cdp.send('Runtime.evaluate',{contextId:world,expression:'globalThis.fixtureScans=0;globalThis.fixtureQuery=document.querySelectorAll;document.querySelectorAll=function(...args){fixtureScans++;return fixtureQuery.apply(this,args)}'});
  try{await page.evaluate(async()=>{const widget=document.createElement('div');widget.id='fictional-unrelated-clock';document.body.append(widget);await new Promise(requestAnimationFrame);for(let i=0;i<5;i++){widget.textContent='Clock '+i;await new Promise(requestAnimationFrame);}});const result=await cdp.send('Runtime.evaluate',{contextId:world,expression:'fixtureScans',returnByValue:true});assert.equal(result.result.value,0,'Unrelated widget must not trigger full querySelectorAll scans');}
  finally{await cdp.send('Runtime.evaluate',{contextId:world,expression:'document.querySelectorAll=fixtureQuery;delete globalThis.fixtureQuery;delete globalThis.fixtureScans'});await cdp.detach();}
 });
 await test('Reliability: native tool-title transitions still reclassify live tables',async()=>{
  await go('Resources');await page.evaluate(()=>{document.querySelector('.Mrphs-sakai-resources').removeAttribute('class');document.querySelector('.portal-header .header-tool-title').textContent='Assignments';});await page.locator('#resource-0[data-ae-kind="assignment"]').waitFor();await page.locator('#resource-0 .ae-preview-control:not(.ae-attachment-preview-control)').waitFor({state:'detached'});await page.locator('#resource-0 .ae-attachment-preview-control').waitFor();
  await page.evaluate(()=>document.querySelector('.portal-header .header-tool-title').textContent='Resources');await page.locator('#resource-0[data-ae-kind="resource"] .ae-preview-control:not(.ae-attachment-preview-control)').waitFor();assert.equal(await page.locator('#resource-0 [data-ae-preview-open]').count(),1);
 });
 await test('Reliability: rapid PDF switching and OFF discard late reader events',async()=>{
  await go('Resources');for(let i=0;i<12;i++){await page.locator('#resource-'+(i%2)+' [data-ae-preview-open]').click();if(i%3===0)await close();}
  if(await panel.count())await close();await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();
  const frame=page.frames().find(f=>f.url().includes('/preview/pdf.html'));
  await frame.evaluate(()=>{const p=new URLSearchParams(location.hash.slice(1));parent.postMessage({type:'aether-pdf-preview',token:'wrong',state:'close'},p.get('origin'));});assert.equal(await panel.count(),1);
  await page.evaluate(()=>{const frame=document.querySelector('.ae-preview-pdf'),url=new URL(frame.src);window.fictionalOldReader={source:frame.contentWindow,origin:url.origin,token:new URLSearchParams(url.hash.slice(1)).get('token')};});await close();await preview('Lecture 02.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();
  await page.evaluate(()=>{const old=window.fictionalOldReader;for(const state of ['rendered','error','close'])window.dispatchEvent(new MessageEvent('message',{source:old.source,origin:old.origin,data:{type:'aether-pdf-preview',token:old.token,state,page:999,message:'Stale fictional error'}}));delete window.fictionalOldReader;});assert.equal(await panel.getAttribute('data-pdf-page'),'1');assert.equal(await panel.getByRole('button',{name:'Retry preview',exact:true}).count(),0);
  await page.evaluate(()=>document.getElementById('aether-native-toggle').click());await panel.waitFor({state:'detached'});assert.equal(await page.locator('.ae-record-card').count(),0);await page.locator('#aether-native-toggle').click();await page.locator('#resource-0 [data-ae-preview-open]').waitFor();
 });
 await test('Reliability: PDF zoom, fit, resize and navigation settle on a visible page',async()=>{
  await go('Resources');await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();const frame=page.frames().find(f=>f.url().includes('/preview/pdf.html'));
  await frame.evaluate(()=>{for(let i=0;i<12;i++){document.getElementById('zoom-in').click();document.getElementById('zoom-out').click();document.getElementById('fit').value=i%2?'page':'width';document.getElementById('fit').dispatchEvent(new Event('change'));window.dispatchEvent(new Event('resize'));}});
  await frame.locator('#next').click();await page.locator('#aether-resource-preview[data-pdf-page="2"]').waitFor();await frame.locator('#prev').click();await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();assert(await frame.locator('#pages').isVisible());assert((await frame.locator('#page').evaluate(c=>c.width*c.height))>0);await close();
 });
 await test('Reliability: PDF viewer policy blocks inline scripts',async()=>{
  await go('Resources');await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();const frame=page.frames().find(f=>f.url().includes('/preview/pdf.html'));
  const executed=await frame.evaluate(()=>{const script=document.createElement('script');script.textContent='globalThis.fictionalInlineScriptExecuted=true';document.head.append(script);return globalThis.fictionalInlineScriptExecuted===true;});assert.equal(executed,false);await close();
 });
 await test('Reliability: network failure retries only preview GET and retains Open original',async()=>{
  await go('Resources');const url=origin+'/access/content/group/cs200/notes.txt';let reads=0;
  await context.route(url,r=>++reads===1?r.fulfill({status:503,body:'Temporary failure'}):r.fulfill({contentType:'text/plain',body:'Recovered fictional preview'}));
  try{await preview('notes.txt');await panel.getByRole('button',{name:'Retry preview',exact:true}).click();await panel.getByText('Recovered fictional preview',{exact:true}).waitFor();assert.equal(reads,2);assert(await panel.getByRole('button',{name:'Open original',exact:true}).isVisible());await close();}finally{await context.unroute(url);}
 });
 await test('Reliability: retry discards a failed document payload before reading again',async()=>{
  await go('Resources');const url=origin+'/access/content/group/cs200/Lecture%2001.pdf';let reads=0;await context.route(url,r=>r.fulfill({contentType:'application/pdf',body:++reads===1?'%PDF-1.7\nFictional damaged PDF':require('./fixtures.cjs').pdf()}));
  try{await preview('Lecture 01.pdf');await panel.getByRole('button',{name:'Retry preview',exact:true}).click();await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();assert.equal(reads,2);await close();}finally{await context.unroute(url);}
 });
 await test('Reliability: switching authenticated accounts does not share opened indicators',async()=>{
  let account='fictional-account-a';const endpoint=origin+'/direct/session/current.json';await context.route(endpoint,r=>r.fulfill({json:{userId:account}}));
  try{await go('Resources');await preview('notes.txt');await page.locator('#resource-2[data-ae-file-state="opened"]').waitFor();await close();account='fictional-account-b';await page.reload();await page.locator('#resource-2[data-ae-file-state="unopened"]').waitFor();account=null;await page.reload();await page.locator('#resource-2[data-ae-file-state="unavailable"]').waitFor();await preview('notes.txt');await page.locator('.ae-preview-text').waitFor();await close();account='fictional-account-a';await page.reload();await page.locator('#resource-2[data-ae-file-state="opened"]').waitFor();}finally{await context.unroute(endpoint);}
 });
};
