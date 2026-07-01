"use client";

import { getCompletionStatusLabel } from "@/lib/completionStatusDisplay";
import { CompletionStatsBundle } from "@/types/quiz";

type HomeDashboardProps = {
  stats: CompletionStatsBundle;
  historyCount: number;
  onClearHistory: () => void;
};

export function HomeDashboard({ stats, historyCount, onClearHistory }: HomeDashboardProps) {
  const topChapters = [...stats.chapters]
    .filter((chapter) => chapter.totalQuestionsInBank > 0)
    .sort((a, b) => a.completionRate - b.completionRate || a.masteryScore - b.masteryScore)
    .slice(0, 4);

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
            Dashboard
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">首頁進度摘要</h2>
          <p className="mt-2 text-sm text-slate-500">
            保留首頁穩定度，同時把你最需要知道的進度放回來。
          </p>
        </div>
        <button
          type="button"
          onClick={onClearHistory}
          className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          清除歷史紀錄
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <article className="rounded-3xl bg-brand-50 p-5 text-brand-900">
          <p className="text-sm font-medium">整體完成度</p>
          <p className="mt-2 text-3xl font-bold">{stats.overall.completionRate}%</p>
          <p className="mt-2 text-sm">
            已作答 {stats.overall.attemptedQuestions} / {stats.overall.totalQuestionsInBank}
          </p>
        </article>
        <article className="rounded-3xl bg-emerald-50 p-5 text-emerald-900">
          <p className="text-sm font-medium">整體掌握度</p>
          <p className="mt-2 text-3xl font-bold">{stats.overall.masteryScore}</p>
          <p className="mt-2 text-sm">答對率 {stats.overall.correctRate}%</p>
        </article>
        <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
          <p className="text-sm font-medium">平均信心</p>
          <p className="mt-2 text-3xl font-bold">{stats.overall.averageConfidence}</p>
          <p className="mt-2 text-sm">依所有 completed sessions 計算</p>
        </article>
        <article className="rounded-3xl bg-slate-50 p-5 text-slate-800">
          <p className="text-sm font-medium">歷史測驗次數</p>
          <p className="mt-2 text-3xl font-bold">{historyCount}</p>
          <p className="mt-2 text-sm">第一版到現在累積紀錄</p>
        </article>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        {topChapters.map((chapter) => (
          <article key={chapter.chapter} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">{chapter.chapter}</h3>
                <p className="mt-1 text-sm text-slate-500">{getCompletionStatusLabel(chapter.status)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {chapter.masteryScore}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-brand-500"
                style={{ width: `${chapter.completionRate}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              完成度 {chapter.completionRate}% ・ 答對率 {chapter.correctRate}%
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
