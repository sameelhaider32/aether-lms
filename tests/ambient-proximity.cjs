/* Freeze scene time while exercising real pointer events and proximity settling. */
module.exports=async({page,context,go,assert})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await go('Overview',true);
 const button=page.locator('.ae-motion-btn');if(await button.getAttribute('aria-pressed')==='true')await button.click();
 const cdp=await context.newCDPSession(page),worlds=[];cdp.on('Runtime.executionContextCreated',e=>worlds.push(e.context));await cdp.send('Runtime.enable');let world;
 for(const candidate of worlds){const r=await cdp.send('Runtime.evaluate',{contextId:candidate.id,expression:'typeof AetherAmbient!=="undefined"&&typeof AetherMotion!=="undefined"',returnByValue:true});if(r.result.value){world=candidate.id;break;}}assert(world,'extension content world');
 const evaluate=expression=>cdp.send('Runtime.evaluate',{contextId:world,expression,returnByValue:true});
 try{
  await evaluate('globalThis.fixtureSubscribe=AetherMotion.subscribe;AetherMotion.subscribe=function(fn,interval){if(interval===40||interval===80){globalThis.fixtureAmbientTick=fn;return ()=>{globalThis.fixtureAmbientTick=null}}return fixtureSubscribe(fn,interval)}');
  await button.click();assert((await evaluate('typeof fixtureAmbientTick==="function"')).result.value,'ambient callback captured');
  const settle=()=>evaluate('for(let i=0;i<60;i++)fixtureAmbientTick(0,0)');
  await page.mouse.move(1438,998);await settle();
  const canvas=page.locator('.ae-global-canvas'),point=await canvas.evaluate(c=>{const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);let best={x:100,y:100,alpha:0};for(let y=60;y<400;y++)for(let x=50;x<450;x++){const i=(y*c.width+x)*4;if(data[i+3]>best.alpha)best={x,y,alpha:data[i+3]};}return best;});
  const brightness=()=>canvas.evaluate((c,p)=>{const {data}=c.getContext('2d').getImageData(Math.max(0,p.x-45),Math.max(0,p.y-45),90,90);let total=0;for(let i=3;i<data.length;i+=4)total+=data[i];return total;},point),before=await brightness();
  const size=await canvas.evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}));await page.mouse.move(point.x*size.cssWidth/size.width,point.y*size.cssHeight/size.height);await settle();const after=await brightness();assert(after>before*1.15,`Settled glow did not increase: ${before} -> ${after}`);
  await button.click();const still=await canvas.evaluate(c=>c.toDataURL());await page.waitForTimeout(160);assert.equal(await canvas.evaluate(c=>c.toDataURL()),still);
 }finally{await evaluate('if(globalThis.fixtureSubscribe)AetherMotion.subscribe=fixtureSubscribe;delete globalThis.fixtureSubscribe;delete globalThis.fixtureAmbientTick');await cdp.detach();await page.emulateMedia({reducedMotion:'reduce'});}
};
