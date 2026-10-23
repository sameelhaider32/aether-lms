let task=null,pdf=null,renderTask=null,pageNumber=1,requestedPage=1,busy=false,zoom=1,redrawPending=false,resizeFrame=0,drawTimeout=0,disposed=false,received=false,phase='idle';
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),parentOrigin=params.get('origin');
const status=document.querySelector('#status'),pages=document.querySelector('#pages'),canvas=document.querySelector('#page'),count=document.querySelector('#count'),prev=document.querySelector('#prev'),next=document.querySelector('#next');
const paper=document.querySelector('#paper'),fit=document.querySelector('#fit'),zoomIn=document.querySelector('#zoom-in'),zoomOut=document.querySelector('#zoom-out'),zoomLabel=document.querySelector('#zoom');
const alive=()=>!disposed&&phase!=='error';
const send=data=>{if(!disposed)parent.postMessage({...data,type:'aether-pdf-preview',token},parentOrigin);};
function release(){
 sizeObserver.disconnect();cancelAnimationFrame(resizeFrame);clearTimeout(drawTimeout);resizeFrame=0;redrawPending=false;
 const rendering=renderTask;renderTask=null;try{rendering?.cancel();}catch{}
 const loading=task;task=null;pdf=null;try{Promise.resolve(loading?.destroy()).catch(()=>{});}catch{}
 canvas.width=canvas.height=0;
}
function fail(message){if(!alive())return;phase='error';release();status.hidden=false;status.textContent=message;pages.hidden=true;prev.disabled=next.disabled=true;send({state:'error',message});}
async function draw(number){
 if(!alive()||!pdf)return;requestedPage=Math.max(1,Math.min(number,pdf.numPages));if(busy){redrawPending=true;return;}
 busy=true;phase='rendering';prev.disabled=next.disabled=true;const documentTask=pdf,target=requestedPage;drawTimeout=setTimeout(()=>fail('This PDF page took too long to render. Retry preview or open the original resource.'),20000);
 try{
  const page=await documentTask.getPage(target);if(!alive()||pdf!==documentTask)return;
  const base=page.getViewport({scale:1}),fitScale=Math.min((paper.clientWidth-6)/base.width,fit.value==='width'?Infinity:(paper.clientHeight-6)/base.height),dpr=Math.min(devicePixelRatio||1,1.5);
  const scale=Math.max(.01,Math.min(fitScale*zoom,3,Math.sqrt(16000000/(base.width*base.height*dpr*dpr)))),view=page.getViewport({scale});
  canvas.width=Math.max(1,Math.round(view.width*dpr));canvas.height=Math.max(1,Math.round(view.height*dpr));canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
  const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');
  const rendering=renderTask=page.render({canvasContext:context,viewport:view,transform:dpr===1?null:[dpr,0,0,dpr,0,0],annotationMode:0});await rendering.promise;
  if(!alive()||pdf!==documentTask)return;renderTask=null;pageNumber=target;phase='ready';canvas.setAttribute('aria-label','PDF page '+target+' of '+pdf.numPages);count.textContent=target+' / '+pdf.numPages;send({state:'rendered',page:target,pages:pdf.numPages});
 }catch(error){if(alive()&&error.name!=='RenderingCancelledException')fail('This PDF cannot be rendered in this browser. Open the original resource.');}
 finally{clearTimeout(drawTimeout);busy=false;if(alive()&&pdf){prev.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;if(redrawPending){redrawPending=false;scheduleDraw();}}}
}
function scheduleDraw(){if(!alive()||resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;draw(requestedPage);});}
function setZoom(value){if(!alive())return;zoom=Math.max(.5,Math.min(3,value));zoomLabel.textContent=Math.round(zoom*100)+'%';zoomOut.disabled=zoom<=.5;zoomIn.disabled=zoom>=3;scheduleDraw();}
zoomIn.onclick=()=>setZoom(zoom+.25);zoomOut.onclick=()=>setZoom(zoom-.25);fit.onchange=()=>setZoom(1);
const sizeObserver=new ResizeObserver(scheduleDraw);sizeObserver.observe(paper);
prev.disabled=next.disabled=true;
prev.addEventListener('click',()=>draw(pageNumber-1));next.addEventListener('click',()=>draw(pageNumber+1));
window.addEventListener('keydown',e=>{if(e.key==='Escape')send({state:'close'});else if(e.key==='ArrowRight'&&!next.disabled)draw(pageNumber+1);else if(e.key==='ArrowLeft'&&!prev.disabled)draw(pageNumber-1);});
window.addEventListener('message',async e=>{
 let portalFrame=false;try{portalFrame=e.source===parent||e.source?.top===parent;}catch{}
 if(!alive()||received||!portalFrame||e.origin!==parentOrigin||parentOrigin!=='https://lms.lums.edu.pk'||!token||e.data?.type!=='aether-pdf-data'||e.data.token!==token||!(e.data.bytes instanceof ArrayBuffer))return;
 received=true;phase='loading';
 try{
  const lib=await import('../vendor/pdfjs/pdf.min.mjs');if(!alive())return;lib.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const root=new URL('../vendor/pdfjs/',import.meta.url).href;
  const loading=task=lib.getDocument({data:new Uint8Array(e.data.bytes),isEvalSupported:false,enableScripting:false,enableXfa:false,useWasm:true,cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/',maxImageSize:16000000,canvasMaxAreaInBytes:16000000,verbosity:0});
  loading.onPassword=()=>fail('Password-protected PDF. Open the original resource to continue.');
  const documentTask=await loading.promise;if(!alive()||task!==loading)return;pdf=documentTask;phase='ready';status.hidden=true;pages.hidden=false;
  await new Promise(requestAnimationFrame);if(!alive()||task!==loading)return;await draw(1);
 }catch(error){if(alive())fail(error.name==='PasswordException'?'Password-protected PDF. Open the original resource to continue.':'This PDF cannot be parsed or is unsupported. Open the original resource.');}
});
window.addEventListener('pagehide',()=>{if(disposed)return;disposed=true;phase='closed';release();});
if(parentOrigin==='https://lms.lums.edu.pk'&&token)send({state:'ready'});
