/* Actual extension, fictional course names, native and nested scroll paths. */
const path=require('node:path');
module.exports=async({page,test,go,reportDir,assert})=>{
 const prepare=async()=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});await go('Overview',true);
  if(await page.locator('.ae-motion-btn').getAttribute('aria-pressed')==='false')await page.locator('.ae-motion-btn').click();
  await page.waitForFunction(()=>!document.documentElement.classList.contains('aether-reduced-motion'));await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const main=document.querySelector('main#content');main.style.height='650px';main.style.overflowY='auto';document.querySelector('#aether-workspace').style.paddingBottom='1200px';});
 };
 const position=async(where)=>{
  await page.evaluate(where=>{
   const main=document.querySelector('main#content'),card=document.querySelector('.ae-course-card'),view=main.getBoundingClientRect(),r=card.getBoundingClientRect();
   const y=where==='enter'?view.bottom-220:where==='leave'?view.top+220-r.height:view.top+220;
   main.scrollTop+=r.top-y;
  },where);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForFunction(()=>document.querySelector('.ae-course-card')?.hasAttribute('data-ae-dissolve')===true);
 };
 await test('Course dissolve: nested scroll scatters titles, reverses and keeps native links',async()=>{
  await prepare();const card=page.locator('.ae-course-card').first(),link=card.locator('.ae-course-link'),title=await card.locator('.ae-card-name').textContent(),href=await link.getAttribute('href');
  await position('enter');const entry=Number(await card.getAttribute('data-ae-dissolve'));assert(entry>.2&&entry<.8);
  const dots=card.locator('.ae-course-particles');assert(await dots.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0);}));
  assert.equal(await dots.getAttribute('aria-hidden'),'true');assert.equal(await dots.evaluate(c=>getComputedStyle(c).pointerEvents),'none');assert.equal(await card.locator('.ae-card-name').textContent(),title);assert.equal(await link.getAttribute('href'),href);
  await page.screenshot({path:path.join(reportDir,'courses-dissolve-enter.png')});
  await page.evaluate(()=>document.querySelector('main#content').scrollTop+=190);
  await page.waitForFunction(()=>!document.querySelector('.ae-course-card').hasAttribute('data-ae-dissolve'));
  assert.equal(await card.evaluate(c=>getComputedStyle(c).opacity),'1');
  await position('leave');assert(Number(await card.getAttribute('data-ae-dissolve'))>.2);
  await position('enter');assert(Math.abs(Number(await card.getAttribute('data-ae-dissolve'))-entry)<.03);
  assert.equal(await card.locator('.ae-course-particles').count(),1);
 });
 await test('Course dissolve: keyboard focus restores a fading title and course navigation',async()=>{
  await prepare();await position('enter');const card=page.locator('.ae-course-card').first(),link=card.locator('.ae-course-link');
  await link.evaluate(a=>a.focus({preventScroll:true}));
  assert.equal(await card.evaluate(c=>getComputedStyle(c).opacity),'1');assert.equal(await card.locator('.ae-course-title-ink').evaluate(c=>getComputedStyle(c).opacity),'1');
  await page.keyboard.press('Enter');await page.waitForURL('**/portal/site/cs200');await page.locator('.ae-tool-link').first().waitFor();
 });
 await test('Course dissolve: Motion Off, OS preference and reorder show solid readable cards',async()=>{
  await prepare();await position('enter');await page.locator('.ae-motion-btn').evaluate(b=>b.click());
  await page.waitForFunction(()=>!document.querySelector('.ae-course-card').hasAttribute('data-ae-dissolve'));
  const opacity=()=>page.locator('.ae-course-card').first().evaluate(c=>getComputedStyle(c).opacity);
  assert.equal(await opacity(),'1');await page.locator('.ae-motion-btn').evaluate(b=>b.click());
  await page.waitForFunction(()=>document.querySelector('.ae-course-card').hasAttribute('data-ae-dissolve'));
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('html.aether-reduced-motion').waitFor();assert.equal(await opacity(),'1');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.ae-courses .ae-customize').evaluate(b=>b.click());
  await page.locator('.ae-course-deck[data-edit="true"]').waitFor();assert.equal(await opacity(),'1');
  const first=await page.locator('.ae-course-card').first().getAttribute('data-key');await page.locator('.ae-course-card').first().getByRole('button',{name:'Move shortcut later'}).click();
  assert.notEqual(await page.locator('.ae-course-card').first().getAttribute('data-key'),first);
  await page.locator('.ae-courses .ae-customize').click();await page.locator('.ae-course-deck[data-edit="false"]').waitFor();await page.emulateMedia({reducedMotion:'reduce'});
 });
 await test('Course dissolve: document scroll and mobile wrapping re-sample without extra canvases',async()=>{
  await prepare();await page.evaluate(()=>{const main=document.querySelector('main#content');main.style.height='auto';main.style.overflowY='visible';});
  await page.evaluate(()=>{const title=document.querySelector('.ae-course-card .ae-course-title-ink');title.textContent='Advanced Computing and Distributed Systems';});
  await page.setViewportSize({width:375,height:700});
  await page.evaluate(()=>{const card=document.querySelector('.ae-course-card'),y=card.getBoundingClientRect().top+scrollY;window.scrollTo(0,y-innerHeight+220);});
  await page.waitForFunction(()=>document.querySelector('.ae-course-card').hasAttribute('data-ae-dissolve'));
  assert.equal(await page.locator('.ae-course-card').first().locator('.ae-course-particles').count(),1);
  assert(await page.locator('.ae-course-card').first().locator('.ae-course-particles').evaluate(c=>c.width>0&&c.height>50));
  assert(await page.locator('.ae-course-card').first().locator('.ae-card-name').evaluate(c=>c.clientHeight>parseFloat(getComputedStyle(c).lineHeight)*1.5));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Particles must not add horizontal scrolling');
  await page.screenshot({path:path.join(reportDir,'courses-dissolve-mobile.png')});
  await page.evaluate(()=>window.scrollBy(0,210));await page.waitForFunction(()=>!document.querySelector('.ae-course-card').hasAttribute('data-ae-dissolve'));
  await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 });
 await test('Course dissolve: live unpinning replaces decorated cards without duplicates',async()=>{
  await prepare();await position('enter');assert(await page.locator('.ae-course-particles').count()>0);
  await page.evaluate(()=>document.querySelector('#toolMenu li[data-type="pinned"]').dataset.type='recent');
  await page.waitForFunction(()=>document.querySelectorAll('.ae-course-card').length===2);
  assert.equal(await page.locator('.ae-course-link[href$="/cs200"]').count(),0);
  await page.evaluate(()=>document.querySelectorAll('#toolMenu li[data-type="pinned"]').forEach(row=>row.dataset.type='recent'));
  await page.locator('.ae-courses-empty').waitFor();assert.equal(await page.locator('.ae-course-particles').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
 });
};
