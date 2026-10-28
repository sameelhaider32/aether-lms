/* Top-level Spotlight: ephemeral metadata, native destinations and safe UI actions. */
(() => {
 'use strict';
 if(window!==top||location.hostname!=='lms.lums.edu.pk'||globalThis.AetherSpotlight)return;
 const D=globalThis.AetherAcademicData,store=globalThis.AetherAcademicStore,search=globalThis.AetherSpotlightSearch;
 const MAX=5000,frames=new Set();let ctx=null,signature='',header=null,trigger=null,dialog=null,input=null,list=null,status=null,previewButton=null,nativeLink=null;
 let index=[],matches=[],selected=0,category='all',returnFocus=null,job=null,jobKind='',message='',timer=0,identityTimer=0,controller=null,resourceListener=null,scheduled=0,privacyLocked=false;let contentUI=null,contentUnsubscribe=null;const contents=globalThis.AetherSpotlightContent;contents?.setSource(resourceRows);
 const enabled=()=>!!ctx&&document.documentElement.classList.contains('aether-enabled')&&!document.body?.classList.contains('is-logged-out')&&!document.querySelector('#loginForm input[type=password]');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
 const safe=(value,base=location.href)=>{const href=D.url(value,base);if(!href)return null;const u=new URL(href);return !u.username&&!u.password&&href.length<=4096?href:null;};
 function docs(){return [document,...[...frames].filter(doc=>{try{return doc.defaultView.document===doc&&doc.defaultView.frameElement?.isConnected;}catch{return false;}})].slice(0,12);}
 function nativeRows(){
  const rows=[],home=document.querySelector('#toolMenu .site-list-item[data-type="home"] .sidebar-site-title');
  for(const li of [...document.querySelectorAll('#toolMenu .site-list-item')].slice(0,250)){
   const a=li.querySelector('a.sidebar-site-title,.site-link-block a[href]'),href=safe(a?.getAttribute('href')),id=href&&D.siteId(href),title=D.clean(a?.textContent);
   if(!href||!id||!title||id==='home')continue;rows.push({key:'course:'+id,type:'course',title,course:title,siteId:id,url:href,nativeAnchor:a,meta:'Course · Native Sakai navigation'});
   for(const tool of li.querySelectorAll('.site-page-list a[href]')){
    const url=globalThis.AetherAcademicSources.nativeURL(tool.getAttribute('href'),location.href),title=D.clean(tool.textContent);
    if(!url||!title||D.siteId(url)&&D.siteId(url)!==id)continue;
    rows.push({key:'tool:'+id+':'+url,type:'tool',title,course:D.clean(a.textContent),siteId:id,url,nativeAnchor:tool,meta:'Course tool'});
   }
  }
  for(const doc of docs()){
   const active=ctx.active&&!ctx.active.home?{id:D.siteId(ctx.active.href),title:ctx.active.title}:{id:'',title:'Home summary'};
   for(const r of globalThis.AetherAcademicSources.native(doc,active,doc.URL))rows.push(academic(r));
  }
  return {rows:rows.slice(0,MAX),home:globalThis.AetherAcademicSources.nativeURL(home?.getAttribute('href')||ctx.sites.find(s=>s.home)?.href,location.href)};
 }
 function academic(r){
  const state=D.state(r),due=Number.isFinite(r.time)?new Date(r.time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Date unavailable';
  const label=r.type==='assignment'?(state.badges.some(b=>b.kind==='draft')?'Draft saved · not submitted':state.label):r.type==='event'?'Event':'Announcement';
  return {key:r.type+':'+r.siteId+':'+r.id,type:r.type,title:r.title,course:r.course,siteId:r.siteId,url:r.url,keywords:r.nativeStatus,meta:label+' · '+due};
 }
 let observed={rows:[],home:null};
 function capture(){if(!enabled()||!store.snapshot().scope||store.snapshot().blocked)return;observed=nativeRows();collectVisible();rebuild();}
 function requestCapture(){if(scheduled)return;scheduled=setTimeout(()=>{scheduled=0;capture();},80);}
 function collectVisible(){
  if(!controller||controller.scope!==store.snapshot().scope)return;
  const revision=controller.tree.revision;for(const doc of docs())try{controller.discovery.visible(doc);}catch{}
  if(revision!==controller.tree.revision)controller.changed();
 }
 function resourceRows(){
  if(!controller||!controller.scope||controller.scope!==store.snapshot().scope)return [];
  const visible=new Map();
  for(const doc of docs())for(const card of [...doc.querySelectorAll('.ae-record-card[data-ae-kind="resource"]')].slice(0,1000)){
   const info=(doc.defaultView?.AetherResourceInfo||globalThis.AetherResourceInfo)?.describe(card);if(info?.id)visible.set(info.id,info);
  }
  const courses=new Map([...observed.rows,...store.snapshot().courses.map(c=>({siteId:c.id,course:c.title,url:c.url,type:'course'}))].filter(r=>r.type==='course').map(r=>[r.siteId,r]));
  const rows=[];
  for(const node of controller.tree.nodes.values()){
   if(!node.parent||!['file','folder'].includes(node.type)||!controller.tree.available(node))continue;
   const info=visible.get(node.id),course=courses.get(node.site),tool=[...observed.rows,...(store.snapshot().tools||[]).map(t=>({...t,type:'tool'}))].find(t=>t.siteId===node.site&&/^resources$/i.test(t.title));
   const href=info?.kind==='folder'?globalThis.AetherAcademicSources.nativeURL(info.a.getAttribute('href'),info.a.ownerDocument.URL):node.type==='file'?safe(node.url):null;
   const url=href||tool?.url||course?.url;if(!url)continue;
   const fileType=node.type==='folder'?'folder':(node.name.match(/\.([a-z0-9]{1,7})$/i)?.[1]||node.mime||'file');
   const preview=info?.card?.querySelector('[data-ae-preview-open]');
   rows.push({key:'resource:'+node.id,type:node.type==='folder'?'folder':'resource',title:node.name,course:course?.course||controller.tree.nodes.get('/group/'+node.site+'/')?.name||'Course unavailable',siteId:node.site,url,path:node.id,fileType,meta:(node.type==='folder'?'Folder · opens native Resources':fileType.toUpperCase())+' · '+node.id,nativeAnchor:info?.a,preview:preview?.isConnected?preview:null,metadata:node.type==='file'?{id:node.id,url:node.url,title:node.name,mime:node.mime,scope:controller.scope,version:String(node.modified||node.version||'')}:null});
   if(rows.length>=3000)break;
  }return rows;
 }
 function commands(){
  const rows=[],add=(key,title,fn,meta)=>rows.push({key:'command:'+key,type:'command',title,run:fn,meta:meta||'Aether interface command'});
  const home=observed.home||globalThis.AetherAcademicSources.nativeURL(ctx?.sites.find(s=>s.home)?.href,location.href);
  if(home)add('home','Go Home',()=>location.assign(home),'Open original Sakai Home');
  const deadlines=document.querySelector('[aria-controls="aether-mission-control"]');
  if(deadlines){add('mission','Open Mission Control',()=>deadlines.click());add('deadlines','View Deadlines',()=>deadlines.click());}
  if(globalThis.AetherDownloadUI)add('downloads','Open Download Manager',()=>globalThis.AetherDownloadUI.open(document));
  if(globalThis.AetherTheme){add('original','Switch to Aether Original',()=>globalThis.AetherTheme.set('aether'));add('mono','Switch to Monochrome',()=>globalThis.AetherTheme.set('monochrome'));}
  if(globalThis.AetherActions?.toggleMotion)add('motion','Toggle Motion',()=>globalThis.AetherActions.toggleMotion());
  if(document.querySelector('#aether-theme-select'))add('preferences','Aether appearance preferences',()=>document.querySelector('#aether-theme-select')?.focus(),'Focus the existing theme control');
  return rows;
 }
 function rebuild(){
  const snapshot=store.snapshot(),map=new Map();
  const rows=enabled()&&!snapshot.blocked&&snapshot.scope?[...observed.rows,...snapshot.courses.map(c=>({key:'course:'+c.id,type:'course',title:c.title,course:c.title,siteId:c.id,url:c.url,meta:'Accessible course · coverage unverified'})),...snapshot.tools.map(t=>({...t,key:'tool:'+t.siteId+':'+t.url,type:'tool',meta:'Discovered native tool'})),...snapshot.records.map(academic),...resourceRows()]:[];
  for(const row of [...commands(),...rows]){if(map.size>=MAX)break;if(!map.has(row.key)&&(row.type==='command'||safe(row.url)))map.set(row.key,search.compile(row));}
  index=[...map.values()];if(dialog)render();
 }
 async function ready(){
  const who=await store.verify();if(!who||!enabled()){rebuild();return;}
  if(!controller){controller=globalThis.AetherDownloads?.get();if(controller){resourceListener=()=>{clearTimeout(timer);timer=setTimeout(rebuild,50);};controller.listeners.add(resourceListener);}}
  if(controller)try{await controller.identity();}catch{}
  if(!enabled()||store.snapshot().scope!==who)return;capture();
 }
 function cancel(){job?.abort();job=null;jobKind='';if(dialog)render();}
 async function discover(kind){
  if(job||store.snapshot().blocked||!enabled())return;
  const work=new AbortController();job=work;jobKind=kind;message=kind==='academic'?'Checking existing academic sources…':'Searching bounded resource metadata…';render();
  try{
   await ready();if(work.signal.aborted||!store.snapshot().scope)throw Error('Authenticated session unavailable.');
   const who=store.snapshot().scope;
   if(kind==='academic')await store.load(ctx,work.signal,()=>rebuild());
   else{
    if(!controller||controller.task)throw Error('Download Manager is busy. Finish or cancel that operation first.');
    collectVisible();
    const shared=store.snapshot().courses;
    if(shared.length)for(const c of shared)controller.tree.root(c.id,c.title,'shared academic discovery');
    else try{await controller.discovery.courses(work.signal,{maxPages:1});}catch(error){if(work.signal.aborted)throw error;}
    const queue=controller.tree.roots.slice(0,8).map(id=>({id,depth:0})),seen=new Set();let count=0;
    while(queue.length&&count<12&&controller.tree.nodes.size<10000){
     if(work.signal.aborted)throw new DOMException('Discovery cancelled','AbortError');
     if(await controller.identity()!==who)throw Error('Session changed.');
     const {id,depth}=queue.shift(),node=controller.tree.nodes.get(id);if(!node||seen.has(id)||!controller.tree.available(node))continue;seen.add(id);count++;
     try{await controller.discovery.load(node,work.signal);}catch(error){if(work.signal.aborted)throw error;}
     if(work.signal.aborted)throw new DOMException('Discovery cancelled','AbortError');
     if(await controller.identity()!==who)throw Error('Session changed.');
     if(depth<2)for(const id of node.children)if(controller.tree.nodes.get(id)?.type==='folder')queue.push({id,depth:depth+1});
     controller.emit();rebuild();
    }
   }
   if(work.signal.aborted)throw new DOMException('Discovery cancelled','AbortError');
   if(await store.verify()!==who)throw Error('Session changed. Refresh your LMS tab.');
   if(job===work)message='Check finished · partial coverage. Undiscovered, unavailable or unreleased items are not included.';
  }catch(error){if(job===work)message=work.signal.aborted?'Discovery cancelled. Known results remain available.':error.message||'Discovery unavailable. Native navigation remains available.';}
  finally{if(job===work){job=null;jobKind='';if(enabled())rebuild();}}
 }
 function highlight(node,text){
  const terms=input.value.replace(/^\s*>/,'').replace(/[\"“”]/g,'').trim().split(/\s+/).filter(x=>x.length>1).slice(0,8),pattern=terms.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  if(!pattern){node.textContent=text;return;}const re=new RegExp(pattern,'gi');let last=0;for(const m of text.matchAll(re)){node.append(document.createTextNode(text.slice(last,m.index)),el('mark','',m[0]));last=m.index+m[0].length;}node.append(document.createTextNode(text.slice(last)));
 }
 function combined(current){
  const text=contents?.query(input.value,current)||[],metadata=category==='content'?[]:search.rank(index,input.value,category,current);
  if(!['all','files','content'].includes(category)||/^\s*>/.test(input.value))return metadata;
  const byId=new Map(text.map(r=>[r.metadata.id,r])),seen=new Set(),ranked=[];
  for(const row of metadata){const match=byId.get(row.metadata?.id);if(match){seen.add(match.metadata.id);ranked.push({...row,...match,key:row.key});}else ranked.push(row);}
  const exact=ranked.filter(r=>search.fold(r.title).includes(search.fold(input.value))&&input.value.trim()),rest=ranked.filter(r=>!exact.includes(r));
  return [...exact,...text.filter(r=>!seen.has(r.metadata.id)),...rest].slice(0,30);
 }
 function render(reset=false){
  if(!dialog)return;const previous=reset?null:matches[selected]?.key;
  matches=combined(ctx?.active&&!ctx.active.home?D.siteId(ctx.active.href):'');selected=Math.max(0,matches.findIndex(r=>r.key===previous));
  list.replaceChildren();
  for(const [i,row]of matches.entries()){
   const option=el('li','ae-spot-option');option.id='ae-spot-result-'+i;option.setAttribute('role','option');option.dataset.index=i;
   const icon=el('span','ae-spot-icon',{course:'C',tool:'↗',assignment:'A',resource:'F',folder:'▱',event:'E',announcement:'N',command:'⌘',content:'¶'}[row.type]);icon.setAttribute('aria-hidden','true');
   const copy=el('span','ae-spot-result-copy'),title=el('span','ae-spot-result-title');highlight(title,row.title);copy.append(title,el('span','ae-spot-result-meta',[row.course,row.meta].filter(Boolean).join(' · ')));if(row.snippet){const snippet=el('span','ae-spot-snippet');highlight(snippet,row.snippet);copy.append(snippet);}option.append(icon,copy,el('span','ae-spot-type',row.type));list.append(option);
  }
  if(!matches.length)list.append(el('li','ae-spot-empty',input.value?'No matches among indexed records and documents. Some documents have not been indexed. Search more documents below.':'No results in this category yet. Native navigation and available commands remain accessible.'));
  const snapshot=store.snapshot();status.textContent=snapshot.blocked?'Session changed. Refresh your LMS tab to search this account.':(!snapshot.scope?'Verifying session · private metadata unavailable until confirmed.':`${index.filter(r=>r.type!=='command').length} metadata records · ${contents?.snapshot().documents||0} documents indexed · ${matches.filter(r=>r.snippet).length} documents matched · incomplete coverage; some documents have not been indexed`)+(message?' · '+message:'');
  dialog.querySelector('[data-spot-cancel]').hidden=!job;
  for(const b of dialog.querySelectorAll('[data-spot-discover]'))b.disabled=!!job||snapshot.blocked;
  const contentButton=dialog.querySelector('[data-spot-content]');if(contentButton)contentButton.disabled=snapshot.blocked;updateSelection(false);
 }
 function updateSelection(scroll=true){
  for(const [i,option]of [...list.querySelectorAll('[role="option"]')].entries())option.setAttribute('aria-selected',String(i===selected));
  const row=matches[selected],option=row&&document.getElementById('ae-spot-result-'+selected);
  if(option){input.setAttribute('aria-activedescendant',option.id);if(scroll)option.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
  previewButton.hidden=!(row?.preview?.isConnected||row?.metadata&&globalThis.AetherResourcePreview);nativeLink.hidden=!row?.url;if(row?.url)nativeLink.href=row.url;else nativeLink.removeAttribute('href');
 }
 function perform(row,preview=false){
  if(!row||!enabled())return;
  const action=()=>{if(!preview&&row.metadata)contents?.opened(row.metadata);if(preview&&row.preview?.isConnected)row.preview.click();else if(preview&&row.metadata)globalThis.AetherResourcePreview?.openMetadata(row.metadata,trigger);else if(row.run)row.run();else if(row.nativeAnchor?.isConnected)row.nativeAnchor.click();else if(safe(row.url))location.assign(row.url);};
  close(true);action();
 }
 function close(restore=true){
  if(!dialog)return;cancel();clearInterval(identityTimer);identityTimer=0;
  contentUI?.dispose();contentUI=null;contentUnsubscribe?.();contentUnsubscribe=null;const old=dialog;dialog=null;old.close();old.remove();input=list=status=previewButton=nativeLink=null;
  if(restore&&returnFocus?.isConnected&&!returnFocus.closest('[inert]'))try{returnFocus.focus({preventScroll:true});}catch{}
  returnFocus=null;message='';
 }
 function open(options={}){
  if(!enabled())return false;if(dialog){input.focus();return true;}
  returnFocus=options.trigger||document.activeElement;document.dispatchEvent(new Event('aether-preview-close-all'));
  dialog=el('dialog','ae-spotlight');dialog.id='aether-spotlight';dialog.setAttribute('aria-labelledby','ae-spot-title');
  const head=el('header','ae-spot-head'),label=el('label','ae-spot-label','AETHER / SPOTLIGHT');label.id='ae-spot-title';label.htmlFor='ae-spot-input';
  input=el('input','ae-spot-input');input.id='ae-spot-input';input.type='search';input.placeholder='Find a course, tool, assignment or file…';input.autocomplete='off';input.spellcheck=false;input.maxLength=160;input.setAttribute('role','combobox');input.setAttribute('aria-expanded','true');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','ae-spot-results');
  head.append(label,button('Esc',()=>close(),'ae-spot-dismiss'));const filters=el('div','ae-spot-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Search categories');
  category='all';for(const [value,title]of [['all','All'],['course','Courses'],['tool','Tools'],['assignment','Assignments'],['files','Files'],['content','Contents'],['updates','Updates'],['command','Commands']]){const b=button(title,()=>{category=value;for(const n of filters.children)n.setAttribute('aria-pressed',String(n===b));selected=0;render(true);});b.setAttribute('aria-pressed',String(value==='all'));filters.append(b);}
  list=el('ul','ae-spot-results');list.id='ae-spot-results';list.setAttribute('role','listbox');list.setAttribute('aria-label','Spotlight results');
  status=el('p','ae-spot-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const discovery=el('div','ae-spot-discovery');for(const [kind,title]of [['academic','Check academic sources'],['resources','Search more available resources']]){const b=button(title,()=>discover(kind));b.dataset.spotDiscover=kind;discovery.append(b);}const stop=button('Cancel discovery',()=>{cancel();message='Discovery cancelled. Known results remain available.';render();});stop.dataset.spotCancel='';stop.hidden=true;discovery.append(stop);
  const footer=el('footer','ae-spot-footer');nativeLink=el('a','ae-spot-native','Open original ↗');nativeLink.hidden=true;nativeLink.addEventListener('click',event=>{if((event.ctrlKey||event.metaKey)&&matches[selected]?.metadata)contents?.opened(matches[selected].metadata);if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey){event.preventDefault();perform(matches[selected]);}});previewButton=button('Preview',()=>perform(matches[selected],true));previewButton.hidden=true;footer.append(el('span','','↑ ↓ Navigate · Enter Open · > Commands'),nativeLink,previewButton);
  dialog.append(head,input,filters,list,status,discovery,footer);document.body.append(dialog);
  contentUI=globalThis.AetherSpotlightContentUI?.mount(dialog,meta=>perform({metadata:meta,url:meta.url},true));
  const contentButton=button('Index document contents',()=>{ready().then(()=>contentUI?.show());});contentButton.dataset.spotContent='';discovery.append(contentButton);
  contentUnsubscribe=contents?.subscribe(()=>{if(dialog)render();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}},{capture:true});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  list.addEventListener('click',event=>{const n=event.target.closest('[data-index]');if(n)perform(matches[Number(n.dataset.index)]);});
  input.addEventListener('input',()=>{selected=0;render(true);});input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selected=(selected+(event.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length);updateSelection();}else if(event.key==='Enter'){event.preventDefault();perform(matches[selected],event.altKey);}});
  dialog.showModal();rebuild();input.focus();ready().catch(()=>{message='Sources unavailable. Native Sakai remains available.';render();});
  identityTimer=setInterval(()=>store.verify().then(()=>rebuild()),30000);return true;
 }
 function wipe(){close();cancel();observed={rows:[],home:null};index=[];frames.clear();if(controller&&resourceListener)controller.listeners.delete(resourceListener);controller=null;resourceListener=null;}
 function mount(context){
  ctx=context;const next=document.querySelector('.portal-header');
  if(!enabled()){wipe();trigger?.remove();trigger=null;header=null;signature='';store.clear(document.body?.classList.contains('is-logged-out')||!!document.querySelector('#loginForm input[type=password]'));return;}
  if(!trigger?.isConnected||header!==next){trigger?.remove();header=next;if(header){trigger=button('',()=>open({trigger}));trigger.id='aether-spotlight-trigger';trigger.setAttribute('aria-label','Open Aether Spotlight');trigger.setAttribute('aria-keyshortcuts','Control+K Meta+K Alt+Shift+K');trigger.title='Spotlight · Ctrl/Cmd+K · Alt+Shift+K';trigger.innerHTML='<svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12 12 5 5" stroke="currentColor" stroke-width="1.5"/></svg><span class="ae-spot-trigger-label">SPOTLIGHT</span>';header.append(trigger);}}
  if(signature!==ctx.signature){signature=ctx.signature;close();observed={rows:[],home:null};ready().catch(()=>{});}
 }
 store.subscribe(()=>{const snapshot=store.snapshot();if(!enabled()||!snapshot.scope&&!snapshot.blocked){wipe();}else if(snapshot.blocked){if(!privacyLocked){privacyLocked=true;wipe();}else rebuild();}else{privacyLocked=false;clearTimeout(timer);timer=setTimeout(rebuild,50);}});
 document.addEventListener('aether-records-change',requestCapture);
 window.addEventListener('aether-settings-change',()=>{if(!enabled()){wipe();trigger?.remove();trigger=null;store.clear();}else mount(ctx);});
 window.addEventListener('pagehide',()=>{wipe();clearTimeout(timer);clearTimeout(scheduled);scheduled=0;});
 globalThis.AetherSpotlight={mount,open,frame(doc){try{if(doc.defaultView.top===window&&doc.defaultView.location.origin===location.origin&&frames.size<11){frames.add(doc);requestCapture();}}catch{}},removeFrame(doc){frames.delete(doc);requestCapture();}};
})();
