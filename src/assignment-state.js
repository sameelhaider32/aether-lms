/* Read-only, conservative interpretation of native Sakai submission metadata. */
(() => {
  'use strict';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  function submission(value){
    const s=clean(value).toLowerCase();
    if(/\b(not submitted|unsubmitted|not started|no submission|draft|in progress|missing)\b/.test(s))return false;
    const confirmed=s.replace(/\b(?:not returned|not graded|ungraded)\b/g,'');
    if(/\b(submitted|resubmitted|returned)\b/.test(confirmed))return true;
    return null;
  }
  function dueDate(value){
    let s=clean(value);if(!s)return NaN;
    if(/^\d{10}$/.test(s))return Number(s)*1000;
    if(/^\d{13}$/.test(s))return Number(s);
    // ISO or an English month name is unambiguous. Do not guess 10/11/2026.
    if(!/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(s)&&!/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ .-]/i.test(s))return NaN;
    if(!/\b\d{4}\b/.test(s))return NaN;
    s=s.replace(/\bPKT\b/ig,'GMT+0500').replace(/\s+at\s+/ig,' ');
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,23,59,59,999).getTime();}
    const n=Date.parse(s);if(!Number.isFinite(n))return NaN;
    const hasTime=/\d{1,2}:\d{2}|\d\s*(?:am|pm)\b/i.test(s);
    // A date without a time remains open through the end of that local day.
    if(!hasTime){const d=new Date(n);d.setHours(23,59,59,999);return d.getTime();}
    return n;
  }
  function classify(status,due,now=Date.now(),facts={}){
    const s=clean(status),submitted=submission(s),timestamp=dueDate(due),accept=dueDate(facts.acceptUntil);
    let open=dueDate(facts.openAt);if(Number.isFinite(open)&&!hasTime(facts.openAt)){const day=new Date(open);day.setHours(0,0,0,0);open=day.getTime();}
    const submittedAt=hasTime(facts.submittedAt)?dueDate(facts.submittedAt):NaN;
    const badges=[],result={state:'unknown',label:'Check status in Sakai',due:timestamp,nextChange:Infinity,badges};
    const set=(state,label)=>Object.assign(result,{state,label});
    if(/\bcancelled\b|\bcanceled\b/i.test(s))return set('cancelled','Cancelled');
    if(/\bexcused\b|\bexempt\b/i.test(s))return set('excused','Excused');
    if(/\b(returned for revision|resubmission required|needs revision|revise and resubmit)\b/i.test(s))set('revision','Action required · revise submission');
    else if(submitted===true){
      set('submitted','Submitted');
      const explicitLate=/\bsubmitted[\s\W]+late\b|\blate[\s\W]+submitted\b|\blate submission\b/i.test(s)&&!/\blate submissions? (?:allowed|accepted)\b/i.test(s);
      if(explicitLate||Number.isFinite(timestamp)&&Number.isFinite(submittedAt)&&submittedAt>timestamp)badges.push({kind:'late',label:'Late'});
    }else if((Number.isFinite(open)&&now<open)||/\b(not yet open|not open yet)\b/i.test(s)){
      set('not-open','Not open yet');if(open>now)result.nextChange=open;
    }else if(submitted===false){
      if(!Number.isFinite(timestamp))set('not-submitted','Not submitted · due date unavailable');
      else if(now>timestamp)set('overdue','Overdue · Not submitted');
      else{
        const left=timestamp-now,unit=left>48*3600000?86400000:left>2*3600000?3600000:60000,n=Math.ceil(left/unit),word=unit===86400000?'day':unit===3600000?'hour':'minute';
        const remaining=left===0?'Due now':`${n} ${word}${n===1?'':'s'} left`;
        const state=left<=2*3600000?'due-shortly':left<=24*3600000?'due-soon':'not-submitted';
        set(state,(state==='due-shortly'?'Due shortly':state==='due-soon'?'Due soon':'Not submitted')+' · '+remaining);
        result.nextChange=Math.min(timestamp+1,now+Math.max(1,left-(n-1)*unit));
        for(const boundary of [timestamp-24*3600000,timestamp-2*3600000])if(boundary>now)result.nextChange=Math.min(result.nextChange,boundary);
      }
      if(/\bdraft\b|\bin progress\b/i.test(s))badges.push({kind:'draft',label:(/\bdraft\b/i.test(s)?'Draft saved':'In progress')+' · Not submitted'});
    }
    if(result.state==='overdue'&&(accept>now||/\blate submissions? (?:allowed|accepted)\b/i.test(s)))badges.push({kind:'late-allowed',label:'Late submission allowed'});
    if(accept>now&&result.state==='overdue')result.nextChange=Math.min(result.nextChange,accept+1);
    const grade=clean(facts.grade);
    if(grade&&!/^(?:[-—–]|n\/?a)$|\b(?:not(?: yet)? (?:graded|released|available)|no grade|ungraded|pending|awaiting)\b/i.test(grade))badges.push({kind:'graded',label:'Graded · '+grade.slice(0,80)});
    else if(/not(?: yet)? released/i.test(grade))badges.push({kind:'grading',label:'Grade not released'});
    else if(submitted===true&&result.state!=='revision')badges.push({kind:'grading',label:/\b(?:not(?: yet)? graded|ungraded|awaiting grading|pending)\b/i.test(s+' '+grade)?'Awaiting grading':'Grade unavailable'});
    if(/\bfeedback available\b/i.test(clean(facts.feedback))&&!/\b(?:no|not)\s+feedback\b/i.test(clean(facts.feedback)))badges.push({kind:'feedback',label:'Feedback available'});
    return result;
  }
  function hasTime(value){return /^\d{10}(?:\d{3})?$/.test(clean(value))||/\d{1,2}:\d{2}|\d\s*(?:am|pm)\b/i.test(clean(value));}
  function dateValue(node){return node?.getAttribute('datetime')||node?.getAttribute('data-sort-value')||node?.querySelector('time[datetime]')?.getAttribute('datetime')||node?.textContent;}
  function read(status,due,now,facts={}){
    const machine=due?.querySelector('time[datetime],[data-due-date],[data-sort-value]');
    const raw=machine?.getAttribute('datetime')||machine?.getAttribute('data-due-date')||machine?.getAttribute('data-sort-value')||due?.getAttribute('datetime')||due?.getAttribute('data-due-date')||due?.getAttribute('data-sort-value')||due?.textContent;
    const s=status?.getAttribute('data-submission-status')||status?.textContent;
    return classify(s,raw,now,facts);
  }
  globalThis.AetherAssignmentState={submission,dueDate,classify,read,dateValue};
})();
