/* One keyboard handler per supported document; only the top document owns UI. */
(() => {
 'use strict';
 let host;try{if(top.location.origin!=='https://lms.lums.edu.pk'||!/^\/+(?:portal(?:\/|$)|$)/.test(top.location.pathname))return;host=top.document;}catch{return;}
 const editing=target=>document.designMode==='on'||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.cke,.tox,.CodeMirror,.monaco-editor');
 function key(event){
  const chord=event.key.toLowerCase()==='k'&&((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey||event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey);
  if(!chord||event.defaultPrevented||event.repeat||editing(event.target)||!host.documentElement.classList.contains('aether-enabled'))return;
  if(document.querySelector('.Mrphs-sakai-samigo,form[name="takeAssessmentForm"]')||/test|quiz|assessment/i.test(host.querySelector('.header-tool-title')?.textContent||''))return;
  if([...host.querySelectorAll('dialog[open],.modal.show,[aria-modal="true"]')].some(e=>e.id!=='aether-spotlight'&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'))return;
  if(top.AetherSpotlight?.open({trigger:document.activeElement})){event.preventDefault();}
 }
 const records=()=>{if(window!==top)top.AetherSpotlight?.frame(document);};
 document.addEventListener('keydown',key);document.addEventListener('aether-records-change',records);document.addEventListener('DOMContentLoaded',records,{once:true});
 document.addEventListener('aether-session-change',()=>{if(window!==top)top.document.dispatchEvent(new Event('aether-preview-session-change'));});
 window.addEventListener('pagehide',event=>{if(window!==top)top.AetherSpotlight?.removeFrame(document);if(!event.persisted){document.removeEventListener('keydown',key);document.removeEventListener('aether-records-change',records);}});
})();
