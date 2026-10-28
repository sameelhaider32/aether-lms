/* Trusted-context, browser-session-only text cache. Never uses local/sync/IndexedDB. */
'use strict';
const KEY='aether:v182:content-session',ORIGIN='https://lms.lums.edu.pk';
const MAX={files:100,chars:2000000,chunks:4000,documentChars:200000,documentChunks:400};
let state=null,serial=Promise.resolve();
const blank=()=>({schema:1,account:'',token:crypto.randomUUID(),revision:0,opted:false,documents:[],clients:[]});
const trusted=sender=>{try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&u.origin===ORIGIN&&/^\/+portal(?:\/|$)/.test(u.pathname);}catch{return false;}};
const account=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
async function load(){if(state)return;await chrome.storage.session.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'});const value=(await chrome.storage.session.get(KEY))[KEY];state=value?.schema===1&&Array.isArray(value.documents)&&Array.isArray(value.clients)?value:blank();}
const manifest=()=>({ok:true,token:state.token,revision:state.revision,opted:state.opted,cached:state.documents.length,documents:state.documents.map(d=>({meta:d.meta,partial:d.partial,cachedAt:d.cachedAt,chars:d.chars}))});
function sanitize(value,scope){
 const m=value?.meta;if(!m||m.scope!==scope||typeof m.id!=='string'||m.id.length>4096||!/^\/group\/[^/]+\/.+[^/]$/.test(m.id)||/[\\\u0000-\u001f]/.test(m.id)||m.id.split('/').some(v=>v==='.'||v==='..'))throw Error('Invalid cache descriptor.');
 const u=new URL(m.url);if(u.origin!==ORIGIN||u.search||u.hash||u.username||u.password||decodeURIComponent(u.pathname)!=='/access/content'+m.id)throw Error('Invalid cache URL.');
 const meta={id:m.id,url:u.href,scope};for(const [key,max]of Object.entries({title:300,extension:12,version:160,course:300,siteId:256,mime:180}))meta[key]=String(m[key]||'').slice(0,max);
 if(meta.siteId!==m.id.split('/')[2]||!Array.isArray(value.chunks)||!value.chunks.length||value.chunks.length>MAX.documentChunks)throw Error('Invalid cache document.');
 let chars=0;const chunks=value.chunks.map(c=>{if(typeof c.text!=='string'||!c.text.length||c.text.length>800||typeof c.location!=='string'||c.location.length>160)throw Error('Invalid cache chunk.');chars+=c.text.length;return {text:c.text,location:c.location};});
 if(chars>MAX.documentChars)throw Error('Cache document too large.');
 return {meta,chunks,chars,partial:!!value.partial,cachedAt:Date.now()};
}
function trim(){
 const budget=Math.min(6*1024**2,Math.floor((chrome.storage.session.QUOTA_BYTES||1024**2)*.7));
 const size=()=>JSON.stringify(state).length*2+state.documents.length*2048;
 while(state.documents.length&&(state.documents.length>MAX.files||state.documents.reduce((n,d)=>n+d.chars,0)>MAX.chars||state.documents.reduce((n,d)=>n+d.chunks.length,0)>MAX.chunks||size()>budget))state.documents.shift();
}
async function save(){
 trim();while(true){try{await chrome.storage.session.set({[KEY]:state});return;}catch(error){if(!state.documents.length)throw error;state.documents.shift();}}
}
async function broadcast(reason,exclude=-1,removed=[]){
 for(const id of state.clients)if(id!==exclude)try{await chrome.tabs.sendMessage(id,{type:'aether-content-cache-change',token:state.token,revision:state.revision,reason,removed},{frameId:0});}catch{}
}
async function invalidate(reason,exclude=-1){const clients=state.clients;await chrome.storage.session.remove?.(KEY);state=blank();state.clients=clients;await save();await broadcast(reason,exclude);return manifest();}
async function handle(message,sender){
 await load();const id=sender.tab.id;if(!state.clients.includes(id)){state.clients.push(id);state.clients=state.clients.slice(-100);}
 const op=message.op;
 if(op==='invalidate'){
  if(message.token&&message.token!==state.token)return {ok:false,stale:true};
  return invalidate('cleared',id);
 }
 if(!account(message.account))throw Error('Authenticated cache scope required.');
 if(op==='connect'){
  if(state.account&&state.account!==message.account)await invalidate('identity',id);
  if(!state.account)state.account=message.account;await save();return manifest();
 }
 if(state.account!==message.account||message.token!==state.token)return {ok:false,stale:true};
 if(op==='read'){
  const ids=new Set(Array.isArray(message.ids)?message.ids.slice(0,100):[]);return {...manifest(),documents:state.documents.filter(d=>ids.has(d.meta.id))};
 }
 if(op==='put'){
  const doc=sanitize(message.document,state.account);state.documents=state.documents.filter(d=>d.meta.id!==doc.meta.id);state.documents.push(doc);state.revision++;await save();await broadcast('updated',id);return {...manifest(),stored:state.documents.some(d=>d.meta.id===doc.meta.id)};
 }
 if(op==='drop'){
  const ids=new Set(Array.isArray(message.ids)?message.ids.slice(0,100):[]);state.documents=state.documents.filter(d=>!ids.has(d.meta.id));state.revision++;await save();await broadcast('updated',id,[...ids]);return manifest();
 }
 if(op==='opted'){state.opted=message.opted===true;state.revision++;await save();await broadcast('updated',id);return manifest();}
 throw Error('Unsupported cache operation.');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type!=='aether-content-cache'||!trusted(sender))return false;
 const task=serial.then(()=>handle(message,sender));serial=task.catch(()=>{});
 task.then(reply,()=>reply({ok:false,unavailable:true}));return true;
});
// A browser restart/reload/update clears storage.session itself. Worker suspension does not.
