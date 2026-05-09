"use client";

import { useState } from "react";
import { ChapterCompletionStats, CompletionStatus, SectionCompletionStats } from "@/types/quiz";

type ProgressMapProps = {
  chapters: ChapterCompletionStats[];
};

const statusClasses: Record<CompletionStatus, string> = {
  未開始: "bg-slate-100 text-slate-700",
  進行中: "bg-sky-100 text-sky-800",
  已完成但不穩: "bg-amber-100 text-amber-900",
  已完成且穩定: "bg-emerald-100 text-emerald-800"
};

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function SectionCard({ section }: { section: SectionCompletionStats }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-ink">{section.section}</h4>
          <p className="mt-1 text-sm text-slate-500">
            已作答題數 {section.attemptedQuestions} / 題庫題數 {section.totalQuestionsInBank}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[section.status]}`}>
          {section.status}
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
          style={{ width: `${section.completionRate}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          completionRate <span className="font-semibold">{section.completionRate}%</span>
        </p>
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          correctRate <span className="font-semibold">{section.correctRate}%</span>
        </p>
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          averageConfidence <span className="font-semibold">{section.averageConfidence}</span>
        </p>
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          masteryScore <span className="font-semibold">{section.masteryScore}</span>
        </p>
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2 xl:col-span-2">
          最近一次作答 <span className="font-semibold">{formatTime(section.lastAttemptedAt)}</span>
        </p>
      </div>
    </article>
  );
}

export function ProgressMap({ chapters }: ProgressMapProps) {
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(
    Object.fromEntries(chapters.map((chapter, index) => [chapter.chapter, index === 0]))
  );

  return (
    <div className="grid gap-4">
      {chapters.map((chapter) => {
        const isOpen = openChapters[chapter.chapter];
        return (
          <section key={chapter.chapter} className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100">
            <button
              type="button"
              onClick={() =>
                setOpenChapters((current) => ({
                  ...current,
                  [chapter.chapter]: !current[chapter.chapter]
                }))
              }
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <h3 className="text-xl font-semibold text-ink">{chapter.chapter}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  completionRate {chapter.completionRate}% ・ masteryScore {chapter.masteryScore}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[chapter.status]}`}>
                  {chapter.status}
                </span>
                <span className="text-sm font-semibold text-brand-700">{isOpen ? "收合" : "展開"}</span>
              </div>
            </button>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-brand-500"
                style={{ width: `${chapter.completionRate}%` }}
              />
            </div>

            {isOpen ? (
              <div className="mt-5 grid gap-4">
                {chapter.sections.map((section) => (
                  <SectionCard key={`${section.chapter}-${section.section}`} section={section} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
