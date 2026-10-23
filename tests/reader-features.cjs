const fs=require('node:fs'),path=require('node:path');
const {origin}=require('./fixtures.cjs');
module.exports=async({page,context,test,go,preview,reportDir,assert})=>{
 const panel=page.locator('#aether-resource-preview');
 const close=async()=>{await panel.getByRole('button',{name:'Close resource preview',exact:true}).click();};
 await test('Reader features: course cards count four pinned courses and exclude Recent',async()=>{
  await page.setViewportSize({width:1440,height:1000});await go('Overview',true);
  await page.evaluate(()=>{
   const source=document.querySelector('#toolMenu li[data-type=pinned]');
   for(const [name,id,type]of [['Fourth pinned course','fourth','pinned'],['Recent course only','recent','recent']]){
    const row=source.cloneNode(true);row.dataset.type=type;row.classList.remove('is-current-site');const a=row.querySelector('.sidebar-site-title');a.textContent=name;a.href='/portal/site/'+id;
    const pin=document.createElement('button');pin.type='button';pin.className='site-opt-pin';pin.dataset.pinned=String(type==='pinned');pin.textContent='Toggle pin';pin.onclick=()=>{pin.dataset.pinned=String(pin.dataset.pinned!=='true');row.dataset.type=pin.dataset.pinned==='true'?'pinned':'recent';};row.append(pin);source.parentElement.append(row);
   }
  });
  await page.waitForFunction(()=>document.querySelectorAll('.ae-course-card').length===4);
  assert.match(await page.locator('.ae-courses .ae-section-meta').textContent(),/^4 PINNED$/);
  assert.equal(await page.locator('.ae-instrument-number').textContent(),'04');
  assert.equal(await page.locator('.ae-course-link[href$="/recent"]').count(),0);
  await page.screenshot({path:path.join(reportDir,'four-pinned-courses.png')});
 });
 await test('Reader features: native pin changes update the deck and hero, including zero pins',async()=>{
  const pin=page.locator('#toolMenu li[data-type=recent] .site-opt-pin');await pin.click();
  await page.waitForFunction(()=>document.querySelectorAll('.ae-course-card').length===5);
  assert.equal(await page.locator('.ae-instrument-number').textContent(),'05');
  await page.evaluate(()=>document.querySelectorAll('#toolMenu li[data-type=pinned]').forEach(row=>row.dataset.type='recent'));
  await page.getByText('Pin courses in the Sakai sidebar to add shortcuts here.',{exact:true}).waitFor();
  assert.equal(await page.locator('.ae-course-card').count(),0);
  assert.equal(await page.locator('.ae-instrument-number').textContent(),'00');
  assert.equal(await page.locator('.ae-courses .ae-section-meta').textContent(),'0 PINNED');
 });
 await test('Reader features: all pinned courses are shown without the old fourteen-course limit',async()=>{
  await go('Overview',true);
  await page.evaluate(()=>{const source=document.querySelector('#toolMenu li[data-type=pinned]').cloneNode(true);document.querySelectorAll('#toolMenu li[data-type=pinned]').forEach(row=>row.remove());const list=document.querySelector('#toolMenu ul');for(let i=0;i<16;i++){const row=source.cloneNode(true),a=row.querySelector('.sidebar-site-title');a.href='/portal/site/pinned-'+i;a.textContent='Pinned course '+i;list.append(row);}});
  await page.waitForFunction(()=>document.querySelectorAll('.ae-course-card').length===16);
  assert.equal(await page.locator('.ae-instrument-number').textContent(),'16');
 });
 await test('Reader features: PDF reader is larger, draggable to resize, expandable and zoomable',async()=>{
  await go('Resources');await preview('Lecture 01.pdf');await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor();
  const original=await panel.boundingBox();assert(original.width>=900);assert(original.height>=750);
  const reader=page.frames().find(f=>f.url().includes('/preview/pdf.html'));assert(reader);
  const canvas=reader.locator('#page'),paper=reader.locator('#paper'),before=await canvas.boundingBox();
  const handle=panel.getByRole('button',{name:'Resize preview',exact:true});await handle.focus();
  for(let i=0;i<3;i++){await handle.press('ArrowLeft');await handle.press('ArrowUp');}
  const small=await panel.boundingBox();assert(small.width<original.width-80);assert(small.height<original.height-80);
  await reader.waitForFunction(height=>document.querySelector('#page').clientHeight<height-50,before.height);
  const grip=await handle.boundingBox();await page.mouse.move(grip.x+16,grip.y+16);await page.mouse.down();await page.mouse.move(grip.x+80,grip.y+64,{steps:8});await page.mouse.up();
  const resized=await panel.boundingBox();assert(resized.width>small.width+40);assert(resized.height>small.height+30);
  await panel.getByRole('button',{name:'Expand preview',exact:true}).click();const expanded=await panel.boundingBox();assert(expanded.width>=1400);assert(expanded.height>=970);
  const zoomedBefore=await canvas.boundingBox();await reader.getByRole('button',{name:'Zoom in',exact:true}).click();await reader.waitForFunction(width=>document.querySelector('#page').clientWidth>width+30,zoomedBefore.width);
  await reader.getByLabel('Fit PDF').selectOption('width');await reader.waitForFunction(()=>document.querySelector('#paper').scrollHeight>document.querySelector('#paper').clientHeight);
  assert((await canvas.boundingBox()).width<=(await paper.boundingBox()).width+1);
  await page.screenshot({path:path.join(reportDir,'large-pdf-reader.png')});
  await panel.getByRole('button',{name:'Restore preview size',exact:true}).click();assert(Math.abs((await panel.boundingBox()).width-resized.width)<2);
  await page.setViewportSize({width:360,height:640});const mobile=await panel.boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=360);assert(mobile.y>=0&&mobile.y+mobile.height<=640);assert(await panel.getByRole('button',{name:'Close resource preview',exact:true}).isVisible());
  await close();await page.setViewportSize({width:1440,height:1000});
 });
 const attachmentRoute=origin+'/access/content/attachment/**',attachmentRequests=[];
 await context.route(attachmentRoute,route=>{
  attachmentRequests.push({method:route.request().method(),url:route.request().url()});const u=new URL(route.request().url());
  if(u.pathname.endsWith('restricted.pdf'))return route.fulfill({status:403,body:'Denied'});
  const name=u.pathname.endsWith('.pptx')?'preview.pptx':u.pathname.endsWith('.docx')?'preview.docx':'preview.zip';
  return route.fulfill({contentType:name.endsWith('pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':name.endsWith('docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/zip',body:fs.readFileSync(path.join(__dirname,'data',name))});
 });
 try{
  const prepare=async()=>{
   await go('Assignment detail');await page.locator('#answer').fill('Fictional unsaved draft answer');
   await page.evaluate(()=>{
    const form=document.getElementById('academic-form');window.originalAssignmentForm=form;window.originalAssignmentAnswer=document.getElementById('answer');
    const files=document.createElement('ul');files.className='attachList';files.id='assignment-files';
    for(const [id,name,href]of [['slides','Assignment slides.pptx','/access/content/attachment/course/assignment/Slides.pptx'],['draft-file','Draft notes.docx','/access/content/attachment/course/draft/Notes.docx'],['restricted','Restricted feedback.pdf','/access/content/attachment/course/assignment/restricted.pdf'],['external','External slides.pptx','https://example.invalid/Slides.pptx'],['action','Assignment action','/portal/site/cs200/page/Assignment']]){
     const li=document.createElement('li'),a=document.createElement('a');a.id=id;a.href=href;a.textContent=name;a.target='_blank';li.append(a);
     const remove=document.createElement('button');remove.type='button';remove.textContent='Remove '+name;remove.onclick=()=>li.remove();li.append(remove);files.append(li);
    }form.append(files);
   });
   await page.getByRole('button',{name:'Preview Assignment slides.pptx',exact:true}).waitFor();
  };
  await test('Reader features: assignment attachments preview slides without altering the form or draft',async()=>{
   await prepare();assert.equal(await page.locator('#assignment-files [data-ae-preview-open]').count(),3);
   await page.getByRole('button',{name:'Preview Assignment slides.pptx',exact:true}).click();await page.locator('#aether-resource-preview[data-office-kind="presentation"]').waitFor({timeout:25000});
   const reader=page.frameLocator('.ae-preview-office');await reader.getByText('Static lecture preview',{exact:true}).waitFor();await reader.locator('#next').click();await page.locator('#aether-resource-preview[data-office-page="2"]').waitFor();
   await page.screenshot({path:path.join(reportDir,'assignment-slide-preview.png')});await close();
   assert.equal(await page.locator('#answer').inputValue(),'Fictional unsaved draft answer');assert(await page.evaluate(()=>window.originalAssignmentForm===document.getElementById('academic-form')&&window.originalAssignmentAnswer===document.getElementById('answer')));
   assert.equal(await page.locator('#academic-form .ae-record-card').count(),0);assert.equal(await page.locator('input[name=csrf]').inputValue(),'fixture-only-token');
   await page.locator('#draft').click();assert.equal(await page.locator('#draft').getAttribute('data-saved'),'true');
  });
  // Escape removes its own frame: dispatch to the focused reader, then await removal.
  await test('Reader features: draft attachments preview Word files and keep keyboard focus',async()=>{
   await prepare();const button=page.getByRole('button',{name:'Preview Draft notes.docx',exact:true});await button.click();await page.locator('#aether-resource-preview[data-office-kind="document"]').waitFor();await page.frameLocator('.ae-preview-office').getByText('Seminar notes',{exact:true}).waitFor();
   await page.frameLocator('.ae-preview-office').locator('#document').evaluate(node=>{node.tabIndex=-1;node.focus();});assert(await page.locator('.ae-preview-office').evaluate(frame=>document.activeElement===frame));try{await page.keyboard.down('Escape');await panel.waitFor({state:'detached'});}finally{await page.keyboard.up('Escape');}assert.equal(await panel.count(),0);assert(await button.evaluate(n=>n===document.activeElement));
  });
  await test('Reader features: removed attachments close their reader, and OFF removes preview controls',async()=>{
   await prepare();await page.getByRole('button',{name:'Preview Assignment slides.pptx',exact:true}).click();await panel.waitFor();await page.evaluate(()=>document.getElementById('slides').closest('li').remove());await panel.waitFor({state:'detached'});
   await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('#assignment-files [data-ae-preview-open],#assignment-files [data-ae-attachment]').count(),0);assert.equal(await page.locator('#answer').inputValue(),'Fictional unsaved draft answer');await page.locator('#aether-native-toggle').click();await page.getByRole('button',{name:'Preview Draft notes.docx',exact:true}).waitFor();
  });
  // The message exists during loading too; wait for the actual permission response.
  await test('Reader features: attachment permission failures retain the original link and never submit forms',async()=>{
   await prepare();await page.getByRole('button',{name:'Preview Restricted feedback.pdf',exact:true}).click();await panel.locator('.ae-preview-message').filter({hasText:/permission/}).waitFor();assert.match(await panel.locator('.ae-preview-message').textContent(),/permission/);assert(await panel.getByRole('button',{name:'Open original',exact:true}).isVisible());assert(await page.locator('#confirmation').isHidden());assert(attachmentRequests.every(r=>r.method==='GET'));assert(!attachmentRequests.some(r=>r.url.includes('example.invalid')));await close();
  });
  await test('Reader features: attachments inside Sakai tool frames use the same top-level reader',async()=>{
   const frameRoute=origin+'/tool/assignment-attachments';
   await context.route(frameRoute,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div class="portletBody"><form id="addSubmissionForm"><textarea id="framed-answer">Fictional draft</textarea><ul class="attachList"><li><a href="/access/content/attachment/course/assignment/Slides.pptx">Framed slides.pptx</a></li></ul></form></div></body></html>'}));
   try{
    await go('Assignment detail');await page.evaluate(src=>{const frame=document.createElement('iframe');frame.title='Assignment attachment tool';frame.src=src;document.querySelector('main#content').append(frame);},frameRoute);
    const tool=page.frameLocator('iframe[title="Assignment attachment tool"]');await tool.getByRole('button',{name:'Preview Framed slides.pptx',exact:true}).click();await page.locator('#aether-resource-preview[data-office-kind="presentation"]').waitFor({timeout:25000});assert.equal(await tool.locator('#framed-answer').inputValue(),'Fictional draft');assert.equal(await panel.count(),1);await close();
   }finally{await context.unroute(frameRoute);}
  });
 }finally{await context.unroute(attachmentRoute);}
};
