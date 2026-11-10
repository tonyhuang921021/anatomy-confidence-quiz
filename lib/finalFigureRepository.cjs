'use strict';
const {randomUUID}=require('node:crypto');
const {DECODER_REVISION,policySnapshot,sha}=require('./figureModelEvidence.cjs');
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
  async prepare(key,binding,policy){
   const id=pending.get(key);if(!id)throw Error('operation missing');
   const evidence=await rpc('figure_model_read_response',{p_operation:id});
   if(evidence?.state!=='sent'||evidence.canDispatch!==true||evidence.decoderRevision!==DECODER_REVISION||evidence.key!==key||!same(evidence.binding,binding)||!same(evidence.policy,policySnapshot(policy))||evidence.responseSha!==null)throw Error('journal unavailable');
   return true;
  },
  async storeResponse(key,binding,bytes,httpStatus){
   const operationId=pending.get(key);if(!operationId)throw Error('operation missing');
   const digest=sha(bytes);
   const result=await rpc('figure_model_store_response',{p_operation:operationId,p_binding:binding,p_bytes:'\\x'+bytes.toString('hex'),p_http_status:httpStatus,p_sha:digest,p_decoder:DECODER_REVISION});
   if(result?.saved!==true||result.responseSha!==digest)throw Error('response not confirmed');
   return true;
  },
  readResponse:operationId=>rpc('figure_model_read_response',{p_operation:operationId}),
  async markUnknown(key){const id=pending.get(key);if(id)await rpc('figure_model_unknown',{p_operation:id})},
  status:operationId=>rpc('figure_model_status',{p_operation:operationId}),
  // Caller supplies verified completed provider evidence, never resends provider.
  reconcile:({operationId,binding,verdict,responseId,responseSha,costMicroUsd})=>rpc('figure_model_commit',{p_operation:operationId,p_binding:binding,p_verdict:verdict,p_response:responseId,p_response_sha:responseSha,p_cost:costMicroUsd})
 };
}
function same(a,b){return a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>typeof b[k]==='object'?same(a[k],b[k]):a[k]===b[k])}
module.exports={createFinalFigureRepository};
