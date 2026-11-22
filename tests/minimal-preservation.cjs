/* Optional comparison with a retained 2.0 checkout. Never navigates the live LMS. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {fixture,origin,route}=require('./fixtures.cjs'),candidate=path.resolve(__dirname,'..'),baseline=process.env.AETHER_BASELINE,out=path.join(candidate,'reports/minimal/preservation');
if(!baseline)throw Error('Set AETHER_BASELINE to the retained 2.0 checkout.');assert.equal(JSON.parse(fs.readFileSync(path.join(baseline,'manifest.json'))).version,'2.0.0','Use the retained 2.0 baseline, not the deployed upgrade.');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const data={};
 for(const [label,extension]of [['baseline',baseline],['candidate',candidate]]){
  const c=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'aether-preservation-')),{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--load-extension=${extension}`,`--disable-extensions-except=${extension}`],reducedMotion:'reduce'});
  try{
   await require('./extension-ready.cjs')(c,extension);
   await c.route('https://**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-preservation'}});if(u.pathname.startsWith('/direct/'))return r.fulfill({json:{}});return r.fulfill({contentType:'text/html',body:fixture(u.href)});});
   const p=await c.newPage();data[label]=[];
   for(const width of [390,1440])for(const theme of ['aether','monochrome'])for(const view of ['home','resources']){
    await p.setViewportSize({width,height:1000});await p.goto(view==='home'?origin+'/portal/site/home':route('Resources'),{waitUntil:'domcontentloaded'});await p.locator('#aether-theme-select').waitFor();await p.selectOption('#aether-theme-select',theme);await p.locator(view==='home'?'.ae-course-card':'#records .ae-record-card').first().waitFor();if(view==='home')await p.waitForFunction(()=>document.querySelector('#aether-mission-control')?.dataset.loading==='false'&&[...document.querySelectorAll('.mc-source-list li')].some(n=>n.textContent.startsWith('Coverage')));await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const selectors=['.portal-header','#toolMenu','#aether-workspace','.ae-hero',...(view==='home'?['#aether-course-dock','.ae-course-deck','.ae-course-card']:['#records'])];
    const values=await p.evaluate(selectors=>Object.fromEntries(selectors.map(s=>{const n=document.querySelector(s),r=n.getBoundingClientRect(),c=getComputedStyle(n);return [s,{box:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10),font:c.fontFamily,color:c.color,background:c.backgroundColor}];})),selectors);
    const key=`${theme}-${width}-${view}`;data[label].push({key,values});await p.screenshot({path:path.join(out,`${label}-${key}.png`)});
   }
  }finally{await c.close();}
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(data,null,2));
 for(const row of data.baseline)assert.deepEqual(data.candidate.find(r=>r.key===row.key).values,row.values,`Existing preset changed: ${row.key}`);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(data,null,2));console.log('PASS Original/Monochrome match retained 2.0 geometry, fonts and surface colors in eight matching views');
})().catch(e=>{console.error(e);process.exitCode=1;});
