import {cachedExplanationPending,generationPendingKey as key,writeExplanationPending,hydrateQuestionExplanationPending,matchesQuestionExplanationOperation,explanationPendingIdentity} from './explanationPendingStore';
export type GenerationPending={operationId:string;startedAt:number;clientNonce?:string};
export function pendingGeneration(id:string):GenerationPending|null{
 try{const v=JSON.parse(cachedExplanationPending(key(id))||'null');return v&&typeof v.operationId==='string'&&/^[0-9a-f-]{36}$/i.test(v.operationId)&&Number.isFinite(v.startedAt)?v:null}catch{return null}
}
export async function setPendingGeneration(id:string,value:GenerationPending|null,expectedIdentity?:string){return writeExplanationPending(key(id),value?JSON.stringify(value):null,expectedIdentity)}
export async function recoverGeneration(id:string,token?:string){
 await hydrateQuestionExplanationPending(id);
 const pending=pendingGeneration(id);if(!pending||!token)return null;
 const expectedIdentity=explanationPendingIdentity(pending);
 const r=await fetch('/api/explanation-generation',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({questionId:id,operationId:pending.operationId})});
 if(!r.ok)return null;const data=await r.json();
 if(!await matchesQuestionExplanationOperation(id,expectedIdentity))return null;
 if(data.ok&&data.status==='completed'&&typeof data.value?.explanation==='string'){try{if(await setPendingGeneration(id,null,expectedIdentity)===false)return null}catch{/* Keep confirmed server result readable; original identity remains held. */}return {ok:true,sharedSaved:true,...data.value,clientRequestIdentity:expectedIdentity}}
 if(data.ok&&data.status==='not_written'){try{if(await setPendingGeneration(id,null,expectedIdentity)===false)return null}catch{/* Keep confirmed server result readable; original identity remains held. */}return {ok:false,closed:true,code:'generation_not_written',message:'先前生成已結束，沒有寫入或替換詳解。'}}
 // Missing/unknown/temporary errors are never proof that dispatch did not occur.
 return null;
}
