'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A missing plan may be added only to an explicitly identified, exact saved
// operation. The database verifies ownership, settlement, current version and
// remaining quota. Never fall back to a random job or retry unknown writes.
async function enqueueSavedPlan({db,requestId,actorId,questionId,replacementRevision=null,needs}){
 if(!UUID.test(String(requestId||''))||!UUID.test(String(actorId||'')))return {ok:false,code:'exact_request_required',httpStatus:400};
 if(!needs?.items?.length)return {ok:false,code:'heading_not_found',httpStatus:400};
 try{
  if(replacementRevision&&replacementRevision!==requestId)return {ok:false,code:'exact_plan_not_created',httpStatus:409};
  const scoped=await db.rpc(replacementRevision?'explanation_replacement_status':'explanation_generation_status',replacementRevision?{p_actor:actorId,p_question:questionId,p_operation:requestId}:{p_id:requestId,p_actor:actorId,p_question:questionId});
  if(scoped.error)return {ok:false,code:'plan_scope_unavailable',httpStatus:503};
  if(scoped.data?.status!=='completed')return {ok:false,code:'exact_plan_not_created',httpStatus:409};
  const {data,error}=await db.rpc('explanation_enqueue_exact_saved',{p_id:requestId,p_actor:actorId,p_needs:needs});
  if(error)return {ok:false,code:'plan_outcome_unconfirmed',httpStatus:503};
  return data===true?{ok:true,code:'awaiting',httpStatus:200}:{ok:false,code:'exact_plan_not_created',httpStatus:409};
 }catch{return {ok:false,code:'plan_outcome_unconfirmed',httpStatus:503}}
}
module.exports={enqueueSavedPlan};
