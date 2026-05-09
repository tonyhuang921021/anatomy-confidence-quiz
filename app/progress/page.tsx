"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgressMap } from "@/components/ProgressMap";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import {
  calculateCompletionStats,
  getLowCompletionSections,
  getTopMasteredSections,
  getUnstableCompletedSections
} from "@/lib/quizAnalysis";
import { loadCompletedSessions } from "@/lib/storage";
import { CompletionStatsBundle } from "@/types/quiz";

const emptyStats: CompletionStatsBundle = {
  overall: {
    totalQuestionsInBank: anatomyQuestions.length,
    attemptedQuestions: 0,
    completionRate: 0,
    correctRate: 0,
    averageConfidence: 0,
    masteryScore: 0
  },
  chapters: [],
  sections: []
};

export default function ProgressPage() {
  const [stats, setStats] = useState<CompletionStatsBundle>(emptyStats);

  useEffect(() => {
    const sessions = loadCompletedSessions();
    setStats(calculateCompletionStats(anatomyQuestions, sessions));
  }, []);

  const lowCompletion = getLowCompletionSections(stats.sections, 5);
  const unstable = getUnstableCompletedSections(stats.sections, 5);
  const mastered = getTopMasteredSections(stats.sections, 5);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Anatomy Map</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">解剖學進度總覽</h1>
            <p className="mt-3 text-slate-500">
              依照完整 anatomy map 檢查 completionRate、correctRate、averageConfidence 與 masteryScore。
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
              href="/quiz"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始測驗
            </Link>
            <Link
              href="/review"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              錯題複習
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <article className="rounded-3xl bg-brand-50 p-5 text-brand-900">
            <p className="text-sm font-medium">整體完成度</p>
            <p className="mt-2 text-3xl font-bold">{stats.overall.completionRate}%</p>
            <p className="mt-2 text-sm">已作答 {stats.overall.attemptedQuestions} / {stats.overall.totalQuestionsInBank}</p>
          </article>
          <article className="rounded-3xl bg-emerald-50 p-5 text-emerald-900">
            <p className="text-sm font-medium">整體答對率</p>
            <p className="mt-2 text-3xl font-bold">{stats.overall.correctRate}%</p>
            <p className="mt-2 text-sm">averageConfidence {stats.overall.averageConfidence}</p>
          </article>
          <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
            <p className="text-sm font-medium">整體 masteryScore</p>
            <p className="mt-2 text-3xl font-bold">{stats.overall.masteryScore}</p>
            <p className="mt-2 text-sm">歷史 completed sessions 計算</p>
          </article>
          <article className="rounded-3xl bg-slate-50 p-5 text-slate-800">
            <p className="text-sm font-medium">章節數</p>
            <p className="mt-2 text-3xl font-bold">{stats.chapters.length}</p>
            <p className="mt-2 text-sm">section 數 {stats.sections.length}</p>
          </article>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">完成度最低的 sections</h2>
          <div className="mt-4 grid gap-3">
            {lowCompletion.map((section) => (
              <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">{section.section}</p>
                <p className="mt-1 text-slate-500">{section.chapter}</p>
                <p className="mt-2">completionRate {section.completionRate}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">已完成但不穩的 sections</h2>
          <div className="mt-4 grid gap-3">
            {unstable.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有落在這個區間的 section。</p>
            ) : (
              unstable.map((section) => (
                <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{section.section}</p>
                  <p className="mt-1 text-slate-500">{section.chapter}</p>
                  <p className="mt-2">masteryScore {section.masteryScore}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">掌握度最高的 sections</h2>
          <div className="mt-4 grid gap-3">
            {mastered.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">還沒有足夠資料可判定。</p>
            ) : (
              mastered.map((section) => (
                <div key={`${section.chapter}-${section.section}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{section.section}</p>
                  <p className="mt-1 text-slate-500">{section.chapter}</p>
                  <p className="mt-2">masteryScore {section.masteryScore}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="mt-8">
        <ProgressMap chapters={stats.chapters} />
      </div>
    </main>
  );
}
