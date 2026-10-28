/* Device-local open history. Persist hashes and timestamps, never file URLs/names. */
(() => {
 'use strict';
 try{if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;}catch{return;}
 const prefix='aether:v131:file:',legacy='aether:v14:file:',limit=1000,records=new Map(),issues=new Map(),digests=new Map();let revision=0,generation=0,account,identityJob=null,disposed=false;
 const labels={unopened:'Unopened',opened:'Opened',updated:'Updated',restricted:'Access restricted',unavailable:'Open original'};
 const notify=()=>{revision++;document.dispatchEvent(new Event('aether-file-state-change'));};
 const valid=value=>value&&Number.isFinite(value.openedAt)&&value.openedAt>0&&(value.version===null||/^[a-f0-9]{64}$/.test(value.version));
 function storage(method,arg){return new Promise((resolve,reject)=>{try{chrome.storage.local[method](arg,value=>{const error=chrome.runtime?.lastError;if(error)reject(Error('File history storage unavailable.'));else resolve(value);});}catch{reject(Error('File history storage unavailable.'));}});}
 // Web Locks cover every same-origin tab and tool frame, including startup
 // migration and clear. Enqueue the entire mutation before its first await.
 function mutate(fn){if(!globalThis.navigator?.locks)return Promise.reject(Error('File history coordination unavailable.'));return navigator.locks.request('aether-file-history-v131',fn);}
 const ready=mutate(async()=>{const values=await storage('get',null),old=Object.keys(values||{}).filter(key=>key.startsWith(legacy));if(old.length)await storage('remove',old);for(const [key,value]of Object.entries(values||{}))if(key.startsWith(prefix)&&/^[a-f0-9]{64}$/.test(key.slice(prefix.length))&&valid(value))records.set(key,value);}).then(()=>true,()=>false);
 async function hash(value){
  if(digests.has(value))return digests.get(value);
  const result=crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)).then(bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join(''));
  if(digests.size>=limit)digests.delete(digests.keys().next().value);digests.set(value,result);return result;
 }
 async function identity(){
  if(disposed)return null;if(identityJob)return identityJob;
  identityJob=(async()=>{let next=null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
   try{
    // Sakai's authenticated current-session entity, never a course/URL guess.
    const response=await fetch(top.location.origin+'/direct/session/current.json',{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal});
    if(!response.ok||Number(response.headers.get('content-length'))>16384)throw Error();const raw=await response.text();if(raw.length>16384)throw Error();const session=JSON.parse(raw);
    const id=session?.userId;if(typeof id==='string'&&id.trim()&&id!=='.anon'&&id.length<=256)next=await hash(top.location.origin+'\naccount\n'+id);
   }catch{}finally{clearTimeout(timer);}
   if(disposed)return null;
   if(account!==next){const known=account!==undefined;account=next;generation++;issues.clear();if(known)document.dispatchEvent(new Event('aether-session-change'));notify();}return next;
  })();try{return await identityJob;}finally{identityJob=null;}
 }
 function eligible(info){return info?.u?.origin===top.location.origin&&info.u.pathname.startsWith('/access/content/')&&info.kind!=='folder';}
 function version(info){
  const card=info.card,a=info.a,explicit=a.getAttribute('data-resource-version')||card.getAttribute('data-resource-version');if(explicit)return 'revision:'+explicit.slice(0,160);
  const cell=[...card.querySelectorAll('[data-ae-label]')].find(n=>/^(?:last\s+)?(?:modified|updated)(?:\s+(?:date|time))?$/i.test(n.getAttribute('data-ae-label')));
  const raw=a.getAttribute('data-last-modified')||card.getAttribute('data-last-modified')||cell?.querySelector('time[datetime]')?.getAttribute('datetime')||cell?.getAttribute('data-sort-value')||cell?.textContent||'';
  const text=raw.trim();if(!/^(?:\d{10}|\d{13}|\d{4}-\d{2}-\d{2}(?:[T ].*)?)$/.test(text))return null;
  const date=/^\d{10}$/.test(text)?Number(text)*1000:/^\d{13}$/.test(text)?Number(text):Date.parse(text);return Number.isFinite(date)?'modified:'+date:null;
 }
 async function keyFor(info,scope){return prefix+await hash(scope+'\n'+info.u.origin+info.u.pathname);}
 async function describe(info){
  if(!eligible(info))return {state:'unavailable',label:labels.unavailable};
  if(!await ready)return {state:'unavailable',label:labels.unavailable};const scope=await identity();if(!scope)return {state:'unavailable',label:labels.unavailable};const key=await keyFor(info,scope),record=records.get(key),stamp=version(info),fingerprint=stamp?await hash(stamp):null;
  if(scope!==account||disposed)return {state:'unavailable',label:labels.unavailable};
  const state=issues.get(key)||(record?record.version&&fingerprint&&record.version!==fingerprint?'updated':'opened':'unopened');
  return {state,label:labels[state],openedAt:record?.openedAt||null};
 }
 async function opened(info,successfulPreview=false){
  if(!eligible(info)||disposed)return;
  // Startup already owns the first lock; subsequent requests queue after it.
  return mutate(async()=>{if(!await ready||disposed)return;const scope=await identity();if(!scope||info.historyScope!==undefined&&info.historyScope!==scope)return;const epoch=generation,key=await keyFor(info,scope),stamp=version(info),value={openedAt:Date.now(),version:stamp?await hash(stamp):null};if(epoch!==generation||disposed)return;
   await storage('set',{[key]:value});records.set(key,value);if(successfulPreview)issues.delete(key);
   const values=await storage('get',null),stale=Object.entries(values||{}).filter(([key,value])=>key.startsWith(prefix)&&valid(value)).sort((a,b)=>b[1].openedAt-a[1].openedAt).slice(limit).map(([key])=>key);
   if(stale.length){await storage('remove',stale);for(const key of stale)records.delete(key);}notify();
  });
 }
 async function problem(info,kind){if(!eligible(info))return;const scope=await identity();if(!scope||info.historyScope!==undefined&&info.historyScope!==scope)return;const key=await keyFor(info,scope);if(scope!==account||disposed)return;issues.set(key,kind==='restricted'?'restricted':'unavailable');notify();}
 async function clear(){generation++;return mutate(async()=>{await ready;const values=await storage('get',null),keys=Object.keys(values||{}).filter(key=>key.startsWith(prefix)||key.startsWith(legacy));if(keys.length)await storage('remove',keys);records.clear();issues.clear();notify();});}
 function changed(changes,area){if(area!=='local')return;let touched=false;for(const [key,change]of Object.entries(changes))if(key.startsWith(prefix)){if(valid(change.newValue))records.set(key,change.newValue);else records.delete(key);touched=true;}if(touched)notify();}
 try{chrome.storage.onChanged.addListener(changed);}catch{}
 const refresh=()=>{identity().catch(()=>{});};window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',event=>{generation++;issues.clear();if(!event.persisted){account=null;disposed=true;try{chrome.storage.onChanged.removeListener(changed);}catch{}}});
 globalThis.AetherFileState={describe,opened,problem,clear,version,session:identity,get revision(){return revision;}};
})();
