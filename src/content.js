/* Aether Living Interface v0.8 for the LUMS Sakai portal.
   Native navigation, native forms, native assignments. Original decorative UI only.
   Resource previews are separately handled by the read-only preview controller. */
(() => {
  "use strict";
  if (window.top !== window || location.hostname !== "lms.lums.edu.pk") return;
  if (!/^\/+(?:portal(?:\/|$)|$)/.test(location.pathname)) return;
  const doc = document.documentElement;
  if (doc.dataset.aetherV08 === "installed") return;
  doc.dataset.aetherV08 = "installed";

  const K = { enabled:"aether:v02:enabled", motion:"aether:v02:motion", orders:"aether:v02:orders", cache:"aether:v08:orders-cache" };
  let enabled=doc.classList.contains("aether-enabled");
  let motion=true, motionRequested=true, editMode=false, orders={}, scene=null, ambientScene=null, workspace=null, toolbar=null, ambientRoot=null;
  let renderedSignature="", refreshPending=false, refreshForced=false, heroSignature="", effectCanvas=null, effectFrame=0, effectPreview=null;
  const TEXT={arrow:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.5 8L22.5 12l-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5L12 1.5Z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>',
    drag:'<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="3.5" r="1"/><circle cx="11" cy="3.5" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="12.5" r="1"/><circle cx="11" cy="12.5" r="1"/></g></svg>'};

  function label(v){return String(v||"").replace(/\s+/g," ").trim();}
  function make(tag,klass,value){const n=document.createElement(tag);if(klass)n.className=klass;if(value!==undefined)n.textContent=value;return n;}
  function btn(klass,name,fn){const n=make("button",klass,name);n.type="button";n.addEventListener("click",fn);return n;}
  function link(klass,name,url){const n=make("a",klass,name);n.href=url;return n;}
  function safeUrl(url){try{if(!url||url.startsWith("#"))return null;const u=new URL(url,location.href);return u.protocol==="https:"&&u.origin===location.origin?u.href:null;}catch{return null;}}
  function fingerprint(value){let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function shorten(full){let s=label(full).replace(/^\d{4}\s+(?:SSE|SHSS|SDSB|SBS|MGSHSS)\s+/i,"").replace(/\s*\([^)]*\)\s*$/,"");return s||full;}
  function courseCode(t){const m=t.match(/\b(?:CS|SS|MATH|ECON|BIO|PHY|CHEM|EE|ME|MGMT|HIST|PSY|PHIL)\s*\d{3,4}\b/i);return m?m[0].toUpperCase():"COURSE";}
  function sites(){return [...document.querySelectorAll("#toolMenu li.site-list-item")].map(item=>{
    const a=item.querySelector("a.sidebar-site-title, .site-link-block a[href]");
    const title=label(a?.textContent);const href=safeUrl(a?.getAttribute("href"));
    const pinned=item.dataset.type?item.dataset.type==='pinned':Boolean(item.closest('#pinned-site-list')||item.querySelector('.site-opt-pin[data-pinned="true"]'));
    return {title,href,id:href?fingerprint(new URL(href).pathname):"",active:item.classList.contains("is-current-site"),home:/^home$/i.test(title),pinned};
  }).filter(s=>s.href&&s.title);}
  function iconFor(anchor){
    const selector='.site-page-icon,.tool-icon,[class*="icon-"],.bi,.fa,.si,[class*="fa-"]';
    const candidates=[...anchor.querySelectorAll(selector)];
    const nativeGlyph=candidates.find(n=>{const c=getComputedStyle(n,'::before').content;return c&&c!=='none'&&c!=='normal'&&c.length>2;});
    const el=anchor.querySelector('svg,img')||nativeGlyph||candidates[0]||anchor.closest('li')?.querySelector('svg,img,'+selector);
    if(!el)return null;
    const clone=el.cloneNode(true),ids=new Map();
    clone.querySelectorAll('script,foreignObject,iframe,object,embed,style,animate,animateTransform,set,a').forEach(n=>n.remove());
    const nodes=[clone,...clone.querySelectorAll('*')];
    for(const n of nodes){
      if(n.id){const id='ae-tool-'+fingerprint(anchor.href+n.id);ids.set(n.id,id);n.id=id;}
      for(const a of [...n.attributes]){
        if(/^on/i.test(a.name)||['tabindex','name','autofocus','aria-label','title','srcset','style'].includes(a.name))n.removeAttribute(a.name);
        if(/^(?:href|xlink:href|src)$/i.test(a.name)&&!a.value.startsWith('#')){
          const value=safeUrl(a.value);if(n.tagName.toLowerCase()==='img'&&value)n.setAttribute(a.name,value);else n.removeAttribute(a.name);
        }
        if(/url\(/i.test(a.value)&&!/^url\(\s*#[\w-]+\s*\)$/.test(a.value))n.removeAttribute(a.name);
      }
    }
    for(const n of nodes)for(const a of [...n.attributes])for(const [old,id]of ids){if(a.value==='#'+old)n.setAttribute(a.name,'#'+id);else if(a.value.includes('url(#'+old+')'))n.setAttribute(a.name,a.value.replaceAll('url(#'+old+')','url(#'+id+')'));}
    clone.setAttribute('aria-hidden','true');clone.setAttribute('focusable','false');
    // Font icons often depend on sidebar ancestor selectors. Copy the rendered
    // glyph and its actual icon font instead of substituting a guessed icon.
    if(!['svg','img'].includes(el.tagName.toLowerCase())){
      const before=getComputedStyle(el,'::before'),glyph=before.content;
      if(glyph&&glyph!=='none'&&glyph!=='normal'&&glyph.length>2){
        const span=make('span','ae-native-tool-glyph',glyph.slice(1,-1));
        span.style.fontFamily=before.fontFamily;span.style.fontWeight=before.fontWeight;span.style.fontStyle=before.fontStyle;span.setAttribute('aria-hidden','true');return span;
      }
    }
    if(!['svg','img'].includes(el.tagName.toLowerCase())){
      const computed=getComputedStyle(el),urls=[...computed.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)];if(urls.length&&urls.every(m=>safeUrl(m[1]))){
        clone.style.backgroundImage=computed.backgroundImage;clone.style.backgroundPosition=computed.backgroundPosition;clone.style.backgroundSize=computed.backgroundSize;clone.style.backgroundRepeat=computed.backgroundRepeat;
      }
    }
    return clone;
  }
  function tools(){const active=document.querySelector('#toolMenu .site-list-item.is-current-site');if(!active)return[];
    const seen=new Set();return [...active.querySelectorAll('.site-page-list a[href]')].map(a=>{
      const textNode=a.cloneNode(true);textNode.querySelectorAll('svg,img,.site-page-icon,.tool-icon,.bi,.fa,.si,.sr-only,.visually-hidden,[aria-hidden="true"]').forEach(n=>n.remove());
      return {text:label(textNode.textContent||a.getAttribute('title')),href:safeUrl(a.getAttribute('href')),icon:iconFor(a)};
    }).filter(x=>{if(!x.href||!x.text||seen.has(x.href))return false;seen.add(x.href);x.id=fingerprint(new URL(x.href).pathname);return true;});
  }
  function pageTitle(){
    // Portal routes are opaque identifiers: detect from Sakai's visible tool breadcrumb.
    const titles=[...document.querySelectorAll(".portal-header .header-tool-title, main#content .header-tool-title")];
    const visible=titles.find(el=>el.getClientRects().length>0);
    return label((visible||titles[0])?.textContent);
  }
  function context(){const main=document.querySelector("main#content.portal-main-content");if(!main)return null;
    // The public gateway keeps Sakai's original sign-in form and welcome content.
    if(document.body?.classList.contains('is-logged-out')||document.querySelector('.portal-header input[type="password"],#loginForm input[type="password"]'))return null;
    const collection=sites(),active=collection.find(s=>s.active), isHome=active?.home||(!active&&!!main.querySelector(".Mrphs-sakai-summary-calendar"));
    const title=pageTitle();
    const assignment=/^assignments?$/i.test(title)||!!main.querySelector(".Mrphs-sakai-assignment-grades"),menu=tools();
    const resources=!!main.querySelector(".Mrphs-sakai-resources,.Mrphs-sakai-resources-tool") || /^resources$/i.test(title);
    const courseCodeText=active&&!active.home?courseCode(active.title):"";
    const activity=[...main.querySelectorAll('.Mrphs-sakai-summary-calendar a,.Mrphs-sakai-summary-assignment a,.Mrphs-sakai-synoptic-announcement a,.announcement-item a')].filter(a=>!a.closest('#aether-workspace')).map(a=>a.href+a.textContent).join('|');
    return {main,sites:collection,active,home:Boolean(isHome),assignment,resources,toolTitle:title,courseCode:courseCodeText,menu,courseTitle:active&&!active.home?active.title:"",signature:[location.pathname,active?.href||"",isHome,assignment,resources,title,activity,collection.map(x=>x.id+x.title+x.active+x.pinned).join(","),menu.map(x=>x.id+x.text+(x.icon?.outerHTML||"")).join(",")].join("|")};}
  function pinnedCourses(ctx){return [...new Map(ctx.sites.filter(s=>!s.home&&s.pinned).map(s=>[s.href,s])).values()];}
  function sorted(data,type){const rank=orders[type]||[];return [...data].sort((a,b)=>{
    const ai=rank.indexOf(a.id),bi=rank.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi);
  });}
  function storeOrder(type,items){orders[type]=items.map(x=>x.dataset.key);try{localStorage.setItem(K.cache,JSON.stringify(orders));chrome.storage.local.set({[K.orders]:orders});}catch{ /* transient */ }}
  function readSettings(){try{const cached=JSON.parse(localStorage.getItem(K.cache)||"{}");if(cached&&typeof cached==="object"&&!Array.isArray(cached))orders=cached;}catch{};
    try{motionRequested=localStorage.getItem(K.motion)!=="false";motion=motionRequested;}catch{};
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)motion=false;
    try{chrome.storage.local.get([K.orders],value=>{
      if(chrome.runtime?.lastError)return;
      if(value&&value[K.orders]&&typeof value[K.orders]==="object"&&!Array.isArray(value[K.orders])){
        const next=value[K.orders];try{localStorage.setItem(K.cache,JSON.stringify(next));}catch{}
        if(JSON.stringify(next)!==JSON.stringify(orders)){orders=next;requestRefresh(true);}
      }
    });}catch{/* offline context */}}
  function setEnabled(v){enabled=Boolean(v);doc.classList.toggle("aether-enabled",enabled);toolbar?.setAttribute("aria-pressed",String(enabled));
    const t=toolbar?.querySelector(".ae-toggle-word");if(t)t.textContent=enabled?"ON":"OFF";
    if(scene)scene.setMotion(enabled&&motion);
    if(ambientScene)ambientScene.setMotion(enabled&&motion);
    if(enabled){mountAmbient();scheduleEffects(effectCanvas);}else{cancelEffectsStart();disposeAmbient();}
    doc.classList.toggle("ae-page-resources",enabled&&Boolean(context()?.resources));
    try{localStorage.setItem(K.enabled,String(enabled));}catch{}
    window.dispatchEvent(new Event("aether-settings-change"));
  }
  function setMotion(v,persist=true){if(persist)motionRequested=Boolean(v);motion=motionRequested&&!matchMedia('(prefers-reduced-motion: reduce)').matches;doc.classList.toggle("aether-reduced-motion",!motion);if(scene)scene.setMotion(enabled&&motion);if(ambientScene)ambientScene.setMotion(enabled&&motion);
    const toggle=workspace?.querySelector(".ae-motion-btn");if(toggle){toggle.textContent=motion?"MOTION · ON":"MOTION · OFF";toggle.setAttribute("aria-pressed",String(motion));}
    if(persist)try{localStorage.setItem(K.motion,String(motionRequested));}catch{}
    window.dispatchEvent(new Event("aether-settings-change"));
  }
  function mountToolbar(){const header=document.querySelector(".portal-header");if(!header)return;
    let native=header.querySelector("#aether-native-toggle");
    if(!native){native=btn("ae-native-toggle","",()=>setEnabled(!enabled));native.id="aether-native-toggle";
      const glyph=make("span","ae-toggle-glyph");glyph.innerHTML=TEXT.star;
      const name=make("span","ae-toggle-brand","AETHER");const state=make("span","ae-toggle-word",enabled?"ON":"OFF");native.append(glyph,name,state);
      native.setAttribute("aria-label","Toggle Aether interface; return to original Sakai anytime");header.append(native);
    }toolbar=native;toolbar.setAttribute("aria-pressed",String(enabled));}
  function createFlare(parent,x,y,index){const n=make("span","ae-sparkle");n.style.left=x+"%";n.style.top=y+"%";n.style.setProperty("--n",String(index));parent.append(n);return n;}
  function makeHero(ctx){
    // Keep the general campus slogan on Home only. Course pages use the real
    // Sakai course title and the current tool context, never a canned slogan.
    const course=!ctx.home;
    const hero=make("section",ctx.home?"ae-hero ae-hero-home":`ae-hero ae-hero-course${ctx.resources?" ae-hero-resources":""}`);
    hero.setAttribute("aria-label",ctx.home?"Academic workspace":"Course: "+(ctx.courseTitle||"Current course"));
    const canvas=make("canvas","ae-living-canvas");canvas.dataset.aeSceneTarget='true';canvas.setAttribute("aria-hidden","true");hero.append(canvas);
    const layer=make("div","ae-light-layer");layer.setAttribute("aria-hidden","true");hero.append(layer);
    const flares=[[62,23],[78,18],[88,37],[69,77],[93,66],[57,57],[84,85]];
    const sparks=flares.map((p,i)=>createFlare(layer,p[0],p[1],i));
    hero.addEventListener("pointermove",e=>{
      const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/Math.max(1,r.width),y=(e.clientY-r.top)/Math.max(1,r.height);
      hero.style.setProperty("--px",(x*100).toFixed(1)+"%");hero.style.setProperty("--py",(y*100).toFixed(1)+"%");
      for(let i=0;i<sparks.length;i++){
        const q=flares[i],dist=Math.hypot(q[0]/100-x,q[1]/100-y);
        sparks[i].style.setProperty("--lit",String(Math.max(.18,1.7-Math.max(0,dist-.04)*5)));
        sparks[i].style.setProperty("--zoom",String(1+Math.max(0,.26-dist)*8));
      }
    },{passive:true});
    hero.addEventListener("pointerleave",()=>sparks.forEach(s=>{s.style.removeProperty("--lit");s.style.removeProperty("--zoom");}));
    const copy=make("div","ae-hero-copy");
    if(ctx.home)copy.append(make('div','ae-hero-brand','AETHER / 1.3'));
    const eyebrow=make("div","ae-hero-eyebrow");eyebrow.append(make("span","ae-status-dot"),document.createTextNode(course?`LUMS / ${ctx.courseCode||"COURSE"} / ${(ctx.toolTitle||"OVERVIEW").toUpperCase()}`:`LUMS / ACADEMIC WORKSPACE / ${new Date().getFullYear()}`));copy.append(eyebrow);
    const h1=make("h1","ae-hero-heading");
    if(ctx.home){h1.append(document.createTextNode("A little space "),make("em","","for big ideas."));}
    else{
      const name=shorten(ctx.courseTitle||"Your course");
      const words=name.split(/\s+/);const highlight=words.pop()||name;
      if(words.length)h1.append(document.createTextNode(words.join(" ")+" "));
      h1.append(make("em","",highlight));
    }
    copy.append(h1);
    copy.append(make("p","ae-hero-intro",ctx.home?"Your courses. Your next question. Room to connect the dots.":ctx.resources?"Readings, lecture notes, and shared files. Pick up where you left off.":ctx.assignment?"Coursework, submission status, and original deadlines.":`${ctx.toolTitle||"Course overview"} · Your ${shorten(ctx.courseTitle||"course")} workspace.`));
    const actions=make("div","ae-hero-actions");
    const target=ctx.home?"#aether-course-dock":ctx.resources?".Mrphs-sakai-resources,.Mrphs-sakai-resources-tool":"#aether-tool-dock";
    const cta=btn("ae-hero-cta",ctx.home?"EXPLORE COURSES":ctx.resources?"VIEW RESOURCES":"COURSE TOOLS",()=>{
      let node=document.querySelector(target);
      if(!node&&ctx.resources)node=[...ctx.main.children].find(el=>el!==workspace&&el.classList.contains("Mrphs-container"));
      node?.scrollIntoView({behavior:motion?"smooth":"auto",block:"start"});
    });cta.insertAdjacentHTML("beforeend",TEXT.arrow);actions.append(cta);
    const pause=btn("ae-motion-btn","",()=>setMotion(!motionRequested));actions.append(pause);copy.append(actions);
    if(ctx.home)copy.append(make("div","ae-hero-micro","BUILT FOR THE WORK THAT MATTERS."));
    hero.append(copy);
    if(ctx.home){const plate=make('div','ae-instrument');plate.setAttribute('aria-hidden','true');plate.append(make('span','ae-instrument-number',String(pinnedCourses(ctx).length).padStart(2,'0')),make('span','','PINNED COURSES'),make('span','ae-instrument-mark','↗'));hero.append(plate);const caption=make('div','ae-sculpture-caption','FIG. 01 / FOLDED FIELD · PROCEDURAL');caption.setAttribute('aria-hidden','true');hero.append(caption);}
    return {hero,canvas};
  }
  function moveItem(section,item,step,type){const cards=[...section.querySelectorAll("[data-order-item]")];const index=cards.indexOf(item),target=cards[index+step];
    if(!target)return;
    if(step<0)section.insertBefore(item,target);else section.insertBefore(target,item);
    storeOrder(type,[...section.querySelectorAll("[data-order-item]")]);
    item.querySelector(".ae-move-down,.ae-move-up")?.focus({preventScroll:true});
    const status=document.querySelector("#aether-reorder-status");if(status)status.textContent="Shortcuts reordered, saved locally.";
  }
  function orderButtons(item,parent,type){const bar=make("span","ae-order-controls");
    const prev=btn("ae-move-up","↑",e=>{e.stopPropagation();moveItem(parent,item,-1,type);});
    prev.setAttribute("aria-label","Move shortcut earlier");
    const next=btn("ae-move-down","↓",e=>{e.stopPropagation();moveItem(parent,item,1,type);});
    next.setAttribute("aria-label","Move shortcut later");bar.append(prev,next);item.append(bar);
    item.draggable=editMode;
    item.addEventListener("dragstart",e=>{if(!editMode){e.preventDefault();return;}e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",item.dataset.key);item.classList.add("ae-dragging");});
    item.addEventListener("dragend",()=>item.classList.remove("ae-dragging"));
    item.addEventListener("dragover",e=>{if(!editMode)return;e.preventDefault();e.dataTransfer.dropEffect="move";});
    item.addEventListener("drop",e=>{if(!editMode)return;e.preventDefault();const key=e.dataTransfer.getData("text/plain");const source=[...parent.querySelectorAll("[data-order-item]")].find(n=>n.dataset.key===key);if(!source||source===item)return;
      const rect=item.getBoundingClientRect();parent.insertBefore(source,e.clientX<rect.left+rect.width/2?item:item.nextSibling);storeOrder(type,[...parent.querySelectorAll("[data-order-item]")]);
    });
  }
  // Card physics are delegated once by motion.js, including dynamically added rows.
  function liftCard(){}
  function appendHead(section,subtitle,title,note){const row=make("div","ae-section-head");const left=make("div","");left.append(make("div","ae-overline",subtitle),make("h2","ae-section-title",title));row.append(left);
    const right=make("div","ae-head-right");right.append(make("span","ae-section-meta",note));
    const edit=btn("ae-customize",editMode?"DONE":"REORDER ↕",()=>{editMode=!editMode;requestRefresh(true);});edit.setAttribute("aria-pressed",String(editMode));right.append(edit);row.append(right);section.append(row);}
  function makeCourses(ctx){if(!ctx.home)return null;const courses=sorted(pinnedCourses(ctx),"courses");
    const section=make("section","ae-section ae-courses");section.id="aether-course-dock";section.setAttribute("aria-label","Your pinned course shortcuts");appendHead(section,"01  /  YOUR WORKSPACE","Your courses",`${courses.length} PINNED`);
    if(!courses.length){section.querySelector('.ae-customize').disabled=true;section.append(make('p','ae-courses-empty','Pin courses in the Sakai sidebar to add shortcuts here.'));return section;}
    const deck=make("div","ae-course-deck");deck.dataset.edit=editMode?"true":"false";
    courses.forEach((s,i)=>{
      const card=make("article","ae-course-card");card.dataset.orderItem="1";card.dataset.key=s.id;
      const a=link("ae-course-link","",s.href);a.setAttribute("aria-label","Open "+s.title+" in the original Sakai portal");
      const top=make("div","ae-card-top");top.append(make("span","ae-card-index",String(i+1).padStart(2,"0")),make("span","ae-card-code",courseCode(s.title)));
      const mid=make("div","ae-card-name",shorten(s.title));
      const bot=make("div","ae-card-bottom");bot.append(make("span","","OPEN COURSE"));const ar=make("span","ae-card-arrow");ar.innerHTML=TEXT.arrow;bot.append(ar);
      a.append(top,mid,bot);card.append(a);orderButtons(card,deck,"courses");liftCard(card);deck.append(card);
    });section.append(deck);return section;}
  function makeTools(ctx){if(ctx.home||!ctx.menu.length)return null;
    const tools=sorted(ctx.menu,"tools");const section=make("section","ae-section ae-tools");section.id="aether-tool-dock";
    appendHead(section,"Quick access","Course tools",`${tools.length} tools`);
    const list=make("div","ae-tool-row");list.dataset.edit=editMode?"true":"false";
    for(const t of tools){const item=make("div","ae-tool-item");item.dataset.orderItem="1";item.dataset.key=t.id;
      const a=link("ae-tool-link","",t.href);if(t.icon){const icon=make("span","ae-tool-icon");icon.append(t.icon);a.append(icon);}a.append(make("span","ae-tool-name",t.text));item.append(a);orderButtons(item,list,"tools");list.append(item);}
    section.append(list);return section;}

  function mountAmbient(){
    if(!enabled || !document.body || ambientRoot?.isConnected)return;
    ambientRoot=make("div","ae-global-ambient");
    ambientRoot.id="aether-global-ambient";
    ambientRoot.setAttribute("aria-hidden","true");
    const canvas=make("canvas","ae-global-canvas");ambientRoot.append(canvas);
    document.body.append(ambientRoot);
    try{ambientScene=globalThis.AetherAmbient?.create(canvas,{motion:motion});}
    catch(error){ambientRoot.remove();ambientRoot=null;console.debug("Aether ambient unavailable",error);}
  }
  function disposeAmbient(){ambientScene?.dispose();ambientScene=null;ambientRoot?.remove();ambientRoot=null;}
  function cancelEffectsStart(){cancelAnimationFrame(effectFrame);effectFrame=0;effectPreview?.dispose();effectPreview=null;}
  function scheduleEffects(canvas){
    if(canvas)effectCanvas=canvas;
    if(!enabled||!effectCanvas?.isConnected)return;
    // Stars draw during parsing, independently of tool frames and page readiness.
    mountAmbient();
    if(scene||effectFrame)return;
    const pendingCanvas=effectCanvas;
    // Paint the same procedural field cheaply before compiling any GPU shaders.
    if(!effectPreview)try{effectPreview=globalThis.AetherLivingScene?.prime(pendingCanvas)||null;}catch{/* decoration fails open */}
    // Two frames allow the first composition to reach the screen before GPU work.
    effectFrame=requestAnimationFrame(()=>{effectFrame=requestAnimationFrame(()=>{
      effectFrame=0;if(!enabled||effectCanvas!==pendingCanvas||!pendingCanvas.isConnected)return;
      try{
        scene=globalThis.AetherLivingScene?.create(pendingCanvas,{motion:enabled&&motion})||null;
        if(pendingCanvas.dataset.aeRendered||pendingCanvas.nextElementSibling?.matches('canvas[data-ae-rendered]')){effectPreview?.dispose();effectPreview=null;}
      }catch(error){console.debug('Aether scene unavailable',error);}
    });});
  }
  function render(force=false){mountToolbar();const ctx=context();if(!ctx){if(enabled)mountAmbient();return;}
    if(!force&&ctx.signature===renderedSignature&&workspace?.isConnected)return;
    const key=[ctx.home,ctx.courseTitle,ctx.toolTitle,ctx.resources,ctx.assignment].join('|');
    const count=workspace?.querySelector('.ae-instrument-number');if(count)count.textContent=String(pinnedCourses(ctx).length).padStart(2,'0');
    const oldHero=key===heroSignature?workspace?.querySelector('.ae-hero'):null;
    if(!oldHero){cancelEffectsStart();scene?.dispose();scene=null;}
    workspace?.remove();renderedSignature=ctx.signature;heroSignature=key;
    workspace=make('div','ae-workspace');workspace.id='aether-workspace';workspace.classList.toggle('ae-reordering',editMode);
    doc.classList.toggle('ae-page-resources',enabled&&ctx.resources);
    if(!enabled)disposeAmbient();
    const {hero,canvas}=oldHero?{hero:oldHero,canvas:oldHero.querySelector('canvas[data-ae-scene-target]')}:makeHero(ctx);workspace.append(hero);
    const courses=makeCourses(ctx);if(courses)workspace.append(courses);
    const radar=globalThis.AetherDashboard?.create(ctx);if(radar)workspace.append(radar);
    const tools=makeTools(ctx);if(tools)workspace.append(tools);
    const status=make('div','ae-screen-reader-only');status.id='aether-reorder-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');workspace.append(status);
    ctx.main.prepend(workspace);globalThis.AetherMotion?.enhance(workspace);globalThis.AetherCourseFade?.enhance(workspace);doc.classList.toggle('aether-enabled',enabled);setMotion(motionRequested,false);scheduleEffects(canvas);
  }
  function requestRefresh(force=false){refreshForced ||= force;if(refreshPending)return;refreshPending=true;
    queueMicrotask(()=>{refreshPending=false;const forced=refreshForced;refreshForced=false;render(forced);});
  }
  readSettings();
  const observer=new MutationObserver(records=>{
    for(const r of records){
      const target=r.target.nodeType===1?r.target:r.target.parentElement;
      if(target?.closest('#aether-workspace,#aether-native-toggle,#aether-global-ambient,.ae-resource-preview,[data-ae-preview-control]'))continue;
      if(target?.closest('.Mrphs-sakai-summary-calendar,.Mrphs-sakai-summary-assignment,.Mrphs-sakai-synoptic-announcement,.announcement-item')){requestRefresh();return;}
      if([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&n.matches('.Mrphs-sakai-summary-calendar,.Mrphs-sakai-summary-assignment,.Mrphs-sakai-synoptic-announcement,.announcement-item'))){requestRefresh();return;}
      if(target?.closest('#toolMenu,.portal-header')||r.type==='childList'&&(target?.matches('html,body,#pageBody,.portal-main-container,main#content')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('#toolMenu,.portal-header,main#content,.Mrphs-container')||n.querySelector('main#content,#toolMenu'))))){requestRefresh();return;}
    }
  });
  observer.observe(doc,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','href','title','aria-current','data-type','data-pinned']});
  document.addEventListener('DOMContentLoaded',()=>{render();scheduleEffects(effectCanvas);},{once:true});
  window.addEventListener('pageshow',()=>requestRefresh());
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  motionPreference.addEventListener('change',()=>setMotion(motionRequested,false));
  window.addEventListener('pagehide',e=>{if(e.persisted)return;observer.disconnect();cancelEffectsStart();scene?.dispose();disposeAmbient();});
  render();
})();
