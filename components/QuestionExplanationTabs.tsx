"use client";

import { useCallback, useState } from "react";
import { QuestionSupplementCardsPanel } from "@/components/QuestionSupplementCardsPanel";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import type { Question } from "@/types/quiz";

type QuestionExplanationTabsProps = {
  question: Question;
  compact?: boolean;
  className?: string;
};

export function QuestionExplanationTabs({
  question,
  compact = false,
  className = ""
}: QuestionExplanationTabsProps) {
  const [activeTab, setActiveTab] = useState<"yangming" | "supplement" | null>(null);
  const [supplementCount, setSupplementCount] = useState<number | null>(null);
  const handleCountChange = useCallback((count: number) => setSupplementCount(count), []);

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white/70 p-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
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
          同學補充{supplementCount === null ? "" : ` ${supplementCount}`}
        </button>
      </div>
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
          />
        </div>
      ) : null}
    </section>
  );
}
