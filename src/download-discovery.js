/* MIT. Read-only, lazy Sakai discovery. No course or file bytes at startup. */
(() => {
 'use strict';
 const origin='https://lms.lums.edu.pk',S=globalThis.AetherDownloadSelection;
 class Discovery {
  constructor(tree,access){this.tree=tree;this.access=access;this.jobs=new Map();this.courseStatus='Only courses known from Sakai navigation';}
  visible(doc){
   for(const anchor of doc.querySelectorAll('#toolMenu li.site-list-item a.sidebar-site-title,#toolMenu .site-link-block a[href]')){
    try{const u=new URL(anchor.href);const match=u.pathname.match(/^\/+portal\/site\/([^/]+)\/?$/);if(u.origin===origin&&match)this.tree.root(decodeURIComponent(match[1]),anchor.textContent.trim(),'navigation');}catch{}
   }
   for(const card of doc.querySelectorAll('.ae-record-card[data-ae-kind="resource"]')){
    const info=(doc.defaultView?.AetherResourceInfo||globalThis.AetherResourceInfo)?.describe(card);if(!info?.id?.startsWith('/group/'))continue;
    const parts=info.id.split('/'),root=this.tree.root(parts[2],this.tree.nodes.get('/group/'+parts[2]+'/')?.name||parts[2],'visible');if(!root)continue;
    let parent=root;
    const segments=info.id.slice(root.id.length).split('/').filter(Boolean);
    for(let i=0;i<segments.length;i++){
     const last=i===segments.length-1,id=parent.id+segments[i]+(!last||info.kind==='folder'?'/':'');
     const raw={resourceId:id,title:last?info.title:segments[i],mimeType:last?({pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[info.extension]||''):'',url:last?info.u?.href:undefined};
     const node=S.normalize(raw,parent);if(!node)break;node.source='visible';parent=this.tree.put(node);
    }
   }
  }
  async json(path,signal){
   const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort(Error('Metadata request timed out. Retry discovery.')),20000);
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   try{const result=await this.access.read(new URL(path,origin),controller.signal,4*1024*1024);if(controller.signal.aborted)throw controller.signal.reason;return JSON.parse(new TextDecoder().decode(result.bytes));}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  load(node,signal,force=false){
   if(this.jobs.has(node.id))return this.jobs.get(node.id);
   if(!force&&node.state==='loaded'&&Date.now()-(node.loadedAt||0)<300000)return Promise.resolve(node);
   const job=this._load(node,signal).finally(()=>this.jobs.delete(node.id));this.jobs.set(node.id,job);return job;
  }
  async _load(node,signal){
   node.state='loading';node.error=null;node.complete=false;
   try{
    const path='/direct/content/resources'+S.encodeId(node.id.replace(/\/$/,''))+'.json?depth=1';
    const data=await this.json(path,signal);if(signal?.aborted)throw signal.reason;
    const roots=Array.isArray(data)?data:data?.content_collection;
    if(!Array.isArray(roots)||roots.length!==1||roots[0]?.resourceId!==node.id)throw Error('This server did not return a verified folder root. Visible entries remain available.');
    const raw=roots[0],children=raw.resourceChildren;
    if(!Array.isArray(children))throw Error('Folder children are unavailable in this response.');
    let invalid=false;const seen=new Set();
    for(const item of children){
     const n=S.normalize(item,node);if(!n){invalid=true;continue;}
     if(seen.has(n.id)){invalid=true;continue;}seen.add(n.id);
     const previous=this.tree.nodes.get(n.id);
     if(previous){if(previous.parent!==node.id){invalid=true;continue;}Object.assign(previous,{name:n.name,url:n.url,type:n.type,size:n.size,available:n.available,mime:n.mime,modified:n.modified,source:'api'});}
     else this.tree.put(n);
    }
    // An API omitting visible records is not silently declared complete.
    const stale=node.children.some(id=>!seen.has(id));
    node.complete=!(invalid||stale||data.complete===false||raw.complete===false||raw.hasMore||data.hasMore||raw.next||data.next||Number(raw.total)>children.length||Number(data.total)>children.length);
    node.state=node.complete?'loaded':'incomplete';node.loadedAt=Date.now();
    node.error=node.complete?null:'Some folder metadata is missing or unverified. Retry, or review a partial export.';
    this.tree.revision++;return node;
   }catch(error){node.state=signal?.aborted?'unloaded':'failed';node.error=signal?.aborted?'Discovery cancelled.':error.message;throw error;}
  }
  async courses(signal,{maxPages=100}={}){
   const seen=new Set();let start=0;
   try{
    for(let page=0;page<Math.min(100,maxPages);page++){
     const data=await this.json('/direct/site.json?select=access&_limit=50&_start='+start,signal);
     const sites=Array.isArray(data)?data:data?.site_collection;
     if(!Array.isArray(sites))throw Error('Available-course API unsupported.');
     if(!sites.length){this.courseStatus='Available-site API scan finished; LUMS enrollment coverage unverified';return;}
     let added=0;
     for(const site of sites){
      const id=site.id||site.entityId;if(typeof id!=='string'||seen.has(id))continue;seen.add(id);added++;
      // Only IDs the authenticated API actually supplied, never guessed IDs.
      if(!site.type||['course','project'].includes(site.type))this.tree.root(id,site.title||id,'available-site API');
     }
     if(!added)throw Error('Repeated site page; course discovery is incomplete.');start+=sites.length;
    }
    throw Error('Course discovery limit reached; available list is incomplete.');
   }catch(error){this.courseStatus='Course discovery incomplete: '+error.message+' Navigation courses remain available.';throw error;}
  }
  async resolve(signal,onprogress){
   const queue=this.tree.roots.map(id=>({id,depth:0})),visited=new Set();
   while(queue.length){
    if(signal.aborted)throw signal.reason;const {id,depth}=queue.shift(),n=this.tree.nodes.get(id);if(!n||visited.has(id)||n.type!=='folder'||!this.tree.intent(id)&&this.tree.status(id)==='unchecked')continue;visited.add(id);
    if(depth>=128){n.state='incomplete';n.complete=false;n.error='Folder depth limit reached.';continue;}
    // Explicitly excluded subtrees need no network requests.
    if(!n.available){n.state='failed';n.complete=false;continue;}
    if(this.tree.intent(id))try{await this.load(n,signal);}catch(error){if(signal.aborted)throw error;}
    for(const child of n.children)queue.push({id:child,depth:depth+1});onprogress?.();
   }
   return this.tree.snapshot();
  }
 }
 globalThis.AetherDownloadDiscovery={Discovery};
})();
