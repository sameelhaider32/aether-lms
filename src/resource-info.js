/* One resource schema for student and management lists, previews and icons. */
(() => {
 'use strict';
 const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
 function url(value,base=document.baseURI){try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)?u:null;}catch{return null;}}
 function label(a){const walker=document.createTreeWalker(a,NodeFilter.SHOW_TEXT);let value='',node;while(node=walker.nextNode())if(!node.parentElement.closest('.sr-only,.visually-hidden,.skip,[aria-hidden="true"]'))value+=' '+node.textContent;return clean(value);}
 function kind(extension,mime=''){
   if(extension==='pdf'||mime.includes('application/pdf'))return 'pdf';
   if(/^(pptx|ppsx|potx|pptm|docx|docm|xlsx|xlsm|xltx)$/.test(extension)||/officedocument|ms-powerpoint|ms-excel|ms-word/.test(mime))return 'office';
   if(/^(png|jpe?g|webp|gif|bmp|avif)$/.test(extension)||/^image\/(png|jpeg|webp|gif|bmp|avif)/.test(mime))return 'image';
   if(/^(mp3|wav|ogg|m4a|flac)$/.test(extension)||mime.startsWith('audio/'))return 'audio';
   if(/^(mp4|webm|ogv|mov)$/.test(extension)||mime.startsWith('video/'))return 'video';
   if(extension==='zip'||/application\/(?:x-)?zip/.test(mime))return 'archive';
   if(/^(txt|md|csv|tsv|log|py|js|mjs|ts|tsx|jsx|java|c|h|cpp|hpp|cs|css|html?|xml|json|yaml|yml|sql|r|sh|ipynb|tex|rtf)$/.test(extension)||/^text\//.test(mime)||/application\/(json|xml)/.test(mime))return 'text';
   return 'link';
 }
 function describe(card,primary=card.querySelector('[data-ae-primary="true"]')||card){
   const links=(primary.matches('a')?[primary]:[...primary.querySelectorAll('a')]).filter(a=>!a.closest('.dropdown-menu,[data-ae-preview-control]'));
   const a=links.find(a=>/\.[a-z0-9]{1,7}$/i.test(label(a)))||links.find(a=>label(a))||links[0];if(!a)return null;
   const code=a.getAttribute('onclick')||'',copyright=code.match(/\bopenCopyrightWindow\s*\(\s*(['"])([^'"\r\n]+)\1\s*[,)]/);
   let u=url(copyright?.[2]||a.getAttribute('href')),noticeURL=null;
   if(u?.pathname==='/access/require'){noticeURL=u;const back=u.searchParams.get('url');u=back?url(back.startsWith('/content/')?'/access'+back:back,u.origin):null;}
   if(a.getAttribute('href')==='#'&&!copyright)u=null;
   const title=label(a)||a.title||'Resource',type=(primary.getAttribute('data-ae-type')||card.getAttribute('data-ae-type')||'').toUpperCase();
   let id=card.getAttribute('data-collection-id')||card.getAttribute('data-resource-id')||code.match(/getElementById\(['"]collectionId['"]\)\.value\s*=\s*['"]([^'"]+)['"]/)?.[1]||u?.searchParams.get('collectionId')||'';
   if(!id)id=[...card.querySelectorAll('input[type="checkbox"]')].map(i=>i.value).find(v=>/^\/(?:group|user)\//.test(v))||'';
   if(!id&&u?.pathname.startsWith('/access/content/'))id=u.pathname.slice('/access/content'.length);
   try{id=decodeURIComponent(id);}catch{}
   if(!/^\/(?:group|user)\/[^/]+\//.test(id)||id.split('/').some(s=>s==='..'||s==='.')||/[\u0000-\u001f]/.test(id))id=null;
   const folder=type==='FOLDER'||card.matches('.collection,.folder')||!!card.querySelector('.fa-folder,.bi-folder,[class*="folderIcon"],.fa-folder-open')||!!(id?.endsWith('/')&&(!u||u.pathname.startsWith('/access/content/')||code.includes('collectionId')));
   let path=u?.pathname||'';try{path=decodeURIComponent(path);}catch{}
   const extension=(title.match(/\.([a-z0-9]{1,7})$/i)?.[1]||path.match(/\.([a-z0-9]{1,7})$/i)?.[1]||type).toLowerCase();
   return {card,a,u,id,title,extension,noticeURL,kind:folder?'folder':kind(extension),type:folder?'FOLDER':extension.toUpperCase()||type,description:clean(card.querySelector('.description,[data-description]')?.textContent||a.title)};
 }
 globalThis.AetherResourceInfo={describe,kind};
})();
