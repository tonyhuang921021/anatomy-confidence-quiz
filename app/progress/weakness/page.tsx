"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { loadCompletedSessionsAcrossUserScopes } from "@/lib/storage";
import {
  analyzeRecentWeakness,
  buildWeaknessQuestionOrder,
  type WeaknessAnalysisResult,
  type WeaknessConcept
} from "@/lib/weaknessAnalysis";
import type { Question, QuizSession, SubjectName } from "@/types/quiz";

const ANALYSIS_SUBJECTS = [...MED1_SUBJECTS, ...MED2_SUBJECTS];
const ANALYSIS_SUBJECT_STORAGE_KEY = "preExamWeaknessSelectedSubjectsV1";
const ALL_ANALYSIS_QUESTIONS = ANALYSIS_SUBJECTS.flatMap(
  (subject) => subjectRegistry[subject].questions
);

type AnalysisStage =
  | "selecting"
  | "syncing"
  | "loading"
  | "indexing"
  | "calculating"
  | "ready"
  | "failed";

type AnalysisProgress = {
  stage: AnalysisStage;
  message: string;
  progress: number;
};

function formatDateTime(value: string | null) {
  if (!value) return "尚無作答紀錄";
  return new Date(value).toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function readStoredSubjects() {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_SUBJECT_STORAGE_KEY);
    if (!raw) return [] as SubjectName[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<SubjectName>(ANALYSIS_SUBJECTS);
    return parsed.filter(
      (subject): subject is SubjectName =>
        typeof subject === "string" && allowed.has(subject as SubjectName)
    );
  } catch {
    return [] as SubjectName[];
  }
}

function saveStoredSubjects(subjects: SubjectName[]) {
  try {
    window.localStorage.setItem(ANALYSIS_SUBJECT_STORAGE_KEY, JSON.stringify(subjects));
  } catch {
    // The current visit can still use the selected subjects when storage is unavailable.
  }
}

function nextPaint() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

export default function WeaknessAnalysisPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    syncError,
    syncStatus,
    syncVersion,
    refreshCloudData
  } = useAuth();
  const [selectionReady, setSelectionReady] = useState(false);
  const [draftSubjects, setDraftSubjects] = useState<SubjectName[]>([]);
  const [activeSubjects, setActiveSubjects] = useState<SubjectName[]>([]);
  const [analysisRevision, setAnalysisRevision] = useState(0);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [result, setResult] = useState<WeaknessAnalysisResult | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: "selecting",
    message: "選擇要納入分析的科目",
    progress: 0
  });
  const lastAnalysisKeyRef = useRef("");
  const activeSubjectKey = activeSubjects.join("|");
  const hasAnalysisScope = selectionReady && activeSubjects.length > 0;
  const cloudHydrating = useCloudHistoryHydration(
    hasAnalysisScope && Boolean(user?.id),
    { force: true, readRemoteOnly: true }
  );

  useEffect(() => {
    const storedSubjects = readStoredSubjects();
    setDraftSubjects(storedSubjects);
    setActiveSubjects(storedSubjects);
    setSelectionReady(true);
    if (storedSubjects.length > 0) {
      setProgress({ stage: "syncing", message: "正在讀取完整作答紀錄", progress: 12 });
    }
  }, []);

  useEffect(() => {
    if (!selectionReady || activeSubjects.length === 0 || authLoading) return;
    if (cloudHydrating || (user?.id && syncStatus === "syncing")) {
      setProgress({ stage: "syncing", message: "正在讀取完整雲端作答紀錄", progress: 12 });
      return;
    }
    if (user?.id && syncError) {
      setResult(null);
      setProgress({
        stage: "failed",
        message: "完整雲端紀錄尚未讀取完成，這次不產生部分分析。",
        progress: 0
      });
      return;
    }

    const analysisKey = `${user?.id ?? "guest"}:${syncVersion}:${activeSubjectKey}:${analysisRevision}`;
    if (lastAnalysisKeyRef.current === analysisKey) return;
    lastAnalysisKeyRef.current = analysisKey;
    let cancelled = false;

    const runAnalysis = async () => {
      setResult(null);
      setProgress({ stage: "loading", message: "正在合併完整作答紀錄", progress: 35 });
      await nextPaint();
      if (cancelled) return;

      const completedSessions = loadCompletedSessionsAcrossUserScopes(
        user?.id ?? "guest",
        { includeFullLocalHistory: true }
      );
      const totalAttempts = completedSessions.reduce(
        (total, session) => total + session.attempts.length,
        0
      );
      setSessions(completedSessions);
      setProgress({
        stage: "indexing",
        message: `已載入 ${totalAttempts.toLocaleString("zh-TW")} 筆紀錄，正在整理 6,200 題分類`,
        progress: 68
      });
      await nextPaint();
      if (cancelled) return;

      setProgress({
        stage: "calculating",
        message: `正在分析 ${activeSubjects.length} 科的近 14 天作答`,
        progress: 86
      });
      await nextPaint();
      if (cancelled) return;

      const nextResult = analyzeRecentWeakness({
        questions: ALL_ANALYSIS_QUESTIONS,
        sessions: completedSessions,
        selectedSubjects: activeSubjects
      });
      if (cancelled) return;
      setResult(nextResult);
      setProgress({ stage: "ready", message: "分析完成", progress: 100 });
    };

    void runAnalysis();
    return () => {
      cancelled = true;
    };
  }, [
    activeSubjectKey,
    activeSubjects,
    analysisRevision,
    authLoading,
    cloudHydrating,
    selectionReady,
    syncError,
    syncStatus,
    syncVersion,
    user?.id
  ]);

  const hasPendingScopeChange = useMemo(
    () =>
      [...draftSubjects].sort().join("|") !== [...activeSubjects].sort().join("|"),
    [activeSubjects, draftSubjects]
  );

  function toggleSubject(subject: SubjectName) {
    setDraftSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : ANALYSIS_SUBJECTS.filter((item) => item === subject || current.includes(item))
    );
  }

  function applySubjectScope() {
    if (draftSubjects.length === 0) return;
    const nextSubjects = ANALYSIS_SUBJECTS.filter((subject) => draftSubjects.includes(subject));
    saveStoredSubjects(nextSubjects);
    setActiveSubjects(nextSubjects);
    setAnalysisRevision((value) => value + 1);
  }

  async function retryCloudRead() {
    if (!user?.id) {
      setAnalysisRevision((value) => value + 1);
      return;
    }
    setProgress({ stage: "syncing", message: "正在重新讀取完整雲端作答紀錄", progress: 12 });
    await refreshCloudData({
      hydrateRemoteHistory: true,
      historyHydration: true,
      force: true,
      readRemoteOnly: true
    });
    setAnalysisRevision((value) => value + 1);
  }

  function startConceptPractice(concept: WeaknessConcept) {
    const questionOrder = buildWeaknessQuestionOrder({
      questions: ALL_ANALYSIS_QUESTIONS,
      sessions,
      subject: concept.subject,
      primaryTag: concept.primaryTag
    });
    if (questionOrder.length === 0) return;

    router.push(
      buildNewQuizHref({
        mode: "random",
        questionCount: questionOrder.length,
        sessionName: concept.primaryTag,
        stopAfterReview: true,
        subjectFilter: concept.subject,
        subjectFilters: [concept.subject],
        excludeAiGenerated: true,
        customQuestionIds: questionOrder,
        priorityQuestionIds: questionOrder,
        customPoolLabel: `考前弱點：${concept.primaryTag}`,
        strictCustomQuestionPool: true,
        preserveCustomQuestionOrder: true,
        enableConfidenceCalibration: true
      })
    );
  }

  return (
    <main className="shell pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Exam Focus</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">考前弱點分析</h1>
        </div>
        <Link
          href="/progress"
          className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
        >
          返回進度總覽
        </Link>
      </header>

      <section className="border-b border-slate-200 py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">分析科目</h2>
            {activeSubjects.length > 0 ? (
              <p className="mt-2 text-sm text-slate-500">已選 {activeSubjects.length} 科</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraftSubjects([...ANALYSIS_SUBJECTS])}
              className="min-h-10 px-3 text-sm font-semibold text-brand-700"
            >
              全選
            </button>
            <button
              type="button"
              onClick={() => setDraftSubjects([])}
              className="min-h-10 px-3 text-sm font-semibold text-slate-600"
            >
              清除
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ANALYSIS_SUBJECTS.map((subject) => {
            const selected = draftSubjects.includes(subject);
            return (
              <button
                key={subject}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSubject(subject)}
                className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selected
                    ? "bg-ink text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {subjectRegistry[subject].label.replace("（歸醫學二）", "")}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={draftSubjects.length === 0 || (!hasPendingScopeChange && Boolean(result))}
          onClick={applySubjectScope}
          className="mt-5 min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {activeSubjects.length === 0 ? "開始分析" : "套用分析科目"}
        </button>
      </section>

      {activeSubjects.length > 0 && progress.stage !== "ready" ? (
        <section className="py-10">
          <div className="mx-auto max-w-2xl">
            <p className="text-center text-base font-semibold text-ink">{progress.message}</p>
            <div
              role="progressbar"
              aria-label="弱點分析進度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.progress}
              className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={`h-full rounded-full bg-brand-600 transition-[width] duration-500 ${
                  progress.stage === "syncing" ? "animate-pulse" : ""
                }`}
                style={{ width: `${Math.max(8, progress.progress)}%` }}
              />
            </div>
            {progress.stage === "failed" ? (
              <button
                type="button"
                onClick={() => void retryCloudRead()}
                className="mx-auto mt-6 block min-h-12 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white"
              >
                重新同步
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {result && progress.stage === "ready" ? (
        <>
          <section className="border-b border-slate-200 py-7">
            <p className="text-sm text-slate-500">
              資料截至 {formatDateTime(result.dataThrough)} ・ 完整紀錄 {result.totalHistoryAttempts.toLocaleString("zh-TW")} 筆
              ・ 近 14 天 {result.recentUniqueQuestions.toLocaleString("zh-TW")} 題不同題目
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.subjectSummaries.map((summary) => (
                <article key={summary.subject} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-ink">{subjectRegistry[summary.subject].label}</h2>
                    <span className="text-xs font-semibold text-slate-500">{summary.dataStatus}</span>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-ink">{summary.correctRate}%</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {summary.uniqueQuestions} 題 ・ 答錯 {summary.wrong} 題
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    可分析觀念群 {summary.eligibleConceptCount} 個
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">Priority Concepts</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">優先處理的觀念群</h2>
              </div>
              <span className="text-sm text-slate-500">最多顯示 5 個</span>
            </div>

            {result.concepts.length === 0 ? (
              <p className="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
                目前沒有同時符合近期題數與答錯證據門檻的觀念群。
              </p>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {result.concepts.map((concept) => (
                  <article key={`${concept.subject}-${concept.primaryTag}`} className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-500">{concept.subject}</p>
                        <h3 className="mt-2 break-words text-lg font-semibold text-ink">{concept.primaryTag}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        證據{concept.evidence}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-slate-500">近 14 天</p>
                        <p className="mt-1 font-semibold text-ink">{concept.uniqueQuestions} 題</p>
                      </div>
                      <div>
                        <p className="text-slate-500">答對率</p>
                        <p className="mt-1 font-semibold text-ink">{concept.correctRate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-500">答錯</p>
                        <p className="mt-1 font-semibold text-ink">{concept.wrong} 題</p>
                      </div>
                      <div>
                        <p className="text-slate-500">重複答錯</p>
                        <p className="mt-1 font-semibold text-ink">{concept.repeatedWrong} 題</p>
                      </div>
                    </div>

                    {concept.certainWrong > 0 || concept.uncertainCorrect > 0 ? (
                      <p className="mt-4 text-sm text-slate-500">
                        {concept.certainWrong > 0 ? `很確定但答錯 ${concept.certainWrong} 題` : ""}
                        {concept.certainWrong > 0 && concept.uncertainCorrect > 0 ? " ・ " : ""}
                        {concept.uncertainCorrect > 0 ? `不確定但答對 ${concept.uncertainCorrect} 題` : ""}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">
                        共 {concept.availableQuestionCount} 題，可隨時結束
                      </span>
                      <button
                        type="button"
                        onClick={() => startConceptPractice(concept)}
                        className="min-h-12 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                      >
                        開始複習
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
