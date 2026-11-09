import {pendingExplanation,recoverPendingExplanation,requestExplanation} from './explanationRequestClient';
import {pendingGeneration} from './generationRequestClient';
import {pendingReplacement,publishReplacement,replacementAction} from './explanationReplacementClient';

// One explicit click is either recovery OR a new replacement, never both.
// The UI owns its synchronous click lock; requestExplanation keeps the durable
// operation identity and shared same-question lock across components/navigation.
export async function replaceExplanationInline({questionId,accessToken,isCurrent,onRecovering}: {
 questionId:string;accessToken:string;isCurrent:()=>boolean;onRecovering?:()=>void;
}) {
 if(pendingReplacement(questionId)||pendingGeneration(questionId)||pendingExplanation(questionId)) {
  onRecovering?.();
  const saved=await recoverPendingExplanation(questionId,accessToken);
  if(!isCurrent())return {kind:'stale' as const};
  if(!saved)return {kind:'pending' as const,message:'先前請求仍在確認中，不會再送生成請求。原詳解可繼續閱讀。'};
  return {kind:'recovered' as const,message:saved.closed?'先前請求已結束，原詳解保持不變。請再按替換才會開始新請求。':'已讀取先前請求的結果，沒有重新生成。'};
 }
 const status=await replacementAction(questionId,accessToken,'status');
 if(!isCurrent())return {kind:'stale' as const};
 if(status.status!=='ready'||typeof status.baseVersion!=='string')throw Error('替換功能暫時不可用，原詳解仍可閱讀。');
 const response=await requestExplanation('/api/question-explanation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'replace',operationId:crypto.randomUUID(),baseVersion:status.baseVersion,accessToken,question:{id:questionId}})});
 const value=await response.json();
 if(!isCurrent())return {kind:'stale' as const};
 if(!response.ok||!value.ok||!value.explanation||!value.replacementRevision)throw Error(value.message||'替換尚未完成，原詳解仍可閱讀。');
 publishReplacement(questionId,{...value,updatedAt:value.updatedAt||new Date().toISOString()});
 return {kind:'replaced' as const,message:'已保存新的詳解，原版已保留。',version:value.updatedAt||new Date().toISOString()};
}
