"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfidenceSelector } from "@/components/ConfidenceSelector";
import { ErrorTypeSelector } from "@/components/ErrorTypeSelector";
import { QuestionCard } from "@/components/QuestionCard";
import {
  buildExamLikeRandomSet,
  getPastPaperOptions,
  getQuestionBankBySubjects,
  getQuestionBankBySubjectFilter,
  getQuestionsForPastPaper
} from "@/data/med1QuestionBank";
import { pushCompletedSessionToSupabase } from "@/lib/cloudSync";
import {
  createQuestionOrder,
  DEFAULT_QUIZ_SETTINGS,
  getConfidenceLabel,
  getModeLabel
} from "@/lib/quizAnalysis";
import {
  clearCurrentSession,
  loadCompletedSessions,
  loadCurrentSession,
  loadQuizSettings,
  saveCompletedSession,
  saveCurrentSession
} from "@/lib/storage";
import {
  Attempt,
  ConfidenceLevel,
  ErrorType,
  OptionKey,
  Question,
  QuizSession,
  QuizSettings
} from "@/types/quiz";

type HealthState = {
  openaiConfigured: boolean;
  service?: string;
};

const allQuestionFallbackMap = new Map(
  getQuestionBankBySubjects(["醫學（一）", "醫學（二）"]).map(
    (question) => [question.id, question] as const
  )
);

function getQuestionSourceBadge(question: Question) {
  if (question.sourceType === "MOEX_PAST_EXAM") return "正式考古題";
  if (question.sourceType === "AI_GENERATED") return "AI 題庫";
  if (question.source === "ai-generated") return "GPT 新題";
  if (question.source === "past-exam-inspired") return "考古題風格";
  return "本地題庫";
}

function getDifficultyBadge(question: Question) {
  if (question.difficulty === "basic" || question.difficulty === "easy") {
    return { text: "易", className: "bg-emerald-100 text-emerald-900" };
  }

  if (question.difficulty === "medium") {
    return { text: "普", className: "bg-amber-100 text-amber-900" };
  }

  if (question.difficulty === "hard") {
    return { text: "難", className: "bg-rose-100 text-rose-900" };
  }

  return null;
}

function evaluateAttempt(question: Question, selectedAnswer: OptionKey) {
  if (question.answerCreditType === "all_credit") {
    return true;
  }

  if (question.answerCreditType === "multiple_accepted") {
    const acceptedAnswers =
      question.acceptedAnswers && question.acceptedAnswers.length > 0
        ? question.acceptedAnswers
        : [question.answer];
    return acceptedAnswers.includes(selectedAnswer);
  }

  return selectedAnswer === question.answer;
}

function createSession(
  questions: Question[],
  completedSessions: QuizSession[],
  settings: QuizSettings
): QuizSession {
  const normalizedSettings = { ...DEFAULT_QUIZ_SETTINGS, ...settings };
  const localQuestionSet = selectLocalQuestionSet(normalizedSettings, questions);
  const effectiveQuestions = localQuestionSet.length > 0 ? localQuestionSet : questions;
  const selectedSubjects = normalizedSettings.subjectFilters?.filter(Boolean) ?? [];
  const effectiveSettings =
    normalizedSettings.mode === "simulation" &&
    (normalizedSettings.paperMode === "past_paper" ||
      normalizedSettings.paperMode === "random_past_paper")
      ? { ...normalizedSettings, questionCount: effectiveQuestions.length }
      : normalizedSettings;
  const questionOrder =
    normalizedSettings.mode === "ai_fresh"
      ? []
      : createQuestionOrder(effectiveQuestions, completedSessions, effectiveSettings);
  const selectedQuestionMap = new Map(
    effectiveQuestions.map((question) => [question.id, question] as const)
  );
  const persistedQuestions =
    normalizedSettings.mode === "ai_fresh"
      ? []
      : questionOrder
          .map((id) => selectedQuestionMap.get(id))
          .filter((question): question is Question => Boolean(question));

  return {
    id: `session-${Date.now()}`,
    subject:
      selectedSubjects.length === 1
        ? selectedSubjects[0]
        : (effectiveSettings.subjectFilter && effectiveSettings.subjectFilter !== "全部"
            ? effectiveSettings.subjectFilter
            : "醫學（一）") || "解剖學",
    startedAt: new Date().toISOString(),
    settings: effectiveSettings,
    questionOrder,
    generatedQuestions: persistedQuestions,
    currentQuestionIndex: 0,
    isReviewingAnswer: false,
    attempts: []
  };
}

function selectLocalQuestionSet(settings: QuizSettings, fallbackQuestions: Question[]) {
  const selectedSubjects = settings.subjectFilters?.filter(Boolean) ?? [];
  const subjectFilter = settings.subjectFilter ?? "解剖學";
  const bank =
    selectedSubjects.length > 0
      ? getQuestionBankBySubjects(selectedSubjects)
      : getQuestionBankBySubjectFilter(subjectFilter);
  const sourceBank = bank.length > 0 ? bank : fallbackQuestions;

  if (settings.mode !== "simulation") {
    return sourceBank;
  }

  const paperMode = settings.paperMode ?? "random_set";
  if (paperMode === "past_paper" && settings.selectedPaperKey) {
    const paperQuestions = getQuestionsForPastPaper(settings.selectedPaperKey);
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  if (paperMode === "random_past_paper") {
    const papers = getPastPaperOptions();
    if (papers.length === 0) return sourceBank;
    const selected = papers[Math.floor(Math.random() * papers.length)];
    const paperQuestions = getQuestionsForPastPaper(selected.key);
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  return buildExamLikeRandomSet(subjectFilter, settings.questionCount);
}

function getQuestionByOrder(session: QuizSession) {
  const ids = session.questionOrder ?? [];
  const generatedMap = new Map(
    (session.generatedQuestions ?? []).map((question) => [question.id, question] as const)
  );

  return ids
    .map((id) => generatedMap.get(id) ?? allQuestionFallbackMap.get(id))
    .filter((question): question is Question => Boolean(question));
}

export default function QuizPage() {
  const router = useRouter();
  const questionTopRef = useRef<HTMLDivElement | null>(null);
  const contentTopRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | undefined>();
  const [confidence, setConfidence] = useState<ConfidenceLevel>(4);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<Attempt | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | undefined>();
  const [loadingAIQuestions, setLoadingAIQuestions] = useState(false);
  const [aiQuestionError, setAiQuestionError] = useState("");
  const [health, setHealth] = useState<HealthState>({ openaiConfigured: false });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    const existing = loadCurrentSession();
    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const preset = params?.get("preset");
    const startPresetSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "weakness",
      questionCount: 10,
      chapter: undefined,
      section: undefined
    };
    const med1PresetSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      subjectFilter: "醫學（一）",
      questionCount: 10,
      chapter: undefined,
      section: undefined
    };
    const med2PresetSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      subjectFilter: "醫學（二）",
      questionCount: 10,
      chapter: undefined,
      section: undefined
    };
    const savedSettings: QuizSettings =
      preset === "start"
        ? startPresetSettings
        : preset === "med1"
          ? med1PresetSettings
          : preset === "med2"
            ? med2PresetSettings
          : loadQuizSettings() ?? DEFAULT_QUIZ_SETTINGS;
    const completedSessions = loadCompletedSessions();
    const shouldForceNewSession =
      params?.get("new") === "1";
    const shouldReuseExisting =
      !shouldForceNewSession &&
      existing &&
      !existing.completedAt &&
      (existing.questionOrder?.length ?? 0) > 0;
    const nextSession = shouldReuseExisting
      ? existing
      : createSession(
          (savedSettings.subjectFilters?.length ?? 0) > 0
            ? getQuestionBankBySubjects(savedSettings.subjectFilters ?? [])
            : getQuestionBankBySubjectFilter(savedSettings.subjectFilter ?? "解剖學"),
          completedSessions,
          savedSettings
        );

    if (!shouldReuseExisting) {
      clearCurrentSession();
    }

    setSession(nextSession);
    saveCurrentSession(nextSession);

    if (existing?.isReviewingAnswer) {
      const currentQuestionId = existing.questionOrder?.[existing.currentQuestionIndex ?? 0];
      const currentAttempt =
        existing.attempts.find((attempt) => attempt.questionId === currentQuestionId) ?? null;
      setSubmittedAttempt(currentAttempt);
      setSelectedAnswer(currentAttempt?.selectedAnswer);
      setConfidence(currentAttempt?.confidence ?? 4);
      setConfidenceExpanded((currentAttempt?.confidence ?? 4) <= 3);
      setErrorType(currentAttempt?.errorType);
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const payload = (await response.json()) as HealthState;
        setHealth(payload);
      } catch {
        setHealth({ openaiConfigured: false });
      }
    }

    void loadHealth();
  }, []);

  const questionSet = useMemo(() => (session ? getQuestionByOrder(session) : []), [session]);
  const currentIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questionSet[currentIndex];
  const targetCount = session?.settings?.questionCount ?? questionSet.length;
  const progress =
    targetCount === 0 ? 0 : ((currentIndex + (submittedAttempt ? 1 : 0)) / targetCount) * 100;
  const answeredCount = session?.attempts.length ?? 0;
  const correctCount = session?.attempts.filter((attempt) => attempt.isCorrect).length ?? 0;
  const averageConfidence =
    answeredCount === 0
      ? 0
      : Number(
          (
            (session?.attempts.reduce((sum, attempt) => sum + attempt.confidence, 0) ?? 0) /
            answeredCount
          ).toFixed(1)
        );

  function persistSession(nextSession: QuizSession) {
    setSession(nextSession);
    saveCurrentSession(nextSession);
  }

  async function preloadAIQuestions(targetSession: QuizSession) {
    if (targetSession.settings?.mode !== "ai_fresh") return;
    if ((targetSession.generatedQuestions?.length ?? 0) >= (targetSession.settings?.questionCount ?? 10)) {
      return;
    }

    setLoadingAIQuestions(true);
    setAiQuestionError("");

    try {
      const completedSessions = loadCompletedSessions();
      const allKnownQuestions = [
        ...getQuestionBankBySubjectFilter("全部"),
        ...(targetSession.generatedQuestions ?? []),
        ...completedSessions.flatMap((sessionItem) => sessionItem.generatedQuestions ?? [])
      ];
      const questionMap = new Map(
        allKnownQuestions.map((question) => [question.id, question] as const)
      );
      const usedConcepts = [
        ...new Set([
          ...(targetSession.generatedQuestions ?? []).map((question) => question.testedConcept),
          ...completedSessions.flatMap((sessionItem) =>
            sessionItem.generatedQuestions?.map((question) => question.testedConcept) ?? []
          ),
          ...completedSessions.flatMap((sessionItem) =>
            sessionItem.attempts
              .map((attempt) => questionMap.get(attempt.questionId)?.testedConcept)
              .filter((value): value is string => Boolean(value))
          )
        ])
      ];

      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          settings: targetSession.settings,
          count: targetSession.settings?.questionCount ?? 10,
          usedQuestionIds: targetSession.questionOrder ?? [],
          usedConcepts
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        questions?: Question[];
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.questions?.length) {
        setAiQuestionError(payload.message || "AI 新題預生成失敗。");
        return;
      }

      const nextSession: QuizSession = {
        ...targetSession,
        questionOrder: payload.questions.map((question) => question.id),
        generatedQuestions: payload.questions
      };
      persistSession(nextSession);
    } catch {
      setAiQuestionError("無法連線到 AI 新題 API。");
    } finally {
      setLoadingAIQuestions(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    if (session.settings?.mode !== "ai_fresh") return;
    if ((session.generatedQuestions?.length ?? 0) > 0) return;
    void preloadAIQuestions(session);
  }, [session]);

  function handleSelectConfidence(value: ConfidenceLevel) {
    setConfidence(value);
    setConfidenceExpanded(value <= 3);
  }

  function handleSubmit() {
    if (!session || !currentQuestion || !selectedAnswer) return;

    const attempt: Attempt = {
      questionId: currentQuestion.id,
      selectedAnswer,
      correctAnswer: currentQuestion.answer,
      isCorrect: evaluateAttempt(currentQuestion, selectedAnswer),
      confidence,
      answeredAt: new Date().toISOString()
    };

    const nextSessionBase: QuizSession = {
      ...session,
      attempts: [...session.attempts.filter((item) => item.questionId !== currentQuestion.id), attempt],
      isReviewingAnswer: session.settings?.feedbackMode === "none" ? false : true
    };

    if (session.settings?.mode === "simulation" && session.settings?.feedbackMode === "none") {
      const isLast = currentIndex >= targetCount - 1;

      if (isLast) {
        const completedSession: QuizSession = {
          ...nextSessionBase,
          completedAt: new Date().toISOString(),
          isReviewingAnswer: false
        };
        persistSession(completedSession);
        saveCompletedSession(completedSession);
        void pushCompletedSessionToSupabase(completedSession);
        router.push("/results");
        return;
      }

      const advancedSession: QuizSession = {
        ...nextSessionBase,
        currentQuestionIndex: currentIndex + 1,
        isReviewingAnswer: false
      };
      persistSession(advancedSession);
      resetQuestionUI();
      window.requestAnimationFrame(() => {
        const target =
          typeof window !== "undefined" && window.innerWidth >= 1280
            ? contentTopRef.current
            : questionTopRef.current;

        target?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
      return;
    }

    persistSession(nextSessionBase);
    setSubmittedAttempt(attempt);
    setErrorType(undefined);
  }

  function handleErrorTypeSelect(value: ErrorType) {
    if (!session || !submittedAttempt) return;
    setErrorType(value);
    const nextAttempts = session.attempts.map((attempt) =>
      attempt.questionId === submittedAttempt.questionId ? { ...attempt, errorType: value } : attempt
    );
    const nextSession = { ...session, attempts: nextAttempts };
    const updatedAttempt =
      nextAttempts.find((attempt) => attempt.questionId === submittedAttempt.questionId) ?? null;
    persistSession(nextSession);
    setSubmittedAttempt(updatedAttempt);
  }

  function resetQuestionUI() {
    setSubmittedAttempt(null);
    setSelectedAnswer(undefined);
    setConfidence(4);
    setConfidenceExpanded(false);
    setErrorType(undefined);
    setReviewText("");
    setReviewError("");
  }

  function handleNext() {
    if (!session) return;
    const isLast = currentIndex >= targetCount - 1;

    if (isLast) {
      const completedSession: QuizSession = {
        ...session,
        completedAt: new Date().toISOString(),
        isReviewingAnswer: false
      };
      persistSession(completedSession);
      saveCompletedSession(completedSession);
      void pushCompletedSessionToSupabase(completedSession);
      router.push("/results");
      return;
    }

    const nextSession: QuizSession = {
      ...session,
      currentQuestionIndex: currentIndex + 1,
      isReviewingAnswer: false
    };
    persistSession(nextSession);
    resetQuestionUI();

    window.requestAnimationFrame(() => {
      const target =
        typeof window !== "undefined" && window.innerWidth >= 1280
          ? contentTopRef.current
          : questionTopRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  async function handleReviewQuestion() {
    if (!currentQuestion) return;
    setReviewLoading(true);
    setReviewError("");

    try {
      const response = await fetch("/api/review-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: currentQuestion
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        review?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        setReviewError(payload.message || "題目複查失敗。");
        setReviewText("");
        return;
      }

      setReviewText(payload.review || "");
    } catch {
      setReviewError("無法連線到題目複查 API。");
      setReviewText("");
    } finally {
      setReviewLoading(false);
    }
  }

  if (!mounted || !session || !currentQuestion) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          {loadingAIQuestions ? "GPT 正在預生成整組新題..." : "載入中..."}
          {aiQuestionError ? <p className="mt-3 text-sm text-rose-600">{aiQuestionError}</p> : null}
        </div>
      </main>
    );
  }

  const flag =
    submittedAttempt && submittedAttempt.isCorrect && submittedAttempt.confidence <= 2
      ? { text: "猜對風險", style: "bg-amber-100 text-amber-900" }
      : submittedAttempt && !submittedAttempt.isCorrect && submittedAttempt.confidence >= 4
        ? { text: "錯誤自信", style: "bg-rose-100 text-rose-900" }
        : submittedAttempt && !submittedAttempt.isCorrect && submittedAttempt.confidence <= 2
          ? { text: "優先補弱", style: "bg-orange-100 text-orange-900" }
          : null;
  const difficultyBadge = submittedAttempt ? getDifficultyBadge(currentQuestion) : null;
  const feedbackMode = session.settings?.feedbackMode ?? "full";
  const shouldShowExplanation = feedbackMode === "full";
  const shouldShowCorrectAnswer = feedbackMode === "full" || feedbackMode === "answer_only";
  const specialScoringNote =
    submittedAttempt && currentQuestion.answerCreditType === "multiple_accepted"
      ? "本題多重給分：若你的答案在官方接受答案中，即算答對。"
      : submittedAttempt && currentQuestion.answerCreditType === "all_credit"
        ? "本題為官方送分題：本輪直接視為答對。"
        : submittedAttempt && currentQuestion.needsHumanReview
          ? "本題為人工複核題：目前依官方答案判定，請以官方最終公告為準。"
          : null;

  return (
    <main className="shell">
      <div ref={questionTopRef} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-slate-600 transition hover:text-brand-700">
          ← 返回首頁
        </Link>
        <p className="text-sm font-medium text-slate-500">
          第 {currentIndex + 1} / {targetCount} 題
        </p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-emerald-500 to-sky-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div ref={contentTopRef} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
              {getModeLabel(session.settings?.mode ?? "weakness")}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {targetCount} 題
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {session.subject}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {getQuestionSourceBadge(currentQuestion)}
            </span>
            <span
              className={`rounded-full px-3 py-1 ${
                health.openaiConfigured
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {health.openaiConfigured ? "OpenAI API 已連線" : "OpenAI API 未連線"}
            </span>
          </div>

          <QuestionCard
            question={currentQuestion}
            selectedAnswer={selectedAnswer}
            onSelect={setSelectedAnswer}
          />

          {!submittedAttempt ? (
            <>
              <ConfidenceSelector
                value={confidence}
                expanded={confidenceExpanded}
                onExpand={() => setConfidenceExpanded((current) => !current)}
                onSelect={handleSelectConfidence}
              />

              <div className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100">
                <div className="grid gap-3 sm:grid-cols-3">
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    已答題數 <span className="font-semibold">{answeredCount}</span>
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    目前答對數 <span className="font-semibold">{correctCount}</span>
                  </p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    本輪平均信心 <span className="font-semibold">{averageConfidence}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedAnswer || loadingAIQuestions}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-brand-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loadingAIQuestions ? "GPT 題目生成中..." : "送出答案"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div
                className={`rounded-[2rem] p-6 shadow-card ring-1 ${
                  submittedAttempt.isCorrect
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : "bg-rose-50 text-rose-900 ring-rose-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold">
                    {submittedAttempt.isCorrect ? "答對了" : "這題答錯了"}
                  </h2>
                  {flag ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${flag.style}`}>
                      {flag.text}
                    </span>
                  ) : null}
                  {difficultyBadge ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${difficultyBadge.className}`}
                    >
                      難度 {difficultyBadge.text}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3 text-sm leading-7">
                  {shouldShowCorrectAnswer ? (
                    <p>
                      正確答案：
                      <span className="font-semibold">
                        {currentQuestion.answerCreditType === "multiple_accepted" &&
                        currentQuestion.acceptedAnswers?.length
                          ? currentQuestion.acceptedAnswers.join(" / ")
                          : submittedAttempt.correctAnswer}
                      </span>
                    </p>
                  ) : null}
                  {shouldShowExplanation ? (
                    <>
                      <p>
                        testedConcept：<span className="font-semibold">{currentQuestion.testedConcept}</span>
                      </p>
                      <p>explanation：{currentQuestion.explanation}</p>
                    </>
                  ) : null}
                  <p>
                    本題信心：<span className="font-semibold">{getConfidenceLabel(submittedAttempt.confidence)}</span>
                  </p>
                  {specialScoringNote ? (
                    <p className="rounded-2xl bg-amber-100/70 px-4 py-3 text-amber-950">
                      {specialScoringNote}
                    </p>
                  ) : null}
                </div>

                {shouldShowExplanation && currentQuestion.optionAnalysis ? (
                  <div className="mt-5 rounded-3xl bg-white/70 p-4 text-sm text-slate-800 ring-1 ring-white/70">
                    <h3 className="text-sm font-semibold text-ink">各選項解析</h3>
                    <div className="mt-3 grid gap-3">
                      {Object.entries(currentQuestion.optionAnalysis).map(([key, value]) => (
                        <div key={key} className="rounded-2xl bg-white px-4 py-3">
                          <p className="font-semibold text-slate-900">{key} 選項</p>
                          <p className="mt-1 leading-7 text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {shouldShowExplanation && currentQuestion.memoryTip ? (
                  <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
                    <h3 className="text-sm font-semibold">快速記憶法</h3>
                    <p className="mt-2 leading-7">{currentQuestion.memoryTip}</p>
                  </div>
                ) : null}
              </div>

              {!submittedAttempt.isCorrect && shouldShowExplanation ? (
                <ErrorTypeSelector value={errorType} onSelect={handleErrorTypeSelect} />
              ) : null}

              <button
                type="button"
                onClick={handleNext}
                className="min-h-12 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {currentIndex === targetCount - 1 ? "查看結果" : "下一題"}
              </button>
            </div>
          )}

          <div className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleReviewQuestion}
                disabled={reviewLoading}
                className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {reviewLoading ? "AI 複查中..." : "題目怪怪的請 AI 複查"}
              </button>
              {session.settings?.mode === "ai_fresh" ? (
                <div className="flex min-h-12 items-center rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  GPT 會在開始前一次先生成 {targetCount} 題
                </div>
              ) : session.settings?.mode === "simulation" ? (
                <div className="flex min-h-12 items-center rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  模擬考目前設定：{
                    feedbackMode === "none"
                      ? "全程只做題"
                      : feedbackMode === "answer_only"
                        ? "每題只看正確答案"
                        : "每題看正確與詳解"
                  }
                </div>
              ) : null}
            </div>

            {reviewError ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{reviewError}</div>
            ) : null}
            {reviewText ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                {reviewText}
              </div>
            ) : null}
            {aiQuestionError ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{aiQuestionError}</div>
            ) : null}
          </div>
        </div>

        <aside className="h-fit rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 xl:sticky xl:top-6">
          <h2 className="text-lg font-semibold text-ink">本輪狀態</h2>
          <div className="mt-4 grid gap-3">
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              本輪進度 <span className="font-semibold">{currentIndex + 1} / {targetCount}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              目前章節 <span className="font-semibold">{currentQuestion.chapter}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              目前小節 <span className="font-semibold">{currentQuestion.section}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              目前信心 <span className="font-semibold">{getConfidenceLabel(confidence)}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              已答題數 <span className="font-semibold">{answeredCount}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              本輪模式 <span className="font-semibold">{getModeLabel(session.settings?.mode ?? "weakness")}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              API 狀態 <span className="font-semibold">{health.openaiConfigured ? "已連線" : "未連線"}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              暫時答對率{" "}
              <span className="font-semibold">
                {answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)}%
              </span>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
