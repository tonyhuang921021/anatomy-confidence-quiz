'use strict';
const {randomUUID}=require('node:crypto');
function createFinalFigureRepository(db,candidateId){
 const pending=new Map();
 const rpc=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw Error(name+' unavailable');return data};
 return {
  async reserve(binding){
   const operationId=randomUUID();
   const result=await rpc('figure_model_reserve',{p_operation:operationId,p_candidate:candidateId,p_key:binding.key,p_binding:Object.fromEntries(Object.entries(binding).filter(([k])=>!['key','model','pricingRevision','reserveMicroUsd'].includes(k))),p_model:binding.model,p_pricing:binding.pricingRevision,p_cost:binding.reserveMicroUsd});
   if(result?.operationId)pending.set(binding.key,result.operationId);
   if(result?.status==='committed'&&result.operationId){const state=await rpc('figure_model_status',{p_operation:result.operationId});if(state?.status==='committed'&&state.candidateStatus==='rejected')return {dispatch:false,status:'withdrawn'};}
   if(result?.status!=='reserved'||!result.sendToken)return {dispatch:false,status:result?.status};
   pending.set(binding.key,operationId);
   // If this acknowledgment is lost, do not enter provider. SQL will retain
   // reserved/sent. A subsequent process can status/reconcile but never resend.
   const sent=await rpc('figure_model_sent',{p_operation:operationId,p_token:result.sendToken});
   return {dispatch:sent===true,status:sent?'sent':'held'};
  },
  async commit({key,binding,verdict,responseId,responseSha,costMicroUsd}){
   const operationId=pending.get(key);if(!operationId)throw Error('operation missing');
   return rpc('figure_model_commit',{p_operation:operationId,p_binding:binding,p_verdict:verdict,p_response:responseId,p_response_sha:responseSha,p_cost:costMicroUsd});
  },
  async markUnknown(key){const id=pending.get(key);if(id)await rpc('figure_model_unknown',{p_operation:id})},
  status:operationId=>rpc('figure_model_status',{p_operation:operationId}),
  // Caller supplies verified completed provider evidence, never resends provider.
  reconcile:({operationId,binding,verdict,responseId,responseSha,costMicroUsd})=>rpc('figure_model_commit',{p_operation:operationId,p_binding:binding,p_verdict:verdict,p_response:responseId,p_response_sha:responseSha,p_cost:costMicroUsd})
 };
}
module.exports={createFinalFigureRepository};
