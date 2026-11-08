'use strict';
// Service-only adapter. Missing capabilities always hold before dispatch.
// An operation ID identifies one actor/question attempt, never a retry ticket.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validOperationId(value){return typeof value==='string'&&UUID.test(value)}
function savedValue(row){return row&&typeof row.explanation==='string'?{explanation:row.explanation,optionAnalysis:row.option_analysis??{},memoryTip:row.memory_tip??'',model:row.model,updatedAt:row.updated_at,readingFormat:row.reading_format??null}:null}
function outcome(data,questionId){
 if(!data||typeof data!=='object')return {state:'pending'};
 if(data.status==='missing')return null;
 if(data.status==='not_written')return {state:'not_written'};
 if(['completed','superseded'].includes(data.status)&&data.value?.question_id===questionId){const value=savedValue(data.value);if(value)return {state:'completed',value}}
 return {state:'pending'};
}
function createGenerationJournal({db,needsFor=async()=>null,stageRpc='explanation_generation_stage'}){
 const read=async(name,{operationId,actorId,questionId})=>{
  if(!validOperationId(operationId)||!actorId||!questionId)throw Error('invalid generation operation');
  const r=await db.rpc(name,{p_id:operationId,p_actor:actorId,p_question:questionId});
  if(r.error)throw Error('generation journal unavailable');
  return outcome(r.data,questionId);
 };
 return {
  generationJournal:true,
  readGeneration:args=>read('explanation_generation_status',args),
  recoverGeneration:args=>read('explanation_generation_recover',args),
  async checkpointGeneration(grant,seq,response){
   if(seq!==1||!validOperationId(grant.leaseId)||!grant.actorId||!Array.isArray(grant.requiredOptions)||!grant.requiredOptions.length||grant.requiredOptions.some(x=>!/^[A-E]$/.test(x)))return false;
   let needs=null;try{needs=await needsFor(response)}catch{/* Optional images must never lose the paid text response. */}
   const r=await db.rpc(stageRpc,{p_id:grant.leaseId,p_actor:grant.actorId,p_options:grant.requiredOptions,p_response:{...response,needs}});
   return !r.error&&r.data==='saved';
  }
 };
}
module.exports={validOperationId,savedValue,outcome,createGenerationJournal};
