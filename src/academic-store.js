/* Shared, account-scoped, memory-only cache over the existing academic adapters. */
(() => {
 'use strict';
 if(window!==top||globalThis.AetherAcademicStore)return;
 const blank=()=>({courses:[],records:[],tools:[],sources:[],checkedAt:0});
 let data=blank(),scope=null,epoch=0,task=null,blocked=false;
 const listeners=new Set();
 const enabled=()=>document.documentElement.classList.contains('aether-enabled')&&!document.body?.classList.contains('is-logged-out')&&!document.querySelector('#loginForm input[type=password]');
 function emit(){for(const fn of listeners)try{fn();}catch{}}
 function clear(lock=false){epoch++;task?.abort.abort();task=null;scope=null;data=blank();blocked ||= lock;emit();}
 async function verify(allowBlocked=false){
  if(blocked&&!allowBlocked||!enabled())return null;
  const version=epoch;let who=null;try{who=await globalThis.AetherFileState?.session()||null;}catch{}
  if(version!==epoch||blocked&&!allowBlocked||!enabled())return null;
  if(!who){clear();return null;}
  if(scope&&scope!==who){clear(true);return null;}scope=who;return who;
 }
 function snapshot(){return {...data,scope,blocked,loading:!!task};}
 function consume(t,signal,publish){
  return new Promise((resolve,reject)=>{
   const client={publish};let done=false;
   const finish=(error)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);t.clients.delete(client);if(!t.clients.size&&task===t)t.abort.abort();error?reject(error):resolve();};
   const abort=()=>finish(new DOMException('Academic check cancelled','AbortError'));
   if(signal?.aborted){abort();return;}t.clients.add(client);signal?.addEventListener('abort',abort,{once:true});
   if(data.checkedAt)publish?.(data);t.promise.then(()=>finish(),finish);
  });
 }
 async function load(ctx,signal,publish,{force=false,allowBlocked=false}={}){
  const who=await verify(allowBlocked);if(!who)throw Error(blocked?'Session changed. Refresh your LMS tab.':'Authenticated session unavailable. Native Sakai remains available.');
  if(signal?.aborted)throw new DOMException('Academic check cancelled','AbortError');
  if(task)return consume(task,signal,publish);
  if(!force&&data.checkedAt&&Date.now()-data.checkedAt<300000){publish?.(data);return;}
  const t={abort:new AbortController(),clients:new Set(),epoch,who};task=t;emit();
  t.promise=Promise.resolve().then(async()=>{
   const timer=setInterval(()=>verify(allowBlocked).then(current=>{if(current!==who)t.abort.abort();}),30000);
   try{
    await globalThis.AetherAcademicSources.load(ctx,t.abort.signal,value=>{
     if(t.abort.signal.aborted||epoch!==t.epoch||scope!==who||!enabled())return;
     data={...value,courses:value.courses.slice(0,250),records:value.records.slice(0,4000),tools:(value.tools||[]).slice(0,1500),sources:value.sources.slice(0,80)};
     for(const client of t.clients)client.publish?.(data);emit();
    });
    const current=await verify(allowBlocked);if(current!==who||t.abort.signal.aborted)throw new DOMException('Academic check cancelled','AbortError');
   }finally{clearInterval(timer);if(task===t){task=null;emit();}}
  });
  return consume(t,signal,publish);
 }
 document.addEventListener('aether-session-change',()=>clear(true));
 document.addEventListener('aether-preview-session-change',()=>clear(true));
 window.addEventListener('aether-settings-change',()=>{if(!enabled())clear();});
 window.addEventListener('pagehide',()=>{document.dispatchEvent(new Event('aether-document-departure'));clear();});
 globalThis.AetherAcademicStore={load,verify,snapshot,clear,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
})();
