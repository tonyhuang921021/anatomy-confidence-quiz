"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { ResultSummary } from "@/components/ResultSummary";
import { WeaknessRanking } from "@/components/WeaknessRanking";
import {
  loadQuestionCommunityStats,
  loadConfirmedQuestionClassificationOverrides,
  loadSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import { applyQuestionClassificationOverride } from "@/data/med1QuestionBank";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { subjectRegistry } from "@/data/subjectRegistry";
import {
  calculateCompletionStats,
  calculateSectionStats,
  calculateSummary,
  DEFAULT_QUIZ_SETTINGS,
  generateAIPrompt,
  getModeLabel,
  getLowCompletionSections,
  getTopWeakSections,
  getUnstableCompletedSections
} from "@/lib/quizAnalysis";
import {
  applyQuestionExplanationOverride,
  loadCurrentSession,
  clearCurrentSession,
  loadCompletedSessions,
  loadQuestionExplanationOverrides,
  saveCompletedSession,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides,
  saveQuizSettings
} from "@/lib/storage";
import {
  Attempt,
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionCommunityStats,
  QuestionExplanationOverride,
  QuizSession,
  SectionCompletionStats,
  SectionStats,
  SummaryStats
} from "@/types/quiz";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";

const allQuestions = Array.from(
  new Map(
    Object.values(subjectRegistry)
      .filter((subject) => subject.subject !== "醫學（一）" && subject.subject !== "醫學（二）")
      .flatMap((subject) => subject.questions.map((question) => [question.id, question] as const))
  ).values()
);

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getQuestionMap(
  session: QuizSession,
  classificationOverrides: Record<string, QuestionClassificationOverride>
) {
  return new Map(
    [...allQuestions, ...(session.generatedQuestions ?? [])]
      .filter((question): question is Question => Boolean(question?.id))
      .map((question) => [
        question.id,
        applyQuestionExplanationOverride(
          applyQuestionClassificationOverride(question, classificationOverrides[question.id])
        )
      ] as const)
  );
}

function getAvailableOptionKeys(question: Question) {
  return optionKeys.filter((key) => typeof question.options[key] === "string");
}

type ResultState = {
  session: QuizSession | null;
  sessions: QuizSession[];
  summary: SummaryStats | null;
  sectionStats: SectionStats[];
  promptText: string;
  lowCompletion: SectionCompletionStats[];
  unstableSections: SectionCompletionStats[];
  completionStats: ReturnType<typeof calculateCompletionStats> | null;
};

function getSessionModeLabel(session: QuizSession) {
  return session.settings?.mode === "simulation"
    ? "模擬考"
    : session.settings?.mode === "custom_paper"
      ? "自訂卷"
    : session.settings?.mode === "peak_challenge"
      ? "巔峰賽"
    : session.settings?.mode === "review"
      ? "錯題複習"
      : session.settings?.mode === "weakness"
        ? "弱點補強"
        : "隨機刷題";
}

function getAccuracyTone(correctRate: number) {
  if (correctRate < 30) return "bg-rose-100 text-rose-800";
  if (correctRate <= 60) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function getSubjectStatOrder(subject: string) {
  const med1Order = ["解剖學", "組織學", "胚胎學", "生理學", "生物化學"];
  const med2Order = ["微生物免疫學", "寄生蟲學", "公共衛生學", "藥理學", "病理學"];
  const med1Index = med1Order.indexOf(subject);
  if (med1Index >= 0) return med1Index;
  const med2Index = med2Order.indexOf(subject);
  if (med2Index >= 0) return med2Index;
  return 999;
}

const RESULTS_HISTORY_PAGE_SIZE = 30;

function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { syncVersion, session } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [requestedSessionId, setRequestedSessionId] = useState<string | null>(null);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [communityStatsMap, setCommunityStatsMap] = useState<Record<string, QuestionCommunityStats>>({});
  const [copyPromptNotice, setCopyPromptNotice] = useState(false);
  const [isFullscreenReview, setIsFullscreenReview] = useState(false);
  const [isFullscreenReviewVisible, setIsFullscreenReviewVisible] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(RESULTS_HISTORY_PAGE_SIZE);
  const [state, setState] = useState<ResultState>({
    session: null,
    sessions: [],
    summary: null,
    sectionStats: [],
    promptText: "",
    lowCompletion: [],
    unstableSections: [],
    completionStats: null
  });

  async function handleCopyAIPrompt() {
    if (!state.promptText) return;

    try {
      await navigator.clipboard.writeText(state.promptText);
      setCopyPromptNotice(true);
      window.setTimeout(() => setCopyPromptNotice(false), 1800);
    } catch {
      setCopyPromptNotice(false);
    }
  }

  async function handleReportClassification(question: Question) {
    if (!session?.access_token) {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能回報此題分類錯誤。"
      }));
      return;
    }
    setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: true }));
    setClassificationReportMessageMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-classification-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session?.access_token ?? null,
          question: {
            id: question.id,
            subject: question.subject,
            chapter: question.chapter,
            section: question.section,
            stem: question.stem,
            options: question.options,
            explanation: question.explanation,
            testedConcept: question.testedConcept
          }
        })
      });

      const rawText = await response.text();
      const payload = (rawText ? JSON.parse(rawText) : null) as {
        ok: boolean;
        suggestedSubject?: string | null;
        suggestedChapter?: string | null;
        suggestedSection?: string | null;
        reason?: string | null;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        if (response.status === 429 && payload?.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setClassificationReportMessageMap((current) => ({
          ...current,
          [question.id]: payload?.message || rawText || "分類回報失敗。"
        }));
        return;
      }

      const suggestedPath = [
        payload.suggestedSubject,
        payload.suggestedChapter,
        payload.suggestedSection
      ].filter(Boolean).join(" / ");

      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: suggestedPath
          ? `已回報，AI 建議改分到 ${suggestedPath}。`
          : "已回報，AI 已收到這題的重新分類請求。"
      }));
    } catch {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "無法連線到分類回報 API。"
      }));
    } finally {
      setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  useEffect(() => {
    try {
      const targetSessionId = searchParams.get("sessionId");
      setRequestedSessionId(targetSessionId);
      const completedSessions = loadCompletedSessions();
      const currentSession = loadCurrentSession();
      const fallbackCurrentSession =
        targetSessionId &&
        currentSession?.id === targetSessionId &&
        currentSession.completedAt
          ? currentSession
          : null;
      const targetSession =
        targetSessionId
          ? completedSessions.find((item) => item.id === targetSessionId) ?? fallbackCurrentSession ?? null
          : null;

      if (
        fallbackCurrentSession &&
        !completedSessions.some((item) => item.id === fallbackCurrentSession.id)
      ) {
        saveCompletedSession(fallbackCurrentSession);
      }

      if (!targetSession?.completedAt) {
        setState((current) => ({
          ...current,
          session: null,
          sessions: completedSessions,
          summary: null,
          sectionStats: [],
          promptText: "",
          lowCompletion: [],
          unstableSections: [],
          completionStats: null
        }));
        setMounted(true);
        return;
      }

      const currentQuestions =
        targetSession.generatedQuestions && targetSession.generatedQuestions.length > 0
          ? targetSession.generatedQuestions
          : anatomyQuestions;
      const completionStats = calculateCompletionStats(anatomyQuestions, completedSessions);
      const sessionSectionStats = calculateSectionStats(targetSession.attempts, currentQuestions);

      setState({
        session: targetSession,
        sessions: completedSessions,
        summary: calculateSummary(targetSession.attempts, currentQuestions),
        sectionStats: sessionSectionStats,
        promptText: generateAIPrompt(targetSession.attempts, currentQuestions, completedSessions),
        lowCompletion: getLowCompletionSections(completionStats.sections, 5),
        unstableSections: getUnstableCompletedSections(completionStats.sections, 5),
        completionStats
      });
      setMounted(true);
    } catch {
      setState({
        session: null,
        sessions: [],
        summary: null,
        sectionStats: [],
        promptText: "",
        lowCompletion: [],
        unstableSections: [],
        completionStats: null
      });
      setMounted(true);
    }
  }, [searchParams, syncVersion]);

  useEffect(() => {
    setVisibleHistoryCount(RESULTS_HISTORY_PAGE_SIZE);
  }, [syncVersion, requestedSessionId]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, [syncVersion]);

  useEffect(() => {
    if (!state.session?.attempts.length) return;

    void loadConfirmedQuestionClassificationOverrides(
      state.session.attempts.map((attempt) => attempt.questionId)
    )
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [state.session]);

  useEffect(() => {
    async function fetchCommunityStats() {
      if (!state.session?.attempts.length) return;

      try {
        const stats = await loadQuestionCommunityStats(
          state.session.attempts.map((attempt) => attempt.questionId)
        );
        setCommunityStatsMap(
          Object.fromEntries(stats.map((item) => [item.questionId, item] as const))
        );
      } catch {
        // keep UI quiet if community stats table is temporarily unavailable
      }
    }

    void fetchCommunityStats();
  }, [state.session]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isFullscreenReview) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isFullscreenReview]);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (!state.session?.attempts.length) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(
          state.session.attempts.map((attempt) => attempt.questionId)
        );
        if (Object.keys(sharedOverrides).length === 0) return;

        saveQuestionExplanationOverrides(sharedOverrides);
        setExplanationOverrides((current) => ({
          ...current,
          ...sharedOverrides
        }));
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [state.session]);

  const recentCompletedSessions = useMemo(
    () =>
      [...state.sessions]
        .filter((sessionItem) => Boolean(sessionItem.completedAt))
        .sort((a, b) =>
          (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt)
        ),
    [state.sessions]
  );
  const visibleCompletedSessions = useMemo(
    () => recentCompletedSessions.slice(0, visibleHistoryCount),
    [recentCompletedSessions, visibleHistoryCount]
  );
  const topWeakSections = useMemo(() => getTopWeakSections(state.sectionStats, 3), [state.sectionStats]);
  const activeSession = state.session;
  const questionMap = useMemo(
    () => (activeSession ? getQuestionMap(activeSession, classificationOverrides) : new Map<string, Question>()),
    [activeSession, classificationOverrides]
  );
  const reviewedAttempts = useMemo(
    () =>
      (activeSession?.attempts ?? [])
        .map((attempt) => ({
          attempt,
          question: questionMap.get(attempt.questionId)
        }))
        .filter((item): item is { attempt: Attempt; question: Question } => Boolean(item.question)),
    [activeSession?.attempts, questionMap]
  );
  const wrongAttempts = useMemo(
    () => reviewedAttempts.filter((item) => !item.attempt.isCorrect),
    [reviewedAttempts]
  );
  const lowConfidenceAttempts = useMemo(() => {
    const wrongAttemptIds = new Set(wrongAttempts.map((item) => item.attempt.questionId));
    return reviewedAttempts
      .filter((item) => item.attempt.confidence <= 3 && !wrongAttemptIds.has(item.attempt.questionId))
      .sort((a, b) => {
        if (a.attempt.confidence !== b.attempt.confidence) {
          return a.attempt.confidence - b.attempt.confidence;
        }
        return a.question.chapter.localeCompare(b.question.chapter) || a.question.section.localeCompare(b.question.section);
      });
  }, [reviewedAttempts, wrongAttempts]);
  const simulationSubjectScores = useMemo(() => {
    if (activeSession?.settings?.mode !== "simulation") return [];

    const bucket = new Map<string, { subject: string; correct: number; total: number }>();
    for (const { attempt, question } of reviewedAttempts) {
      const subject = question.subject;
      const current = bucket.get(subject) ?? { subject, correct: 0, total: 0 };
      current.total += 1;
      if (attempt.isCorrect) current.correct += 1;
      bucket.set(subject, current);
    }

    return Array.from(bucket.values()).sort((left, right) => {
      const orderDiff = getSubjectStatOrder(left.subject) - getSubjectStatOrder(right.subject);
      if (orderDiff !== 0) return orderDiff;
      return left.subject.localeCompare(right.subject);
    });
  }, [activeSession?.settings?.mode, reviewedAttempts]);

  function handleRestart() {
    clearCurrentSession();
    saveQuizSettings(DEFAULT_QUIZ_SETTINGS);
    router.push("/quiz?new=1");
  }

  function handleOpenFullscreenReview() {
    setIsFullscreenReview(true);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => setIsFullscreenReviewVisible(true));
    } else {
      setIsFullscreenReviewVisible(true);
    }
  }

  function handleCloseFullscreenReview() {
    setIsFullscreenReviewVisible(false);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setIsFullscreenReview(false), 260);
    } else {
      setIsFullscreenReview(false);
    }
  }

  async function handleGenerateQuestionExplanation(question: Question, attempt: Attempt) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 GPT-5-mini 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const previousQuestion = findPreviousQuestionForContinuation(
      question,
      Array.from(questionMap.values())
    );

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session?.access_token ?? null,
          question: {
            id: question.id,
            subject: question.subject,
            chapter: question.chapter,
            section: question.section,
            stem: question.stem,
            options: question.options,
            answer: question.answer,
            acceptedAnswers: question.acceptedAnswers,
            answerCreditType: question.answerCreditType,
            explanation: question.explanation,
            testedConcept: question.testedConcept
          },
          previousQuestion: previousQuestion ? buildRelatedQuestionContext(previousQuestion) : undefined,
          attempt: {
            selectedAnswer: attempt.selectedAnswer,
            confidence: attempt.confidence,
            isCorrect: attempt.isCorrect
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "GPT-5-mini 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5-mini",
        updatedAt: new Date().toISOString()
      };

      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) => ({
        ...current,
        [question.id]: override
      }));
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 GPT-5-mini 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  if (!mounted) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">載入中...</div>
      </main>
    );
  }

  if (!requestedSessionId) {
    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">每次作答紀錄</h1>
          <p className="mt-3 text-slate-500">先選一筆紀錄，再進去看那一次的完整結果頁。</p>

          <div className="mt-6 grid gap-3 text-left">
            {recentCompletedSessions.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                目前還沒有已完成的作答紀錄。
              </div>
            ) : (
              visibleCompletedSessions.map((sessionItem, index) => {
                const completedAt = sessionItem.completedAt ?? sessionItem.startedAt;
                const correctCount = sessionItem.attempts.filter((attempt) => attempt.isCorrect).length;
                const totalCount = sessionItem.attempts.length;
                const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

                return (
                  <Link
                    key={sessionItem.id}
                    href={`/results?sessionId=${encodeURIComponent(sessionItem.id)}`}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          第 {recentCompletedSessions.length - index} 筆・{sessionItem.subject}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          {getSessionModeLabel(sessionItem)} ・{" "}
                          {new Date(completedAt).toLocaleString("zh-TW", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{totalCount} 題</span>
                        <span className={`rounded-full px-3 py-1 ${getAccuracyTone(correctRate)}`}>
                          答對率 {correctRate}%
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                          {correctCount} / {totalCount} 答對
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {visibleCompletedSessions.length < recentCompletedSessions.length ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleHistoryCount((current) => current + RESULTS_HISTORY_PAGE_SIZE)}
                className="min-h-12 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                載入更多
              </button>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
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
          </div>
        </section>
      </main>
    );
  }

  if (!state.session || !state.summary || !state.completionStats) {
    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-5 text-center shadow-card ring-1 ring-slate-100 sm:p-8">
          <h1 className="text-2xl font-semibold text-ink">找不到這次作答紀錄</h1>
          <p className="mt-3 text-slate-500">這筆結果可能已被清除，或尚未完成作答。</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/results"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              回到作答紀錄
            </Link>
            <Link
              href="/quiz"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始測驗
            </Link>
          </div>
        </section>
      </main>
    );
  }

  function renderQuestionExplanationControls(question: Question, attempt: Attempt) {
    const generated = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];
    const reportLoading = classificationReportLoadingMap[question.id];
    const reportMessage = classificationReportMessageMap[question.id];

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {!generated ? (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question, attempt)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "GPT-5-mini 生成中..." : "用 GPT-5-mini 補詳解"}
            </button>
          ) : null}
          {generated ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{generated.model ?? "gpt-5-mini"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void handleReportClassification(question)}
            disabled={reportLoading}
            className="min-h-10 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
          >
            {reportLoading ? "回報中..." : "回報此題分類錯誤"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        {reportMessage ? <p className="text-sm font-medium text-slate-600">{reportMessage}</p> : null}
      </div>
    );
  }

  function renderOptionAnalysis(question: Question) {
    if (!question.optionAnalysis || Object.keys(question.optionAnalysis).length === 0) return null;

    return (
      <div className="space-y-2.5">
        {getAvailableOptionKeys(question).map((key) => {
          const text = question.optionAnalysis?.[key];
          if (!text) return null;

          return (
            <div
              key={`${question.id}-option-analysis-${key}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {key}
                </span>
                <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                  {text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderExplanationFooter(question: Question, attempt: Attempt) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {explanationOverrides[question.id] ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{explanationOverrides[question.id]?.model ?? "gpt-5-mini"}
            </span>
          ) : null}
        </div>
        {renderQuestionExplanationControls(question, attempt)}
      </div>
    );
  }

  function renderQuestionCommunityBadge(questionId: string) {
    const communityStats = communityStatsMap[questionId];
    if (!communityStats || communityStats.totalAttempts <= 0) return null;

    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
        全站 {communityStats.correctRate}%・{communityStats.totalAttempts} 人
      </span>
    );
  }

  function renderQuestionSummaryLine(label: string, questionId: string) {
    return (
      <span className="flex max-w-full min-w-0 items-center gap-2 align-top">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0">{renderQuestionCommunityBadge(questionId)}</span>
      </span>
    );
  }

  function renderReviewSection(fullscreenMobile = false) {
    return (
      <section
        className={
          fullscreenMobile
            ? "bg-transparent p-0 shadow-none ring-0"
            : "rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">題目回顧</h2>
            <p className="mt-2 text-sm text-slate-500">先看錯題，再往下展開全部題目做完整複盤。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {!fullscreenMobile ? (
              <button
                type="button"
                onClick={handleOpenFullscreenReview}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 sm:hidden"
                aria-label="開啟滿版題目回顧"
                title="開啟滿版題目回顧"
              >
                ⛶ 滿版模式
              </button>
            ) : null}
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-900">錯題 {wrongAttempts.length}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">全部 {reviewedAttempts.length}</span>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-ink">錯題回顧</h3>
            <div className="mt-3 grid gap-3">
              {wrongAttempts.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  這輪沒有錯題，可以直接展開下方全部題目回顧。
                </div>
              ) : (
                wrongAttempts.map(({ attempt, question }, index) => (
                  <details key={`wrong-${attempt.questionId}`} className="overflow-hidden rounded-2xl bg-rose-50 p-3.5 sm:p-4">
                    <summary className="block cursor-pointer overflow-hidden text-sm font-semibold text-rose-950">
                      {renderQuestionSummaryLine(
                        `錯題 ${index + 1}：${question.chapter} / ${question.section} / ${question.testedConcept}`,
                        question.id
                      )}
                    </summary>
                    <div className="mt-4 min-w-0 space-y-3 overflow-hidden text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
                      <QuestionStemBlock question={question} />
                      <div className="grid gap-3">
                        {getAvailableOptionKeys(question).map((key) => (
                          <QuestionOptionBlock
                            key={`${question.id}-${key}`}
                            question={question}
                            optionKey={key}
                            wrapperClassName="rounded-2xl bg-white p-4"
                          />
                        ))}
                      </div>
                      <p>
                        <span className="font-semibold">我的答案：</span>
                        {attempt.selectedAnswer}
                      </p>
                      <p>
                        <span className="font-semibold">正確答案：</span>
                        {question.acceptedAnswers?.length &&
                        (question.answerCreditType === "multiple_accepted" ||
                          question.answerCreditType === "multiple_answers")
                          ? `${question.acceptedAnswers.join("/")} 皆可`
                          : question.answerCreditType === "all_credit"
                            ? "本題一律給分"
                            : attempt.correctAnswer}
                      </p>
                      <p>
                        <span className="font-semibold">信心：</span>
                        {attempt.confidence}
                      </p>
                      {attempt.errorType ? (
                        <p>
                          <span className="font-semibold">錯因：</span>
                          {attempt.errorType}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-semibold">詳解：</span>
                        {question.explanation}
                      </p>
                      {renderOptionAnalysis(question)}
                      {question.memoryTip ? (
                        <div className="memory-tip-box">
                          <span className="font-semibold">快速記憶法：</span>
                          {question.memoryTip}
                        </div>
                      ) : null}
                      {renderExplanationFooter(question, attempt)}
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-ink">沒信心題目回顧</h3>
            <div className="mt-3 grid gap-3">
              {lowConfidenceAttempts.length === 0 ? (
                <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                  這輪沒有標記為低信心的題目。
                </div>
              ) : (
                lowConfidenceAttempts.map(({ attempt, question }, index) => (
                  <details key={`low-confidence-${attempt.questionId}`} className="overflow-hidden rounded-2xl bg-amber-50 p-3.5 sm:p-4">
                    <summary className="block cursor-pointer overflow-hidden text-sm font-semibold text-amber-950">
                      {renderQuestionSummaryLine(
                        `信心 ${attempt.confidence}｜${index + 1}：${question.chapter} / ${question.section} / ${question.testedConcept}`,
                        question.id
                      )}
                    </summary>
                    <div className="mt-4 min-w-0 space-y-3 overflow-hidden text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
                      <QuestionStemBlock question={question} />
                      <div className="grid gap-3">
                        {getAvailableOptionKeys(question).map((key) => (
                          <QuestionOptionBlock
                            key={`${question.id}-low-${key}`}
                            question={question}
                            optionKey={key}
                            wrapperClassName="rounded-2xl bg-white p-4"
                          />
                        ))}
                      </div>
                      <p>
                        <span className="font-semibold">我的答案：</span>
                        {attempt.selectedAnswer}
                      </p>
                      <p>
                        <span className="font-semibold">正確答案：</span>
                        {question.acceptedAnswers?.length &&
                        (question.answerCreditType === "multiple_accepted" ||
                          question.answerCreditType === "multiple_answers")
                          ? `${question.acceptedAnswers.join("/")} 皆可`
                          : question.answerCreditType === "all_credit"
                            ? "本題一律給分"
                            : attempt.correctAnswer}
                      </p>
                      <p>
                        <span className="font-semibold">是否答對：</span>
                        {attempt.isCorrect ? "答對" : "答錯"}
                      </p>
                      <p>
                        <span className="font-semibold">信心：</span>
                        {attempt.confidence}
                      </p>
                      {attempt.errorType ? (
                        <p>
                          <span className="font-semibold">錯因：</span>
                          {attempt.errorType}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-semibold">詳解：</span>
                        {question.explanation}
                      </p>
                      {renderOptionAnalysis(question)}
                      {question.memoryTip ? (
                        <div className="memory-tip-box">
                          <span className="font-semibold">快速記憶法：</span>
                          {question.memoryTip}
                        </div>
                      ) : null}
                      {renderExplanationFooter(question, attempt)}
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-ink">全部題目回顧</h3>
            <div className="mt-3 grid gap-3">
              {reviewedAttempts.map(({ attempt, question }, index) => (
                <details key={`all-${attempt.questionId}`} className="overflow-hidden rounded-2xl bg-slate-50 p-3.5 sm:p-4">
                  <summary className="block cursor-pointer overflow-hidden text-sm font-semibold text-ink">
                    {renderQuestionSummaryLine(
                      `第 ${index + 1} 題：${attempt.isCorrect ? "答對" : "答錯"} / ${question.chapter} / ${question.section}`,
                      question.id
                    )}
                  </summary>
                  <div className="mt-4 min-w-0 space-y-3 overflow-hidden text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
                    <QuestionStemBlock question={question} />
                    <div className="grid gap-3">
                      {getAvailableOptionKeys(question).map((key) => (
                        <QuestionOptionBlock
                          key={`${question.id}-all-${key}`}
                          question={question}
                          optionKey={key}
                          wrapperClassName="rounded-2xl bg-white p-4"
                        />
                      ))}
                    </div>
                    <p>
                      <span className="font-semibold">我的答案：</span>
                      {attempt.selectedAnswer}
                    </p>
                    <p>
                      <span className="font-semibold">正確答案：</span>
                      {question.acceptedAnswers?.length &&
                      (question.answerCreditType === "multiple_accepted" ||
                        question.answerCreditType === "multiple_answers")
                        ? `${question.acceptedAnswers.join("/")} 皆可`
                        : question.answerCreditType === "all_credit"
                          ? "本題一律給分"
                          : attempt.correctAnswer}
                    </p>
                    <p>
                      <span className="font-semibold">testedConcept：</span>
                      {question.testedConcept}
                    </p>
                    <p>
                      <span className="font-semibold">信心：</span>
                      {attempt.confidence}
                    </p>
                    {attempt.errorType ? (
                      <p>
                        <span className="font-semibold">錯因：</span>
                        {attempt.errorType}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-semibold">詳解：</span>
                      {question.explanation}
                    </p>
                    {renderOptionAnalysis(question)}
                    {question.memoryTip ? (
                      <div className="memory-tip-box">
                        <span className="font-semibold">快速記憶法：</span>
                        {question.memoryTip}
                      </div>
                    ) : null}
                    {renderExplanationFooter(question, attempt)}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Results</p>
          <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
            本輪{state.session.subject}結果分析
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            本輪模式：{getModeLabel(state.session.settings?.mode ?? "weakness")}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            完成時間：
            {new Date(state.session.completedAt ?? state.session.startedAt).toLocaleString("zh-TW", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/results"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            回到作答紀錄
          </Link>
          <Link
            href="/progress"
            className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            進度總覽
          </Link>
          <button
            type="button"
            onClick={handleRestart}
            className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            重新開始
          </button>
        </div>
      </div>

      <div className="mt-6">
        <ResultSummary summary={state.summary} />
        {simulationSubjectScores.length > 0 ? (
          <section className="mt-4 rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">模擬考分科得分</h2>
                <p className="mt-2 text-sm text-slate-500">每科顯示本次作答答對題數 / 該科總題數，五科加總滿分 100。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                總分 {state.summary.correct} / {state.summary.total}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {simulationSubjectScores.map((item) => (
                <article key={item.subject} className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                  <p className="text-sm font-medium text-slate-500">{item.subject}</p>
                  <p className="mt-2 text-2xl font-bold text-ink">
                    {item.correct}
                    <span className="ml-1 text-base font-semibold text-slate-500">/ {item.total}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {renderReviewSection()}
          <WeaknessRanking sections={topWeakSections} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">
            <h2 className="text-xl font-semibold text-ink">補強建議</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900">
                最需要補弱的小節：{topWeakSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                最需要補進度：{state.lowCompletion.map((section) => section.section).join("、") || "目前無資料"}
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                已完成但不穩：{state.unstableSections.map((section) => section.section).join("、") || "目前無資料"}
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                href="/quiz?new=1"
                onClick={() => saveQuizSettings(DEFAULT_QUIZ_SETTINGS)}
                className="min-h-12 rounded-2xl bg-brand-600 px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                再刷本地題庫 10 題
              </Link>
              <Link
                href="/review"
                onClick={() =>
                  saveQuizSettings({ ...DEFAULT_QUIZ_SETTINGS, mode: "review", questionCount: 10 })
                }
                className="min-h-12 rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                先看錯題複習頁
              </Link>
              <button
                type="button"
                onClick={() => void handleCopyAIPrompt()}
                className="min-h-12 rounded-2xl bg-slate-900 px-4 py-4 text-center text-sm font-semibold text-white transition hover:bg-black"
              >
                複製 AI 補弱 Prompt
              </button>
            </div>
          </section>
        </aside>
      </div>
      {copyPromptNotice ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="rounded-2xl bg-slate-950 px-5 py-3 text-base font-semibold text-white shadow-2xl ring-1 ring-white/10">
            已經複製，可以貼進自己的 AI
          </div>
        </div>
      ) : null}
      {isFullscreenReview ? (
        <div
          className={`fixed inset-0 z-50 bg-[color:var(--bg-base)] transition-opacity duration-300 ease-out overscroll-none sm:hidden ${
            isFullscreenReviewVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`flex h-full flex-col transition-transform duration-300 ease-out ${
              isFullscreenReviewVisible ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 shadow-sm border-[color:var(--line-soft)] bg-[color:var(--surface)] backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Fullscreen Review</p>
                <h2 className="text-lg font-bold text-ink">題目回顧</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseFullscreenReview}
                className="min-h-11 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                返回頁面
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
              {renderReviewSection(true)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">
            載入中...
          </div>
        </main>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}
