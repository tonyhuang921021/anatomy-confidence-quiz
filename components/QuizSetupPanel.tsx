"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { SelectedSimulationPaperPanel } from "@/components/SelectedSimulationPaperPanel";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { getAISimulationPaperOptions, getPastPaperOptions } from "@/data/med1QuestionBank";
import { enabledSubjects, subjectRegistry } from "@/data/subjectRegistry";
import { isAdminEmail } from "@/lib/adminAccess";
import {
  DEFAULT_QUIZ_SETTINGS,
  getModeLabel
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, loadSimulationConfidenceCalibration, saveQuizSettings } from "@/lib/storage";
import { getSimulationConfidenceCalibrationPreference } from "@/lib/accountPreferences";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
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
  simulation: "像正式考試一樣，可選真實考古卷、AI 模擬卷或電腦隨機整份卷。",
  custom_paper: "自訂卷模式會用專屬頁面產卷或輸入考卷碼。"
};

const questionCounts = [10, 15, 20, 50, 100];

const feedbackModeLabels: Record<SimulationFeedbackMode, string> = {
  full: "每題看正確與詳解",
  answer_only: "每題只看正確答案",
  none: "全程只做題，最後再看結果"
};

const feedbackModeDescriptions: Record<SimulationFeedbackMode, string> = {
  full: "適合邊做邊學。每題送出後會顯示正解、詳解與各選項解析。",
  answer_only: "適合先測自己，再快速確認對錯。每題送出後只顯示正確答案，不立刻看長詳解。",
  none: "最接近正式考試。作答當下不公布答案與詳解，但信心仍會照常記錄，最後再一起看結果。"
};

const paperModeLabels: Record<SimulationPaperMode, string> = {
  random_set: "電腦隨機抽一份",
  past_paper: "指定真實考古題",
  ai_paper: "指定 AI 模擬卷",
  random_past_paper: "隨機抽一份真實考古題"
};

const paperModeDescriptions: Record<SimulationPaperMode, string> = {
  random_set:
    "系統會依你選的醫學（一）或醫學（二）正式科目比例，重組一份 100 題新模擬卷。",
  past_paper:
    "直接指定某一年、某一次、某一卷別的真實考古卷，維持原始題序，最適合完整模考。",
  ai_paper:
    "使用 AI 原創的整份模擬卷，依醫學（一）或醫學（二）分開整理，維持 100 題完整題序。",
  random_past_paper:
    "從你選的醫學（一）或醫學（二）真實考古卷中隨機抽一整份來寫，保留真實卷題序。"
};

const simulationSubjectOptions = [
  {
    subject: "醫學（一）" as SubjectFilter,
    label: "醫學（一）",
    description: "解剖 31、生理 27、生化 27、組織 10、胚胎 5"
  },
  {
    subject: "醫學（二）" as SubjectFilter,
    label: "醫學（二）",
    description: "微免 28、藥理 25、病理 25、公衛 15、寄生蟲 7"
  }
];

function inferPastPaperKeyFromQuestionIds(questionIds: string[]) {
  const paperKeys = new Set<string>();
  for (const questionId of questionIds) {
    const match = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
    if (match) paperKeys.add(`${match[1]}-${match[2]}`);

    const aiMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiMatch) paperKeys.add(aiMatch[1]);
  }
  return paperKeys.size === 1 ? Array.from(paperKeys)[0] : undefined;
}

type CompletedPaperSummary = {
  lastScore: number;
  lastCompletedAt: string;
};

function buildCompletedPaperSummaries() {
  const completedSessions = loadCompletedSessions();
  return completedSessions.reduce<Record<string, CompletedPaperSummary>>((accumulator, session) => {
    const paperKey = session.settings?.mode === "simulation"
      ? session.settings?.selectedPaperKey ??
        inferPastPaperKeyFromQuestionIds([
          ...(session.questionOrder ?? []),
          ...session.attempts.map((attempt) => attempt.questionId)
        ])
      : undefined;

    if (!paperKey) return accumulator;
    const total = session.attempts.length;
    if (total <= 0) return accumulator;

    const correct = session.attempts.filter((attempt) => attempt.isCorrect).length;
    const completedAt = session.completedAt ?? session.startedAt;
    const current = accumulator[paperKey];
    const lastScore = Math.round((correct / total) * 100);

    accumulator[paperKey] = {
      lastScore: !current || completedAt.localeCompare(current.lastCompletedAt) >= 0
        ? lastScore
        : current.lastScore,
      lastCompletedAt: !current || completedAt.localeCompare(current.lastCompletedAt) >= 0
        ? completedAt
        : current.lastCompletedAt
    };
    return accumulator;
  }, {});
}

export function QuizSetupPanel({
  stats,
  simulationOnly = false,
  title,
  description
}: QuizSetupPanelProps) {
  const router = useRouter();
  const { user, syncStatus, syncVersion } = useAuth();
  useCloudHistoryHydration();
  const [simulationConfidenceCalibration, setSimulationConfidenceCalibration] = useState(() =>
    loadSimulationConfidenceCalibration(true)
  );
  const [settings, setSettings] = useState<QuizSettings>(
        simulationOnly
      ? {
          ...DEFAULT_QUIZ_SETTINGS,
          mode: "simulation",
          subjectFilter: "醫學（一）",
          questionCount: 100,
          feedbackMode: "none",
          paperMode: "past_paper",
          enableConfidenceCalibration: simulationConfidenceCalibration
        }
      : DEFAULT_QUIZ_SETTINGS
  );
  const [completedPaperSummaries, setCompletedPaperSummaries] = useState<Record<string, CompletedPaperSummary>>({});
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
    return settings.paperMode === "ai_paper"
      ? getAISimulationPaperOptions(settings.subjectFilter ?? "醫學（一）")
      : getPastPaperOptions(settings.subjectFilter ?? "醫學（一）");
  }, [settings.mode, settings.paperMode, settings.subjectFilter]);
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
  const selectedPaperOptions =
    settings.subjectFilter === "醫學（二）" ? med2PaperOptions : med1PaperOptions;
  const selectedPaper = selectedPaperOptions.find(
    (paper) => paper.key === settings.selectedPaperKey
  );
  const canViewSelectedPaperDetails = Boolean(
    selectedPaper &&
      (completedPaperSummaries[selectedPaper.key] || isAdminEmail(user?.email))
  );
  const activePaperMode = settings.paperMode ?? "random_set";
  const isSelectablePaperMode = activePaperMode === "past_paper" || activePaperMode === "ai_paper";
  const canStart = !isSelectablePaperMode || Boolean(settings.selectedPaperKey);

  useEffect(() => {
    setCompletedPaperSummaries(buildCompletedPaperSummaries());
  }, [syncStatus, syncVersion]);

  useEffect(() => {
    const nextSimulationConfidenceCalibration = user
      ? getSimulationConfidenceCalibrationPreference(user.user_metadata, true)
      : loadSimulationConfidenceCalibration(true);
    setSimulationConfidenceCalibration(nextSimulationConfidenceCalibration);
    setSettings((current) =>
      current.mode === "simulation"
        ? { ...current, enableConfidenceCalibration: nextSimulationConfidenceCalibration }
        : current
    );
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    function handleCompletedSessionsChange() {
      setCompletedPaperSummaries(buildCompletedPaperSummaries());
    }

    window.addEventListener("completed-sessions-change", handleCompletedSessionsChange);
    return () => window.removeEventListener("completed-sessions-change", handleCompletedSessionsChange);
  }, []);

  useEffect(() => {
    if (settings.mode !== "simulation" || !isSelectablePaperMode) return;
    if (selectedPaperOptions.length === 0) {
      if (settings.selectedPaperKey) {
        setSettings((current) => ({
          ...current,
          selectedPaperKey: undefined
        }));
      }
      return;
    }
    const stillAvailable = selectedPaperOptions.some((paper) => paper.key === settings.selectedPaperKey);
    if (stillAvailable) return;
    setSettings((current) => ({
      ...current,
      selectedPaperKey: selectedPaperOptions[0]?.key
    }));
  }, [isSelectablePaperMode, selectedPaperOptions, settings.mode, settings.selectedPaperKey]);

  function updateSettings(next: Partial<QuizSettings>) {
    setSettings((current) => {
      const merged = { ...current, ...next } as QuizSettings;
      if (next.mode === "simulation" && current.mode !== "simulation") {
        merged.subjectFilter = "醫學（一）";
        merged.questionCount = 100;
        merged.chapter = undefined;
        merged.section = undefined;
        merged.paperMode = "past_paper";
        merged.selectedPaperKey = undefined;
        merged.enableConfidenceCalibration = simulationConfidenceCalibration;
      }
      if (next.mode && next.mode !== "simulation" && current.mode === "simulation") {
        merged.enableConfidenceCalibration = false;
      }
      if (next.chapter && next.chapter !== current.chapter) {
        merged.section = undefined;
      }
      if (next.subjectFilter && next.subjectFilter !== current.subjectFilter) {
        merged.chapter = undefined;
        merged.section = undefined;
        if (merged.mode === "simulation") {
          merged.paperMode = merged.paperMode ?? "past_paper";
          merged.questionCount = 100;
          merged.selectedPaperKey = undefined;
        }
      }
      if (next.paperMode && next.paperMode !== current.paperMode) {
        merged.selectedPaperKey = undefined;
        if (merged.mode === "simulation") {
          merged.questionCount = 100;
          merged.subjectFilter = merged.subjectFilter === "醫學（二）" ? "醫學（二）" : "醫學（一）";
        }
      }
      return merged;
    });
  }

  function handleStart() {
    const simulationSubject: SubjectFilter =
      settings.subjectFilter === "醫學（二）" ? "醫學（二）" : "醫學（一）";
    const nextSettings =
      settings.mode === "simulation"
        ? {
            ...settings,
            sessionName: undefined,
            questionCount: 100,
            subjectFilter: simulationSubject,
            enableConfidenceCalibration: simulationConfidenceCalibration,
            selectedPaperKey:
              settings.paperMode === "past_paper" || settings.paperMode === "ai_paper"
                ? settings.selectedPaperKey
                : undefined
          }
        : {
            ...settings,
            enableConfidenceCalibration: false
          };
    saveQuizSettings(nextSettings);
    router.push(buildNewQuizHref(nextSettings));
  }

  function handleQuickWeakness() {
    const nextSettings: QuizSettings = {
      mode: "weakness",
      questionCount: 10,
      subjectFilter: "解剖學",
      excludePreviouslyAnswered: true,
      enableConfidenceCalibration: false,
      chapter: weakestSection?.chapter,
      section: weakestSection?.section
    };
    saveQuizSettings(nextSettings);
    router.push(buildNewQuizHref(nextSettings));
  }

  return (
    <section className="workspace-section quiz-setup-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {title ?? (simulationOnly ? "模擬考模式" : "智慧測驗設定")}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            {description ??
              (simulationOnly
                ? "模擬考模式會固定用整份考卷邏輯出題，所以不提供科目、題數、章節與小節篩選，避免把模考做成一般刷題模式。先選擇作答後顯示方式，再決定要做 AI 模擬卷、系統模擬卷、指定真實考古題，或隨機抽一份真實考古題。"
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
            className={`quiz-setup-choice border text-left transition ${
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
            <div className="quiz-setup-group">
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

            <div className="quiz-setup-group">
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
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
                <input
                  type="checkbox"
                  checked={settings.excludePreviouslyAnswered ?? true}
                  onChange={(event) => updateSettings({ excludePreviouslyAnswered: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span>
                  <span className="block font-semibold text-ink">優先避開已做過的題目</span>
                  <span className="mt-1 block leading-6 text-slate-500">
                    題池夠時不重複；若篩選範圍太小，才補最久以前做過的題。
                  </span>
                </span>
              </label>
            </div>
          </>
        ) : null}
        <div className="quiz-setup-group">
          {settings.mode === "simulation" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm font-medium text-slate-500">模擬考卷別</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {simulationSubjectOptions.map((item) => (
                    <button
                      key={item.subject}
                      type="button"
                      onClick={() => updateSettings({ subjectFilter: item.subject })}
                      className={`rounded-2xl px-4 py-4 text-left transition ${
                        (settings.subjectFilter ?? "醫學（一）") === item.subject
                          ? "bg-brand-600 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span
                        className={`mt-2 block text-xs leading-6 ${
                          (settings.subjectFilter ?? "醫學（一）") === item.subject
                            ? "text-white/80"
                            : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

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
                  {(["past_paper", "ai_paper", "random_past_paper", "random_set"] as SimulationPaperMode[]).map((mode) => (
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

              {isSelectablePaperMode ? (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                    {activePaperMode === "ai_paper"
                      ? "請選擇要做的 AI 原創模擬卷。做過的卷會標示上次分數，方便你挑想重刷的考卷。"
                      : "請直接點選要做的卷別。已做過的卷會標示上次分數，方便你挑想重刷的考卷。"}
                  </div>

                  <div
                    className={`grid gap-4 ${
                      selectedPaper
                        ? "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
                        : "grid-cols-1"
                    }`}
                  >
                    {([
                      settings.subjectFilter === "醫學（二）"
                        ? { title: "醫學（二）", papers: selectedPaperOptions, accent: "sky" }
                        : { title: "醫學（一）", papers: selectedPaperOptions, accent: "amber" }
                    ] as const).map(({ title: groupTitle, papers, accent }) => (
                      <div key={groupTitle} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-ink">{groupTitle}</p>
                          <span className="text-xs text-slate-500">{papers.length} 份考卷</span>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {papers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-7 text-slate-500">
                              目前還沒有{groupTitle}的{activePaperMode === "ai_paper" ? " AI 模擬卷" : "完整考古卷"}。
                            </div>
                          ) : (
                            papers.map((paper) => {
                              const isSelected = settings.selectedPaperKey === paper.key;
                              const completedSummary = completedPaperSummaries[paper.key];
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
                                      {completedSummary ? (
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                          上次 {completedSummary.lastScore} 分
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
                            })
                          )}
                        </div>
                      </div>
                    ))}
                    {selectedPaper ? (
                      <SelectedSimulationPaperPanel
                        key={selectedPaper.key}
                        paper={selectedPaper}
                        canViewDetailedStats={canViewSelectedPaperDetails}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              <p className="text-xs leading-6 text-slate-500">
                信心校準目前{simulationConfidenceCalibration ? "開啟" : "關閉"}。想調整時可回首頁設定；散題仍會問信心，但不顯示校準分析。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          目前設定：
          <span className="font-semibold text-ink"> {getModeLabel(settings.mode)}</span>
          {settings.mode === "simulation"
            ? `・${settings.subjectFilter === "醫學（二）" ? "醫學（二）" : "醫學（一）"}・${paperModeLabels[settings.paperMode ?? "random_set"]}・100 題`
            : `・${subjectItem?.label ?? settings.subjectFilter ?? "解剖學"}・${settings.questionCount} 題`}
          {settings.mode !== "simulation" && settings.chapter ? `・${settings.chapter}` : ""}
          {settings.mode !== "simulation" && settings.section ? ` / ${settings.section}` : ""}
          {settings.mode === "simulation" ? (simulationConfidenceCalibration ? "・信心校準" : "・不記信心") : ""}
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={`min-h-12 rounded-2xl px-5 py-4 text-sm font-semibold text-white transition ${
            canStart ? "bg-brand-600 hover:bg-brand-700" : "cursor-not-allowed bg-slate-300"
          }`}
        >
          用這個設定開始
        </button>
      </div>
    </section>
  );
}
