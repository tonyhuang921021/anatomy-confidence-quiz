'use strict';
const {createHash}=require('node:crypto');
const {normalizeCommonsCandidate,classifySource}=require('./figureSourcePolicy.cjs');
const {validate}=require('./figureReviewService.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
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
async function continueFigure({id,repository,readText,search,loadImage,review,discover=null,trafficAllowed=async()=>true}){
 const saved=await repository.read(id);if(!saved?.operation)return {status:'missing'};
 const op=saved.operation,text=await readText(op.question_id);
 if(typeof text!=='string'||sha(text)!==op.text_sha)return {status:'stale'};
 const steps=saved.steps||[];
 // Do not let a new provider skip any unresolved HTTP from this operation.
 if(steps.some(s=>s.state!=='completed'))return {status:'unknown_held'};
 let staged=0;const seen=new Set();
 const broader=typeof discover==='function'&&/^[a-z][a-z -]{1,89}$/.test(op.query)&&op.query.split(' ').length<=8;
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
 const found=await step('search',sha(op.query),null,async()=>({items:(await search(op.query)).slice(0,3).map(normalizeCommonsCandidate).filter(x=>classifySource(x)==='pending_visual_review')}));
 if(!found.ok)return {status:found.status};
 async function process(candidates,limit){
 if(!Array.isArray(candidates)||candidates.length>3)return {status:'invalid_source_preserved'};
 let taken=0;
 for(const raw of candidates){
  if(staged>=3||taken>=limit)break;
  const source=normalizeCommonsCandidate(raw);
  if(classifySource(source)!=='pending_visual_review')continue;
  const key=sha(source.previewUrl);if(seen.has(key))continue;seen.add(key);
  const loaded=await step('download',key,source.previewUrl,async()=>{const i=await loadImage(source.previewUrl);return {bytes:i.bytes,mime:i.mime||({png:'image/png',jpg:'image/jpeg',webp:'image/webp'})[i.ext]}});
  // A held old URL may be skipped, but never fetched again. Unknown in this
  // operation stops; another explicit operation must choose a new safe source.
  if(!loaded.ok){if(loaded.status==='prior_download_hold')continue;return {status:loaded.status}}
  let bytes=loaded.value.image_bytes;if(typeof bytes==='string'&&/^\\x[0-9a-f]+$/i.test(bytes))bytes=Buffer.from(bytes.slice(2),'hex');
  let row;try{row=validate({questionId:op.question_id,explanation:text,bytes,mime:loaded.value.image_mime,sourceUrl:source.sourceUrl,licenseUrl:source.licenseUrl,license:source.license,attribution:source.attribution,sectionTitle:op.item.caption})}catch{return {status:'invalid_media_preserved'}}
  let candidateId;try{candidateId=await repository.stage(id,key,source)}catch{return {status:'stage_unconfirmed'}}
  if(!candidateId)return {status:'stale'};
  staged++;taken++;
  const result=await review({job:{request_id:op.parent_request,question_id:op.question_id,explanation_sha256:op.text_sha},row,item:op.item,text,candidateId,continuationId:id});
  if(result.status==='mismatch'||result.status==='withdrawn')continue;
  return result;
 }
 return null;
 }
 const initial=await process(found.value.payload||[],3);if(initial)return initial;
 if(broader&&staged<3){
  try{
   const excludedSources=[];
   for(let article=0;article<2&&staged<3;article++){
   const candidates=await discover(op.query,async(identity,load)=>{
    const result=await step('search',sha(identity),identity,async()=>({items:await load()}));
    if(!result.ok)throw Object.assign(Error('metadata held'),{workerStatus:result.status});
    return result.value.payload;
   },undefined,{excludedSources});
   if(!candidates.length)break;
   const fresh=candidates.filter(x=>!excludedSources.includes(x.sourceUrl));if(!fresh.length)break;
   const result=await process(fresh,3-staged);if(result)return result;
   excludedSources.push(...fresh.map(x=>x.sourceUrl));
   }
  }catch(error){return {status:error.workerStatus||'unknown_held'}}
 }
 return {status:'no_suitable_image'};
}
module.exports={continueFigure,createContinuationRepository};
