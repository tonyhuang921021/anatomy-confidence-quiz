"use client";
import {useEffect,useRef,useState} from "react";
import {useAuth} from "@/components/AuthProvider";
import {pendingExplanation} from "@/lib/explanationRequestClient";
import {pendingGeneration} from "@/lib/generationRequestClient";
import {pendingReplacement,publishReplacement,replacementAction,setPendingReplacement} from "@/lib/explanationReplacementClient";
import {replaceExplanationInline} from "@/lib/inlineExplanationReplacement";
import {ExplanationGenerationStatus} from "@/components/ExplanationGenerationStatus";

type Activity="replace"|"recover"|"restore"|"inspect"|null;
export function ExplanationReplacementControls({questionId,onStart}:{questionId:string;onStart?:()=>void}){
 const {session}=useAuth();
 const [activity,setActivity]=useState<Activity>(null),[message,setMessage]=useState(""),[error,setError]=useState<string|null>(null);
 const [ready,setReady]=useState<{baseVersion:string;revision?:string;canRestore:boolean}|null>(null);
 const [pending,setPending]=useState(false),[resultVersion,setResultVersion]=useState<string|undefined>();
 const context=useRef(0),actionLock=useRef(false);
 const busy=activity!==null;
 useEffect(()=>{context.current++;setReady(null);setMessage("");setError(null);setActivity(null);setPending(Boolean(pendingReplacement(questionId)));setResultVersion(undefined);actionLock.current=false;return()=>{context.current++;};},[questionId,session?.access_token]);
 async function replace(){
  if(actionLock.current)return;
  onStart?.();setMessage("");setError(null);setResultVersion(undefined);
  if(!session?.access_token){setMessage("請先登入，才能替換詳解。");return;}
  actionLock.current=true;setActivity("replace");setReady(null);const epoch=context.current;
  try{
   const result=await replaceExplanationInline({questionId,accessToken:session.access_token,isCurrent:()=>context.current===epoch,onRecovering:()=>{if(context.current===epoch)setActivity("recover");}});
   if(context.current!==epoch||result.kind==='stale')return;
   setMessage(result.message);if(result.kind==='replaced')setResultVersion(result.version);
  }catch(error){if(context.current===epoch){const text=error instanceof Error?error.message:"操作結果尚未確認，不會自動重送。";setMessage(text);setError(text);}}
  finally{if(context.current===epoch){actionLock.current=false;setActivity(null);setPending(Boolean(pendingReplacement(questionId)));}}
 }
 async function inspect(){
  if(actionLock.current)return;
  if(!session?.access_token){setMessage("請先登入，才能查看可還原的版本。");return;}
  actionLock.current=true;setActivity("inspect");const epoch=context.current;
  try{const status=await replacementAction(questionId,session.access_token,"status");if(context.current===epoch){setReady(status.status==='ready'?status:null);setMessage(status.canRestore?'可還原自己最近一次替換前的詳解。':'目前沒有可還原的替換版本。');}}
  catch{if(context.current===epoch)setMessage("無法確認還原狀態，原詳解保持不變。");}
  finally{if(context.current===epoch){actionLock.current=false;setActivity(null);}}
 }
 async function restore(){
  if(actionLock.current||!ready?.canRestore||!ready.revision||!session?.access_token)return;
  if(pendingReplacement(questionId)||pendingGeneration(questionId)||pendingExplanation(questionId)){setMessage("先前請求仍在確認中，尚未開始還原。");return;}
  const epoch=context.current;actionLock.current=true;setActivity("restore");setMessage("");setError(null);setResultVersion(undefined);onStart?.();
  try{
   setPendingReplacement(questionId,{kind:'restore',operationId:ready.revision,startedAt:Date.now()});
   const restored=await replacementAction(questionId,session.access_token,"restore",ready.revision,ready.baseVersion);
   if(context.current!==epoch)return;
   if(restored.status!=="restored"){
    if(["replacement_version_changed","not_found","pending","unavailable"].includes(restored.status))setPendingReplacement(questionId,null);
    throw Error(restored.status==="replacement_version_changed"?"詳解已有較新版本，未還原。請重新確認。":"目前不能還原，原文保持不變。");
   }
   publishReplacement(questionId,restored.value);setReady(null);setMessage("已還原先前詳解與對應配圖。");setResultVersion(new Date().toISOString());
  }catch(error){if(context.current===epoch){const text=error instanceof Error?error.message:"還原結果尚未確認，不會自動重送。";setMessage(text);setError(text);}}
  finally{if(context.current===epoch){actionLock.current=false;setActivity(null);setPending(Boolean(pendingReplacement(questionId)));}}
 }
 return <div className="min-w-0 w-full space-y-2" aria-label="替換詳解與進度">
  <div className="flex flex-wrap items-center gap-2">
   <button type="button" onClick={()=>void replace()} disabled={busy} className="inline-flex min-h-10 items-center rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60">{busy?(activity==='recover'?"確認先前結果中…":activity==='replace'?"替換詳解中…":"處理中…"):pending?"確認先前替換結果":"替換詳解"}</button>
   <details className="text-xs text-slate-500"><summary className="cursor-pointer px-2 py-2">版本選項</summary><div className="mt-1 flex flex-wrap gap-2">
    <button type="button" disabled={busy} onClick={()=>void inspect()} className="min-h-10 rounded-lg border px-3 py-2 disabled:opacity-60">查看可還原版本</button>
    {ready?.canRestore?<button type="button" disabled={busy} onClick={()=>void restore()} className="min-h-10 rounded-lg border px-3 py-2 disabled:opacity-60">還原上次替換前的詳解</button>:null}
   </div></details>
  </div>
  <ExplanationGenerationStatus questionId={questionId} loading={busy&&activity!=="inspect"} error={error} resultVersion={resultVersion} recoveryKind="replacement" activityLabel={activity==='recover'?"正在確認先前請求":activity==='restore'?"正在還原詳解":"詳解替換中"}/>
  {message?<p role="status" className="text-sm text-slate-600">{message}</p>:null}
 </div>;
}
