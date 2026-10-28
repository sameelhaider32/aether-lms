/* Session-only content service: validated reads, bounded helper jobs and inverted index. */
(() => {
 'use strict';if(window!==top||location.origin!=='https://lms.lums.edu.pk')return;
 const LIMITS=Object.freeze({files:100,batchBytes:64*1024**2,documentChars:200000,documentChunks:400,indexChars:2000000,indexChunks:4000,timeout:30000});
 const supported=new Set('pdf docx pptx xlsx txt md markdown csv json log py js ts jsx tsx java c cpp h hpp css html xml yml yaml sql sh r rb go rs ipynb'.split(' '));
 const docs=new Map(),postings=new Map(),chunks=new Map(),listeners=new Set(),pendingConsent=new Set();
 let scope='',epoch=0,opted=false,source=()=>[],queue=[],running=false,batch=null,active=null,seq=0,totalChars=0,report=[];
 const store=()=>globalThis.AetherAcademicStore;
 const enabled=()=>document.documentElement.classList.contains('aether-enabled')&&!document.body?.classList.contains('is-logged-out')&&!document.querySelector('#loginForm input[type=password]');
 const fold=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const tokens=s=>[...new Set(fold(s).split(' ').filter(Boolean))];
 const notify=()=>{for(const fn of listeners)fn();};
 function descriptor(row){
  const m=row.metadata||row;try{
   const url=globalThis.AetherDownloadSelection?.contentURL(m.url||m.u?.href,m.id),u=url&&new URL(url);
   if(!u||m.scope&&scope&&m.scope!==scope||String(m.id).endsWith('/'))return null;
   const title=String(m.title||row.title||'Document').slice(0,300),extension=(m.extension||title.match(/\.([a-z0-9]{1,10})$/i)?.[1]||decodeURIComponent(u.pathname).match(/\.([a-z0-9]{1,10})$/i)?.[1]||(/application\/pdf/i.test(m.mime||'')?'pdf':'')).toLowerCase();
   return {id:m.id,url:u.href,u,title,extension,scope:m.scope||scope,version:String(m.version||''),course:String(row.course||m.course||'Course document').slice(0,300),siteId:row.siteId||m.siteId||String(m.id).split('/')[2],mime:m.mime||''};
  }catch{return null;}
 }
 function available(){return source().map(row=>row.type==='folder'?{...row,folder:true}:descriptor(row)).filter(Boolean).slice(0,3000);}
 function remove(id){const d=docs.get(id);if(!d)return;for(const key of d.keys){const c=chunks.get(key);totalChars-=c.text.length;for(const t of c.terms){const p=postings.get(t);p?.delete(key);if(!p?.size)postings.delete(t);}chunks.delete(key);}docs.delete(id);}
 function ingest(meta,result){
  remove(meta.id);let partial=!!result.partial,chars=0;const keys=[];
  outer:for(const unit of result.units){
   const value=String(unit.text||'').slice(0,LIMITS.documentChars);if(!value.trim())continue;
   for(let at=0;at<value.length;at+=600){
    if(keys.length>=LIMITS.documentChunks||chars>=LIMITS.documentChars||chunks.size>=LIMITS.indexChunks||totalChars>=LIMITS.indexChars){partial=true;break outer;}
    const max=Math.min(800,LIMITS.documentChars-chars,LIMITS.indexChars-totalChars),text=value.slice(at,at+max);if(!text)break;
    if(text.length<Math.min(800,value.length-at))partial=true;
    const terms=tokens(text),key=++seq;chunks.set(key,{id:meta.id,text,location:String(unit.location||'Document match').slice(0,160),terms});
    for(const term of terms){if(!postings.has(term))postings.set(term,new Set());postings.get(term).add(key);}keys.push(key);chars+=text.length;totalChars+=text.length;
    if(at+800>=value.length)break;
   }
  }
  if(!keys.length)return 'Index full · clear indexed contents or choose fewer documents';
  docs.set(meta.id,{...meta,keys,partial});return partial?'Partially indexed':'Indexed';
 }
 function query(value,current=''){
  const phrase=fold(value),terms=tokens(value).slice(0,10);if(!terms.length||String(value).trim().startsWith('>'))return [];
  const lists=terms.map(t=>postings.get(t));if(lists.some(p=>!p))return [];
  lists.sort((a,b)=>a.size-b.size);const found=new Map();
  for(const key of lists[0]){
   if(!lists.every(p=>p.has(key)))continue;const c=chunks.get(key),d=docs.get(c.id),text=fold(c.text),positions=terms.map(t=>text.indexOf(t)),span=Math.max(...positions)-Math.min(...positions);
   const exact=(' '+text+' ').includes(' '+phrase+' '),score=(exact?610:420)+Math.max(0,55-span/5)+(d.siteId===current?9:0);
   const old=found.get(c.id),count=(old?.count||0)+1;if(old&&old.score>=score){old.count=count;continue;}
   const lower=c.text.toLocaleLowerCase(),first=Math.min(...terms.map(t=>lower.indexOf(t)).filter(n=>n>=0)),start=Math.max(0,(Number.isFinite(first)?first:0)-90);
   found.set(c.id,{key:'content:'+d.id,type:'content',title:d.title,course:d.course,siteId:d.siteId,url:d.url,metadata:d,fileType:d.extension,location:c.location,snippet:(start?'…':'')+c.text.slice(start,start+310)+(start+310<c.text.length?'…':''),score,count,partial:d.partial});
  }
  return [...found.values()].sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,30).map(r=>({...r,meta:r.fileType.toUpperCase()+' · '+r.location+' · '+r.count+' matching passage'+(r.count===1?'':'s')+(r.partial?' · Partially indexed':'')}));
 }
 async function verify(){
  const who=await store()?.verify();if(!enabled()||!who||store().snapshot().blocked){if(scope||queue.length||docs.size)clear();return '';}
  if(scope&&scope!==who){clear();return '';}
  scope=who;return who;
 }
 function extract(bytes,extension,signal){
  return new Promise((resolve,reject)=>{
   const token=crypto.randomUUID(),frame=document.createElement('iframe'),url=chrome.runtime.getURL('preview/content.html'),helperOrigin=new URL(url).origin;let sent=false;
   frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.src=url+'#'+new URLSearchParams({token,origin:location.origin});
   const clean=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);signal.removeEventListener('abort',cancel);frame.remove();};
   const fail=error=>{clean();reject(error);},cancel=()=>fail(new DOMException('Cancelled','AbortError'));
   const timeout=setTimeout(()=>fail(Error('Extraction timed out.')),LIMITS.timeout);
   function receive(e){
    if(e.source!==frame.contentWindow||e.origin!==helperOrigin||e.data?.type!=='aether-content-result'||e.data.token!==token)return;
    if(e.data.state==='ready'&&!sent){sent=true;const copy=bytes.slice().buffer;frame.contentWindow.postMessage({type:'aether-content-data',token,bytes:copy,extension},helperOrigin,[copy]);}
    else if(e.data.state==='done'&&sent){const r=e.data;if(!Array.isArray(r.units)||r.units.length>2000||r.units.reduce((n,u)=>n+String(u.text||'').length,0)>LIMITS.documentChars)return fail(Error('Invalid extraction result.'));clean();resolve(r);}
    else if(e.data.state==='error'&&sent)fail(Error(String(e.data.message||'Extraction failed.').slice(0,180)));
   }
   if(signal.aborted){cancel();return;}signal.addEventListener('abort',cancel,{once:true});window.addEventListener('message',receive);document.body.append(frame);
  });
 }
 const ceiling=ext=>ext==='pdf'?12*1024**2:['docx','pptx','xlsx'].includes(ext)?8*1024**2:128*1024;
 async function process(task){
  const {meta,row,group}=task;if(task.epoch!==epoch||group?.cancelled){row.status='Cancelled';notify();return;}
  const generation=task.epoch,who=await verify();if(generation!==epoch)return;if(!who||meta.scope&&meta.scope!==who){row.status='Session unavailable';notify();return;}
  if(!supported.has(meta.extension)){row.status='Skipped unsupported';notify();return;}
  if(docs.get(meta.id)?.version===meta.version&&!task.force){row.status=docs.get(meta.id).partial?'Partially indexed':'Indexed';notify();return;}
  if(docs.size>=LIMITS.files&&!docs.has(meta.id)){row.status='Index full · 100 documents';notify();return;}
  remove(meta.id);
  const abort=new AbortController();active={abort,group,id:meta.id};let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;abort.abort();},LIMITS.timeout);
  row.status='Reading';notify();
  try{
   const budget=group?LIMITS.batchBytes-group.bytes:ceiling(meta.extension);if(budget<=0)throw Error('Batch byte limit reached.');
   let result=task.result;
   if(!result)result=await globalThis.AetherResourceAccess.resource(meta,abort.signal,Math.min(ceiling(meta.extension),budget),{onbytes:n=>{if(group){group.bytes+=n;if(group.bytes>LIMITS.batchBytes)abort.abort();}}});else if(group)group.bytes+=result.bytes.length;
   if(abort.signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(result.bytes.length>Math.min(ceiling(meta.extension),budget))throw Error('Too large for indexing limits.');
   const prefix=new TextDecoder().decode(result.bytes.slice(0,1024));
   if(/text\/html|application\/xhtml/i.test(result.mime)&&meta.extension!=='html'&&/(?:id\s*=\s*["']loginForm|type\s*=\s*["']?password)/i.test(prefix)){clear();return;}
   row.status='Extracting';notify();const extracted=await extract(result.bytes,meta.extension,abort.signal);
   if(abort.signal.aborted||generation!==epoch||await verify()!==who||generation!==epoch)throw new DOMException('Cancelled','AbortError');
   row.status=extracted.empty?(extracted.partial?'Partially inspected · no readable text in inspected portion':meta.extension==='pdf'?'No extractable text · scanned/image-only PDF; no OCR':'No readable text'):ingest({...meta,scope:who},extracted);pendingConsent.delete(meta.id);
  }catch(error){
   if(generation!==epoch)return;
   if(error.httpStatus===401){clear();return;}
   row.status=timedOut?'Timed out':abort.signal.aborted?'Cancelled':error.notice?'Copyright acknowledgment required':error.httpStatus===403?'Permission denied':/too large|oversiz|limit/i.test(error.message)?'Too large · '+error.message:error.message||'Failed';
   if(error.notice){if(pendingConsent.size>=100)pendingConsent.delete(pendingConsent.values().next().value);pendingConsent.add(meta.id);}
  }finally{clearTimeout(timeout);if(active?.abort===abort)active=null;if(generation===epoch)notify();}
 }
 async function pump(){if(running)return;running=true;try{while(queue.length){const task=queue.shift();await process(task);if(task.group)task.group.completed++;notify();}}finally{running=false;notify();}}
 function enqueue(meta,result,group=null,force=false){
  if(active?.id===meta.id||queue.some(t=>t.meta.id===meta.id)||queue.length>=LIMITS.files)return;
  const row={meta,status:'Queued'};report.push(row);if(report.length>100)report.shift();if(result&&(result.bytes.length>ceiling(meta.extension)||queue.reduce((n,t)=>n+(t.result?.bytes.length||0),0)+result.bytes.length>24*1024**2)){row.status=result.bytes.length>ceiling(meta.extension)?'Too large for content indexing':'Parser busy · retry this preview or select it in a batch';notify();return row;}queue.push({meta,result,row,group,force,epoch});pump();return row;
 }
 async function start(rows){
  const generation=epoch;if(running||queue.length||!await verify()||generation!==epoch||running||queue.length)return;
  const chosen=[...new Map(rows.slice(0,LIMITS.files).map(descriptor).filter(Boolean).map(d=>[d.id,d])).values()];report=[];batch={total:chosen.length,completed:0,bytes:0,cancelled:false};
  for(const meta of chosen)enqueue(meta,null,batch,true);notify();
 }
 function cancel(){if(batch)batch.cancelled=true;active?.abort.abort();for(const task of queue){task.row.status='Cancelled';if(task.group)task.group.completed++;}queue=[];notify();}
 function clear(){epoch++;cancel();scope='';opted=false;pendingConsent.clear();docs.clear();postings.clear();chunks.clear();totalChars=0;report=[];batch=null;notify();}
 async function opened(info,result=null){
  if(!opted&&!pendingConsent.has(info.id))return;
  const generation=epoch;if(!await verify()||generation!==epoch)return;
  const meta=descriptor({...info,url:info.url||info.u?.href,scope:info.historyScope||info.scope||scope,version:info.version||(info.card&&info.a?globalThis.AetherFileState?.version(info):'')||''});if(meta&&supported.has(meta.extension))enqueue(meta,result);
 }
 function stopOpened(){opted=false;if(active&&!active.group)active.abort.abort();queue=queue.filter(t=>{if(t.group)return true;t.row.status='Cancelled';return false;});notify();}
 async function optIn(info,result){const generation=epoch;if(!await verify()||generation!==epoch)return;opted=true;notify();if(info)opened(info,result);}
 function snapshot(){return {documents:docs.size,chars:totalChars,chunks:chunks.size,opted,report:report.slice(),busy:running||!!queue.length,batch:batch?{...batch}:null};}
 document.addEventListener('aether-session-change',clear);document.addEventListener('aether-preview-session-change',clear);
 window.addEventListener('aether-settings-change',()=>{if(!enabled())clear();});window.addEventListener('pagehide',clear);
 const observer=new MutationObserver(()=>{if(!enabled()&&(scope||opted||docs.size||queue.length))clear();});observer.observe(document.documentElement,{attributes:true,attributeFilter:['class'],subtree:true,childList:true});
 const timer=setInterval(()=>{if(scope)verify().catch(clear);},30000);window.addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect();});
 store()?.subscribe(()=>{const s=store().snapshot();if((scope||opted||docs.size||queue.length)&&(s.blocked||scope&&s.scope!==scope))clear();});
 globalThis.AetherSpotlightContent={LIMITS,supported,descriptor,available,query,opened,optIn,stopOpened,start,cancel,clear,snapshot,verify,setSource(fn){source=fn;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
})();
