"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { anatomyOutline } from "@/data/anatomyQuestions";
import {
  DEFAULT_QUIZ_SETTINGS,
  getModeLabel
} from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import { CompletionStatsBundle, QuizMode, QuizSettings } from "@/types/quiz";

type QuizSetupPanelProps = {
  stats: CompletionStatsBundle;
};

const modeDescriptions: Record<QuizMode, string> = {
  weakness: "優先抽你最弱、最不穩、最需要補進度的小節。",
  random: "平均刷題，適合維持手感與快速暖機。",
  review: "優先抽歷史錯題、低信心題與高風險題。",
  ai_fresh: "每題由 GPT 即時生成新題，降低重複感。"
};

const questionCounts = [10, 15, 20];

export function QuizSetupPanel({ stats }: QuizSetupPanelProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS);

  const sections = useMemo(() => {
    if (!settings.chapter) return [];
    return stats.sections
      .filter(
        (item) => item.chapter === settings.chapter && item.totalQuestionsInBank > 0
      )
      .map((item) => item.section);
  }, [settings.chapter, stats.sections]);

  const chaptersWithQuestions = useMemo(() => {
    return anatomyOutline.filter((chapter) =>
      stats.sections.some(
        (section) =>
          section.chapter === chapter.chapter && section.totalQuestionsInBank > 0
      )
    );
  }, [stats.sections]);

  const weakestSection = useMemo(() => {
    return [...stats.sections]
      .sort((a, b) => a.completionRate - b.completionRate || a.masteryScore - b.masteryScore)[0];
  }, [stats.sections]);

  function updateSettings(next: Partial<QuizSettings>) {
    setSettings((current) => {
      const merged = { ...current, ...next };
      if (next.chapter && next.chapter !== current.chapter) {
        merged.section = undefined;
      }
      return merged;
    });
  }

  function handleStart() {
    saveQuizSettings(settings);
    router.push("/quiz");
  }

  function handleQuickWeakness() {
    const nextSettings: QuizSettings = {
      mode: "weakness",
      questionCount: 10,
      chapter: weakestSection?.chapter,
      section: weakestSection?.section
    };
    saveQuizSettings(nextSettings);
    router.push("/quiz");
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Version 2</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">智慧測驗設定</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            第二版支援弱點補強、隨機刷題與錯題複習三種模式。
          </p>
        </div>
        <button
          type="button"
          onClick={handleQuickWeakness}
          className="min-h-12 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
        >
          直接刷我最弱 section
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {(["weakness", "random", "review", "ai_fresh"] as QuizMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => updateSettings({ mode })}
            className={`rounded-3xl border p-5 text-left transition ${
              settings.mode === mode
                ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                : "border-slate-200 bg-slate-50 hover:bg-white"
            }`}
          >
            <p className="text-base font-semibold text-ink">{getModeLabel(mode)}</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">{modeDescriptions[mode]}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-500">題數</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {questionCounts.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => updateSettings({ questionCount: count })}
                className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  settings.questionCount === count
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50"
                }`}
              >
                {count} 題
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-500">聚焦章節 / 小節（選填）</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={settings.chapter ?? ""}
              onChange={(event) => updateSettings({ chapter: event.target.value || undefined })}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
            >
              <option value="">全部章節</option>
              {chaptersWithQuestions.map((item) => (
                <option key={item.chapter} value={item.chapter}>
                  {item.chapter}
                </option>
              ))}
            </select>
            <select
              value={settings.section ?? ""}
              onChange={(event) => updateSettings({ section: event.target.value || undefined })}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
            >
              <option value="">全部小節</option>
              {sections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>
          {settings.mode === "ai_fresh" ? (
            <label className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={Boolean(settings.usePastExamStyle)}
                onChange={(event) =>
                  updateSettings({ usePastExamStyle: event.target.checked })
                }
              />
              使用國考考古題風格改寫題
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          目前設定：<span className="font-semibold text-ink">{getModeLabel(settings.mode)}</span>・
          {settings.questionCount} 題
          {settings.chapter ? `・${settings.chapter}` : ""}
          {settings.section ? ` / ${settings.section}` : ""}
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          用這個設定開始
        </button>
      </div>
    </section>
  );
}
