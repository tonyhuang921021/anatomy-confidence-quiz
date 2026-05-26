"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfidenceSelector } from "@/components/ConfidenceSelector";
import { ErrorTypeSelector } from "@/components/ErrorTypeSelector";
import { QuestionCard } from "@/components/QuestionCard";
import {
  applyQuestionClassificationOverride,
  buildExamLikeRandomSet,
  getPastPaperOptions,
  getImportedCustomPaperQuestionsByIds,
  getQuestionBankBySubjects,
  getQuestionBankBySubjectFilter,
  getQuestionsForPastPaper,
  getSeasonalLimitedQuestions
} from "@/data/med1QuestionBank";
import {
  generatePeakChallengeSession,
  loadConfirmedQuestionClassificationOverrides,
  recordCustomPaperAttempt,
  recordPeakChallengeRun,
  loadSharedQuestionExplanationOverrides,
  pushCompletedSessionToSupabase,
  pushQuestionStatsSnapshotToSupabase
} from "@/lib/cloudSync";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  createQuestionOrder,
  DEFAULT_QUIZ_SETTINGS,
  getConfidenceLabel,
  getModeLabel
} from "@/lib/quizAnalysis";
import {
  applyQuestionExplanationOverride,
  clearCurrentSession,
  loadCompletedSessions,
  loadCurrentSession,
  loadQuestionExplanationOverrides,
  loadQuizSettings,
  saveCompletedSession,
  saveCurrentSession,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides
} from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  Attempt,
  ConfidenceLevel,
  ErrorType,
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionExplanationOverride,
  QuizSession,
  QuizSettings,
  SubjectName
} from "@/types/quiz";

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

  if (
    question.answerCreditType === "multiple_accepted" ||
    question.answerCreditType === "multiple_answers"
  ) {
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
  settings: QuizSettings,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
): QuizSession {
  const normalizedSettings = { ...DEFAULT_QUIZ_SETTINGS, ...settings };
  const localQuestionSet = selectLocalQuestionSet(
    normalizedSettings,
    questions,
    classificationOverrides
  );
  const effectiveQuestions = localQuestionSet.length > 0 ? localQuestionSet : questions;
  const selectedSubjects = normalizedSettings.subjectFilters?.filter(Boolean) ?? [];
  const effectiveSettings =
    normalizedSettings.mode === "simulation" &&
    (normalizedSettings.paperMode === "past_paper" ||
      normalizedSettings.paperMode === "random_past_paper")
      ? { ...normalizedSettings, questionCount: effectiveQuestions.length }
      : normalizedSettings;
  const questionOrder = createQuestionOrder(effectiveQuestions, completedSessions, effectiveSettings);
  const selectedQuestionMap = new Map(
    effectiveQuestions.map((question) => [question.id, question] as const)
  );
  const persistedQuestions = questionOrder
    .map((id) => selectedQuestionMap.get(id))
    .filter((question): question is Question => Boolean(question));

  return {
    id: `session-${crypto.randomUUID()}`,
    subject:
      selectedSubjects.length === 1
        ? selectedSubjects[0]
        : normalizedSettings.mode === "custom_paper" && selectedSubjects.length > 0
          ? selectedSubjects[0]
        : normalizedSettings.mode === "peak_challenge" && selectedSubjects.length > 0
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

function selectLocalQuestionSet(
  settings: QuizSettings,
  fallbackQuestions: Question[],
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  const selectedSubjects = settings.subjectFilters?.filter(Boolean) ?? [];
  const subjectFilter = settings.subjectFilter ?? "解剖學";
  const bank =
    selectedSubjects.length > 0
      ? getQuestionBankBySubjects(selectedSubjects, classificationOverrides)
      : getQuestionBankBySubjectFilter(subjectFilter, classificationOverrides);
  const sourceBank = bank.length > 0 ? bank : fallbackQuestions;
  const runtimeQuestionMap = new Map(
    getQuestionBankBySubjects(["醫學（一）", "醫學（二）"], classificationOverrides).map(
      (question) => [question.id, question] as const
    )
  );

  if ((settings.customQuestionIds?.length ?? 0) > 0) {
    const inlineCustomQuestions = (settings.customQuestionPayload ?? []).filter(Boolean);
    const importedCustomQuestions = getImportedCustomPaperQuestionsByIds(
      settings.customQuestionIds ?? []
    );
    const customQuestions = settings.customQuestionIds
      ?.map((id) => runtimeQuestionMap.get(id))
      .filter((question): question is Question => Boolean(question));
    const mergedCustomQuestions = Array.from(
      new Map(
        [...(customQuestions ?? []), ...importedCustomQuestions, ...inlineCustomQuestions].map((question) => [
          question.id,
          question
        ])
      ).values()
    );

    if (mergedCustomQuestions.length > 0) {
      if (
        settings.mode === "custom_paper" ||
        settings.mode === "peak_challenge" ||
        selectedSubjects.length === 0
      ) {
        return mergedCustomQuestions;
      }

      const merged = new Map<string, Question>();
      [...sourceBank, ...mergedCustomQuestions].forEach((question) => {
        merged.set(question.id, question);
      });
      return Array.from(merged.values());
    }
  }

  if (settings.mode !== "simulation") {
    return sourceBank;
  }

  const paperMode = settings.paperMode ?? "random_set";
  if (paperMode === "past_paper" && settings.selectedPaperKey) {
    const paperQuestions = getQuestionsForPastPaper(
      settings.selectedPaperKey,
      "全部",
      classificationOverrides
    );
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  if (paperMode === "random_past_paper") {
    const papers = getPastPaperOptions("全部", classificationOverrides);
    if (papers.length === 0) return sourceBank;
    const selected = papers[Math.floor(Math.random() * papers.length)];
    const paperQuestions = getQuestionsForPastPaper(selected.key, "全部", classificationOverrides);
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  return buildExamLikeRandomSet(subjectFilter, settings.questionCount, classificationOverrides);
}

function getQuestionByOrder(
  session: QuizSession,
  fallbackMap: Map<string, Question>,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  const ids = session.questionOrder ?? [];
  const generatedMap = new Map(
    (session.generatedQuestions ?? []).map((question) => [question.id, question] as const)
  );

  return ids
    .map((id) => generatedMap.get(id) ?? fallbackMap.get(id))
    .map((question) =>
      question
        ? applyQuestionExplanationOverride(
            applyQuestionClassificationOverride(question, classificationOverrides[question.id])
          )
        : question
    )
    .filter((question): question is Question => Boolean(question));
}

function normalizeLegacySettings(settings: QuizSettings): QuizSettings {
  if ((settings as { mode?: string }).mode !== "ai_fresh") return settings;

  return {
    ...settings,
    mode: "random",
    chapter: undefined,
    section: undefined
  };
}

function isCustomPaperSession(session: QuizSession) {
  return session.settings?.mode === "custom_paper" && Boolean(session.settings?.customPaperCode);
}

function isPeakChallengeSession(session: QuizSession) {
  return session.settings?.mode === "peak_challenge";
}

export default function QuizPage() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const questionTopRef = useRef<HTMLDivElement | null>(null);
  const contentTopRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isPeakPrefetching, setIsPeakPrefetching] = useState(false);
  const [peakNextQuestionError, setPeakNextQuestionError] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | undefined>();
  const [confidence, setConfidence] = useState<ConfidenceLevel>(4);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState<Attempt | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | undefined>();

  function syncCompletedCustomPaper(completedSession: QuizSession) {
    if (!isCustomPaperSession(completedSession)) return;

    void recordCustomPaperAttempt({
      accessToken: authSession?.access_token ?? null,
      visitorId: getOrCreateVisitorId() ?? "",
      paperCode: completedSession.settings?.customPaperCode ?? "",
      session: completedSession
    });
  }

  function syncCompletedPeakChallenge(completedSession: QuizSession) {
    if (!isPeakChallengeSession(completedSession)) return;

    void recordPeakChallengeRun({
      accessToken: authSession?.access_token ?? null,
      visitorId: getOrCreateVisitorId() ?? "",
      session: completedSession
    });
  }

  async function requestNextPeakChallengeBatch(baseSession: QuizSession) {
    const peakCandidates = baseSession.settings?.peakWrongPoolCandidates ?? [];
    const doneQuestionIds = Array.from(
      new Set([
        ...(baseSession.questionOrder ?? []),
        ...loadCompletedSessions()
          .filter((item) => item.settings?.mode === "peak_challenge")
          .flatMap((item) => item.attempts.map((entry) => entry.questionId))
      ])
    );

    return generatePeakChallengeSession({
      accessToken: authSession?.access_token ?? null,
      visitorId: getOrCreateVisitorId() ?? "",
      wrongPoolCandidates: peakCandidates,
      doneQuestionIds,
      desiredCount: 1,
      existingSourceBreakdown: baseSession.settings?.peakSourceBreakdown ?? { pastExam: 0, aiGenerated: 0 },
      practicedSubjects: baseSession.settings?.subjectFilters ?? [],
      nextQuestionIndex: baseSession.questionOrder?.length ?? 0
    });
  }

  useEffect(() => {
    async function initializeSession() {
      const loadedOverrides = await loadConfirmedQuestionClassificationOverrides().catch(
        () => ({} as Record<string, QuestionClassificationOverride>)
      );
      setClassificationOverrides(loadedOverrides);

      const existing = loadCurrentSession();
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const preset = params?.get("preset");
      const directSubject = params?.get("subject");
      const startPresetSettings: QuizSettings = {
        ...DEFAULT_QUIZ_SETTINGS,
        mode: "weakness",
        questionCount: 10,
        chapter: undefined,
        section: undefined
      };
      const directSubjectSettings: QuizSettings | null = directSubject
        ? {
            ...DEFAULT_QUIZ_SETTINGS,
            mode: "random",
            subjectFilter: directSubject as SubjectName,
            subjectFilters: [directSubject as SubjectName],
            questionCount: 10,
            chapter: undefined,
            section: undefined
          }
        : null;
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
      const rawSettings: QuizSettings =
        directSubjectSettings ??
        (preset === "start"
          ? startPresetSettings
          : preset === "med1"
            ? med1PresetSettings
            : preset === "med2"
              ? med2PresetSettings
              : loadQuizSettings() ?? DEFAULT_QUIZ_SETTINGS);
      const savedSettings = normalizeLegacySettings(rawSettings);
      const completedSessions = loadCompletedSessions();
      const shouldForceNewSession = params?.get("new") === "1";
      const shouldReuseExisting =
        !shouldForceNewSession &&
        existing &&
        !existing.completedAt &&
        (existing.questionOrder?.length ?? 0) > 0;
      const nextSession = shouldReuseExisting
        ? existing
        : createSession(
            (savedSettings.subjectFilters?.length ?? 0) > 0
              ? getQuestionBankBySubjects(savedSettings.subjectFilters ?? [], loadedOverrides)
              : getQuestionBankBySubjectFilter(savedSettings.subjectFilter ?? "解剖學", loadedOverrides),
            completedSessions,
            savedSettings,
            loadedOverrides
          );

      if (!shouldReuseExisting) {
        clearCurrentSession();
      }

      setSession(nextSession);
      saveCurrentSession(nextSession);

      if (shouldReuseExisting && existing?.isReviewingAnswer) {
        const currentQuestionId = existing.questionOrder?.[existing.currentQuestionIndex ?? 0];
        const currentAttempt =
          existing.attempts.find((attempt) => attempt.questionId === currentQuestionId) ?? null;
        setSubmittedAttempt(currentAttempt);
        setSelectedAnswer(currentAttempt?.selectedAnswer);
        setConfidence(currentAttempt?.confidence ?? 4);
        setConfidenceExpanded((currentAttempt?.confidence ?? 4) <= 3);
        setErrorType(currentAttempt?.errorType);
      } else {
        resetQuestionUI();
      }

      setMounted(true);
    }

    void initializeSession();
  }, []);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, []);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (!session?.questionOrder?.length) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(session.questionOrder);
        if (Object.keys(sharedOverrides).length === 0) return;
        saveQuestionExplanationOverrides(sharedOverrides);
        setExplanationOverrides((current) => ({ ...current, ...sharedOverrides }));
        setSession((current) => (current ? { ...current } : current));
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [session?.id, session?.questionOrder]);

  const allQuestionFallbackMap = useMemo(
    () =>
      new Map(
        getQuestionBankBySubjects(["醫學（一）", "醫學（二）"], classificationOverrides).map(
          (question) => [question.id, question] as const
        )
      ),
    [classificationOverrides]
  );

  const questionSet = useMemo(
    () =>
      session ? getQuestionByOrder(session, allQuestionFallbackMap, classificationOverrides) : [],
    [allQuestionFallbackMap, classificationOverrides, session]
  );
  const currentIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questionSet[currentIndex];
  const targetCount =
    session?.settings?.mode === "peak_challenge"
      ? questionSet.length
      : session?.settings?.questionCount ?? questionSet.length;
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

  function handleSelectConfidence(value: ConfidenceLevel) {
    setConfidence(value);
    setConfidenceExpanded(value <= 3);

    if (!session || !submittedAttempt) return;

    const nextAttempts = session.attempts.map((attempt) =>
      attempt.questionId === submittedAttempt.questionId ? { ...attempt, confidence: value } : attempt
    );
    const nextSession = { ...session, attempts: nextAttempts };
    const updatedAttempt =
      nextAttempts.find((attempt) => attempt.questionId === submittedAttempt.questionId) ?? null;
    persistSession(nextSession);
    setSubmittedAttempt(updatedAttempt);
  }

  function handleSubmit() {
    if (!session || !currentQuestion || !selectedAnswer) return;
    setIsSubmittingAnswer(true);
    setPeakNextQuestionError("");

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

    if (session.settings?.mode === "peak_challenge") {
      if (!attempt.isCorrect) {
        const completedSession: QuizSession = {
          ...nextSessionBase,
          completedAt: new Date().toISOString(),
          isReviewingAnswer: false
        };
        persistSession(completedSession);
        saveCompletedSession(completedSession);
        void pushCompletedSessionToSupabase(completedSession);
        void pushQuestionStatsSnapshotToSupabase(completedSession);
        syncCompletedPeakChallenge(completedSession);
        router.push(`/results?sessionId=${encodeURIComponent(completedSession.id)}`);
        return;
      }

      const hasBufferedNextQuestion = (nextSessionBase.questionOrder?.length ?? 0) > currentIndex + 1;
      const accumulatedBreakdown = {
        pastExam: nextSessionBase.settings?.peakSourceBreakdown?.pastExam ?? 0,
        aiGenerated: nextSessionBase.settings?.peakSourceBreakdown?.aiGenerated ?? 0
      };
      if (hasBufferedNextQuestion) {
        const advancedSession: QuizSession = {
          ...nextSessionBase,
          currentQuestionIndex: currentIndex + 1,
          isReviewingAnswer: false
        };
        persistSession(advancedSession);
        void pushQuestionStatsSnapshotToSupabase(advancedSession);
        resetQuestionUI();
        setIsSubmittingAnswer(false);
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

      void (async () => {
        try {
          const nextQuestionBatch = await requestNextPeakChallengeBatch(nextSessionBase);

          const mergedGeneratedQuestions = Array.from(
            new Map(
              [...(nextSessionBase.generatedQuestions ?? []), ...nextQuestionBatch.questions].map((question) => [
                question.id,
                question
              ])
            ).values()
          );
          const mergedQuestionOrder = Array.from(
            new Set([...(nextSessionBase.questionOrder ?? []), ...nextQuestionBatch.questionIds])
          );
          const advancedSession: QuizSession = {
            ...nextSessionBase,
            generatedQuestions: mergedGeneratedQuestions,
            questionOrder: mergedQuestionOrder,
            currentQuestionIndex: currentIndex + 1,
            isReviewingAnswer: false,
            settings: {
              ...nextSessionBase.settings,
              mode: "peak_challenge",
              questionCount: mergedQuestionOrder.length,
              peakSourceBreakdown: {
                pastExam: accumulatedBreakdown.pastExam + (nextQuestionBatch.sourceBreakdown.pastExam ?? 0),
                aiGenerated: accumulatedBreakdown.aiGenerated + (nextQuestionBatch.sourceBreakdown.aiGenerated ?? 0)
              }
            }
          };

          persistSession(advancedSession);
          void pushQuestionStatsSnapshotToSupabase(advancedSession);
          setPeakNextQuestionError("");
          resetQuestionUI();
          setIsSubmittingAnswer(false);
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
        } catch (error) {
          persistSession(nextSessionBase);
          setSubmittedAttempt(attempt);
          setPeakNextQuestionError(
            error instanceof Error ? error.message : "下一題產生失敗，請再試一次。"
          );
          setIsSubmittingAnswer(false);
        }
      })();
      return;
    }

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
        void pushQuestionStatsSnapshotToSupabase(completedSession);
        syncCompletedCustomPaper(completedSession);
        router.push(`/results?sessionId=${encodeURIComponent(completedSession.id)}`);
        return;
      }

      const advancedSession: QuizSession = {
        ...nextSessionBase,
        currentQuestionIndex: currentIndex + 1,
        isReviewingAnswer: false
      };
      persistSession(advancedSession);
      void pushQuestionStatsSnapshotToSupabase(advancedSession);
      resetQuestionUI();
      setIsSubmittingAnswer(false);
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
    void pushQuestionStatsSnapshotToSupabase(nextSessionBase);
    setSubmittedAttempt(attempt);
    setErrorType(undefined);
    setIsSubmittingAnswer(false);
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

  async function handleGenerateQuestionExplanation(question: Question, attempt: Attempt) {
    if (!authSession?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 GPT-5-mini 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const previousQuestion = findPreviousQuestionForContinuation(question, questionSet);

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: authSession.access_token,
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
      setExplanationOverrides((current) => ({ ...current, [question.id]: override }));
      setSession((current) => (current ? { ...current } : current));
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 GPT-5-mini 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  async function handleReportClassification(question: Question) {
    if (!authSession?.access_token) {
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
          accessToken: authSession?.access_token ?? null,
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
        message?: string;
        suggestedSubject?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setClassificationReportMessageMap((current) => ({
          ...current,
          [question.id]: payload?.message || rawText || "分類回報送出失敗。"
        }));
        return;
      }

      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: payload.suggestedSubject
          ? `已回報，AI 建議改分到 ${payload.suggestedSubject}。`
          : "已回報，AI 會重新判讀這題分類。"
      }));
    } catch {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "分類回報送出失敗。"
      }));
    } finally {
      setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  function resetQuestionUI() {
    setSubmittedAttempt(null);
    setSelectedAnswer(undefined);
    setConfidence(4);
    setConfidenceExpanded(false);
    setErrorType(undefined);
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
      syncCompletedCustomPaper(completedSession);
      router.push(`/results?sessionId=${encodeURIComponent(completedSession.id)}`);
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

  async function handleRetryPeakNextQuestion() {
    if (!session || session.settings?.mode !== "peak_challenge" || !submittedAttempt?.isCorrect) return;

    try {
      setIsSubmittingAnswer(true);
      setPeakNextQuestionError("");
      const nextQuestionBatch = await requestNextPeakChallengeBatch(session);
      const mergedGeneratedQuestions = Array.from(
        new Map(
          [...(session.generatedQuestions ?? []), ...nextQuestionBatch.questions].map((question) => [
            question.id,
            question
          ])
        ).values()
      );
      const mergedQuestionOrder = Array.from(
        new Set([...(session.questionOrder ?? []), ...nextQuestionBatch.questionIds])
      );
      const advancedSession: QuizSession = {
        ...session,
        generatedQuestions: mergedGeneratedQuestions,
        questionOrder: mergedQuestionOrder,
        currentQuestionIndex: currentIndex + 1,
        isReviewingAnswer: false,
        settings: {
          ...session.settings,
          mode: "peak_challenge",
          questionCount: mergedQuestionOrder.length,
          peakSourceBreakdown: {
            pastExam:
              (session.settings?.peakSourceBreakdown?.pastExam ?? 0) +
              (nextQuestionBatch.sourceBreakdown.pastExam ?? 0),
            aiGenerated:
              (session.settings?.peakSourceBreakdown?.aiGenerated ?? 0) +
              (nextQuestionBatch.sourceBreakdown.aiGenerated ?? 0)
          }
        }
      };

      persistSession(advancedSession);
      void pushQuestionStatsSnapshotToSupabase(advancedSession);
      resetQuestionUI();
      setPeakNextQuestionError("");
      setIsSubmittingAnswer(false);
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
    } catch (error) {
      setPeakNextQuestionError(error instanceof Error ? error.message : "下一題產生失敗，請再試一次。");
      setIsSubmittingAnswer(false);
    }
  }

  useEffect(() => {
    if (
      session?.settings?.mode !== "peak_challenge" ||
      !session ||
      !currentQuestion ||
      submittedAttempt ||
      session.completedAt ||
      isPeakPrefetching
    ) {
      return;
    }

    const hasBufferedNextQuestion = (session.questionOrder?.length ?? 0) > currentIndex + 1;
    if (hasBufferedNextQuestion) return;

    const peakCandidates = session.settings?.peakWrongPoolCandidates ?? [];
    if (peakCandidates.length === 0) return;

    setIsPeakPrefetching(true);
    void requestNextPeakChallengeBatch(session)
      .then((nextQuestionBatch) => {
        setSession((current) => {
          if (!current || current.id !== session.id || current.completedAt) return current;
          if ((current.questionOrder?.length ?? 0) > currentIndex + 1) return current;

          const mergedGeneratedQuestions = Array.from(
            new Map(
              [...(current.generatedQuestions ?? []), ...nextQuestionBatch.questions].map((question) => [
                question.id,
                question
              ])
            ).values()
          );
          const mergedQuestionOrder = Array.from(
            new Set([...(current.questionOrder ?? []), ...nextQuestionBatch.questionIds])
          );
          const nextSession: QuizSession = {
            ...current,
            generatedQuestions: mergedGeneratedQuestions,
            questionOrder: mergedQuestionOrder,
            settings: {
              ...current.settings,
              mode: "peak_challenge",
              questionCount: mergedQuestionOrder.length,
              peakSourceBreakdown: {
                pastExam:
                  (current.settings?.peakSourceBreakdown?.pastExam ?? 0) +
                  (nextQuestionBatch.sourceBreakdown.pastExam ?? 0),
                aiGenerated:
                  (current.settings?.peakSourceBreakdown?.aiGenerated ?? 0) +
                  (nextQuestionBatch.sourceBreakdown.aiGenerated ?? 0)
              }
            }
          };
          saveCurrentSession(nextSession);
          setPeakNextQuestionError("");
          return nextSession;
        });
      })
      .catch(() => {
        // prefetch failure should not block current question
      })
      .finally(() => {
        setIsPeakPrefetching(false);
      });
  }, [authSession?.access_token, currentIndex, currentQuestion, isPeakPrefetching, session, submittedAttempt]);

  if (!mounted || !session || !currentQuestion) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">
          載入中...
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
          : submittedAttempt && submittedAttempt.confidence <= 3
            ? { text: "低信心", style: "bg-yellow-100 text-yellow-900" }
          : null;
  const difficultyBadge = submittedAttempt ? getDifficultyBadge(currentQuestion) : null;
  const feedbackMode = session.settings?.feedbackMode ?? "full";
  const isBlindSimulation =
    session.settings?.mode === "simulation" && feedbackMode === "none";
  const isPeakChallenge = session.settings?.mode === "peak_challenge";
  const shouldShowExplanation = !isPeakChallenge && feedbackMode === "full";
  const shouldShowCorrectAnswer = !isPeakChallenge && (feedbackMode === "full" || feedbackMode === "answer_only");
  const currentExplanationOverride = explanationOverrides[currentQuestion.id];
  const currentExplanationLoading = explanationLoadingMap[currentQuestion.id];
  const currentExplanationError = explanationErrorMap[currentQuestion.id];
  const currentClassificationReportLoading = classificationReportLoadingMap[currentQuestion.id];
  const currentClassificationReportMessage = classificationReportMessageMap[currentQuestion.id];
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
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              本地題庫模式
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

              <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {isPeakChallenge ? "目前分數" : "已答題數"} <span className="font-semibold">{answeredCount}</span>
                  </p>
                  {!isBlindSimulation && !isPeakChallenge ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      目前答對數 <span className="font-semibold">{correctCount}</span>
                    </p>
                  ) : null}
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    本輪平均信心 <span className="font-semibold">{averageConfidence}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedAnswer || isSubmittingAnswer}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-brand-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmittingAnswer
                    ? isPeakChallenge
                      ? "巔峰賽生成下一題中..."
                      : "送出中..."
                    : "送出答案"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div
                className={`rounded-[2rem] p-4 shadow-card ring-1 sm:p-6 ${
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
                        {(currentQuestion.answerCreditType === "multiple_accepted" ||
                          currentQuestion.answerCreditType === "multiple_answers") &&
                        currentQuestion.acceptedAnswers?.length
                          ? `${currentQuestion.acceptedAnswers.join("/")} 皆可`
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
                  {isPeakChallenge && peakNextQuestionError ? (
                    <p className="rounded-2xl bg-amber-100/70 px-4 py-3 text-amber-950">
                      {peakNextQuestionError}
                    </p>
                  ) : null}
                  {specialScoringNote ? (
                    <p className="rounded-2xl bg-amber-100/70 px-4 py-3 text-amber-950">
                      {specialScoringNote}
                    </p>
                  ) : null}
                </div>

                {shouldShowExplanation && currentQuestion.optionAnalysis ? (
                  <div className="mt-5 rounded-3xl bg-white/70 p-4 text-sm text-slate-800 ring-1 ring-white/70">
                    <h3 className="text-sm font-semibold text-ink">各選項解析</h3>
                    <div className="mt-3 space-y-2.5">
                      {Object.entries(currentQuestion.optionAnalysis).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              {key}
                            </span>
                            <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                              {value}
                            </p>
                          </div>
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

                {shouldShowExplanation ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {currentExplanationOverride ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          已替換詳解・{currentExplanationOverride.model ?? "gpt-5-mini"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleGenerateQuestionExplanation(currentQuestion, submittedAttempt)}
                          disabled={currentExplanationLoading}
                          className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                        >
                          {currentExplanationLoading ? "GPT-5-mini 生成中..." : "用 GPT-5-mini 補詳解"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleReportClassification(currentQuestion)}
                        disabled={currentClassificationReportLoading}
                        className="min-h-10 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
                      >
                        {currentClassificationReportLoading ? "回報中..." : "回報此題分類錯誤"}
                      </button>
                    </div>
                    {currentExplanationError ? (
                      <p className="text-sm font-medium text-rose-700">{currentExplanationError}</p>
                    ) : null}
                    {currentClassificationReportMessage ? (
                      <p className="text-sm font-medium text-slate-600">{currentClassificationReportMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <ConfidenceSelector
                value={confidence}
                expanded={confidenceExpanded}
                onExpand={() => setConfidenceExpanded((current) => !current)}
                onSelect={handleSelectConfidence}
              />
              {!submittedAttempt.isCorrect && shouldShowExplanation ? (
                <ErrorTypeSelector value={errorType} onSelect={handleErrorTypeSelect} />
              ) : null}

              {isPeakChallenge && submittedAttempt.isCorrect && peakNextQuestionError ? (
                <button
                  type="button"
                  onClick={() => void handleRetryPeakNextQuestion()}
                  disabled={isSubmittingAnswer}
                  className="min-h-12 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmittingAnswer ? "巔峰賽生成下一題中..." : "重試生成下一題"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-12 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  {currentIndex === targetCount - 1 ? "查看結果" : "下一題"}
                </button>
              )}
            </div>
          )}

          <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              {session.settings?.mode === "simulation" ? (
                <div className="flex min-h-12 items-center rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  模擬考目前設定：{
                    feedbackMode === "none"
                      ? "全程只做題"
                      : feedbackMode === "answer_only"
                        ? "每題只看正確答案"
                        : "每題看正確與詳解"
                  }
                </div>
              ) : isPeakChallenge ? (
                <div className="flex min-h-12 items-center rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  巔峰賽規則：答對 1 題得 1 分，答錯立刻結束；本輪混合考古題與 AI 難題。
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5 xl:sticky xl:top-6">
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
              {isPeakChallenge ? "目前分數" : "已答題數"} <span className="font-semibold">{answeredCount}</span>
            </p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              本輪模式 <span className="font-semibold">{getModeLabel(session.settings?.mode ?? "weakness")}</span>
            </p>
            {!isBlindSimulation && !isPeakChallenge ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                暫時答對率{" "}
                <span className="font-semibold">
                  {answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)}%
                </span>
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
