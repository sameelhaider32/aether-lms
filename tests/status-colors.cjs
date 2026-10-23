const path=require('node:path');
const {origin}=require('./fixtures.cjs');
module.exports=async({page,context,test,go,preview,reportDir,assert})=>{
 const panel=page.locator('#aether-resource-preview'),notes=page.locator('#resource-2');
 const close=async()=>panel.getByRole('button',{name:'Close resource preview',exact:true}).click();
 const state=async(target,value)=>{await target.locator(`.ae-file-status[data-file-state="${value}"]`).waitFor();};
 const reset=async()=>{await go('Resources');await preview('notes.txt');await page.locator('.ae-preview-text').waitFor();await panel.getByRole('button',{name:'Clear file history',exact:true}).click();await close();await state(notes,'unopened');};
 await test('Status colors: assignment colors preserve submission, deadlines, draft and grading separately',async()=>{
  await page.setViewportSize({width:1440,height:1000});await go('Assignments');
  await page.evaluate(()=>{
   const now=Date.now(),date=hours=>new Date(now+hours*3600000).toISOString();
   const cases=[['submitted-past','Submitted',-24,{submitted:date(-25),grade:'18 / 20',feedback:'Feedback available'}],['submitted-ahead','Submitted · Not graded',72,{}],['open','Not submitted',72,{}],['soon','Draft',12,{}],['shortly','Not submitted',.5,{}],['overdue','Not submitted',-1,{accept:date(2)}],['late','Submitted',-1,{submitted:date(-.5)}],['not-open','Not submitted',72,{open:date(24)}],['revision','Returned for revision',-1,{}],['excused','Excused',-1,{}],['cancelled','Cancelled',-1,{}],['unknown','Not graded',-1,{}]];
   const table=document.querySelector('#assignments');table.tHead.rows[0].innerHTML='<th>Assignment title</th><th>Status</th><th>Due date</th><th>Grade</th><th>Feedback</th>';
   table.tBodies[0].replaceChildren();
   for(const [id,status,hours,facts]of cases){const row=document.createElement('tr');row.id='case-'+id;if(facts.submitted)row.dataset.submittedAt=facts.submitted;if(facts.open)row.dataset.openDate=facts.open;if(facts.accept)row.dataset.acceptUntil=facts.accept;
    const title=row.insertCell(),a=document.createElement('a');a.href='/portal/site/cs200/page/Assignment';a.textContent=id.replaceAll('-',' ');title.append(a);row.insertCell().textContent=status;
    const due=row.insertCell(),time=document.createElement('time');time.dateTime=date(hours);time.textContent=new Date(time.dateTime).toLocaleString();due.append(time);row.insertCell().textContent=facts.grade||'—';row.insertCell().textContent=facts.feedback||'';table.tBodies[0].append(row);
   }window.nativeStatusCell=document.querySelector('#case-soon').cells[1];
  });
  const expected={'submitted-past':'submitted','submitted-ahead':'submitted',open:'not-submitted',soon:'due-soon',shortly:'due-shortly',overdue:'overdue',late:'submitted','not-open':'not-open',revision:'revision',excused:'excused',cancelled:'cancelled',unknown:'unknown'};
  for(const [id,value]of Object.entries(expected))await page.locator(`#case-${id}[data-ae-assignment-state="${value}"] .ae-assignment-status`).waitFor();
  assert.equal(await page.locator('#case-submitted-past .ae-assignment-status').evaluate(n=>getComputedStyle(n).color),'rgb(110, 231, 183)');
  assert.equal(await page.locator('#case-soon .ae-assignment-status').evaluate(n=>getComputedStyle(n).color),'rgb(251, 191, 36)');
  assert.equal(await page.locator('#case-shortly .ae-assignment-status').evaluate(n=>getComputedStyle(n).color),'rgb(251, 146, 60)');
  assert.equal(await page.locator('#case-overdue .ae-assignment-status').evaluate(n=>getComputedStyle(n).color),'rgb(251, 113, 133)');
  const fills=await page.locator('#assignments .ae-record-card').evaluateAll(rows=>rows.map(row=>{const style=getComputedStyle(row);return {state:row.dataset.aeAssignmentState,background:style.backgroundImage,left:style.borderLeftWidth,right:style.borderRightWidth};}));
  assert(fills.every(card=>card.left===card.right),'Assignment cards must not use a side accent stripe');
  assert(fills.find(card=>card.state==='submitted').background.includes('rgb(10, 36, 23)'),'Submitted color fills the card');
  assert(fills.find(card=>card.state==='overdue').background.includes('rgb(82, 39, 44)'),'Overdue color fills the card');
  assert.equal(new Set(fills.filter(card=>['not-submitted','due-soon','due-shortly','submitted','overdue','unknown'].includes(card.state)).map(card=>card.background)).size,6);
  assert.equal(await page.locator('#case-submitted-past [data-status-kind=late]').count(),0);assert.equal(await page.locator('#case-late [data-status-kind=late]').count(),1);
  assert.equal(await page.locator('#case-soon [data-status-kind=draft]').count(),1);assert.equal(await page.locator('#case-overdue [data-status-kind=late-allowed]').count(),1);assert.match(await page.locator('#case-submitted-past [data-status-kind=graded]').textContent(),/18 \/ 20/);
  await page.screenshot({path:path.join(reportDir,'assignment-status-colors.png'),fullPage:true});
  await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('[data-ae-assignment-badges],[data-ae-assignment-state]').count(),0);assert(await page.evaluate(()=>window.nativeStatusCell===document.querySelector('#case-soon').cells[1]&&window.nativeStatusCell.textContent==='Draft'));await page.locator('#aether-native-toggle').click();await page.locator('#case-soon .ae-assignment-status').waitFor();
 });
 await test('Status colors: urgency crosses the deadline automatically without a click',async()=>{
  await go('Assignments');await page.evaluate(()=>{const row=document.querySelector('#assignments tbody tr');row.id='live-deadline';row.cells[1].textContent='Not submitted';row.querySelector('time').dateTime=new Date(Date.now()+1500).toISOString();});
  await page.locator('#live-deadline[data-ae-assignment-state="due-shortly"]').waitFor();await page.locator('#live-deadline[data-ae-assignment-state="overdue"]').waitFor({timeout:5000});assert.match(await page.locator('#live-deadline .ae-assignment-status').textContent(),/Overdue/);
 });
 await test('Status colors: hover leaves files unopened; an explicit successful preview persists across reload',async()=>{
  await reset();assert.equal(await notes.locator('.ae-file-status').evaluate(n=>getComputedStyle(n).color),'rgb(56, 189, 248)');
  await notes.locator('[data-ae-primary="true"] a').hover();await page.locator('.ae-preview-text').waitFor();await state(notes,'unopened');await page.mouse.move(8,8);await panel.waitFor({state:'detached'});
  await preview('notes.txt');await page.locator('.ae-preview-text').waitFor();await state(notes,'opened');await close();await page.reload();await state(notes,'opened');assert.equal(await notes.locator('.ae-file-status').evaluate(n=>getComputedStyle(n).color),'rgb(148, 163, 184)');
 });
 await test('Status colors: updated version badges require metadata and fetch the new file content',async()=>{
  await reset();const url=origin+'/access/content/group/cs200/notes.txt';let reads=0;
  await context.route(url,route=>route.fulfill({contentType:'text/plain',body:'Document version '+(++reads)}));
  try{
   await preview('notes.txt');await state(notes,'opened');await close();
   await notes.locator('time').evaluate(n=>{n.dateTime='2026-10-21';});await state(notes,'updated');assert.equal(await notes.locator('.ae-file-status').evaluate(n=>getComputedStyle(n).color),'rgb(196, 181, 253)');
   await preview('notes.txt');await state(notes,'opened');assert(reads>=1);assert.match(await page.locator('.ae-preview-text').textContent(),/Document version/);await close();
  }finally{await context.unroute(url);}
 });
 await test('Status colors: missing modification metadata never invents an Updated badge',async()=>{
  await reset();await notes.locator('time').evaluate(n=>{n.removeAttribute('datetime');n.textContent='Yesterday';});await preview('notes.txt');await state(notes,'opened');await close();
  await notes.locator('time').evaluate(n=>{n.dateTime='2026-10-21';});await state(notes,'opened');assert.equal(await notes.locator('[data-file-state=updated]').count(),0);
 });
 await test('Status colors: failed previews show restricted/unavailable and never mark a file opened',async()=>{
  await reset();for(const [id,title,value]of [['resource-5','restricted.pdf','restricted'],['resource-6','broken.pdf','unavailable']]){
   await preview(title);await page.locator('.ae-preview-message,#aether-resource-preview[data-pdf-page]').first().waitFor().catch(()=>{});
   await state(page.locator('#'+id),value);assert(await panel.getByRole('button',{name:'Open original',exact:true}).isVisible());await close();
  }
 });
 await test('Status colors: file history contains hashes and timestamps only and can be cleared',async()=>{
  await go('Resources');await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();await state(page.locator('#resource-0'),'opened');
  const reader=page.frames().find(frame=>frame.url().includes('/preview/pdf.html'));const values=await reader.evaluate(()=>chrome.storage.local.get(null));
  const entries=Object.entries(values).filter(([key])=>key.startsWith('aether:v14:file:'));assert(entries.length>0);assert(entries.length<=1000);
  for(const [key,value]of entries){assert(/^aether:v14:file:[a-f0-9]{64}$/.test(key));assert.deepEqual(Object.keys(value).sort(),['openedAt','version']);assert(Number.isFinite(value.openedAt));assert(value.version===null||/^[a-f0-9]{64}$/.test(value.version));}
  const serialized=JSON.stringify(entries);assert(!serialized.includes('/access/content/'));assert(!serialized.includes('Lecture'));assert(!serialized.includes('notes.txt'));
  await panel.getByRole('button',{name:'Clear file history',exact:true}).click();await state(page.locator('#resource-0'),'unopened');const remaining=await reader.evaluate(async()=>Object.keys(await chrome.storage.local.get(null)).filter(key=>key.startsWith('aether:v14:file:')).length);assert.equal(remaining,0);await close();
 });
 await test('Status colors: original file clicks are recorded while native downloads keep working',async()=>{
  await reset();const automatic=page.waitForEvent('download');await page.locator('#resource-2 a[download]').evaluate(a=>a.click());await automatic;await state(notes,'unopened');
  const download=page.waitForEvent('download');await page.locator('#resource-2 a[download]').click();await download;await state(notes,'opened');
  await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('.ae-file-status,[data-ae-file-state]').count(),0);await page.locator('#aether-native-toggle').click();await state(notes,'opened');
 });
};
