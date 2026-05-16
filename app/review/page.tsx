"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { ReviewQuestionItem } from "@/types/quiz";

export default function ReviewPage() {
  const [practiceItems, setPracticeItems] = useState<ReviewQuestionItem[]>([]);
  const [simulationItems, setSimulationItems] = useState<ReviewQuestionItem[]>([]);
  const { syncVersion } = useAuth();
  const allQuestions = getQuestionBankBySubjectFilter("全部");

  useEffect(() => {
    const sessions = loadCompletedSessions();
    const practiceSessions = sessions.filter((session) => session.settings?.mode !== "simulation");
    const simulationSessions = sessions.filter((session) => session.settings?.mode === "simulation");
    setPracticeItems(getReviewQuestionItems(allQuestions, practiceSessions, 60));
    setSimulationItems(getReviewQuestionItems(allQuestions, simulationSessions, 60));
  }, [syncVersion]);

  function handleStartPracticeReview() {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10,
      subjectFilter: "全部",
      customQuestionIds: practiceItems.map((item) => item.question.id),
      customPoolLabel: "散題錯題庫"
    });
  }

  function handleStartSimulationReview() {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10,
      subjectFilter: "全部",
      customQuestionIds: simulationItems.map((item) => item.question.id),
      customPoolLabel: "模擬考錯題庫"
    });
  }

  const practiceSnapshot = getReviewSnapshot(practiceItems);
  const simulationSnapshot = getReviewSnapshot(simulationItems);

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
              onClick={handleStartPracticeReview}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始散題錯題複習
            </Link>
            <Link
              href="/quiz?new=1"
              onClick={handleStartSimulationReview}
              className="min-h-12 rounded-2xl bg-amber-500 px-5 py-4 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              開始模擬考錯題複習
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">散題錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{practiceSnapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">散題低信心題</p>
          <p className="mt-2 text-3xl font-bold">{practiceSnapshot.lowConfidence}</p>
        </article>
        <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
          <p className="text-sm font-medium">模考錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-slate-50 p-5 text-slate-800">
          <p className="text-sm font-medium">模考低信心題</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.lowConfidence}</p>
        </article>
      </section>

      <div className="mt-8 grid gap-8">
        <div id="practice-review" className="scroll-mt-24">
          <ReviewNotebook
          title="散題錯題庫"
          description="這裡只整理平常零散刷題累積下來的錯題與低信心題，不和整份模考混在一起。"
          startLabel="開始散題錯題複習"
          onStartReview={handleStartPracticeReview}
          items={practiceItems}
          allQuestions={allQuestions}
        />
        </div>
        <div id="simulation-review" className="scroll-mt-24">
          <ReviewNotebook
          title="模擬考錯題庫"
          description="這裡只整理整份模擬考做出來的錯題與低信心題，方便你回頭補整卷觀念。"
          startLabel="開始模擬考錯題複習"
          onStartReview={handleStartSimulationReview}
          items={simulationItems}
          allQuestions={allQuestions}
        />
        </div>
      </div>
    </main>
  );
}
