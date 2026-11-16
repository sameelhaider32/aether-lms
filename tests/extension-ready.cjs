/* Functional fixture setup. Cold-start/performance probes deliberately do not
   use this helper. No LMS requests, data loading or preferences are performed. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async(context,extension=process.env.AETHER_EXTENSION||path.join(__dirname,'..'))=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
 const script=manifest.background?.service_worker;if(!script)return null;
 const matches=worker=>{try{const u=new URL(worker.url());return u.protocol==='chrome-extension:'&&u.pathname==='/'+script.replaceAll('\\','/');}catch{return false;}};
 const worker=context.serviceWorkers().find(matches)||await context.waitForEvent('serviceworker',{predicate:matches,timeout:30000});
 const version=await worker.evaluate(async()=>{
  const deadline=Date.now()+10000;
  while(!chrome.runtime.onMessage.hasListeners()){
   if(Date.now()>deadline)throw Error('Aether background message handler did not initialize');
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  return chrome.runtime.getManifest().version;
 });
 if(version!==manifest.version)throw Error('Loaded extension version differs from the fixture manifest');
 return worker;
};
