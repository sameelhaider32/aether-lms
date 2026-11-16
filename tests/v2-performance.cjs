const activeBrowsers=new Set();
/* Comparable native/current/final desktop measurements. Fictional intercepted LMS only. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=process.env.AETHER_EXTENSION||path.resolve(__dirname,'..'),{fixture,pdf,origin,route}=require(path.join(root,'tests/fixtures.cjs'));
const out=process.env.AETHER_REPORT_DIR||path.join(root,'reports/v2'),label=process.argv[2]||'baseline',samples=Number(process.env.AETHER_PERF_SAMPLES||3);fs.mkdirSync(out,{recursive:true});
const pctl=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.floor(b.length*p))]:0;};
function html(u){let h=fixture(u.href);if(u.searchParams.get('tool')==='Resources'){const base=h.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];if(base){const row=base.match(/<tr id="resource-2"[\s\S]*?<\/tr>/)?.[0];if(row)h=h.replace(base,Array.from({length:300},(_,i)=>row.replaceAll('resource-2','resource-'+i).replaceAll('notes.txt','Lecture '+String(i+1).padStart(3,'0')+'.txt')).join(''));}}return h;}
async function metrics(cdp){return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));}
(async()=>{
 const results=[];
 for(const mode of ['native','full','motion-off']){
  const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-perf-')),{channel:'chromium',executablePath:process.env.AETHER_CHROMIUM,headless:true,viewport:{width:1440,height:1000},reducedMotion:'no-preference',ignoreDefaultArgs:['--disable-extensions'],args:mode==='native'?[]:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
  activeBrowsers.add(ctx);let requests=[];await ctx.route('https://**/*',async r=>{const u=new URL(r.request().url());requests.push({t:Date.now(),url:u.pathname});if(u.origin!==origin)return r.abort();if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-performance'}});if(u.pathname==='/direct/site.json')return r.fulfill({json:{site_collection:[{id:'cs200',title:'Distributed Systems',type:'course'}]}});if(u.pathname.startsWith('/direct/calendar/'))return r.fulfill({json:{calendar_collection:[]}});if(u.pathname.startsWith('/direct/announcement/'))return r.fulfill({json:{announcement_collection:[]}});if(u.pathname.startsWith('/direct/content/')){const id=decodeURIComponent(u.pathname.slice('/direct/content/resources'.length).replace(/\.json$/,''))+'/';return r.fulfill({json:{content_collection:[{resourceId:id,resourceChildren:[]}]}});}if(u.pathname.startsWith('/access/content/'))return r.fulfill({contentType:'text/plain',body:'Fictional performance preview'});return r.fulfill({contentType:'text/html',body:html(u)});});
  await ctx.addInitScript(({motion})=>{
   try{localStorage.setItem('aether:v02:enabled','true');localStorage.setItem('aether:v02:motion',motion?'true':'false');}catch{}
   const data=window.__perf={frames:[],long:[],events:[],cls:0,ready:0,changes:0};
   for(const type of ['longtask','event','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='longtask')data.long.push({start:e.startTime,duration:e.duration});else if(type==='event')data.events.push({name:e.name,duration:e.duration,delay:e.processingStart-e.startTime});else if(!e.hadRecentInput)data.cls+=e.value;}}).observe({type,buffered:true,durationThreshold:16});}catch{}
   let prior=0;function frame(t){if(prior)data.frames.push(t-prior);prior=t;if(t<6000)requestAnimationFrame(frame);}requestAnimationFrame(frame);
   new MutationObserver(records=>{data.changes+=records.length;if(!data.ready&&document.querySelector('#aether-spotlight-trigger')&&document.querySelector('#aether-workspace'))data.ready=performance.now();}).observe(document,{subtree:true,childList:true});
  },{motion:mode!=='motion-off'});
  const page=await ctx.newPage(),cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
  for(const view of ['home','resources']){
   // First navigation warms browser code/font/HTTP paths; measurements use subsequent documents.
   const url=view==='home'?origin+'/portal/site/home':route('Resources');await page.goto(url);await page.waitForTimeout(900);
   for(let sample=0;sample<samples;sample++){
    requests=[];if(mode==='full'&&view==='resources'&&sample===0)await cdp.send('Profiler.start');
    await page.goto(url);if(mode!=='native')await page.locator('#aether-spotlight-trigger').waitFor();await page.waitForTimeout(650);
    const first=await metrics(cdp);await page.mouse.move(1100,700);for(let i=0;i<6;i++){await page.mouse.wheel(0,i%2?300:500);await page.waitForTimeout(65);}
    let spotlight=null,preview=null;
    if(mode!=='native'){
     await page.evaluate(()=>{window.__openStart=performance.now();document.querySelector('#aether-spotlight-trigger').click();});await page.locator('#aether-spotlight[open]').waitFor();spotlight=await page.evaluate(()=>performance.now()-window.__openStart);
     await page.locator('#ae-spot-input').fill('resources');await page.keyboard.press('Escape');
     if(view==='resources'){await page.locator('[data-ae-preview-open]').first().evaluate(b=>{window.__previewStart=performance.now();b.click();});await page.locator('.ae-preview-text').waitFor();preview=await page.evaluate(()=>performance.now()-window.__previewStart);await page.keyboard.press('Escape');}
    }
    await page.waitForTimeout(500);const idleAt=Date.now();await page.waitForTimeout(500);const after=await metrics(cdp),data=await page.evaluate(()=>({...window.__perf,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,dpr:devicePixelRatio,motion:document.documentElement.classList.contains('aether-reduced-motion')}));
    if(mode==='full'&&view==='resources'&&sample===0){const profile=(await cdp.send('Profiler.stop')).profile;fs.writeFileSync(path.join(out,label+'-resources.cpuprofile'),JSON.stringify(profile));}
    await cdp.send('HeapProfiler.collectGarbage');const gc=await metrics(cdp);
    const row={mode,view,sample,usableMs:data.ready||data.dcl,fcpMs:data.fcp,dclMs:data.dcl,scriptMs:after.ScriptDuration*1000,layoutMs:after.LayoutDuration*1000,longTasks:data.long.length,longTaskMs:data.long.reduce((n,x)=>n+x.duration,0),longestTaskMs:Math.max(0,...data.long.map(x=>x.duration)),frameP50:pctl(data.frames,.5),frameP95:pctl(data.frames,.95),frameOver25Pct:100*data.frames.filter(x=>x>25).length/data.frames.length,approxEventMaxMs:Math.max(0,...data.events.map(x=>x.duration)),inputDelayMaxMs:Math.max(0,...data.events.map(x=>x.delay)),cls:data.cls,spotlightMs:spotlight,previewMs:preview,heapAfterGC:gc.JSHeapUsedSize,nodes:gc.Nodes,listeners:gc.JSEventListeners,idle500msRequests:requests.filter(r=>r.t>=idleAt).length,totalRequests:requests.length,mutationRecords:data.changes,dpr:data.dpr,motionOff:data.motion};results.push(row);console.log(JSON.stringify(row));
    if(sample===0)await page.screenshot({path:path.join(out,`${label}-${mode}-${view}.png`)});
   }
  }
  await ctx.close();activeBrowsers.delete(ctx);
 }
 const summary=[];for(const mode of ['native','full','motion-off'])for(const view of ['home','resources']){const rows=results.filter(x=>x.mode===mode&&x.view===view),row={mode,view};for(const key of Object.keys(rows[0]).filter(k=>typeof rows[0][k]==='number'&&k!=='sample'))row[key]=pctl(rows.map(r=>r[key]),.5);summary.push(row);}
 fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify({label,date:new Date().toISOString(),environment:{chromium:process.env.AETHER_CHROMIUM,viewport:[1440,1000],resources:300,samples,note:'Fictional local responses, headless desktop, no CPU throttle. Whole-page metrics, not field INP. GC heap is renderer JS only; no claim of GPU/process memory.'},results,summary},null,2));console.log('SUMMARY',JSON.stringify(summary));
})().catch(async e=>{console.error(e);await Promise.allSettled([...activeBrowsers].map(ctx=>ctx.close()));process.exitCode=1;});
