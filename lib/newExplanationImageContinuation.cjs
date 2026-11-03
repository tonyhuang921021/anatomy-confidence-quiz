'use strict';
const {imageWindowOpen,approveSchemaQueries,runOne,createStore}=require('./newExplanationFigures.cjs');
// Reuse the existing authenticated five-minute cron, not an in-browser timer.
// No model calls, new schedule, credentials, permissions or automatic approval.
function scheduleNewImageContinuation({env,db,waitUntil,search,loadImage,run=runOne,now=Date.now(),report=()=>{}}){
 if(env.NEW_EXPLANATION_FIGURES_WORKER!=='1'||!imageWindowOpen(env,now)||!db||typeof waitUntil!=='function')return false;
 const work=(async()=>{
  // Recover the small gap between durable text commit and safe query approval.
  const {data:jobs,error}=await db.from('figure_queue_jobs').select('request_id,state,attempts,needs_state,figure_needs').in('state',['pending','leased']).order('created_at',{ascending:true}).limit(21);
  if(error)throw Error('continuation read unavailable');
  if((jobs||[]).length>20||(jobs||[]).some(job=>job.state==='leased'||job.attempts!==0)){report('new_image_continuation_held_for_review');return;}
  for(const job of (jobs||[]).filter(job=>job.needs_state==='awaiting').slice(0,1)){const approved=approveSchemaQueries(job.figure_needs);if(!approved)continue;
   const result=await db.rpc('figure_image_review',{p_id:job.request_id,p_revision:approved.revision,p_needs:approved,p_reviewer:null,p_method:approved.reviewMethod});
   if(result.error)throw Error('query review unavailable');
  }
  // Existing DB leases, per-traffic reservations, and global caps still apply.
  // Do not redispatch an expired lease or unknown external outcome. The
  // precheck avoids reclaiming it; the claim fence also protects any race.
  if(!imageWindowOpen(env))return;
  const base=createStore(db),store={...base,claim:async lease=>{const job=await base.claim(lease);if(job&&job.attempts!==1){report('new_image_continuation_held_for_review');return null}return job}};
  const bounded=fn=>async(...args)=>{if(!imageWindowOpen(env))throw Error('image window ended');return fn(...args)};
  return run({store,search:bounded(search),loadImage:bounded(loadImage),enabled:true});
 })().catch(()=>report('new_image_continuation_unavailable'));
 try{waitUntil(work);return true}catch{work.catch(()=>{});return false}
}
module.exports={scheduleNewImageContinuation};
