/* Scroll-linked course dissolve, inspired by the supplied Forma recording.
   Local, bounded Canvas decoration; original link text remains in the DOM. */
(() => {
  'use strict';
  const engine=globalThis.AetherMotion;
  if(!engine||window!==top||globalThis.AetherCourseFade)return;
  const host=document.documentElement,items=new Map();
  let frame=0,disposed=false;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  function reset(item){
    for(const key of ['--ae-course-opacity','--ae-title-opacity','--ae-particle-opacity'])item.card.style.removeProperty(key);
    item.card.removeAttribute('data-ae-dissolve');
  }
  function remove(item){reset(item);sizes?.unobserve(item.title);item.canvas?.remove();items.delete(item.card);}
  function queue(){if(!frame&&!disposed&&!document.hidden)frame=engine.request(update);}
  function invalidate(){for(const item of items.values())item.width=0;queue();}
  // Sample the actual rendered font and wrapping, rather than storing an image
  // or substituting a second title that could change the link's accessible name.
  function sample(item){
    const {title}=item,box=title.getBoundingClientRect(),style=getComputedStyle(title);
    if(!box.width||!box.height)return false;
    if(item.width===box.width&&item.height===box.height)return Boolean(item.points?.length);
    item.width=box.width;item.height=box.height;item.points=null;
    const pad=32,w=Math.ceil(box.width)+pad*2,h=Math.ceil(box.height)+pad*2;
    if(w>2048||h>512)return false;
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;
    const ctx=mask.getContext('2d',{willReadFrequently:true});
    if(!ctx)return false;
    ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fillStyle=style.color;
    const text=item.ink.firstChild;
    if(!text||text.nodeType!==Node.TEXT_NODE)return false;
    const range=document.createRange(),lines=[];let offset=0;
    for(const char of text.textContent){
      range.setStart(text,offset);offset+=char.length;range.setEnd(text,offset);
      const rect=range.getBoundingClientRect();let line=lines[lines.length-1];
      if(!line||Math.abs(line.top-rect.top)>2){line={top:rect.top,left:rect.left,height:rect.height,text:''};lines.push(line);}
      line.text+=char;
    }
    for(const line of lines){
      const metrics=ctx.measureText(line.text),ascent=metrics.fontBoundingBoxAscent||parseFloat(style.fontSize)*.85,descent=metrics.fontBoundingBoxDescent||parseFloat(style.fontSize)*.2;
      ctx.fillText(line.text,line.left-box.left+pad,line.top-box.top+pad+(line.height-ascent-descent)/2+ascent);
    }
    const pixels=ctx.getImageData(0,0,w,h).data,points=[];
    // At most 1,600 points per title, regardless of viewport or title length.
    for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const alpha=pixels[(y*w+x)*4+3];if(alpha>80)points.push({x,y,alpha:alpha/255});}
    const stride=Math.max(1,Math.ceil(points.length/1600));
    item.points=points.filter((_,i)=>i%stride===0).map((p,i)=>{
      const seed=Math.sin((i+1)*127.1+item.index*311.7)*43758.5453,noise=seed-Math.floor(seed);
      return {...p,dx:(noise-.5)*62,dy:(Math.sin(i*17.3+item.index)*.5-.25)*72,r:.65+noise*.5};
    });
    if(!item.points.length)return false;
    if(!item.canvas){
      item.canvas=document.createElement('canvas');item.canvas.className='ae-course-particles';item.canvas.setAttribute('aria-hidden','true');title.append(item.canvas);
    }
    const dpr=Math.min(devicePixelRatio||1,2);
    item.canvas.width=Math.ceil(w*dpr);item.canvas.height=Math.ceil(h*dpr);
    item.canvas.style.width=w+'px';item.canvas.style.height=h+'px';
    item.ctx=item.canvas.getContext('2d');if(!item.ctx)return false;
    item.ctx.setTransform(dpr,0,0,dpr,0,0);item.color=style.color;item.w=w;item.h=h;
    return true;
  }
  function bounds(card){
    let top=0,bottom=innerHeight;
    // Sakai can scroll main#content instead of the document.
    for(let node=card.parentElement;node&&node!==document.body;node=node.parentElement){
      const overflow=getComputedStyle(node).overflowY;
      if(/auto|scroll|hidden|clip/.test(overflow)){const r=node.getBoundingClientRect();top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}
    }
    const header=document.querySelector('.portal-header');
    if(header&&/fixed|sticky/.test(getComputedStyle(header).position))top=Math.max(top,header.getBoundingClientRect().bottom);
    return {top,bottom};
  }
  function draw(item,dissolve){
    const {ctx,w,h}=item;ctx.clearRect(0,0,w,h);
    if(dissolve<.005||dissolve>.995)return;
    const spread=dissolve*dissolve,direction=item.direction;
    ctx.fillStyle=item.color;
    for(const p of item.points){
      ctx.globalAlpha=p.alpha*(1-dissolve*.65);
      ctx.beginPath();ctx.arc(p.x+p.dx*spread,p.y+p.dy*spread+direction*spread*14,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function update(){
    frame=0;
    for(const item of items.values()){
      if(!item.card.isConnected){remove(item);continue;}
      if(!engine.moving()||item.card.closest('[data-edit="true"]')||item.card.contains(document.activeElement)){reset(item);continue;}
      const rect=item.card.getBoundingClientRect(),view=bounds(item.card);
      const band=Math.min(340,rect.height*1.6,(view.bottom-view.top)*.55);
      if(band<=0){reset(item);continue;}
      const entering=smooth((view.bottom-rect.top)/band),leaving=smooth((rect.bottom-view.top)/band);
      const dissolve=1-Math.min(entering,leaving);item.direction=entering<leaving?1:-1;
      // Fully revealed cards require no canvas work. Fail open on font/Canvas errors.
      if(dissolve<.005){reset(item);continue;}
      if(rect.bottom<view.top||rect.top>view.bottom){reset(item);continue;}
      try{
        if(!sample(item)){reset(item);continue;}
        draw(item,dissolve);
        item.card.style.setProperty('--ae-course-opacity',(1-dissolve*.78).toFixed(3));
        item.card.style.setProperty('--ae-title-opacity',(1-smooth(dissolve/.38)).toFixed(3));
        item.card.style.setProperty('--ae-particle-opacity',(smooth(dissolve/.24)*(1-smooth((dissolve-.72)/.28))).toFixed(3));
        item.card.dataset.aeDissolve=dissolve.toFixed(3);
      }catch{reset(item);}
    }
  }
  const sizes=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{for(const entry of entries){const item=[...items.values()].find(i=>i.title===entry.target);if(item)item.width=0;}queue();}):null;
  function enhance(workspace){
    for(const item of items.values())if(!item.card.isConnected)remove(item);
    workspace.querySelectorAll('.ae-course-card').forEach((card,index)=>{
      if(items.has(card))return;const title=card.querySelector('.ae-card-name');if(!title)return;
      const ink=document.createElement('span');ink.className='ae-course-title-ink';ink.append(...title.childNodes);title.append(ink);
      const item={card,title,ink,index,width:0,height:0,canvas:null};items.set(card,item);sizes?.observe(title);
    });queue();
  }
  const state=new MutationObserver(()=>{if(!engine.moving())for(const item of items.values())reset(item);queue();});
  state.observe(host,{attributes:true,attributeFilter:['class']});
  document.addEventListener('scroll',queue,{capture:true,passive:true});
  document.addEventListener('focusin',queue);document.addEventListener('focusout',queue);
  document.addEventListener('visibilitychange',queue);window.addEventListener('resize',invalidate,{passive:true});
  document.fonts?.ready.then(invalidate);document.fonts?.addEventListener('loadingdone',invalidate);
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;disposed=true;engine.cancel(frame);state.disconnect();sizes?.disconnect();
    document.removeEventListener('scroll',queue,true);document.removeEventListener('focusin',queue);document.removeEventListener('focusout',queue);document.removeEventListener('visibilitychange',queue);window.removeEventListener('resize',invalidate);document.fonts?.removeEventListener('loadingdone',invalidate);
    for(const item of items.values())remove(item);
  });
  globalThis.AetherCourseFade={enhance};
})();
