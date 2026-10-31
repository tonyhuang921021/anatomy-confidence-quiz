'use strict';
// Local opt-in experiment only. Production and cached/existing explanations never search.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {discoverAfterSaved}=require('./postSaveFigureDiscovery.cjs');
const root='/tmp/anatomy-local-figure-review';
function plain(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500)}
function commonsImage(page){
 const info=page?.imageinfo?.[0],meta=info?.extmetadata||{}, license=plain(meta.LicenseShortName?.value), author=plain(meta.Artist?.value), licenseUrl=meta.LicenseUrl?.value;
 try{const image=new URL(info.thumburl||info.url), source=new URL(info.descriptionurl), l=new URL(licenseUrl);
  if(image.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(image.hostname)||image.port||image.username||image.password||source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org'||l.protocol!=='https:'||l.hostname!=='creativecommons.org')return null;
  return {title:plain(page.title),attribution:author,license,licenseUrl:l.href,sourceUrl:source.href,previewUrl:image.href};
 }catch{return null}
}
async function commonsSearch(query, fetcher=fetch){
 const url=new URL('https://commons.wikimedia.org/w/api.php');Object.entries({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'3',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'500',format:'json',formatversion:'2'}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetcher(url.href,{signal:AbortSignal.timeout(2500),redirect:'error',headers:{'User-Agent':'AnatomyExamLocalReview/1.0 (local image review)'}});if(!response.ok)throw new Error('search unavailable');const data=await response.json();return (data?.query?.pages||[]).map(commonsImage).filter(Boolean);
}
async function afterSavedLocal({outcome,questionId,search=commonsSearch,save=saveLocal,enabled=false}){
 if(!enabled || outcome?.status!==200 || outcome.code!=='inserted')return {status:'not_started'};
 const result=await discoverAfterSaved({outcome,search});
 if(!result.candidates.length)return {status:result.status};
 const count=await save(questionId,result.candidates.slice(0,3));return {status:'saved_pending_review',count};
}
async function readBoundedImage(url,fetcher=fetch){
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(parsed.hostname)||parsed.port||parsed.username||parsed.password)throw Error('invalid image host');
 const response=await fetcher(parsed.href,{signal:AbortSignal.timeout(3500),redirect:'error'});if(!response.ok||!response.body)throw Error('image unavailable');
 const declared=Number(response.headers.get('content-length')||0);if(declared>3*1024*1024)throw Error('image too large');
 const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>3*1024*1024)throw Error('image too large');chunks.push(Buffer.from(part.value))}}finally{reader.releaseLock()}
 const bytes=Buffer.concat(chunks),type=response.headers.get('content-type')?.split(';')[0].trim();
 const png=bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 const webp=bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
 if(!((type==='image/png'&&png)||(type==='image/jpeg'&&jpg)||(type==='image/webp'&&webp)))throw Error('unsupported image');
 return {bytes,ext:png?'png':jpg?'jpg':'webp'};
}
async function saveLocal(questionId,candidates){
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(questionId))throw Error('invalid question ID');
 await fs.mkdir(root,{recursive:true,mode:0o700});const saved=[];
 for(const candidate of candidates){try{const image=await readBoundedImage(candidate.previewUrl);const hash=crypto.createHash('sha256').update(image.bytes).digest('hex');const imagePath=path.join(root,hash+'.'+image.ext);await fs.writeFile(imagePath,image.bytes,{flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e});saved.push({...candidate,localImage:path.basename(imagePath),sha256:hash})}catch{/* Keep the saved text, skip unreadable images. */}}
 if(!saved.length)throw Error('no downloadable candidate images');
 const dest=path.join(root,crypto.createHash('sha256').update(questionId).digest('hex')+'.json');
 const temp=dest+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({questionId,candidates:saved},null,2),{flag:'wx',mode:0o600});await fs.rename(temp,dest);return saved.length;
}
module.exports={afterSavedLocal,commonsSearch,commonsImage,saveLocal,readBoundedImage};
