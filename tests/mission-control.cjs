/* Focused release check. Every LMS response is fictional and intercepted. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {fixture,origin,route}=require('./fixtures.cjs');
const root=path.resolve(__dirname,'..'),report=path.join(root,'reports','mission-control');fs.mkdirSync(report,{recursive:true});
const box={location:{href:origin+'/portal/site/home',origin},Date,URL};vm.createContext(box);
for(const file of ['assignment-state.js','academic-data.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),box);
const D=box.AetherAcademicData,now=Date.now(),iso=(days,hours=0)=>new Date(now+days*86400000+hours*3600000).toISOString();
const rec=(id,status,days,site='cs200')=>D.record({id,type:'assignment',siteId:site,course:site,title:id,url:origin+'/portal/site/'+site+'?id='+id,dueRaw:iso(days),nativeStatus:status,verifiedStatus:!!status});
const model=[rec('soon','Not submitted',1),rec('sent','Submitted',2),rec('draft','Draft',3,'math101'),rec('unknown','',4),rec('late','Not submitted',-2),rec('far','Not submitted',20)];
assert.equal(D.select(model,{days:7,type:'event'},now).length,0);
assert.equal(D.select(model,{days:7,course:'math101',status:'attention'},now).length,1);
assert.equal(D.select(model,{days:7,status:'completed'},now)[0].id,'sent');
assert.equal(D.select(model,{days:7,status:'attention'},now).length,3);
assert.equal(D.select(model,{days:30},now).length,6);
assert.equal(D.unique([model[0],model[0]]).length,1);
assert.equal(D.state(model[3],now).state,'unknown');assert.equal(D.state(model[4],now).state,'overdue');
assert.equal(D.unique([model[0],{...model[0],nativeStatus:'Submitted'}])[0].verifiedStatus,false);
assert.equal(D.unique([{...model[0],verifiedStatus:false,nativeStatus:'',time:NaN,rawDate:''},model[0]])[0].verifiedStatus,true);
assert(!D.unique([{...model[3],time:NaN,rawDate:''},{...model[3],time:NaN,rawDate:''}])[0].conflictingDate);
assert.equal(D.record({id:'bad',type:'event',title:'bad',url:'https://evil.invalid'}),null);
console.log('PASS normalization, deduplication, composable filters, date ranges and status semantics');
const results=[],requests=[],errors=[];let context,page;
async function test(name,fn){await fn();results.push(name);console.log('PASS '+name);}
(async()=>{
 context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-mission-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM||undefined,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 let user='fictional-mission-user',mode='supported',revision=0,slow=false,ancient=0,sessionFails=false,elapsedEventTime=null;
 const courseTitle=id=>id==='cs200'?'CS200 Introduction to Programming':id==='math101'?'MATH101 Calculus I':'SS100 Writing & Communication';
 function pageFor(u){
  let html=fixture(u.href),sid=u.pathname.match(/^\/portal\/site\/([^/]+)/)?.[1]||'cs200';
  if(sid!=='home'){
   // Native navigation selects the requested course, with course-specific tool URLs.
   html=html.replace(/class="site-list-item is-current-site"/g,'class="site-list-item "').replace(new RegExp(`class="site-list-item "(><a class="sidebar-site-title" href="${origin}/portal/site/${sid}")`),`class="site-list-item is-current-site"$1`);
   html=html.replaceAll('/portal/site/cs200/page/','/portal/site/'+sid+'/page/');
  }
  if(u.searchParams.get('tool')==='Assignments'){
   const rows=[['a1','Problem set · '+sid,'Not submitted',iso(1)],['a2','Submitted report · '+sid,'Submitted',iso(2)],['draft','Draft notes · '+sid,'Draft',iso(3)],['unknown','Check status · '+sid,'Not graded',iso(4)],['overdue','Overdue work · '+sid,'Not submitted',iso(-1)],['undated','Undated work · '+sid,'Not graded','11/12/2026'],['future','UNRELEASED SECRET','Not submitted',iso(5)],['invisible','HIDDEN SECRET','Not submitted',iso(1)]];
   if(sid==='cs200')for(let i=0;i<ancient;i++)rows.push(['archive-'+i,'Archived overdue · '+i,'Not submitted',iso(-365-i)]);
   const table=`<div class="Mrphs-sakai-assignment-grades"><table id="assignments"><thead><tr><th>Assignment title</th><th>Status</th><th>Due date</th><th>Open date</th></tr></thead><tbody>${rows.map(([id,title,status,due])=>`<tr ${id==='invisible'?'hidden':''}><td><a href="${origin}/portal/site/${sid}/page/assignment?id=${id}">${title}</a></td><td>${status}</td><td><time datetime="${due}">${due}</time></td><td><time datetime="${id==='future'?iso(3):iso(-10)}"></time></td></tr>`).join('')}</tbody></table></div>`;
   let nativeTable=table;
   if(sid==='math101')nativeTable=nativeTable.replace('id="assignments"','id="assignments-list"').replace('<thead>','').replace('</thead>','').replace('<tbody>','').replace('</tbody>','');
   if(sid==='ss100')nativeTable=nativeTable.replace('<div class="Mrphs-sakai-assignment-grades">','<form name="listAssignmentsForm" method="post">').replace('id="assignments"','class="table"').replace('</div>','</form>').replaceAll('<tr><th>Assignment title','<tr><th id="attachments">Attachment</th><th>Assignment title').replaceAll('<tr ><td>','<tr ><td></td><td>').replaceAll('<tr hidden><td>','<tr hidden><td></td><td>').replaceAll('?id=','?sakai_action=doView_submission&assignmentReference=');
   html=html.replace(/<div class="Mrphs-sakai-assignment-grades">[\s\S]*?<\/table><\/div>/,nativeTable);
  }
  if(mode==='fallback')html=html.replace('Original Sakai content remains available.','Original Sakai content remains available.</p><div class="calendar-event"><a href="'+origin+'/portal/site/'+(sid==='home'?'cs200':sid)+'/page/Calendar">Native lecture · '+sid+'</a><time datetime="'+iso(1)+'"></time></div><p>');
  return html;
 }
 await context.route('https://**/*',async r=>{
  const req=r.request(),u=new URL(req.url());requests.push({path:u.pathname,method:req.method()});if(u.origin!==origin)return r.abort();
  if(u.pathname==='/direct/session/current.json')return sessionFails?r.fulfill({status:503,body:'Identity unavailable'}):r.fulfill({json:{userId:user}});
  if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:['cs200','math101','ss100'].map(id=>({id,title:courseTitle(id),type:'course'}))}});
  if(u.pathname.startsWith('/direct/calendar/')){if(slow)await new Promise(resolve=>setTimeout(resolve,1000));if(mode!=='supported')return r.fulfill({status:404,body:'Unsupported'});const item={siteId:'cs200',siteName:courseTitle('cs200'),eventId:'seminar',title:elapsedEventTime===null?'Seminar · verified event':'Seminar · earlier today',type:'Lecture',firstTime:{time:elapsedEventTime??now+5*86400000}};return r.fulfill({json:{calendar_collection:[item,item,{...item,eventId:'secret',title:'API ASSIGNMENT SECRET',type:'Web Assignment',assignmentId:'future'}]}});}
  if(u.pathname.startsWith('/direct/announcement/')){if(mode!=='supported')return r.fulfill({status:503,body:'Unavailable'});const sid=decodeURIComponent(u.pathname.split('/')[4].replace('.json',''));return r.fulfill({json:{announcement_collection:[{siteId:sid,announcementId:'post',title:'Office hours · '+sid,createdOn:iso(-1)},...(revision?[{siteId:sid,announcementId:'new-post',title:'Additional office hours · '+sid,createdOn:iso(-2)}]:[]),{siteId:sid,announcementId:'future',title:'FUTURE ANNOUNCEMENT SECRET',createdOn:iso(2)}]}});}
  if(u.pathname==='/tool/mission-math')return r.fulfill({contentType:'text/html',body:pageFor(new URL(origin+'/portal/site/math101/page/Assignments?tool=Assignments'))});
  if(u.pathname.startsWith('/portal/')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:u.pathname.startsWith('/portal/site/math101/')&&u.searchParams.get('tool')==='Assignments'?'<div class="Mrphs-sakai-assignment-grades"><iframe class="portletMainIframe" src="/tool/mission-math"></iframe></div>':pageFor(u)});
  return r.fulfill({status:404,body:'Fixture does not implement this path'});
 });
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/portal/site/home',{waitUntil:'domcontentloaded'});await page.locator('#aether-mission-control[data-loading="false"]').waitFor();
 // Initial rendering precedes the deferred fetch, so wait for the actual completed check.
 await page.getByText('Full enrollment coverage unverified',{exact:false}).waitFor();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();
 await test('Hero deadline shortcut opens Mission Control and continues through native keyboard controls',async()=>{
  const before=requests.length,shortcut=page.getByRole('button',{name:'VIEW DEADLINES',exact:true});assert.equal(await shortcut.getAttribute('aria-controls'),'aether-mission-control');await shortcut.click();assert(await page.locator('#aether-mission-control').evaluate(e=>document.activeElement===e));await page.keyboard.press('Tab');assert(await page.getByRole('button',{name:'Refresh academic sources'}).evaluate(e=>document.activeElement===e));assert.equal(await page.locator('.ae-course-card').count(),3);assert.equal(requests.length,before);
 });
 await test('Cross-course native assignments, API events and announcements; hidden records excluded',async()=>{
  assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),15);assert.equal(await page.locator('.mc-past-list [data-type=assignment]').count(),3);
  assert.equal(await page.locator('.mc-next-list [data-type=event]').count(),1);
  assert.equal(await page.locator('.mc-announcement-list [data-type=announcement]').count(),7); // three APIs + native Home and course summaries
  assert.equal(await page.locator('#aether-mission-control').getByText(/SECRET/).count(),0);
  assert.equal(await page.locator('.mc-next-list a').filter({hasText:'Problem set · math101'}).getAttribute('href'),origin+'/portal/site/math101/page/assignment?id=a1');
  assert.equal(await page.locator('.mc-next-list [data-state=overdue]').count(),0);assert.equal(await page.locator('.mc-past-list [data-state=overdue]').count(),3);assert.equal(await page.locator('.mc-past-due').evaluate(e=>e.open),false);assert.match(await page.locator('.mc-past-due > summary').innerText(),/\b3\b/);await page.locator('.mc-past-due > summary').click();assert.equal(await page.locator('.mc-past-due').evaluate(e=>e.open),true);
  assert.equal(await page.locator('.mc-next-list [data-state=unknown]').count(),6);
  assert((await page.locator('.mc-coverage').innerText()).includes('Partial coverage'));assert.equal(await page.locator('.mc-header .mc-actions').getByRole('button',{name:'Clear Mission Control data and announcement baseline'}).count(),0);assert.equal(await page.locator('.mc-source-details').getByRole('button',{name:'Clear Mission Control data and announcement baseline',includeHidden:true}).count(),1);assert.match(await page.locator('.mc-summary-scope').innerText(),/All courses.*next 7 days/i);
 });
 await test('Composed course/type/status filters, sort, ranges and timeline navigation do not refetch',async()=>{
  const before=requests.length;await page.getByLabel('Course',{exact:true}).selectOption('math101');await page.getByLabel('Type',{exact:true}).selectOption('assignment');await page.getByLabel('Status',{exact:true}).selectOption('completed');assert.equal(await page.locator('.mc-next-list .mc-item').count(),1);
  await page.getByLabel('Status',{exact:true}).selectOption('attention');assert.equal(await page.locator('.mc-next-list .mc-item').count(),2);assert.equal(await page.locator('.mc-past-list .mc-item').count(),1);assert.equal(await page.locator('.mc-summary .mc-stat').nth(0).locator('strong').innerText(),'4');assert.equal(await page.locator('.mc-summary .mc-stat').nth(1).locator('strong').innerText(),'3');const scope=await page.locator('.mc-summary-scope').innerText();assert.match(scope,/MATH101 Calculus I.*next 7 days/i);for(const word of [/independent/i,/period|range/i,/type/i,/status/i])assert.match(scope,word);assert.match(await page.locator('.mc-filter-summary').innerText(),/MATH101|Calculus/i);
  await page.getByLabel('Range',{exact:true}).selectOption('7');assert.equal(await page.locator('.mc-day').count(),7);await page.getByLabel('Next period').click();assert.equal(await page.locator('.mc-next-list .mc-item').count(),0);await page.getByRole('button',{name:'Today',exact:true}).click();
  await page.getByLabel('Sort',{exact:true}).selectOption('course');await page.getByLabel('Next period').click();await page.getByRole('button',{name:'Reset Mission Control filters'}).click();for(const [label,value]of [['Course',''],['Type',''],['Status',''],['Sort','time'],['Range','14']])assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value);assert.equal(await page.locator('.mc-day').count(),14);assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),15);assert.match(await page.locator('.mc-summary-scope').innerText(),/All courses.*next 7 days/i);assert.equal(requests.length,before);
 });
 await test('Announcement baseline compares successful observations, without publication claims',async()=>{
  revision=1;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-new').count(),3);assert.equal(await page.locator('.mc-past-due').evaluate(e=>e.open),true);assert.equal(await page.locator('.mc-summary .mc-stat').nth(3).locator('strong').innerText(),'3');await page.getByLabel('Course',{exact:true}).selectOption('math101');assert.equal(await page.locator('.mc-summary .mc-stat').nth(3).locator('strong').innerText(),'1');await page.getByRole('button',{name:'Reset Mission Control filters'}).click();
 });
 await test('Ancient past-due work cannot displace upcoming deadlines or consume their limit',async()=>{
  ancient=45;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),15);assert.equal(await page.locator('.mc-next-list .mc-item').filter({hasText:'Archived overdue'}).count(),0);assert.match(await page.locator('.mc-past-due > summary').innerText(),/\b48\b/);await page.getByRole('button',{name:'Show all past-due items',exact:true}).click();assert.equal(await page.locator('.mc-past-list .mc-item').count(),48);
  ancient=0;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-past-list .mc-item').count(),3);
 });
 await test('Same-account refresh and minute updates retain records, keyboard focus and list position',async()=>{
  await page.evaluate(()=>{const list=document.querySelector('.mc-next-list');list.style.maxHeight='240px';window.missionFocusNode=list.querySelector('.mc-item');window.missionFocusNode.focus({preventScroll:true});list.scrollTop=60;window.missionListScroll=list.scrollTop;});
  slow=true;await page.getByRole('button',{name:'Refresh academic sources'}).evaluate(b=>b.click());await page.locator('#aether-mission-control[data-loading="true"]').waitFor();
  const retained=()=>page.evaluate(()=>{const list=document.querySelector('.mc-next-list');return {node:window.missionFocusNode===list.querySelector('.mc-item'),focused:document.activeElement===window.missionFocusNode,scroll:list.scrollTop===window.missionListScroll};});
  assert.deepEqual(await retained(),{node:true,focused:true,scroll:true});await page.locator('#aether-mission-control[data-loading="false"]').waitFor();slow=false;assert.deepEqual(await retained(),{node:true,focused:true,scroll:true});assert.equal(await page.locator('.mc-past-due').evaluate(e=>e.open),true);
  const academicReads=()=>requests.filter(r=>r.path!=='/direct/session/current.json').length,before=academicReads();await page.locator('.mc-next-list .mc-item').first().locator('.mc-remaining').evaluate(e=>e.textContent='Fixture minute update pending');
  // Extension isolated-world timers are not controlled by Playwright's page clock.
  await page.waitForFunction(()=>{const label=document.querySelector('.mc-next-list .mc-item .mc-remaining');return label&&label.textContent!=='Fixture minute update pending';},null,{timeout:65000});assert.deepEqual(await retained(),{node:true,focused:true,scroll:true});assert.equal(academicReads(),before);await page.locator('.mc-next-list').evaluate(e=>e.style.removeProperty('max-height'));
 });
 await test('Refresh retains its own keyboard focus while the same-account check is busy',async()=>{
  const refresh=page.getByRole('button',{name:'Refresh academic sources'});slow=true;await refresh.focus();await page.keyboard.press('Enter');await page.locator('#aether-mission-control[data-loading="true"]').waitFor();assert.equal(await refresh.getAttribute('aria-disabled'),'true');assert.equal(await refresh.evaluate(e=>e.disabled),false);assert(await refresh.evaluate(e=>document.activeElement===e));await page.locator('#aether-mission-control[data-loading="false"]').waitFor();slow=false;assert.equal(await refresh.getAttribute('aria-disabled'),'false');assert(await refresh.evaluate(e=>document.activeElement===e));
 });
 await test('Earlier calendar items follow future deadlines without inferring an overdue submission state',async()=>{
  elapsedEventTime=Date.now()-1000;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();const event=page.locator('.mc-next-list [data-type=event]');assert.equal(await event.count(),1);assert.equal(await event.getAttribute('data-state'),'event');assert.equal(await event.locator('.mc-badge').innerText(),'Scheduled');assert.equal(await page.locator('.mc-past-list [data-type=event]').count(),0);assert.equal(await page.locator('.mc-next-list [data-type=assignment][data-state=unknown]').count(),6);assert.equal(await page.locator('.mc-next-list .mc-list-divider').innerText(),'Earlier today');
  assert(await page.locator('.mc-next-list').evaluate(list=>{const first=list.querySelector('.mc-item'),divider=list.querySelector('.mc-list-divider'),event=list.querySelector('[data-type=event]');return first.dataset.type==='assignment'&&!!(first.compareDocumentPosition(divider)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(divider.compareDocumentPosition(event)&Node.DOCUMENT_POSITION_FOLLOWING);}));
  elapsedEventTime=null;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-next-list [data-type=event]').count(),1);assert.equal(await page.locator('.mc-next-list .mc-list-divider').count(),0);
 });
 await test('Failed identity verification clears retained private records before further academic reads',async()=>{
  const academicReads=()=>requests.filter(r=>r.path!=='/direct/session/current.json').length,before=academicReads();sessionFails=true;await page.getByRole('button',{name:'Refresh academic sources'}).evaluate(b=>b.click());await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-item').count(),0);assert.equal(academicReads(),before);sessionFails=false;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),15);assert.equal(await page.locator('.mc-past-list .mc-item').count(),3);
 });
 await test('Desktop and narrow layout; original course cards and scene retained',async()=>{
  assert.equal(await page.locator('.ae-course-card').count(),3);assert(await page.locator('.ae-hero canvas').count());
  await page.screenshot({path:path.join(report,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});
  assert(await page.locator('#aether-mission-control').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:path.join(report,'mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});
 });
 await test('API failure retains useful cross-course native assignments/events and honest coverage',async()=>{
  mode='fallback';await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),15);assert.equal(await page.locator('.mc-past-list [data-type=assignment]').count(),3);assert(await page.locator('.mc-next-list [data-type=event]').count()>=3);await page.getByText('Sources & coverage',{exact:true}).click();assert((await page.locator('.mc-source-list').innerText()).includes('Events · unsupported'));assert((await page.locator('.mc-source-list').innerText()).includes('Announcements · failed'));
 });
 await test('OFF aborts pending work, clears private records and ON recovers',async()=>{
  slow=true;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="true"]').waitFor();await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('.mc-item').count(),0);assert.equal(await page.locator('#aether-mission-control').isVisible(),false);await page.waitForTimeout(1200);assert.equal(await page.locator('.mc-item').count(),0);slow=false;await page.locator('#aether-native-toggle').click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();await page.locator('.mc-next-list .mc-item').first().waitFor();
 });
 await test('Account change clears old records and new baseline; anonymous session blocks reads',async()=>{
  await page.getByLabel('Course',{exact:true}).selectOption('math101');user='fictional-other-user';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);assert.equal(await page.locator('.mc-new').count(),0);assert.equal(await page.getByLabel('Course',{exact:true}).inputValue(),'');await page.locator('#aether-mission-control[data-loading="false"]').waitFor();user='.anon';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);assert.equal(await page.locator('.mc-item').count(),0);
 });
 await test('Existing Home, assignment form and Gradebook remain functional; GET-only metadata',async()=>{
  user='fictional-mission-user';await page.goto(route('Assignment detail'));await page.locator('#academic-form').waitFor();assert.equal(await page.locator('#aether-mission-control').count(),0);assert.equal(await page.locator('input[name=csrf]').inputValue(),'fixture-only-token');
  await page.goto(route('Gradebook student'));await page.locator('#gradeSummaryTable .ae-record-card').first().waitFor();await page.locator('#grade-item-0 .gb-summary-grade-stats').click();await page.getByRole('dialog').waitFor();assert(requests.every(r=>r.method==='GET'));assert.equal(requests.filter(r=>r.path.startsWith('/direct/assignment/')).length,0);assert.deepEqual(errors,[]);
 });
 fs.writeFileSync(path.join(report,'results.json'),JSON.stringify({fixtureOnly:true,results,requests,errors},null,2));
 console.log(`${results.length+1} focused checks passed; authenticated LUMS compatibility remains unverified.`);
})().catch(async e=>{console.error(e);if(page){console.log(JSON.stringify({coverage:await page.locator('.mc-coverage').allTextContents(),source:await page.locator('.mc-source-list').allTextContents(),requests,errors},null,2));await page.screenshot({path:path.join(report,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{await context?.close();});

