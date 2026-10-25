/* Home controller. Reuses one view and one request generation across DOM updates. */
(() => {
 'use strict';
 const D=globalThis.AetherAcademicData;
 let view=null,ctx=null,controller=null,job=null,generation=0,account=null,active=false,clock=0,identityTimer=0,focusJob=null;
 let data={records:[],courses:[],sources:[],checkedAt:0},baseline=null,baselineReady=false,newIds=new Set(),showPastAll=false,refreshError='';
 const defaults={course:'',type:'',status:'',sort:'time',days:14,offset:0},filters={...defaults};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 const keyed=(node,key)=>{node.dataset.mcKey=key;return node;};
 const recordKey=r=>JSON.stringify([r.type,r.siteId,r.id]);
 const enabled=()=>document.documentElement.classList.contains('aether-enabled')&&ctx?.home&&!document.body?.classList.contains('is-logged-out')&&!document.querySelector('#loginForm input[type=password]');
 function button(label,fn,accessible){const b=el('button','mc-button',label);b.type='button';if(accessible)b.setAttribute('aria-label',accessible);b.addEventListener('click',fn);return b;}
 function link(label,href,cls=''){const a=el('a',cls,label);a.href=href;return a;}
 // Patch only extension-owned nodes. Stable record/course/day keys keep the
 // actual focused links and controls alive during progressive and clock updates.
 function reconcile(parent,wanted){
  const old=[...parent.childNodes],byKey=new Map(old.filter(n=>n.dataset?.mcKey).map(n=>[n.dataset.mcKey,n])),keep=new Set();
  wanted.forEach((fresh,index)=>{
   const key=fresh.dataset?.mcKey;
   let node=key?byKey.get(key):old[index]?.dataset?.mcKey?null:old[index];
   if(!node||keep.has(node)||node.nodeType!==fresh.nodeType||node.nodeName!==fresh.nodeName)node=fresh;
   else if(node.nodeType===Node.TEXT_NODE){if(node.nodeValue!==fresh.nodeValue)node.nodeValue=fresh.nodeValue;}
   else{
    for(const attr of [...node.attributes])if(!fresh.hasAttribute(attr.name))node.removeAttribute(attr.name);
    for(const attr of fresh.attributes)if(node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
    reconcile(node,[...fresh.childNodes]);
   }
   keep.add(node);if(parent.childNodes[index]!==node)parent.insertBefore(node,parent.childNodes[index]||null);
  });
  for(const node of old)if(!keep.has(node))node.remove();
 }
 function select(label,key,options){
  const l=el('label','mc-control'),s=el('select');s.dataset.filter=key;s.setAttribute('aria-label',label);l.append(el('span','',label),s);
  for(const [value,label]of options){const o=el('option','',label);o.value=value;s.append(o);}s.value=String(filters[key]);
  s.addEventListener('change',()=>{filters[key]=key==='days'?Number(s.value):s.value;if(key==='days')filters.offset=0;render(true);});return l;
 }
 function resetFilters(){Object.assign(filters,defaults);showPastAll=false;render(true);view.querySelector('[data-filter=course]').focus({preventScroll:true});}
 function build(){
  const section=el('section','ae-mission-control');section.id='aether-mission-control';section.setAttribute('aria-labelledby','mc-title');
  const head=el('div','mc-header'),intro=el('div');intro.append(el('div','ae-overline','02 / ACADEMIC COMMAND CENTER'));
  const title=el('h2','','Mission Control');title.id='mc-title';intro.append(title,el('p','mc-intro','Know what’s next. Make room for what matters.'));
  const actions=el('div','mc-actions'),refreshButton=button('Refresh',()=>refresh(true),'Refresh academic sources');refreshButton.dataset.refresh='';actions.append(refreshButton);head.append(intro,actions);section.append(head);
  const coverage=el('p','mc-coverage');coverage.setAttribute('role','status');section.append(coverage,el('p','mc-summary-scope'),el('div','mc-summary'));
  const controls=el('div','mc-controls');controls.append(select('Course','course',[['','All Courses']]),select('Range','days',[['7','7 days'],['14','14 days'],['30','30 days']]),select('Type','type',[['','All items'],['assignment','Assignments'],['event','Events'],['announcement','Announcements']]),select('Status','status',[['','All statuses'],['attention','Needs attention · verified'],['completed','Submitted / completed · verified']]),select('Sort','sort',[['time','Upcoming time'],['course','Course']]));section.append(controls);
  const filterBar=el('div','mc-filter-bar'),filterSummary=el('p','mc-filter-summary');filterSummary.setAttribute('role','status');filterBar.append(filterSummary,button('Reset filters',resetFilters,'Reset Mission Control filters'));section.append(filterBar);
  const grid=el('div','mc-grid'),next=el('section','mc-panel mc-next'),aside=el('div','mc-aside');next.append(el('div','mc-kicker','YOUR NEXT MOVE'),el('h3','','Next Up'),el('div','mc-next-list'));
  const past=el('details','mc-past-due');past.hidden=true;past.append(el('summary'),el('p','mc-note','Verified attention status · open the original assignment to check your options.'),el('div','mc-past-list'),button('Show all',()=>{showPastAll=true;render();view.querySelector('.mc-past-due>summary').focus({preventScroll:true});},'Show all past-due items'));next.append(past);grid.append(next,aside);
  const workload=el('section','mc-panel mc-workload');workload.append(el('h3','','Course outlook'),el('p','mc-note','Observed assignments + events in your selected period.'),el('div','mc-workload-list'));
  const announcements=el('section','mc-panel mc-announcements');announcements.append(el('h3','','Announcements'),el('p','mc-note','Recent posts · “Newly observed” compares successful checks in this tab.'),el('div','mc-announcement-list'));aside.append(workload,announcements);section.append(grid);
  const timeline=el('section','mc-panel mc-timeline'),th=el('div','mc-timeline-head'),nav=el('div','mc-actions');nav.append(button('←',()=>{filters.offset=Math.max(-30,filters.offset-filters.days);render(true);},'Previous period'),button('Today',()=>{filters.offset=0;render(true);}),button('→',()=>{filters.offset=Math.min(60,filters.offset+filters.days);render(true);},'Next period'));th.append(el('h3','','Academic timeline'),nav);timeline.append(th,el('p','mc-period'),el('div','mc-density'),el('div','mc-days'));section.append(timeline);
  const details=el('details','mc-source-details');details.append(el('summary','','Sources & coverage'),el('ul','mc-source-list'),el('p','mc-note','Clear the data held in this tab and its announcement baseline. Refresh to check your sources again.'),button('Clear session data',()=>{clear();render();},'Clear Mission Control data and announcement baseline'));section.append(details,el('p','mc-footer','Read-only · Academic actions stay in Sakai · Dates use your browser time zone unless the source specifies one.'));
  return section;
 }
 function clear(){generation++;controller?.abort();controller=null;job=null;clearInterval(identityTimer);clearTimeout(clock);identityTimer=clock=0;account=null;baseline=null;baselineReady=false;newIds.clear();filters.course='';showPastAll=false;refreshError='';data={records:[],courses:[],sources:[],checkedAt:0};}
 async function verify(){try{return await globalThis.AetherFileState?.session()||null;}catch{return null;}}
 async function refresh(force=false){
  if(!active||!enabled()||job)return job;if(!force&&data.checkedAt&&Date.now()-data.checkedAt<300000)return;
  const epoch=++generation,previous=data,previousAccount=account;controller=new AbortController();const signal=controller.signal;refreshError='';render();
  const run=(async()=>{try{
   const who=await verify();if(signal.aborted||epoch!==generation)return;
   if(!who){clear();data.sources=[{type:'Session',state:'unavailable',note:'Authenticated identity unavailable. Open original Sakai tools.'}];render();return;}
   const retain=previousAccount===who&&previous.checkedAt>0;
   if(account&&account!==who){baseline=null;baselineReady=false;newIds.clear();}account=who;
   if(!retain)data={records:[],courses:[],sources:[],checkedAt:0};render();
   identityTimer=setInterval(async()=>{const current=await verify();if(epoch===generation&&current!==who){clear();render();}},30000);
   let pending=null;
   await globalThis.AetherAcademicSources.load(ctx,signal,snapshot=>{
    if(!signal.aborted&&epoch===generation&&enabled()){pending=snapshot;if(!retain){data=snapshot;render();}}
   });
   const after=await verify();if(signal.aborted||epoch!==generation)return;if(after!==who){clear();render();return;}
   // A refresh replaces the old snapshot only after this same account has been
   // verified again. Initial loads still publish each bounded source as it arrives.
   if(pending)data=pending;
   const announcements=data.records.filter(r=>r.type==='announcement'),ids=new Set(announcements.map(r=>r.siteId+'|'+r.id));
   const reliable=data.sources.filter(s=>s.type==='Announcements').every(s=>s.state==='partial')&&data.sources.some(s=>s.type==='Announcements');
   if(reliable){baselineReady=baseline!==null;newIds=new Set(baseline?[...ids].filter(id=>!baseline.has(id)):[]);baseline=ids;}else{baselineReady=false;newIds.clear();}
  }catch(error){if(!signal.aborted&&epoch===generation){refreshError='Refresh incomplete';data={...data,sources:[...data.sources,{type:'Academic sources',state:'failed',note:'Unable to finish this check. Original Sakai links remain available.'}]};}}
  finally{if(epoch===generation){clearInterval(identityTimer);identityTimer=0;job=null;controller=null;render();}}})();
  job=run;return run;
 }
 function card(r,small=false){
  const s=D.state(r),a=keyed(link(' ',r.url,'mc-item'+(small?' mc-item-small':'')),recordKey(r));a.dataset.record=r.id;a.dataset.type=r.type;a.dataset.state=s.state;
  if(D.attention(r)&&Number.isFinite(r.time)&&r.time>Date.now()&&r.time-Date.now()<86400000)a.dataset.urgency='soon';
  const meta=el('div','mc-item-meta');meta.append(el('span','',r.course),el('span','',r.type));a.replaceChildren(meta,el('h4','',r.title));
  if(Number.isFinite(r.time)){const t=el('time','',r.exact?new Date(r.time).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):new Date(r.time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+' · time unspecified');t.dateTime=new Date(r.time).toISOString();if(r.rawDate)t.title='Source: '+r.rawDate;a.append(t);}
  else a.append(el('span','mc-note','Date unavailable · check Sakai'));
  const foot=el('div','mc-item-foot');foot.append(el('span','mc-badge',s.badges.some(b=>b.kind==='draft')?'Draft saved · not submitted':s.label),el('span','mc-remaining',D.relative(r)),el('span','','↗'));a.append(foot);
  if(newIds.has(r.siteId+'|'+r.id)&&r.type==='announcement')a.append(el('span','mc-new','Newly observed since previous check'));
  a.title=r.source+' · observed '+new Date(r.observedAt).toLocaleTimeString();return a;
 }
 function render(resetLists=false){
  if(!view)return;
  const focused=view.contains(document.activeElement)?document.activeElement:null;
  const scrolls=[...view.querySelectorAll('.mc-next-list,.mc-past-list,.mc-announcement-list,.mc-workload-list')].map(node=>[node,resetLists?0:node.scrollTop]);
  const busy=!!controller,now=Date.now(),selected=D.select(data.records,filters,now),planned=selected.filter(r=>r.type!=='announcement');
  const pastDue=planned.filter(r=>D.attention(r,now)&&Number.isFinite(r.time)&&r.time<now),pastKeys=new Set(pastDue.map(recordKey));
  const elapsed=r=>Number.isFinite(r.time)&&r.time<now;
  const upcoming=planned.filter(r=>!pastKeys.has(recordKey(r))).sort((a,b)=>Number(elapsed(a))-Number(elapsed(b))),announcements=selected.filter(r=>r.type==='announcement').sort((a,b)=>(b.time||0)-(a.time||0));
  view.dataset.loading=String(busy);view.querySelector('[data-refresh]').setAttribute('aria-disabled',String(busy));
  const checked=data.checkedAt?new Date(data.checkedAt).toLocaleTimeString():'';
  text(view.querySelector('.mc-coverage'),busy?checked?`Checking sources · showing the last check from ${checked} · Partial coverage`:'Checking your accessible Sakai sources…':checked?`${refreshError?refreshError+' · ':''}Observed ${data.records.length} items · Partial coverage · Checked ${checked} · Full enrollment coverage unverified`:'Sources unavailable until a successful authenticated check. Refresh or open your original course tools.');
  const scoped=data.records.filter(r=>!filters.course||r.siteId===filters.course),courseName=data.courses.find(c=>c.id===filters.course)?.title||'Selected course';
  text(view.querySelector('.mc-summary-scope'),`${filters.course?courseName:'All courses'} · Deadline and event totals: next 7 days. Attention: all observed dates. Independent of period, type and status filters.`);
  const observed=data.checkedAt>0,assignmentKnown=scoped.some(r=>r.type==='assignment'&&Number.isFinite(r.time)),statusKnown=scoped.some(r=>r.type==='assignment'&&r.verifiedStatus&&D.state(r).state!=='unknown');
  const eventKnown=scoped.some(r=>r.type==='event')||!filters.course&&data.sources.some(s=>s.type==='Events'&&s.state==='partial');
  const newCount=scoped.filter(r=>r.type==='announcement'&&newIds.has(r.siteId+'|'+r.id)).length;
  const stats=[[assignmentKnown?scoped.filter(r=>r.type==='assignment'&&r.time>=now&&r.time<now+7*D.day).length:null,'Due in 7 days','Observed assignments'],[statusKnown?scoped.filter(r=>D.attention(r,now)).length:null,'Need attention','Verified status only'],[eventKnown?scoped.filter(r=>r.type==='event'&&r.time>=now&&r.time<now+7*D.day).length:null,'Events · next 7 days','Accessible calendars'],[baselineReady?newCount:null,'Newly observed','Since previous successful check']];
  reconcile(view.querySelector('.mc-summary'),stats.map(([value,label,note])=>{const tile=el('div','mc-stat');tile.append(el('strong','',value===null?'—':String(value)),el('span','',label),el('small','',value===null?'Unavailable / no baseline':note+' · partial'));return tile;}));
  const courseSelect=view.querySelector('[data-filter=course]'),choices=[...data.courses];if(filters.course&&!choices.some(c=>c.id===filters.course))choices.push({id:filters.course,title:'Selected course · unavailable in this check'});
  const optionSignature=JSON.stringify(choices.map(c=>[c.id,c.title]));if(courseSelect.dataset.signature!==optionSignature){reconcile(courseSelect,[{id:'',title:'All Courses'},...choices].map(c=>{const o=keyed(el('option','',c.title),'course:'+c.id);o.value=c.id;return o;}));courseSelect.dataset.signature=optionSignature;}
  for(const control of view.querySelectorAll('[data-filter]'))if(control.value!==String(filters[control.dataset.filter]))control.value=String(filters[control.dataset.filter]);
  const labels=[filters.course?courseName:'All courses',`${filters.days} days`,filters.type?{assignment:'Assignments',event:'Events',announcement:'Announcements'}[filters.type]:'All items',filters.status?filters.status==='attention'?'Needs attention':'Submitted / completed':'All statuses',filters.sort==='course'?'By course':'Upcoming time'];
  if(filters.offset)labels.push(`${Math.abs(filters.offset)} days ${filters.offset>0?'ahead':'back'}`);text(view.querySelector('.mc-filter-summary'),labels.join(' · '));
  view.querySelector('[aria-label="Reset Mission Control filters"]').disabled=Object.keys(defaults).every(key=>filters[key]===defaults[key]);
  const nextNodes=[];let elapsedLabel=false;
  for(const r of upcoming.slice(0,40)){if(elapsed(r)&&!elapsedLabel){nextNodes.push(keyed(el('p','mc-list-divider',filters.offset?'Earlier in this period':'Earlier today'),'elapsed-label'));elapsedLabel=true;}nextNodes.push(card(r));}
  if(!upcoming.length){nextNodes.push(keyed(el('p','mc-empty',busy&&!observed?'Finding your next move…':observed?'No upcoming items match this period and these filters. Check original course tools for full coverage.':'Your course tools are still within reach. Open a course above or refresh to check again.'),'empty'));if(busy&&!observed)for(let i=0;i<3;i++)nextNodes.push(keyed(el('div','mc-skeleton'),'skeleton:'+i));}
  if(upcoming.length>40)nextNodes.push(keyed(el('p','mc-note','Showing first 40 matching items. Narrow the course or period.'),'limit'));reconcile(view.querySelector('.mc-next-list'),nextNodes);
  const past=view.querySelector('.mc-past-due');past.hidden=!pastDue.length;text(past.querySelector('summary'),`Past due · ${pastDue.length}`);
  pastDue.sort((a,b)=>(filters.sort==='course'?a.course.localeCompare(b.course):0)||b.time-a.time||a.title.localeCompare(b.title));
  reconcile(past.querySelector('.mc-past-list'),pastDue.slice(0,showPastAll?pastDue.length:10).map(r=>card(r)));
  const showAll=past.querySelector('button');showAll.hidden=showPastAll||pastDue.length<=10;text(showAll,`Show all ${pastDue.length} past-due items`);
  const feed=announcements.slice(0,10).map(r=>card(r,true));if(!announcements.length)feed.push(keyed(el('p','mc-empty','No accessible announcements match these filters.'),'empty'));if(announcements.length>10)feed.push(keyed(el('p','mc-note','Showing 10 most recent. Open the original course Announcements for all posts.'),'limit'));reconcile(view.querySelector('.mc-announcement-list'),feed);
  const counts=data.courses.map(c=>({...c,count:upcoming.filter(r=>r.siteId===c.id&&Number.isFinite(r.time)&&r.time>=now).length})),max=Math.max(1,...counts.map(c=>c.count));
  const rows=counts.map(c=>{
   const row=keyed(el('div','mc-course-row'),'course:'+c.id),filter=button(c.title,()=>{filters.course=filters.course===c.id?'':c.id;render(true);});filter.setAttribute('aria-pressed',String(filters.course===c.id));
   const bar=el('span','mc-bar'),fill=el('span');fill.style.width=(c.count/max*100)+'%';bar.setAttribute('aria-hidden','true');bar.append(fill);filter.append(bar,el('span','mc-count',String(c.count)));row.append(filter,link('↗',c.url,'mc-course-open'));row.lastChild.setAttribute('aria-label','Open '+c.title+' in Sakai');return row;
  });
  if(!counts.length)rows.push(keyed(link('Browse original course shortcuts ↗','#aether-course-dock','mc-empty'),'empty'));reconcile(view.querySelector('.mc-workload-list'),rows);
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()+filters.offset);const end=new Date(start);end.setDate(end.getDate()+filters.days-1);
  text(view.querySelector('.mc-period'),`${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} — ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${filters.days} days · observed items`);
  const days=[],density=[];
  for(let i=0;i<filters.days;i++){
   const d=new Date(start);d.setDate(d.getDate()+i);const next=new Date(d);next.setDate(next.getDate()+1);const items=planned.filter(r=>r.time>=+d&&r.time<+next),day=keyed(el('div','mc-day'),'day:'+Number(d));day.id='mc-day-'+i;day.append(el('h4','',d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})));
   items.forEach(r=>day.append(keyed(link(r.title+' ↗',r.url,'mc-day-item'),recordKey(r))));if(!items.length)day.append(keyed(el('span','mc-note','No observed items'),'empty'));days.push(day);
   const tick=keyed(link(String(d.getDate()),'#mc-day-'+i,'mc-tick'),'day:'+Number(d));tick.style.setProperty('--mc-density',String(Math.min(1,items.length/4)));tick.title=items.length+' observed items on '+d.toLocaleDateString();tick.setAttribute('aria-label',tick.title);density.push(tick);
  }
  reconcile(view.querySelector('.mc-days'),days);reconcile(view.querySelector('.mc-density'),density);view.querySelector('.mc-density').setAttribute('aria-label','Daily item density');
  reconcile(view.querySelector('.mc-source-list'),data.sources.map((s,i)=>keyed(el('li','',`${s.type} · ${s.state}: ${s.note}`),'source:'+i)));
  if(focused?.isConnected&&document.activeElement!==focused&&!focused.hidden)focused.focus({preventScroll:true});
  for(const [node,top]of scrolls)if(node.scrollTop!==top)node.scrollTop=top;
  clearTimeout(clock);if(active&&enabled()&&view.isConnected)clock=setTimeout(()=>render(),60000);
 }
 function sync(){const next=enabled();if(!next){active=false;clear();render();return;}if(!active){active=true;setTimeout(()=>refresh(),0);}}
 function mount(context){ctx=context;if(!context?.home){active=false;clear();return null;}if(!view)view=build();sync();if(active&&account&&data.checkedAt){const local=globalThis.AetherAcademicSources.native(ctx.main,{id:'',title:'Home summary'}).map(r=>({...r,pageLocal:true}));data.records=D.unique([...data.records.filter(r=>!r.pageLocal),...local]);}render();return view;}
 window.addEventListener('aether-settings-change',sync);
 document.addEventListener('aether-session-change',()=>{const resume=active&&enabled()&&!!controller;clear();render();if(resume)refresh(true);});
 const focus=()=>{
  if(!active||!enabled()||focusJob)return;const who=account;
  focusJob=(async()=>{const current=await verify();if(!active||!enabled())return;if(who&&who!==current&&account===who){clear();render();}if(current)await refresh();else if(account||data.records.length){clear();render();}})().finally(()=>{focusJob=null;});
 };
 window.addEventListener('focus',focus);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')focus();});
 window.addEventListener('pagehide',()=>{active=false;clear();});window.addEventListener('pageshow',sync);
 globalThis.AetherMissionControl={mount,clear};
})();
