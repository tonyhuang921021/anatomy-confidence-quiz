'use strict';
const crypto=require('node:crypto');
const {discoverAfterSaved}=require('./postSaveFigureDiscovery.cjs');
const {stage}=require('./figureReviewService.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

// One bounded attempt. No model invocation and no mutation of saved text.
// Persistence and lease implementation are injected; production remains disabled.
async function runOne({queue,repository,search,loadImage,leaseId=crypto.randomUUID()}){
 const job=await queue.claim(leaseId,600);if(!job)return {status:'idle'};
 if(typeof repository.forLease!=='function')throw Error('lease-fenced repository required');
 const leasedRepository=repository.forLease(job.request_id,leaseId);
 const finish=async ok=>{const result=await queue.finish(job.request_id,leaseId,ok);if(!['done','pending','failed'].includes(result))throw Error('lease not confirmed');return result};
 try{
  const committed=await repository.readCommitted(job.question_id);
  if(typeof committed!=='string'||hash(committed)!==job.explanation_sha256){await finish(true);return {status:'stale'}}
  if(!await queue.enabled())return {status:'paused_lease_held'};
  let failed=false;
  const result=await discoverAfterSaved({outcome:{status:200,code:'inserted',value:{explanation:committed}},search:async q=>{if(!await queue.enabled())throw Error('paused');try{return await search(q)}catch(e){failed=true;throw e}}});
  if(!await queue.enabled())return {status:'paused_lease_held'};
  if(failed)throw Error('search failed');
  for(const item of result.candidates.slice(0,3)){
   if(!await queue.enabled())return {status:'paused_lease_held'};
   const image=await loadImage(item.previewUrl), mime=image.ext==='jpg'?'image/jpeg':image.ext==='png'?'image/png':image.ext==='webp'?'image/webp':'';
   await stage({candidate:{questionId:job.question_id,explanation:committed,bytes:image.bytes,mime,sourceUrl:item.sourceUrl,licenseUrl:item.licenseUrl,license:item.license,attribution:item.attribution,sectionTitle:item.query},repository:leasedRepository,readCommitted:leasedRepository.readCommitted});
  }
  await finish(true);return {status:result.candidates.length?'pending_review':result.status};
 }catch{if(!await queue.enabled())return {status:'paused_lease_held'};return {status:await finish(false)}}
}
function createQueue(db){return {
 async claim(leaseId,seconds){const {data,error}=await db.rpc('figure_queue_claim',{p_lease:leaseId,p_seconds:seconds});if(error)throw Error('claim unavailable');return Array.isArray(data)?data[0]??null:data??null},
 async enabled(){const {data,error}=await db.from('figure_queue_config').select('enabled').eq('id',true).maybeSingle();if(error||!data)throw Error('queue status unavailable');return data.enabled===true},
 async finish(id,leaseId,success){const {data,error}=await db.rpc('figure_queue_finish',{p_id:id,p_lease:leaseId,p_success:success});if(error)throw Error('finish unavailable');return data}
}}
module.exports={runOne,createQueue};
