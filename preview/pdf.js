let task=null,pdf=null,renderTask=null,pageNumber=1,busy=false,zoom=1,redrawPending=false,resizeFrame=0,disposed=false;
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),parentOrigin=params.get('origin');
const status=document.querySelector('#status'),pages=document.querySelector('#pages'),canvas=document.querySelector('#page'),count=document.querySelector('#count'),prev=document.querySelector('#prev'),next=document.querySelector('#next');
const paper=document.querySelector('#paper'),fit=document.querySelector('#fit'),zoomIn=document.querySelector('#zoom-in'),zoomOut=document.querySelector('#zoom-out'),zoomLabel=document.querySelector('#zoom');
const send=data=>parent.postMessage({...data,type:'aether-pdf-preview',token},parentOrigin);
function fail(message){status.hidden=false;status.textContent=message;pages.hidden=true;send({state:'error',message});}
async function draw(number){if(disposed||!pdf)return;if(busy){redrawPending=true;return;}busy=true;prev.disabled=next.disabled=true;
 try{const page=await pdf.getPage(number),base=page.getViewport({scale:1});
  const fitScale=Math.min((paper.clientWidth-6)/base.width,fit.value==='width'?Infinity:(paper.clientHeight-6)/base.height),dpr=Math.min(devicePixelRatio||1,1.5);
  const scale=Math.max(.01,Math.min(fitScale*zoom,3,Math.sqrt(16000000/(base.width*base.height*dpr*dpr)))),view=page.getViewport({scale});
  canvas.width=Math.round(view.width*dpr);canvas.height=Math.round(view.height*dpr);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
  renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:dpr===1?null:[dpr,0,0,dpr,0,0],annotationMode:0});await renderTask.promise;pageNumber=number;canvas.setAttribute('aria-label','PDF page '+number+' of '+pdf.numPages);count.textContent=number+' / '+pdf.numPages;send({state:'rendered',page:number,pages:pdf.numPages});
 }catch(error){if(error.name!=='RenderingCancelledException')fail('This PDF cannot be previewed. Open the original resource.');}
 finally{busy=false;if(pdf){prev.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;}if(redrawPending){redrawPending=false;scheduleDraw();}}
}
function scheduleDraw(){if(disposed||resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;draw(pageNumber);});}
function setZoom(value){zoom=Math.max(.5,Math.min(3,value));zoomLabel.textContent=Math.round(zoom*100)+'%';zoomOut.disabled=zoom<=.5;zoomIn.disabled=zoom>=3;scheduleDraw();}
zoomIn.onclick=()=>setZoom(zoom+.25);zoomOut.onclick=()=>setZoom(zoom-.25);fit.onchange=()=>setZoom(1);
const sizeObserver=new ResizeObserver(scheduleDraw);sizeObserver.observe(paper);
prev.addEventListener('click',()=>draw(pageNumber-1));next.addEventListener('click',()=>draw(pageNumber+1));
window.addEventListener('keydown',e=>{if(e.key==='Escape')send({state:'close'});else if(e.key==='ArrowRight'&&!next.disabled)draw(pageNumber+1);else if(e.key==='ArrowLeft'&&!prev.disabled)draw(pageNumber-1);});
window.addEventListener('message',async e=>{
 let portalFrame=false;try{portalFrame=e.source===parent||e.source?.top===parent;}catch{}
 if(!portalFrame||e.origin!==parentOrigin||e.data?.type!=='aether-pdf-data'||e.data.token!==token||task||!(e.data.bytes instanceof ArrayBuffer))return;
 try{const lib=await import('../vendor/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const root=new URL('../vendor/pdfjs/',import.meta.url).href;
  task=lib.getDocument({data:new Uint8Array(e.data.bytes),isEvalSupported:false,enableXfa:false,useWasm:true,cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/',maxImageSize:16000000,canvasMaxAreaInBytes:16000000,verbosity:0});
  task.onPassword=()=>{fail('Password-protected PDF. Open the original resource to continue.');task.destroy();};
  pdf=await task.promise;status.hidden=true;pages.hidden=false;await new Promise(requestAnimationFrame);await draw(1);
 }catch(error){fail('This PDF cannot be previewed. Open the original resource.');}
});
window.addEventListener('pagehide',()=>{disposed=true;sizeObserver.disconnect();cancelAnimationFrame(resizeFrame);renderTask?.cancel();task?.destroy();});
if(parentOrigin==='https://lms.lums.edu.pk'&&token)send({state:'ready'});
