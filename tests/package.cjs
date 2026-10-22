/* Verify the shipped ZIP, not just the source loaded by development tests. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),JSZip=require('jszip');
const root=path.join(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 const prefix=`aether-lms-extension-v${version}/`,dist=path.join(root,'dist'),archive=fs.readFileSync(path.join(dist,`${prefix.slice(0,-1)}.zip`)),hashes=JSON.parse(fs.readFileSync(path.join(dist,`release-v${version}-sha256.json`)));
 assert.equal(sha(archive),hashes.archive,'Archive hash');
 const zip=await JSZip.loadAsync(archive),files=Object.values(zip.files).filter(f=>!f.dir);
 assert.equal(files.length,Object.keys(hashes.files).length,'No unlisted archive files');
 for(const file of files){
  assert(file.name.startsWith(prefix),'Archive root');const rel=file.name.slice(prefix.length);
  assert(!/(^|\/)(?:\.git|node_modules|tests|reports|\.env)(\/|$)/.test(rel),'No development or private artifacts');
  const bytes=await file.async('nodebuffer');assert.equal(sha(bytes),hashes.files[rel],rel);
  assert(bytes.equals(fs.readFileSync(path.join(dist,prefix,rel))),`ZIP/unpacked mismatch: ${rel}`);
 }
 for(const rel of ['manifest.json','LICENSE','THIRD_PARTY_NOTICES.md','PRIVACY.md','preview/pdf.html','preview/office.html','vendor/pdfjs/LICENSE','vendor/office/provenance.json'])assert(zip.file(prefix+rel),rel);
 const manifest=JSON.parse(await zip.file(prefix+'manifest.json').async('string'));
 assert.deepEqual(manifest.permissions,['storage']);
 for(const group of manifest.content_scripts){assert.deepEqual(group.matches,['https://lms.lums.edu.pk/*']);for(const file of [...group.js,...group.css])assert(zip.file(prefix+file),file);}
 console.log(`PASS: ${files.length} shipped assets, ZIP hashes, unpacked bytes, licenses, manifest, and artifact exclusions`);
})().catch(error=>{console.error(error);process.exitCode=1;});
