"use client";
import { useEffect, useMemo, useState } from "react";
import type { Question, QuizSession } from "@/types/quiz";
import { getSessionComparisonPaper } from "@/lib/simulationComparisonCatalog";
import { isMatchingSubjectStats, scoreOwnCompletePaper,
  type ComparisonPaper, type SubjectCount, type PaperSubjectStats } from "@/lib/simulationSubjectComparison";

export type ResultsSubjectComparison = {
  paper: ComparisonPaper | null; stats: PaperSubjectStats | null; loading: boolean; ready: boolean;
};

// One bounded request for the original results page; personal scores render immediately.
export function useSimulationSubjectComparison(session: QuizSession | null, questions: Question[]): ResultsSubjectComparison {
  const paper=useMemo(()=>{
    if(!session) return null;
    const known=getSessionComparisonPaper(session);
    if(!known || questions.length!==known.questions.length) return null;
    const map=new Map(questions.map(q=>[q.id,q]));
    if(map.size!==known.questions.length || !known.questions.every(q=>map.has(q.id))) return null;
    // Bind to the exact questions/classifications currently shown on this page.
    const current={...known,questions:known.questions.map(q=>map.get(q.id)!)};
    return scoreOwnCompletePaper(current,session) ? current : null;
  },[session,questions]);
  const [remote,setRemote]=useState<{paper:ComparisonPaper;value:PaperSubjectStats|null;loading:boolean}|null>(null);
  useEffect(()=>{
    if(!paper) return;
    const controller=new AbortController();
    setRemote({paper,value:null,loading:true});
    const timer=setTimeout(()=>controller.abort(),10000);
    let mounted=true;
    void fetch(`/api/simulation-subject-stats?paperKey=${encodeURIComponent(paper.key)}`,{signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error("unavailable");const value:unknown=await r.json();if(!isMatchingSubjectStats(value,paper))throw Error("mismatch");return value;})
      .then(value=>{if(mounted)setRemote({paper,value,loading:false});})
      .catch(()=>{if(mounted)setRemote({paper,value:null,loading:false});})
      .finally(()=>clearTimeout(timer));
    return()=>{mounted=false;clearTimeout(timer);controller.abort();};
  },[paper]);
  const current=remote?.paper===paper ? remote:null;
  const stats=current?.value ?? null;
  return {paper,stats,loading:Boolean(paper && (!current || current.loading)),ready:Boolean(paper && stats?.available && isMatchingSubjectStats(stats,paper))};
}

export function SubjectAverageCaption({row,comparison}:{row:SubjectCount;comparison:ResultsSubjectComparison}) {
  const matching=comparison.ready ? comparison.stats!.subjects.find(s=>s.subject===row.subject && s.total===row.total) : undefined;
  const average=matching ? Math.round(matching.averageCorrect*10)/10 : null;
  const delta=average===null ? null : Math.round((row.correct-average)*10)/10;
  return <div className="mt-2 text-[13px] leading-5 text-slate-600">
    <p>同卷平均 {average===null ? comparison.loading ? "讀取中" : "—" : `${average.toFixed(1)} 題`}</p>
    {delta!==null ? <p className={delta<0 ? "text-amber-800":"text-brand-700"}>
      {delta===0 ? "與平均持平" : `比平均${delta<0?"少":"多"} ${Math.abs(delta).toFixed(1)} 題`}
    </p>:null}
  </div>;
}

export function SubjectComparisonFootnote({comparison}:{comparison:ResultsSubjectComparison}) {
  const {paper,stats,loading,ready}=comparison;
  return <div className="mt-3 text-xs leading-5 text-slate-500">
    <p role="status">{!paper ? "同卷平均僅適用於題目可完整核對的已完成固定考卷。"
      : loading ? "正在讀取同卷平均；你的成績已可查看。"
      : ready ? `參考同卷 ${stats!.sampleCount} 個帳號的完整作答，各科使用同一批人及本頁分類。`
      : stats?.reason==="insufficient" ? "同卷有效樣本未滿 5 個帳號，暫不顯示平均與差距。"
      : "同卷平均暫時無法讀取；你的成績不受影響。"}</p>
    <details className="mt-1">
      <summary className="cursor-pointer rounded py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">平均怎麼算？</summary>
      <p className="mt-1">從這份卷最近 100 筆已同步完成紀錄中，每個帳號取最新一份可完整核對的作答，可能包含你已同步的作答。重複題、缺題、混卷與無法核對的紀錄不納入，沿用既有整卷統計排除正確率四捨五入後不高於 3% 的紀錄。</p>
      <p>參考群依目前答案、採計規則與本頁網站分類計算答對題數，含一律給分及複數採計；不改寫歷史成績。這是網站同卷參考，並非全體考生、能力配對群或官方配分。</p>
      <p>至少 5 個不同帳號才顯示平均；資料有快取，並非即時成績。資料不足、讀取失敗或分類不一致時不顯示平均與差距。各科題數不同，差距僅供本卷複習參考。</p>
    </details>
  </div>;
}
