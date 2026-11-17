/* Minimal presentation. Native navigation and shared academic store stay authoritative. */
(() => {
 'use strict';
 if(window!==top||globalThis.AetherMinimal)return;
 const root=document.documentElement,D=globalThis.AetherAcademicData;
 let ctx=null,nav=null,aside=null,section=null,drawer=false,opener=null,frame=0,selection='Dashboard',navSignature='',nativeState=[],toolsExpanded=false;
 let month=new Date(),day=new Date().getDate();month.setDate(1);
 const active=()=>root.classList.contains('aether-enabled')&&root.dataset.aetherTheme==='minimal'&&!!ctx;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=el('button','am-button',text);b.type='button';b.addEventListener('click',fn);return b;};
 function anchor(text,href,original){const a=el('a','',text),url=D?.url(href);if(!url)return el('span','am-note',text+' · unavailable');a.href=url;if(original)a.addEventListener('click',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0){const links=[...document.querySelectorAll('#toolMenu .is-current-site .site-page-list a[href]')],current=links.find(n=>n.href===url&&D.clean(n.textContent)===text)||links.find(n=>n.href===url);if(current){e.preventDefault();current.click();}}});return a;}
 function close(restore=true){for(const [node,name,value] of nativeState){if(node.isConnected&&!node.hasAttribute(name)){if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);}}nativeState=[];drawer=false;root.style.removeProperty('--am-drawer-top');root.classList.remove('am-tools-open');nav?.querySelector('[data-am-tools]')?.setAttribute('aria-expanded','false');if(restore&&opener?.isConnected)opener.focus();opener=null;}
 function tools(b){if(drawer){close();return;}if(section&&!section.hidden)closeSection(false);drawer=true;opener=b.closest('#aether-minimal-section')?nav.querySelector('[data-am-tools]'):b;for(const node of document.querySelectorAll('#toolMenu,#portal-nav-sidebar,.portal-nav-sidebar'))for(const name of ['hidden','inert','aria-hidden'])if(node.hasAttribute(name)){nativeState.push([node,name,node.getAttribute(name)]);node.removeAttribute(name);}root.style.setProperty('--am-drawer-top',Math.max(70,nav.getBoundingClientRect().bottom+8)+'px');root.classList.add('am-tools-open');nav.querySelector('[data-am-tools]').setAttribute('aria-expanded','true');document.querySelector('#toolMenu a[href]')?.focus();}
 function snapshot(){return globalThis.AetherAcademicStore?.snapshot()||{records:[],courses:[],tools:[],sources:[]};}
 function destinations(name){
  const re=name==='Grades'?/gradebook|grades/i:/resources/i;
  const seen=new Set(),items=[];
  for(const t of [...(ctx?.menu||[]),...snapshot().tools]){const text=t.text||t.title||t.name||t.type||'',href=D?.url(t.href||t.url);if(!re.test(text)||!href||seen.has(href))continue;seen.add(href);items.push({title:(t.course||t.courseTitle||ctx.courseTitle||'Current site')+' · '+text,href});}
  return items;
 }
 function underlyingSection(){return ctx?.home?(location.hash==='#aether-mission-control'?'Planner':'Dashboard'):ctx?.resources?'Resources':/gradebook|grades/i.test(ctx?.toolTitle||'')?'Grades':'Courses';}
 function syncNavigation(){nav?.querySelectorAll('[data-am-section]').forEach(b=>{const name=b.dataset.amSection;b.setAttribute('aria-pressed',String(name===selection));if(b.hasAttribute('aria-controls'))b.setAttribute('aria-expanded',String(name===selection&&section&&!section.hidden));});}
 function closeSection(restore=true){const source=nav?.querySelector(`[data-am-section="${selection}"]`);if(section)section.hidden=true;selection=underlyingSection();syncNavigation();if(restore)source?.focus();}
 function choose(name){selection=name;close(false);renderSection();syncNavigation();
  if(name==='Dashboard'){const home=ctx.sites.find(s=>s.home);if(!ctx.home&&home)location.assign(home.href);else document.querySelector('#aether-workspace')?.scrollIntoView({block:'start'});}
  if(name==='Planner'){const mc=document.querySelector('#aether-mission-control'),home=ctx.sites.find(s=>s.home);if(mc)mc.scrollIntoView({block:'start'});else if(home){const url=new URL(home.href);url.hash='aether-mission-control';location.assign(url.href);}else{section.hidden=false;section.setAttribute('aria-label','Planner availability');section.replaceChildren(el('h2','','Planner'),el('p','','No verified Dashboard destination in this view. Use native course navigation.'),button('Close section',()=>closeSection()));section.querySelector('button').focus();}syncNavigation();}
 }
 function renderSection(){
  if(!section||!active())return;section.hidden=!['Courses','Grades','Resources'].includes(selection);if(section.hidden)return;
  section.replaceChildren(el('h2','',selection));const list=el('div','am-destinations');
  const items=selection==='Courses'?[...new Map([...ctx.sites.filter(s=>!s.home).map(s=>({title:s.title,href:s.href})),...snapshot().courses.map(s=>({title:s.title,href:s.url}))].filter(s=>D.url(s.href)).map(s=>[s.href,s])).values()]:destinations(selection);
  for(const item of items)list.append(anchor(item.title,item.href));
  if(!items.length)list.append(el('p','am-note','No verified '+selection.toLowerCase()+' destinations in this view. Open a course and use its native tools.'));
  section.setAttribute('aria-label',selection+' destinations');section.append(list,button('All native tools',e=>tools(e.currentTarget)),button('Close section',()=>closeSection()));(section.querySelector('a')||section.querySelector('button'))?.focus({preventScroll:true});syncNavigation();section.scrollIntoView({block:'nearest'});
 }
 function calendar(){
  if(!aside)return;const focused=aside.contains(document.activeElement)?document.activeElement:null,focusKey=focused?.dataset.amKey,panelIndex=focused?[...aside.children].indexOf(focused.closest('.am-panel')):-1;const data=snapshot(),records=data.records.filter(r=>Number.isFinite(r.time)&&r.type!=='announcement'),box=el('section','am-panel'),head=el('div','am-calendar-head');
  head.append(button('←',()=>{month.setMonth(month.getMonth()-1);day=1;paint();}),el('h2','',month.toLocaleDateString(undefined,{month:'long',year:'numeric'})),button('→',()=>{month.setMonth(month.getMonth()+1);day=1;paint();}));
  head.firstChild.dataset.amKey='previous-month';head.lastChild.dataset.amKey='next-month';head.firstChild.setAttribute('aria-label','Previous month');head.lastChild.setAttribute('aria-label','Next month');box.append(head);
  const grid=el('div','am-calendar');grid.setAttribute('aria-label','Academic calendar');
  for(const name of ['Su','Mo','Tu','We','Th','Fr','Sa'])grid.append(el('span','am-weekday',name));
  const buckets=new Map();for(const r of records){const d=new Date(r.time);if(d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth()){const n=d.getDate();if(!buckets.has(n))buckets.set(n,[]);buckets.get(n).push(r);}}
  const first=new Date(month.getFullYear(),month.getMonth(),1).getDay(),count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for(let i=0;i<first;i++)grid.append(el('span'));
  for(let n=1;n<=count;n++){const date=new Date(month.getFullYear(),month.getMonth(),n),end=new Date(month.getFullYear(),month.getMonth(),n+1),items=buckets.get(n)||[],b=button(String(n),()=>{day=n;paint();aside.querySelector(`[data-am-day="${n}"]`)?.focus();});b.dataset.amDay=n;b.dataset.amKey='day-'+n;b.setAttribute('aria-pressed',String(day===n));b.setAttribute('aria-label',date.toLocaleDateString(undefined,{dateStyle:'full'})+' · '+items.length+' observed items');if(items.length)b.classList.add('am-has-events');if(date.toDateString()===new Date().toDateString())b.setAttribute('aria-current','date');grid.append(b);}
  box.append(grid,el('p','am-note',data.sources.some(s=>s.type==='Events'&&s.state==='partial')?'Observed calendar and deadlines · partial coverage':data.sources.some(s=>s.type==='Events')?'Calendar API unavailable · native summaries and observed deadlines only.':'Calendar coverage not yet verified. Check sources in Planner.'));
  const selected=new Date(month.getFullYear(),month.getMonth(),day),end=new Date(month.getFullYear(),month.getMonth(),day+1),items=buckets.get(day)||[];
  box.append(el('h3','',selected.toLocaleDateString(undefined,{month:'short',day:'numeric'})));
  for(const r of items.slice(0,8))box.append(record(r));if(!items.length)box.append(el('p','am-note','No observed items for this day.'));
  const next=el('section','am-panel');next.append(el('h2','','Next Up'),el('p','am-note','Read-only · observed deadlines and events'));
  const upcoming=records.filter(r=>r.time>=Date.now()&&(r.type!=='assignment'||D.attention(r))).sort((a,b)=>a.time-b.time).slice(0,5);
  for(const r of upcoming)next.append(record(r));if(!upcoming.length)next.append(el('p','am-note',data.checkedAt?'No upcoming items observed. Check Sources & coverage below.':'Sources not yet available. Open Mission Control below.'));
  next.append(anchor('Full planner & coverage','#aether-mission-control'));aside.replaceChildren(box,next);if(focusKey)aside.children[panelIndex]?.querySelector(`[data-am-key="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});
 }
 function record(r){const a=anchor(r.title,r.url);a.classList.add('am-agenda-item');a.dataset.amKey=JSON.stringify([r.type,r.siteId,r.id]);a.append(el('small','',r.course+' · '+new Date(r.time).toLocaleString(undefined,{month:'short',day:'numeric',...(r.exact?{hour:'numeric',minute:'2-digit'}:{})})+' · '+D.state(r).label));return a;}
 function paint(){frame=0;if(!active()){document.querySelectorAll('#aether-workspace .am-greeting,#aether-workspace .am-observed').forEach(n=>n.remove());close(false);delete root.dataset.amNavigation;nav?.remove();nav=null;aside?.remove();aside=null;section?.remove();section=null;return;}
  const workspace=document.querySelector('#aether-workspace');
  if(!nav?.isConnected){navSignature='';nav=el('nav','am-nav');nav.id='aether-minimal-nav';nav.setAttribute('aria-label','Aether primary navigation');nav.append(el('strong','am-brand','Aether'));
   const primary=el('div','am-primary');nav.append(primary);for(const name of ['Dashboard','Courses','Planner','Grades','Resources']){const b=button(name,()=>choose(name));b.dataset.amSection=name;if(['Courses','Grades','Resources','Planner'].includes(name)){b.setAttribute('aria-controls','aether-minimal-section');b.setAttribute('aria-expanded','false');}b.setAttribute('aria-pressed',String(name===selection));primary.append(b);}
   const all=button('All Tools',e=>tools(e.currentTarget));all.dataset.amTools='';all.setAttribute('aria-expanded','false');all.setAttribute('aria-controls','toolMenu');nav.append(all,button('Close tools',()=>close()));nav.lastChild.classList.add('am-close-tools');document.querySelector('.portal-header')?.prepend(nav);
  }
  // Only hide the native navigation once the complete native-tool drawer is usable.
  const menu=document.querySelector('#toolMenu');nav.querySelector('[data-am-tools]').disabled=!menu;if(nav.isConnected&&menu)root.dataset.amNavigation='ready';else{delete root.dataset.amNavigation;close(false);}
  if(navSignature!==ctx.signature){navSignature=ctx.signature;let sub=nav.querySelector('.am-context');if(sub)sub.remove();
  if(!ctx.home){sub=el('div','am-context');sub.append(el('strong','',ctx.courseTitle||'Current site'));
   for(const t of ctx.menu){const a=anchor(t.text,t.href,[...document.querySelectorAll('#toolMenu .is-current-site .site-page-list a[href]')].find(a=>a.href===t.href));if(t.active||t.text===ctx.toolTitle||new URL(t.href,location.href).pathname===location.pathname||[...document.querySelectorAll('#toolMenu .is-current-site .site-page-list a[href]')].some(n=>n.href===t.href&&(n.getAttribute('aria-current')==='page'||n.closest('.is-current-page,.is-current-tool,.current-page,.selected,.active'))))a.setAttribute('aria-current','page');sub.append(a);}nav.append(sub);}}
  syncNavigation();
  if(!workspace)return;
  const dock=workspace.querySelector('#aether-tool-dock');if(dock&&!dock.closest('.am-tool-customization')){const details=el('details','am-tool-customization');details.open=toolsExpanded;details.addEventListener('toggle',()=>{toolsExpanded=details.open;});const summary=el('summary','','Customize course shortcuts');dock.before(details);details.append(summary,dock);}
  if(!section?.isConnected){section=el('section','am-section');section.id='aether-minimal-section';section.hidden=true;workspace.prepend(section);}
  if(ctx.home){if(!aside?.isConnected){aside=el('aside','am-planning');aside.id='aether-minimal-planning';aside.setAttribute('aria-label','Calendar and Next Up');workspace.append(aside);}calendar();const copy=workspace.querySelector('.ae-hero-copy');if(copy){let greeting=copy.querySelector('.am-greeting');if(!greeting){greeting=el('h1','am-greeting','Ready for what’s next.');const summary=el('p','am-observed');copy.prepend(greeting,summary);}const summary=copy.querySelector('.am-observed'),value=ctx.sites.filter(s=>!s.home&&s.pinned).length+' pinned courses · '+(snapshot().checkedAt?'Observed academic sources · partial coverage':'Academic sources not yet available');if(summary.textContent!==value)summary.textContent=value;}}
  else{aside?.remove();aside=null;}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
 globalThis.AetherMinimal={mount(context){if(context&&(context.home!==ctx?.home||context.toolTitle!==ctx?.toolTitle||context.courseTitle!==ctx?.courseTitle)){if(section)section.hidden=true;ctx=context;selection=underlyingSection();}else ctx=context;paint();}};
 globalThis.AetherAcademicStore?.subscribe(()=>{if(active())schedule();});
 window.addEventListener('aether-academic-clock',()=>{if(active())schedule();});
 window.addEventListener('aether-theme-change',schedule);window.addEventListener('aether-settings-change',schedule);
 document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.key!=='Escape')return;if(drawer){e.preventDefault();close();}else if(section&&!section.hidden&&(section.contains(e.target)||e.target.closest('[data-am-section]'))){e.preventDefault();closeSection();}});
 document.addEventListener('click',e=>{if(section&&!section.hidden&&!e.target.closest('#aether-minimal-section,#aether-minimal-nav'))closeSection(false);if(drawer&&!e.target.closest('#portal-nav-sidebar,.portal-nav-sidebar,#aether-minimal-nav,#aether-minimal-section'))close(false);});
 window.addEventListener('hashchange',()=>{if(active()){selection=underlyingSection();syncNavigation();}});
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);close(false);});
})();
