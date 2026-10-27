/* Home composition and reversible drawer around the original Sakai navigation.
   No cloned links, history interception, scroll handlers or academic requests. */
(() => {
  'use strict';
  if (window !== top || globalThis.AetherHomeLayout) return;
  const root=document.documentElement;
  let state=null;
  const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  const visible=el=>el.getClientRects().length && !el.closest('[inert],[hidden]');
  function make(tag,cls,text){const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;}
  function remember(s,el,name,value){let fields=s.saved.get(el);if(!fields){fields=new Map();s.saved.set(el,fields);}if(!fields.has(name))fields.set(name,el.getAttribute(name));if(value===null)el.removeAttribute(name);else el.setAttribute(name,value);}
  function mark(s,el,cls){if(!el.classList.contains(cls)){el.classList.add(cls);s.classes.push([el,cls]);}}
  function close(restoreFocus=true){
    const s=state;if(!s||!s.open)return;
    s.open=false;cancelAnimationFrame(s.focusJob);s.focusJob=0;root.classList.remove('ae-home-nav-open');s.toggle.setAttribute('aria-expanded','false');
    s.nav.setAttribute('aria-hidden','true');s.nav.inert=true;s.main.inert=s.mainInert;
    if(restoreFocus && s.returnFocus?.isConnected)s.returnFocus.focus({preventScroll:true});
  }
  function open(){
    const s=state;if(!s||s.open)return;
    s.returnFocus=document.activeElement;s.open=true;root.classList.add('ae-home-nav-open');
    s.nav.inert=false;s.nav.setAttribute('aria-hidden','false');s.toggle.setAttribute('aria-expanded','true');
    s.mainInert=s.main.inert;s.main.inert=true;
    // Focus after visibility/inert styles have committed; cancel this on close.
    s.focusJob=requestAnimationFrame(()=>{s.focusJob=0;if(state===s&&s.open)s.closeButton.focus({preventScroll:true});});
  }
  function dispose(){
    const s=state;if(!s)return;close(false);state=null;
    root.classList.remove('ae-spatial-home','ae-home-nav-open','ae-home-single-widget');root.style.removeProperty('--ae-home-header-height');
    s.abort.abort();s.resize?.disconnect();s.watch?.disconnect();
    for(const [el,cls]of s.classes)el.classList.remove(cls);
    for(const [el,fields]of s.saved)for(const [name,old]of fields){if(old===null)el.removeAttribute(name);else el.setAttribute(name,old);}
    for(const el of s.owned)el.remove();
  }
  function eligible(ctx,workspace,enabled){return enabled && ctx?.spatial && workspace?.isConnected && workspace.querySelector('.ae-hero-home');}
  function sync(ctx,workspace,enabled){
    if(!eligible(ctx,workspace,enabled)){dispose();return;}
    const header=document.querySelector('.portal-header'),menu=document.querySelector('#toolMenu');
    if(!header||!menu){dispose();return;} // Never hide navigation without a working replacement control.
    const nav=menu.closest('#portal-nav-sidebar,.portal-nav-sidebar')||menu;
    if(state?.nav===nav&&state.header===header&&state.workspace===workspace){decorateWidgets(state);return;}
    dispose();
    const s={nav,header,main:ctx.main,workspace,saved:new Map(),classes:[],owned:[],abort:new AbortController(),open:false,mainInert:ctx.main.inert};state=s;
    try {
      const options={signal:s.abort.signal};
      const toggle=make('button','ae-home-menu');toggle.id='aether-home-menu';toggle.type='button';
      toggle.setAttribute('aria-label','Open Home navigation');toggle.setAttribute('aria-expanded','false');
      toggle.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
      const brand=make('a','ae-home-header-brand','AETHER / 1.7');brand.href='#aether-workspace';brand.setAttribute('aria-label','Aether Home, back to top');
      header.prepend(toggle,brand);s.toggle=toggle;s.owned.push(toggle,brand);
      for(const el of header.querySelectorAll('button,a')){
        if(el===toggle||el===brand)continue;
        const label=[el.getAttribute('aria-label'),el.title].filter(Boolean).join(' ');
        if(el.matches('#toggle-sidebar,#sidebar-toggle,[aria-controls="portal-nav-sidebar"]')||/^(?:(?:toggle|open|close|show|hide)\s+)?(?:sidebar|navigation|main menu|site navigation|menu)$/i.test(label.trim()))mark(s,el,'ae-home-native-menu');
      }
      if(!nav.id)remember(s,nav,'id','aether-home-navigation');toggle.setAttribute('aria-controls',nav.id);
      remember(s,nav,'role','dialog');remember(s,nav,'aria-modal','true');remember(s,nav,'aria-label','Home navigation');
      remember(s,nav,'aria-hidden','true');remember(s,nav,'inert','');mark(s,nav,'ae-home-navigation');
      const heading=make('div','ae-home-nav-head'),label=make('div','');label.append(make('span','ae-home-nav-eyebrow','YOUR SAKAI'),make('h2','','Navigation'));
      const closeButton=make('button','ae-home-nav-close','×');closeButton.type='button';closeButton.setAttribute('aria-label','Close Home navigation');
      heading.append(label,closeButton);nav.prepend(heading);s.closeButton=closeButton;s.owned.push(heading);
      const backdrop=make('button','ae-home-nav-backdrop');backdrop.type='button';backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','Close Home navigation');document.body.append(backdrop);s.owned.push(backdrop);
      toggle.addEventListener('click',()=>s.open?close():open(),options);closeButton.addEventListener('click',()=>close(),options);backdrop.addEventListener('click',()=>close(),options);
      // Native launchers may open a dialog outside the sidebar. Release our
      // modal/focus state before their original handler runs.
      nav.addEventListener('click',event=>{
        const control=event.target.closest('a,button');if(!control)return;
        const label=(control.getAttribute('aria-label')||control.textContent||'').trim();
        if(control.matches('[aria-haspopup="dialog"],[data-toggle="modal"],[data-bs-toggle="modal"]')||/^(?:view\s+)?all\s+sites$/i.test(label))close(false);
      },{...options,capture:true});
      header.addEventListener('pointerdown',event=>{if(s.open&&!toggle.contains(event.target))close(false);},options);
      nav.addEventListener('click',event=>{
        const link=event.target.closest('a[href]');
        if(!link||link.matches('[aria-expanded],[role="button"],[data-toggle]'))return;
        queueMicrotask(()=>{if(state!==s||event.defaultPrevented)return;try{const url=new URL(link.href,location.href);if(/^https?:$/.test(url.protocol)&&!(url.pathname===location.pathname&&url.search===location.search&&url.hash))close(false);}catch{}});
      },options);
      document.addEventListener('keydown',event=>{
        if(!s.open)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
        if(event.key==='Tab'){
          const items=[...nav.querySelectorAll(focusable)].filter(visible),first=items[0],last=items.at(-1);
          if(!first)return;
          if(event.shiftKey&&(document.activeElement===first||!nav.contains(document.activeElement))){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&(document.activeElement===last||!nav.contains(document.activeElement))){event.preventDefault();first.focus();}
        }
      },{...options,capture:true});
      document.addEventListener('focusin',event=>{if(s.open&&!nav.contains(event.target))closeButton.focus({preventScroll:true});},options);
      const size=()=>{const value=Math.ceil(header.getBoundingClientRect().height)+'px';if(root.style.getPropertyValue('--ae-home-header-height')!==value)root.style.setProperty('--ae-home-header-height',value);};
      s.resize=typeof ResizeObserver==='function'?new ResizeObserver(size):null;s.resize?.observe(header);size();
      s.watch=new MutationObserver(()=>{if(!workspace.isConnected||!nav.isConnected||!header.isConnected||!root.classList.contains('aether-enabled'))dispose();else decorateWidgets(s);});
      s.watch.observe(document,{childList:true,subtree:true});s.watch.observe(root,{attributes:true,attributeFilter:['class']});
      decorateWidgets(s);
      // Commit the layout last. Any earlier initialization failure leaves Sakai visible.
      root.classList.add('ae-spatial-home');size();
    }catch(error){dispose();console.debug('Aether Home kept native navigation',error);}
  }
  function decorateWidgets(s){
    const widgets=[...s.main.children].filter(el=>el!==s.workspace&&!el.matches('script,style,link,#aether-home-native-title')&&!el.id.startsWith('aether-'));
    for(const el of widgets)mark(s,el,'ae-home-native-widget');
    root.classList.toggle('ae-home-single-widget',widgets.length===1);
    if(widgets.length&&!s.title){s.title=make('div','ae-home-native-title');s.title.id='aether-home-native-title';s.title.append(make('p','ae-overline','03 / FROM YOUR HOME'),make('h2','ae-section-title','Campus & course updates'));widgets[0].before(s.title);s.owned.push(s.title);}
  }
  window.addEventListener('pagehide',event=>{if(event.persisted)close(false);else dispose();});
  // The content controller also calls sync on route/render/enable changes.
  globalThis.AetherHomeLayout={sync,dispose};
})();
