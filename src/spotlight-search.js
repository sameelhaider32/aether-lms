/* Small local ranker. No network, storage or document scanning. */
(() => {
 'use strict';
 const fold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const stops=new Set(['and','of','the','for','to','introduction','in']);
 const acronym=(value,all=false)=>fold(String(value||'').replace(/^\d{4}\s+(?:SSE|SHSS|SDSB|SBS|MGSHSS)\s+/i,'').replace(/\([^)]*\)/g,'').replace(/\b[A-Z]{2,6}\s*\d{3,4}\b/gi,'')).split(' ').filter(w=>w&&(all||!stops.has(w))&&!/^\d|^[a-z]{1,5}\d/.test(w)).map(w=>w[0]).join('');
 function compile(row){const title=fold(row.title),course=fold(row.course),extra=fold([row.path,row.fileType,row.keywords].join(' ')),codes=[...String(row.title+' '+row.course).matchAll(/\b([a-z]{2,6})\s*(\d{3,4})\b/gi)].map(m=>(m[1]+m[2]).toLowerCase()),aliases=[acronym(row.course),acronym(row.course,true),acronym(row.title),acronym(row.title,true),...codes].join(' ');return {...row,_title:title,_all:[title,course,aliases,extra].filter(Boolean).join(' '),_words:new Set([title,course,extra,aliases].join(' ').split(' ').filter(Boolean))};}
 function editOne(a,b){if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,n=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++n>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return n+(i<a.length||j<b.length?1:0)<=1;}
 function rank(rows,query,category='',current=''){
  const q=fold(query.replace(/^\s*>/,'')),terms=q.split(' ').filter(Boolean).slice(0,10),commands=/^\s*>/.test(query);
  const found=[];
  for(const row of rows){
   if(commands?row.type!=='command':category&&category!=='all'&&(category==='updates'?!['event','announcement'].includes(row.type):category==='files'?!['resource','folder'].includes(row.type):row.type!==category))continue;
   let score=100,fuzzy=0,weight=0,valid=true;
   if(q){
    for(const term of terms){
     if(row._words.has(term))weight+=row._title.split(' ').includes(term)?18:10;
     else if([...row._words].some(w=>w.startsWith(term)))weight+=8;
     else if(row._all.includes(term))weight+=4;
     else if(term.length>=4&&fuzzy===0&&[...row._words].some(w=>editOne(w,term))){fuzzy++;weight-=25;}
     else{valid=false;break;}
    }
    if(!valid)continue;
    score=row._title===q?1000:row._title.startsWith(q)?850:row._title.includes(' '+q)?730:row._title.includes(q)?620:fuzzy?260:470;
    score+=Math.min(70,weight);
   }else score+=row.type==='command'?45:row.type==='course'?35:row.type==='tool'?20:0;
   if(row.siteId&&row.siteId===current)score+=9;
   found.push({row,score});
  }
  return found.sort((a,b)=>b.score-a.score||a.row.title.localeCompare(b.row.title)).slice(0,30).map(x=>x.row);
 }
 globalThis.AetherSpotlightSearch={compile,rank,fold,editOne};
})();
