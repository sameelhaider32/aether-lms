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
 let user='fictional-mission-user',mode='supported',revision=0,slow=false;
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
  if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:user}});
  if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:['cs200','math101','ss100'].map(id=>({id,title:courseTitle(id),type:'course'}))}});
  if(u.pathname.startsWith('/direct/calendar/')){if(slow)await new Promise(resolve=>setTimeout(resolve,1000));if(mode!=='supported')return r.fulfill({status:404,body:'Unsupported'});const item={siteId:'cs200',siteName:courseTitle('cs200'),eventId:'seminar',title:'Seminar · verified event',type:'Lecture',firstTime:{time:now+5*86400000}};return r.fulfill({json:{calendar_collection:[item,item,{...item,eventId:'secret',title:'API ASSIGNMENT SECRET',type:'Web Assignment',assignmentId:'future'}]}});}
  if(u.pathname.startsWith('/direct/announcement/')){if(mode!=='supported')return r.fulfill({status:503,body:'Unavailable'});const sid=decodeURIComponent(u.pathname.split('/')[4].replace('.json',''));return r.fulfill({json:{announcement_collection:[{siteId:sid,announcementId:'post',title:'Office hours · '+sid,createdOn:iso(-1)},...(revision?[{siteId:sid,announcementId:'new-post',title:'Additional office hours · '+sid,createdOn:iso(-2)}]:[]),{siteId:sid,announcementId:'future',title:'FUTURE ANNOUNCEMENT SECRET',createdOn:iso(2)}]}});}
  if(u.pathname==='/tool/mission-math')return r.fulfill({contentType:'text/html',body:pageFor(new URL(origin+'/portal/site/math101/page/Assignments?tool=Assignments'))});
  if(u.pathname.startsWith('/portal/')||u.pathname.startsWith('/tool/'))return r.fulfill({contentType:'text/html',body:u.pathname.startsWith('/portal/site/math101/')&&u.searchParams.get('tool')==='Assignments'?'<div class="Mrphs-sakai-assignment-grades"><iframe class="portletMainIframe" src="/tool/mission-math"></iframe></div>':pageFor(u)});
  return r.fulfill({status:404,body:'Fixture does not implement this path'});
 });
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/portal/site/home');await page.locator('#aether-mission-control[data-loading="false"]').waitFor();
 // Initial rendering precedes the deferred fetch, so wait for the actual completed check.
 await page.getByText('Full enrollment coverage unverified',{exact:false}).waitFor();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();
 await test('Cross-course native assignments, API events and announcements; hidden records excluded',async()=>{
  assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),18);
  assert.equal(await page.locator('.mc-next-list [data-type=event]').count(),1);
  assert.equal(await page.locator('.mc-announcement-list [data-type=announcement]').count(),7); // three APIs + native Home and course summaries
  assert.equal(await page.locator('#aether-mission-control').getByText(/SECRET/).count(),0);
  assert.equal(await page.locator('.mc-next-list a').filter({hasText:'Problem set · math101'}).getAttribute('href'),origin+'/portal/site/math101/page/assignment?id=a1');
  assert.equal(await page.locator('.mc-next-list [data-state=overdue]').count(),3);
  assert.equal(await page.locator('.mc-next-list [data-state=unknown]').count(),6);
  assert((await page.locator('.mc-coverage').innerText()).includes('Partial coverage'));
 });
 await test('Composed course/type/status filters, sort, ranges and timeline navigation do not refetch',async()=>{
  const before=requests.length;await page.getByLabel('Course',{exact:true}).selectOption('math101');await page.getByLabel('Type',{exact:true}).selectOption('assignment');await page.getByLabel('Status',{exact:true}).selectOption('completed');assert.equal(await page.locator('.mc-next-list .mc-item').count(),1);
  await page.getByLabel('Status',{exact:true}).selectOption('attention');assert.equal(await page.locator('.mc-next-list .mc-item').count(),3);
  await page.getByLabel('Range',{exact:true}).selectOption('7');assert.equal(await page.locator('.mc-day').count(),7);await page.getByLabel('Next period').click();assert.equal(await page.locator('.mc-next-list .mc-item').count(),0);await page.getByRole('button',{name:'Today',exact:true}).click();
  await page.getByLabel('Sort',{exact:true}).selectOption('course');assert.equal(requests.length,before);
  await page.getByLabel('Status',{exact:true}).selectOption('');await page.getByLabel('Type',{exact:true}).selectOption('');await page.getByLabel('Course',{exact:true}).selectOption('');await page.getByLabel('Range',{exact:true}).selectOption('14');
  await page.getByLabel('Sort',{exact:true}).selectOption('time');
 });
 await test('Announcement baseline compares successful observations, without publication claims',async()=>{
  revision=1;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-new').count(),3);
 });
 await test('Desktop and narrow layout; original course cards and scene retained',async()=>{
  assert.equal(await page.locator('.ae-course-card').count(),3);assert(await page.locator('.ae-hero canvas').count());
  await page.screenshot({path:path.join(report,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});
  assert(await page.locator('#aether-mission-control').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:path.join(report,'mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});
 });
 await test('API failure retains useful cross-course native assignments/events and honest coverage',async()=>{
  mode='fallback';await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();assert.equal(await page.locator('.mc-next-list [data-type=assignment]').count(),18);assert(await page.locator('.mc-next-list [data-type=event]').count()>=3);await page.getByText('Sources & coverage',{exact:true}).click();assert((await page.locator('.mc-source-list').innerText()).includes('Events · unsupported'));assert((await page.locator('.mc-source-list').innerText()).includes('Announcements · failed'));
 });
 await test('OFF aborts pending work, clears private records and ON recovers',async()=>{
  slow=true;await page.getByRole('button',{name:'Refresh academic sources'}).click();await page.locator('#aether-mission-control[data-loading="true"]').waitFor();await page.locator('#aether-native-toggle').click();assert.equal(await page.locator('.mc-item').count(),0);assert.equal(await page.locator('#aether-mission-control').isVisible(),false);await page.waitForTimeout(1200);assert.equal(await page.locator('.mc-item').count(),0);slow=false;await page.locator('#aether-native-toggle').click();await page.locator('#aether-mission-control[data-loading="false"]').waitFor();await page.locator('.mc-next-list .mc-item').first().waitFor();
 });
 await test('Account change clears old records and new baseline; anonymous session blocks reads',async()=>{
  user='fictional-other-user';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);assert.equal(await page.locator('.mc-new').count(),0);await page.locator('#aether-mission-control[data-loading="false"]').waitFor();user='.anon';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);assert.equal(await page.locator('.mc-item').count(),0);
 });
 await test('Existing Home, assignment form and Gradebook remain functional; GET-only metadata',async()=>{
  user='fictional-mission-user';await page.goto(route('Assignment detail'));await page.locator('#academic-form').waitFor();assert.equal(await page.locator('#aether-mission-control').count(),0);assert.equal(await page.locator('input[name=csrf]').inputValue(),'fixture-only-token');
  await page.goto(route('Gradebook student'));await page.locator('#gradeSummaryTable .ae-record-card').first().waitFor();await page.locator('#grade-item-0 .gb-summary-grade-stats').click();await page.getByRole('dialog').waitFor();assert(requests.every(r=>r.method==='GET'));assert.equal(requests.filter(r=>r.path.startsWith('/direct/assignment/')).length,0);assert.deepEqual(errors,[]);
 });
 fs.writeFileSync(path.join(report,'results.json'),JSON.stringify({fixtureOnly:true,results,requests,errors},null,2));
 console.log(`${results.length+1} focused checks passed; authenticated LUMS compatibility remains unverified.`);
})().catch(async e=>{console.error(e);if(page){console.log(JSON.stringify({coverage:await page.locator('.mc-coverage').allTextContents(),source:await page.locator('.mc-source-list').allTextContents(),requests,errors},null,2));await page.screenshot({path:path.join(report,'failure.png'),fullPage:true}).catch(()=>{});}process.exitCode=1;}).finally(async()=>{await context?.close();});

