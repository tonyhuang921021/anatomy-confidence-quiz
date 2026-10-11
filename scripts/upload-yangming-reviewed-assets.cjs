// Uploads immutable reviewed originals to the already-linked bucket. Never writes DB rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'..');
const handoff=process.env.YANGMING_HANDOFF_ROOT;
const envRoot=process.env.YANGMING_ENV_ROOT;
if(!handoff||!envRoot)throw Error('Explicit source and existing credential directories required');
function loadEnv(file){if(!fs.existsSync(file))return;for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const line=raw.trim();if(!line||line.startsWith('#'))continue;const pos=line.indexOf('=');if(pos<1)continue;
 const key=line.slice(0,pos).trim().replace(/^export\s+/,'');if(!['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].includes(key)||process.env[key])continue;
 let val=line.slice(pos+1).trim();if((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'")))val=val.slice(1,-1);process.env[key]=val;
}}
for(const f of ['.env.yangming-import.local','.env.production.local','.env.local','.vercel/.env.production.local'])loadEnv(path.join(envRoot,f));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=='https://ejyniduhsyurxocabqqp.supabase.co'||!key)throw Error('Existing project credentials missing or project mismatch');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/yangming-reviewed-release/upload-manifest.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(manifest.bucket!=='yangming-explanations'||manifest.assets.length!==1087)throw Error('Release scope mismatch');
for(const a of manifest.assets){
 if(!/^assets\/[A-Za-z0-9_-]+\/[0-9]+\.png$/.test(a.relativePath)||a.storagePath!=='reviewed-releases/'+manifest.releaseId+'/'+a.relativePath)throw Error('Invalid reviewed path');
 const b=fs.readFileSync(path.join(handoff,'delivery',a.relativePath));if(sha(b)!==a.sha256||b.length!==a.bytes)throw Error('Source hash mismatch');
}
if(process.argv.includes('--dry-run')){console.log(JSON.stringify({dryRun:true,project:'ejyniduhsyurxocabqqp',releaseId:manifest.releaseId,images:1087,bytes:manifest.assets.reduce((s,a)=>s+a.bytes,0),upsert:false,databaseWrites:0}));process.exit(0);}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=client.storage.from(manifest.bucket);
const receiptPath=path.join(root,'docs/yangming-reviewed-release/storage-receipt.jsonl');
let done=0,cursor=0,failed=false;const results=[];
async function one(a){
 const bytes=fs.readFileSync(path.join(handoff,'delivery',a.relativePath));let outcome='uploaded';
 const existing=await bucket.download(a.storagePath);
 if(!existing.error){const b=Buffer.from(await existing.data.arrayBuffer());if(sha(b)!==a.sha256)throw Error('Immutable path conflict: '+a.storagePath);outcome='alreadyVerified';}
 else{const uploaded=await bucket.upload(a.storagePath,bytes,{contentType:'image/png',cacheControl:'31536000',upsert:false});if(uploaded.error)throw Error('Upload failed: '+a.storagePath+' ('+uploaded.error.statusCode+')');}
 const check=await bucket.download(a.storagePath);if(check.error)throw Error('Readback failed: '+a.storagePath);
 const downloaded=Buffer.from(await check.data.arrayBuffer());if(sha(downloaded)!==a.sha256||downloaded.length!==a.bytes)throw Error('Readback hash mismatch: '+a.storagePath);
 const result={storagePath:a.storagePath,sha256:a.sha256,bytes:a.bytes,outcome,verified:true};results.push(result);fs.appendFileSync(receiptPath,JSON.stringify(result)+'\n');done++;
 if(done%50===0||done===manifest.assets.length)console.log(JSON.stringify({verified:done,total:manifest.assets.length}));
}
(async()=>{await Promise.all(Array.from({length:4},async()=>{while(cursor<manifest.assets.length&&!failed){const a=manifest.assets[cursor++];try{await one(a);}catch(e){failed=true;throw e;}}}));
 fs.writeFileSync(path.join(root,'docs/yangming-reviewed-release/storage-verification.json'),JSON.stringify({releaseId:manifest.releaseId,images:results.length,allSHA256Match:true,bytes:results.reduce((s,a)=>s+a.bytes,0),databaseWrites:0,overwrites:0,deletions:0,verifiedAt:new Date().toISOString(),assets:results},null,2)+'\n');
 console.log(JSON.stringify({completed:true,verified:done,releaseId:manifest.releaseId}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
