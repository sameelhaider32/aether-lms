/* MIT. Page-local resource tree and compact inherited selection intentions. */
(() => {
 'use strict';
 const ORIGIN='https://lms.lums.edu.pk',MAX_NODES=10000;
 function resourceId(value){
  if(typeof value!=='string'||value.length>4096)return null;
  // Sakai IDs are decoded references. URL paths are decoded by the caller once.
  if(!/^\/group\/[^/]+\//.test(value)||/[\\\u0000-\u001f\u007f]/.test(value))return null;
  if(value.split('/').some(p=>p==='.'||p==='..'))return null;
  return value;
 }
 function contentURL(value,id){
  try{
   const u=new URL(value,ORIGIN);
   if(u.origin!==ORIGIN||u.username||u.password||u.hash||u.search||!u.pathname.startsWith('/access/content/'))return null;
   return resourceId(decodeURIComponent(u.pathname.slice('/access/content'.length)))===id?u.href:null;
  }catch{return null;}
 }
 const encodeId=id=>id.split('/').map(encodeURIComponent).join('/');
 function normalize(raw,parent){
  const id=resourceId(raw?.resourceId||raw?.id);if(!id||!parent||!id.startsWith(parent.id)||id===parent.id)return null;
  const tail=id.slice(parent.id.length).replace(/\/$/,'');if(!tail||tail.includes('/'))return null;
  const props=raw.resourceProperties||raw.properties||{};
  const folder=id.endsWith('/');
  const mime=String(raw.mimeType||raw.contentType||props['DAV:getcontenttype']||raw.type||'').toLowerCase();
  const external=/url|weblink|link/i.test(raw.resourceType||raw.type||'')||mime==='text/url';
  const name=String(raw.title||raw.name||raw.displayName||props['DAV:displayname']||tail).slice(0,512);
  const given=raw.url||raw.resourceUrl;
  const url=contentURL(given||ORIGIN+'/access/content'+encodeId(id),id);
  const available=raw.hidden!==true&&raw.available!==false&&raw.accessible!==false;
  const size=raw.size??raw.contentLength??props['DAV:getcontentlength'];
  return {id,parent:parent.id,site:parent.site,name,type:external?'external':folder?'folder':url?'file':'unsupported',url:folder?null:url,
   size:size!==''&&size!==undefined&&Number.isSafeInteger(Number(size))&&Number(size)>=0?Number(size):null,
   modified:raw.modified||raw.lastModified||null,mime,available,children:[],state:folder?'unloaded':'loaded',complete:!folder,source:'api'};
 }
 class Tree {
  constructor(){this.nodes=new Map();this.roots=[];this.rules=new Map();this.revision=0;}
  root(site,name,source='navigation'){
   if(typeof site!=='string'||!site||/[\/\\\u0000-\u0020?#%]/.test(site)||site.length>256||site==='home'||site.startsWith('~'))return null;
   const id='/group/'+site+'/';let node=this.nodes.get(id);
   if(!node){if(this.nodes.size>=MAX_NODES)throw Error('Resource limit reached (10,000). Select a smaller scope.');node={id,parent:null,site,name:String(name||site).slice(0,512),type:'folder',url:null,size:null,available:true,children:[],state:'unloaded',complete:false,source};this.nodes.set(id,node);this.roots.push(id);this.revision++;}
   return node;
  }
  put(node){
   const previous=this.nodes.get(node.id);
   if(previous&&previous.parent!==node.parent)throw Error('Conflicting resource identity.');
   if(previous)return previous;
   if(this.nodes.size>=MAX_NODES)throw Error('Resource limit reached (10,000). Select a smaller scope.');
   this.nodes.set(node.id,node);const parent=this.nodes.get(node.parent);if(parent&&!parent.children.includes(node.id))parent.children.push(node.id);this.revision++;return node;
  }
  intent(id){for(let n=this.nodes.get(id);n;n=this.nodes.get(n.parent))if(this.rules.has(n.id))return this.rules.get(n.id);return false;}
  available(node){for(let n=node;n;n=this.nodes.get(n.parent))if(!n.available)return false;return true;}
  set(id,value){if(!this.nodes.has(id))return;for(const key of this.rules.keys())if(key===id||key.startsWith(id.endsWith('/')?id:id+'/'))this.rules.delete(key);this.rules.set(id,!!value);this.revision++;}
  clear(){this.rules.clear();this.revision++;}
  status(id){
   const node=this.nodes.get(id);if(!node)return 'unchecked';
   if(node.type!=='folder')return this.intent(id)?'checked':'unchecked';
   if(node.complete&&node.children.length){
    const states=node.children.map(child=>this.status(child));
    if(states.every(state=>state==='unchecked'))return 'unchecked';
    if(states.every(state=>state==='checked'))return 'checked';
    return 'mixed';
   }
   let yes=this.intent(id),no=!yes;
   for(const [key,value]of this.rules)if(key!==id&&key.startsWith(id)){yes||=value;no||=!value;}
   return yes&&no?'mixed':yes?'checked':'unchecked';
  }
  snapshot(){
   const files=[],empty=[],incomplete=[],excluded=[];
   for(const n of this.nodes.values()){
    const selected=this.intent(n.id);
    if(n.type==='folder'){
     if(selected&&(!n.complete||n.state!=='loaded'))incomplete.push(n);
     if(selected&&n.complete&&n.state==='loaded'&&!n.children.length)empty.push(n);
    }else if(selected){if(n.type==='file'&&this.available(n))files.push(n);else excluded.push(n);}
   }
   return {files,empty,incomplete,excluded,knownBytes:files.reduce((v,n)=>v+(n.size||0),0),unknown:files.filter(n=>n.size===null).length,revision:this.revision};
  }
 }
 globalThis.AetherDownloadSelection={Tree,normalize,resourceId,contentURL,encodeId,MAX_NODES};
})();
