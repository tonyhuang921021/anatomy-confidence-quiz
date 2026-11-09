"use client";

import {hydrateQuestionExplanationPending} from "@/lib/explanationPendingStore";
import {useAuth} from "@/components/AuthProvider";
import {pendingReplacement} from "@/lib/explanationReplacementClient";
import {pendingGeneration} from '@/lib/generationRequestClient';
import {pendingExplanation,recoverPendingExplanation,explanationTiming,explanationDraft} from "@/lib/explanationRequestClient";
import { useDeferredValue, useEffect, useState } from "react";
import {
  advanceGenerationStatus,
  INITIAL_GENERATION_STATUS,
  type GenerationSignal
} from "@/lib/explanationGenerationStatus";
import {StructuredExplanationText} from "./StructuredExplanationText";
import {ExplanationProgressCat} from "./ExplanationProgressCat";
import styles from "./ExplanationGenerationStatus.module.css";

export function ExplanationGenerationStatus({ questionId, loading, error, resultVersion, recoveryKind="all", activityLabel }: GenerationSignal & {recoveryKind?:"all"|"generation"|"replacement";activityLabel?:string}) {
  const {session}=useAuth();
  const [preview,setPreview]=useState({id:questionId,text:""});
  const draft=useDeferredValue(preview.id===questionId?preview.text:"");
  useEffect(()=>{setPreview({id:questionId,text:explanationDraft(questionId)});const update=(event:Event)=>{const d=(event as CustomEvent).detail;if(d.id===questionId)setPreview({id:questionId,text:d.text})};window.addEventListener('explanation-draft',update);return()=>window.removeEventListener('explanation-draft',update)},[questionId]);
  const [pendingHydrated,setPendingHydrated]=useState({id:"",ready:false});
  useEffect(()=>{let cancelled=false;setPendingHydrated({id:questionId,ready:false});void hydrateQuestionExplanationPending(questionId).then(()=>{if(!cancelled)setPendingHydrated({id:questionId,ready:true})}).catch(()=>{});return()=>{cancelled=true}},[questionId,session?.access_token]);
  const [timing,setTiming]=useState<any>(null);
  useEffect(()=>{setTiming(!loading&&resultVersion?explanationTiming(questionId):null)},[questionId,loading,resultVersion]);
  const timingCaption=timing?.source==='recovered'?"已讀取背景完成的詳解":timing?`開始顯示 ${(Number(timing.firstTextMs??timing.textMs)/1000).toFixed(1)} 秒 · 全文 ${(Number(timing.textMs)/1000).toFixed(1)} 秒`:"";
  const [state, setState] = useState(INITIAL_GENERATION_STATUS);
  const [recovering,setRecovering]=useState(false);const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{if(pendingHydrated.id!==questionId||!pendingHydrated.ready)return;const replacement=pendingReplacement(questionId);if((recoveryKind==="generation"&&replacement)||(recoveryKind==="replacement"&&!replacement)){setRecovering(false);return}const hasOperation=replacement||pendingGeneration(questionId);if(loading||(resultVersion&&!hasOperation)||(!pendingExplanation(questionId)&&!hasOperation)){setRecovering(false);return}let cancelled=false,timer:ReturnType<typeof setTimeout>;let checks=0;setRecovering(true);const check=async()=>{try{if(await recoverPendingExplanation(questionId,session?.access_token)){if(!cancelled)setRecovering(false);return}}catch{}if(cancelled)return;if(++checks<24)timer=setTimeout(check,5000);else setRecovering(false)};void check();return()=>{cancelled=true;clearTimeout(timer)}},[questionId,loading,resultVersion,session?.access_token,recoveryKind,pendingHydrated]);
  useEffect(()=>{if(!loading&&!recovering)return;const start=pendingExplanation(questionId)||Date.now();const tick=()=>setElapsed(Math.max(0,Math.floor((Date.now()-start)/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[questionId,loading,recovering]);
  const activeLoading=loading||(recovering&&!resultVersion);
  const visibleError = recovering ? null : error;
  const signal = { questionId, loading:activeLoading, error:visibleError, resultVersion };
  const next = advanceGenerationStatus(state, signal);
  useEffect(() => {
    setState((previous) => advanceGenerationStatus(previous, { questionId, loading:activeLoading, error:visibleError, resultVersion }));
  }, [questionId, activeLoading, visibleError, resultVersion]);

  if (next.phase === "idle") return timingCaption&&resultVersion ? <p className="my-2 text-xs leading-6 text-slate-600" aria-label="最近一次詳解請求時間">{timingCaption}</p> : null;
  const complete = next.phase === "complete";
  return (
    <>
    <div className={styles.status} data-phase={next.phase} role="status" aria-live="polite" aria-atomic="true" aria-busy={!complete}>
      <ExplanationProgressCat complete={complete}/>
      <div className={styles.copy}>
        <span className={styles.label}>{complete ? "詳解完成" : recovering ? "正在確認既有請求" : activityLabel || "詳解生成中"}</span>
        <span className={styles.caption}>{complete ? timingCaption || "可開始閱讀" : `${elapsed} 秒 · ${elapsed>=60?"仍在處理，可離開後返回查看":draft?"文字持續補上中，可先閱讀":"正在準備詳解"}`}</span>
      </div>
    </div>
    {activeLoading&&draft&&<div className="min-w-0 w-full max-w-full space-y-3" aria-label="詳解生成中，內容尚未完成" aria-live="off"><StructuredExplanationText text={draft} label="詳解 · 生成中"/></div>}
    </>
  );
}
