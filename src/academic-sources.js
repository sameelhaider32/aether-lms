/* Bounded, same-origin GET adapters. No submission or instructor endpoints. */
(() => {
 'use strict';
 const D=globalThis.AetherAcademicData,MAX=2*1024*1024,LIMIT=8;
 function nativeURL(value,base){const href=D.url(value,base);if(!href)return null;const u=new URL(href);if(!/^\/(?:portal\/(?:site|tool|directtool)\/|tool\/)/.test(u.pathname)||/logout|login|[?&](?:sakai_action|eventSubmit|action)=/i.test(href))return null;return href;}
 function inert(html){const t=document.createElement('template');t.innerHTML=html;t.content.querySelectorAll('script,style,link,img,object,embed').forEach(n=>n.remove());return t.content;}
 function visible(n){if(n.closest('[hidden],[aria-hidden="true"],.hidden,.d-none'))return false;for(let p=n;p?.nodeType===1;p=p.parentElement)if(/display\s*:\s*none|visibility\s*:\s*hidden/i.test(p.getAttribute('style')||''))return false;return true;}
 function identity(anchor){const u=new URL(anchor.href||anchor.getAttribute('href'),location.href);return u.searchParams.get('assignmentReference')||u.searchParams.get('assignmentId')||u.searchParams.get('id')||u.href;}
 function native(doc,course,base=location.href){
  const records=[];const now=Date.now();let assignmentListSupported=false;
  for(const table of doc.querySelectorAll('.Mrphs-sakai-assignment-grades table,form[name="listAssignmentsForm"] table,table#assignments,table#assignmentList,table#assignments-list')){
   if(!visible(table)||table.querySelector('input[type="checkbox"],input[type="number"],textarea,th#num_submissions,th#remove'))continue;
   const head=table.querySelector('thead tr')||[...table.querySelectorAll('tr')].find(r=>r.querySelector('th'));if(!head)continue;
   const labels=[...head.children].map(n=>D.clean(n.textContent)),column=(id,re)=>{const at=[...head.children].findIndex(n=>n.id===id);return at>=0?at:labels.findIndex(x=>re.test(x));},title=column('title',/^(?:assignment|title)\b/i),status=column('status',/^(?:status|submission status)\b/i),due=column('dueDate',/due/i),open=column('openDate',/open/i);
   // A student status column is essential: never parse an instructor's list.
   if(title<0||status<0)continue;assignmentListSupported=true;
   for(const row of [...table.querySelectorAll('tbody tr')].slice(0,300)){
    if(row===head||!visible(row)||row.querySelector('td[colspan]')||!row.querySelector('td'))continue;const cells=row.children,a=cells[title]?.querySelector('a[href]');if(!a||!visible(a))continue;
    if(table.closest('form[name="listAssignmentsForm"]')&&!/doView_(?:submission|grade|assignment_as_student|assignment_honorPledge)/i.test(a.getAttribute('href')||''))continue;
    const statusText=D.clean(cells[status]?.textContent);if(/not yet open|not open yet|unpublished|hidden|draft assignment/i.test(statusText))continue;
    const raw=n=>n?.querySelector('time[datetime]')?.getAttribute('datetime')||n?.getAttribute('data-sort-value')||D.clean(n?.textContent);
    const openRaw=raw(cells[open]);if(openRaw&&D.date(openRaw)>now)continue;
    const href=D.url(a.getAttribute('href'),base);if(!href||D.siteId(href)&&D.siteId(href)!==course.id)continue;
    const id=identity({href},course);records.push(D.record({id,type:'assignment',siteId:course.id,course:course.title,title:a.textContent,url:href,dueRaw:raw(cells[due]),nativeStatus:statusText,verifiedStatus:true,source:'Native student assignment list'}));
   }
  }
  for(const [selector,type] of [['.Mrphs-sakai-synoptic-announcement .announcement-item,.Mrphs-sakai-synoptic-announcement li,.announcement-item','announcement'],['.Mrphs-sakai-summary-calendar .calendar-event,.calendar-event','event'],['.Mrphs-sakai-summary-assignment .assignment-item,.assignment-item','assignment']]){
   for(const n of [...doc.querySelectorAll(selector)].slice(0,200)){
    if(!visible(n)||n.closest('#aether-workspace')||/not yet open|not open yet|unpublished|draft assignment/i.test(D.clean(n.textContent)))continue;const a=n.querySelector('a[href]'),href=D.url(a?.getAttribute('href'),base);if(!a||!href)continue;
    const sid=D.siteId(href)||course.id;if(course.id&&sid!==course.id)continue;const dateNode=n.querySelector('time[datetime],[data-due-date],[data-start-date]');const raw=dateNode?.getAttribute('datetime')||dateNode?.getAttribute('data-due-date')||dateNode?.getAttribute('data-start-date')||'';
    if(type==='announcement'&&D.date(raw)>now)continue;
    records.push(D.record({id:type==='assignment'?identity({href}):href,type,siteId:sid,course:course.title,title:a.textContent,url:href,[type==='assignment'?'dueRaw':'startRaw']:raw,source:'Native Sakai summary'}));
   }
  }
  const result=D.unique(records);result.assignmentListSupported=assignmentListSupported;return result;
 }
 class Reader{
  constructor(signal){this.signal=signal;this.jobs=new Map();this.bytes=0;this.requests=0;}
  read(path,json=true){const href=D.url(path);if(!href)return Promise.reject(Error('Invalid source URL'));if(this.jobs.has(href))return this.jobs.get(href);const job=this._read(href,json);this.jobs.set(href,job);return job;}
  async _read(href,json){
   if(this.signal.aborted)throw this.signal.reason;if(++this.requests>40)throw Error('Request limit reached');
   const limit=Math.min(MAX,16*1024*1024-this.bytes);if(limit<=0)throw Error('Metadata limit reached');
   const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,8000);this.signal.addEventListener('abort',abort,{once:true});
   try{
    const {bytes}=await globalThis.AetherResourceAccess.read(new URL(href),controller.signal,limit,{cache:'no-store',onbytes:n=>{this.bytes+=n;if(this.bytes>16*1024*1024)throw Error('Metadata limit reached');}});
    if(controller.signal.aborted)throw Error('Read cancelled');const text=new TextDecoder().decode(bytes);return json?JSON.parse(text):inert(text);
   }catch(error){error.state=[404,405,501].includes(error.httpStatus)?'unsupported':'failed';throw error;}
   finally{clearTimeout(timer);this.signal.removeEventListener('abort',abort);}
  }
 }
 function collection(data,name){const items=Array.isArray(data)?data:data?.[name+'_collection'];if(!Array.isArray(items)||items.length>1500)throw Error('Unsupported response model');return items;}
 async function pool(items,fn){let index=0;await Promise.all([0,1].map(async()=>{while(index<items.length){const item=items[index++];await fn(item);}}));}
 function navigation(doc,course,base=location.href){
  return [...doc.querySelectorAll('#toolMenu .is-current-site .site-page-list a[href]')].slice(0,40).map(a=>({title:D.clean(a.textContent),url:nativeURL(a.getAttribute('href'),base),siteId:course.id,course:course.title})).filter(t=>t.title&&t.url&&(!D.siteId(t.url)||D.siteId(t.url)===course.id));
 }
 async function load(ctx,signal,publish){
  const reader=new Reader(signal),courses=new Map(),records=[],tools=new Map(),sources=[];
  const put=(id,title,href)=>{if(typeof id==='string'&&id&&id!=='home'&&!id.startsWith('~'))courses.set(id,{id,title:D.clean(title)||id,url:href||location.origin+'/portal/site/'+encodeURIComponent(id)});};
  for(const s of ctx.sites){if(!s.home)put(D.siteId(s.href),s.title,s.href);}
  const emit=()=>{if(!signal.aborted)publish({courses:[...courses.values()],records:D.unique(records).map(r=>({...r,course:courses.get(r.siteId)?.title||r.course})),tools:[...tools.values()],sources:[...sources],checkedAt:Date.now()});};
  const source=(type,state,note)=>{sources.push({type,state,note});emit();};
  records.push(...native(ctx.main,ctx.active&&!ctx.active.home?{id:D.siteId(ctx.active.href),title:ctx.active.title}:{id:'',title:'Home summary'}).map(r=>({...r,pageLocal:true})));emit();
  try{const sites=collection(await reader.read('/direct/site.json?select=access&_limit=50&_start=0'),'site');for(const s of sites.slice(0,50))if(['course','project'].includes(s.type))put(s.id||s.entityId,s.title);source('Courses','partial',`Navigation + up to 50 accessible sites; enrollment completeness unverified`);}catch(e){source('Courses',e.state||'failed','Using original course navigation');}
  const start=new Date();start.setDate(start.getDate()-30);const end=new Date();end.setDate(end.getDate()+90);const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await Promise.all([
   (async()=>{try{
    const items=collection(await reader.read('/direct/calendar/my.json?firstDate='+iso(start)+'&lastDate='+iso(end)),'calendar');let omitted=0;
    for(const e of items){
     // Assignment-generated events can reveal unreleased titles; the student list is authoritative.
     if(e.assignmentId||/assignment/i.test(e.type)||e.draft===true||e.hidden===true||e.visible===false){omitted++;continue;}
     if(typeof e.siteId!=='string'||!e.eventId||!e.title||!Number.isFinite(D.date(e.firstTime))){omitted++;continue;}
     put(e.siteId,courses.get(e.siteId)?.title||e.siteName);
     records.push(D.record({id:e.eventId,type:'event',siteId:e.siteId,course:e.siteName,title:e.title,startRaw:e.firstTime?.time??e.firstTime,url:location.origin+'/portal/site/'+encodeURIComponent(e.siteId),source:'Sakai calendar · open course Calendar for details'}));
    }
    source('Events','partial',`Calendar API loaded; inaccessible calendars may be omitted${omitted?'; '+omitted+' unsafe or unsupported records excluded':''}. Recurrences only as returned.`);
   }catch(e){source('Events',e.state||'failed','Calendar API unavailable; native summaries remain available');}})(),
   (async()=>{await pool([...courses.values()].slice(0,LIMIT),async c=>{if(signal.aborted)return;try{
    const items=collection(await reader.read('/direct/announcement/site/'+encodeURIComponent(c.id)+'.json?n=20&d=30'),'announcement');
    for(const a of items.slice(0,20)){if(a.siteId!==c.id||!a.announcementId||!a.title||a.draft===true||a.hidden===true||a.visible===false||D.date(a.createdOn)>Date.now())continue;records.push(D.record({id:a.announcementId,type:'announcement',siteId:c.id,course:c.title,title:a.title,startRaw:a.createdOn,url:c.url,source:'Sakai announcements · open course Announcements for details'}));}
    source('Announcements','partial',c.title+': up to 20 visible announcements / last 30 days');
   }catch(e){source('Announcements',e.state||'failed',c.title+': API unavailable; using native summary');}});})()
  ]);
  // Assignment my/site APIs are deliberately not requested: their list contract does
  // not guarantee student release/group visibility. Read discovered student views.
  await pool([...courses.values()].slice(0,LIMIT),async c=>{
   if(signal.aborted)return;try{
    const page=await reader.read(c.url,false);records.push(...native(page,c,c.url));for(const tool of navigation(page,c,c.url))tools.set(tool.siteId+tool.url,tool);emit();
    const active=[...page.querySelectorAll('#toolMenu .is-current-site .site-page-list a[href]')];
    for(const [type,pattern]of [['announcement',/^announcements?$/i],['event',/^(?:calendar|schedule)$/i]]){const a=active.find(a=>pattern.test(D.clean(a.textContent))),href=nativeURL(a?.getAttribute('href'),c.url);if(href&&D.siteId(href)===c.id)for(const r of records)if(r.siteId===c.id&&r.type===type&&r.source.startsWith('Sakai '))r.url=href;}
    const assignment=active.find(a=>/^assignments?$/i.test(D.clean(a.textContent)));
    if(!assignment){source('Assignments','partial',c.title+': no native Assignments link discovered');return;}
    const href=nativeURL(assignment.getAttribute('href'),c.url);if(!href||D.siteId(href)!==c.id)throw Error('Unsupported native tool link');
    const tool=await reader.read(href,false),parsed=native(tool,c,href);let supported=parsed.assignmentListSupported;records.push(...parsed);
    const frame=tool.querySelector('.Mrphs-sakai-assignment-grades iframe[src],iframe.portletMainIframe[src]');
    if(frame){const src=nativeURL(frame.getAttribute('src'),href);if(src){const parsed=native(await reader.read(src,false),c,src);supported ||= parsed.assignmentListSupported;records.push(...parsed);}}
    source('Assignments',supported?'partial':'unsupported',c.title+(supported?': visible student list observed (up to 300 rows); native pagination may omit items':': student-list schema unavailable; open original Assignments'));
   }catch(e){source('Assignments',e.state||'failed',c.title+': native list unavailable');}
  });
  source('Coverage','partial',`Bounded to ${LIMIT} course scans per check; summaries and returned records only. This is not a complete semester inventory.`);
  return {reader};
 }
 globalThis.AetherAcademicSources={load,native,navigation,nativeURL,Reader,collection};
})();
