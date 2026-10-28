/* Pure broker regressions, including worker suspension, stale writes and quota failure. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../src/spotlight-cache-worker.js'),'utf8');
const data={},messages=[];let listener,quota=10485760;
const sender={id:'fixture-extension',frameId:0,url:'https://lms.lums.edu.pk//portal/site/home',tab:{id:1}},account='a'.repeat(64);
const chrome={runtime:{id:sender.id,onMessage:{addListener(fn){listener=fn;}}},storage:{session:{QUOTA_BYTES:10485760,async get(key){return {[key]:data[key]};},async set(value){if(JSON.stringify(value).length>quota)throw Error('Quota');Object.assign(data,structuredClone(value));}}},tabs:{async sendMessage(id,value){messages.push({id,value});}}};
const boot=()=>vm.runInNewContext(source,{chrome,crypto:webcrypto,URL,Date,Set,Map,Promise});
const send=(op,extra={},from=sender)=>new Promise(resolve=>{if(!listener({type:'aether-content-cache',op,account,...extra},from,resolve))resolve(null);});
const doc=(name='notes.txt',text='Fictional vector clocks')=>({meta:{id:'/group/course/'+name,url:'https://lms.lums.edu.pk/access/content/group/course/'+name,scope:account,title:name,extension:'txt',siteId:'course',course:'Fictional course',version:'modified:123'},chunks:[{text,location:'Line 1'}]});
(async()=>{
 boot();assert.equal(await send('connect',{}, {...sender,id:'other-extension'}),null);assert.equal(await send('connect',{}, {...sender,frameId:1}),null);assert.equal(await send('connect',{}, {...sender,url:'https://example.invalid/portal'}),null);
 let c=await send('connect'),token=c.token;assert(c.ok);assert((await send('put',{token,document:doc()})).stored);await send('opted',{token,opted:true});
 boot();c=await send('connect');assert.equal(c.token,token);assert(c.opted);assert.equal((await send('read',{token,ids:['/group/course/notes.txt']})).documents[0].chunks[0].text,'Fictional vector clocks');
 const second={...sender,tab:{id:2}};await send('connect',{},second);await send('drop',{token,ids:['/group/course/notes.txt']});assert(messages.some(m=>m.id===2&&m.value.removed?.includes('/group/course/notes.txt')));await send('invalidate',{token});assert(messages.some(m=>m.id===2&&m.value.reason==='cleared'));assert((await send('put',{token,document:doc()})).stale);
 c=await send('connect');token=c.token;assert.equal(c.cached,0);await send('put',{token,document:doc()});const changed=await send('connect',{account:'b'.repeat(64)});assert.equal(changed.cached,0);assert.notEqual(changed.token,token);
 assert((await send('read',{token,ids:['/group/course/notes.txt']})).stale);c=await send('connect');token=c.token;
 assert((await send('put',{token,document:doc('../escape.txt')})).unavailable);assert((await send('put',{token,document:{...doc(),meta:{...doc().meta,url:'https://example.invalid/text'}}})).unavailable);
 quota=600;await send('put',{token,document:doc('large.txt','x'.repeat(800))});assert.equal((await send('connect')).cached,0);quota=10485760;
 await send('put',{token,document:doc()});for(const key of Object.keys(data))delete data[key];boot();assert.equal((await send('connect')).cached,0);
 console.log('PASS sender/origin/frame checks, session-only checkpoint/worker restart, clear broadcasts, stale writes/account isolation, malformed records, quota fallback and new browser session');
})().catch(e=>{console.error(e);process.exitCode=1;});
