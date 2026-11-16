/* One-use, extension-owned extractor. No resource URLs or active document rendering. */
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),origin=params.get('origin');
let used=false,disposed=false,loading=null;
const MAX_CHARS=200000,MAX_UNITS=2000;let chars=0,partial=false;const units=[];
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
function add(value,location){
 const text=String(value||'').replace(/[\t\r ]+/g,' ').trim();if(!text)return;
 if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;return;}
 const room=MAX_CHARS-chars,kept=text.slice(0,room);if(kept.length<text.length)partial=true;
 units.push({text:kept,location});chars+=kept.length;
}
const all=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
const first=(node,name)=>all(node,name)[0];
const attr=(node,name)=>(name==='id'?node.getAttribute('r:id'):null)||node.getAttribute(name)||node.getAttribute('w:'+name)||node.getAttribute('r:'+name)||'';
function xml(text){if(!text||/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Malformed or unsupported Office XML.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('Malformed Office XML.');return doc;}
async function office(buffer,ext){
 let entries;try{entries=AetherArchiveGuard.inspect(buffer);}catch{throw Error('Damaged, encrypted or unsupported Office archive.');}let advertised=0;
 if(entries.length>1500)throw Error('Too large: Office entry limit.');
 for(const e of entries){advertised+=e.bytes;if(e.bytes>8*1024**2||advertised>64*1024**2)throw Error('Too large: expanded Office limit.');}
 const zip=await JSZip.loadAsync(buffer),parts=new Map();let actual=0;
 // Validate actual decompressed sizes, including unused media. Never trust central sizes.
 for(const e of entries){
  if(disposed)throw Error('Cancelled.');if(e.name.endsWith('/'))continue;
  const file=zip.file(e.name);if(!file)throw Error('Malformed Office archive.');
  const retain=/^(?:word\/document\.xml|ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml)|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(e.name);
  if(retain&&e.bytes>2*1024**2)throw Error('Too large: Office XML part limit.');
  const chunks=[];let size=0;
  await new Promise((resolve,reject)=>{
   let stopped=false;const stream=file.internalStream('uint8array');
   stream.on('data',chunk=>{size+=chunk.length;actual+=chunk.length;if(disposed||size>e.bytes||size>8*1024**2||actual>64*1024**2){stopped=true;stream.pause();reject(Error('Malformed or oversized Office archive.'));}else if(retain)chunks.push(chunk);})
    .on('end',()=>{if(!stopped)size===e.bytes?resolve():reject(Error('Malformed Office archive size.'));}).on('error',reject).resume();
  });
  if(retain){const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}parts.set(e.name,new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  await yieldUI();
 }
 const part=name=>xml(parts.get(name));
 function relationships(path,base,kind){const links=new Map();for(const r of all(part(path),'Relationship')){if(r.getAttribute('TargetMode')==='External'||!r.getAttribute('Type')?.endsWith('/'+kind))continue;const target=r.getAttribute('Target')||'';if(/[:\\?#]|^\//.test(target))continue;const u=new URL(target,'https://local.invalid/'+base+'/');if(u.origin==='https://local.invalid'&&u.pathname.startsWith('/'+base+'/'))links.set(r.getAttribute('Id'),u.pathname.slice(1));}return links;}
 if(ext==='docx'){
  let n=0;for(const p of all(part('word/document.xml'),'p')){
   const text=all(p,'r').filter(r=>!r.closest('del,moveFrom')&&!all(r,'vanish').some(v=>!['0','false','off'].includes(attr(v,'val')))).map(r=>all(r,'t').map(t=>t.textContent).join('')).join('');
   add(text,'Paragraph '+(++n));if(n%50===0)await yieldUI();if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}
  }
 }else if(ext==='pptx'){
  const links=relationships('ppt/_rels/presentation.xml.rels','ppt','slide'),slides=all(part('ppt/presentation.xml'),'sldId');
  if(slides.length>150)partial=true;
  for(let i=0;i<Math.min(slides.length,150);i++){
   const path=links.get(attr(slides[i],'id'));if(!path){partial=true;continue;}const doc=part(path),root=doc.documentElement;if(root.getAttribute('show')==='0'||root.getAttribute('show')==='false')continue;
   const surface=first(root,'cSld');if(surface)for(const p of all(surface,'p')){let hidden=false;for(let a=p.parentElement;a&&a!==surface;a=a.parentElement)if(all(a,'cNvPr').some(v=>['1','true'].includes(v.getAttribute('hidden')))){hidden=true;break;}if(!hidden)add(all(p,'t').map(t=>t.textContent).join(''),'Slide '+(i+1));}
   await yieldUI();if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}
  }
 }else if(ext==='xlsx'){
  const links=relationships('xl/_rels/workbook.xml.rels','xl','worksheet'),sheets=all(part('xl/workbook.xml'),'sheet');
  const strings=parts.has('xl/sharedStrings.xml')?all(part('xl/sharedStrings.xml'),'si').map(si=>all(si,'t').filter(t=>!t.closest('rPh')).map(t=>t.textContent).join('')):[];
  for(const sheet of sheets){
   if(sheet.hasAttribute('state')&&sheet.getAttribute('state')!=='visible')continue;
   const path=links.get(attr(sheet,'id'));if(!path){partial=true;continue;}const doc=part(path),hidden=new Set();
   for(const col of all(doc,'col'))if(['1','true'].includes(col.getAttribute('hidden')))for(let c=Math.max(1,Number(col.getAttribute('min')));c<=Math.min(50,Number(col.getAttribute('max')));c++)hidden.add(c);
   for(const row of all(doc,'row')){
    if(['1','true'].includes(row.getAttribute('hidden')))continue;
    if(Number(row.getAttribute('r'))>500){partial=true;continue;}
    for(const c of all(row,'c')){
     const address=c.getAttribute('r')||'',m=/^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address);if(!m){partial=true;continue;}
     let col=0;for(const ch of m[1])col=col*26+ch.charCodeAt(0)-64;if(col>50||Number(m[2])>500){partial=true;continue;}if(hidden.has(col))continue;
     const type=c.getAttribute('t'),v=first(c,'v')?.textContent;let value='';
     if(type==='s')value=strings[Number(v)]||'';else if(type==='inlineStr')value=all(c,'t').map(t=>t.textContent).join('');else if(v!==undefined)value=type==='b'?(v==='1'?'true':'false'):v;
     else if(first(c,'f'))partial=true; // Never index formula expressions or calculate them.
     add(value,(sheet.getAttribute('name')||'Worksheet')+' · '+address);
     if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}
    }
    if(chars>=MAX_CHARS||units.length>=MAX_UNITS)break;
    if(Number(row.getAttribute('r'))%30===0)await yieldUI();
   }
   await yieldUI();if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}
  }
 }else throw Error('Unsupported Office format.');
}
async function pdf(buffer){
 const lib=await import('../vendor/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
 const root=new URL('../vendor/pdfjs/',import.meta.url).href;
 loading=lib.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,enableScripting:false,enableXfa:false,cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/',verbosity:0});
 loading.onPassword=()=>{loading.destroy();};
 let doc;try{doc=await loading.promise;}catch(error){throw Error(error.name==='PasswordException'||/password|destroyed/i.test(error.message)?'Encrypted PDF: open original with its password.':'Corrupt or unsupported PDF.');}
 try{
  if(doc.numPages>150)partial=true;
  for(let n=1;n<=Math.min(doc.numPages,150);n++){
   if(disposed)throw Error('Cancelled.');const page=await doc.getPage(n),reader=page.streamTextContent().getReader();let text='';
   try{while(true){const item=await reader.read();if(item.done)break;for(const value of item.value.items){if(typeof value.str==='string')text+=(value.str+(value.hasEOL?'\n':' '));if(text.length>MAX_CHARS-chars){text=text.slice(0,MAX_CHARS-chars);partial=true;break;}}if(partial&&text.length>=MAX_CHARS-chars){await reader.cancel();break;}}}finally{reader.releaseLock();}
   add(text,'Page '+n);page.cleanup();await yieldUI();
   if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}
  }
 }finally{await loading.destroy();loading=null;}
}
function plain(buffer){
 const bytes=new Uint8Array(buffer);let encoding='utf-8';if(bytes[0]===255&&bytes[1]===254)encoding='utf-16le';else if(bytes[0]===254&&bytes[1]===255)encoding='utf-16be';
 const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);if(text.includes('\0'))throw Error('Unsupported binary text encoding.');
 const lines=text.split(/\r?\n/);for(let i=0;i<lines.length;i++){add(lines[i],'Line '+(i+1));if(chars>=MAX_CHARS||units.length>=MAX_UNITS){partial=true;break;}}
}
const send=data=>{if(!disposed)parent.postMessage({...data,type:'aether-content-result',token},origin);};
window.addEventListener('message',async e=>{
 if(used||disposed||parent!==top||e.source!==parent||origin!=='https://lms.lums.edu.pk'||e.origin!==origin||!token||e.data?.type!=='aether-content-data'||e.data.token!==token||!(e.data.bytes instanceof ArrayBuffer))return;used=true;
 try{const {bytes,extension}=e.data;const limit=extension==='pdf'?12*1024**2:['docx','pptx','xlsx'].includes(extension)?8*1024**2:128*1024;if(bytes.byteLength>limit)throw Error('Too large for content indexing.');
  if(extension==='pdf')await pdf(bytes);else if(['docx','pptx','xlsx'].includes(extension))await office(bytes,extension);else if(/^(txt|md|markdown|csv|json|log|py|js|ts|jsx|tsx|java|c|cpp|h|hpp|css|html|xml|yml|yaml|sql|sh|r|rb|go|rs|ipynb)$/.test(extension))plain(bytes);else throw Error('Unsupported format.');
  send({state:'done',units,partial,empty:!units.length});
 }catch(error){send({state:'error',message:String(error.message||'Extraction failed.').slice(0,180)});}
});
window.addEventListener('pagehide',()=>{disposed=true;loading?.destroy();units.length=0;});
if(parent!==self&&parent===top&&origin==='https://lms.lums.edu.pk'&&/^[\da-f-]{36}$/i.test(token||''))send({state:'ready'});
