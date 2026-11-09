import type {QuestionExplanationOverride} from "@/types/quiz";
import {applyConfirmedExplanationVersion} from "@/lib/storage";
import {clearQuestionExplanationBackgroundCache} from "@/lib/cloudSync";
export type ReplacementPending={operationId:string;startedAt:number;kind:"replace"|"restore"};
const key=(id:string)=>`explanation-replacement-pending-v1:${id}`;
export function pendingReplacement(id:string):ReplacementPending|null{try{const value=JSON.parse(localStorage.getItem(key(id))||"null");return value&&typeof value.operationId==="string"&&Number.isFinite(value.startedAt)&&["replace","restore"].includes(value.kind)?value:null;}catch{return null;}}
export function setPendingReplacement(id:string,value:ReplacementPending|null){try{if(value)localStorage.setItem(key(id),JSON.stringify(value));else localStorage.removeItem(key(id));}catch{throw Error("無法保存請求識別，未開始替換。");}try{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("explanation-replacement-pending-changed",{detail:{id,pending:Boolean(value)}}));}catch{}}
export async function replacementAction(id:string,token:string,action:"status"|"restore",operationId?:string,baseVersion?:string){
 const response=await fetch("/api/explanation-replacement",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({questionId:id,action,operationId,baseVersion})});
 const result=await response.json();if(!response.ok||!result.ok)throw Error("替換狀態暫時無法確認；原詳解仍可閱讀。");return result;
}
export function publishReplacement(id:string,value:QuestionExplanationOverride|null){
 clearQuestionExplanationBackgroundCache(id);applyConfirmedExplanationVersion(id,value);setPendingReplacement(id,null);
}
export async function recoverReplacement(id:string,token?:string){
 const pending=pendingReplacement(id);if(!pending||!token)return null;
 const result=await replacementAction(id,token,"status",pending.operationId);
 if(result.status==="not_written"){setPendingReplacement(id,null);return {ok:false,closed:true,message:"先前請求已結束，沒有替換原詳解。"};}
 if(["restored","superseded"].includes(result.status)||(pending.kind==="replace"&&result.status==="completed")){
  publishReplacement(id,result.value);return {ok:true,...result.value,restored:!result.value};
 }
 // not_found/pending/unknown are not proof that a timed-out original never ran.
 return null;
}
