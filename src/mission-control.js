/* Home controller. Reuses one view and one request generation across DOM updates. */
(() => {
 'use strict';
 const D=globalThis.AetherAcademicData;
 let view=null,ctx=null,controller=null,job=null,generation=0,account=null,active=false,clock=0,identityTimer=0;
 let data={records:[],courses:[],sources:[],checkedAt:0},baseline=null,baselineReady=false,newIds=new Set();
 const filters={course:'',type:'',status:'',sort:'time',days:14,offset:0};
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const enabled=()=>document.documentElement.classList.contains('aether-enabled')&&ctx?.home&&!document.body?.classList.contains('is-logged-out')&&!document.querySelector('#loginForm input[type=password]');
 function button(text,fn,label){const b=el('button','mc-button',text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b;}
 function link(text,href,cls=''){const a=el('a',cls,text);a.href=href;return a;}
 function select(label,key,options){const l=el('label','mc-control'),s=el('select');s.dataset.filter=key;s.setAttribute('aria-label',label);l.append(el('span','',label),s);for(const [value,text]of options){const o=el('option','',text);o.value=value;s.append(o);}s.value=String(filters[key]);s.addEventListener('change',()=>{filters[key]=key==='days'?Number(s.value):s.value;if(key==='days')filters.offset=0;render();});return l;}
 function build(){
  const section=el('section','ae-mission-control');section.id='aether-mission-control';section.setAttribute('aria-labelledby','mc-title');
  const head=el('div','mc-header'),intro=el('div');intro.append(el('div','ae-overline','02 / ACADEMIC COMMAND CENTER'));const title=el('h2','','Mission Control');title.id='mc-title';intro.append(title,el('p','mc-intro','Know what’s next. Make room for what matters.'));
  const actions=el('div','mc-actions');actions.append(button('Refresh',()=>refresh(true),'Refresh academic sources'),button('Clear session data',()=>{clear();render();},'Clear Mission Control data and announcement baseline'));actions.firstChild.dataset.refresh='';head.append(intro,actions);section.append(head);
  const coverage=el('p','mc-coverage');coverage.setAttribute('role','status');section.append(coverage,el('div','mc-summary'));
  const controls=el('div','mc-controls');controls.append(select('Course','course',[['','All Courses']]),select('Range','days',[['7','7 days'],['14','14 days'],['30','30 days']]),select('Type','type',[['','All items'],['assignment','Assignments'],['event','Events'],['announcement','Announcements']]),select('Status','status',[['','All statuses'],['attention','Needs attention · verified'],['completed','Submitted / completed · verified']]),select('Sort','sort',[['time','Upcoming time'],['course','Course']]));section.append(controls);
  const grid=el('div','mc-grid'),next=el('section','mc-panel mc-next'),aside=el('div','mc-aside');next.append(el('div','mc-kicker','YOUR NEXT MOVE'),el('h3','','Next Up'),el('div','mc-next-list'));grid.append(next,aside);
  const workload=el('section','mc-panel mc-workload');workload.append(el('h3','','Course outlook'),el('p','mc-note','Observed assignments + events in your selected period.'),el('div','mc-workload-list'));const announcements=el('section','mc-panel mc-announcements');announcements.append(el('h3','','Announcements'),el('p','mc-note','Recent posts · “Newly observed” compares successful checks in this tab.'),el('div','mc-announcement-list'));aside.append(workload,announcements);section.append(grid);
  const timeline=el('section','mc-panel mc-timeline'),th=el('div','mc-timeline-head'),nav=el('div','mc-actions');nav.append(button('←',()=>{filters.offset=Math.max(-30,filters.offset-filters.days);render();},'Previous period'),button('Today',()=>{filters.offset=0;render();}),button('→',()=>{filters.offset=Math.min(60,filters.offset+filters.days);render();},'Next period'));th.append(el('h3','','Academic timeline'),nav);timeline.append(th,el('p','mc-period'),el('div','mc-density'),el('div','mc-days'));section.append(timeline);
  const details=el('details','mc-source-details');details.append(el('summary','','Sources & coverage'),el('ul','mc-source-list'));section.append(details,el('p','mc-footer','Read-only · Academic actions stay in Sakai · Dates use your browser time zone unless the source specifies one.'));
  return section;
 }
 function clear(){generation++;controller?.abort();controller=null;job=null;clearInterval(identityTimer);clearTimeout(clock);identityTimer=clock=0;account=null;baseline=null;baselineReady=false;newIds.clear();filters.course='';data={records:[],courses:[],sources:[],checkedAt:0};}
 async function verify(){const value=await globalThis.AetherFileState?.session();return value||null;}
 async function refresh(force=false){
  if(!active||!enabled()||job)return job;if(!force&&data.checkedAt&&Date.now()-data.checkedAt<300000)return;
  const epoch=++generation;controller=new AbortController();const signal=controller.signal;view.dataset.loading='true';render();
  const run=(async()=>{try{
   const who=await verify();if(signal.aborted||epoch!==generation)return;if(!who){data={records:[],courses:[],sources:[{type:'Session',state:'unavailable',note:'Authenticated identity unavailable. Open original Sakai tools.'}],checkedAt:0};return;}
   if(account&&account!==who){baseline=null;baselineReady=false;newIds.clear();data={records:[],courses:[],sources:[],checkedAt:0};}account=who;
   data={records:[],courses:[],sources:[],checkedAt:0};render();
   identityTimer=setInterval(async()=>{const current=await verify();if(epoch===generation&&current!==who){clear();render();}},30000);
   await globalThis.AetherAcademicSources.load(ctx,signal,snapshot=>{if(!signal.aborted&&epoch===generation&&enabled()){data=snapshot;render();}});
   const after=await verify();if(signal.aborted||epoch!==generation)return;if(after!==who){clear();render();return;}
   const announcements=data.records.filter(r=>r.type==='announcement'),ids=new Set(announcements.map(r=>r.siteId+'|'+r.id));
   // No durable first-seen storage and no claim of publication freshness.
   const reliable=data.sources.filter(s=>s.type==='Announcements').every(s=>s.state==='partial')&&data.sources.some(s=>s.type==='Announcements');
   if(reliable){baselineReady=baseline!==null;newIds=new Set(baseline?[...ids].filter(id=>!baseline.has(id)):[]);baseline=ids;}else{baselineReady=false;newIds.clear();}
  }catch(error){if(!signal.aborted)data.sources.push({type:'Academic sources',state:'failed',note:'Unable to finish this check. Original Sakai links remain available.'});}
  finally{if(epoch===generation){clearInterval(identityTimer);identityTimer=0;job=null;controller=null;view.dataset.loading='false';render();}}})();
  job=run;return run;
 }
 function card(r,small=false){
  const s=D.state(r),a=link(' ',r.url,'mc-item'+(small?' mc-item-small':''));a.dataset.record=r.id;a.dataset.type=r.type;a.dataset.state=s.state;
  if(D.attention(r)&&Number.isFinite(r.time)&&r.time>Date.now()&&r.time-Date.now()<86400000)a.dataset.urgency='soon';
  const meta=el('div','mc-item-meta');meta.append(el('span','',r.course),el('span','',r.type));a.replaceChildren(meta,el('h4','',r.title));
  if(Number.isFinite(r.time)){const t=el('time','',r.exact?new Date(r.time).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):new Date(r.time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+' · time unspecified');t.dateTime=new Date(r.time).toISOString();if(r.rawDate)t.title='Source: '+r.rawDate;a.append(t);}
  else a.append(el('span','mc-note','Date unavailable · check Sakai'));
  const foot=el('div','mc-item-foot');foot.append(el('span','mc-badge',s.badges.some(b=>b.kind==='draft')?'Draft saved · not submitted':s.label),el('span','mc-remaining',D.relative(r)),el('span','','↗'));a.append(foot);
  if(newIds.has(r.siteId+'|'+r.id)&&r.type==='announcement')a.append(el('span','mc-new','Newly observed since previous check'));
  a.title=r.source+' · observed '+new Date(r.observedAt).toLocaleTimeString();return a;
 }
 function render(){
  if(!view)return;const busy=!!controller,now=Date.now(),selected=D.select(data.records,filters,now),upcoming=selected.filter(r=>r.type!=='announcement'),announcements=selected.filter(r=>r.type==='announcement').sort((a,b)=>(b.time||0)-(a.time||0));
  view.dataset.loading=String(busy);view.querySelector('[data-refresh]').disabled=busy;
  const coverage=view.querySelector('.mc-coverage');coverage.textContent=busy?'Checking your accessible Sakai sources…':data.checkedAt?`Observed ${data.records.length} items · Partial coverage · Checked ${new Date(data.checkedAt).toLocaleTimeString()} · Full enrollment coverage unverified`:'Sources unavailable until a successful authenticated check. Refresh or open your original course tools.';
  const summary=view.querySelector('.mc-summary');summary.replaceChildren();const observed=data.checkedAt>0;const assignmentKnown=data.records.some(r=>r.type==='assignment'&&Number.isFinite(r.time)),statusKnown=data.records.some(r=>r.type==='assignment'&&r.verifiedStatus&&D.state(r).state!=='unknown'),eventKnown=data.sources.some(s=>s.type==='Events'&&s.state==='partial')||data.records.some(r=>r.type==='event');
  for(const [value,label,note]of [[assignmentKnown?data.records.filter(r=>r.type==='assignment'&&r.time>=now&&r.time<now+7*D.day).length:null,'Due in 7 days','Observed assignments'],[statusKnown?data.records.filter(r=>D.attention(r,now)).length:null,'Need attention','Verified status only'],[eventKnown?data.records.filter(r=>r.type==='event'&&r.time>=now&&r.time<now+7*D.day).length:null,'Events · next 7 days','Accessible calendars'],[baselineReady&&!busy?newIds.size:null,'Newly observed','Since previous successful check']]){const tile=el('div','mc-stat');tile.append(el('strong','',value===null?'—':String(value)),el('span','',label),el('small','',value===null?'Unavailable / no baseline':note+' · partial'));summary.append(tile);}
  const courseSelect=view.querySelector('[data-filter=course]'),choices=[...data.courses];if(filters.course&&!choices.some(c=>c.id===filters.course))choices.push({id:filters.course,title:'Selected course · unavailable in this check'});const optionSignature=choices.map(c=>c.id+c.title).join('|');if(courseSelect.dataset.signature!==optionSignature){courseSelect.replaceChildren();for(const c of [{id:'',title:'All Courses'},...choices]){const o=el('option','',c.title);o.value=c.id;courseSelect.append(o);}courseSelect.dataset.signature=optionSignature;}courseSelect.value=filters.course;
  const list=view.querySelector('.mc-next-list');list.replaceChildren();if(!upcoming.length){list.append(el('p','mc-empty',busy?'Finding your next move…':observed?'No observed items match this period and these filters. Check original course tools for full coverage.':'Your course tools are still within reach. Open a course below or refresh to check again.'));if(busy)for(let i=0;i<3;i++)list.append(el('div','mc-skeleton'));}else upcoming.slice(0,40).forEach(r=>list.append(card(r)));if(upcoming.length>40)list.append(el('p','mc-note','Showing first 40 matching items. Narrow the course or period.'));
  const feed=view.querySelector('.mc-announcement-list');feed.replaceChildren();announcements.slice(0,10).forEach(r=>feed.append(card(r,true)));if(!announcements.length)feed.append(el('p','mc-empty','No accessible announcements match these filters.'));if(announcements.length>10)feed.append(el('p','mc-note','Showing 10 most recent. Open the original course Announcements for all posts.'));
  const work=view.querySelector('.mc-workload-list');work.replaceChildren();const counts=data.courses.map(c=>({...c,count:upcoming.filter(r=>r.siteId===c.id&&Number.isFinite(r.time)&&r.time>=now).length})),max=Math.max(1,...counts.map(c=>c.count));
  for(const c of counts){const row=el('div','mc-course-row'),filter=button(c.title,()=>{filters.course=filters.course===c.id?'':c.id;courseSelect.value=filters.course;render();});filter.setAttribute('aria-pressed',String(filters.course===c.id));const bar=el('span','mc-bar'),fill=el('span');fill.style.width=(c.count/max*100)+'%';bar.setAttribute('aria-hidden','true');bar.append(fill);filter.append(bar,el('span','mc-count',String(c.count)));row.append(filter,link('↗',c.url,'mc-course-open'));row.lastChild.setAttribute('aria-label','Open '+c.title+' in Sakai');work.append(row);}
  if(!counts.length)work.append(link('Browse original course shortcuts ↗','#aether-course-dock','mc-empty'));
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()+filters.offset);const end=new Date(start);end.setDate(end.getDate()+filters.days-1);view.querySelector('.mc-period').textContent=`${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} — ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${filters.days} days · observed items`;
  const days=view.querySelector('.mc-days'),density=view.querySelector('.mc-density');days.replaceChildren();density.replaceChildren();density.setAttribute('aria-label','Daily item density');
  for(let i=0;i<filters.days;i++){const d=new Date(start);d.setDate(d.getDate()+i);const next=new Date(d);next.setDate(next.getDate()+1);const items=upcoming.filter(r=>r.time>=+d&&r.time<+next);const day=el('div','mc-day');day.id='mc-day-'+i;day.append(el('h4','',d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})));items.forEach(r=>day.append(link(r.title+' ↗',r.url,'mc-day-item')));if(!items.length)day.append(el('span','mc-note','No observed items'));days.append(day);const tick=link(String(d.getDate()),'#mc-day-'+i,'mc-tick');tick.style.setProperty('--mc-density',String(Math.min(1,items.length/4)));tick.title=items.length+' observed items on '+d.toLocaleDateString();tick.setAttribute('aria-label',tick.title);density.append(tick);}
  const sourceList=view.querySelector('.mc-source-list');sourceList.replaceChildren();data.sources.forEach(s=>sourceList.append(el('li','',`${s.type} · ${s.state}: ${s.note}`)));
  clearTimeout(clock);if(active&&enabled()&&view.isConnected)clock=setTimeout(render,60000);
 }
 function sync(){const next=enabled();if(!next){active=false;clear();render();return;}if(!active){active=true;setTimeout(()=>refresh(),0);}}
 function mount(context){ctx=context;if(!context?.home){active=false;clear();return null;}if(!view)view=build();sync();if(active&&account&&data.checkedAt){const local=globalThis.AetherAcademicSources.native(ctx.main,{id:'',title:'Home summary'}).map(r=>({...r,pageLocal:true}));data.records=D.unique([...data.records.filter(r=>!r.pageLocal),...local]);}render();return view;}
 window.addEventListener('aether-settings-change',sync);
 document.addEventListener('aether-session-change',()=>{clear();render();});
 const focus=async()=>{if(!active||!enabled())return;const who=account;view.style.visibility='hidden';const current=await verify();if(who&&who!==current){clear();render();}view.style.visibility='';if(active&&enabled())refresh();};
 window.addEventListener('focus',focus);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')focus();});
 window.addEventListener('pagehide',()=>{active=false;clear();});window.addEventListener('pageshow',sync);
 globalThis.AetherMissionControl={mount,clear};
})();
