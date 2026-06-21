"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfidenceSelector } from "@/components/ConfidenceSelector";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { ErrorTypeSelector } from "@/components/ErrorTypeSelector";
import { QuestionCard } from "@/components/QuestionCard";
import { QuestionIssueReportButton } from "@/components/QuestionIssueReportButton";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
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
  pushCurrentSessionToSupabase,
  loadSharedQuestionExplanationOverrides,
  syncSharedQuestionExplanationOverrides,
  pushCompletedSessionToSupabase,
  pushQuestionStatsSnapshotToSupabase
} from "@/lib/cloudSync";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  buildQuestionExplanationRequestQuestion,
  findQuestionSource
} from "@/lib/questionExplanationRequest";
import {
  isTrackSubject,
  questionMatchesSubjectTracks,
  type TrackSubject
} from "@/lib/questionTrackFilters";
import {
  createQuestionOrder,
  DEFAULT_QUIZ_SETTINGS,
  getConfidenceLabel,
  getModeLabel
} from "@/lib/quizAnalysis";
import {
  applyQuestionExplanationOverride,
  clearMatchingCurrentSessions,
  clearCurrentSession,
  getPendingQuestionExplanationOverrideSync,
  loadCompletedSessions,
  loadCurrentSession,
  loadPracticeFastAnswerMode,
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

function decodeStartSettingsFromUrl(encodedSettings: string | null): QuizSettings | null {
  if (!encodedSettings) return null;

  try {
    const normalized = encodedSettings.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as QuizSettings;
  } catch {
    return null;
  }
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

function buildSimulationSessionName(settings: QuizSettings, questions: Question[]) {
  if (settings.mode !== "simulation") return settings.sessionName;
  if (settings.sessionName?.trim()) return settings.sessionName.trim();
  if (
    settings.paperMode !== "past_paper" &&
    settings.paperMode !== "random_past_paper"
  ) {
    return undefined;
  }

  const firstQuestion = questions.find(
    (question) => typeof question.sourceYear === "number"
  );

  if (!firstQuestion?.sourceYear) return "模擬考試卷";
  return `${firstQuestion.sourceYear} 年第 ${firstQuestion.sourceRound ?? 1} 次試卷`;
}

function getSimulationSelectedPaperKey(settings: QuizSettings, questions: Question[]) {
  if (settings.selectedPaperKey) return settings.selectedPaperKey;
  const firstQuestion = questions.find(
    (question) => question.examCode && question.paperCode
  );
  if (!firstQuestion?.examCode || !firstQuestion.paperCode) return undefined;
  return `${firstQuestion.examCode}-${firstQuestion.paperCode}`;
}

function buildResultsHref(session: QuizSession) {
  const basePath =
    session.settings?.mode === "simulation" ? "/simulation-results" : "/results";
  return `${basePath}?sessionId=${encodeURIComponent(session.id)}`;
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
  const shouldRespectEmptyLocalQuestionSet =
    hasActiveSubjectTrackFilter(normalizedSettings) || Boolean(normalizedSettings.strictCustomQuestionPool);
  const effectiveQuestions =
    localQuestionSet.length > 0 || shouldRespectEmptyLocalQuestionSet ? localQuestionSet : questions;
  const selectedSubjects = normalizedSettings.subjectFilters?.filter(Boolean) ?? [];
  const effectiveSettings =
    normalizedSettings.mode === "simulation" &&
    (normalizedSettings.paperMode === "past_paper" ||
      normalizedSettings.paperMode === "random_past_paper")
      ? { ...normalizedSettings, questionCount: effectiveQuestions.length }
      : normalizedSettings;
  const questionOrder =
    effectiveSettings.mode === "simulation" &&
    (effectiveSettings.paperMode === "past_paper" ||
      effectiveSettings.paperMode === "random_past_paper")
      ? [...effectiveQuestions]
          .sort((left, right) => (left.originalQuestionNumber ?? 0) - (right.originalQuestionNumber ?? 0))
          .map((question) => question.id)
      : createQuestionOrder(effectiveQuestions, completedSessions, effectiveSettings);
  const selectedQuestionMap = new Map(
    effectiveQuestions.map((question) => [question.id, question] as const)
  );
  const persistedQuestions = questionOrder
    .map((id) => selectedQuestionMap.get(id))
    .filter((question): question is Question => Boolean(question));
  const simulationSessionName = buildSimulationSessionName(
    effectiveSettings,
    persistedQuestions
  );
  const simulationSelectedPaperKey =
    effectiveSettings.mode === "simulation"
      ? getSimulationSelectedPaperKey(effectiveSettings, persistedQuestions)
      : effectiveSettings.selectedPaperKey;

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
    settings:
      effectiveSettings.mode === "simulation"
        ? {
            ...effectiveSettings,
            selectedPaperKey: simulationSelectedPaperKey,
            sessionName: simulationSessionName
          }
        : effectiveSettings,
    questionOrder,
    generatedQuestions: persistedQuestions,
    currentQuestionIndex: 0,
    isReviewingAnswer: false,
    attempts: []
  };
}

function getActiveSubjectTrackEntries(settings: QuizSettings): [TrackSubject, string[]][] {
  return Object.entries(settings.subjectTracks ?? {})
    .filter(
      (entry): entry is [TrackSubject, string[]] =>
        isTrackSubject(entry[0]) && Array.isArray(entry[1]) && entry[1].length > 0
    );
}

function hasActiveSubjectTrackFilter(settings: QuizSettings) {
  return getActiveSubjectTrackEntries(settings).length > 0;
}

function applySubjectTrackFilters(questions: Question[], settings: QuizSettings) {
  const activeTrackEntries = getActiveSubjectTrackEntries(settings);
  if (activeTrackEntries.length === 0) return questions;

  return questions.filter((question) => {
    const matchingTrackEntry = activeTrackEntries.find(([subject]) => question.subject === subject);
    if (!matchingTrackEntry) return true;
    const [subject, selectedTrackKeys] = matchingTrackEntry;
    return questionMatchesSubjectTracks(question, subject, selectedTrackKeys);
  });
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
  const filteredBank = applySubjectTrackFilters(bank, settings);
  const sourceBank =
    filteredBank.length > 0 || hasActiveSubjectTrackFilter(settings)
      ? filteredBank
      : bank.length > 0
        ? bank
        : fallbackQuestions;
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
      if (settings.strictCustomQuestionPool) {
        return mergedCustomQuestions;
      }

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
  if (paperMode === "past_paper") {
    const fallbackPaper = getPastPaperOptions(subjectFilter, classificationOverrides)
      .sort((left, right) => {
        if ((right.sourceYear ?? 0) !== (left.sourceYear ?? 0)) {
          return (right.sourceYear ?? 0) - (left.sourceYear ?? 0);
        }
        return (right.sourceRound ?? 0) - (left.sourceRound ?? 0);
      })[0];
    const paperKey = settings.selectedPaperKey ?? fallbackPaper?.key;
    if (!paperKey) return sourceBank;
    const paperQuestions = getQuestionsForPastPaper(
      paperKey,
      subjectFilter,
      classificationOverrides
    );
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  if (paperMode === "random_past_paper") {
    const papers = getPastPaperOptions(subjectFilter, classificationOverrides);
    if (papers.length === 0) return sourceBank;
    const selected = papers[Math.floor(Math.random() * papers.length)];
    const paperQuestions = getQuestionsForPastPaper(selected.key, subjectFilter, classificationOverrides);
    return paperQuestions.length > 0 ? paperQuestions : sourceBank;
  }

  return buildExamLikeRandomSet(subjectFilter, 100, classificationOverrides);
}

function getQuestionByOrder(
  session: QuizSession,
  fallbackMap: Map<string, Question>,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  const ids = session.questionOrder ?? [];
  const generatedMap = new Map(
    (session.generatedQuestions ?? [])
      .filter((question): question is Question => Boolean(question?.id))
      .map((question) => [question.id, question] as const)
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

function getExpectedSimulationQuestionCount(
  settings: QuizSettings,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (settings.mode !== "simulation") return settings.questionCount;

  if (
    (settings.paperMode === "past_paper" || settings.paperMode === "random_past_paper") &&
    settings.selectedPaperKey
  ) {
    return getQuestionsForPastPaper(
      settings.selectedPaperKey,
      settings.subjectFilter ?? "醫學（一）",
      classificationOverrides
    ).length;
  }

  return settings.mode === "simulation" ? 100 : settings.questionCount;
}

export default function QuizPage() {
  const router = useRouter();
  const { session: authSession } = useAuth();
  const questionTopRef = useRef<HTMLDivElement | null>(null);
  const contentTopRef = useRef<HTMLDivElement | null>(null);
  const completedSessionIdsRef = useRef(new Set<string>());
  const deferredCurrentSessionSaveRef = useRef<number | null>(null);
  const deferredCurrentSessionRef = useRef<QuizSession | null>(null);
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
  const [fastAnswerMode, setFastAnswerMode] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | undefined>();
  const [confidence, setConfidence] = useState<ConfidenceLevel>(4);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);
  const confidenceRef = useRef<ConfidenceLevel>(4);
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

  function flushDeferredCurrentSessionSave() {
    if (deferredCurrentSessionSaveRef.current !== null) {
      window.clearTimeout(deferredCurrentSessionSaveRef.current);
      deferredCurrentSessionSaveRef.current = null;
    }

    const pendingSession = deferredCurrentSessionRef.current;
    deferredCurrentSessionRef.current = null;
    if (pendingSession) {
      saveCurrentSession(pendingSession);
    }
  }

  function scheduleCurrentSessionSave(nextSession: QuizSession) {
    deferredCurrentSessionRef.current = nextSession;
    if (deferredCurrentSessionSaveRef.current !== null) return;

    deferredCurrentSessionSaveRef.current = window.setTimeout(() => {
      deferredCurrentSessionSaveRef.current = null;
      const pendingSession = deferredCurrentSessionRef.current;
      deferredCurrentSessionRef.current = null;
      if (pendingSession) {
        saveCurrentSession(pendingSession);
      }
    }, 120);
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

  async function requestNextPeakChallengeBatchWithRetry(
    baseSession: QuizSession,
    retries = 2
  ) {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await requestNextPeakChallengeBatch(baseSession);
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("下一題產生失敗，請再試一次。");
  }

  useEffect(() => {
    setFastAnswerMode(loadPracticeFastAnswerMode(false));

    function handleFastAnswerModeChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      setFastAnswerMode(Boolean(customEvent.detail));
    }

    window.addEventListener("practice-fast-answer-mode-change", handleFastAnswerModeChange);

    return () => {
      window.removeEventListener("practice-fast-answer-mode-change", handleFastAnswerModeChange);
    };
  }, []);

  useEffect(() => {
    const flushPendingSession = () => flushDeferredCurrentSessionSave();
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushDeferredCurrentSessionSave();
      }
    };

    window.addEventListener("pagehide", flushPendingSession);
    document.addEventListener("visibilitychange", flushWhenHidden);

    return () => {
      window.removeEventListener("pagehide", flushPendingSession);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      flushDeferredCurrentSessionSave();
    };
  }, []);

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
      const startSettingsFromUrl = decodeStartSettingsFromUrl(params?.get("startSettings") ?? null);
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
        startSettingsFromUrl ??
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
      const expectedSimulationQuestionCount = getExpectedSimulationQuestionCount(
        savedSettings,
        loadedOverrides
      );
      const existingSimulationQuestionCount =
        existing?.settings?.mode === "simulation"
          ? existing.questionOrder?.length ?? 0
          : null;
      const shouldInvalidateExistingSimulationSession =
        existing?.settings?.mode === "simulation" &&
        savedSettings.mode === "simulation" &&
        existingSimulationQuestionCount !== null &&
        expectedSimulationQuestionCount > 0 &&
        existingSimulationQuestionCount !== expectedSimulationQuestionCount;
      const shouldReuseExisting =
        !shouldForceNewSession &&
        existing &&
        !existing.completedAt &&
        (existing.questionOrder?.length ?? 0) > 0 &&
        !shouldInvalidateExistingSimulationSession;
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
      void pushCurrentSessionToSupabase(nextSession);

      if (shouldReuseExisting && existing?.isReviewingAnswer) {
        const currentQuestionId = existing.questionOrder?.[existing.currentQuestionIndex ?? 0];
        const currentAttempt =
          existing.attempts.find((attempt) => attempt.questionId === currentQuestionId) ?? null;
        setSubmittedAttempt(currentAttempt);
        setSelectedAnswer(currentAttempt?.selectedAnswer);
        const nextConfidence = currentAttempt?.confidence ?? 4;
        confidenceRef.current = nextConfidence;
        setConfidence(nextConfidence);
        setConfidenceExpanded(nextConfidence <= 3);
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
        if (Object.keys(sharedOverrides).length > 0) {
          saveQuestionExplanationOverrides(sharedOverrides);
          setExplanationOverrides((current) => ({ ...current, ...sharedOverrides }));
          setSession((current) => (current ? { ...current } : current));
        }

        if (authSession?.access_token) {
          const pendingOverrides = getPendingQuestionExplanationOverrideSync(
            session.questionOrder,
            sharedOverrides
          );
          if (pendingOverrides.length > 0) {
            await syncSharedQuestionExplanationOverrides(pendingOverrides, authSession.access_token);
          }
        }
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [authSession?.access_token, session?.id, session?.questionOrder]);

  useEffect(() => {
    if (!authSession?.user?.id || !session || session.completedAt || !mounted) return;

    const timer = window.setTimeout(() => {
      void pushCurrentSessionToSupabase(session);
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authSession?.user?.id, mounted, session]);

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
    [
      allQuestionFallbackMap,
      classificationOverrides,
      session?.generatedQuestions,
      session?.id,
      session?.questionOrder,
      session?.settings
    ]
  );
  const currentIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questionSet[currentIndex];
  const targetCount =
    session?.settings?.mode === "simulation"
      ? questionSet.length
      : session?.settings?.mode === "peak_challenge"
      ? questionSet.length
      : session?.settings?.questionCount ?? questionSet.length;
  const progress =
    targetCount === 0 ? 0 : ((currentIndex + (submittedAttempt ? 1 : 0)) / targetCount) * 100;
  const answeredCount = session?.attempts.length ?? 0;
  const correctCount = session?.attempts.filter((attempt) => attempt.isCorrect).length ?? 0;
  const displayedConfidence = submittedAttempt?.confidence ?? confidence;
  const averageConfidence =
    answeredCount === 0
      ? 0
      : Number(
          (
            (session?.attempts.reduce((sum, attempt) => sum + attempt.confidence, 0) ?? 0) /
            answeredCount
          ).toFixed(1)
        );

  useEffect(() => {
    if (!session || !currentQuestion || submittedAttempt) return;

    const existingAttempt =
      session.attempts.find((attempt) => attempt.questionId === currentQuestion.id) ?? null;

    if (existingAttempt) {
      setSelectedAnswer(existingAttempt.selectedAnswer);
      confidenceRef.current = existingAttempt.confidence;
      setConfidence(existingAttempt.confidence);
      setConfidenceExpanded(existingAttempt.confidence <= 3);
      setErrorType(existingAttempt.errorType);
      return;
    }

    setSelectedAnswer(undefined);
    confidenceRef.current = 4;
    setConfidence(4);
    setConfidenceExpanded(false);
    setErrorType(undefined);
  }, [currentQuestion?.id, session, submittedAttempt]);

  function persistSession(
    nextSession: QuizSession,
    options: { deferLocalSave?: boolean } = {}
  ) {
    setSession(nextSession);
    if (options.deferLocalSave) {
      scheduleCurrentSessionSave(nextSession);
      return;
    }

    deferredCurrentSessionRef.current = null;
    if (deferredCurrentSessionSaveRef.current !== null) {
      window.clearTimeout(deferredCurrentSessionSaveRef.current);
      deferredCurrentSessionSaveRef.current = null;
    }
    saveCurrentSession(nextSession);
  }

  function finalizeCompletedSession(completedSession: QuizSession) {
    const completedKey = completedSession.id.replace(/^user-[^:]+:/, "");
    if (completedSessionIdsRef.current.has(completedKey)) {
      return false;
    }
    completedSessionIdsRef.current.add(completedKey);
    setSession(completedSession);
    saveCurrentSession(completedSession);
    const saved = saveCompletedSession(completedSession);
    if (saved !== false) {
      clearMatchingCurrentSessions(completedSession.id, [authSession?.user?.id ?? ""]);
    }
    return saved !== false;
  }

  function handleSelectConfidence(value: ConfidenceLevel) {
    confidenceRef.current = value;

    if (!session || !submittedAttempt) return;

    const nextAttempts = session.attempts.map((attempt) =>
      attempt.questionId === submittedAttempt.questionId ? { ...attempt, confidence: value } : attempt
    );
    const nextSession = { ...session, attempts: nextAttempts };
    const updatedAttempt =
      nextAttempts.find((attempt) => attempt.questionId === submittedAttempt.questionId) ?? null;
    persistSession(nextSession, { deferLocalSave: true });
    setSubmittedAttempt(updatedAttempt);
  }

  function handleSubmit(answerOverride?: OptionKey) {
    const answerToSubmit = answerOverride ?? selectedAnswer;
    if (!session || !currentQuestion || !answerToSubmit || isSubmittingAnswer) return;
    setSelectedAnswer(answerToSubmit);
    setIsSubmittingAnswer(true);
    setPeakNextQuestionError("");

    const attempt: Attempt = {
      questionId: currentQuestion.id,
      selectedAnswer: answerToSubmit,
      correctAnswer: currentQuestion.answer,
      isCorrect: evaluateAttempt(currentQuestion, answerToSubmit),
      confidence: confidenceRef.current,
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
        finalizeCompletedSession(completedSession);
        void pushCompletedSessionToSupabase(completedSession);
        void pushQuestionStatsSnapshotToSupabase(completedSession);
        syncCompletedPeakChallenge(completedSession);
        router.push(buildResultsHref(completedSession));
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
          const nextQuestionBatch = await requestNextPeakChallengeBatchWithRetry(nextSessionBase);

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
        finalizeCompletedSession(completedSession);
        void pushCompletedSessionToSupabase(completedSession);
        void pushQuestionStatsSnapshotToSupabase(completedSession);
        syncCompletedCustomPaper(completedSession);
        router.push(buildResultsHref(completedSession));
        return;
      }

      const advancedSession: QuizSession = {
        ...nextSessionBase,
        currentQuestionIndex: currentIndex + 1,
        isReviewingAnswer: false
      };
      persistSession(advancedSession);
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
    setSubmittedAttempt(attempt);
    setErrorType(undefined);
    setIsSubmittingAnswer(false);
  }

  function handleSelectAnswer(value: OptionKey) {
    if (submittedAttempt || isSubmittingAnswer) return;
    setSelectedAnswer(value);
    if (fastAnswerMode) {
      handleSubmit(value);
    }
  }

  function handleBlindSimulationPrevious() {
    if (!session || !isBlindSimulation || currentIndex === 0) return;

    const previousSession: QuizSession = {
      ...session,
      currentQuestionIndex: currentIndex - 1,
      isReviewingAnswer: false
    };
    persistSession(previousSession, { deferLocalSave: true });
    setSubmittedAttempt(null);
    setPeakNextQuestionError("");

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

  function handleJumpToQuestion(targetIndex: number) {
    if (
      !session ||
      session.settings?.mode !== "simulation" ||
      targetIndex < 0 ||
      targetIndex >= questionSet.length ||
      targetIndex === currentIndex
    ) {
      return;
    }

    const jumpedSession: QuizSession = {
      ...session,
      currentQuestionIndex: targetIndex,
      isReviewingAnswer: false
    };
    persistSession(jumpedSession, { deferLocalSave: true });
    setSubmittedAttempt(null);
    setPeakNextQuestionError("");

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

  function handleErrorTypeSelect(value: ErrorType) {
    if (!session || !submittedAttempt) return;
    setErrorType(value);
    const nextAttempts = session.attempts.map((attempt) =>
      attempt.questionId === submittedAttempt.questionId ? { ...attempt, errorType: value } : attempt
    );
    const nextSession = { ...session, attempts: nextAttempts };
    const updatedAttempt =
      nextAttempts.find((attempt) => attempt.questionId === submittedAttempt.questionId) ?? null;
    persistSession(nextSession, { deferLocalSave: true });
    setSubmittedAttempt(updatedAttempt);
  }

  async function handleGenerateQuestionExplanation(
    question: Question,
    attempt: Attempt,
    previousOverride?: QuestionExplanationOverride
  ) {
    if (!authSession?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 AI 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const sourceQuestion = findQuestionSource(question, [
      ...Array.from(allQuestionFallbackMap.values()),
      ...(session?.generatedQuestions ?? [])
    ]);
    const sourceQuestionSet = questionSet.map((item) =>
      findQuestionSource(item, [
        ...Array.from(allQuestionFallbackMap.values()),
        ...(session?.generatedQuestions ?? [])
      ])
    );
    const previousQuestion = findPreviousQuestionForContinuation(sourceQuestion, sourceQuestionSet);

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: authSession.access_token,
          question: buildQuestionExplanationRequestQuestion(question, sourceQuestion),
          previousQuestion: previousQuestion ? buildRelatedQuestionContext(previousQuestion) : undefined,
          previousOverride,
          attempt: {
            selectedAnswer: attempt.selectedAnswer,
            confidence: attempt.confidence,
            isCorrect: attempt.isCorrect
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        sharedSaved?: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation || payload.sharedSaved === false) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "AI 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5.4-mini",
        updatedAt: new Date().toISOString()
      };

      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) => ({ ...current, [question.id]: override }));
      setSession((current) => (current ? { ...current } : current));
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 AI 詳解 API。"
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
        [question.id]:
          payload.message ||
          (payload.suggestedSubject
            ? `已回報並自動套用到 ${payload.suggestedSubject}。`
            : "已回報並依 AI 建議自動套用分類。")
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
    confidenceRef.current = 4;
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
      finalizeCompletedSession(completedSession);
      void pushCompletedSessionToSupabase(completedSession);
      void pushQuestionStatsSnapshotToSupabase(completedSession);
      syncCompletedCustomPaper(completedSession);
      router.push(buildResultsHref(completedSession));
      return;
    }

    const nextSession: QuizSession = {
      ...session,
      currentQuestionIndex: currentIndex + 1,
      isReviewingAnswer: false
    };
    persistSession(nextSession, { deferLocalSave: true });
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

  function handleEndAfterReview() {
    if (!session) return;

    const completedSession: QuizSession = {
      ...session,
      completedAt: new Date().toISOString(),
      isReviewingAnswer: false
    };
    finalizeCompletedSession(completedSession);
    void pushCompletedSessionToSupabase(completedSession);
    void pushQuestionStatsSnapshotToSupabase(completedSession);
    syncCompletedCustomPaper(completedSession);
    router.push(buildResultsHref(completedSession));
  }

  async function handleRetryPeakNextQuestion() {
    if (!session || session.settings?.mode !== "peak_challenge" || !submittedAttempt?.isCorrect) return;

    try {
      setIsSubmittingAnswer(true);
      setPeakNextQuestionError("");
      const nextQuestionBatch = await requestNextPeakChallengeBatchWithRetry(session);
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
    void requestNextPeakChallengeBatchWithRetry(session)
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
          void pushCurrentSessionToSupabase(nextSession);
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
  const shouldShowAiExplanationDetails = shouldShowExplanation;
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
            {session.settings?.mode === "simulation" ? (
              <>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                  {getModeLabel(session.settings?.mode ?? "weakness")}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {targetCount} 題
                </span>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          <QuestionCard
            question={currentQuestion}
            selectedAnswer={selectedAnswer}
            submittedResult={submittedAttempt ?? undefined}
            onSelect={handleSelectAnswer}
            showMetadata={session.settings?.mode !== "simulation"}
          />

          {!submittedAttempt ? (
            <>
              <ConfidenceSelector
                value={displayedConfidence}
                expanded={confidenceExpanded || displayedConfidence <= 3}
                onExpand={() => undefined}
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {isBlindSimulation ? (
                    <button
                      type="button"
                      onClick={handleBlindSimulationPrevious}
                      disabled={currentIndex === 0 || isSubmittingAnswer}
                      className="min-h-12 w-full rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      上一題
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!selectedAnswer || isSubmittingAnswer}
                    className={`min-h-12 w-full rounded-2xl bg-brand-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${
                      isBlindSimulation ? "" : "sm:col-span-2"
                    }`}
                  >
                    {isSubmittingAnswer
                      ? isPeakChallenge
                        ? "巔峰賽生成下一題中..."
                        : "送出中..."
                      : isBlindSimulation
                        ? currentIndex === targetCount - 1
                          ? "完成並看結果"
                          : "儲存並下一題"
                        : "送出答案"}
                  </button>
                </div>
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
                  <CopyQuestionPromptButton
                    question={currentQuestion}
                    selectedAnswer={submittedAttempt.selectedAnswer}
                    correctAnswer={submittedAttempt.correctAnswer}
                    className="ml-auto"
                  />
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
                      {shouldShowAiExplanationDetails ? <p>整題詳解：{currentQuestion.explanation}</p> : null}
                      <QuestionExplanationTabs
                        question={currentQuestion}
                        className="mt-3"
                      />
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

                {shouldShowExplanation && shouldShowAiExplanationDetails && currentQuestion.optionAnalysis ? (
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

                {shouldShowExplanation && shouldShowAiExplanationDetails && currentQuestion.memoryTip ? (
                  <div className="memory-tip-box mt-5">
                    <h3 className="text-sm font-semibold">快速記憶法</h3>
                    <p className="mt-2 leading-7">{currentQuestion.memoryTip}</p>
                  </div>
                ) : null}

                {shouldShowExplanation ? (
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {currentExplanationOverride ? (
                        <>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            已替換詳解・{currentExplanationOverride.model ?? "gpt-5.4-mini"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleGenerateQuestionExplanation(
                                currentQuestion,
                                submittedAttempt,
                                currentExplanationOverride
                              )
                            }
                            disabled={currentExplanationLoading}
                            className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                          >
                            {currentExplanationLoading ? "重新生成中..." : "重新替換詳解"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleGenerateQuestionExplanation(currentQuestion, submittedAttempt)}
                          disabled={currentExplanationLoading}
                          className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                        >
                          {currentExplanationLoading ? "AI 生成中..." : "用 AI 補詳解"}
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
                      <QuestionIssueReportButton
                        question={currentQuestion}
                        disabled={currentClassificationReportLoading}
                      />
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
                value={displayedConfidence}
                expanded={confidenceExpanded || displayedConfidence <= 3}
                onExpand={() => undefined}
                onSelect={handleSelectConfidence}
              />
              {!submittedAttempt.isCorrect && shouldShowExplanation ? (
                <ErrorTypeSelector value={errorType} onSelect={handleErrorTypeSelect} />
              ) : null}

              <div className="grid gap-3">
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
                {((session.settings?.mode === "random" && session.settings?.stopAfterReview) ||
                  session.settings?.mode === "custom_paper") &&
                !isPeakChallenge &&
                currentIndex < targetCount - 1 ? (
                  <button
                    type="button"
                    onClick={handleEndAfterReview}
                    className="min-h-12 w-full rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                  >
                    結束測驗
                  </button>
                ) : null}
              </div>
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
            {session.settings?.mode === "simulation" ? null : (
              <>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  目前章節 <span className="font-semibold">{currentQuestion.chapter}</span>
                </p>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  目前小節 <span className="font-semibold">{currentQuestion.section}</span>
                </p>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  目前信心 <span className="font-semibold">{getConfidenceLabel(displayedConfidence)}</span>
                </p>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {isPeakChallenge ? "目前分數" : "已答題數"} <span className="font-semibold">{answeredCount}</span>
                </p>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  本輪模式 <span className="font-semibold">{getModeLabel(session.settings?.mode ?? "weakness")}</span>
                </p>
              </>
            )}
            {!isBlindSimulation && !isPeakChallenge ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                暫時答對率{" "}
                <span className="font-semibold">
                  {answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)}%
                </span>
              </p>
            ) : null}
          </div>

          {session.settings?.mode === "simulation" ? (
            <div className="mt-5 hidden xl:block">
              <div className="rounded-[1.6rem] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">題號導覽</p>
                <p className="mt-1 text-xs text-slate-500">可直接跳回前面檢查或修改答案。</p>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {questionSet.map((question, index) => {
                    const existingAttempt = session.attempts.find((attempt) => attempt.questionId === question.id);
                    const isCurrent = index === currentIndex;
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => handleJumpToQuestion(index)}
                        disabled={isSubmittingAnswer}
                        className={`min-h-10 rounded-xl text-sm font-semibold transition ${
                          isCurrent
                            ? "bg-brand-600 text-white"
                            : existingAttempt
                              ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        aria-label={`前往第 ${index + 1} 題`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
