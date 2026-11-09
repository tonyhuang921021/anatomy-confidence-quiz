'use strict';
const {figureCaptureAllowed,guardFigureTraffic}=require('./figureCaptureGate.cjs');
const {imageWindowOpen,boundedImageTarget,approveSchemaQueries,runOne,createStore}=require('./newExplanationFigures.cjs');
// Reuse the authenticated five-minute cron. No model, new schedule, credentials,
// larger quota, or automatic image-content approval.
async function runNewImageContinuation({env,db,search,loadImage,run=runOne,finalReview=null,now=Date.now()}){
 if(env.NEW_EXPLANATION_FIGURES_CAPTURE!=='1'||env.NEW_EXPLANATION_FIGURES_WORKER!=='1'||!imageWindowOpen(env,now)||!db)return {status:'disabled'};

  if(!await figureCaptureAllowed(db))return;
  const target=boundedImageTarget(env);
  let exactRequest=null;
  const sitewide=env.EXPLANATION_SITEWIDE_ENABLED==='1';
  let result;
  if(sitewide)result=await db.rpc('explanation_sitewide_image_plans',{});
  else {
   let query=db.from('figure_queue_jobs').select('request_id,state,attempts,needs_state,figure_needs')
    .eq('state','pending').eq('attempts',0).eq('needs_state','awaiting').order('created_at',{ascending:true});
   if(target)query=query.eq('question_id',target.questionId).eq('explanation_sha256',target.textHash);
   result=await query.limit(20);
  }
  const {data:jobs,error}=result;
  if(error||!Array.isArray(jobs))throw Error('continuation read unavailable');
  // Approve only safe search terms. Invalid plans wait for concept review.
  // A leased/previously attempted row never blocks other fresh work.
  for(const job of jobs){
   if(job.state!=='pending'||job.attempts!==0||job.needs_state!=='awaiting')continue;
   const approved=approveSchemaQueries(job.figure_needs);if(!approved){
    if(sitewide){const held=await db.rpc('explanation_sitewide_hold_plan',{p_id:job.request_id,p_needs:job.figure_needs??null});if(held.error)throw Error('plan hold unconfirmed')}
    continue;
   }
   const result=await db.rpc('figure_image_review',{p_id:job.request_id,p_revision:approved.revision,p_needs:approved,p_reviewer:null,p_method:approved.reviewMethod});
   if(result.error)throw Error('query review unavailable');
   if(result.data==='approved')break;
  }
  if(sitewide){const next=await db.rpc('explanation_sitewide_next_image',{});if(next.error)throw Error('sitewide image scope unavailable');exactRequest=next.data;if(!exactRequest)return;}
  if(!imageWindowOpen(env))return;
  const bounded=fn=>guardFigureTraffic(db,fn,()=>imageWindowOpen(env));
  return run({store:createStore(db,{target,requestId:exactRequest}),search:bounded(search),loadImage:bounded(loadImage),finalReview,enabled:true});

}
function scheduleNewImageContinuation(args){
 const {env,db,waitUntil,report=()=>{},now=Date.now()}=args;
 if(env.NEW_EXPLANATION_FIGURES_CAPTURE!=='1'||env.NEW_EXPLANATION_FIGURES_WORKER!=='1'||!imageWindowOpen(env,now)||!db||typeof waitUntil!=='function')return false;
 const work=runNewImageContinuation(args).catch(()=>report('new_image_continuation_unavailable'));
 try{waitUntil(work);return true}catch{work.catch(()=>{});return false}
}
module.exports={scheduleNewImageContinuation,runNewImageContinuation};
