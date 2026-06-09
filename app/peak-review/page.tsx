"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  mergeQuestionsWithSessionSnapshots
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import type { ReviewQuestionItem } from "@/types/quiz";

export default function PeakReviewPage() {
  const baseQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);
  const [peakItems, setPeakItems] = useState<ReviewQuestionItem[]>([]);
  const [reviewBank, setReviewBank] = useState(baseQuestions);

  useEffect(() => {
    const sessions = loadCompletedSessions();
    const peakSessions = sessions.filter((session) => session.settings?.mode === "peak_challenge");
    const mergedQuestions = mergeQuestionsWithSessionSnapshots(baseQuestions, peakSessions);
    setReviewBank(mergedQuestions);
    setPeakItems(getReviewQuestionItems(mergedQuestions, peakSessions, Number.MAX_SAFE_INTEGER));
  }, [baseQuestions]);

  function handleStartPeakReview() {
    const reviewIds = new Set(peakItems.map((item) => item.question.id));
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10,
      subjectFilter: "全部",
      customQuestionIds: [...reviewIds],
      customQuestionPayload: reviewBank.filter((question) => reviewIds.has(question.id)),
      customPoolLabel: "巔峰賽錯題庫"
    });
  }

  const wrongCount = peakItems.filter((item) => item.history.wrong > 0).length;
  const lowConfidenceCount = peakItems.filter((item) => item.history.lowConfidence > 0).length;

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Peak Challenge Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">巔峰賽錯題與沒信心題</h1>
            <p className="mt-3 text-slate-500">
              這裡只整理巔峰賽模式累積下來的錯題與低信心題，不會和其他模式混在一起。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/peak"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回巔峰賽
            </Link>
            <Link
              href="/quiz?new=1"
              onClick={handleStartPeakReview}
              className="min-h-12 rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              開始巔峰賽錯題複習
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">巔峰賽錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{wrongCount}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">巔峰賽低信心題</p>
          <p className="mt-2 text-3xl font-bold">{lowConfidenceCount}</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook
          title="巔峰賽錯題庫"
          description="這裡只整理巔峰賽累積出來的錯題與低信心題。"
          startLabel="開始巔峰賽錯題複習"
          onStartReview={handleStartPeakReview}
          items={peakItems}
          allQuestions={reviewBank}
        />
      </div>
    </main>
  );
}
