import {hydrateQuestionExplanationPending,matchesQuestionExplanationOperation,explanationPendingIdentity} from './explanationPendingStore';
import {pendingReplacement,setPendingReplacement,recoverReplacement} from "./explanationReplacementClient";
import {pendingGeneration,setPendingGeneration,recoverGeneration} from './generationRequestClient';
import {readJsonEvents} from "./explanationStream";
// One paid request per question in this browser. Navigation recovery only reads.
function put(k:string,v:string){try{localStorage.setItem(k,v)}catch{}}
function remove(k:string){try{localStorage.removeItem(k)}catch{}}
const drafts=new Map<string,string>();
export function explanationDraft(id:string){return drafts.get(id)||""}
function draft(id:string,text:string){if(text)drafts.set(id,text);else drafts.delete(id);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent('explanation-draft',{detail:{id,text}}))}
const active=new Map<string,Promise<Response>>();
const key=(id:string)=>`anatomy-explanation-pending-v1:${id}`;
const metricKey=(id:string)=>`anatomy-explanation-timing-v1:${id}`;
export function pendingExplanation(id:string){try{return Number(localStorage.getItem(key(id)))||0}catch{return 0}}
export function explanationTiming(id:string){try{return JSON.parse(localStorage.getItem(metricKey(id))||'null')}catch{return null}}
export async function recoverExplanation(id:string){
 const response=await fetch(`/api/question-background-data?kind=explanations&ids=${encodeURIComponent(id)}`,{cache:'no-store'});
 if(!response.ok)return null;const data=await response.json();const row=data.overrides?.find((x:any)=>x.question_id===id);
 if(!row?.explanation)return null;
 return {ok:true,sharedSaved:true,explanation:row.explanation,optionAnalysis:row.option_analysis||{},memoryTip:row.memory_tip||'',model:row.model,readingFormat:row.reading_format === "full-v1" ? "full-v1" as const : null,updatedAt:row.updated_at};
}
export async function requestExplanation(_url:string,init:RequestInit,isCurrent:()=>boolean=()=>true):Promise<Response>{
 let id:string,body:any;try{body=JSON.parse(String(init.body));id=body.question.id}catch{return fetch(_url,init)}
 const existing=active.get(id);if(existing)return (await existing).clone();
 const replacing=body.action==="replace";
 let dispatched=false,priorOperationKnown=false;
 const task=(async()=>{
  try{
   await hydrateQuestionExplanationPending(id);
 const previousReplacement=pendingReplacement(id);
 const previousGeneration=pendingGeneration(id);
 const prior=pendingExplanation(id),started=previousReplacement?.startedAt||previousGeneration?.startedAt||prior||Date.now();
   priorOperationKnown=Boolean(previousReplacement||previousGeneration||prior);
   if(previousReplacement){const saved=await recoverReplacement(id,body.accessToken);if(saved){remove(key(id));return Response.json(saved);}return Response.json({ok:false,code:"replacement_pending",message:"先前替換仍在確認中，不會重複生成。"},{status:409});}
   if(previousGeneration){const saved=await recoverGeneration(id,body.accessToken);if(saved){remove(key(id));return Response.json(saved);}const existing=await recoverExplanation(id);if(existing){return Response.json({...existing,generationPending:true})}return Response.json({ok:false,code:'generation_pending',message:'先前請求仍在確認中，不會重複生成。'},{status:409})}
   if(prior){const saved=await recoverExplanation(id);if(saved){remove(key(id));return Response.json(saved)}return Response.json({ok:false,code:'request_pending',message:'先前請求仍在確認中，請稍後查看；不會重複生成。'},{status:409})}
   if(!isCurrent())return Response.json({ok:false,code:"context_changed",message:"頁面或帳號已變更，未開始新請求。"},{status:409});
   if(!replacing){body.operationId=crypto.randomUUID();init={...init,body:JSON.stringify(body)}}
   const prepared={operationId:body.operationId,startedAt:started,clientNonce:crypto.randomUUID(),...(replacing?{kind:"replace" as const}:{})};
   const expectedIdentity=explanationPendingIdentity(prepared);
   const retained=replacing?await setPendingReplacement(id,{...prepared,kind:"replace"}):await setPendingGeneration(id,prepared);
   if(retained===false)throw Error("無法保存請求識別：這題已有其他請求，尚未送出新的請求。");
   if(!isCurrent()){try{if(replacing)await setPendingReplacement(id,null,expectedIdentity);else await setPendingGeneration(id,null,expectedIdentity)}catch{}return Response.json({ok:false,code:"context_changed",message:"頁面或帳號已變更，未開始新請求。"},{status:409});}
   put(key(id),String(started));
   let firstTextMs:number|null=null;
   dispatched=true;
   let response=await fetch(_url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),Accept:'text/event-stream'}});
   if(response.headers.get('content-type')?.includes('text/event-stream')){
    if(!response.body)throw Error('stream missing');let final:{status:number;data:any}|null=null;
    await readJsonEvents(response.body,event=>{
     if(event.type==='draft'&&typeof event.text==='string'&&event.text.length<=100000){firstTextMs ??= Date.now()-started;draft(id,event.text)}
     if(event.type==='result'&&Number.isInteger(event.status)&&event.status>=200&&event.status<600&&event.data)final={status:event.status,data:event.data};
    });
    if(!final)throw Error('stream outcome unconfirmed');
    const confirmed=final as {status:number;data:any};response=Response.json(confirmed.data,{status:confirmed.status});
   }
   const data=await response.clone().json();
   if(!await matchesQuestionExplanationOperation(id,expectedIdentity))return Response.json({ok:false,code:"operation_superseded",message:"此題已有較新的操作，舊回覆未覆蓋目前內容。"},{status:409});
   if(data.ok&&data.explanation){/* Replacement identity stays durable until publishReplacement applies the confirmed version, including after navigation. */if(!replacing){try{if(await setPendingGeneration(id,null,expectedIdentity)===false)return Response.json({ok:false,code:"operation_superseded",message:"此題已有較新的操作，舊回覆未覆蓋目前內容。"},{status:409})}catch{/* Saved response remains valid; keep identity for exact recovery. */}}remove(key(id));put(metricKey(id),JSON.stringify({startedAt:started,firstTextMs:firstTextMs??Date.now()-started,textMs:Date.now()-started,model:data.model,delivery:data.delivery||null}));}
   else if(response.status===401||['unavailable','sitewide_admission_unavailable','question_busy','review_snapshot_unavailable','reviewed_protected','busy','actor_busy','rate','cooldown','account_banned','guard_unavailable','run_window_expired','budget','safe_configuration_missing','reviewed_explanation_protected','untrusted_question','authentication_required','trusted_context_missing','source_image_not_supported','invalid_replacement','replacement_version_changed','trusted_question_incomplete','incomplete_explanation','replacement_not_written','generation_journal_required','generation_not_written'].includes(data.code)){remove(key(id));try{if(replacing)await setPendingReplacement(id,null,expectedIdentity);else await setPendingGeneration(id,null,expectedIdentity)}catch{/* Keep the terminal response and its old identity; never replay it. */}}
   return Response.json({...data,clientRequestIdentity:expectedIdentity},{status:response.status});
  }catch(error){return Response.json({ok:false,code:dispatched||priorOperationKnown?'request_outcome_unconfirmed':'request_not_sent',message:dispatched||priorOperationKnown?'詳解請求的結果尚未確認。已保留原請求，不會重複生成。':error instanceof Error&&error.message.startsWith('無法')?error.message:'請求準備未完成，尚未送出。原詳解與作答紀錄都保留。'},{status:503})}
 })();active.set(id,task);
 try{return (await task).clone()}finally{active.delete(id);draft(id,"")}
}
export async function recoverPendingExplanation(id:string,accessToken?:string){
 await hydrateQuestionExplanationPending(id);
 if(pendingReplacement(id)){const recovered=await recoverReplacement(id,accessToken);if(recovered)remove(key(id));return recovered;}
 const pending=pendingGeneration(id),expectedIdentity=pending?explanationPendingIdentity(pending):null;
 const recovered=pending?await recoverGeneration(id,accessToken):null;
 if(recovered?.closed){remove(key(id));return recovered}
 const saved=recovered||(!pending?await recoverExplanation(id):null);
 if(saved){
  const storage=await import('@/lib/storage');
  // Import and recovery both yield. A later operation may have completed since
  // our status read, including restore reusing the same server revision.
  if(expectedIdentity&&!await matchesQuestionExplanationOperation(id,expectedIdentity))return null;
  if(!expectedIdentity){await hydrateQuestionExplanationPending(id);if(pendingGeneration(id)||pendingReplacement(id))return null;}
  const started=pendingExplanation(id);if(started)put(metricKey(id),JSON.stringify({startedAt:started,textMs:Date.now()-started,model:saved.model,source:'recovered'}));
  remove(key(id));storage.saveQuestionExplanationOverride(id,{...saved,updatedAt:new Date().toISOString()});window.dispatchEvent(new CustomEvent('explanation-recovered',{detail:{id,saved}}));
 }
 return saved;
}
