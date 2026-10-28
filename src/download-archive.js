/* MIT. Sequential STORE/ZIP64 export with backpressure; ZIP code loads on use. */
(() => {
 'use strict';
 const BLOB_LIMIT=64*1024**2,DIRECT_LIMIT=2*1024**3;let library;
 function safeSegment(value){
  let name=String(value||'Untitled').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').replace(/[. ]+$/g,'').trim();
  if(!name||name==='.'||name==='..')name='Untitled';
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;
  // Bound UTF-8 path components, preserving the extension where practical.
  const encode=new TextEncoder();if(encode.encode(name).length>150){const ext=name.match(/\.[a-z0-9]{1,12}$/i)?.[0]||'';let base=name.slice(0,name.length-ext.length);while(encode.encode(base+ext).length>150)base=Array.from(base).slice(0,-1).join('');name=base+ext;}
  return name;
 }
 const mimeExtensions={'application/pdf':'pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','application/msword':'doc','application/vnd.ms-powerpoint':'ppt','application/vnd.ms-excel':'xls','text/plain':'txt','text/csv':'csv','application/json':'json','application/zip':'zip','application/x-zip-compressed':'zip','image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','audio/mpeg':'mp3','video/mp4':'mp4'};
 const suffix=value=>{const ext=String(value||'').match(/\.([a-z0-9]{1,10})$/i)?.[1]||'';return /[a-z]/i.test(ext)?ext:'';};
 function dispositionName(value){
  const extended=String(value||'').match(/(?:^|;)\s*filename\*\s*=\s*(?:"?)(?:UTF-8)''([^;"\r\n]+)/i);
  if(extended)try{return decodeURIComponent(extended[1].trim());}catch{}
  return String(value||'').match(/(?:^|;)\s*filename\s*=\s*(?:"([^"\r\n]*)"|([^;\r\n]*))/i)?.slice(1).find(Boolean)?.trim()||'';
 }
 function fileName(node,response={}){
  const name=safeSegment(node.name);if(node.type!=='file'||suffix(name))return name;
  let path='';try{path=decodeURIComponent(new URL(node.url||'https://lms.lums.edu.pk/access/content'+node.id).pathname).split('/').pop();}catch{}
  const mime=value=>mimeExtensions[String(value||'').split(';')[0].trim().toLowerCase()]||'';
  const ext=suffix(dispositionName(response.disposition))||suffix(path)||mime(node.mime)||mime(response.mime)||response.detectedExtension||'';
  return safeSegment(name+(ext?'.'+ext:''));
 }
 function paths(tree,nodes){
  const assigned=new Map(),used=new Map();
  function path(node){
   if(assigned.has(node.id))return assigned.get(node.id);
   const parent=node.parent?tree.nodes.get(node.parent):null,base=parent?path(parent):'',segment=fileName(node),key=base.toLocaleLowerCase('en-US');
   if(!used.has(key))used.set(key,new Set());const names=used.get(key);let unique=segment,index=2;
   const extension=node.type==='file'?(segment.match(/\.[^.]+$/)?.[0]||''):'';
   while(names.has(unique.toLocaleLowerCase('en-US')))unique=segment.slice(0,segment.length-extension.length)+' ('+(index++)+')'+extension;
   names.add(unique.toLocaleLowerCase('en-US'));const result=base+unique+(node.type==='folder'?'/':'');
   if(new TextEncoder().encode(result).length>4096)throw Error('Archive path is too long. Select a shallower scope.');assigned.set(node.id,result);return result;
  }
  // Stable identities, rather than click order, decide collision suffixes.
  const needed=new Map();for(const node of nodes)for(let n=node;n;n=tree.nodes.get(n.parent))needed.set(n.id,n);
  for(const n of [...needed.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))path(n);
  const mapping=new Map(nodes.map(n=>[n.id,path(n)]));
  // Response headers can restore an extension absent from both title and metadata.
  // Reserve final names against every selected sibling, including already streamed files.
  mapping.file=(node,response)=>{
   const old=mapping.get(node.id),at=old.lastIndexOf('/')+1,base=old.slice(0,at),segment=fileName(node,response);
   if(old.slice(at)===segment)return old;
   const names=used.get(base.toLocaleLowerCase('en-US'));names.delete(old.slice(at).toLocaleLowerCase('en-US'));
   const extension=segment.match(/\.[^.]+$/)?.[0]||'';let unique=segment,index=2;
   while(names.has(unique.toLocaleLowerCase('en-US')))unique=segment.slice(0,segment.length-extension.length)+' ('+(index++)+')'+extension;
   names.add(unique.toLocaleLowerCase('en-US'));const result=base+unique;if(new TextEncoder().encode(result).length>4096)throw Error('Archive path is too long. Select a shallower scope.');mapping.set(node.id,result);return result;
  };
  return mapping;
 }
 async function load(){
  if(!library)library=import(chrome.runtime.getURL('vendor/zip/zip-core.min.js')).then(()=>{
   globalThis.zip.configure({useWebWorkers:false,maxWorkers:1,chunkSize:64*1024});return globalThis.zip;
  }).catch(error=>{library=null;throw error;});return library;
 }
 // Called synchronously by the final Download ZIP button, before any awaits.
 async function choose(name){
  if(typeof globalThis.showSaveFilePicker!=='function')return null;
  return showSaveFilePicker({suggestedName:name,types:[{description:'ZIP archive',accept:{'application/zip':['.zip']}}]});
 }
 async function create(handle,signal,engine){
  const zip=engine||await load();if(signal.aborted)throw signal.reason;
  const chunks=[];let bytes=0,aborted=false,finished=false,disk,diskWriter,destinationError=null;
  if(handle){disk=await handle.createWritable();diskWriter=disk.getWriter();}
  const limit=handle?DIRECT_LIMIT:BLOB_LIMIT;
  const destination=new WritableStream({
   async write(chunk){
    try{if(aborted||signal.aborted)throw signal.reason||Error('Export cancelled.');
    if(bytes+chunk.length>limit)throw Error(handle?'Direct export limit is 2 GiB. Choose a smaller scope.':'Small export exceeds 64 MiB. Use direct saving or a smaller selection.');
    if(diskWriter)await diskWriter.write(chunk);else chunks.push(chunk.slice());bytes+=chunk.length;}
    catch(error){destinationError=error;throw error;}
   }
  },{highWaterMark:1});
  const writer=new zip.ZipWriter(destination,{level:0,useWebWorkers:false,bufferedWrite:false,zip64:true,preventClose:true,dataDescriptor:true});
  async function abort(){if(aborted||finished)return;aborted=true;chunks.length=0;if(diskWriter){await diskWriter.abort().catch(()=>{});diskWriter.releaseLock();}}
  return {
   async add(path,readable,options={}){await writer.add(path,readable,{...options,signal,level:0,bufferedWrite:false,zip64:true});},
   get destinationFailed(){return !!destinationError;},
   async finish(){
    if(aborted||signal.aborted)throw signal.reason||Error('Export cancelled.');
    await writer.close();if(signal.aborted)throw signal.reason;
    if(diskWriter){await diskWriter.close();diskWriter.releaseLock();}
    finished=true;const blob=handle?null:new Blob(chunks,{type:'application/zip'});chunks.length=0;return {blob,bytes,direct:!!handle};
   },abort,get bytes(){return bytes;},limit
  };
 }
 globalThis.AetherDownloadArchive={safeSegment,fileName,paths,choose,create,BLOB_LIMIT,DIRECT_LIMIT};
})();
