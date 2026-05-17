"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPastPaperOptions } from "@/data/med1QuestionBank";
import { enabledSubjects, subjectRegistry } from "@/data/subjectRegistry";
import {
  DEFAULT_QUIZ_SETTINGS,
  getModeLabel
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import {
  CompletionStatsBundle,
  QuizMode,
  QuizSettings,
  SimulationFeedbackMode,
  SimulationPaperMode,
  SubjectFilter
} from "@/types/quiz";

type QuizSetupPanelProps = {
  stats: CompletionStatsBundle;
  simulationOnly?: boolean;
  title?: string;
  description?: string;
};

const modeDescriptions: Record<QuizMode, string> = {
  weakness: "優先抽你最弱、最不穩、最需要補進度的小節。",
  random: "平均刷題，適合維持手感與快速暖機。",
  review: "優先抽歷史錯題、低信心題與高風險題。",
  simulation: "像正式考試一樣，可選真實考古卷或電腦隨機整份卷。"
};

const questionCounts = [10, 15, 20, 50, 100];

const feedbackModeLabels: Record<SimulationFeedbackMode, string> = {
  full: "每題看正確與詳解",
  answer_only: "每題只看正確答案",
  none: "全程只做題，最後再看結果"
};

const feedbackModeDescriptions: Record<SimulationFeedbackMode, string> = {
  full: "適合邊做邊學。每題送出後會顯示正解、詳解、各選項解析與記憶法。",
  answer_only: "適合先測自己，再快速確認對錯。每題送出後只顯示正確答案，不立刻看長詳解。",
  none: "最接近正式考試。作答當下不公布答案與詳解，但信心仍會照常記錄，最後再一起看結果。"
};

const paperModeLabels: Record<SimulationPaperMode, string> = {
  random_set: "電腦隨機抽一份",
  past_paper: "指定真實考古題",
  random_past_paper: "隨機抽一份真實考古題"
};

const paperModeDescriptions: Record<SimulationPaperMode, string> = {
  random_set:
    "系統會先參考一份真實考古卷的分布模板，再從你目前選的科目題庫中重組一份新模擬卷，比例會盡量貼近真實國考。",
  past_paper:
    "直接指定某一年、某一次的真實考古卷，維持原始卷別與題目順序，最適合完整模考。",
  random_past_paper:
    "從現有真實考古卷中隨機抽一整份來寫，保留真實卷的比例與題序，但你不會先知道抽到哪一份。"
};

export function QuizSetupPanel({
  stats,
  simulationOnly = false,
  title,
  description
}: QuizSetupPanelProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<QuizSettings>(
    simulationOnly
      ? {
          ...DEFAULT_QUIZ_SETTINGS,
          mode: "simulation",
          subjectFilter: "全部",
          questionCount: 100,
          feedbackMode: "none",
          paperMode: "random_set"
        }
      : DEFAULT_QUIZ_SETTINGS
  );
  const [completedPaperCounts, setCompletedPaperCounts] = useState<Record<string, number>>({});
  const selectedSubject = (settings.subjectFilter ?? "解剖學") as SubjectFilter;
  const subjectItem =
    selectedSubject === "全部"
      ? subjectRegistry["醫學（一）"]
      : subjectRegistry[selectedSubject];

  const sections = useMemo(() => {
    if (!settings.chapter) return [];
    return subjectItem?.chapters.find((item) => item.chapter === settings.chapter)?.sections ?? [];
  }, [settings.chapter, subjectItem]);

  const chaptersWithQuestions = useMemo(() => {
    return subjectItem?.chapters.filter((chapter) => chapter.sections.length > 0) ?? [];
  }, [subjectItem]);

  const weakestSection = useMemo(() => {
    if (selectedSubject !== "解剖學") return undefined;
    return [...stats.sections]
      .sort((a, b) => a.completionRate - b.completionRate || a.masteryScore - b.masteryScore)[0];
  }, [selectedSubject, stats.sections]);

  const paperOptions = useMemo(() => {
    if (settings.mode !== "simulation") return [];
    return getPastPaperOptions();
  }, [settings.mode]);
  const med1PaperOptions = useMemo(
    () =>
      [...paperOptions]
        .filter((paper) => paper.subject === "醫學（一）")
        .sort((left, right) => {
          if ((right.sourceYear ?? 0) !== (left.sourceYear ?? 0)) {
            return (right.sourceYear ?? 0) - (left.sourceYear ?? 0);
          }
          return (right.sourceRound ?? 0) - (left.sourceRound ?? 0);
        }),
    [paperOptions]
  );
  const med2PaperOptions = useMemo(
    () =>
      [...paperOptions]
        .filter((paper) => paper.subject === "醫學（二）")
        .sort((left, right) => {
          if ((right.sourceYear ?? 0) !== (left.sourceYear ?? 0)) {
            return (right.sourceYear ?? 0) - (left.sourceYear ?? 0);
          }
          return (right.sourceRound ?? 0) - (left.sourceRound ?? 0);
        }),
    [paperOptions]
  );

  useEffect(() => {
    const completedSessions = loadCompletedSessions();
    const counts = completedSessions.reduce<Record<string, number>>((accumulator, session) => {
      const paperKey =
        session.settings?.mode === "simulation" &&
        session.settings?.paperMode === "past_paper"
          ? session.settings?.selectedPaperKey
          : undefined;

      if (!paperKey) return accumulator;
      accumulator[paperKey] = (accumulator[paperKey] ?? 0) + 1;
      return accumulator;
    }, {});

    setCompletedPaperCounts(counts);
  }, []);

  function updateSettings(next: Partial<QuizSettings>) {
    setSettings((current) => {
      const merged = { ...current, ...next } as QuizSettings;
      if (next.mode === "simulation" && current.mode !== "simulation") {
        merged.subjectFilter = "醫學（一）";
        merged.questionCount = 100;
        merged.chapter = undefined;
        merged.section = undefined;
      }
      if (next.chapter && next.chapter !== current.chapter) {
        merged.section = undefined;
      }
      if (next.subjectFilter && next.subjectFilter !== current.subjectFilter) {
        merged.chapter = undefined;
        merged.section = undefined;
        if (merged.mode === "simulation" && next.subjectFilter !== "全部") {
          merged.paperMode = merged.paperMode ?? "random_set";
        }
      }
      return merged;
    });
  }

  function handleStart() {
    saveQuizSettings(settings);
    router.push("/quiz?new=1");
  }

  function handleQuickWeakness() {
    const nextSettings: QuizSettings = {
      mode: "weakness",
      questionCount: 10,
      subjectFilter: "解剖學",
      chapter: weakestSection?.chapter,
      section: weakestSection?.section
    };
    saveQuizSettings(nextSettings);
    router.push("/quiz?new=1");
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Version 2</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            {title ?? (simulationOnly ? "模擬考模式" : "智慧測驗設定")}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {description ??
              (simulationOnly
                ? "模擬考模式會固定用整份考卷邏輯出題，所以不提供科目、題數、章節與小節篩選，避免把模考做成一般刷題模式。先選擇作答後顯示方式，再決定要做系統模擬卷、指定真實考古題，或隨機抽一份真實考古題。"
                : "現在可切換單科刷題與醫學（一）多科模擬考，並選擇即時看詳解或整份做完再批改。")}
          </p>
        </div>
        {!simulationOnly ? (
          <button
            type="button"
            onClick={handleQuickWeakness}
            className="min-h-12 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            直接刷我最弱 section
          </button>
        ) : null}
      </div>

      <div className={`mt-5 grid gap-4 ${simulationOnly ? "lg:grid-cols-1" : "lg:grid-cols-3"}`}>
        {((simulationOnly
          ? ["simulation"]
          : ["weakness", "random", "review"]) as QuizMode[]).map((mode) => (
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

      <div className={`mt-6 grid gap-4 ${settings.mode === "simulation" ? "grid-cols-1" : "lg:grid-cols-[0.9fr_1.1fr]"}`}>
        {settings.mode !== "simulation" ? (
          <>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">科目</p>
              <select
                value={settings.subjectFilter ?? "解剖學"}
                onChange={(event) => updateSettings({ subjectFilter: event.target.value as SubjectFilter })}
                className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
              >
                <option value="全部">醫學（一）全科</option>
                {enabledSubjects
                  .filter((item) => item.subject !== "醫學（一）")
                  .map((item) => (
                    <option key={item.subject} value={item.subject}>
                      {item.label}（{item.questions.length} 題）
                    </option>
                  ))}
              </select>

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
            </div>
          </>
        ) : null}
        <div className="rounded-3xl bg-slate-50 p-5">
          {settings.mode === "simulation" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">作答後顯示方式</p>
                <div className="mt-3 grid gap-3">
                  {(["full", "answer_only", "none"] as SimulationFeedbackMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSettings({ feedbackMode: mode })}
                      className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                        (settings.feedbackMode ?? "none") === mode
                          ? "bg-brand-600 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {feedbackModeLabels[mode]}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-7 text-slate-700">
                  {feedbackModeDescriptions[settings.feedbackMode ?? "full"]}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">模擬考卷來源</p>
                <div className="mt-3 grid gap-3">
                  {(["random_set", "past_paper", "random_past_paper"] as SimulationPaperMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSettings({ paperMode: mode })}
                      className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                        (settings.paperMode ?? "random_set") === mode
                          ? "bg-brand-600 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {paperModeLabels[mode]}
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-7 text-slate-700">
                  {paperModeDescriptions[settings.paperMode ?? "random_set"]}
                </div>
              </div>

              {(settings.paperMode ?? "random_set") === "past_paper" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                    請直接點選要做的卷別。已做過的卷會標示次數，方便你分辨哪些卷已經寫過。
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {([
                    { title: "醫學（一）", papers: med1PaperOptions, accent: "amber" },
                    { title: "醫學（二）", papers: med2PaperOptions, accent: "sky" }
                    ] as const).map(({ title: groupTitle, papers, accent }) => (
                      <div key={groupTitle} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">{groupTitle}</p>
                          <span className="text-xs text-slate-500">{papers.length} 份考卷</span>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {papers.map((paper) => {
                            const isSelected = settings.selectedPaperKey === paper.key;
                            const completedCount = completedPaperCounts[paper.key] ?? 0;
                            const accentClasses =
                              accent === "amber"
                                ? isSelected
                                  ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                                  : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/60"
                                : isSelected
                                  ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
                                  : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60";

                            return (
                              <button
                                key={paper.key}
                                type="button"
                                onClick={() => updateSettings({ selectedPaperKey: paper.key })}
                                className={`rounded-2xl border px-4 py-4 text-left transition ${accentClasses}`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">{paper.label}</p>
                                    <p className="mt-1 text-xs text-slate-500">{paper.questionCount} 題完整考卷</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {completedCount > 0 ? (
                                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        已做過 {completedCount} 次
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                        尚未作答
                                      </span>
                                    )}
                                    {isSelected ? (
                                      <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                                        目前選取
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="text-xs leading-6 text-slate-500">
                不論你選哪一種模擬考模式，作答時都還是可以填寫信心程度，方便之後做弱點分析。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          目前設定：
          <span className="font-semibold text-ink"> {getModeLabel(settings.mode)}</span>
          {settings.mode === "simulation" ? "・整份模擬考" : `・${subjectItem?.label ?? settings.subjectFilter ?? "解剖學"}・${settings.questionCount} 題`}
          {settings.mode !== "simulation" && settings.chapter ? `・${settings.chapter}` : ""}
          {settings.mode !== "simulation" && settings.section ? ` / ${settings.section}` : ""}
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
