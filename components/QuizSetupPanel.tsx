"use client";

import { getOfficialPaperKeyFromQuestionId } from "@/lib/officialPaperIdentity";

import { formatRocYear } from "@/lib/rocDate";


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
import { loadCompletedSessions, loadCurrentSession, loadSimulationConfidenceCalibration, saveQuizSettings } from "@/lib/storage";
import { getSimulationConfidenceCalibrationPreference } from "@/lib/accountPreferences";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import {
  CompletionStatsBundle,
  QuizMode,
  QuizSettings,
  QuizSession,
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
  search_practice: "只練你從題目搜尋選取的題目，不會建立或公開自訂卷。",
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
    const paperKey = getOfficialPaperKeyFromQuestionId(questionId);
    if (paperKey) paperKeys.add(paperKey);

    const aiMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiMatch) paperKeys.add(aiMatch[1]);
  }
  return paperKeys.size === 1 ? Array.from(paperKeys)[0] : undefined;
}

type CompletedPaperSummary = {
  lastScore: number | null;
  lastCompletedAt: string;
  hasAnswered: boolean;
};

function buildCompletedPaperSummaries() {
  const completedSessions = loadCompletedSessions();
  return completedSessions.reduce<Record<string, CompletedPaperSummary>>((accumulator, session) => {
    const attempts = Array.isArray(session.attempts) ? session.attempts : [];
    const paperKey = session.settings?.mode === "simulation"
      ? session.settings?.selectedPaperKey ??
        inferPastPaperKeyFromQuestionIds([
          ...(session.questionOrder ?? []),
          ...attempts.map((attempt) => attempt.questionId)
        ])
      : undefined;

    if (!paperKey) return accumulator;
    const total = attempts.length;
    const correct = attempts.filter((attempt) => attempt.isCorrect).length;
    const completedAt = session.completedAt ?? session.startedAt;
    const current = accumulator[paperKey];
    const lastScore = total > 0 ? Math.round((correct / total) * 100) : null;

    accumulator[paperKey] = {
      hasAnswered: Boolean(current?.hasAnswered || total > 0),
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
  const [paperStatsOpen, setPaperStatsOpen] = useState(false);
  const [paperYear, setPaperYear] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<QuizSession | null>(null);
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
  const allPastPapers = useMemo(() => settings.mode === "simulation" && settings.paperMode !== "ai_paper" ? getPastPaperOptions("全部") : [], [settings.mode, settings.paperMode]);
  const paperYears = useMemo(() => Array.from(new Set(allPastPapers.map((paper) => paper.sourceYear).filter((year): year is number => typeof year === "number"))).sort((a, b) => b - a), [allPastPapers]);
  const visibleYear = paperYear ?? selectedPaper?.sourceYear ?? paperYears[0];
  const activePaperMode = settings.paperMode ?? "random_set";
  const visiblePaper = activePaperMode === "past_paper" && selectedPaper?.sourceYear !== visibleYear ? undefined : selectedPaper;
  const selectedCount = visiblePaper?.questionCount ?? 100;
  const officialScope = visiblePaper && "officialScope" in visiblePaper ? visiblePaper.officialScope : undefined;
  const officialTime = visiblePaper && "timeMinutes" in visiblePaper ? visiblePaper.timeMinutes : undefined;
  const officialPoints = visiblePaper && "pointsPerQuestion" in visiblePaper ? visiblePaper.pointsPerQuestion : undefined;
  const canViewSelectedPaperDetails = Boolean(
    selectedPaper &&
      (completedPaperSummaries[selectedPaper.key]?.hasAnswered || isAdminEmail(user?.email))
  );
  const isSelectablePaperMode = activePaperMode === "past_paper" || activePaperMode === "ai_paper";
  const canStart = !isSelectablePaperMode || Boolean(settings.selectedPaperKey && visiblePaper);
  const currentPaperKey = currentSession?.settings?.mode === "simulation" && !currentSession.completedAt
    ? currentSession.settings.selectedPaperKey ?? inferPastPaperKeyFromQuestionIds(currentSession.questionOrder ?? [])
    : undefined;

  useEffect(() => {
    setCompletedPaperSummaries(buildCompletedPaperSummaries());
  }, [syncStatus, syncVersion]);

  useEffect(() => {
    const refresh = () => setCurrentSession(loadCurrentSession());
    refresh();
    window.addEventListener("current-session-change", refresh);
    return () => window.removeEventListener("current-session-change", refresh);
  }, [syncVersion]);

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
          merged.selectedPaperKey = next.selectedPaperKey;
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
            questionCount: selectedCount,
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
                ? "選擇卷別與考卷，即可開始模擬考。"
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

      {!simulationOnly ? <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {(["weakness", "random", "review"] as QuizMode[]).map((mode) => (
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
      </div> : null}

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
        {settings.mode === "simulation" ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-ink">選擇卷別</p>
              <div className="mt-2 grid grid-cols-2 gap-3" role="group" aria-label="模擬考卷別">
                {simulationSubjectOptions.map((item) => (
                  <button
                    key={item.subject}
                    type="button"
                    aria-pressed={(settings.subjectFilter ?? "醫學（一）") === item.subject}
                    onClick={() => updateSettings({ subjectFilter: item.subject })}
                    className={`min-h-12 rounded-xl border px-4 py-3 text-left transition ${
                      (settings.subjectFilter ?? "醫學（一）") === item.subject
                        ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{officialScope ? item.subject === selectedPaper?.subject ? officialScope : "科目範圍依所選考卷為準" : visiblePaper?.sourceYear && visiblePaper.sourceYear >= 2009 && visiblePaper.sourceYear <= 2010
                      ? item.subject === "醫學（一）" ? "解剖、胚胎、組織、微免、寄生蟲、公衛" : "生理、生化、藥理、病理"
                      : item.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {isSelectablePaperMode ? (
              <div>
                {activePaperMode === "ai_paper" ? (
                  <>
                    <label htmlFor="simulation-paper" className="text-sm font-semibold text-ink">選擇 AI 模擬卷</label>
                    <select id="simulation-paper" value={settings.selectedPaperKey ?? ""} onChange={(event) => updateSettings({ selectedPaperKey: event.target.value })} disabled={selectedPaperOptions.length === 0} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:bg-slate-50">
                      {selectedPaperOptions.length === 0 ? <option value="">目前沒有可用的完整考卷</option> : null}
                      {selectedPaperOptions.map((paper) => <option key={paper.key} value={paper.key}>{paper.label}{completedPaperSummaries[paper.key] ? completedPaperSummaries[paper.key].lastScore === null ? " · 上次未作答" : ` · 上次已答題正確率 ${completedPaperSummaries[paper.key].lastScore}%` : " · 尚未作答"}</option>)}
                    </select>
                  </>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-ink">選擇考古卷</p>
                    <div role="group" aria-label="考卷年份" className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-2">
                      {paperYears.map((year) => <button key={year} type="button" aria-pressed={visibleYear === year} onClick={() => setPaperYear(year)} className={`min-h-10 shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${visibleYear === year ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700"}`}>{formatRocYear(year)}</button>)}
                    </div>
                    <div role="group" aria-label={`${visibleYear ? formatRocYear(visibleYear) : "所選年份"}考卷`} className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                      {allPastPapers.filter((paper) => paper.sourceYear === visibleYear).map((paper) => {
                        const summary = completedPaperSummaries[paper.key];
                        const progress = currentPaperKey === paper.key && currentSession ? currentSession.attempts.length : null;
                        return <div key={paper.key} className="min-w-0 rounded-xl border border-slate-200 bg-white">
                          <button type="button" aria-pressed={settings.selectedPaperKey === paper.key} onClick={() => updateSettings({ subjectFilter: paper.subject, selectedPaperKey: paper.key })} className={`w-full min-w-0 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${settings.selectedPaperKey === paper.key ? "bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "text-slate-700"}`}>
                            <span className="block text-xs text-slate-500">{paper.cardTrackLabel}</span>
                            <span className="mt-1 block text-sm font-semibold">第 {paper.sourceRound ?? 1} 次・{paper.cardPaperTitle ?? paper.subject}</span>
                            <span className="mt-1 block text-xs text-slate-500">{paper.questionCount} 題・{summary ? summary.lastScore === null ? "上次未作答" : `上次已答題正確率 ${summary.lastScore}%` : "尚未作答"}</span>
                          </button>
                          {progress !== null && currentSession ? <div className="px-3 pb-3 text-xs text-slate-600">進行中，已答 {progress} / {currentSession.questionOrder?.length ?? paper.questionCount} 題・<a className="font-semibold text-brand-700 underline" href={`/quiz?resume=1&sessionId=${encodeURIComponent(currentSession.id)}`}>繼續作答</a></div> : null}
                        </div>;
                      })}
                    </div>
                  </div>
                )}
                {visiblePaper?.sourceYear && visiblePaper.sourceYear >= 2009 && visiblePaper.sourceYear <= 2010 ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
                    {formatRocYear(visiblePaper.sourceYear)}舊制：{visiblePaper.subject === "醫學（一）"
                      ? "醫學（一）含解剖、胚胎、組織、微生物免疫、寄生蟲及公共衛生。"
                      : "醫學（二）含生理、生化、藥理及病理。"}每卷 100 題，依當年官方最終答案及更正採分；法規與醫學知識可能已有更新。
                  </p>
                ) : null}
                {officialScope ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">官方科目：{officialScope}。每卷 {selectedCount} 題，每題 {officialPoints} 分，考試時間 {officialTime} 分鐘；網站另依內容提供細分類。</p> : null}
              </div>
            ) : (
              <div className="border-l-2 border-brand-200 pl-3">
                <p className="text-sm font-semibold text-ink">{paperModeLabels[activePaperMode]}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{paperModeDescriptions[activePaperMode]}</p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0" aria-live="polite">
                <p className="text-sm font-semibold leading-6 text-ink">
                  {visiblePaper?.label ?? (activePaperMode === "past_paper" ? "請選擇這一年的考卷" : `${settings.subjectFilter === "醫學（二）" ? "醫學（二）" : "醫學（一）"} · ${paperModeLabels[activePaperMode]}`)}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {activePaperMode === "random_past_paper" ? "題數依抽到的考卷" : activePaperMode === "past_paper" && !visiblePaper ? "請先選擇考卷" : `${selectedCount} 題`} · {feedbackModeLabels[settings.feedbackMode ?? "none"]}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className="min-h-12 shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {activePaperMode === "random_past_paper" ? "開始模擬考" : activePaperMode === "past_paper" && !visiblePaper ? "選擇考卷後開始" : `開始 ${selectedCount} 題模擬考`}
              </button>
            </div>

            <details>
              <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                調整考卷來源與作答方式
              </summary>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="simulation-paper-mode" className="text-sm font-medium text-ink">考卷來源</label>
                  <select
                    id="simulation-paper-mode"
                    value={activePaperMode}
                    onChange={(event) => updateSettings({ paperMode: event.target.value as SimulationPaperMode })}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {(["past_paper", "ai_paper", "random_past_paper", "random_set"] as SimulationPaperMode[]).map((mode) => (
                      <option key={mode} value={mode}>{paperModeLabels[mode]}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{paperModeDescriptions[activePaperMode]}</p>
                </div>
                <div>
                  <label htmlFor="simulation-feedback-mode" className="text-sm font-medium text-ink">作答後顯示方式</label>
                  <select
                    id="simulation-feedback-mode"
                    value={settings.feedbackMode ?? "none"}
                    onChange={(event) => updateSettings({ feedbackMode: event.target.value as SimulationFeedbackMode })}
                    className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {(["none", "answer_only", "full"] as SimulationFeedbackMode[]).map((mode) => (
                      <option key={mode} value={mode}>{feedbackModeLabels[mode]}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{feedbackModeDescriptions[settings.feedbackMode ?? "none"]}</p>
                </div>
                <p className="text-xs leading-6 text-slate-500 sm:col-span-2">
                  信心校準目前{simulationConfidenceCalibration ? "開啟" : "關閉"}，可在帳號設定調整。
                </p>
              </div>
            </details>

            {selectedPaper ? (
              <details open={paperStatsOpen} onToggle={(event) => setPaperStatsOpen(event.currentTarget.open)}>
                <summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                  查看這份考卷的作答統計
                </summary>
                {paperStatsOpen ? <div className="mt-3">
                  <SelectedSimulationPaperPanel
                    key={selectedPaper.key}
                    paper={selectedPaper}
                    canViewDetailedStats={canViewSelectedPaperDetails}
                  />
                </div> : null}
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      {settings.mode !== "simulation" ? <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          目前設定：
          <span className="font-semibold text-ink"> {getModeLabel(settings.mode)}</span>
          {`・${subjectItem?.label ?? settings.subjectFilter ?? "解剖學"}・${settings.questionCount} 題`}
          {settings.chapter ? `・${settings.chapter}` : ""}
          {settings.section ? ` / ${settings.section}` : ""}
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
      </div> : null}
    </section>
  );
}
