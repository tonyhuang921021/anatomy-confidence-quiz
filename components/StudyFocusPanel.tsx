"use client";

import Link from "next/link";
import {
  DEFAULT_QUIZ_SETTINGS,
  getNextRecommendedSections,
  getReviewSnapshot,
  getTopMasteredSections,
  getUnstableCompletedSections
} from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import { CompletionStatsBundle, ReviewQuestionItem } from "@/types/quiz";

type StudyFocusPanelProps = {
  stats: CompletionStatsBundle;
  reviewItems: ReviewQuestionItem[];
};

export function StudyFocusPanel({ stats, reviewItems }: StudyFocusPanelProps) {
  const recommended = getNextRecommendedSections(stats.sections, 4);
  const unstable = getUnstableCompletedSections(stats.sections, 3);
  const mastered = getTopMasteredSections(stats.sections, 3);
  const reviewSnapshot = getReviewSnapshot(reviewItems);

  function handleQuickStart(section?: { chapter: string; section: string }) {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "weakness",
      questionCount: 10,
      chapter: section?.chapter,
      section: section?.section
    });
  }

  function handleReviewStart() {
    saveQuizSettings({
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "review",
      questionCount: 10
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Focus Plan
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">下一輪最值得先刷的 section</h2>
          </div>
          <Link
            href="/quiz"
            onClick={() => handleQuickStart()}
            className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            直接開始
          </Link>
        </div>

        <div className="mt-5 grid gap-4">
          {recommended.map((section, index) => (
            <article
              key={`${section.chapter}-${section.section}`}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-900">
                      推薦 {index + 1}
                    </span>
                    <span className="text-sm text-slate-500">{section.chapter}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{section.section}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    完成度 {section.completionRate}% ・ 掌握度 {section.masteryScore} ・
                    平均信心 {section.averageConfidence}
                  </p>
                </div>
                <Link
                  href="/quiz"
                  onClick={() => handleQuickStart(section)}
                  className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-brand-50"
                >
                  刷這一節
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">今日複習提醒</h2>
              <p className="mt-1 text-sm text-slate-500">先處理高風險題，再回頭補進度。</p>
            </div>
            <Link
              href="/review"
              onClick={handleReviewStart}
              className="min-h-12 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              進入複習
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
              錯題 / 高風險題池 <span className="font-semibold">{reviewSnapshot.total}</span>
            </p>
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              低信心題 <span className="font-semibold">{reviewSnapshot.lowConfidence}</span>
            </p>
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
              錯誤自信題 <span className="font-semibold">{reviewSnapshot.overconfidence}</span>
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">練過但不穩</h2>
          <div className="mt-4 grid gap-3">
            {unstable.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                目前沒有這類 section，代表高完成度區塊還算穩。
              </p>
            ) : (
              unstable.map((section) => (
                <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{section.section}</p>
                  <p className="mt-1 text-slate-500">{section.chapter}</p>
                  <p className="mt-2">掌握度 {section.masteryScore}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">目前最穩的 section</h2>
          <div className="mt-4 grid gap-3">
            {mastered.map((section) => (
              <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">{section.section}</p>
                <p className="mt-1">{section.chapter}</p>
                <p className="mt-2">掌握度 {section.masteryScore}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
