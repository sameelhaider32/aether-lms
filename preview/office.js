/* Local-only Office reader. File data arrives over a source/token checked channel. */
const params=new URLSearchParams(location.hash.slice(1)),token=params.get('token'),parentOrigin=params.get('origin');
const container=document.querySelector('#document'),status=document.querySelector('#reader-status'),previous=document.querySelector('#previous'),next=document.querySelector('#next'),count=document.querySelector('#count'),sheet=document.querySelector('#sheet'),note=document.querySelector('#reader-note');
let received=false,viewer=null,book=null,page=0,kind='',busy=false,disposed=false,slideErrors=false,failed=false,turnTimeout=0;
const send=data=>parent.postMessage({...data,type:'aether-office-preview',token},parentOrigin);
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
function release(){clearTimeout(turnTimeout);const current=viewer;viewer=null;try{current?.destroy();}catch{}book=null;container.replaceChildren();}
function fail(message){if(disposed||failed)return;failed=true;release();previous.disabled=next.disabled=true;status.hidden=false;status.textContent=message;send({state:'error',message});}
function rendered(){if(disposed||failed)return;status.hidden=true;container.dataset.kind=kind;send({state:'rendered',page:page+1,kind});}
async function script(path,name){if(globalThis[name])return globalThis[name];await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,import.meta.url).href;s.onload=resolve;s.onerror=()=>reject(Error('The local document reader could not load. Open the original resource.'));document.head.append(s);});return globalThis[name];}
async function validateContents(data,entries){
 const zip=await globalThis.JSZip.loadAsync(data);let total=0;
 for(const entry of entries){
   if(disposed)return;
   if(entry.name.endsWith('/'))continue;const file=zip.file(entry.name);if(!file)throw Error('This archive is damaged. Open the original resource.');
   await new Promise((resolve,reject)=>{let size=0,failed=false;const stream=file.internalStream('uint8array');stream.on('data',chunk=>{size+=chunk.length;total+=chunk.length;if(disposed||size>entry.bytes||size>32*1024*1024||total>128*1024*1024){failed=true;stream.pause();reject(Error('This archive exceeds the preview limits. Open the original resource.'));}}).on('end',()=>{if(!failed){if(size!==entry.bytes)reject(Error('This archive is damaged. Open the original resource.'));else resolve();}}).on('error',reject).resume();});
 }
}
async function slides(data){
 const {PptxViewer}=await import('../vendor/office/aiden0z-pptx-renderer.browser.es.js');if(disposed)return;
 kind='presentation';container.dataset.kind=kind;
 const opened=await PptxViewer.open(data,container,{renderMode:'slide',fitMode:'contain',externalMedia:'block',lazySlides:true,lazyMedia:true,pdfjs:false,zipLimits:{maxEntries:4000,maxEntryUncompressedBytes:32*1024*1024,maxTotalUncompressedBytes:128*1024*1024,maxMediaBytes:96*1024*1024,maxConcurrency:4},onNodeError:()=>{if(disposed||failed)return;slideErrors=true;note.textContent='Some slide content could not be rendered. Open original for the full slide.';}});
 if(disposed||failed){opened.destroy();container.replaceChildren();return;}viewer=opened;if(!viewer.slideCount||viewer.slideCount>600)throw Error('This presentation exceeds the slide preview limit. Open the original resource.');
 count.textContent=`1 / ${viewer.slideCount}`;next.disabled=viewer.slideCount<=1;rendered();
}
async function turn(delta){if(disposed||failed||busy||!viewer)return;const target=page+delta;if(target<0||target>=viewer.slideCount)return;busy=true;previous.disabled=next.disabled=true;try{turnTimeout=setTimeout(()=>fail('This slide took too long to render. Retry preview or open the original resource.'),20000);await viewer.renderSlide(target);if(disposed||failed)return;page=target;count.textContent=`${page+1} / ${viewer.slideCount}`;rendered();}catch{fail('This slide cannot be previewed. Open the original resource.');}finally{clearTimeout(turnTimeout);busy=false;if(!disposed&&!failed&&viewer){previous.disabled=page===0;next.disabled=page>=viewer.slideCount-1;}}}
async function word(data){
 const docx=await script('../vendor/office/docx-preview.min.js','docx');if(disposed)return;
 kind='document';previous.hidden=next.hidden=true;count.textContent='Word document';
 await docx.renderAsync(data,container,null,{ignoreWidth:true,ignoreHeight:true,ignoreFonts:true,breakPages:true,renderAltChunks:false,renderComments:false,renderChanges:false,useBase64URL:true});if(disposed||failed){container.replaceChildren();return;}rendered();
}
function value(cell){const v=cell.value;if(v==null)return '';if(v instanceof Date)return v.toLocaleDateString();if(typeof v==='object'){if(v.richText)return v.richText.map(r=>r.text).join('');if('formula'in v||'sharedFormula'in v)return v.result==null?'Result not stored':String(v.result);if(v.text)return v.text;if(v.error)return v.error;}return cell.text||String(v);}
function columnName(n){let name='';while(n){n--;name=String.fromCharCode(65+n%26)+name;n=Math.floor(n/26);}return name;}
function worksheet(index){
 if(disposed||failed||!book)return;const visible=book.worksheets.filter(w=>w.state==='visible'),ws=visible[index];if(!ws)return;page=index;container.replaceChildren();
 const table=document.createElement('table');table.className='workbook';const caption=text('caption',ws.name),head=document.createElement('thead'),body=document.createElement('tbody'),header=document.createElement('tr');header.append(text('th','Row'));
 const columns=[];for(let c=1;c<=Math.min(ws.columnCount,50);c++)if(!ws.getColumn(c).hidden){columns.push(c);const h=text('th',columnName(c));h.scope='col';header.append(h);}head.append(header);
 for(let r=1;r<=Math.min(ws.rowCount,500);r++){const row=ws.getRow(r);if(row.hidden)continue;const tr=document.createElement('tr'),number=text('th',String(r));number.scope='row';number.className='row-number';tr.append(number);for(const c of columns)tr.append(text('td',value(row.getCell(c))));body.append(tr);}
 table.append(caption,head,body);container.append(table);count.textContent=`${index+1} / ${visible.length}`;
 note.textContent=ws.rowCount>500||ws.columnCount>50?'Showing the first 500 rows and 50 columns. Open original for the complete worksheet.':'Read-only values · Formulas use stored results.';rendered();
}
async function workbook(data){
 const ExcelJS=await script('../vendor/office/exceljs.min.js','ExcelJS');if(disposed)return;kind='workbook';book=new ExcelJS.Workbook();
 const loading=book;await loading.xlsx.load(data,{ignoreNodes:['dataValidations','drawing','picture','hyperlinks','extLst']});if(disposed||failed)return;
 const visible=book.worksheets.filter(w=>w.state==='visible');if(!visible.length)throw Error('This workbook has no visible worksheets. Open the original resource.');
 previous.hidden=next.hidden=true;document.querySelector('#sheet-label').hidden=false;visible.forEach((w,i)=>{const option=text('option',w.name);option.value=i;sheet.append(option);});sheet.onchange=()=>worksheet(Number(sheet.value));worksheet(0);
}
function archive(entries){kind='archive';previous.hidden=next.hidden=true;count.textContent=`${entries.length} entries`;const list=document.createElement('ul');list.className='archive-list';for(const entry of entries.slice(0,500)){const row=document.createElement('li');row.append(text('span',entry.name),text('small',`${Math.ceil(entry.bytes/1024)} KB`));list.append(row);}container.append(list);if(entries.length>500)note.textContent='Showing the first 500 archive entries. Open original for the complete archive.';rendered();}
previous.onclick=()=>turn(-1);next.onclick=()=>turn(1);
document.addEventListener('click',e=>{if(e.target.closest('a,form')){e.preventDefault();e.stopPropagation();}},true);document.addEventListener('submit',e=>e.preventDefault(),true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();send({state:'close'});}else if(kind==='presentation'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();turn(e.key==='ArrowRight'?1:-1);}});
window.addEventListener('message',async e=>{
 let portal=false;try{portal=e.source===parent||e.source?.top===parent;}catch{}
 if(disposed||failed||received||!portal||e.origin!==parentOrigin||parentOrigin!=='https://lms.lums.edu.pk'||!token||e.data?.type!=='aether-office-data'||e.data.token!==token||!(e.data.bytes instanceof ArrayBuffer))return;received=true;
 try{
   const data=e.data.bytes,entries=globalThis.AetherArchiveGuard.inspect(data),names=new Set(entries.map(e=>e.name));
   if(e.data.extension==='zip'){archive(entries);return;}
   if(names.has('ppt/presentation.xml')||names.has('word/document.xml')||names.has('xl/workbook.xml'))await validateContents(data,entries);
   if(disposed)return;if(names.has('ppt/presentation.xml'))await slides(data);else if(names.has('word/document.xml'))await word(data);else if(names.has('xl/workbook.xml'))await workbook(data);else archive(entries);
 }catch(error){fail(/^(This |The local )/.test(error.message)?error.message:'This document is damaged, encrypted, or uses an unsupported Office format. Open the original resource.');}
});
window.addEventListener('pagehide',()=>{if(disposed)return;disposed=true;release();});
if(parentOrigin==='https://lms.lums.edu.pk'&&token)send({state:'ready'});
