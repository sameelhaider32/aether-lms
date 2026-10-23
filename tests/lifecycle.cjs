/* Deterministic async scheduling; fictional identities and document readers only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=p=>fs.readFileSync(path.join(process.env.AETHER_SOURCE||path.join(__dirname,'..'),p),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let failures=0,passes=0;
async function test(name,fn){try{await fn();passes++;console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
function history(){
 const values={},listeners=new Set(),writes=[];let hold=false,account='fictional-a',failure=false,tail=Promise.resolve();
 const emit=changes=>{for(const f of listeners)f(changes,'local');};
 const chrome={runtime:{},storage:{local:{
  get(_keys,cb){cb({...values});},
  set(next,cb){const run=()=>{if(failure){chrome.runtime.lastError={message:'Fixture write failed'};cb();delete chrome.runtime.lastError;return;}const changes={};for(const [key,value]of Object.entries(next)){changes[key]={newValue:value};values[key]=value;}emit(changes);cb();};if(hold)writes.push(run);else run();},
  remove(keys,cb){if(failure){chrome.runtime.lastError={message:'Fixture remove failed'};cb();delete chrome.runtime.lastError;return;}const changes={};for(const key of keys){changes[key]={};delete values[key];}emit(changes);cb();}
 },onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}}};
 const locks={request(_name,fn){const result=tail.then(fn);tail=result.catch(()=>{});return result;}};
 const load=()=>{const events={};const scope={chrome,crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,Event,AbortController,setTimeout,clearTimeout,URL,DOMException,navigator:{locks},fetch:async()=>({ok:true,headers:{get:()=>null},json:async()=>({userId:account}),text:async()=>JSON.stringify({userId:account})}),document:{dispatchEvent(e){for(const f of events[e.type]||[])f(e);},addEventListener(n,f){(events[n]||=[]).push(f);}},window:{addEventListener(n,f){(events[n]||=[]).push(f);}},top:{location:{origin:'https://lms.lums.edu.pk',pathname:'/portal'}}};vm.runInNewContext(source('src/file-state.js'),scope);return scope.AetherFileState;};
 const node={getAttribute:n=>n==='data-resource-version'?'one':null,querySelectorAll:()=>[]};
 const file={u:new URL('https://lms.lums.edu.pk/access/content/group/fictional/shared.pdf'),a:node,card:node,kind:'pdf'};
 return {values,file,load,writes,set hold(v){hold=v;},set account(v){account=v;},set failure(v){failure=v;}};
}
function reader(kind='pdf',options={}){
 const events={},nodes={},messages=[],imports=[],frames=[];let destroys=0,renders=0;
 const node=id=>nodes[id]||=( {id,hidden:false,textContent:'',value:'page',disabled:false,style:{},dataset:{},clientWidth:900,clientHeight:700,width:0,height:0,children:[],setAttribute(){},addEventListener(n,f){this[n]=f;},replaceChildren(...v){this.children=v;},append(...v){this.children.push(...v);},getContext(){return options.noCanvas?null:{};}} );
 const emit=(name,e)=>Promise.all((events[name]||[]).map(f=>f(e)));
 const lib={GlobalWorkerOptions:{},getDocument(){imports.push('getDocument');return {promise:options.parse?.promise||Promise.resolve(pdf),destroy(){destroys++;return Promise.resolve();}};}};
 const pdf={numPages:2,getPage:async()=>{if(options.page)await options.page.promise;return {getViewport:({scale})=>({width:600*scale,height:800*scale}),render(){renders++;return {promise:options.render?.promise||Promise.resolve(),cancel(){}};}};}};
 const parent={postMessage:m=>messages.push(m)};parent.top=parent;
 const scope={URL,URLSearchParams,ArrayBuffer,Uint8Array,TextDecoder,TextEncoder,Error,Promise,location:{hash:'#token=fixture&origin=https%3A%2F%2Flms.lums.edu.pk'},parent,devicePixelRatio:1,requestAnimationFrame:f=>{frames.push(f);return frames.length;},cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},document:{querySelector:s=>node(s.slice(1)),addEventListener(){},createElement:tag=>node(tag),head:{append(){}}},window:{addEventListener(n,f){(events[n]||=[]).push(f);}},AetherArchiveGuard:{inspect:()=>[]},JSZip:{loadAsync:async()=>({})},__import:async()=>{imports.push('import');if(options.importing)await options.importing.promise;return kind==='pdf'?lib:{PptxViewer:{open:async()=>{if(options.open)await options.open.promise;return {slideCount:2,destroy(){destroys++;},renderSlide:async()=>{}};}}};}};
 scope.globalThis=scope;
 if(kind==='office')scope.AetherArchiveGuard.inspect=()=>[{name:'ppt/presentation.xml',bytes:0}];
 scope.JSZip.loadAsync=async()=>({file:()=>({internalStream:()=>{const handlers={};const stream={on(n,f){handlers[n]=f;return stream;},resume(){queueMicrotask(()=>handlers.end());},pause(){}};return stream;}})});
 vm.runInNewContext(source('preview/'+kind+'.js').replace(/import\.meta\.url/g,"'https://extension.invalid/preview/reader.js'").replace(/\bimport\(/g,'__import('),scope);
 const data=()=>emit('message',{source:parent,origin:'https://lms.lums.edu.pk',data:{type:'aether-'+kind+'-data',token:'fixture',bytes:new ArrayBuffer(8)}});
 const flush=async()=>{for(let i=0;i<10;i++){while(frames.length)frames.shift()(0);await tick();}};
 return {data,emit,flush,nodes,messages,imports,get destroys(){return destroys;},get renders(){return renders;}};
}
(async()=>{
 await test('History: a pending write cannot undo completed clear, including a second tab',async()=>{
  const h=history(),a=h.load(),b=h.load();await a.describe(h.file);h.hold=true;const opening=a.opened(h.file);for(let i=0;i<20&&!h.writes.length;i++)await tick();assert.equal(h.writes.length,1);
  let completed=false;const clearing=b.clear().then(()=>completed=true);await tick();assert.equal(completed,false,'clear must wait for prior storage callback');h.hold=false;h.writes.shift()();await Promise.all([opening,clearing]);assert.equal(Object.keys(h.values).length,0);
 });
 await test('History: shared file is isolated across accounts and logout',async()=>{
  const h=history(),a=h.load();await a.opened(h.file);assert.equal((await a.describe(h.file)).state,'opened');h.account='fictional-b';assert.equal((await a.describe(h.file)).state,'unopened');await a.opened(h.file);h.account=null;assert.equal((await a.describe(h.file)).state,'unavailable');await a.opened(h.file);h.account='fictional-a';assert.equal((await a.describe(h.file)).state,'opened');assert(!JSON.stringify(h.values).includes('fictional'));
 });
 await test('History: unscoped legacy records never migrate into a student account',async()=>{
  const h=history();const hash=require('node:crypto').createHash('sha256').update(h.file.u.origin+h.file.u.pathname).digest('hex');h.values['aether:v14:file:'+hash]={openedAt:Date.now(),version:null};const a=h.load();assert.equal((await a.describe(h.file)).state,'unopened');await a.clear();assert.equal(Object.keys(h.values).length,0);
 });
 await test('History: concurrent opens survive cross-tab events and failures do not poison the queue',async()=>{
  const h=history(),a=h.load(),b=h.load();await Promise.all([a.opened(h.file),b.opened({...h.file,u:new URL(h.file.u.href+'-2')})]);assert.equal(Object.keys(h.values).length,2);h.failure=true;await assert.rejects(a.clear());h.failure=false;await a.clear();assert.equal((await b.describe(h.file)).state,'unopened');await a.opened(h.file);assert.equal((await b.describe(h.file)).state,'opened');
 });
 await test('PDF: duplicate data during import initializes exactly once',async()=>{
  const importing=deferred(),r=reader('pdf',{importing});const a=r.data(),b=r.data();await tick();importing.resolve();await r.flush();await Promise.all([a,b]);assert.equal(r.imports.filter(x=>x==='getDocument').length,1);
 });
 for(const stage of ['importing','parse','page','render'])await test('PDF: close during '+stage+' has no late UI/message or orphan task',async()=>{
  const gate=deferred(),r=reader('pdf',{[stage]:gate});const loading=r.data();await tick();if(stage==='page'||stage==='render')await r.flush();await r.emit('pagehide',{});const before=r.messages.length;gate.resolve(stage==='parse'?{numPages:2,getPage:async()=>{throw Error('closed');}}:undefined);await r.flush();await loading;assert.equal(r.messages.length,before);if(stage==='importing')assert.equal(r.imports.includes('getDocument'),false);else assert.equal(r.destroys,1);if(stage==='page')assert.equal(r.renders,0);
 });
 await test('PDF: terminal parse error is reported once and duplicate data cannot revive it',async()=>{
  const parse=deferred(),r=reader('pdf',{parse});const loading=r.data();await tick();parse.reject(Error('broken'));await loading;await r.data();await r.emit('pagehide',{});await r.emit('pagehide',{});assert.equal(r.messages.filter(m=>m.state==='error').length,1);assert.equal(r.destroys,1);
 });
 await test('PDF: canvas failure produces one terminal error and releases task',async()=>{
  const r=reader('pdf',{noCanvas:true});const loading=r.data();await r.flush();await loading;assert.equal(r.messages.filter(m=>m.state==='error').length,1);assert.equal(r.destroys,1);
 });
 await test('Office: close during open destroys late viewer exactly once',async()=>{
  const open=deferred(),r=reader('office',{open});const loading=r.data();await tick();await r.emit('pagehide',{});open.resolve();await loading;await r.emit('pagehide',{});assert.equal(r.destroys,1);assert.equal(r.messages.filter(m=>m.state==='rendered').length,0);
 });
 console.log(`${passes}/${passes+failures} lifecycle checks passed`);process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
