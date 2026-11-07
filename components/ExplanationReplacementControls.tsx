"use client";
import {useEffect,useRef,useState} from "react";
import {useAuth} from "@/components/AuthProvider";
import {requestExplanation} from "@/lib/explanationRequestClient";
import {pendingExplanation} from "@/lib/explanationRequestClient";
import {pendingReplacement,publishReplacement,recoverReplacement,replacementAction,setPendingReplacement} from "@/lib/explanationReplacementClient";
import {ExplanationGenerationStatus} from "@/components/ExplanationGenerationStatus";

export function ExplanationReplacementControls({questionId}:{questionId:string}){
 const {session}=useAuth();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [ready,setReady]=useState<{baseVersion:string;revision?:string;canRestore:boolean}|null>(null);
 const [pending,setPending]=useState(false),[resultVersion,setResultVersion]=useState<string|undefined>();
 const context=useRef(0),button=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),actionLock=useRef(false);
 useEffect(()=>{const d=dialog.current;if(!open||!d)return;d.showModal();const overflow=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{d.close();document.body.style.overflow=overflow;button.current?.focus({preventScroll:true});};},[open]);
 useEffect(()=>{context.current++;setOpen(false);setReady(null);setMessage("");setBusy(false);setPending(Boolean(pendingReplacement(questionId)));setResultVersion(undefined);actionLock.current=false;return()=>{context.current++;};},[questionId,session?.access_token]);
 async function inspect(){
  setOpen(true);setMessage("");if(!session?.access_token){setMessage("請先登入，才能替換詳解。");return;}
  if(actionLock.current)return;actionLock.current=true;setBusy(true);const epoch=context.current;
  try{
   if(pendingReplacement(questionId)){
    const recovered=await recoverReplacement(questionId,session.access_token);
    if(context.current!==epoch)return;
    setPending(!recovered);if(!recovered){setMessage("先前操作仍在確認中，不會再送生成請求。原詳解可繼續閱讀。");return;}
   }
   const status=await replacementAction(questionId,session.access_token,"status");
   if(context.current!==epoch)return;
   if(status.status!=="ready")throw Error("替換功能暫時不可用，原詳解仍可閱讀。");
   setReady(status);
  }catch(error){if(context.current===epoch)setMessage(error instanceof Error?error.message:"無法確認替換狀態。");}
  finally{if(context.current===epoch){actionLock.current=false;setBusy(false);}}
 }
 async function perform(kind:"replace"|"restore"){
  if(actionLock.current||!ready||!session?.access_token||pendingReplacement(questionId))return;
  if(pendingExplanation(questionId)){setMessage("這題已有請求正在確認，請先等候原請求完成。");return;}
  const epoch=context.current;actionLock.current=true;setBusy(true);setMessage("");
  try{
   if(kind==="restore"){
    if(!ready.canRestore||!ready.revision)return;
    setPendingReplacement(questionId,{kind,operationId:ready.revision,startedAt:Date.now()});
    const restored=await replacementAction(questionId,session.access_token,"restore",ready.revision,ready.baseVersion);
    if(restored.status!=="restored"){
     if(["replacement_version_changed","not_found","pending","unavailable"].includes(restored.status))setPendingReplacement(questionId,null);
     throw Error(restored.status==="replacement_version_changed"?"詳解已有較新版本，未還原。請重新確認。":"目前不能還原，原文保持不變。");
    }
    publishReplacement(questionId,restored.value);
   }else{
    const response=await requestExplanation("/api/question-explanation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"replace",operationId:crypto.randomUUID(),baseVersion:ready.baseVersion,accessToken:session.access_token,question:{id:questionId}})});
    const value=await response.json();if(!response.ok||!value.ok||!value.explanation||!value.replacementRevision)throw Error(value.message||"替換尚未完成，原詳解仍可閱讀。");
    publishReplacement(questionId,{...value,updatedAt:value.updatedAt||new Date().toISOString()});
   }
   if(context.current===epoch){setReady(null);setMessage(kind==="restore"?"已還原先前詳解與對應配圖。":"已保存新的詳解，原版已保留。");setResultVersion(new Date().toISOString());}
  }catch(error){if(context.current===epoch)setMessage(error instanceof Error?error.message:"操作結果尚未確認，不會自動重送。");}
  finally{if(context.current===epoch){actionLock.current=false;setBusy(false);setPending(Boolean(pendingReplacement(questionId)));}}
 }
 return <div className="min-w-0 w-full">
  <button ref={button} type="button" onClick={()=>void inspect()} disabled={busy} className="flex min-h-10 items-center px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{pending?"確認先前替換結果":"替換詳解"}</button>
  {open?<dialog ref={dialog} className="m-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 shadow-xl" style={{width:"min(92vw,28rem)"}} aria-label="替換詳解確認" onCancel={e=>{e.preventDefault();e.stopPropagation();setOpen(false);}}><h2 className="mb-3 text-lg font-bold text-brand-900">替換詳解</h2>
   <p>重新生成後會更新這題的共享詳解，使用目前的詳解額度。原版會保留；你可以還原自己最近一次替換。</p>
   <p className="mt-1 text-xs text-slate-500">新文字保存前仍可讀原版。原配圖依文字版本保留，不會套到不相符的新段落。</p>
   {ready&&!pending?<div className="mt-3 flex flex-wrap gap-2">
    <button type="button" disabled={busy} onClick={()=>void perform("replace")} className="min-h-11 rounded-lg bg-brand-800 px-3 py-2 font-semibold text-white disabled:opacity-60">確認替換</button>
    {ready.canRestore?<button type="button" disabled={busy} onClick={()=>void perform("restore")} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-60">還原上次替換前的詳解</button>:null}
   </div>:null}
   {message?<p role="status" className="mt-2 text-sm text-slate-700">{message}</p>:null}
   {pending&&!busy?<button type="button" onClick={()=>void inspect()} className="mt-2 min-h-11 rounded-lg border px-3">只查詢處理結果</button>:null}
   <ExplanationGenerationStatus questionId={questionId} loading={busy&&Boolean(pendingReplacement(questionId))} error={null} resultVersion={resultVersion}/>
   <button type="button" onClick={()=>{setOpen(false);button.current?.focus();}} className="mt-2 min-h-10 px-2 text-slate-600">關閉</button>
  </dialog>:null}
 </div>;
}
