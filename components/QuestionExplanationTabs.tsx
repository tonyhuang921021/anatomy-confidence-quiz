"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, CircleOff, Layers3, MessageCircle, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { QuestionSupplementCardsPanel } from "@/components/QuestionSupplementCardsPanel";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import { loadQuestionSupplementMeta, toggleQuestionSupplementReaction } from "@/lib/questionSupplementCards";
import type { Question, QuestionSupplementReactionSummary } from "@/types/quiz";

type QuestionExplanationTabsProps = {
  question: Question;
  compact?: boolean;
  className?: string;
  aiExplanationContent?: ReactNode;
  relatedQuestionsContent?: () => ReactNode;
  moreActionsContent?: ReactNode;
};

export function QuestionExplanationTabs({
  question,
  compact = false,
  className = "",
  aiExplanationContent,
  relatedQuestionsContent,
  moreActionsContent
}: QuestionExplanationTabsProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"ai" | "yangming" | "supplement" | "related" | null>(null);
  const [supplementCount, setSupplementCount] = useState<number | null>(null);
  const [reactions, setReactions] = useState<QuestionSupplementReactionSummary[]>([]);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
  const moreActionsPanelId = useId();
  const hasAiExplanationContent = Boolean(aiExplanationContent);
  const hasRelatedQuestionsContent = Boolean(relatedQuestionsContent);
  const handleCountChange = useCallback((count: number) => setSupplementCount(count), []);
  const handleReactionsChange = useCallback((nextReactions: QuestionSupplementReactionSummary[]) => {
    setReactions(nextReactions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSupplementCount(null);
    setReactions([]);
    setReactionError("");

    loadQuestionSupplementMeta(question.id, session?.access_token)
      .then((metadata) => {
        if (cancelled) return;
        setSupplementCount(metadata.count);
        setReactions(metadata.reactions);
      })
      .catch(() => {
        if (!cancelled) {
          setSupplementCount(null);
          setReactions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [question.id, session?.access_token]);

  useEffect(() => {
    setActiveTab((current) => {
      if (current === "ai" && !hasAiExplanationContent) return null;
      if (current === "related" && !hasRelatedQuestionsContent) return null;
      return current;
    });
  }, [hasAiExplanationContent, hasRelatedQuestionsContent, question.id]);

  useEffect(() => {
    setIsMoreActionsOpen(false);
  }, [question.id]);

  function handleMoreActionsKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !isMoreActionsOpen) return;

    event.preventDefault();
    event.stopPropagation();
    setIsMoreActionsOpen(false);
    window.requestAnimationFrame(() => moreActionsButtonRef.current?.focus());
  }

  const pureChaosReaction = reactions.find((reaction) => reaction.type === "pure_chaos") ?? {
    type: "pure_chaos" as const,
    label: "這題我們不要了",
    count: 0,
    active: false
  };

  async function handleToggleReaction() {
    if (!session?.access_token) {
      setReactionError("請先登入，才能標記這題。");
      return;
    }
    setReactionLoading(true);
    setReactionError("");
    try {
      const payload = await toggleQuestionSupplementReaction({
        question,
        reactionType: "pure_chaos",
        accessToken: session.access_token
      });
      setSupplementCount(payload.cards?.length ?? supplementCount ?? 0);
      setReactions(payload.reactions ?? []);
    } catch (rawError) {
      setReactionError(rawError instanceof Error ? rawError.message : "題目標記失敗");
    } finally {
      setReactionLoading(false);
    }
  }

  return (
    <section
      className={`border-y border-slate-200/90 py-2.5 ${className}`}
      onKeyDown={handleMoreActionsKeyDown}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
        {hasAiExplanationContent ? (
          <button
            type="button"
            onClick={() => setActiveTab((current) => current === "ai" ? null : "ai")}
            aria-pressed={activeTab === "ai"}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition ${
              activeTab === "ai"
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            }`}
            title="AI 詳解"
          >
            <BookOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            AI
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setActiveTab((current) => current === "yangming" ? null : "yangming")}
          aria-pressed={activeTab === "yangming"}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition ${
            activeTab === "yangming"
              ? "bg-slate-900 text-white ring-slate-900"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
          }`}
          title="陽明詳解"
        >
          <BookOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          陽明
        </button>
        <button
          type="button"
          onClick={() => setActiveTab((current) => current === "supplement" ? null : "supplement")}
          aria-pressed={activeTab === "supplement"}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition ${
            activeTab === "supplement"
              ? "bg-teal-700 text-white ring-teal-700"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-teal-50 hover:text-teal-800"
          }`}
          title="同學補充"
        >
          <MessageCircle aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          補充
          {supplementCount && supplementCount > 0 ? (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                activeTab === "supplement" ? "bg-white/20 text-white" : "bg-teal-50 text-teal-800"
              }`}
            >
              {supplementCount}
            </span>
          ) : null}
        </button>
        {hasRelatedQuestionsContent ? (
          <button
            type="button"
            onClick={() => setActiveTab((current) => current === "related" ? null : "related")}
            aria-pressed={activeTab === "related"}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition ${
              activeTab === "related"
                ? "bg-sky-700 text-white ring-sky-700"
                : "bg-sky-50 text-sky-800 ring-sky-100 hover:bg-sky-100"
            }`}
            title="相同觀念類似題"
          >
            <Layers3 aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            類似題
          </button>
        ) : null}
          <button
            type="button"
            onClick={() => void handleToggleReaction()}
            disabled={reactionLoading}
            aria-pressed={pureChaosReaction.active}
            aria-label={pureChaosReaction.label}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition disabled:cursor-wait disabled:opacity-60 ${
              pureChaosReaction.active
                ? "bg-rose-600 text-white ring-rose-600"
                : "bg-rose-50 text-rose-800 ring-rose-100 hover:bg-rose-100"
            }`}
            title={pureChaosReaction.label}
          >
            <CircleOff aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.8} />
            {pureChaosReaction.label}
            {pureChaosReaction.count > 0 ? (
              <span className={pureChaosReaction.active ? "text-rose-100" : "text-rose-600"}>
                {pureChaosReaction.count}
              </span>
            ) : null}
          </button>
        </div>
        {moreActionsContent ? (
          <button
            ref={moreActionsButtonRef}
            type="button"
            onClick={() => setIsMoreActionsOpen((current) => !current)}
            aria-expanded={isMoreActionsOpen}
            aria-controls={moreActionsPanelId}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={1.8} />
            更多
          </button>
        ) : null}
      </div>
      {moreActionsContent ? (
        <div
          id={moreActionsPanelId}
          role="group"
          aria-label="更多操作"
          hidden={!isMoreActionsOpen}
          className="ml-auto mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.10)] sm:w-64"
        >
          <div className="grid gap-1 [&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg">
            {moreActionsContent}
          </div>
        </div>
      ) : null}
      {reactionError ? <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">{reactionError}</p> : null}
      {activeTab === "ai" && aiExplanationContent ? (
        <div className="mt-3">
          {aiExplanationContent}
        </div>
      ) : null}
      {activeTab === "yangming" ? (
        <div className="mt-3">
          <YangmingExplanationPanel questionId={question.id} compact={compact} autoLoad hideButton />
        </div>
      ) : null}
      {activeTab === "supplement" ? (
        <div className="mt-3">
          <QuestionSupplementCardsPanel
            question={question}
            compact={compact}
            onCountChange={handleCountChange}
            onReactionsChange={handleReactionsChange}
          />
        </div>
      ) : null}
      {activeTab === "related" && relatedQuestionsContent ? (
        <div className="mt-3">
          {relatedQuestionsContent()}
        </div>
      ) : null}
    </section>
  );
}
