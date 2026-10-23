/* MIT. One page-local export lifecycle. No background service or persistence. */
(() => {
 'use strict';
 try{if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname)||window!==top)return;}catch{return;}
 const {Tree}=globalThis.AetherDownloadSelection;
 class Controller {
  constructor(){
   this.tree=new Tree();this.discovery=new globalThis.AetherDownloadDiscovery.Discovery(this.tree,globalThis.AetherResourceAccess);
   this.stage='browsing';this.message='Choose files, folders or courses. Expand folders independently from selection.';this.listeners=new Set();this.task=null;this.review=null;this.scope=null;this.checkedAt=0;this.lastUsed=Date.now();this.progress={completed:0,bytes:0,failed:[]};
   this.touch();
  }
  touch(){this.lastUsed=Date.now();clearTimeout(this.expiry);this.expiry=setTimeout(()=>{if(this.task){this.touch();return;}this.reset('Your basket expired after 30 minutes of inactivity.');},30*60*1000);}
  emit(){for(const fn of this.listeners)fn();}
  collect(doc){this.discovery.visible(document);if(doc&&doc!==document)this.discovery.visible(doc);}
  changed(){if(this.task)return;this.review=null;this.stage='browsing';this.touch();this.emit();}
  async identity(){
   const scope=await globalThis.AetherFileState?.session();
   if(!scope||this.scope&&this.scope!==scope){this.reset('Session changed or unavailable. Reopen the manager after signing in.');throw Error('The authenticated Sakai session could not be verified.');}
   this.scope=scope;this.checkedAt=Date.now();return scope;
  }
  reset(message='Selections cleared for privacy.'){
   this.cancel();clearTimeout(this.expiry);this.tree.clear();this.tree.nodes.clear();this.tree.roots.length=0;this.scope=null;this.review=null;this.stage='browsing';this.message=message;this.emit();
  }
  begin(stage){
   if(this.task)throw Error('An operation is already running.');
   const task={abort:new AbortController(),archive:null,timer:null};this.task=task;this.stage=stage;this.touch();
   task.timer=setInterval(()=>this.identity().catch(()=>task.abort.abort(Error('Session verification failed.'))),30000);this.emit();return task;
  }
  end(task){clearInterval(task.timer);if(this.task===task)this.task=null;this.touch();this.emit();}
  async folder(node,force=false){
   if(this.task)return;const task=this.begin('discovering');
   try{await this.identity();await this.discovery.load(node,task.abort.signal,force);this.message=node.error||'Folder metadata loaded. No file contents downloaded.';}
   catch(error){this.message=error.message;}finally{if(this.task===task)this.stage='browsing';this.review=null;this.end(task);}
  }
  async courses(){
   if(this.task)return;const task=this.begin('discovering');
   try{await this.identity();await this.discovery.courses(task.abort.signal);}catch(error){this.message=error.message;}
   finally{if(this.task===task){this.stage='browsing';this.message=this.discovery.courseStatus;}this.review=null;this.end(task);}
  }
  async prepare(){
   if(this.task)return;const task=this.begin('discovering');this.message='Resolving selected folders. Counts remain provisional until scanning finishes.';
   try{await this.identity();const review=await this.discovery.resolve(task.abort.signal,()=>this.emit());if(task.abort.signal.aborted)throw task.abort.signal.reason;
    this.review=review;this.stage='ready';this.message=review.incomplete.length?'Discovery is incomplete. Retry the affected folders or explicitly approve the partial selection.':'Selection reviewed. Choose your save destination to begin.';
   }catch(error){this.stage='browsing';this.message=error.message||'Discovery cancelled.';}finally{this.end(task);}
  }
  cancel(){if(this.task){this.task.abort.abort(new DOMException('Export cancelled.','AbortError'));clearInterval(this.task.timer);}this.notice?.resolve(false);this.notice=null;this.partial?.resolve(false);this.partial=null;}
  async start({small=false,partial=false}={}){
   if(this.task||!this.review||this.review.revision!==this.tree.revision)return;
   const selected=this.review;if((selected.incomplete.length||selected.excluded.length)&&!partial)return;
   const archiveAPI=globalThis.AetherDownloadArchive;
   if(selected.knownBytes>(small?archiveAPI.BLOB_LIMIT:archiveAPI.DIRECT_LIMIT)){this.message='Selection exceeds this save mode’s size limit. Choose fewer files.';this.emit();return;}
   const task=this.begin('choosing');let handle;
   try{
    // Invoke the picker before the first await: the original button gesture owns it.
    if(!small){
     try{handle=await archiveAPI.choose('Aether LMS Resources.zip');}
     catch(error){if(error.name==='AbortError'){this.stage='ready';this.message='Save cancelled. Your selection is unchanged.';return;}this.smallAvailable=true;this.stage='ready';this.message='Direct saving is unavailable here. Choose the explicit small ZIP option (64 MiB), or use a supported Chrome window.';return;}
     if(!handle){this.smallAvailable=true;this.stage='ready';this.message='Direct saving is unsupported. Small ZIP export is limited to 64 MiB including archive overhead.';return;}
    }
    await this.identity();if(task.abort.signal.aborted)throw task.abort.signal.reason;
    document.dispatchEvent(new Event('aether-preview-close-all'));
    task.archive=await archiveAPI.create(handle,task.abort.signal);
    const mapping=archiveAPI.paths(this.tree,[...selected.files,...selected.empty]);
    this.progress={completed:0,bytes:0,current:'',failed:selected.excluded.map(node=>({node,reason:'Restricted or unsupported resource'})),total:selected.files.length,knownBytes:selected.knownBytes,unknown:selected.unknown};this.stage='downloading';this.emit();
    for(const node of [...selected.files].sort((a,b)=>mapping.get(a.id).localeCompare(mapping.get(b.id)))){
     if(task.abort.signal.aborted)throw task.abort.signal.reason;
     if(Date.now()-this.checkedAt>=15000)await this.identity();
     this.progress.current=node.name;this.emit();let source;
     try{
      source=await this.source(node,task);
      if(!source){this.progress.failed.push({node,reason:'Copyright acknowledgement skipped'});continue;}
      await task.archive.add(mapping.get(node.id),source.readable);this.progress.completed++;
     }catch(error){
      if(task.abort.signal.aborted||error.session||task.archive.destinationFailed)throw error;
      this.progress.failed.push({node,reason:error.message||'File unavailable'});
      // A source failure during an entry invalidates its local data. zip.js
      // excludes that entry from the central directory; no placeholder is added.
     }finally{await source?.cancel();this.emit();}
    }
    for(const node of selected.empty){if(task.abort.signal.aborted)throw task.abort.signal.reason;await task.archive.add(mapping.get(node.id),undefined,{directory:true});}
    if(!this.progress.completed&&!selected.empty.length)throw Error('No files were added. Nothing was saved. Retry or change the selection.');
    if(this.progress.failed.length){this.stage='partial';this.message=this.progress.completed+' files added, '+this.progress.failed.length+' skipped. Keep a ZIP of successful files, or discard it.';this.emit();const keep=await new Promise(resolve=>{this.partial={resolve};});this.partial=null;if(!keep)throw new DOMException('Partial export discarded.','AbortError');}
    if(task.abort.signal.aborted)throw task.abort.signal.reason;
    await this.identity();this.stage='finalizing';this.message='Finalizing the archive. Keep this page open.';this.emit();
    const result=await task.archive.finish();
    if(result.blob){const objectURL=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=objectURL;a.download='Aether LMS Resources.zip';a.hidden=true;a.dataset.aeDownloadControl='true';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),30000);}
    this.stage='completed';this.message=this.progress.completed+' files '+(result.direct?'saved':'prepared for Chrome to save')+(this.progress.failed.length?', '+this.progress.failed.length+' skipped.':'.');
   }catch(error){await task.archive?.abort();this.stage=error.name==='AbortError'?'cancelled':'failed';this.message=(error.message||'Export failed.')+' No completed archive was saved.';}
   finally{this.notice=null;this.partial=null;this.end(task);}
  }
  async source(node,task){
   const read=()=>globalThis.AetherResourceAccess.stream({u:new URL(node.url)},task.abort.signal,{onbytes:bytes=>{this.progress.bytes+=bytes;this.emit();},maxBytes:task.archive.limit});
   try{return await read();}catch(error){
    if(!error.notice)throw error;
    const approved=await new Promise(resolve=>{this.notice={node,text:error.notice.text,resolve};this.stage='copyright';this.emit();});this.notice=null;
    if(task.abort.signal.aborted)throw task.abort.signal.reason;
    this.stage='downloading';if(!approved)return null;
    await this.identity();if(task.abort.signal.aborted)throw task.abort.signal.reason;
    const controller=new AbortController(),abort=()=>controller.abort(task.abort.signal.reason),timer=setTimeout(()=>controller.abort(),20000);task.abort.signal.addEventListener('abort',abort,{once:true});
    try{await globalThis.AetherResourceAccess.accept(error.notice.accept,{u:new URL(node.url)},controller.signal);}
    finally{clearTimeout(timer);task.abort.signal.removeEventListener('abort',abort);}
    // Exactly one user-authorized acknowledgement. A second notice is a failure,
    // and manual retry starts with a fresh resource read, never an acceptance URL.
    return read();
   }
  }
 }
 let controller;
 globalThis.AetherDownloads={get(){return controller||(controller=new Controller());}};
 document.addEventListener('aether-preview-session-change',()=>controller?.reset('Session changed. Previous selections and export were cleared.'));
 window.addEventListener('beforeunload',event=>{if(controller?.task){event.preventDefault();event.returnValue='';}});
 window.addEventListener('pagehide',()=>{controller?.reset();globalThis.AetherDownloadUI?.dismiss(true);});
 window.addEventListener('pageshow',()=>{if(controller?.scope)controller.identity().catch(()=>{});});
 window.addEventListener('aether-settings-change',()=>{if(!document.documentElement.classList.contains('aether-enabled')){controller?.reset('Aether is OFF. Export cancelled.');globalThis.AetherDownloadUI?.dismiss(true);}});
})();
