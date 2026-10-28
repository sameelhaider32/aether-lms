/* Read only the published student Gradebook summary through discovered native links. */
(() => {
 'use strict';const D=globalThis.AetherAcademicData,S=globalThis.AetherAcademicSources;
 const visible=n=>{for(let p=n;p?.nodeType===1;p=p.parentElement)if(p.matches('[hidden],[aria-hidden="true"],.hidden,.d-none')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(p.getAttribute('style')||''))return false;return true;};
 function native(doc,course,base){
  const rows=[],url=S.nativeURL(base,location.href);if(!course.id||!url)return rows;
  for(const table of doc.querySelectorAll('#gradeSummaryTable')){
   if(!visible(table)||table.querySelector('input,textarea,select,[contenteditable="true"]'))continue;
   for(const row of [...table.querySelectorAll('.gb-summary-grade-row')].slice(0,300)){
    if(!visible(row))continue;const label=row.querySelector('.gb-summary-grade-title'),score=row.querySelector('.gb-summary-grade-score');
    if(!label||!score||!visible(label)||!visible(score))continue;
    const title=D.clean(label.textContent),value=D.clean(score.textContent);
    if(!title||/not released|unreleased|unpublished|hidden|not yet available/i.test(value)||row.matches('[data-released="false"]'))continue;
    const anchor=label.closest('a[href]')||label.querySelector('a[href]'),target=S.nativeURL(anchor?.getAttribute('href'),base)||url;
    if(D.siteId(target)&&D.siteId(target)!==course.id)continue;
    rows.push({key:'grade:'+course.id+':'+(row.id||title),type:'grade',title,course:course.title,siteId:course.id,url:target,meta:'Gradebook item'+(value?' · '+value:''),nativeAnchor:anchor?.isConnected?anchor:null,gradeId:row.id||''});
   }
  }
  return rows;
 }
 async function load(courses,tools,signal,publish,check){
  const reader=new S.Reader(signal);let unsupported=0;
  for(const course of courses.slice(0,16)){
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');await check();
   try{
    let link=tools.find(t=>t.siteId===course.id&&/^grade\s*book(?:\s*2)?$/i.test(t.title));
    if(!link){const page=await reader.read(course.url,false);link=S.navigation(page,course,course.url).find(t=>/^grade\s*book(?:\s*2)?$/i.test(t.title));}
    if(!link){unsupported++;continue;}const href=S.nativeURL(link.url,course.url);if(!href||D.siteId(href)&&D.siteId(href)!==course.id){unsupported++;continue;}
    let page=await reader.read(href,false),rows=native(page,course,href);
    const frame=page.querySelector('.Mrphs-sakai-gradebookng iframe[src],iframe.portletMainIframe[src]');
    if(frame){const src=S.nativeURL(frame.getAttribute('src'),href);if(src)rows.push(...native(await reader.read(src,false),course,href));}
    await check();if(signal.aborted)throw new DOMException('Cancelled','AbortError');publish(course,rows);
   }catch(error){if(signal.aborted)throw error;unsupported++;}
  }
  return unsupported;
 }
 globalThis.AetherSpotlightGrades={native,load};
})();
