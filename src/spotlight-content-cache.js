/* Content-side broker. Session storage remains hidden from content/page contexts. */
(() => {
 'use strict';if(window!==top||location.origin!=='https://lms.lums.edu.pk')return;
 let ticket='',scope='';const UNKNOWN_AGE=4*60*60*1000;
 async function request(op,data={}){try{return await chrome.runtime.sendMessage({type:'aether-content-cache',op,account:scope,token:ticket,...data});}catch{return {ok:false,unavailable:true};}}
 async function connect(who){scope=who;const result=await request('connect');if(result.ok)ticket=result.token;return result;}
 function stamp(value){
  if(value&&typeof value==='object')value=value.time??value.epochMillis??value.value??value.display??'';
  const v=String(value||'').trim();if(!v||v==='[object Object]')return '';
  if(/^revision:/.test(v))return v;
  if(/^modified:\d+$/.test(v))return v;
  if(/^\d{10}(?:\d{3})?$/.test(v))return 'modified:'+(Number(v)*(v.length===10?1000:1));
  if(/^\d{4}-\d\d-\d\d(?:[T ].*)?$/.test(v)){const date=Date.parse(v);if(Number.isFinite(date))return 'modified:'+date;}
  return v.slice(0,160);
 }
 function current(cached,version){const old=stamp(cached.meta.version),next=stamp(version);return old&&next?old===next:Date.now()-cached.cachedAt<UNKNOWN_AGE;}
 async function validate(manifest,signal,check){
  const controller=globalThis.AetherDownloads?.get(),S=globalThis.AetherDownloadSelection,allowed=[],stale=[],denied=[];let deferred=0;
  if(!controller||!S)return {allowed,stale,denied,deferred:manifest.length};
  const who=scope;if(await controller.identity()!==who)return {allowed,stale,denied,deferred:manifest.length};
  const groups=new Map();
  for(const d of manifest.slice(0,100)){
   const m=d.meta;if(!m||m.scope!==who||!S.contentURL(m.url,m.id))continue;
   const parent=m.id.slice(0,m.id.lastIndexOf('/')+1);if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(d);
  }
  for(const [parent,documents]of [...groups].slice(0,32)){
   if(signal.aborted){deferred+=documents.length;continue;}await check();
   const sample=documents[0].meta,root=controller.tree.root(sample.siteId,sample.course,'session-cache metadata');let node=root;
   if(!root)continue;
   for(const part of parent.slice(root.id.length).split('/').filter(Boolean)){const id=node.id+part+'/',existing=controller.tree.nodes.get(id);node=existing||controller.tree.put(S.normalize({resourceId:id,title:part},node));}
   try{
    await controller.discovery.load(node,signal);
    await check();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    for(const doc of documents){
     const found=controller.tree.nodes.get(doc.meta.id);
     if(!node.listedIds?.has(doc.meta.id)||!found||found.type!=='file'||!controller.tree.available(found)){denied.push(doc.meta.id);continue;}
     if(current(doc,found.modified||found.version))allowed.push(doc.meta.id);else stale.push(doc.meta.id);
    }
   }catch(error){deferred+=documents.length;}
  }
  for(const values of [...groups.values()].slice(32))deferred+=values.length;
  return {allowed,stale,denied,deferred};
 }
 globalThis.AetherSpotlightContentCache={connect,validate,stamp,current,read:ids=>request('read',{ids}),put:document=>request('put',{document}),drop:ids=>request('drop',{ids}),opted:value=>request('opted',{opted:value}),async clear(all=false){return request('invalidate',all?{token:''}:{});},subscribe(fn){const listener=(message,sender)=>{if(sender.id===chrome.runtime.id&&message?.type==='aether-content-cache-change')fn(message);};chrome.runtime.onMessage.addListener(listener);return()=>chrome.runtime.onMessage.removeListener(listener);}};
})();
