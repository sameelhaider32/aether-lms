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
   let size=0;const chunks=[];
   try{while(true){if(signal?.aborted)throw new DOMException('Aborted','AbortError');const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('This file is too large for a quick preview. Open the original resource.');}chunks.push(value);}}finally{reader.releaseLock();}
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
 globalThis.AetherResourceAccess={read,resource,accept};
})();
