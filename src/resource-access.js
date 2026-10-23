/* Bounded same-origin reads and explicit native Sakai copyright acknowledgement. */
(() => {
 'use strict';
 let origin;try{if(top.location.hostname!=='lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;origin=top.location.origin;}catch{return;}
 const MAX=12*1024*1024;
 const content=u=>u?.origin===origin&&u.pathname.startsWith('/access/content/');
 function canonical(value){try{return decodeURIComponent(new URL(value,origin).pathname);}catch{return '';}}
 function acceptURL(value,resource){
   try{
     const u=new URL(value,origin),ref=u.searchParams.get('ref'),back=u.searchParams.get('url');
     if(u.origin!==origin||u.pathname!=='/access/accept'||!ref||!back)return null;
     const target=new URL(back.startsWith('/content/')?'/access'+back:back,origin);
     if(!content(target)||target.search!==resource.search||canonical(target.href)!==canonical(resource.href)||ref!==canonical(resource.pathname.slice('/access'.length)))return null;
     if([...u.searchParams.keys()].some(k=>!['ref','url'].includes(k)))return null;
     return u;
   }catch{return null;}
 }
 function notice(result,resource){
   const prefix=new TextDecoder().decode(result.bytes.slice(0,300));
   if(!/html/i.test(result.mime)&&!/^\s*(?:<!doctype\s+html|<html)/i.test(prefix))return null;
   // Template contents remain inert: no native scripts, images, handlers, or
   // forms are inserted into the LMS or executed to acknowledge a notice.
   const template=document.createElement('template');template.innerHTML=new TextDecoder().decode(result.bytes);
   const links=[...template.content.querySelectorAll('a[href]')];
   const accept=links.map(a=>acceptURL(a.getAttribute('href'),resource)).find(Boolean);if(!accept)return null;
   template.content.querySelectorAll('script,style,link,iframe,object,embed,noscript').forEach(n=>n.remove());
   const text=(template.content.textContent||'').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim();
   if(!text||text.length>64000)return null;
   return {text,accept:accept.href};
 }
 async function responseBytes(response,signal,limit){
   if(!response.ok)throw Error(response.status===401||response.status===403?'This resource needs permission. Open it in Sakai.':'Preview unavailable. Open the original resource.');
   if(Number(response.headers.get('content-length'))>limit)throw Error('This file is too large for a quick preview. Open the original resource.');
   const reader=response.body?.getReader();if(!reader)throw Error('Preview unavailable. Open the original resource.');
   let size=0;const chunks=[],cancel=()=>{reader.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
   try{while(true){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const {done,value}=await reader.read();if(signal?.aborted)throw new DOMException('Aborted','AbortError');if(done)break;size+=value.length;if(size>limit)throw Error('This file is too large for a quick preview. Open the original resource.');chunks.push(value);}}
   catch(error){await reader.cancel().catch(()=>{});throw error;}finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   return {bytes,mime:(response.headers.get('content-type')||'').toLowerCase()};
 }
 async function read(u,signal,limit=MAX){
   if(u.origin!==origin)throw Error('Open the original resource to view this external file.');
   return responseBytes(await fetch(u.href,{method:'GET',credentials:'same-origin',signal,redirect:'error',cache:'default'}),signal,limit);
 }
 async function resource(info,signal,limit=MAX){
   const u=info.u;if(!content(u))throw Error('Open the original resource to see its contents.');
   // Manual redirects keep a file's redirect from fetching an external URL.
   // Sakai's copyright redirect has a documented same-origin require endpoint.
   const response=await fetch(u.href,{method:'GET',credentials:'same-origin',signal,redirect:'manual',cache:'default'});
   let result;
   if(response.type==='opaqueredirect'||response.status>=300&&response.status<400){
     const requireURL=new URL('/access/require',origin);requireURL.searchParams.set('ref',decodeURIComponent(u.pathname.slice('/access'.length)));requireURL.searchParams.set('url',u.pathname.slice('/access'.length)+u.search);
     result=await read(requireURL,signal,256*1024);
   }else result=await responseBytes(response,signal,limit);
   const copyright=notice(result,u);
   if(copyright){const error=Error('Copyright acknowledgement required.');error.notice=copyright;throw error;}
   return result;
 }
 async function accept(value,info,signal){
   const u=acceptURL(value,info.u);if(!u)throw Error('Open the original resource to acknowledge this notice in Sakai.');
   // Only called by the explicit Yes button. The native endpoint records the
   // session acknowledgement; its redirect is not followed or altered.
   const response=await fetch(u.href,{method:'GET',credentials:'same-origin',signal,redirect:'manual',cache:'no-store'});
   if(response.type!=='opaqueredirect'&&!response.ok)throw Error('Copyright acknowledgement failed. Open the original resource.');
 }
 // Download streams share the preview's exact URL/notice/acceptance policy,
 // while avoiding responseBytes() and its rendering-only whole-file limits.
 async function stream(info,signal,{onbytes=()=>{},idleMs=30000,maxBytes=2*1024**3}={}){
   const u=info.u;if(!content(u)||u.username||u.password||u.search||u.hash)throw Error('Only verified LMS content references can be exported.');
   const controller=new AbortController();let timer,reader,closed=false,total=0;
   const stop=()=>controller.abort(signal?.reason),arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(Error('The file stream stalled. Retry this read-only export.')),idleMs);};
   const cleanup=()=>{if(closed)return;closed=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);};
   if(signal?.aborted)stop();else signal?.addEventListener('abort',stop,{once:true});arm();
   try{
    const response=await fetch(u.href,{method:'GET',credentials:'same-origin',signal:controller.signal,redirect:'manual',cache:'no-store'});arm();
    if(response.status===401){const e=Error('Your session expired. Export stopped.');e.session=true;throw e;}
    if(response.type==='opaqueredirect'||response.status>=300&&response.status<400){
     const requireURL=new URL('/access/require',origin);requireURL.searchParams.set('ref',decodeURIComponent(u.pathname.slice('/access'.length)));requireURL.searchParams.set('url',u.pathname.slice('/access'.length));
     const result=await read(requireURL,controller.signal,256*1024),copyright=notice(result,u);
     const e=Error(copyright?'Copyright acknowledgement required.':'Redirect could not be verified. Use Open original in Sakai.');if(copyright)e.notice=copyright;throw e;
    }
    if(!response.ok)throw Error(response.status===403?'Access restricted by Sakai.':response.status===404?'Resource no longer available.':'The LMS returned HTTP '+response.status+'.');
    const lengthHeader=response.headers.get('content-length'),encoding=response.headers.get('content-encoding');
    const expected=lengthHeader!==null&&!encoding?Number(lengthHeader):null;
    if(expected!==null&&(!Number.isSafeInteger(expected)||expected<0||expected>maxBytes))throw Error('File exceeds the export size limit.');
    reader=response.body?.getReader();if(!reader)throw Error('The LMS returned no readable file stream.');
    const first=await reader.read();arm();
    if(controller.signal.aborted)throw controller.signal.reason;
    const mime=(response.headers.get('content-type')||'').toLowerCase(),prefix=new TextDecoder().decode(first.value?.slice(0,1024));
    const html=/text\/html|application\/xhtml/.test(mime)||/^\s*(?:<!doctype\s+html|<html)/i.test(prefix);
    if(html&&!/\.html?$/i.test(u.pathname)){
     const chunks=first.done?[]:[first.value];let size=first.value?.length||0;
     while(!first.done&&size<=256*1024){const item=await reader.read();arm();if(item.done)break;size+=item.value.length;chunks.push(item.value);}
     if(size>256*1024)throw Error('The LMS returned an unexpected HTML page. Open original in Sakai.');
     const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
     const copyright=notice({bytes,mime},u),e=Error(copyright?'Copyright acknowledgement required.':'The LMS returned a login, notice or error page instead of this file.');if(copyright)e.notice=copyright;throw e;
    }
    if(html&&/(?:type\s*=\s*["']?password|id\s*=\s*["']loginForm)/i.test(prefix))throw Error('The LMS returned a login page instead of this file.');
    let pending=first;
    const readable=new ReadableStream({
     async pull(destination){
      try{
       if(controller.signal.aborted)throw controller.signal.reason;
       const item=pending||await reader.read();pending=null;arm();
       if(controller.signal.aborted)throw controller.signal.reason;
       if(item.done){if(expected!==null&&total!==expected)throw Error('The file download was truncated.');cleanup();reader.releaseLock();destination.close();return;}
       total+=item.value.length;if(total>maxBytes)throw Error('File exceeds the export size limit.');onbytes(item.value.length);destination.enqueue(item.value);
      }catch(error){cleanup();await reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}destination.error(controller.signal.aborted?controller.signal.reason:error);}
     },
     async cancel(){controller.abort();cleanup();await reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}
    },{highWaterMark:1});
    return {readable,mime,length:expected,cancel:async()=>{controller.abort();cleanup();await reader.cancel().catch(()=>{});}};
   }catch(error){controller.abort();cleanup();if(reader){await reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}throw error;}
 }
 globalThis.AetherResourceAccess={read,resource,accept,stream};
})();
