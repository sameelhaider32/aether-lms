/* MIT. Native controls and nested-list semantics in Aether's editorial workspace. */
(() => {
 'use strict';
 let host;try{if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;host=top.document;}catch{return;}
 const enabled=()=>host.documentElement.classList.contains('aether-enabled');
 const el=(tag,cls,text)=>{const n=host.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(name,fn,cls='')=>{const b=el('button',cls,name);b.type='button';b.onclick=fn;return b;};
 const size=value=>value>=1024**3?(value/1024**3).toFixed(2)+' GiB':value>=1024**2?(value/1024**2).toFixed(1)+' MiB':value>=1024?(value/1024).toFixed(1)+' KiB':value+' bytes';
 if(window===top){
  let dialog,controller,opener,unsubscribe,paint=0,stamp='',expanded=new Set(),query='',filter='',selectedOnly=false,partialApproved=false;
  let treeArea,basket,summary,status,actions,noticeArea,scopeLabel,reviewButton,downloadButton,smallButton,partialLabel,partialBox,noticeStamp='';
  function dismiss(force=false){
   if(!dialog)return;
   if(controller.task&&!force&&!confirm('Cancel the running export and close Download resources? The unfinished output will be discarded.'))return;
   controller.cancel();controller.listeners.delete(unsubscribe);cancelAnimationFrame(paint);paint=0;dialog.close();dialog.remove();dialog=null;opener?.focus({preventScroll:true});opener=null;
   treeArea=basket=summary=status=actions=noticeArea=scopeLabel=reviewButton=downloadButton=smallButton=partialLabel=partialBox=null;expanded.clear();
  }
  function schedule(){if(!paint)paint=requestAnimationFrame(()=>{paint=0;render();});}
  function change(node,checked){if(controller.task)return;controller.tree.set(node.id,checked);partialApproved=false;controller.changed();}
  function visible(node){
   if(node.type==='folder')return !selectedOnly||controller.tree.status(node.id)!=='unchecked';
   if(selectedOnly&&!controller.tree.intent(node.id))return false;
   if(query&&!node.name.toLocaleLowerCase().includes(query))return false;
   const ext=node.name.split('.').at(-1).toLowerCase();return !filter||filter.split(',').includes(ext);
  }
  function drawTree(){
   const focus=host.activeElement?.dataset.aeDownloadNode,focusedKind=host.activeElement?.dataset.aeDownloadAction;
   const fragment=host.createDocumentFragment();
   function row(node,depth){
    const li=el('li','ae-dl-node'),line=el('div','ae-dl-line');line.style.setProperty('--depth',Math.min(depth,12));
    if(node.type==='folder'){
     const open=expanded.has(node.id)||Boolean(query||filter||selectedOnly),disclose=button(open?'−':'+',async()=>{if(expanded.has(node.id)){expanded.delete(node.id);stamp='';schedule();}else{expanded.add(node.id);stamp='';schedule();if(node.state!=='loaded')await controller.folder(node);}},'ae-dl-disclose');
     disclose.setAttribute('aria-label',(open?'Collapse ':'Expand ')+node.name);disclose.setAttribute('aria-expanded',String(open));disclose.dataset.aeDownloadNode=node.id;disclose.dataset.aeDownloadAction='expand';line.append(disclose);
    }else line.append(el('span','ae-dl-spacer'));
    const label=el('label','ae-dl-item'),checkbox=el('input');checkbox.type='checkbox';checkbox.dataset.aeDownloadNode=node.id;checkbox.dataset.aeDownloadAction='select';
    const state=controller.tree.status(node.id);checkbox.checked=state==='checked';checkbox.indeterminate=state==='mixed';checkbox.setAttribute('aria-checked',state==='mixed'?'mixed':String(checkbox.checked));checkbox.disabled=!!controller.task||!node.available||['external','unsupported'].includes(node.type);
    checkbox.onchange=()=>change(node,checkbox.checked);label.append(checkbox,el('span','ae-dl-name',node.name));line.append(label);
    const meta=node.type==='folder'?node.state==='loaded'?node.children.length+' items':node.state:node.type!=='file'?node.type:!node.available?'restricted':node.size===null?'size unknown':size(node.size);
    line.append(el('span','ae-dl-meta',meta));li.append(line);
    if(node.type==='folder'&&(expanded.has(node.id)||query||filter||selectedOnly)){
     const shortcuts=el('div','ae-dl-folder-actions');
     const recursive=button(node.parent?'Select folder recursively':'Select all in this course',()=>change(node,true));recursive.disabled=!!controller.task;shortcuts.append(recursive);
     if(node.state==='loaded'||node.state==='incomplete'){const direct=button('Select all in this folder',()=>{for(const id of node.children){const child=controller.tree.nodes.get(id);if(child?.type==='file'&&child.available)controller.tree.set(id,true);}controller.changed();});direct.disabled=!!controller.task;shortcuts.append(direct);}li.append(shortcuts);
     if(node.error){const warning=el('div','ae-dl-folder-warning',node.error);const retry=button('Retry folder',()=>controller.folder(node,true));retry.disabled=!!controller.task;warning.append(retry);li.append(warning);}
     const list=el('ul','ae-dl-children');for(const id of node.children){const n=controller.tree.nodes.get(id);if(n&&visible(n))list.append(row(n,depth+1));}li.append(list);
     if(node.state==='loaded'&&!node.children.length)li.append(el('p','ae-dl-empty','Empty folder'));
    }
    return li;
   }
   const list=el('ul','ae-dl-tree');list.setAttribute('aria-label','Available resource collections');for(const id of controller.tree.roots)list.append(row(controller.tree.nodes.get(id),0));fragment.append(list);
   if(!controller.tree.roots.length)fragment.append(el('p','ae-dl-empty','No verified course roots yet. Open a course Resources tool, or discover available courses.'));
   treeArea.replaceChildren(fragment);
   if(focus){const match=[...treeArea.querySelectorAll('[data-ae-download-node]')].find(n=>n.dataset.aeDownloadNode===focus&&n.dataset.aeDownloadAction===focusedKind);match?.focus({preventScroll:true});}
  }
  function render(){
   if(!dialog)return;const snapshot=controller.review||controller.tree.snapshot(),busy=!!controller.task;
   const nextStamp=[controller.tree.revision,controller.stage,query,filter,selectedOnly,[...expanded].join('|')].join(';');
   if(stamp!==nextStamp){stamp=nextStamp;drawTree();basket.replaceChildren();
    for(const [id,value]of controller.tree.rules){
     const n=controller.tree.nodes.get(id);if(!n||!value&&!controller.tree.intent(n.parent))continue;
     const card=el('div','ae-dl-basket-item'),parents=[];for(let p=n;p;p=controller.tree.nodes.get(p.parent))parents.unshift(p.name);
     card.append(el('span','ae-dl-rule',value?'INCLUDE':'EXCLUDE'),el('p','',parents.join(' / ')));
     const remove=button(value?'Remove':'Include again',()=>{change(n,!value);});remove.disabled=busy;card.append(remove);basket.append(card);
    }
    if(!basket.childElementCount)basket.append(el('p','ae-dl-empty','Your basket is empty. Select any combination of files and folders.'));
   }
   const provisional=!controller.review||snapshot.incomplete.length;
   summary.textContent=(provisional?'At least ':'')+snapshot.files.length+' files · '+size(snapshot.knownBytes)+' known'+(snapshot.unknown?' · '+snapshot.unknown+' sizes unknown':'')+(snapshot.empty.length?' · '+snapshot.empty.length+' empty folders':'');
   status.textContent=controller.message;status.dataset.stage=controller.stage;
   scopeLabel.textContent=controller.discovery.courseStatus;
   const requiresPartial=!!controller.review&&(snapshot.incomplete.length>0||snapshot.excluded.length>0);
   partialLabel.hidden=!requiresPartial;partialBox.checked=partialApproved;
   reviewButton.disabled=busy;downloadButton.disabled=busy||!controller.review||!(snapshot.files.length||snapshot.empty.length)||requiresPartial&&!partialApproved;
   smallButton.hidden=!controller.smallAvailable&&typeof globalThis.showSaveFilePicker==='function';smallButton.disabled=downloadButton.disabled||snapshot.knownBytes>globalThis.AetherDownloadArchive.BLOB_LIMIT;
   for(const b of dialog.querySelectorAll('[data-dl-idle]'))b.disabled=busy;
   const nextNotice=[controller.stage,controller.notice?.node.id||'',controller.progress.failed.length].join('|');
   if(nextNotice!==noticeStamp){noticeStamp=nextNotice;actions.replaceChildren();noticeArea.replaceChildren();
   if(controller.notice){
    const box=el('section','ae-dl-notice');box.setAttribute('aria-label','Copyright acknowledgement');box.append(el('h3','','Copyright acknowledgement: '+controller.notice.node.name),el('pre','',controller.notice.text));
    box.append(button('Accept this notice and continue',()=>controller.notice?.resolve(true),'ae-dl-primary'),button('Skip this resource',()=>controller.notice?.resolve(false)));
    const original=el('a','','Open original in Sakai');original.href=controller.notice.node.url;original.target='_blank';original.rel='noopener noreferrer';box.append(original);noticeArea.append(box);
   }
   if(controller.partial)actions.append(button('Keep successful files',()=>controller.partial?.resolve(true),'ae-dl-primary'),button('Discard unfinished export',()=>controller.partial?.resolve(false)));
   if(busy)actions.append(button('Cancel operation',()=>controller.cancel()));
   const progress=controller.progress;
   if(['downloading','copyright','partial','finalizing','completed','failed','cancelled'].includes(controller.stage)){
    const p=el('p','ae-dl-progress');noticeArea.prepend(p);
    if(progress.failed.length){const details=el('details'),title=el('summary','','Skipped or failed resources ('+progress.failed.length+')');details.append(title);for(const failure of progress.failed){const line=el('p','',failure.node.name+' — '+failure.reason);const a=el('a','','Open original');if(failure.node.url){a.href=failure.node.url;a.target='_blank';a.rel='noopener noreferrer';line.append(a);}details.append(line);}noticeArea.append(details);
     if(!busy)actions.append(button('Select failed files for manual retry',()=>{controller.tree.clear();for(const f of progress.failed)if(f.node.type==='file')controller.tree.set(f.node.id,true);controller.changed();}));
    }
   }
   }
   const progressLine=noticeArea.querySelector('.ae-dl-progress');if(progressLine){const p=controller.progress;progressLine.textContent=p.completed+' files added · '+p.failed.length+' failed/skipped · '+size(p.bytes)+' received'+(p.current?' · '+p.current:'');}
  }
  function open(doc,selected){
   if(!enabled())return;
   if(dialog){if(selected&&!controller.task){controller.collect(doc);controller.tree.set(selected,true);controller.changed();}dialog.focus();return;}
   controller=globalThis.AetherDownloads.get();if(Date.now()-controller.lastUsed>30*60*1000)controller.reset('The previous basket expired.');controller.touch();const revision=controller.tree.revision;controller.collect(doc);if(selected)controller.tree.set(selected,true);if(revision!==controller.tree.revision)controller.changed();
   document.dispatchEvent(new Event('aether-preview-close-all'));opener=host.activeElement;expanded=new Set();query='';filter='';selectedOnly=false;partialApproved=false;stamp='';
   dialog=el('dialog','ae-download-manager');noticeStamp='';dialog.id='aether-download-manager';dialog.setAttribute('aria-labelledby','ae-dl-title');dialog.dataset.aeDownloadControl='true';
   const header=el('header','ae-dl-header'),heading=el('div');heading.append(el('p','ae-dl-eyebrow','AETHER / FILE OPERATIONS'));const h=el('h2','','Download resources');h.id='ae-dl-title';heading.append(h);scopeLabel=el('p','ae-dl-scope');heading.append(scopeLabel);header.append(heading,button('Close',()=>dismiss()));dialog.append(header);
   const layout=el('div','ae-dl-layout'),left=el('section','ae-dl-browser'),right=el('section','ae-dl-basket');right.setAttribute('aria-label','Download basket');
   const filters=el('div','ae-dl-filters'),searchLabel=el('label','','Search discovered resources'),search=el('input');search.type='search';search.placeholder='Search filenames';search.oninput=()=>{query=search.value.toLocaleLowerCase().trim();stamp='';schedule();};searchLabel.append(search);
   const typeLabel=el('label','','File type'),types=el('select');for(const [name,value]of [['All files',''],['PDF','pdf'],['PowerPoint','ppt,pptx,ppsx'],['Word','doc,docx'],['Excel','xls,xlsx'],['ZIP','zip'],['Images','png,jpg,jpeg,gif,webp,avif']]){const option=el('option','',name);option.value=value;types.append(option);}types.onchange=()=>{filter=types.value;stamp='';schedule();};typeLabel.append(types);filters.append(searchLabel,typeLabel);left.append(filters);
   const tools=el('div','ae-dl-tools');const addTool=(name,fn)=>{const b=button(name,fn);b.dataset.dlIdle='';tools.append(b);};
   addTool('Discover available courses',()=>controller.courses());
   addTool('Select available courses',()=>{for(const id of controller.tree.roots)controller.tree.set(id,true);controller.changed();});
   addTool('Expand one level',async()=>{for(const id of [...controller.tree.roots,...expanded]){const node=controller.tree.nodes.get(id);if(!node||node.type!=='folder')continue;expanded.add(id);stamp='';if(node.state!=='loaded')await controller.folder(node);for(const child of node.children)if(controller.tree.nodes.get(child)?.type==='folder')expanded.add(child);}stamp='';schedule();});
   addTool('Collapse all',()=>{expanded.clear();stamp='';schedule();});
   const selectedButton=button('Show selected only',()=>{selectedOnly=!selectedOnly;selectedButton.setAttribute('aria-pressed',String(selectedOnly));stamp='';schedule();});selectedButton.setAttribute('aria-pressed','false');tools.append(selectedButton);left.append(tools);
   left.append(el('p','ae-dl-hint','A folder checkbox includes all accessible descendants. Expand to exclude individual children. Search and filters cover discovered metadata and do not change selections.'));
   treeArea=el('div','ae-dl-tree-area');left.append(treeArea);right.append(el('h3','','Download basket'),el('p','ae-dl-hint','Folder selections include newly discovered children. Exclusions are shown explicitly.'));
   const clear=button('Clear selection',()=>{controller.tree.clear();controller.changed();});clear.dataset.dlIdle='';right.append(clear);basket=el('div','ae-dl-basket-list');right.append(basket);layout.append(left,right);dialog.append(layout);
   const footer=el('footer','ae-dl-footer');summary=el('p','ae-dl-summary');status=el('p','ae-dl-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   partialLabel=el('label','ae-dl-partial');partialBox=el('input');partialBox.type='checkbox';partialBox.onchange=()=>{partialApproved=partialBox.checked;schedule();};partialLabel.append(partialBox,host.createTextNode('Export only verified discovered items; omit unavailable or undiscovered descendants.'));
   noticeArea=el('div','ae-dl-notice-area');const commands=el('div','ae-dl-commands');reviewButton=button('Review selection',()=>controller.prepare());downloadButton=button('Download ZIP',()=>controller.start({partial:partialApproved}),'ae-dl-primary');smallButton=button('Download small ZIP (64 MiB)',()=>controller.start({small:true,partial:partialApproved}));commands.append(reviewButton,downloadButton,smallButton);actions=el('div','ae-dl-actions');footer.append(summary,status,partialLabel,noticeArea,commands,actions,el('p','ae-dl-hint','Keep this page open during export. Basket stays in this page only and expires after 30 minutes. Direct saving: up to 2 GiB; small ZIP fallback: 64 MiB. Unknown sizes are checked while streaming.'));dialog.append(footer);
   dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
   dialog.addEventListener('keydown',event=>{
    const input=event.target.closest('[data-ae-download-node]');if(!input)return;const node=controller.tree.nodes.get(input.dataset.aeDownloadNode);
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const controls=[...treeArea.querySelectorAll('input:not(:disabled)')],at=controls.indexOf(input);controls[Math.max(0,Math.min(controls.length-1,at+(event.key==='ArrowDown'?1:-1)))]?.focus();}
    if((event.key==='ArrowRight'||event.key==='Enter')&&node.type==='folder'&&!expanded.has(node.id)){event.preventDefault();expanded.add(node.id);stamp='';schedule();if(node.state!=='loaded')controller.folder(node);}
    if(event.key==='ArrowLeft'&&node.type==='folder'){event.preventDefault();expanded.delete(node.id);stamp='';schedule();}
   });
   host.body.append(dialog);dialog.showModal();unsubscribe=schedule;controller.listeners.add(unsubscribe);render();search.focus();controller.identity().catch(error=>{controller.message=error.message;controller.emit();});
  }
  globalThis.AetherDownloadUI={open,dismiss};
 }
 // Per-frame entry points; the manager and selection live in the portal's
 // isolated extension world. No page-script message bridge is required.
 let queued=false;
 function entry(name,type,cls){const b=el('button',cls,name);b.type='button';b.dataset.aeDownloadEntry=type;b.dataset.aeDownloadControl='true';return b;}
 document.addEventListener('click',event=>{
  const trigger=event.target.closest?.('[data-ae-download-entry]');if(!trigger||!enabled())return;
  if(trigger.dataset.aeDownloadEntry==='item'){
   const card=trigger.closest('.ae-record-card[data-ae-kind="resource"]'),data=card&&globalThis.AetherResourceInfo?.describe(card);if(data?.id)top.AetherDownloadUI?.open(document,data.id);
  }else top.AetherDownloadUI?.open(document);
 });
 function controls(){
  queued=false;const own='[data-ae-download-entry]';
  if(!enabled()){document.querySelectorAll(own).forEach(n=>n.remove());return;}
  const cards=[...document.querySelectorAll('.ae-record-card[data-ae-kind="resource"]')];
  for(const old of document.querySelectorAll('[data-ae-download-entry="item"]'))if(!old.closest('.ae-record-card[data-ae-kind="resource"]'))old.remove();
  for(const card of cards){if(card.querySelector(own))continue;const info=globalThis.AetherResourceInfo?.describe(card);if(!info?.id?.startsWith('/group/')||!['folder'].includes(info.kind)&&info.u?.origin!==top.location.origin)continue;
   const b=entry('Add to download basket','item','ae-dl-add');b.title='Add '+info.title+' to the download basket';(card.querySelector('[data-ae-primary]')||card.lastElementChild||card).append(b);
  }
  if(cards.length&&!document.querySelector('[data-ae-download-entry="toolbar"]')){const area=cards[0].closest('table,ul,ol'),toolbar=document.querySelector('.resource-toolbar,.navIntraTool,.tool-toolbar');const b=entry('Download resources','toolbar','ae-dl-entry');if(toolbar)toolbar.append(b);else area?.before(b);}
  if(!cards.length)document.querySelectorAll('[data-ae-download-entry="toolbar"]').forEach(n=>n.remove());
  if(window===top){const workspace=document.querySelector('#aether-workspace .ae-hero-copy');if(workspace&&!workspace.querySelector(own))workspace.append(entry('Download resources','global','ae-dl-global'));}
 }
 function scheduleControls(){if(!queued){queued=true;queueMicrotask(controls);}}
 document.addEventListener('aether-records-change',scheduleControls);window.addEventListener('aether-settings-change',scheduleControls);document.addEventListener('DOMContentLoaded',scheduleControls,{once:true});window.addEventListener('pageshow',scheduleControls);
 const settings=new MutationObserver(scheduleControls);settings.observe(host.documentElement,{attributes:true,attributeFilter:['class']});
 window.addEventListener('pagehide',e=>{if(!e.persisted)settings.disconnect();});scheduleControls();
})();
