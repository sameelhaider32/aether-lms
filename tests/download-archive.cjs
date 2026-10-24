/* The committed browser ZIP engine, independently extracted with JSZip/Python. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),JSZip=require('jszip');
const provenance=require('../vendor/zip/provenance.json');assert.equal(provenance.version,'2.24.0');for(const [file,hash]of Object.entries(provenance.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../vendor/zip',file))).digest('hex'),hash,file);
const zip=require('../vendor/zip/zip-core.min.js');zip.configure({useWebWorkers:false,chunkSize:64*1024});
const context={TextEncoder,Blob,WritableStream,ReadableStream,DOMException,URL,AbortController};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/download-archive.js'),'utf8'),context);const A=context.AetherDownloadArchive;
const bytes=value=>new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(value));c.close();}});
const results=[];async function test(name,fn){const at=Date.now();await fn();results.push({name,ms:Date.now()-at});console.log('PASS',name);}
(async()=>{
 await test('Sanitize Windows names, Unicode, traversal, separators, length and case collisions',async()=>{
  for(const value of ['..','../x','CON.txt','a\\b','/absolute','NUL','A?.pdf','bad\u0000.txt']){const safe=A.safeSegment(value);assert(!/[\\/\u0000]/.test(safe));assert(!['.','..','CON.txt','NUL'].includes(safe));}
  assert.equal(A.safeSegment('ملف.pdf'),'ملف.pdf');assert(new TextEncoder().encode(A.safeSegment('😀'.repeat(200)+'.pdf')).length<=150);
  const nodes=[{id:'root/',parent:null,type:'folder',name:'Course'},{id:'root/1',parent:'root/',name:'A.pdf',type:'file'},{id:'root/2',parent:'root/',name:'a.PDF',type:'file'}],tree={nodes:new Map(nodes.map(n=>[n.id,n]))};const p=A.paths(tree,nodes.slice(1));assert.equal(p.get('root/1'),'Course/A.pdf');assert.equal(p.get('root/2'),'Course/a (2).PDF');
 });
 await test('ZIP64 archive contains binary contents, Unicode and empty folders',async()=>{
  const a=await A.create(null,new AbortController().signal,zip);await a.add('Course/ملف.txt',bytes('Fictional contents'));await a.add('Course/Empty/',undefined,{directory:true});const result=await a.finish(),buffer=Buffer.from(await result.blob.arrayBuffer()),z=await JSZip.loadAsync(buffer);assert.equal(await z.file('Course/ملف.txt').async('string'),'Fictional contents');assert(z.files['Course/Empty/'].dir);assert(buffer.includes(Buffer.from([80,75,6,6])),'ZIP64 end record');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aether-export-')),file=path.join(dir,'sample.zip');fs.writeFileSync(file,buffer);const check=cp.spawnSync('python',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read("Course/ملف.txt").decode()=="Fictional contents"',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 });
 await test('Failed stream has no ZIP entry; later successful entries remain independently readable',async()=>{
  const a=await A.create(null,new AbortController().signal,zip);await a.add('before.txt',bytes('before'));let sent=false;
  const broken=new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(new Uint8Array(4000));}else c.error(Error('Fictional disconnect'));}});
  await assert.rejects(a.add('failed.txt',broken));assert.equal(a.destinationFailed,false);await a.add('after.txt',bytes('after'));const result=await a.finish(),z=await JSZip.loadAsync(await result.blob.arrayBuffer());assert(!z.file('failed.txt'));assert.equal(await z.file('after.txt').async('string'),'after');assert.equal(await z.file('before.txt').async('string'),'before');
 });
 await test('Direct stream writes before source completion with bounded backpressure (128 MiB)',async()=>{
  const before=process.memoryUsage();let produced=0,written=0,maxAhead=0,writes=0;const total=128*1024**2,chunk=64*1024;
  const handle={async createWritable(){return new WritableStream({async write(value){written+=value.length;writes++;if(writes%100===0)await new Promise(resolve=>setImmediate(resolve));}});}};
  const source=new ReadableStream({pull(c){if(produced===total)return c.close();produced+=chunk;maxAhead=Math.max(maxAhead,produced-written);c.enqueue(new Uint8Array(chunk));}},{highWaterMark:1});
  const a=await A.create(handle,new AbortController().signal,zip);await a.add('large.bin',source);assert(written>total*.99);assert(maxAhead<2*1024**2,'Backpressure bound: '+maxAhead);await a.finish();results.push({streaming:{input:produced,output:written,maxAhead,writes,heapBefore:before.heapUsed,heapAfter:process.memoryUsage().heapUsed,arrayBuffersBefore:before.arrayBuffers,arrayBuffersAfter:process.memoryUsage().arrayBuffers}});
 });
 await test('Disk failure aborts output; cancellation does not finalize or close as success',async()=>{
  let aborted=0,closed=0;const handle={async createWritable(){return new WritableStream({write(){throw Error('Disk full');},abort(){aborted++;},close(){closed++;}});}};const a=await A.create(handle,new AbortController().signal,zip);await assert.rejects(a.add('file.txt',bytes('contents')));assert(a.destinationFailed);await a.abort();assert.equal(closed,0);
  const abort=new AbortController(),b=await A.create(null,abort.signal,zip);abort.abort();await assert.rejects(b.add('no.txt',bytes('no')));await b.abort();await assert.rejects(b.finish());
 });
 await test('Blob fallback enforces actual output limit despite unknown/false size metadata',async()=>{
  const a=await A.create(null,new AbortController().signal,zip);let left=65;const source=new ReadableStream({pull(c){if(!left--)return c.close();c.enqueue(new Uint8Array(1024**2));}});await assert.rejects(a.add('oversized.bin',source));assert(a.destinationFailed);await a.abort();
 });
 fs.mkdirSync(path.join(__dirname,'../reports/downloader'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../reports/downloader/archive.json'),JSON.stringify({platform:process.platform,node:process.version,results},null,2));console.log('6/6 archive checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
