"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { ReviewQuestionItem } from "@/types/quiz";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewQuestionItem[]>([]);
  const { syncVersion } = useAuth();

  useEffect(() => {
    const sessions = loadCompletedSessions();
    setItems(getReviewQuestionItems(anatomyQuestions, sessions, 60));
  }, [syncVersion]);

  function handleStartReview() {
    saveQuizSettings({ ...DEFAULT_QUIZ_SETTINGS, mode: "review", questionCount: 10 });
  }

  const snapshot = getReviewSnapshot(items);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">錯題複習與高風險題</h1>
            <p className="mt-3 text-slate-500">
              第二版會依照歷史錯題、低信心與錯誤自信，自動整理出你最值得回頭刷的題目。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
            <Link
              href="/quiz?new=1"
              onClick={handleStartReview}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始錯題複習模式
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">總複習題數</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">低信心題</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.lowConfidence}</p>
        </article>
        <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
          <p className="text-sm font-medium">錯誤自信題</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.overconfidence}</p>
        </article>
        <article className="rounded-3xl bg-slate-50 p-5 text-slate-800">
          <p className="text-sm font-medium">重錯題</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.wrongHeavy}</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook items={items} allQuestions={anatomyQuestions} />
      </div>
    </main>
  );
}
