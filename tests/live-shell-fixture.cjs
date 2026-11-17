/* Fixture that mirrors the live Sakai portal shell recorded in docs/live-dom-audit.md.
   Structure only: every title, name and value here is invented. */
const {origin,toolBody}=require('./fixtures.cjs');
const tools=['Overview','Syllabus','Calendar','Announcements','Resources','Conversations','Polls','Discussions','Assignments','Tests & Quizzes','Gradebook','Drop Box','Email','Roster','Site Info'];
const sites=[['Home','home'],['2601 FIX Introduction to Fictional Programming (FX 200 S1-Lecture)','fx200'],['2601 FIX Invented Calculus (FX 101 S1-Lecture)','fx101'],['2601 FIX Made-up Writing Seminar (FX 100 S2-Seminar)','fx100']];
const route=(tool='Overview',site='fx200')=>`${origin}/portal/site/${site}/tool/${encodeURIComponent(tool)}`;
const home=origin+'/portal';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
// Approximates the Sakai rules that caused the live defects: a grid shell with a fixed header row and a
// 22rem sidebar column, a scrolling main container, and a dark user theme driven by custom properties.
const css=`:root{font-size:14px;--portal-header-height:4.5rem;--portal-nav-sidebar-width:22rem;--sakai-background-color-1:#fff;--sakai-background-color-2:#f4f4f4;--sakai-text-color-1:#222;--sakai-border-color:#ddd;--top-header-background:#fff}
:root.sakaiUserTheme-dark{--sakai-background-color-1:#1f2225;--sakai-background-color-2:#2a2e33;--sakai-text-color-1:#d3d4d6;--sakai-border-color:#444;--top-header-background:#1f2225}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial;background:var(--sakai-background-color-1);color:var(--sakai-text-color-1)}
.overflow-hidden{overflow:hidden}.vh-100{height:100vh}.d-flex{display:flex}.d-none{display:none}.align-items-center{align-items:center}.justify-content-between{justify-content:space-between}.h-100{height:100%}.w-100{width:100%}.flex-nowrap{flex-wrap:nowrap}.me-3{margin-right:1rem}.px-3{padding-inline:1rem}.pt-4{padding-top:1.5rem}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}[hidden]{display:none!important}
.portal-container{display:grid;grid-template-columns:1fr;grid-template-rows:auto auto var(--portal-header-height) 1fr var(--portal-header-height);grid-template-areas:"paBanner" "jumpLinks" "header" "mainContainer" "mobilebar"}
@media(min-width:768px){.portal-container{grid-template-columns:var(--portal-nav-sidebar-width) 1fr;grid-template-rows:auto auto var(--portal-header-height) 1fr;grid-template-areas:"paBanner paBanner" "jumpLinks jumpLinks" "header header" "sidebar mainContainer"}.d-md-inline{display:inline}.d-md-none{display:none}}
@media(min-width:992px){.d-lg-block{display:block}}
.portal-pasystem{grid-area:paBanner}#skipNav{grid-area:jumpLinks}
.portal-header{height:var(--portal-header-height);grid-area:header;background-color:var(--top-header-background);border-bottom:3px solid var(--sakai-border-color)}
.portal-header-breadcrumb{display:flex;gap:8px}.btn-logo{display:block;width:103px;height:30px;background:#888}
.portal-nav-sidebar{grid-area:sidebar;overflow:auto;background:var(--sakai-background-color-2)}
@media(max-width:767.98px){.portal-nav-sidebar{display:none}}
.portal-main-container{grid-area:mainContainer;overflow:auto}.portal-mobilebar{grid-area:mobilebar}
#sakai-system-indicators{display:flex;list-style:none;margin-block:0;padding:0}.icon-button{width:45px;height:45px;border:0;background:none;color:inherit}
#toolMenu ul{list-style:none;padding:0;margin:0}#toolMenu a{display:block;padding:8px;color:inherit}.site-list-item:not(.is-current-site) .site-page-list{display:none}.selected-page{background:#0f4b70;color:#fff}
.offcanvas{position:fixed;top:0;right:0;z-index:1045;width:400px;height:100%;visibility:hidden}
.Mrphs-container{margin:8px;background:var(--sakai-background-color-1)}.Mrphs-toolTitleNav{display:flex;min-height:48px;padding:0 12px;background:var(--sakai-background-color-2)}
.row{display:flex;flex-wrap:wrap}.col-lg-6{flex:0 0 50%;max-width:50%;padding:8px}@media(max-width:991px){.col-lg-6{flex-basis:100%;max-width:100%}}
iframe{width:100%;height:220px;border:0}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid var(--sakai-border-color)}button,input,textarea{font:inherit}`;
const page=(title,cls,body)=>`<!doctype html><html lang="en" class="Mrphs-html sakaiUserTheme-dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${css}</style></head><body class="${cls}">${body}</body></html>`;
const panel=(kind,title,inner,body='Mrphs-toolBody Mrphs-toolBody--'+kind)=>`<div class="Mrphs-container Mrphs-${kind}"><nav class="Mrphs-toolTitleNav Mrphs-container--toolTitleNav align-items-center"><h2 class="Mrphs-toolTitleNav__title"><span class="Mrphs-toolTitleNav__text">${title}</span></h2></nav><div class="${body}">${inner}</div></div>`;
const framed=id=>`<iframe class="portletMainIframe" title="Fixture ${id} tool frame" src="${origin}/portal/tool/${id}"></iframe>`;
const siteItem=([title,id],current,tool)=>{
 const href=id==='home'?home:`${origin}/portal/site/${id}`,pinned=id!=='home';
 return `<li id="site-list-${pinned?'pinned':'home'}-item-${id}" class="site-list-item py-1 px-2 mx-3 mt-3${current?' is-current-site':''}"><div class="site-list-item-head d-flex align-items-center py-1 w-100"><div class="site-link-block d-flex align-items-center rounded-end me-1"><button type="button" class="btn icon-button collapsed px-2 me-1" aria-label="Expand tool list"><i class="bi-chevron-right"></i></button><a class="sidebar-site-title" href="${href}">${escape(title)}</a></div>${pinned?'<button type="button" class="d-inline-block p-1 site-opt-pin btn btn-transparent" aria-label="Unpin site" data-pinned="true"></button>':''}</div><div id="${id}-page-list" class="site-list-item-collapse collapse${current?' show':''}"><ul class="site-page-list nav flex-column py-2">${tools.map(t=>`<li class="nav-item ms-4"><a class="btn btn-nav w-100 ps-3${current&&t===tool?' selected-page':''}" href="${id==='home'?home+'?fixture-tool='+encodeURIComponent(t):route(t,id)}"><i class="si" aria-hidden="true"></i><span>${escape(t)}</span></a></li>`).join('')}</ul></div></li>`;
};
function frameFixture(url){
 const id=new URL(url).pathname.split('/').pop();
 return page('Fixture frame','Mrphs-container Mrphs-sakai-'+id,`<div class="portletBody"><h3>Fixture ${escape(id)}</h3><p>Invented frame content.</p><input type="button" value="Options"></div>`);
}
function liveFixture(url){
 const u=new URL(url),parts=u.pathname.split('/').filter(Boolean);
 if(parts[1]==='tool')return frameFixture(url);
 const isHome=parts.length<2||parts[1]!=='site',site=isHome?'home':parts[2],tool=decodeURIComponent(parts[4]||'Overview');
 const siteTitle=(sites.find(s=>s[1]===site)||sites[1])[0];
 const overview=`<div class="row"><div id="col1of2" class="p-2 col-lg-6 col-md-12">${isHome?panel('sakai-summary-calendar','Calendar',framed('summary-calendar')):panel('sakai-iframe-site','Overview','<div class="portletBody siteDescription"><h3>Invented schedule</h3><p>Fixture course description.</p></div>')}</div><div id="col2of2" class="p-2 col-lg-6 col-md-12">${panel('sakai-synoptic-announcement','Recent Announcements',framed('synoptic-announcement'))}${panel('sakai-synoptic-messagecenter','Message Center Notifications',framed('synoptic-messagecenter'))}</div></div>`;
 const kind={Resources:'sakai-resources',Assignments:'sakai-assignment-grades',Gradebook:'sakai-gradebookng'}[tool]||'sakai-fixture-tool';
 const single=`<div id="col1" class="Mrphs-pageColumns Mrphs-pageColumns--single"><div class="Mrphs-container Mrphs-${kind}"><nav class="Mrphs-toolTitleNav Mrphs-container--toolTitleNav align-items-center"></nav><div class="portletBody">${toolBody(tool==='Gradebook'?'Gradebook student':tool,u)}</div></div></div>`;
 const crumb=`<div class="align-items-center portal-header-breadcrumb portal-header-breadcrumb-mobile w-100"><div id="header-site-title" class="portal-header-breadcrumb-item portal-header-site-title"><a href="${isHome?home:origin+'/portal/site/'+site}">${escape(siteTitle)}</a></div><div class="bi bi-chevron-right portal-header-breadcrumb-separator"></div><div class="portal-header-breadcrumb-item header-tool-title"><a href="#">${escape(tool)}</a></div>${tool==='Overview'?'<a class="Mrphs-hierarchy-item manage-overview-link d-none d-lg-block" href="#manage" onclick="event.preventDefault();this.dataset.clicked=\'true\'"><span class="fa fa-pencil"></span> Manage Overview</a>':''}</div>`;
 const indicator=(label,icon,extra='')=>`<li class="d-none d-md-inline"><button type="button" class="btn icon-button ${extra}" aria-label="${label}" onclick="this.dataset.opened='true'"><span class="${icon}"></span></button></li>`;
 return page(`Sakai : ${siteTitle} : ${tool}`,'Mrphs-portalBody overflow-hidden',`<div id="pageBody" class="Mrphs-portalWrapper vh-100 portal-container">
<div class="portal-pasystem"><div class="pasystem-banner-alerts"></div></div><nav id="skipNav" class="Mrphs-skipNav"></nav>
<header class="portal-header d-flex align-items-center justify-content-between"><div class="d-flex align-items-center h-100 ms-3 ms-md-0 w-100"><div id="logoWrapper" class="portal-header-logo d-flex h-100 align-items-center"><button type="button" id="sidebar-collapse-button" class="btn icon-button btn-sidebar-collapse portal-header-hamburger-button me-1" aria-label="Collapse sidebar"><span class="bi portal-nav-sidebar-icon"></span></button><a class="btn btn-logo mx-2 ms-md-0" href="${home}"><span class="visually-hidden">Fixture LMS</span></a></div>${crumb}</div>
<a class="sak-sysInd-systemAlerts nav-link d-none align-items-center text-white me-auto" href="#"></a>
<ul id="sakai-system-indicators" class="nav flex-nowrap align-items-center me-3">${indicator('Launch the help system','bi bi-question-circle')}${indicator('View All Sites','bi bi-grid-3x3-gap-fill')}${indicator('Calendar','si si-calendar')}${indicator('View your notifications','portal-notifications-icon bi bi-bell','portal-notifications-button')}<li><button type="button" id="fixture-account" class="btn icon-button sak-sysInd-account p-0 me-3" aria-label="Account Menu" onclick="document.querySelector('#sakai-account-panel').style.visibility='visible'"><span class="sakai-accountProfileImage rounded-circle p-0"></span></button></li></ul></header>
<aside id="portal-nav-sidebar" class="portal-nav-sidebar overflow-auto portal-nav-sidebar-desktop"><nav id="toolMenu" class="Mrphs-toolsNav__menu sakai-sitesAndToolsNav h-100 d-flex flex-column" aria-label="Sites"><h2 id="totoolmenu" class="visually-hidden d-none d-md-block">Tools list begins here</h2><div id="sites-section-first" class="sites-section"><ul class="mb-0">${siteItem(sites[0],isHome,tool)}</ul></div><div class="sites-section pinned-site-section"><h3 class="sites-section-heading">Pinned</h3><ul id="pinned-site-list" class="mb-0">${sites.slice(1).map(s=>siteItem(s,s[1]===site,tool)).join('')}</ul></div></nav><div class="sticky-footer w-100 d-flex ps-3"><button type="button" class="btn">View all my sites</button></div></aside>
<div class="portal-main-container container-fluid pt-4"><main id="content" class="portal-main-content ${tool==='Overview'?'Mrphs-multipleTools ':''}px-3"><h1 id="tocontent" class="skip visually-hidden">Content begins here</h1>${tool==='Overview'?overview:single}</main><footer class="portal-footer p-2 d-flex">Fixture LMS footer</footer></div>
<aside id="sakai-account-panel" class="offcanvas offcanvas-end"><div class="offcanvas-body"><a id="fixture-logout" href="#logout" onclick="event.preventDefault();this.dataset.clicked='true'">Log Out</a></div></aside>
<nav class="portal-mobilebar d-flex d-md-none align-items-center"></nav></div>`);
}
module.exports={liveFixture,frameFixture,route,home,tools,sites,origin};
