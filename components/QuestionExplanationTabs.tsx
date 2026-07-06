"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
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
};

export function QuestionExplanationTabs({
  question,
  compact = false,
  className = "",
  aiExplanationContent,
  relatedQuestionsContent
}: QuestionExplanationTabsProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"ai" | "yangming" | "supplement" | "related" | null>(null);
  const [supplementCount, setSupplementCount] = useState<number | null>(null);
  const [reactions, setReactions] = useState<QuestionSupplementReactionSummary[]>([]);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [reactionError, setReactionError] = useState("");
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
    <section className={`rounded-3xl border border-slate-200 bg-white/70 p-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {hasAiExplanationContent ? (
          <button
            type="button"
            onClick={() => setActiveTab((current) => current === "ai" ? null : "ai")}
            aria-pressed={activeTab === "ai"}
            className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition ${
              activeTab === "ai"
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            AI 詳解
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setActiveTab((current) => current === "yangming" ? null : "yangming")}
          aria-pressed={activeTab === "yangming"}
          className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition ${
            activeTab === "yangming"
              ? "bg-slate-900 text-white ring-slate-900"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          陽明詳解
        </button>
        <button
          type="button"
          onClick={() => setActiveTab((current) => current === "supplement" ? null : "supplement")}
          aria-pressed={activeTab === "supplement"}
          className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition ${
            activeTab === "supplement"
              ? "bg-teal-700 text-white ring-teal-700"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-teal-50 hover:text-teal-800"
          }`}
        >
          同學補充
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
        <button
          type="button"
          onClick={() => void handleToggleReaction()}
          disabled={reactionLoading}
          aria-pressed={pureChaosReaction.active}
          className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition disabled:cursor-wait disabled:opacity-60 ${
            pureChaosReaction.active
              ? "bg-rose-600 text-white ring-rose-600"
              : "bg-rose-50 text-rose-800 ring-rose-100 hover:bg-rose-100"
          }`}
        >
          {pureChaosReaction.label}
          {pureChaosReaction.count > 0 ? (
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                pureChaosReaction.active ? "bg-white/20 text-white" : "bg-white text-rose-800"
              }`}
            >
              {pureChaosReaction.count}
            </span>
          ) : null}
        </button>
        {hasRelatedQuestionsContent ? (
          <button
            type="button"
            onClick={() => setActiveTab((current) => current === "related" ? null : "related")}
            aria-pressed={activeTab === "related"}
            className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition ${
              activeTab === "related"
                ? "bg-sky-700 text-white ring-sky-700"
                : "bg-sky-50 text-sky-800 ring-sky-100 hover:bg-sky-100"
            }`}
          >
            相同觀念類似題
          </button>
        ) : null}
      </div>
      {reactionError ? <p className="mt-2 text-xs font-semibold text-rose-700">{reactionError}</p> : null}
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
