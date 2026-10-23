/* Device-local open history. Persist hashes and timestamps, never file URLs/names. */
(() => {
 'use strict';
 try{if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;}catch{return;}
 const prefix='aether:v14:file:',limit=1000,records=new Map(),issues=new Map(),digests=new Map();let revision=0,generation=0;
 const labels={unopened:'Unopened',opened:'Opened',updated:'Updated',restricted:'Access restricted',unavailable:'Open original'};
 const notify=()=>{revision++;document.dispatchEvent(new Event('aether-file-state-change'));};
 const valid=value=>value&&Number.isFinite(value.openedAt)&&value.openedAt>0&&(value.version===null||/^[a-f0-9]{64}$/.test(value.version));
 function storage(method,arg){return new Promise(resolve=>{try{chrome.storage.local[method](arg,value=>{const error=chrome.runtime?.lastError;resolve(error?undefined:value);});}catch{resolve(undefined);}});}
 const ready=storage('get',null).then(values=>{for(const [key,value]of Object.entries(values||{}))if(key.startsWith(prefix)&&/^[a-f0-9]{64}$/.test(key.slice(prefix.length))&&valid(value))records.set(key,value);});
 async function hash(value){
  if(digests.has(value))return digests.get(value);
  const result=crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)).then(bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join(''));
  if(digests.size>=limit)digests.delete(digests.keys().next().value);digests.set(value,result);return result;
 }
 function eligible(info){return info?.u?.origin===top.location.origin&&info.u.pathname.startsWith('/access/content/')&&info.kind!=='folder';}
 function version(info){
  const card=info.card,a=info.a,explicit=a.getAttribute('data-resource-version')||card.getAttribute('data-resource-version');if(explicit)return 'revision:'+explicit.slice(0,160);
  const cell=[...card.querySelectorAll('[data-ae-label]')].find(n=>/^(?:last\s+)?(?:modified|updated)(?:\s+(?:date|time))?$/i.test(n.getAttribute('data-ae-label')));
  const raw=a.getAttribute('data-last-modified')||card.getAttribute('data-last-modified')||cell?.querySelector('time[datetime]')?.getAttribute('datetime')||cell?.getAttribute('data-sort-value')||cell?.textContent||'';
  const text=raw.trim();if(!/^(?:\d{10}|\d{13}|\d{4}-\d{2}-\d{2}(?:[T ].*)?)$/.test(text))return null;
  const date=/^\d{10}$/.test(text)?Number(text)*1000:/^\d{13}$/.test(text)?Number(text):Date.parse(text);return Number.isFinite(date)?'modified:'+date:null;
 }
 async function keyFor(info){return prefix+await hash(info.u.origin+info.u.pathname);}
 async function describe(info){
  if(!eligible(info))return {state:'unavailable',label:labels.unavailable};
  await ready;const key=await keyFor(info),record=records.get(key),stamp=version(info),fingerprint=stamp?await hash(stamp):null;
  const state=issues.get(key)||(record?record.version&&fingerprint&&record.version!==fingerprint?'updated':'opened':'unopened');
  return {state,label:labels[state],openedAt:record?.openedAt||null};
 }
 async function opened(info,successfulPreview=false){
  if(!eligible(info))return;const epoch=generation;
  await ready;const key=await keyFor(info),stamp=version(info),value={openedAt:Date.now(),version:stamp?await hash(stamp):null};if(epoch!==generation)return;
  records.set(key,value);if(successfulPreview)issues.delete(key);await storage('set',{[key]:value});
  const stale=[...records].sort((a,b)=>b[1].openedAt-a[1].openedAt).slice(limit).map(([key])=>key);
  if(stale.length){for(const key of stale)records.delete(key);await storage('remove',stale);}notify();
 }
 async function problem(info,kind){if(!eligible(info))return;const key=await keyFor(info);issues.set(key,kind==='restricted'?'restricted':'unavailable');notify();}
 async function clear(){generation++;await ready;const values=await storage('get',null),keys=Object.keys(values||{}).filter(key=>key.startsWith(prefix));records.clear();issues.clear();if(keys.length)await storage('remove',keys);notify();}
 function changed(changes,area){if(area!=='local')return;let touched=false;for(const [key,change]of Object.entries(changes))if(key.startsWith(prefix)){if(valid(change.newValue))records.set(key,change.newValue);else records.delete(key);touched=true;}if(touched)notify();}
 try{chrome.storage.onChanged.addListener(changed);}catch{}
 window.addEventListener('pagehide',event=>{if(!event.persisted)try{chrome.storage.onChanged.removeListener(changed);}catch{}});
 globalThis.AetherFileState={describe,opened,problem,clear,version,get revision(){return revision;}};
})();
