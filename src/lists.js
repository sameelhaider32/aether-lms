/* Aether 0.7: presentation on original Sakai records; no replacement/click handlers. */
(() => {
  'use strict';
  let topDoc;
  try {
    if(top.location.hostname!=='lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;
    topDoc=top.document;
  } catch {return;}
  const root=document.documentElement,framed=window!==top;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const journal=new Map(),observers=[];
  const ownedClasses=['ae-card-table','ae-card-list','ae-record-card','ae-card-container','ae-card-heading-static','ae-card-header-row','ae-card-context-row','ae-academic-tool','ae-native-table'];
  const pointerKeys=['--ae-hover-x','--ae-hover-y','--ae-rx','--ae-ry'];
  const excluded='#aether-workspace,#aether-native-toggle,#aether-global-ambient,nav,[role="navigation"],[role="menu"],[role="menubar"],[role="tablist"],[role="tree"],.nav,.nav-tabs,.nav-pills,.breadcrumb,.pagination,.dropdown-menu,.navIntraTool,.itemAction,.act,.btn-group,.tool-toolbar,.resource-toolbar,[contenteditable="true"],.cke,.tox,.ui-datepicker';
  let live=null,timer=0,deadlineTimer=0,nextDeadline=Infinity,scanTime=0,raf=0,pending=null,lastCard=null;
  function remember(el,name){
    live?.add(el);
    let values=journal.get(el);
    if(!values){
      values=new Map();journal.set(el,values);
      // Sakai may clone an already enhanced row. Carry the original semantic
      // role through that native clone, but never keep copied Aether decoration.
      if(el.hasAttribute('data-ae-native-role')){
        try{values.set('role',JSON.parse(el.getAttribute('data-ae-native-role')));}catch{values.set('role',null);}
        values.set('data-ae-native-role',null);
      }
    }
    if(!values.has(name)){
      let old=el.getAttribute(name);
      if(name==='class')old=(old||'').split(/\s+/).filter(c=>c&&!ownedClasses.includes(c)).join(' ')||null;
      if(name.startsWith('data-ae-'))old=null;
      values.set(name,old);
      if(name==='role'){values.set('data-ae-native-role',null);el.setAttribute('data-ae-native-role',JSON.stringify(old));}
    }
  }
  function attr(el,name,value){remember(el,name);if(value===null){if(el.hasAttribute(name))el.removeAttribute(name);}else if(el.getAttribute(name)!==String(value))el.setAttribute(name,String(value));}
  function klass(el,name,active=true){remember(el,'class');if(el.classList.contains(name)!==active)el.classList.toggle(name,active);}
  function original(el,name){const values=journal.get(el);return values?.has(name)?values.get(name):el.getAttribute(name);}
  function restoreStyles(el){
    const old=journal.get(el)?.get('style'),prior=document.createElement('span');
    if(old!=null)prior.setAttribute('style',old);
    for(const key of pointerKeys){const value=prior.style.getPropertyValue(key);if(value)el.style.setProperty(key,value,prior.style.getPropertyPriority(key));else el.style.removeProperty(key);}
    if(old===null&&!el.style.length)el.removeAttribute('style');
  }
  function restore(select=()=>true){
    for(const [el,values]of journal){if(!select(el))continue;
      if(values.has('data-ae-assignment-state'))el.querySelectorAll('[data-ae-assignment-badges]').forEach(n=>n.remove());
      for(const [name,old]of values){
        if(name==='class'){
          for(const c of ownedClasses)if(!(old||'').split(/\s+/).includes(c)&&el.classList.contains(c))el.classList.remove(c);
          if(old===null&&!el.className)el.removeAttribute('class');
        }else if(name==='style')restoreStyles(el);
        else if(old===null)el.removeAttribute(name);else el.setAttribute(name,old);
      }
      journal.delete(el);
    }
  }
  const enabled=()=>topDoc.documentElement.classList.contains('aether-enabled');
  const moving=()=>enabled()&&!reduced.matches&&!topDoc.documentElement.classList.contains('aether-reduced-motion');
  const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  function toolKind(el){
    const context=el.closest('[class*="Mrphs-sakai-"]');
    const value=(context?.className||'')+' '+text(topDoc.querySelector('.portal-header .header-tool-title'));
    if(/resources|resource-tool/i.test(value))return 'resource';
    if(/assignment/i.test(value))return 'assignment';
    if(/announcement|synoptic-announcement/i.test(value))return 'announcement';
    if(/forum|discussion|conversation/i.test(value))return 'discussion';
    if(/message|mail/i.test(value))return 'message';
    if(/roster|member|participant/i.test(value))return 'person';
    if(/gradebook|grade-report/i.test(value))return 'grade';
    if(/schedule|calendar|event/i.test(value))return 'event';
    if(/samigo|test|quiz|assessment/i.test(value))return 'assessment';
    return 'record';
  }
  function eligible(el){return !el.closest(excluded)&&!el.closest('table table table');}
  function tablePlan(table){
    if(globalThis.AetherClassifier&&globalThis.AetherClassifier.classify(table,toolKind(table))!=='cards')return null;
    if(!eligible(table)||[...table.querySelectorAll('table')].some(nested=>toolKind(table)!=='resource'||!nested.closest('td[colspan],th[colspan],tfoot,.navPanel'))||table.matches('[role="presentation"],.calendar,.ui-datepicker-calendar,[data-layout="matrix"]'))return null;
    const header=table.tHead?.rows.length===1?table.tHead.rows[0]:!table.tHead?Array.from(table.rows).find(r=>r.cells.length&&Array.from(r.cells).every(c=>c.tagName==='TH'&&c.scope!=='row')):null;
    if(!header||header.cells.length<2||header.cells.length>12)return null;
    const labels=Array.from(header.cells).map(text),resource=toolKind(table)==='resource';
    const allRows=Array.from(table.tBodies).flatMap(b=>Array.from(b.rows)).filter(r=>r!==header);
    if([...header.cells].some(c=>c.colSpan!==1||c.rowSpan!==1)||allRows.some(r=>Array.from(r.cells).some(c=>c.rowSpan!==1)))return null;
    const rows=allRows.filter(r=>Array.from(r.cells).every(c=>c.colSpan===1)&&(r.cells.length===labels.length||resource&&r.querySelector('[headers~="title"],.specialLink')));
    const contextRows=allRows.filter(r=>!rows.includes(r));
    // A parser may still be filling the final record. Keep existing complete
    // records enhanced instead of reverting the entire table between chunks.
    if(document.readyState==='loading'&&contextRows.length){const last=contextRows.at(-1);if(last===allRows.at(-1)&&[...last.cells].reduce((n,c)=>n+c.colSpan,0)<labels.length)contextRows.pop();}
    // Folder paths, group headings, and native bulk controls can span columns.
    // Preserve these as full-width context bands between the individual cards.
    const knownGrade=toolKind(table)==='grade'&&table.id==='gradeSummaryTable';
    if(!rows.length||contextRows.some(r=>!(knownGrade&&r.matches('.gb-summary-category-row'))&&!(resource&&[...r.cells].some(c=>c.colSpan>1))&&Array.from(r.cells).reduce((n,c)=>n+c.colSpan,0)!==labels.length))return null;
    // Data-entry matrices and rich-text content keep native geometry.
    if(table.querySelector('textarea,[contenteditable="true"],input[type="password"],input[type="file"]'))return null;
    const nativeTitle=resource?[...header.cells].findIndex(c=>/^(title|name|resource-title)$/i.test(c.id)):-1;
    const primary=knownGrade?0:nativeTitle>=0?nativeTitle:labels.findIndex(s=>/^(?:assignment(?: title)?|gradebook item|title|subject|topic|(?:display\s*|full\s*)?name|student(?: name)?|member|participant|event|assessment|test|quiz|item(?: name)?|file|description)\b/i.test(s));
    if(primary<0)return null;
    let type=toolKind(table);
    const linked=rows.some(r=>r.cells[primary]?.querySelector('a[href]'));
    const schema=(type==='resource'&&/title|file|name/i.test(labels[primary])&&labels.some(l=>/modified|access|size/i.test(l)))||
      (type==='assignment'&&labels.some(l=>/status|due/i.test(l)))||
      ['person','grade','announcement','discussion','message','event','assessment'].includes(type);
    if(!linked&&!schema)return null;
    if(type==='record'&&/student|member|participant/i.test(labels[primary]))type='person';
    return {group:table,type,rows,contextRows,header,labels,primary};
  }
  function listPlan(group){
    if(globalThis.AetherClassifier&&globalThis.AetherClassifier.classify(group,toolKind(group))!=='cards')return null;
    if(!eligible(group)||group.closest('table')||group.matches('.inline,.list-inline,[role="tree"],.nav,.dropdown-menu'))return null;
    const children=Array.from(group.children);
    const rows=children.filter(el=>el.matches('li,[role="listitem"],.list-group-item,.announcement-item,.discussion-item,.message-item,.resource-item,.assignment-item,.collection-item,.roster-member-card'));
    if(!rows.length||rows.some(el=>!eligible(el))||rows.some(el=>el.querySelector('input[type="radio"],input[type="password"],textarea,[contenteditable="true"]')))return null;
    // An explicit navigation/control role is not a content list.
    if(group.hasAttribute('role')&&!['list','group'].includes(group.getAttribute('role')))return null;
    return {group,type:toolKind(group),rows};
  }
  function labelType(row,type,primary){
    const names={assignment:'ASSIGNMENT',announcement:'ANNOUNCEMENT',discussion:'DISCUSSION',message:'MESSAGE',person:'MEMBER',grade:'GRADE',event:'EVENT',assessment:'ASSESSMENT',record:'NOTE'};
    if(type!=='resource')return names[type]||'ITEM';
    const resource=globalThis.AetherResourceInfo?.describe(row,primary||row);if(resource)return resource.type||'RESOURCE';
    const a=primary?.querySelector('a[href]');
    const href=a?.getAttribute('href')||'';
    if(row.querySelector('.fa-folder,.bi-folder,[class*="collectionIcon"],[class*="folderIcon"]')||row.matches('.collection,.folder'))return 'FOLDER';
    try {const path=new URL(href,location.href).pathname;const ext=path.match(/\.([a-z0-9]{1,7})$/i)?.[1]?.toUpperCase();if(ext)return ext;if(path.endsWith('/'))return 'FOLDER';}catch{}
    return a?'RESOURCE':'FILE';
  }
  function markCard(row,type,index){
    klass(row,'ae-record-card');attr(row,'data-ae-kind',type);attr(row,'data-ae-index',String(index+1).padStart(2,'0'));
  }
  function assignment(row,labels){
    const status=labels?row.cells[labels.findIndex(s=>/^(?:submission\s+)?status$/i.test(s))]:row.matches('[data-submission-status]')?row:row.querySelector('[data-submission-status],.submissionStatus,.submission-status');
    const due=labels?row.cells[labels.findIndex(s=>/^due(?:\s+(?:date|time|on))?$/i.test(s))]:row.matches('[data-due-date]')?row:row.querySelector('[data-due-date],.dueDate,.due-date');
    const column=pattern=>labels?row.cells[labels.findIndex(s=>pattern.test(s))]:null;
    const machine=(name,fallback)=>row.getAttribute(name)||row.querySelector('['+name+']')?.getAttribute(name)||globalThis.AetherAssignmentState.dateValue(fallback);
    const info=globalThis.AetherAssignmentState.read(status,due,scanTime,{
      openAt:machine('data-open-date',column(/^open(?:\s+date)?$/i)),
      submittedAt:machine('data-submitted-at',column(/^(?:submitted|submission)(?:\s+(?:date|time))$/i)),
      acceptUntil:machine('data-accept-until',column(/^(?:accept until|close date)$/i)),
      grade:row.getAttribute('data-grade')||row.querySelector('[data-grade]')?.getAttribute('data-grade')||text(column(/^grade(?:\s+received)?$/i)||row.querySelector('.assignment-grade')),
      feedback:row.getAttribute('data-feedback-status')||row.querySelector('[data-feedback-status]')?.getAttribute('data-feedback-status')||text(column(/^feedback$/i))
    });
    attr(row,'data-ae-assignment-state',info.state);attr(row,'data-ae-state-label',info.label);
    nextDeadline=Math.min(nextDeadline,info.nextChange);
    const parent=row.querySelector('[data-ae-primary="true"]')||row;
    let badges=row.querySelector('[data-ae-assignment-badges]');
    if(!badges){badges=document.createElement('span');badges.setAttribute('data-ae-assignment-badges','');badges.className='ae-assignment-badges';parent.append(badges);}
    const signature=JSON.stringify([info.state,info.label,info.badges]);
    if(badges.dataset.signature!==signature){
      badges.dataset.signature=signature;badges.replaceChildren();
      for(const entry of [{kind:info.state,label:info.label,primary:true},...info.badges]){
        const badge=document.createElement('span');badge.className=entry.primary?'ae-status-badge ae-assignment-status':'ae-status-badge';badge.dataset.statusKind=entry.kind;
        const glyph=document.createElement('span');glyph.setAttribute('aria-hidden','true');glyph.textContent=entry.kind==='submitted'?'✓ ':['overdue','revision'].includes(entry.kind)?'! ':'• ';
        badge.append(glyph,document.createTextNode(entry.label));badges.append(badge);
      }
    }
  }
  function applyTable(plan){
    const {group,header,rows,contextRows,labels,primary,type}=plan;
    klass(group,'ae-card-table');attr(group,'role','table');
    if(group.tHead)attr(group.tHead,'role','rowgroup');
    attr(header,'role','row');klass(header,'ae-card-header-row');
    for(const th of header.cells){attr(th,'role','columnheader');klass(th,'ae-card-heading-static',!th.querySelector('a[href],button,input,select'));}
    for(const body of group.tBodies)attr(body,'role','rowgroup');
    for(const row of contextRows){klass(row,'ae-card-context-row');attr(row,'role','row');for(const cell of row.cells)attr(cell,'role',cell.tagName==='TH'?'rowheader':'cell');}
    rows.forEach((row,index)=>{
      markCard(row,type,index);attr(row,'role','row');
      const nativePrimary=type==='resource'?[...row.cells].findIndex(c=>c.matches('[headers~="title"],.specialLink')):-1,rowPrimary=nativePrimary>=0?nativePrimary:primary;
      Array.from(row.cells).forEach((cell,i)=>{
        const headerId=(cell.getAttribute('headers')||'').split(/\s+/).find(id=>[...header.cells].some(h=>h.id===id)),column=headerId?[...header.cells].findIndex(h=>h.id===headerId):i;
        const label=labels[column]||'';
        attr(cell,'role',cell.tagName==='TH'?'rowheader':'cell');
        const selection=!!cell.querySelector('input[type="checkbox"]')&&i!==rowPrimary;
        const actions=/^(actions?|options?|operations?)$/i.test(label)||/^actions?\d*$/i.test(headerId||'')||!!cell.querySelector('.dropdown-toggle,.dropdown-menu');
        attr(cell,'data-ae-label',label||(selection?'Selection':actions?'Actions':'Details'));
        const portrait=type==='person'&&/^(?:picture|photo|avatar)$/i.test(label);
        const empty=type==='resource'&&!text(cell)&&!cell.querySelector('a,button,input,select,img,svg');
        attr(cell,'data-ae-cell',i===rowPrimary?'primary':selection?'selection':empty?'empty':actions?'actions':portrait?'portrait':'meta');
        attr(cell,'data-ae-primary',i===rowPrimary?'true':null);
        attr(cell,'data-ae-type',i===rowPrimary?labelType(row,type,cell):null);
      });
      if(type==='assignment')assignment(row,labels);
    });
  }
  function applyList(plan){
    const {group,type,rows}=plan;
    const interactive=rows.some(el=>el.matches('a[href],button,input,select,summary'));
    klass(group,'ae-card-list');if(!original(group,'role'))attr(group,'role',interactive?'group':'list');
    let count=group.tagName==='OL'?(group.hasAttribute('start')?Number(group.getAttribute('start')):group.reversed?rows.length:1):1;
    rows.forEach(row=>{
      if(group.tagName==='OL'&&row.hasAttribute('value'))count=Number(row.getAttribute('value'));
      markCard(row,type,count-1);attr(row,'data-ae-type',labelType(row,type,row));
      if(type==='assignment')assignment(row);
      // A Bootstrap list-group item can itself be a link or button. Preserve
      // that native interactive role, without replacing it with listitem.
      if(!original(row,'role'))attr(row,'role',interactive?null:'listitem');
      count+=group.reversed?-1:1;
    });
  }
  function update(){
    timer=0;clearTimeout(deadlineTimer);nextDeadline=Infinity;scanTime=Date.now();
    if(!enabled()){
      restore();for(const c of ['ae-resource-surface','ae-list-reduced-motion','ae-academic-surface'])if(root.classList.contains(c))root.classList.remove(c);
      lastCard=null;return;
    }
    const scope=framed?document.body:document.querySelector('main#content');if(!scope)return;
    live=new Set();
    const tables=[...scope.querySelectorAll('table')];
    const plans=tables.map(tablePlan).filter(Boolean);
    const lists=[...scope.querySelectorAll('ul,ol,[role="list"],.list-group,.announcement-list,.discussion-list,.message-list,.resource-list,.assignment-list,.collection-list,.roster-members-grid')].map(listPlan).filter(Boolean);
    // A native tool may change from read-only to editing without navigation.
    // Restore the previous mode before journaling the new one on the same table.
    for(const table of tables){const card=plans.some(p=>p.group===table);if(card&&table.classList.contains('ae-native-table')||!card&&table.classList.contains('ae-card-table'))restore(el=>el===table||table.contains(el));}
    const academic=['grade','person'].includes(toolKind(scope))||!!scope.querySelector('[class*="Mrphs-sakai-gradebook"],[class*="Mrphs-sakai-roster"],#gradeSummaryTable,#roster-members');
    if(academic){
      klass(framed?scope:scope.querySelector('.Mrphs-toolBody')||scope,'ae-academic-tool');
      for(const table of tables)if(!plans.some(p=>p.group===table)&&eligible(table)&&!table.matches('[role="presentation"]')){klass(table,'ae-native-table');const layout=globalThis.AetherClassifier?.classify(table,toolKind(table))||'responsive-table';attr(table,'data-ae-layout',layout==='cards'?'responsive-table':layout);}
    }
    for(const plan of [...plans,...lists]){
      plan.header?applyTable(plan):applyList(plan);
      const container=plan.group.closest('.Mrphs-container');if(container)klass(container,'ae-card-container');
    }
    restore(el=>!live.has(el));live=null;
    root.classList.toggle('ae-academic-surface',academic);
    if(framed)root.classList.toggle('ae-resource-surface',academic||!!(plans.length+lists.length));
    root.classList.toggle('ae-list-reduced-motion',!moving());
    if(!moving())for(const [el,values]of journal)if(values.has('style'))restoreStyles(el);
    if(Number.isFinite(nextDeadline))deadlineTimer=setTimeout(update,Math.min(2147483000,Math.max(1,nextDeadline-Date.now()+1)));
  }
  function schedule(records){
    if(records?.length&&records.every(r=>(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('#aether-workspace,#aether-global-ambient,[data-ae-assignment-badges],[data-ae-preview-control]')))return;
    // Mutation observers run before rendering. No DOMContentLoaded wait or
    // debounce that exposes the native table for several painted frames.
    if(!timer){timer=1;queueMicrotask(update);}
  }
  function resetPointer(card){if(card&&journal.get(card)?.has('style'))restoreStyles(card);}
  function pointer(e){
    if(!moving())return;
    pending={x:e.clientX,y:e.clientY,target:e.target};if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;if(!pending||!moving())return;const p=pending,card=p.target?.closest?.('.ae-record-card');
      if(lastCard!==card){resetPointer(lastCard);lastCard=card;}
      if(card){
        remember(card,'style');const r=card.getBoundingClientRect(),x=Math.max(0,Math.min(1,(p.x-r.left)/r.width)),y=Math.max(0,Math.min(1,(p.y-r.top)/r.height));
        card.style.setProperty('--ae-hover-x',(x*100).toFixed(2)+'%');card.style.setProperty('--ae-hover-y',(y*100).toFixed(2)+'%');
        card.style.setProperty('--ae-rx',((.5-y)*4).toFixed(2)+'deg');card.style.setProperty('--ae-ry',((x-.5)*5).toFixed(2)+'deg');
      }
      if(framed&&innerWidth&&innerHeight)top.postMessage({type:'aether-pointer-v051',x:p.x/innerWidth,y:p.y/innerHeight},top.location.origin);
    });
  }
  function boot(){
    update();
    const bodyObserver=new MutationObserver(schedule);bodyObserver.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['colspan','rowspan','hidden','datetime','data-due-date','data-submission-status','data-sort-value','data-open-date','data-submitted-at','data-accept-until','data-grade','data-feedback-status']});observers.push(bodyObserver);
    const stateObserver=new MutationObserver(()=>schedule());stateObserver.observe(topDoc.documentElement,{attributes:true,attributeFilter:['class']});observers.push(stateObserver);
    const header=topDoc.querySelector('.portal-header .header-tool-title');
    if(header){const titleObserver=new MutationObserver(()=>schedule());titleObserver.observe(header,{childList:true,subtree:true,characterData:true});observers.push(titleObserver);}
    if(!globalThis.AetherMotion)document.addEventListener('pointermove',pointer,{passive:true});
    document.addEventListener('pointerleave',()=>{resetPointer(lastCard);lastCard=null;},{passive:true});
    reduced.addEventListener('change',schedule);
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
    document.addEventListener('visibilitychange',schedule);
    window.addEventListener('pageshow',schedule);
  }
  window.addEventListener('pagehide',e=>{if(e.persisted)return;observers.forEach(o=>o.disconnect());clearTimeout(deadlineTimer);cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',schedule);window.removeEventListener('pageshow',schedule);document.removeEventListener('pointermove',pointer);reduced.removeEventListener('change',schedule);});
  boot();
})();
