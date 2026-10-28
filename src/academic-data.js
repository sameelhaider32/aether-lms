/* Mission Control contracts. Academic metadata stays in this document's memory. */
(() => {
 'use strict';
 const clean=v=>String(v??'').replace(/\s+/g,' ').trim().slice(0,400);
 const day=86400000;
 function url(value,base=location.href){try{if(!value||/^\s*(?:javascript:|data:)/i.test(value))return null;const u=new URL(value,base);return u.origin===location.origin&&u.protocol==='https:'?u.href:null;}catch{return null;}}
 function siteId(value){try{const u=new URL(value,location.href),m=u.pathname.match(/^\/+portal\/site\/([^/]+)/);return u.origin===location.origin&&m?decodeURIComponent(m[1]):null;}catch{return null;}}
 function date(value){if(value&&typeof value==='object')value=value.time??value.epochMillis??value.display;return globalThis.AetherAssignmentState?.dueDate(value)??NaN;}
 const exact=value=>/^\d{10}(?:\d{3})?$/.test(String(value))||/\d{1,2}:\d{2}|\d\s*(?:am|pm)\b/i.test(String(value));
 function record(v){
  const href=url(v.url),title=clean(v.title);if(!href||!title||!v.id||!['assignment','event','announcement'].includes(v.type))return null;
  let raw=v.dueRaw||v.startRaw||'';if(raw&&typeof raw==='object')raw=raw.time??raw.epochMillis??raw.display??'';const time=date(raw);
  return {id:String(v.id),type:v.type,siteId:v.siteId||'',course:clean(v.course)||'Course unavailable',title,url:href,due:v.type==='assignment'?time:NaN,start:v.type!=='assignment'?time:NaN,time,rawDate:clean(raw),exact:exact(raw),nativeStatus:clean(v.nativeStatus),verifiedStatus:v.verifiedStatus===true,visibility:'native-visible',source:v.source||'Native Sakai',observedAt:v.observedAt||Date.now()};
 }
 function state(r,now=Date.now()){
  if(r.type!=='assignment')return {state:'event',label:r.type==='event'?'Scheduled':'Announcement',badges:[]};
  return globalThis.AetherAssignmentState.classify(r.verifiedStatus?r.nativeStatus:'',r.rawDate,now);
 }
 const attention=(r,now)=>r.type==='assignment'&&r.verifiedStatus&&['overdue','due-shortly','due-soon','not-submitted','revision'].includes(state(r,now).state);
 const completed=(r,now)=>r.type==='assignment'&&r.verifiedStatus&&['submitted','excused'].includes(state(r,now).state);
 function unique(records){
  const map=new Map();
  for(const r of records.filter(Boolean)){
   const key=r.type+'|'+r.siteId+'|'+r.id,old=map.get(key);if(!old){map.set(key,r);continue;}
   const conflictingDate=old.conflictingDate||r.conflictingDate||Number.isFinite(old.time)&&Number.isFinite(r.time)&&old.time!==r.time;
   const conflictingStatus=old.conflictingStatus||r.conflictingStatus||old.verifiedStatus&&r.verifiedStatus&&old.nativeStatus!==r.nativeStatus;
   const preferred=r.verifiedStatus&&!old.verifiedStatus?r:old,dated=Number.isFinite(old.time)?old:r,merged={...preferred,conflictingDate,conflictingStatus};
   Object.assign(merged,{time:dated.time,due:dated.due,start:dated.start,rawDate:dated.rawDate,exact:dated.exact});
   if(conflictingDate)Object.assign(merged,{time:NaN,due:NaN,start:NaN,rawDate:''});
   if(conflictingStatus)Object.assign(merged,{verifiedStatus:false,nativeStatus:''});
   if(conflictingDate||conflictingStatus)merged.source='Conflicting source metadata; check original Sakai';
   map.set(key,merged);
  }
  return [...map.values()];
 }
 function select(records,f,now=Date.now()){
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()+(f.offset||0));const end=new Date(start);end.setDate(end.getDate()+Number(f.days||14));
  return records.filter(r=>{
   if(f.course&&r.siteId!==f.course||f.type&&r.type!==f.type)return false;
   if(f.status==='attention'&&!attention(r,now)||f.status==='completed'&&!completed(r,now))return false;
   if(!Number.isFinite(r.time))return true;
   if(r.type==='announcement')return r.time<=now&&r.time>=now-Number(f.days||14)*day;
   return r.time>=+start&&r.time<+end||!f.offset&&attention(r,now)&&r.time<now;
  }).sort((a,b)=>(f.sort==='course'?a.course.localeCompare(b.course):0)||(Number.isFinite(a.time)?a.time:Infinity)-(Number.isFinite(b.time)?b.time:Infinity)||a.title.localeCompare(b.title));
 }
 function relative(r,now=Date.now()){if(!Number.isFinite(r.time))return 'Date unavailable';if(!r.exact)return 'Time unspecified';const delta=r.time-now,n=Math.ceil(Math.abs(delta)/3600000);return Math.abs(delta)<60000?'Now':delta<0?`${n<24?n+'h':Math.ceil(n/24)+'d'} ago`:`In ${n<24?n+'h':Math.ceil(n/24)+'d'}`;}
 globalThis.AetherAcademicData={clean,url,siteId,date,exact,record,state,attention,completed,unique,select,relative,day};
})();
