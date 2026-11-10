'use strict';
const {safePmcImage}=require('./figureSourceIdentity.cjs');
const {createHash}=require('node:crypto');
const {normalizeCommonsCandidate,classifySource}=require('./figureSourcePolicy.cjs');
// Bounded Commons transport extracted from existing local discovery adapter.
function plain(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,500)}
function inspectCommonsImage(page){
 const info=page?.imageinfo?.[0],meta=info?.extmetadata||{},licenseUrl=meta.LicenseUrl?.value,rawLicense=plain(meta.LicenseShortName?.value),author=plain(meta.Artist?.value);
 // Only explicit API metadata carrying the exact PDM URI is mapped. Bare
 // 'Public domain' without the URI remains unaccepted for human review.
 const license=rawLicense==='Public domain'&&licenseUrl==='https://creativecommons.org/publicdomain/mark/1.0/'?'PDM 1.0':rawLicense;
 const diagnostic={title:plain(page?.title),mime:plain(info?.mime),width:Number.isFinite(info?.width)?info.width:null,height:Number.isFinite(info?.height)?info.height:null,license,hasAuthor:Boolean(author),hasLicenseUrl:typeof licenseUrl==='string'&&Boolean(licenseUrl),reason:''};
 if(!info){diagnostic.reason='missing_imageinfo';return {candidate:null,diagnostic}}
 if((license==='PDM 1.0'&&!info.mime)||(info.mime && !String(info.mime).startsWith('image/'))){diagnostic.reason='non_image_media';return {candidate:null,diagnostic}}
 if(!diagnostic.hasLicenseUrl){diagnostic.reason='missing_license_url';return {candidate:null,diagnostic}}
 let image,source,l;try{image=new URL(info.thumburl||info.url);source=new URL(info.descriptionurl);l=new URL(licenseUrl)}catch{diagnostic.reason='invalid_or_missing_url';return {candidate:null,diagnostic}}
 if(image.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(image.hostname)||image.port||image.username||image.password){diagnostic.reason='image_host_rejected';return {candidate:null,diagnostic}}
 if(source.protocol!=='https:'||source.hostname!=='commons.wikimedia.org'){diagnostic.reason='source_host_rejected';return {candidate:null,diagnostic}}
 if(l.protocol!=='https:'||l.hostname!=='creativecommons.org'){diagnostic.reason='license_host_rejected';return {candidate:null,diagnostic}}
 const candidate={title:diagnostic.title,attribution:author,license,licenseUrl:l.href,sourceUrl:source.href,previewUrl:image.href};diagnostic.reason='passed_url_gate';return {candidate,diagnostic};
}
function commonsImage(page){return inspectCommonsImage(page).candidate}
async function commonsSearch(query, fetcher=fetch, onDiagnostic){
 const url=new URL('https://commons.wikimedia.org/w/api.php');Object.entries({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'10',prop:'imageinfo',iiprop:'url|extmetadata|mime|size',iiextmetadatafilter:'LicenseUrl|LicenseShortName|Artist',iiurlwidth:'500',format:'json',formatversion:'2'}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetcher(url.href,{signal:AbortSignal.timeout(2500),redirect:'error',headers:{'User-Agent':'AnatomyExamLocalReview/1.0 (local image review)'}});if(!response.ok)throw new Error('search unavailable');const reader=response.body?.getReader();if(!reader)throw Error('missing response');let size=0;const chunks=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>262144)throw Error('metadata too large');chunks.push(Buffer.from(part.value))}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Commons response invalid');
 if(data.error)throw new Error('Commons API error');
 if(data?.query?.pages!==undefined&&!Array.isArray(data.query.pages))throw new Error('Commons response invalid');
 const pages=data?.query?.pages||[];if(pages.length>10)throw new Error('Commons response too many pages');
 const inspected=pages.map(inspectCommonsImage),eligible=[],reasons={};
 for(const entry of inspected){
  const candidate=entry.candidate&&normalizeCommonsCandidate(entry.candidate);
  const reason=candidate?classifySource(candidate):entry.diagnostic.reason;
  reasons[reason]=(reasons[reason]||0)+1;
  if(reason==='pending_visual_review')eligible.push(candidate);
 }
 const diagnostic={pages:pages.length,eligible:eligible.length,selected:Math.min(3,eligible.length),reasons};
 // No query, URL, author, source text, or user identifier in operational logs.
 console.info('commons_discovery_result',diagnostic);
 if(typeof onDiagnostic==='function')onDiagnostic(diagnostic);
 return eligible.slice(0,3);
}
async function readBoundedImage(url,fetcher=fetch){
 const parsed=new URL(url),pmc=safePmcImage(url);if(!pmc&&(parsed.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(parsed.hostname)||parsed.port||parsed.username||parsed.password))throw Error('invalid image host');
 const response=await fetcher(parsed.href,{signal:AbortSignal.timeout(3500),redirect:'error'});if(!response.ok||!response.body)throw Error('image unavailable');
 const declared=Number(response.headers.get('content-length')||0);if(declared>3*1024*1024)throw Error('image too large');
 const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>3*1024*1024)throw Error('image too large');chunks.push(Buffer.from(part.value))}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=Buffer.concat(chunks),type=response.headers.get('content-type')?.split(';')[0].trim();
 const png=bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 const webp=bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
 if(!((type==='image/png'&&png)||(type==='image/jpeg'&&jpg)||(type==='image/webp'&&webp)||(pmc&&type==='binary/octet-stream'&&(png||jpg||webp))))throw Error('unsupported image');
 if(pmc&&createHash('md5').update(bytes).digest('hex')!==pmc.md5)throw Error('image digest mismatch');
 return {bytes,ext:png?'png':jpg?'jpg':'webp'};
}

module.exports={commonsSearch,readBoundedImage};
