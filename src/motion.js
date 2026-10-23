/* One document-local ticker. No scrolling overrides or native control handlers. */
(() => {
  'use strict';
  if (globalThis.AetherMotion) return;
  let host;
  try { if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;host=top.document.documentElement; } catch { return; }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
  const subscribers=new Map();let nextId=0,raf=0,disposed=false;
  const moving=()=>host.classList.contains('aether-enabled')&&!host.classList.contains('aether-reduced-motion')&&!reduced.matches;
  function tick(now){
    raf=0;if(disposed||document.hidden)return;
    for(const [id,item] of [...subscribers]){
      if(!subscribers.has(id)||now-item.last<item.interval)continue;
      const dt=item.last?Math.min(64,now-item.last):16;item.last=now;
      try{item.fn(now,dt);}catch{ subscribers.delete(id); }
    }
    wake();
  }
  function wake(){if(!disposed&&!raf&&!document.hidden&&subscribers.size)raf=window.requestAnimationFrame(tick);}
  function subscribe(fn,interval=0){const id=++nextId;subscribers.set(id,{fn,interval,last:0});wake();return ()=>subscribers.delete(id);}
  function request(fn){let stop;const id=++nextId;stop=()=>subscribers.delete(id);subscribers.set(id,{last:0,interval:0,fn:t=>{stop();fn(t);}});wake();return id;}
  function cancel(id){subscribers.delete(id);if(!subscribers.size){window.cancelAnimationFrame(raf);raf=0;}}
  function spring(value=0,tension=170,friction=24){return {value,velocity:0,target:value,step(ms){for(let n=0;n<Math.min(64,Math.max(0,ms));n++){this.velocity+=(tension*(this.target-this.value)-friction*this.velocity)*.001;this.value+=this.velocity*.001;}if(Math.abs(this.velocity)<.01&&Math.abs(this.target-this.value)<.01){this.value=this.target;this.velocity=0;}return this.value;},get resting(){return this.value===this.target&&this.velocity===0;}};}
  const animations=new Map(),keys=['--ae-lift','--ae-rx','--ae-ry','--rx','--ry','--ae-hover-x','--ae-hover-y','--mx','--my'];
  let stopCards=null,current=null;
  function clearCard(card){for(const key of keys)card.style.removeProperty(key);if(!card.style.length)card.removeAttribute('style');}
  function settle(){if(current){const state=animations.get(current);if(state)for(const p of state.springs)p.target=0;}current=null;startCards();}
  function startCards(){if(stopCards||!animations.size)return;stopCards=subscribe((now,dt)=>{
    for(const [card,s]of animations){
      if(!card.isConnected||!moving()||coarse.matches){clearCard(card);animations.delete(card);continue;}
      const [lift,x,y]=s.springs.map(p=>p.step(dt));
      card.style.setProperty('--ae-lift',lift.toFixed(3)+'px');
      for(const key of ['--ae-rx','--rx'])card.style.setProperty(key,x.toFixed(3)+'deg');
      for(const key of ['--ae-ry','--ry'])card.style.setProperty(key,y.toFixed(3)+'deg');
      if(s.springs.every(p=>p.resting)&&card!==current){clearCard(card);animations.delete(card);}
    }
    if(!animations.size||[...animations.values()].every(s=>s.springs.every(p=>p.resting))){stopCards();stopCards=null;}
  });}
  const cardSelector='.ae-course-card,.ae-tool-item,.ae-record-card';
  function pointer(e){
    if(!moving()||coarse.matches)return;
    const card=e.target.closest?.(cardSelector);
    if(card!==current)settle();
    // Native editing and open dropdowns remain geometrically stable.
    if(!card||card.querySelector('textarea,select,[contenteditable="true"],input[type="file"],input[type="number"],.dropdown-menu.show,[aria-expanded="true"]'))return;
    current=card;
    let s=animations.get(card);if(!s){s={springs:[spring(),spring(),spring()]};animations.set(card,s);}
    const r=card.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    s.springs[0].target=-5.5;s.springs[1].target=(.5-y)*3.2;s.springs[2].target=(x-.5)*4;
    for(const key of ['--ae-hover-x','--mx'])card.style.setProperty(key,(x*100).toFixed(2)+'%');
    for(const key of ['--ae-hover-y','--my'])card.style.setProperty(key,(y*100).toFixed(2)+'%');
    startCards();
    if(window!==top)top.postMessage({type:'aether-pointer-v051',x:e.clientX/innerWidth,y:e.clientY/innerHeight},location.origin);
  }
  const reveals=new Map();
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){const el=entry.target;io.unobserve(el);if(!moving())continue;const spans=[...el.querySelectorAll('.ae-reveal-unit')];const start=performance.now();const stop=subscribe(now=>{if(!el.isConnected||!moving()){spans.forEach(n=>n.style.removeProperty('transform'));stop();reveals.delete(el);return;}let done=true;spans.forEach((n,i)=>{const p=Math.max(0,Math.min(1,(now-start-i*36)/500));n.style.transform=`translateY(${((1-p)**3*.22).toFixed(4)}em)`;if(p<1)done=false;});if(done){spans.forEach(n=>n.style.removeProperty('transform'));stop();reveals.delete(el);}});reveals.set(el,stop);}
  },{threshold:.15}):null;
  function enhance(workspace){for(const heading of workspace.querySelectorAll('.ae-hero-home .ae-hero-heading,.ae-radar-heading')){
    if(heading.dataset.aeReveal)return;heading.dataset.aeReveal='true';
    // Keep all authored text visible even if an observer or animation fails.
    heading.setAttribute('aria-label',heading.textContent);
    for(const node of [...heading.childNodes]){
      if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){const f=document.createDocumentFragment();for(const word of node.textContent.split(/(\s+)/)){if(!word.trim()){f.append(document.createTextNode(word));continue;}const span=document.createElement('span');span.className='ae-reveal-unit';span.textContent=word;span.setAttribute('aria-hidden','true');f.append(span);}node.replaceWith(f);}
      else if(node.nodeType===Node.ELEMENT_NODE)node.setAttribute('aria-hidden','true');
    }
    io?.observe(heading);
  }}
  function settings(){if(!moving()){for(const card of animations.keys())clearCard(card);animations.clear();current=null;if(stopCards){stopCards();stopCards=null;}}for(const [el,stop]of reveals)if(!el.isConnected||!moving()){stop();reveals.delete(el);el.querySelectorAll('.ae-reveal-unit').forEach(n=>n.style.removeProperty('transform'));}}
  function visibility(){if(document.hidden){window.cancelAnimationFrame(raf);raf=0;for(const item of subscribers.values())item.last=0;}else wake();}
  const stateObserver=new MutationObserver(settings);stateObserver.observe(host,{attributes:true,attributeFilter:['class']});
  document.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('pointerleave',settle,{passive:true});document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',settings);
  window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;window.cancelAnimationFrame(raf);subscribers.clear();stateObserver.disconnect();io?.disconnect();settings();document.removeEventListener('pointermove',pointer);document.removeEventListener('pointerleave',settle);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',settings);},{once:false});
  globalThis.AetherMotion={subscribe,request,cancel,spring,moving,enhance};
})();
