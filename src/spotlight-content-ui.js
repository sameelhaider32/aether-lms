/* Compact selector over the shared, already-discovered resource tree. No crawler. */
(() => {
 'use strict';const service=globalThis.AetherSpotlightContent;if(!service)return;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
 function mount(dialog,preview){
  const panel=el('section');panel.className='ae-content-panel';panel.hidden=true;panel.setAttribute('aria-label','Index document contents');
  const heading=el('div');heading.className='ae-content-heading';heading.append(el('strong','Index document contents'),button('Back to search',()=>show(false)));
  const note=el('p','Local, session-only text. Refresh, sign out or Aether OFF clears it. Only discovered files are listed; coverage is incomplete. Use “Search more available resources” to discover metadata first.');
  const optLabel=el('label'),opt=el('input');opt.type='checkbox';optLabel.append(opt,document.createTextNode(' Include documents I deliberately open or preview for this session (never hover)'));opt.onchange=()=>{if(opt.checked)service.optIn();else service.stopOpened();};
  const filterLabel=el('label','Choose course or folder '),filter=el('select');filter.setAttribute('aria-label','Indexing scope');filterLabel.append(filter);
  const summary=el('p'),files=el('div');files.className='ae-content-files';const selected=new Map();let known=[];
  const actions=el('div');actions.className='ae-content-actions';
  const select=button('Select up to 100 supported files',()=>{for(const d of filtered()){if(selected.size>=100)break;if(service.supported.has(d.extension))selected.set(d.id,d);}drawFiles();});
  const none=button('Deselect all',()=>{selected.clear();drawFiles();});
  const start=button('Start indexing',()=>service.start([...selected.values()]));start.dataset.contentStart='';
  const cancel=button('Cancel indexing',()=>service.cancel());cancel.dataset.contentCancel='';
  const clear=button('Clear indexed contents',()=>service.clear());
  actions.append(select,none,start,cancel,clear,button('Refresh discovered list',build));
  const progress=el('p');progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');
  const statuses=el('ul');statuses.className='ae-content-statuses';
  panel.append(heading,note,optLabel,filterLabel,summary,files,actions,progress,statuses);dialog.insertBefore(panel,dialog.querySelector('.ae-spot-footer'));
  function filtered(){const v=filter.value;return known.filter(d=>!d.folder&&(v==='all'||v.startsWith('course:')?v==='all'||d.siteId===v.slice(7):d.id.startsWith(v.slice(7))));}
  function drawFiles(){
   files.replaceChildren();const rows=filtered(),supported=rows.filter(d=>service.supported.has(d.extension)).length;
   summary.textContent=`${supported} supported of ${rows.length} discovered files in this scope · ${selected.size} selected across scopes · showing ${Math.min(300,rows.length)}. Maximum 100 per batch.`;
   for(const d of rows.slice(0,300)){
    const label=el('label'),box=el('input');box.type='checkbox';box.checked=selected.has(d.id);box.disabled=!service.supported.has(d.extension);box.setAttribute('aria-label','Index '+d.title);
    box.onchange=()=>{if(box.checked&&selected.size<100)selected.set(d.id,d);else{selected.delete(d.id);box.checked=false;}summary.textContent=`${supported} supported of ${rows.length} discovered files · ${selected.size} selected across scopes · maximum 100.`;update();};
    label.append(box,document.createTextNode(d.title+' · '+d.course+(box.disabled?' · Skipped unsupported':'')));files.append(label);
   }
   if(!rows.length)files.append(el('p','No discovered files in this scope. Search more available resources, then refresh this list.'));update();
  }
  function build(){
   known=service.available();const old=filter.value;filter.replaceChildren();
   const add=(value,title)=>{const o=el('option',title);o.value=value;filter.append(o);};add('all','Available documents across courses');
   const courses=new Map();for(const d of known)if(!d.folder)courses.set(d.siteId,d.course);for(const [id,title]of courses)add('course:'+id,title);
   for(const d of known.filter(d=>d.folder).slice(0,200))add('folder:'+d.path,'Folder · '+d.course+' / '+d.title);
   if([...filter.options].some(o=>o.value===old))filter.value=old;
   const ids=new Set(known.map(d=>d.id));for(const id of selected.keys())if(!ids.has(id))selected.delete(id);drawFiles();
  }
  filter.onchange=drawFiles;
  function update(){
   const s=service.snapshot(),b=s.batch;opt.checked=s.opted;
   start.disabled=s.busy||!selected.size;select.disabled=none.disabled=s.busy;cancel.hidden=!s.busy;
   progress.textContent=(b?`${b.completed} of ${b.total} processed${b.cancelled?' · cancelled':''} · `:'')+`${s.documents} documents indexed. Some documents have not been indexed.`;
   statuses.replaceChildren();for(const row of s.report){const li=el('li',row.meta.title+' · '+row.status);if(row.status==='Copyright acknowledgment required')li.append(document.createTextNode(' '),button('Handle notice in preview',()=>preview(row.meta)));statuses.append(li);}
  }
  function show(value=!panel.hidden){panel.hidden=!value;if(value){dialog.dataset.contentPanel='true';build();panel.scrollTop=0;filter.focus({preventScroll:true});}else{delete dialog.dataset.contentPanel;dialog.querySelector('.ae-spot-input')?.focus();}}
  const unsubscribe=service.subscribe(update);update();
  return {panel,show(){show(panel.hidden);},dispose(){unsubscribe();}};
 }
 globalThis.AetherSpotlightContentUI={mount};
})();
