"use client";
import {usesFullGeneratedReading} from "@/lib/generatedExplanationReading";
import {loadQuestionExplanationOverride} from "@/lib/storage";
import {hasReviewedExplanation} from "@/lib/reviewedExplanations";
import {ExplanationReplacementControls} from "@/components/ExplanationReplacementControls";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, CircleOff, Layers3, MessageCircle, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { loadQuestionSupplementMeta, toggleQuestionSupplementReaction } from "@/lib/questionSupplementCards";
import { useMotionPresence } from "@/components/useMotionPresence";
import { QuestionSupplementCardsPanel } from "@/components/QuestionSupplementCardsPanel";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import type { Question, QuestionSupplementReactionSummary } from "@/types/quiz";

type Source = "yangming" | "supplement" | "related";
type QuestionExplanationTabsProps = {
  question: Question; compact?: boolean; className?: string;
  mainExplanationContent?: ReactNode; aiExplanationContent?: ReactNode;
  relatedQuestionsContent?: () => ReactNode; moreActionsContent?: ReactNode;
  onReplacementVisibilityChange?:(questionId:string,replacing:boolean)=>void;
};

export function QuestionExplanationTabs({question, compact = false, className = "", mainExplanationContent,
  aiExplanationContent, relatedQuestionsContent, moreActionsContent,onReplacementVisibilityChange}: QuestionExplanationTabsProps) {
  const { session } = useAuth();
  const [reactions,setReactions] = useState<QuestionSupplementReactionSummary[]>([]);
  const [reactionLoading,setReactionLoading] = useState(false);
  const [reactionError,setReactionError] = useState("");
  const reactionContext = useRef(0);
  const handleReactionsChange = useCallback((next:QuestionSupplementReactionSummary[])=>setReactions(next),[]);
  useEffect(()=>{
    const context=++reactionContext.current;
    setReactions([]);setReactionError("");setReactionLoading(false);setSupplementCount(null);
    void loadQuestionSupplementMeta(question.id,session?.access_token).then(meta=>{
      if(reactionContext.current===context){setReactions(meta.reactions);setSupplementCount(meta.count);}
    }).catch(()=>{});
    return ()=>{reactionContext.current++;};
  },[question.id,session?.access_token]);
  const pureChaosReaction = reactions.find(r=>r.type==="pure_chaos") ?? {type:"pure_chaos",label:"這題我們不要了",count:0,active:false};
  async function handleToggleReaction(){
    if(reactionLoading)return;
    if(!session?.access_token){setReactionError("請先登入，才能標記這題。");return;}
    const context=reactionContext.current;
    setReactionLoading(true);setReactionError("");
    try{
      const result=await toggleQuestionSupplementReaction({question,reactionType:"pure_chaos",accessToken:session.access_token});
      if(reactionContext.current===context){setReactions(result.reactions??[]);setSupplementCount(current=>result.cards?.length??current);}
    }catch(error){if(reactionContext.current===context)setReactionError(error instanceof Error?error.message:"題目標記失敗");}
    finally{if(reactionContext.current===context)setReactionLoading(false);}
  }
  const [selection,setSelection] = useState<{questionId:string;source:Source|null}>({questionId:question.id,source:null});
  // Reset on a different question before effects; identical refreshes preserve reading mode.
  const activeTab = selection.questionId === question.id ? selection.source : null;
  const [supplementCount,setSupplementCount] = useState<number|null>(null);
  const [isMoreActionsOpen,setIsMoreActionsOpen] = useState(false);
  const morePresence = useMotionPresence(isMoreActionsOpen);
  const [replacementActionsNode,setReplacementActionsNode]=useState<HTMLDivElement|null>(null);
  const [replacementView,setReplacementView]=useState({questionId:question.id,replacing:false});
  const replacingCurrent= replacementView.questionId===question.id&&replacementView.replacing;
  const handleReplacingChange=useCallback((replacing:boolean)=>{setReplacementView(previous=>previous.questionId===question.id&&previous.replacing===replacing?previous:{questionId:question.id,replacing});onReplacementVisibilityChange?.(question.id,replacing);},[question.id,onReplacementVisibilityChange]);
  const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId(), moreId = useId();
  const handleCountChange = useCallback((count:number)=>setSupplementCount(count),[]);
  useEffect(()=>{setSelection({questionId:question.id,source:null});setSupplementCount(null);setIsMoreActionsOpen(false);},[question.id]);
  function select(source:Source) {setSelection({questionId:question.id,source:activeTab===source?null:source});}
  function handleKeyDown(event:KeyboardEvent<HTMLElement>) {
    if(event.key!=="Escape" || !isMoreActionsOpen)return;
    event.preventDefault();event.stopPropagation();setIsMoreActionsOpen(false);
    window.requestAnimationFrame(()=>moreActionsButtonRef.current?.focus());
  }
  const sources=[{source:"yangming" as const,label:"陽明",Icon:BookOpen},
    {source:"supplement" as const,label:"補充",Icon:MessageCircle},
    {source:"related" as const,label:"類似題",Icon:Layers3}];
  const [fullGenerated,setFullGenerated]=useState(false);
  useEffect(()=>{const refresh=()=>setFullGenerated(usesFullGeneratedReading(loadQuestionExplanationOverride(question.id),hasReviewedExplanation(question.id)));refresh();for(const name of ['explanation-version-changed','explanation-recovered','storage'])window.addEventListener(name,refresh);return()=>{for(const name of ['explanation-version-changed','explanation-recovered','storage'])window.removeEventListener(name,refresh)};},[question.id]);
  return <section className={`min-w-0 max-w-full ${className}`} onKeyDown={handleKeyDown} aria-label="詳解內容與來源">
    <div className="mb-3 flex min-w-0 items-center gap-1.5 border-b border-slate-200 pb-2.5" role="group" aria-label="切換詳解來源，再點已選來源回到原詳解">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {sources.map(({source,label,Icon})=><button key={source} type="button" onClick={()=>select(source)}
          aria-pressed={activeTab===source} aria-controls={panelId}
          title={activeTab===source?"再點一次回到原詳解":`顯示${label}`}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${activeTab===source?"bg-brand-800 text-white ring-brand-800":"bg-white text-slate-700 ring-slate-200 hover:bg-brand-50"}`}>
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8}/>{label}
          {source==="supplement" && (supplementCount??0)>0?<span className="text-[10px]">{supplementCount}</span>:null}
        </button>)}
        <button type="button" onClick={()=>void handleToggleReaction()} disabled={reactionLoading}
          aria-pressed={pureChaosReaction.active} title="這題我們不要了"
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${pureChaosReaction.active?"bg-rose-700 text-white ring-rose-700":"bg-white text-rose-700 ring-rose-200 hover:bg-rose-50"}`}>
          <CircleOff aria-hidden="true" className="size-3.5"/>{pureChaosReaction.label}
          {pureChaosReaction.count>0?<span className="text-[10px]">{pureChaosReaction.count}</span>:null}
        </button>
      </div>
      <button ref={moreActionsButtonRef} type="button" onClick={()=>setIsMoreActionsOpen(v=>!v)}
        aria-expanded={isMoreActionsOpen} aria-controls={moreId}
        className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <MoreHorizontal aria-hidden="true" className="size-4"/>更多</button>
    </div>
    {reactionError?<p role="alert" className="mb-2 text-sm text-rose-700">{reactionError}</p>:null}
    <div {...morePresence.attributes} id={moreId} role="group" aria-label="更多操作" hidden={!morePresence.present}
      className="mb-3 ml-auto w-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:w-64">
      <div className="grid gap-1 [&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg"><div ref={setReplacementActionsNode} aria-label="詳解版本操作"/>{moreActionsContent}</div>
    </div>
    <div id={panelId} className="min-w-0 max-w-full">
      <ExplanationReplacementControls questionId={question.id} portalActions actionsContainer={replacementActionsNode} onReplacingChange={handleReplacingChange} onStart={()=>{setSelection({questionId:question.id,source:null});setIsMoreActionsOpen(false);window.requestAnimationFrame(()=>moreActionsButtonRef.current?.focus());}}/>
      {/* Keep the original reader mounted: preserve 簡解／詳解 and image state. */}
      <div hidden={activeTab!==null||replacingCurrent} role="region" aria-label="原詳解" className="min-w-0 space-y-3">
        {mainExplanationContent || <p className="text-sm text-slate-500">此題尚無原詳解。</p>}
        {aiExplanationContent&&!fullGenerated?<details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-brand-800">展開完整詳解</summary><div className="mt-3">{aiExplanationContent}</div></details>:null}
      </div>
      {activeTab==="yangming"?<div role="region" aria-label="陽明詳解" className="study-disclosure"><YangmingExplanationPanel questionId={question.id} compact={compact} autoLoad hideButton/></div>:null}
      {activeTab==="supplement"?<div role="region" aria-label="同學補充" className="study-disclosure"><QuestionSupplementCardsPanel question={question} compact={compact} onCountChange={handleCountChange} onReactionsChange={handleReactionsChange}/></div>:null}
      {activeTab==="related"?<div role="region" aria-label="類似題" className="study-disclosure">{relatedQuestionsContent?relatedQuestionsContent():<p className="text-sm text-slate-500">此處尚無可核對的類似題。</p>}</div>:null}
    </div>
  </section>;
}
