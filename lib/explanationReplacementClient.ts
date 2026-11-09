import {cachedExplanationPending,replacementPendingKey as key,writeExplanationPending,hydrateQuestionExplanationPending,matchesQuestionExplanationOperation,explanationPendingIdentity} from './explanationPendingStore';
import type {QuestionExplanationOverride} from "@/types/quiz";
import {applyConfirmedExplanationVersion} from "@/lib/storage";
import {clearQuestionExplanationBackgroundCache} from "@/lib/cloudSync";
export type ReplacementPending={operationId:string;startedAt:number;kind:"replace"|"restore";clientNonce?:string};
export function pendingReplacement(id:string):ReplacementPending|null{try{const value=JSON.parse(cachedExplanationPending(key(id))||"null");return value&&typeof value.operationId==="string"&&Number.isFinite(value.startedAt)&&["replace","restore"].includes(value.kind)?value:null;}catch{return null;}}
export async function setPendingReplacement(id:string,value:ReplacementPending|null,expectedIdentity?:string){if(!await writeExplanationPending(key(id),value?JSON.stringify(value):null,expectedIdentity))return false;try{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("explanation-replacement-pending-changed",{detail:{id,pending:Boolean(value)}}));}catch{}}
export async function replacementAction(id:string,token:string,action:"status"|"restore",operationId?:string,baseVersion?:string){
 const response=await fetch("/api/explanation-replacement",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({questionId:id,action,operationId,baseVersion})});
 const result=await response.json();if(!response.ok||!result.ok)throw Error("替換狀態暫時無法確認；原詳解仍可閱讀。");return result;
}
export async function publishReplacement(id:string,value:QuestionExplanationOverride|null,expectedIdentity:string){
 if(!await matchesQuestionExplanationOperation(id,expectedIdentity))return {cleanupPending:true,stale:true};
 clearQuestionExplanationBackgroundCache(id);applyConfirmedExplanationVersion(id,value);try{const cleared=await setPendingReplacement(id,null,expectedIdentity);return {cleanupPending:cleared===false,stale:false}}catch{return {cleanupPending:true,stale:false}}
}
export async function recoverReplacement(id:string,token?:string){
 await hydrateQuestionExplanationPending(id);
 const pending=pendingReplacement(id);if(!pending||!token)return null;
 const expectedIdentity=explanationPendingIdentity(pending);
 const result=await replacementAction(id,token,"status",pending.operationId);
 if(!await matchesQuestionExplanationOperation(id,expectedIdentity))return null;
 if(result.status==="not_written"){try{await setPendingReplacement(id,null,expectedIdentity)}catch{/* Exact terminal result is known; retain failed-cleanup identity. */}return {ok:false,closed:true,message:"先前請求已結束，沒有替換原詳解。"};}
 if(["restored","superseded"].includes(result.status)||(pending.kind==="replace"&&result.status==="completed")){
  const applied=await publishReplacement(id,result.value,expectedIdentity);if(applied.stale)return null;return {ok:true,...result.value,restored:!result.value};
 }
 // not_found/pending/unknown are not proof that a timed-out original never ran.
 return null;
}
