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
 await test('Reliability: rapid PDF switching and OFF discard late reader events',async()=>{
  await go('Resources');for(let i=0;i<12;i++){await page.locator('#resource-'+(i%2)+' [data-ae-preview-open]').click();if(i%3===0)await close();}
  if(await panel.count())await close();await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();
  const frame=page.frames().find(f=>f.url().includes('/preview/pdf.html'));
  await frame.evaluate(()=>{const p=new URLSearchParams(location.hash.slice(1));parent.postMessage({type:'aether-pdf-preview',token:'wrong',state:'close'},p.get('origin'));});assert.equal(await panel.count(),1);
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
 await test('Reliability: switching authenticated accounts does not share opened indicators',async()=>{
  let account='fictional-account-a';const endpoint=origin+'/direct/session/current.json';await context.route(endpoint,r=>r.fulfill({json:{userId:account}}));
  try{await go('Resources');await preview('notes.txt');await page.locator('#resource-2[data-ae-file-state="opened"]').waitFor();await close();account='fictional-account-b';await page.reload();await page.locator('#resource-2[data-ae-file-state="unopened"]').waitFor();account=null;await page.reload();await page.locator('#resource-2[data-ae-file-state="unavailable"]').waitFor();await preview('notes.txt');await page.locator('.ae-preview-text').waitFor();await close();account='fictional-account-a';await page.reload();await page.locator('#resource-2[data-ae-file-state="opened"]').waitFor();}finally{await context.unroute(endpoint);}
 });
};
