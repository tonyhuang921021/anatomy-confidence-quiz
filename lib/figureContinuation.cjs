'use strict';
const {createHash}=require('node:crypto');
const {normalizeCommonsCandidate,classifySource}=require('./figureSourcePolicy.cjs');
const {validate}=require('./figureReviewService.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
// One scoped maintenance operation on the pre-reviewed Q100 asset.  The
// owner route's existing admin/actor entitlement checks precede this adapter.
const EXACT_EYE=Object.freeze({
 parent:'7986e89f-dd50-4276-b10d-1e287a4f2d7a',question:'MOEX-111100-2301-Q100',
 query:'schematic diagram of the human eye',teachingQuery:'uveal tract anatomy iris ciliary body choroid',commonsQuery:'"Schematic diagram of the human eye" filetype:drawing',
 textSha:'101d35144ab23ec2b48fd98f071a515daa99eaf22b2095687ba7b56dc9cfd783',
 sectionSha:'f7376f88ff149f4e045e15f3eb048fc358734cb24eeb7099cee6b61db87eeeff',
 heading:'正解與關鍵判斷',caption:'眼球剖面圖，標示虹膜、睫狀體、脈絡膜與視網膜，協助辨認葡萄膜各部位及其位置。',
 candidateId:'221a9994-f225-419b-9ed1-9389afcdfdc9',imageSha:'0acc24945b5a01a93ca08ce88711cb1ad299377fbb85a9c87d7bbe95f44b564d',
 previewUrl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Schematic_diagram_of_the_human_eye_en.svg/500px-Schematic_diagram_of_the_human_eye_en.svg.png',
 sourceUrl:'https://commons.wikimedia.org/wiki/File:Schematic_diagram_of_the_human_eye_en.svg',
 license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',attribution:'Rhcastilhos、Jmarchn'
});
// Undefined means unrelated. Null means a recognized but stale exact request;
// never silently fall back to an unconstrained search for that operation.
function exactEyeAssetFor(op){
 const x=EXACT_EYE;
 if(op?.parent_request!==x.parent||op.query!==x.query)return undefined;
 const p=op.item;
 return op.question_id===x.question&&op.text_sha===x.textSha&&p?.sectionAnchor==='section-0'&&
  p.sectionHash===x.sectionSha&&p.sectionTitle===x.heading&&p.caption===x.caption ? x : null;
}
function exactEyeSource(source,x){
 if(!source||source.previewUrl!==x.previewUrl||source.sourceUrl!==x.sourceUrl||
  source.license!==x.license||source.licenseUrl!==x.licenseUrl||
  !/^rhcastilhos[ .、,]+(?:and[ .、,]+)?jmarchn[ .、,]*$/i.test(source.attribution))return null;
 // Equivalent spelling of the same two credited authors; match the staged
 // candidate's attribution without accepting absent or additional creators.
 return {...source,attribution:x.attribution};
}
function createContinuationRepository(db,actor){
 const rpc=async(name,args)=>{const r=await db.rpc(name,args);if(r.error)throw Error('continuation repository unavailable');return r.data};
 return {
  read:id=>rpc('figure_continuation_status',{p_id:id,p_actor:actor}),
  reserve:(id,kind,key,url)=>rpc('figure_continuation_step',{p_id:id,p_actor:actor,p_kind:kind,p_key:key,p_url:url||null}),
  record:(id,kind,key,value)=>rpc('figure_continuation_record',{p_id:id,p_actor:actor,p_kind:kind,p_key:key,p_payload:value?.items||null,p_bytes:value?.bytes?'\\x'+value.bytes.toString('hex'):null,p_mime:value?.mime||null}),
  stage:(id,key,source)=>rpc('figure_continuation_stage',{p_id:id,p_actor:actor,p_download_key:key,p_source:source}),
 };
}
// Explicit operation id is supplied by caller and retained across navigation.
// No loop retries transport or DB acknowledgement; a second invocation reads evidence.
async function continueFigure({id,repository,readText,search,loadImage,review,discover=null,requiredAsset=null,trafficAllowed=async()=>true}){
 const saved=await repository.read(id);if(!saved?.operation)return {status:'missing'};
 const op=saved.operation;
 if(requiredAsset&&exactEyeAssetFor(op)!==requiredAsset)return {status:'stale'};
 const text=await readText(op.question_id);
 if(typeof text!=='string'||sha(text)!==op.text_sha)return {status:'stale'};
 const steps=saved.steps||[];
 // Do not let a new provider skip any unresolved HTTP from this operation.
 if(steps.some(s=>s.state!=='completed'))return {status:'unknown_held'};
 let staged=0;const seen=new Set();
 const broader=!requiredAsset&&typeof discover==='function'&&/^[a-z][a-z -]{1,89}$/.test(op.query)&&op.query.split(' ').length<=8;
 async function step(kind,key,url,transport){
  const prior=steps.find(s=>s.kind===kind&&s.key===key);
  if(prior)return prior.state==='completed'?{ok:true,value:prior}:{ok:false,status:'unknown_held'};
  if(!await trafficAllowed())return {ok:false,status:'paused'};
  let grant;try{grant=await repository.reserve(id,kind,key,url)}catch{return {ok:false,status:'reservation_unconfirmed'}}
  if(grant?.dispatch!==true)return {ok:false,status:grant?.status==='completed'?(kind==='download'?'prior_download_hold':'prior_search'):(grant?.status||'held')};
  if(!await trafficAllowed())return {ok:false,status:'paused'};
  let value;try{value=await transport()}catch{try{await repository.record(id,kind,key,null)}catch{}return {ok:false,status:'unknown_held'}}
  try{const receipt=await repository.record(id,kind,key,value);if(receipt?.status!=='completed')return {ok:false,status:'commit_unconfirmed'}}catch{return {ok:false,status:'commit_unconfirmed'}}
  const evidence={kind,key,state:'completed',payload:value.items,image_bytes:value.bytes,image_mime:value.mime};steps.push(evidence);return {ok:true,value:evidence};
 }
 const found=await step('search',sha(op.query),null,async()=>{
  const sources=(await search(requiredAsset?.commonsQuery??op.query)).slice(0,3).map(normalizeCommonsCandidate).filter(x=>classifySource(x)==='pending_visual_review');
  return {items:requiredAsset?sources.map(s=>exactEyeSource(s,requiredAsset)).filter(Boolean).slice(0,1):sources};
 });
 if(!found.ok)return {status:found.status};
 async function process(candidates,limit){
 if(!Array.isArray(candidates)||candidates.length>3)return {status:'invalid_source_preserved'};
 let taken=0;
 for(const raw of candidates){
  if(staged>=3||taken>=limit)break;
  const normalized=normalizeCommonsCandidate(raw);
  const source=requiredAsset?exactEyeSource(normalized,requiredAsset):normalized;
  if(classifySource(source)!=='pending_visual_review')continue;
  const key=sha(source.previewUrl);if(seen.has(key))continue;seen.add(key);
  const loaded=await step('download',key,source.previewUrl,async()=>{const i=await loadImage(source.previewUrl);return {bytes:i.bytes,mime:i.mime||({png:'image/png',jpg:'image/jpeg',webp:'image/webp'})[i.ext]}});
  // A held old URL may be skipped, but never fetched again. Unknown in this
  // operation stops; another explicit operation must choose a new safe source.
  if(!loaded.ok){if(loaded.status==='prior_download_hold')continue;return {status:loaded.status}}
  let bytes=loaded.value.image_bytes;if(typeof bytes==='string'&&/^\\x[0-9a-f]+$/i.test(bytes))bytes=Buffer.from(bytes.slice(2),'hex');
  if(requiredAsset&&(!Buffer.isBuffer(bytes)||sha(bytes)!==requiredAsset.imageSha||loaded.value.image_mime!=='image/png'))return {status:'asset_changed'};
  let row;try{row=validate({questionId:op.question_id,explanation:text,bytes,mime:loaded.value.image_mime,sourceUrl:source.sourceUrl,licenseUrl:source.licenseUrl,license:source.license,attribution:source.attribution,sectionTitle:op.item.caption})}catch{return {status:'invalid_media_preserved'}}
  let candidateId;try{candidateId=await repository.stage(id,key,source)}catch{return {status:'stage_unconfirmed'}}
  if(!candidateId||(requiredAsset&&candidateId!==requiredAsset.candidateId))return {status:'stale'};
  staged++;taken++;
  const item=requiredAsset?{...op.item,query:requiredAsset.teachingQuery}:op.item;
  const result=await review({job:{request_id:op.parent_request,question_id:op.question_id,explanation_sha256:op.text_sha},row,item,text,candidateId,continuationId:id});
  if(result.status==='mismatch'||result.status==='withdrawn')continue;
  return result;
 }
 return null;
 }
 const initial=await process(found.value.payload||[],3);if(initial)return initial;
 if(broader&&staged<3){
  try{
   const excludedSources=[],deferred=[];
   for(let article=0;article<2&&staged<3;article++){
   const candidates=await discover(op.query,async(identity,load)=>{
    const result=await step('search',sha(identity),identity,async()=>({items:await load()}));
    if(!result.ok)throw Object.assign(Error('metadata held'),{workerStatus:result.status});
    return result.value.payload;
   },undefined,{excludedSources});
   if(!candidates.length)break;
   const fresh=candidates.filter(x=>!excludedSources.includes(x.sourceUrl));if(!fresh.length)break;
   const result=await process(fresh,1);if(result)return result;
   deferred.push(...fresh);
   excludedSources.push(...fresh.map(x=>x.sourceUrl));
   }
   const remainder=await process(deferred.slice(0,3),3-staged);if(remainder)return remainder;
  }catch(error){return {status:error.workerStatus||'unknown_held'}}
 }
 return {status:'no_suitable_image'};
}
module.exports={continueFigure,createContinuationRepository,exactEyeAssetFor};
