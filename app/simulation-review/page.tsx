"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewNotebook } from "@/components/ReviewNotebook";
import { applyQuestionClassificationOverride, getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { loadConfirmedQuestionClassificationOverrides } from "@/lib/cloudSync";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { QuestionClassificationOverride, ReviewQuestionItem } from "@/types/quiz";

export default function SimulationReviewPage() {
  const [simulationItems, setSimulationItems] = useState<ReviewQuestionItem[]>([]);
  const [classificationOverrides, setClassificationOverrides] = useState<
    Record<string, QuestionClassificationOverride>
  >({});
  const { syncVersion } = useAuth();
  const baseQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);
  const allQuestions = useMemo(
    () =>
      baseQuestions.map((question) =>
        applyQuestionClassificationOverride(question, classificationOverrides[question.id])
      ),
    [baseQuestions, classificationOverrides]
  );

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides(baseQuestions.map((question) => question.id))
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [baseQuestions, syncVersion]);

  useEffect(() => {
    const sessions = loadCompletedSessions();
    const simulationSessions = sessions.filter((session) => session.settings?.mode === "simulation");
    setSimulationItems(getReviewQuestionItems(allQuestions, simulationSessions, 60));
  }, [allQuestions, syncVersion]);

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

  const simulationSnapshot = getReviewSnapshot(simulationItems);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Simulation Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">模擬考錯題與沒信心題</h1>
            <p className="mt-3 text-slate-500">
              這裡只整理整份模擬考做出來的錯題與低信心題，不會和平常散題刷題混在一起。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/simulation"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回模擬考專區
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

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
          <p className="text-sm font-medium">模考錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">模考低信心題</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.lowConfidence}</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook
          title="模擬考錯題庫"
          description="這裡只整理整份模擬考做出來的錯題與低信心題。"
          startLabel="開始模擬考錯題複習"
          onStartReview={handleStartSimulationReview}
          items={simulationItems}
          allQuestions={allQuestions}
        />
      </div>
    </main>
  );
}
