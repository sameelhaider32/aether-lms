const fs=require('node:fs'),path=require('node:path'),{origin,route,pdf}=require('./fixtures.cjs'),{files,href,copyright}=require('./resource-fixtures.cjs');
module.exports=async({page,context,test,go,reportDir,assert,requests})=>{
 const accepted=new Set(),acknowledgements=[],data=name=>fs.readFileSync(path.join(__dirname,'data',name));
 await context.route(origin+'/access/**',async r=>{
   const u=new URL(r.request().url()),name=decodeURIComponent(u.pathname.split('/').at(-1));let response;
   if(u.pathname==='/access/require')response={contentType:'text/html',body:copyright(new URL('/access'+u.searchParams.get('url'),origin).href)};
   else if(u.pathname==='/access/accept'){const ref=u.searchParams.get('ref');accepted.add(ref);acknowledgements.push(ref);response={status:302,headers:{Location:'/access'+u.searchParams.get('url')},body:''};}
   else if(u.pathname.startsWith('/access/content/group/fixture-course/')){
     const ref=decodeURIComponent(u.pathname.slice('/access'.length));
     if(name.startsWith('Protected')&&!accepted.has(ref))response={status:302,headers:{Location:'/access/require?'+new URLSearchParams({ref,url:u.pathname.slice('/access'.length)})},body:''};
     else if(name==='Bad copyright.pdf')response={contentType:'text/html',body:copyright(u.href,true)};
     else if(name==='Broken.pptx')response={contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',body:'Not an Office document'};
     else if(name==='Bomb.zip'){const bytes=Buffer.from(data('preview.zip'));const central=bytes.indexOf(Buffer.from([80,75,1,2]));bytes.writeUInt32LE(150*1024*1024,central+24);response={contentType:'application/zip',body:bytes};}
     else if(name.endsWith('.pdf'))response={contentType:'application/pdf',body:pdf()};
     else if(name.endsWith('.pptx')||name==='download')response={contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',body:data('preview.pptx')};
     else if(name.endsWith('.docx'))response={contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',body:data('preview.docx')};
     else if(name.endsWith('.xlsx'))response={contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:data('preview.xlsx')};
     else if(name.endsWith('.zip'))response={contentType:'application/zip',body:data('preview.zip')};
     else if(name.endsWith('.wav'))response={contentType:'audio/wav',body:data('preview.wav')};
     else response={contentType:'application/vnd.ms-powerpoint',body:Buffer.from([208,207,17,224,161,177,26,225])};
   }
   if(!response)return r.fallback();requests.push({url:u.href,method:r.request().method(),type:r.request().resourceType()});await r.fulfill(response);
 });
 const panel=page.locator('#aether-resource-preview'),open=async name=>{const id=files.indexOf(name);assert(id>=0);await page.locator(`#managed-${id} [data-ae-preview-open]`).click();await panel.waitFor();};
 // Routine cleanup uses the parent close control; keyboard dismissal remains
 // covered explicitly below and in the hover/PDF regressions. Repeatedly
 // dispatching key-up into an iframe removed on key-down can stall Linux CDP.
 const office=()=>page.frameLocator('.ae-preview-office'),close=async()=>{await panel.getByRole('button',{name:'Close resource preview',exact:true}).click();assert.equal(await panel.count(),0);};
 await test('Resource variants: TA management form uses cards with original fields and extra context rows',async()=>{
   await go('Resources TA');await page.locator('#managed-resources.ae-card-table').waitFor();assert.equal(await page.locator('#managed-resources .ae-record-card').count(),files.length);assert.equal(await page.locator('#managed-resources>.ae-card-context-row').count(),0);assert.equal(await page.locator('.native-pagination.ae-card-context-row').count(),1);assert.equal(await page.locator('#managed-11 [data-ae-primary="true"] a').last().innerText(),'Bomb.zip');assert.equal(await page.locator('input[name="sakai_csrf_token"]').inputValue(),'fictional-manager-csrf');assert.equal(await page.locator('#manager-upload').getAttribute('type'),'file');assert.equal(await page.locator('#managed-0 [data-ae-primary="true"]').getAttribute('data-ae-type'),'PPTX');await page.screenshot({path:path.join(reportDir,'ta-resources-desktop.png'),fullPage:true});
 });
 await test('Resource variants: native TA add, remove, bulk selection, sorting, upload and pagination stay usable',async()=>{
   await page.locator('#managed-0 input[type="checkbox"]').check();await page.locator('#managed-0 .dropdown-toggle').click();await page.locator('#managed-0 .native-add').click();assert.equal(await page.locator('#management-result').innerText(),'add:Slides.pptx');await page.locator('#managed-0 .native-remove').click();assert.equal(await page.locator('#management-result').innerText(),'remove:Slides.pptx');assert(await page.locator('#managed-0 input').isChecked());await page.locator('#native-upload').click();assert.equal(await page.locator('#management-result').innerText(),'upload');await page.locator('#manager-page-size').selectOption('50');assert.equal(await page.locator('#manager-page-size').getAttribute('data-changed'),'true');await page.locator('#manager-next').click();assert.equal(await page.locator('#manager-next').getAttribute('data-clicked'),'true');await page.locator('#manager-sort').click();assert.equal(await page.locator('.resource-row').first().getAttribute('id'),'managed-11');
 });
 await test('Resource variants: legacy action selectors and nested pagination retain native behavior',async()=>{
   await go('Resources legacy');await page.locator('#managed-resources.ae-card-table').waitFor();assert.equal(await page.locator('.resource-row.ae-record-card').count(),files.length);await page.getByRole('combobox',{name:'Actions for Slides.pptx',exact:true}).selectOption('remove');assert.equal(await page.locator('#sakai_action').inputValue(),'remove');assert.equal(await page.locator('#native-pager-table').evaluate(e=>getComputedStyle(e).display),'table');assert.equal(await page.locator('#native-pager-table tbody').evaluate(e=>getComputedStyle(e).display),'table-row-group');
 });
 await test('Resource variants: student permissions do not gain TA controls',async()=>{
   await go('Resources student');await page.locator('#managed-resources.ae-card-table').waitFor();assert.equal(await page.locator('.resource-row.ae-record-card').count(),files.length);assert.equal(await page.locator('#manager-upload,.native-add,.native-remove').count(),0);
 });
 await test('Resource variants: real editing fields stay native and switching back restores cards',async()=>{
   await go('Resources TA');await page.locator('#managed-resources.ae-card-table').waitFor();await page.evaluate(()=>{window.originalManagedLink=document.querySelector('#managed-0 [data-ae-primary] a:last-of-type');const input=document.createElement('input');input.id='rename-field';input.value='Original name';document.querySelector('#managed-0 [data-ae-primary]').append(input);});await page.locator('#managed-resources.ae-card-table').waitFor({state:'detached'});assert.equal(await page.locator('#managed-resources').evaluate(e=>getComputedStyle(e).display),'table');await page.locator('#rename-field').fill('A native rename');await page.locator('#rename-field').evaluate(e=>e.remove());await page.locator('#managed-resources.ae-card-table').waitFor();assert(await page.evaluate(()=>window.originalManagedLink===document.querySelector('#managed-0 [data-ae-primary] a:last-of-type')));
 });
 await test('Resource variants: OFF restores TA semantics and original controls without losing selected values',async()=>{
   await page.locator('#managed-0 input[type="checkbox"]').check();await page.evaluate(()=>window.originalManagerForm=document.querySelector('#showForm'));await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('#managed-resources .ae-record-card').count(),0);assert.equal(await page.locator('#managed-resources').getAttribute('role'),null);assert(await page.locator('#managed-0 input').isChecked());assert(await page.evaluate(()=>window.originalManagerForm===document.querySelector('#showForm')));await page.locator('#aether-native-toggle').click();await page.locator('#managed-resources.ae-card-table').waitFor();
 });
 await test('Resource variants: TA tool frames receive cards and preserve native actions',async()=>{
   await go('Resources TA frame');const frame=page.frameLocator('iframe[title="TA Resources tool frame"]');await frame.locator('#managed-resources.ae-card-table').waitFor();assert.equal(await frame.locator('.resource-row.ae-record-card').count(),files.length);await frame.locator('#managed-0 .dropdown-toggle').click();await frame.locator('#managed-0 .native-add').click();assert.equal(await frame.locator('#management-result').innerText(),'add:Slides.pptx');
 });
 await test('Resource variants: PowerPoint renders slide text, embedded image and navigation locally',async()=>{
   await go('Resources TA');await open('Slides.pptx');await page.locator('#aether-resource-preview[data-office-kind="presentation"][data-office-page="1"]').waitFor({timeout:25000});await office().getByText('Static lecture preview',{exact:true}).waitFor();assert(await office().locator('#document img').count()>0);await office().locator('#next').click();await page.locator('#aether-resource-preview[data-office-page="2"]').waitFor();await office().getByText('Tables and charts',{exact:true}).waitFor();assert(await office().getByText('Second example',{exact:true}).isVisible());await page.screenshot({path:path.join(reportDir,'powerpoint-preview.png')});await office().locator('#next').press('ArrowRight');await page.locator('#aether-resource-preview[data-office-page="3"]').waitFor();await office().getByText('External link stays inert',{exact:true}).click();assert.equal(await page.evaluate(()=>window.officeInjected),undefined);assert.equal(context.pages().length,2);await office().locator('body').press('Escape');assert.equal(await panel.count(),0);
 });
 await test('Resource variants: Word renders paragraphs and tables without active HTML or navigation',async()=>{
   await open('Notes.docx');await page.locator('#aether-resource-preview[data-office-kind="document"]').waitFor({timeout:25000});await office().getByText('Seminar notes',{exact:true}).waitFor();assert(await office().getByText('Discussion',{exact:true}).isVisible());assert.equal(await office().getByText('UNSAFE ALT CHUNK',{exact:true}).count(),0);await office().getByText('External document link',{exact:true}).click();assert.equal(await office().locator('body').evaluate(()=>window.officeInjected),undefined);await close();
 });
 await test('Resource variants: Excel shows visible sheets and stored formula values without execution',async()=>{
   await open('Workbook.xlsx');await page.locator('#aether-resource-preview[data-office-kind="workbook"]').waitFor({timeout:25000});assert(await office().getByRole('cell',{name:'42',exact:true}).isVisible());assert.equal(await office().locator('#sheet option').count(),2);assert.equal(await office().getByText('Hidden fixture cell',{exact:true}).count(),0);await office().locator('#sheet').selectOption('1');await office().getByText('Second worksheet',{exact:true}).waitFor();assert(await office().getByRole('cell',{name:'17',exact:true}).isVisible());await page.screenshot({path:path.join(reportDir,'excel-preview.png')});await close();
 });
 await test('Resource variants: ZIP lists entries and audio gets native paused playback controls',async()=>{
   await open('Files.zip');await page.locator('#aether-resource-preview[data-office-kind="archive"]').waitFor();assert(await office().getByText('notes/readme.txt',{exact:true}).isVisible());await close();await open('Recording.wav');await page.locator('audio.ae-preview-media').waitFor();await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1);assert(await page.locator('audio').evaluate(e=>e.controls&&e.paused));await close();
 });
 await test('Resource variants: copyright notice stays in the preview and never accepts on hover',async()=>{
   accepted.clear();await go('Resources TA');const before=acknowledgements.length;await page.locator('#managed-5 [data-ae-primary="true"] a').last().hover();await panel.getByText('Copyright acknowledgement',{exact:true}).waitFor();assert((await panel.innerText()).includes('coursework only'));assert.equal(acknowledgements.length,before);assert.equal(await page.evaluate(()=>window.copyrightInjected),undefined);await page.mouse.move(8,8);assert.equal(await panel.count(),0);
 });
 await test('Resource variants: explicit copyright acceptance loads the PDF in the same preview',async()=>{
   await open('Protected.pdf');await panel.getByRole('button',{name:'Yes, accept and preview'}).click();await page.locator('#aether-resource-preview[data-pdf-page="1"]').waitFor({timeout:25000});assert(accepted.has('/content/group/fixture-course/Protected.pdf'));await page.frameLocator('.ae-preview-pdf').locator('#next').click();await page.locator('#aether-resource-preview[data-pdf-page="2"]').waitFor();await close();
 });
 await test('Resource variants: protected PowerPoint uses the same explicit copyright flow',async()=>{
   await open('Protected slides.pptx');await panel.getByRole('button',{name:'Yes, accept and preview'}).click();await page.locator('#aether-resource-preview[data-office-kind="presentation"]').waitFor({timeout:25000});assert(accepted.has('/content/group/fixture-course/Protected slides.pptx'));await close();
 });
 await test('Resource variants: declining copyright makes no acknowledgement request',async()=>{
   accepted.clear();await go('Resources TA');const before=acknowledgements.length;await open('Protected.pdf');await panel.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await panel.count(),0);assert.equal(acknowledgements.length,before);
 });
 await test('Resource variants: hostile copyright links are inert and cannot send external acknowledgements',async()=>{
   await open('Bad copyright.pdf');await panel.locator('.ae-preview-message').waitFor();assert.equal(await panel.getByRole('button',{name:'Yes, accept and preview'}).count(),0);assert(!requests.some(r=>new URL(r.url).hostname==='example.invalid'));await close();
 });
 await test('Resource variants: opaque download URLs identify PowerPoint by the actual package',async()=>{
   await open('Unknown slides');await page.locator('#aether-resource-preview[data-office-kind="presentation"]').waitFor({timeout:25000});await office().getByText('Static lecture preview',{exact:true}).waitFor();await close();
 });
 await test('Resource variants: legacy, damaged and oversized archives fail with a usable original link',async()=>{
   for(const name of ['Legacy.ppt','Broken.pptx','Bomb.zip']){await open(name);await panel.locator('.ae-preview-message').waitFor({timeout:25000});assert(await panel.getByRole('button',{name:'Open original',exact:true}).isVisible());assert.equal(await panel.locator('script').count(),0);await close();}
 });
 for(const width of (process.env.AETHER_RESOURCE_WIDTHS||'360,390,640,775,1024,1280,1440,1920').split(',').map(Number))await test(`Resource variants: responsive TA cards and Office preview at ${width}px`,async()=>{
   await page.setViewportSize({width,height:960});await go('Resources TA');await page.locator('#managed-resources.ae-card-table').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#managed-0 .dropdown-toggle').click();const bounds=await page.locator('#managed-0 .dropdown-menu').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);await page.locator('#managed-0 .dropdown-toggle').click();await open('Slides.pptx');await page.locator('#aether-resource-preview[data-office-kind="presentation"]').waitFor({timeout:25000});const box=await panel.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);await office().locator('#next').click();await page.locator('#aether-resource-preview[data-office-page="2"]').waitFor();if([390,1440].includes(width))await page.screenshot({path:path.join(reportDir,`ta-office-${width}.png`)});await close();
 });
 await page.setViewportSize({width:1440,height:1000});
};
