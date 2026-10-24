/* One focused smoke against the installed extension and actual Sakai-era Chart.js.
   Test-only upstream fixture, hash pinned; never shipped with the extension. */
const {chromium}=require('playwright');
const {fixture,origin,route}=require('./fixtures.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
(async()=>{
 const source=process.env.AETHER_CHARTJS_2_FIXTURE ? fs.readFileSync(process.env.AETHER_CHARTJS_2_FIXTURE) :
  Buffer.from(await (await fetch('https://raw.githubusercontent.com/chartjs/Chart.js/v2.7.0/dist/Chart.js')).arrayBuffer());
 assert.equal(createHash('sha256').update(source).digest('hex'),'3ecd297f831ae5d53ecd22349be4a9c2afbd404e448cbe72b7475f5863c4ba04');
 const extension=path.resolve(process.env.AETHER_EXTENSION||path.join(__dirname,'..'));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'aether-chart-smoke-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,
  ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
  viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 try{
  await context.route('https://**/*',r=>{
   const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();
   if(u.pathname.endsWith('.png'))return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(extension,'icons/aether-48.png'))});
   if(u.pathname==='/direct/session/current.json')return r.fulfill({json:{userId:'fictional-chart-user'}});
   return r.fulfill({contentType:'text/html',body:fixture(u.href)});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  for(const legacy of [true,false]){
   await page.goto(route('Gradebook student',legacy?'&legacyStats=1':''));
   await page.locator('html.ae-academic-surface').waitFor();
   await page.locator('#grade-item-0 .gb-summary-grade-stats').click();
   // Library and chart are deliberately created after the dynamic popup exists.
   await page.addScriptTag({content:source.toString('utf8')});
   await page.evaluate(()=>{
    const nativeColors=['#15597e','#5bc0de','#15597e'];
    const config=()=>({type:'bar',data:{labels:['0–10','10–20','20–30'],datasets:[{data:[2,8,4],backgroundColor:nativeColors,borderWidth:0}]},
     options:{responsive:false,animation:{duration:0},legend:{display:false},title:{display:true,text:'Fictional distribution',fontColor:'#eeeeee'},
      scales:{xAxes:[{ticks:{fontColor:'#888888'},scaleLabel:{display:true,labelString:'Grade interval',fontColor:'#dddddd'},gridLines:{color:'#cccccc'}}],
       yAxes:[{ticks:{beginAtZero:true,fontColor:'#777777',callback:v=>v},scaleLabel:{display:true,labelString:'Students',fontColor:'#cccccc'},gridLines:{color:'#bbbbbb'}}]},
      tooltips:{callbacks:{title:items=>'Students: '+items[0].yLabel,afterTitle:items=>items[0].index===1?'Your grade':''}}}});
    window.statsChart=new Chart(window.fixtureStatsCanvas,config());
    const outside=document.createElement('canvas');document.body.append(outside);window.otherChart=new Chart(outside,config());
    window.nativeColors=nativeColors;window.nativeTooltip=statsChart.options.tooltips.callbacks;
    window.nativeTick=statsChart.options.scales.yAxes[0].ticks.callback;
    window.chartColorSnapshot=c=>JSON.stringify({title:c.options.title.fontColor,axes:[...c.options.scales.xAxes,...c.options.scales.yAxes].map(a=>[a.ticks.fontColor,a.scaleLabel.fontColor,a.gridLines.color,a.gridLines.zeroLineColor]),bars:c.data.datasets[0].backgroundColor});
   });
   await page.waitForFunction(()=>statsChart.data.datasets[0].backgroundColor[0]==='#329d79');
   assert.equal(await page.locator('[role="dialog"] canvas').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   const themed=await page.evaluate(()=>({
    colors:statsChart.data.datasets[0].backgroundColor,title:statsChart.titleBlock.options.fontColor,
    axes:[...statsChart.options.scales.xAxes,...statsChart.options.scales.yAxes].map(a=>[a.ticks.fontColor,a.scaleLabel.fontColor,a.gridLines.color]),
    pixels:statsChart.getDatasetMeta(0).data.map(bar=>{const m=bar._model;return [...statsChart.ctx.getImageData(Math.round(m.x),Math.round((m.y+m.base)/2),1,1).data];}),
    untouched:otherChart.data.datasets[0].backgroundColor===nativeColors,
    identity:statsChart.canvas===fixtureStatsCanvas,callbacks:statsChart.options.tooltips.callbacks===nativeTooltip&&statsChart.options.scales.yAxes[0].ticks.callback===nativeTick
   }));
   assert.deepEqual(themed.colors,['#329d79','#9df8d6','#329d79']);assert.equal(themed.title,'#9df8d6');
   assert(themed.axes.every(a=>a[0]==='#a7cfbd'&&a[1]==='#9df8d6'&&a[2]==='rgba(88,143,116,0.14)'));
   assert.deepEqual(themed.pixels,[[50,157,121,255],[157,248,214,255],[50,157,121,255]]);
   assert(themed.untouched&&themed.identity&&themed.callbacks);
   await page.evaluate(()=>document.querySelector('#aether-native-toggle').click());
   await page.waitForFunction(()=>statsChart.data.datasets[0].backgroundColor===nativeColors);
   const original=await page.evaluate(()=>chartColorSnapshot(statsChart));
   assert.deepEqual(JSON.parse(original).bars,['#15597e','#5bc0de','#15597e']);
   assert.deepEqual(JSON.parse(original).axes.map(a=>a.slice(0,3)),[['#888888','#dddddd','#cccccc'],['#777777','#cccccc','#bbbbbb']]);
   assert.equal(JSON.parse(original).title,'#eeeeee');
   await page.evaluate(()=>document.querySelector('#aether-native-toggle').click());
   await page.waitForFunction(()=>statsChart.data.datasets[0].backgroundColor[1]==='#9df8d6');
   // A native renderChartData-style replacement keeps its new highlighted range.
   await page.evaluate(()=>{statsChart.data={labels:['0–10','10–20','20–30'],datasets:[{data:[3,6,2],backgroundColor:['#5bc0de','#15597e','#15597e']}]};statsChart.update(0);});
   assert.deepEqual(await page.evaluate(()=>statsChart.data.datasets[0].backgroundColor),['#9df8d6','#329d79','#329d79']);
   await page.evaluate(()=>{statsChart.destroy();otherChart.destroy();});
   await page.getByRole('button',{name:'Done',exact:true}).click();
  }
  assert.deepEqual(errors,[]);console.log('PASS Chart.js 2.7 statistics: real rendered colors, highlight, labels, native OFF restoration, late initialization and both modal variants');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
