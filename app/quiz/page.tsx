"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ConfidenceSelector } from "@/components/ConfidenceSelector";
import { ErrorTypeSelector } from "@/components/ErrorTypeSelector";
import { QuestionCard } from "@/components/QuestionCard";
import {
  applyQuestionClassificationOverride,
  buildExamLikeRandomSet,
  getAISimulationPaperLabel,
  getAISimulationPaperOptions,
  getPastPaperOptions,
  getImportedCustomPaperQuestionsByIds,
  getQuestionBankBySubjects,
  getQuestionBankBySubjectFilter,
  getQuestionsForAISimulationPaper,
  getQuestionsForPastPaper,
  getSeasonalLimitedQuestions
} from "@/data/med1QuestionBank";
import {
  loadConfirmedQuestionClassificationOverrides,
  clearQuestionExplanationBackgroundCache,
  recordCustomPaperAttempt,
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
  loadCompletedHistorySessionsForUser,
  loadCurrentSession,
  loadKeyboardQuestionNavigation,
  loadPracticeFastAnswerMode,
  loadQuestionExplanationOverrides,
  loadQuizSettings,
  loadSimulationOptionElimination,
  mergeQuestionExplanationOverrides,
  mergeCompletedQuestionHistoryFromSessionsForUser,
  queuePendingCompletedSessionUploadForUser,
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

const CopyQuestionPromptButton = dynamic(
  () => import("@/components/CopyQuestionPromptButton").then((mod) => mod.CopyQuestionPromptButton),
  { ssr: false }
);
const QuestionExplanationTabs = dynamic(
  () => import("@/components/QuestionExplanationTabs").then((mod) => mod.QuestionExplanationTabs),
  { ssr: false }
);
const QuestionReportButton = dynamic(
  () => import("@/components/QuestionIssueReportButton").then((mod) => mod.QuestionReportButton),
  { ssr: false }
);
const SavedQuestionButton = dynamic(
  () => import("@/components/SavedQuestionButton").then((mod) => mod.SavedQuestionButton),
  { ssr: false }
);
const StructuredExplanationText = dynamic(
  () => import("@/components/StructuredExplanationText").then((mod) => mod.StructuredExplanationText),
  { ssr: false }
);

const FREE_PRACTICE_BATCH_SIZE = 10;
const FREE_PRACTICE_PREFETCH_THRESHOLD = 3;
const QUIZ_CLASSIFICATION_OVERRIDE_TIMEOUT_MS = 3200;
const CURRENT_SESSION_CLOUD_CHECKPOINT_MS = 45_000;
const CURRENT_SESSION_CLOUD_IDLE_DELAY_MS = 1_500;

function getEffectiveFeedbackMode(settings?: QuizSettings | null) {
  if (settings?.mode === "simulation") {
    return settings.feedbackMode ?? "none";
  }

  return settings?.feedbackMode ?? "full";
}

function shouldRevealAttemptFeedback(session?: QuizSession | null) {
  return !(
    session?.settings?.mode === "simulation" &&
    getEffectiveFeedbackMode(session.settings) === "none"
  );
}

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

function getSimulationNavigatorButtonClass(confidenceLevel: ConfidenceLevel | null | undefined, isCurrent: boolean) {
  const currentRing = isCurrent
    ? "ring-2 ring-slate-950 ring-offset-2 ring-offset-white"
    : "ring-1";
  const baseClass = `min-h-10 rounded-xl text-sm font-black transition border ${currentRing}`;

  if (confidenceLevel === 1) {
    return `${baseClass} border-rose-300 bg-rose-500 text-white ring-rose-200 hover:bg-rose-600`;
  }

  if (confidenceLevel === 2) {
    return `${baseClass} border-orange-300 bg-orange-400 text-white ring-orange-200 hover:bg-orange-500`;
  }

  if (confidenceLevel === 3) {
    return `${baseClass} border-yellow-300 bg-yellow-300 text-yellow-950 ring-yellow-200 hover:bg-yellow-400`;
  }

  if (confidenceLevel === 4 || confidenceLevel === 5) {
    return `${baseClass} border-emerald-200 bg-emerald-100 text-emerald-950 ring-emerald-200 hover:bg-emerald-200`;
  }

  return `${baseClass} border-slate-200 bg-white text-slate-600 ring-slate-200 hover:bg-slate-100`;
}

type SimulationQuestionNavigatorProps = {
  attemptsByQuestionId: Map<string, Attempt>;
  currentIndex: number;
  disabled: boolean;
  onJump: (index: number) => void;
  questions: Question[];
  variant?: "sidebar" | "bottom";
};

const SimulationQuestionNavigator = memo(function SimulationQuestionNavigator({
  attemptsByQuestionId,
  currentIndex,
  disabled,
  onJump,
  questions,
  variant = "sidebar"
}: SimulationQuestionNavigatorProps) {
  return (
    <div
      className={`simulation-question-navigator mt-3 grid gap-2 ${
        variant === "bottom" ? "simulation-question-navigator--bottom" : "grid-cols-5"
      }`}
    >
      {questions.map((question, index) => {
        const existingAttempt = attemptsByQuestionId.get(question.id);
        const isCurrent = index === currentIndex;
        const navigatorConfidence = existingAttempt?.confidence;
        const confidenceLabel = navigatorConfidence
          ? getConfidenceLabel(navigatorConfidence)
          : "尚未作答";
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => onJump(index)}
            disabled={disabled}
            className={`${getSimulationNavigatorButtonClass(
              navigatorConfidence,
              isCurrent
            )} simulation-navigator-button disabled:cursor-not-allowed disabled:opacity-60`}
            aria-label={`前往第 ${index + 1} 題，${confidenceLabel}`}
            title={`第 ${index + 1} 題・${confidenceLabel}`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
});

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

function withTimeoutFallback<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return new Promise<T>((resolve) => {
    const timeoutId = globalThis.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => globalThis.clearTimeout(timeoutId));
  });
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

function normalizeEliminatedOptions(options?: OptionKey[]) {
  return Array.from(new Set((options ?? []).filter((option): option is OptionKey => Boolean(option))));
}

function shouldIgnoreKeyboardNavigationTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg\//.test(navigator.userAgent);
}

function getQuestionScrollBehavior(): ScrollBehavior {
  return isSafariBrowser() ? "auto" : "smooth";
}

function isGenericSimulationSessionName(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return true;
  return (
    normalized === "模擬考" ||
    normalized === "模擬考試卷" ||
    /^\d{4}\s*年第\s*[12]\s*次試卷$/.test(normalized)
  );
}

function buildSimulationSessionName(settings: QuizSettings, questions: Question[]) {
  if (settings.mode !== "simulation") return settings.sessionName;
  if (!isGenericSimulationSessionName(settings.sessionName)) return settings.sessionName?.trim();
  if (
    settings.paperMode !== "past_paper" &&
    settings.paperMode !== "ai_paper" &&
    settings.paperMode !== "random_past_paper"
  ) {
    return undefined;
  }

  const selectedPaperKey = getSimulationSelectedPaperKey(settings, questions);
  const paperLabel =
    selectedPaperKey && settings.paperMode === "ai_paper"
      ? getAISimulationPaperLabel(selectedPaperKey, settings.subjectFilter ?? "全部") ??
        getAISimulationPaperLabel(selectedPaperKey, "全部")
      : selectedPaperKey
        ? getPastPaperOptions(settings.subjectFilter ?? "全部").find((paper) => paper.key === selectedPaperKey)?.label ??
          getPastPaperOptions("全部").find((paper) => paper.key === selectedPaperKey)?.label
        : undefined;
  if (paperLabel) return paperLabel;

  const firstQuestion = questions.find(
    (question) => typeof question.sourceYear === "number"
  );

  if (!firstQuestion?.sourceYear) return "模擬考試卷";
  const subjectLabel =
    firstQuestion.sourceCitation?.includes("醫學（二）") || settings.subjectFilter === "醫學（二）"
      ? "醫學（二）"
      : firstQuestion.paperCode?.startsWith("2")
        ? "醫學（二）"
        : "醫學（一）";
  return `${firstQuestion.sourceYear} 第${firstQuestion.sourceRound ?? 1}次 ${subjectLabel} ${firstQuestion.paperCode ?? ""}`.trim();
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

function isIncrementalPracticeSettings(settings?: QuizSettings | null): settings is QuizSettings {
  return settings?.mode === "random" && Boolean(settings.stopAfterReview);
}

function createSession(
  questions: Question[],
  completedSessions: { attempts: Attempt[] }[],
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
    hasActiveSubjectTrackFilter(normalizedSettings) ||
    Boolean(normalizedSettings.strictCustomQuestionPool) ||
    (normalizedSettings.mode === "simulation" && normalizedSettings.paperMode === "ai_paper");
  const effectiveQuestions =
    localQuestionSet.length > 0 || shouldRespectEmptyLocalQuestionSet ? localQuestionSet : questions;
  const selectedSubjects = normalizedSettings.subjectFilters?.filter(Boolean) ?? [];
  const effectiveSettings =
    normalizedSettings.mode === "simulation" &&
    (normalizedSettings.paperMode === "past_paper" ||
      normalizedSettings.paperMode === "ai_paper" ||
      normalizedSettings.paperMode === "random_past_paper")
      ? { ...normalizedSettings, questionCount: effectiveQuestions.length }
      : normalizedSettings;
  const questionOrderSettings = isIncrementalPracticeSettings(effectiveSettings)
    ? {
        ...effectiveSettings,
        questionCount: Math.min(
          FREE_PRACTICE_BATCH_SIZE,
          Math.max(1, effectiveSettings.questionCount)
        )
      }
    : effectiveSettings;
  const questionOrder =
    effectiveSettings.mode === "simulation" &&
    (effectiveSettings.paperMode === "past_paper" ||
      effectiveSettings.paperMode === "ai_paper" ||
      effectiveSettings.paperMode === "random_past_paper")
      ? [...effectiveQuestions]
          .sort((left, right) => (left.originalQuestionNumber ?? 0) - (right.originalQuestionNumber ?? 0))
          .map((question) => question.id)
      : createQuestionOrder(effectiveQuestions, completedSessions, questionOrderSettings);
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

      if (settings.mode === "custom_paper" || selectedSubjects.length === 0) {
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

  if (paperMode === "ai_paper") {
    const fallbackPaper = getAISimulationPaperOptions(subjectFilter).sort((left, right) => {
      if ((right.sourceYear ?? 0) !== (left.sourceYear ?? 0)) {
        return (right.sourceYear ?? 0) - (left.sourceYear ?? 0);
      }
      return left.label.localeCompare(right.label);
    })[0];
    const paperKey = settings.selectedPaperKey ?? fallbackPaper?.key;
    if (!paperKey) return [];
    const paperQuestions = getQuestionsForAISimulationPaper(paperKey, subjectFilter);
    return paperQuestions.length > 0 ? paperQuestions : [];
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
  classificationOverrides: Record<string, QuestionClassificationOverride> = {},
  explanationOverrides: Record<string, QuestionExplanationOverride> = {}
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
        ? (() => {
            const storedQuestion = applyQuestionExplanationOverride(
              applyQuestionClassificationOverride(question, classificationOverrides[question.id])
            );
            const override = explanationOverrides[question.id];
            return override
              ? {
                  ...storedQuestion,
                  explanation: override.explanation || storedQuestion.explanation,
                  optionAnalysis: override.optionAnalysis ?? storedQuestion.optionAnalysis,
                  memoryTip: override.memoryTip ?? storedQuestion.memoryTip
                }
              : storedQuestion;
          })()
        : question
    )
    .filter((question): question is Question => Boolean(question));
}

function getResolvableQuestionIdsForSession(
  session: QuizSession,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  const generatedIds = new Set(
    (session.generatedQuestions ?? [])
      .filter((question): question is Question => Boolean(question?.id))
      .map((question) => question.id)
  );
  const fallbackIds = new Set(
    getQuestionBankBySubjects(["醫學（一）", "醫學（二）"], classificationOverrides).map(
      (question) => question.id
    )
  );

  return (session.questionOrder ?? []).filter(
    (id) => generatedIds.has(id) || fallbackIds.has(id)
  );
}

function canReuseCurrentSession(
  session: QuizSession | null,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (!session || session.completedAt) return false;
  const resolvableIds = getResolvableQuestionIdsForSession(session, classificationOverrides);
  const currentIndex = session.currentQuestionIndex ?? 0;
  return (
    resolvableIds.length > 0 &&
    currentIndex >= 0 &&
    currentIndex < resolvableIds.length
  );
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

function getExpectedSimulationQuestionCount(
  settings: QuizSettings,
  classificationOverrides: Record<string, QuestionClassificationOverride> = {}
) {
  if (settings.mode !== "simulation") return settings.questionCount;

  if (
    (settings.paperMode === "past_paper" ||
      settings.paperMode === "ai_paper" ||
      settings.paperMode === "random_past_paper") &&
    settings.selectedPaperKey
  ) {
    if (settings.paperMode === "ai_paper") {
      return getQuestionsForAISimulationPaper(
        settings.selectedPaperKey,
        settings.subjectFilter ?? "醫學（一）"
      ).length;
    }

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
  const {
    session: authSession,
    loading: authLoading,
    syncStatus,
    syncVersion
  } = useAuth();
  const questionTopRef = useRef<HTMLDivElement | null>(null);
  const contentTopRef = useRef<HTMLDivElement | null>(null);
  const initializedSessionRef = useRef(false);
  const completedSessionIdsRef = useRef(new Set<string>());
  const deferredCurrentSessionSaveRef = useRef<number | null>(null);
  const deferredCurrentSessionRef = useRef<QuizSession | null>(null);
  const currentSessionCloudSyncTimerRef = useRef<number | null>(null);
  const currentSessionCloudPendingRef = useRef<QuizSession | null>(null);
  const currentSessionCloudLastQueuedAtRef = useRef(0);
  const latestCurrentSessionRef = useRef<QuizSession | null>(null);
  const incrementalPracticePrefetchRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [loadIssue, setLoadIssue] = useState("");
  const [fastAnswerMode, setFastAnswerMode] = useState(false);
  const [keyboardNavigationEnabled, setKeyboardNavigationEnabled] = useState(false);
  const [simulationOptionEliminationEnabled, setSimulationOptionEliminationEnabled] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<OptionKey | undefined>();
  const [confidence, setConfidence] = useState<ConfidenceLevel>(4);
  const [confidenceExpanded, setConfidenceExpanded] = useState(false);
  const confidenceRef = useRef<ConfidenceLevel>(4);
  const restoredQuestionUiKeyRef = useRef<string | null>(null);
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

  function takeDeferredCurrentSessionSave() {
    if (deferredCurrentSessionSaveRef.current !== null) {
      window.clearTimeout(deferredCurrentSessionSaveRef.current);
      deferredCurrentSessionSaveRef.current = null;
    }

    const pendingSession = deferredCurrentSessionRef.current;
    deferredCurrentSessionRef.current = null;
    return pendingSession;
  }

  function flushDeferredCurrentSessionSave() {
    const pendingSession = takeDeferredCurrentSessionSave();
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

  function clearScheduledCurrentSessionCloudSync() {
    if (currentSessionCloudSyncTimerRef.current !== null) {
      window.clearTimeout(currentSessionCloudSyncTimerRef.current);
      currentSessionCloudSyncTimerRef.current = null;
    }
  }

  function scheduleCurrentSessionCloudSync(nextSession: QuizSession) {
    latestCurrentSessionRef.current = nextSession;
    if (!authSession?.user?.id || nextSession.completedAt) return;

    currentSessionCloudPendingRef.current = nextSession;
    if (currentSessionCloudSyncTimerRef.current !== null) return;

    const now = Date.now();
    const lastQueuedAt = currentSessionCloudLastQueuedAtRef.current;
    const delay =
      lastQueuedAt === 0
        ? CURRENT_SESSION_CLOUD_IDLE_DELAY_MS
        : Math.max(
            CURRENT_SESSION_CLOUD_IDLE_DELAY_MS,
            CURRENT_SESSION_CLOUD_CHECKPOINT_MS - (now - lastQueuedAt)
          );

    currentSessionCloudSyncTimerRef.current = window.setTimeout(() => {
      currentSessionCloudSyncTimerRef.current = null;
      const pendingSession = currentSessionCloudPendingRef.current;
      currentSessionCloudPendingRef.current = null;
      if (!pendingSession || pendingSession.completedAt) return;

      currentSessionCloudLastQueuedAtRef.current = Date.now();
      void pushCurrentSessionToSupabase(pendingSession);
    }, delay);
  }

  function flushCurrentSessionCloudSync(forceSession?: QuizSession | null) {
    clearScheduledCurrentSessionCloudSync();
    const pendingSession =
      forceSession ?? currentSessionCloudPendingRef.current ?? latestCurrentSessionRef.current;
    currentSessionCloudPendingRef.current = null;
    if (!authSession?.user?.id || !pendingSession || pendingSession.completedAt) return;

    currentSessionCloudLastQueuedAtRef.current = Date.now();
    void pushCurrentSessionToSupabase(pendingSession, { force: true });
  }

  useEffect(() => {
    setFastAnswerMode(loadPracticeFastAnswerMode(false));
    setKeyboardNavigationEnabled(loadKeyboardQuestionNavigation(false));
    setSimulationOptionEliminationEnabled(loadSimulationOptionElimination(false));

    function handleFastAnswerModeChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      setFastAnswerMode(Boolean(customEvent.detail));
    }

    function handleKeyboardNavigationChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      setKeyboardNavigationEnabled(Boolean(customEvent.detail));
    }

    function handleSimulationOptionEliminationChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      setSimulationOptionEliminationEnabled(Boolean(customEvent.detail));
    }

    window.addEventListener("practice-fast-answer-mode-change", handleFastAnswerModeChange);
    window.addEventListener("keyboard-question-navigation-change", handleKeyboardNavigationChange);
    window.addEventListener("simulation-option-elimination-change", handleSimulationOptionEliminationChange);

    return () => {
      window.removeEventListener("practice-fast-answer-mode-change", handleFastAnswerModeChange);
      window.removeEventListener("keyboard-question-navigation-change", handleKeyboardNavigationChange);
      window.removeEventListener("simulation-option-elimination-change", handleSimulationOptionEliminationChange);
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
    latestCurrentSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!authSession?.user?.id || !mounted) return;

    const flushPendingCloudSession = () => {
      flushCurrentSessionCloudSync();
    };
    const flushCloudWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentSessionCloudSync();
      }
    };

    window.addEventListener("pagehide", flushPendingCloudSession);
    document.addEventListener("visibilitychange", flushCloudWhenHidden);

    return () => {
      window.removeEventListener("pagehide", flushPendingCloudSession);
      document.removeEventListener("visibilitychange", flushCloudWhenHidden);
      flushCurrentSessionCloudSync();
    };
  }, [authSession?.user?.id, mounted]);

  useEffect(() => {
    if (initializedSessionRef.current) return;
    if (authLoading) return;
    if (authSession?.user?.id && syncStatus !== "ready" && syncStatus !== "error") return;

    initializedSessionRef.current = true;
    let cancelled = false;

    async function initializeSession() {
      try {
        setLoadIssue("");
        const loadedOverrides = await withTimeoutFallback(
          loadConfirmedQuestionClassificationOverrides(),
          QUIZ_CLASSIFICATION_OVERRIDE_TIMEOUT_MS,
          {} as Record<string, QuestionClassificationOverride>
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
        const shouldForceNewSession = params?.get("new") === "1";
        const completedSessions = loadCompletedHistorySessionsForUser(authSession?.user?.id);
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
        const canReuseExisting = canReuseCurrentSession(existing, loadedOverrides);
        const shouldReuseExisting =
          !shouldForceNewSession &&
          canReuseExisting &&
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

        if (!nextSession || (nextSession.questionOrder?.length ?? 0) === 0) {
          clearCurrentSession();
          setSession(null);
          setLoadIssue("這組篩選暫時沒有抓到題目，請回到選科目頁重新選一次。");
          resetQuestionUI();
          return;
        }

        if (!shouldReuseExisting) {
          clearCurrentSession();
          if (existing && !shouldForceNewSession) {
            setLoadIssue("這台電腦保留的舊作答狀態讀不到題目，已重新開一份。");
          }
        }

        if (cancelled) return;

        latestCurrentSessionRef.current = nextSession;
        setSession(nextSession);
        saveCurrentSession(nextSession);
        scheduleCurrentSessionCloudSync(nextSession);

        const currentQuestionId = nextSession.questionOrder?.[nextSession.currentQuestionIndex ?? 0];
        const currentAttempt =
          nextSession.attempts.find((attempt) => attempt.questionId === currentQuestionId) ?? null;

        if (shouldReuseExisting && currentAttempt) {
          const shouldRevealCurrentAttempt =
            nextSession.isReviewingAnswer && shouldRevealAttemptFeedback(nextSession);
          setSubmittedAttempt(shouldRevealCurrentAttempt ? currentAttempt : null);
          setSelectedAnswer(currentAttempt?.selectedAnswer);
          const nextConfidence = currentAttempt?.confidence ?? 4;
          confidenceRef.current = nextConfidence;
          setConfidence(nextConfidence);
          setConfidenceExpanded(nextConfidence <= 3);
          setErrorType(currentAttempt?.errorType);
        } else {
          resetQuestionUI();
        }
      } catch {
        initializedSessionRef.current = false;
        if (cancelled) return;
        clearCurrentSession();
        setSession(null);
        setLoadIssue("題目載入時遇到本機狀態錯誤，請重新開始測驗。");
        resetQuestionUI();
      } finally {
        if (!cancelled) {
          setMounted(true);
        }
      }
    }

    void initializeSession();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authSession?.user?.id, syncStatus, syncVersion]);

  useEffect(() => {
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverrides())
    );
  }, []);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (!session?.questionOrder?.length) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(session.questionOrder);
        if (Object.keys(sharedOverrides).length > 0) {
          saveQuestionExplanationOverrides(sharedOverrides);
          setExplanationOverrides((current) =>
            mergeQuestionExplanationOverrides(current, sharedOverrides)
          );
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
      session
        ? getQuestionByOrder(
            session,
            allQuestionFallbackMap,
            classificationOverrides,
            explanationOverrides
          )
        : [],
    [
      allQuestionFallbackMap,
      classificationOverrides,
      explanationOverrides,
      session?.generatedQuestions,
      session?.id,
      session?.questionOrder,
      session?.settings
    ]
  );
  const currentIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = questionSet[currentIndex];
  useEffect(() => {
    if (!session || questionSet.length === 0) return;
    const safeIndex = Math.min(
      Math.max(session.currentQuestionIndex ?? 0, 0),
      questionSet.length - 1
    );
    if (safeIndex === session.currentQuestionIndex) return;

    const nextSession = {
      ...session,
      currentQuestionIndex: safeIndex,
      isReviewingAnswer: false
    };
    setSubmittedAttempt(null);
    setSelectedAnswer(undefined);
    setErrorType(undefined);
    latestCurrentSessionRef.current = nextSession;
    setSession(nextSession);
    saveCurrentSession(nextSession);
    scheduleCurrentSessionCloudSync(nextSession);
  }, [questionSet.length, session?.currentQuestionIndex, session?.id]);

  const targetCount =
    session?.settings?.mode === "simulation"
      ? questionSet.length
      : Math.max(questionSet.length, session?.settings?.questionCount ?? questionSet.length);
  const progress =
    targetCount === 0 ? 0 : ((currentIndex + (submittedAttempt ? 1 : 0)) / targetCount) * 100;
  const answeredCount = session?.attempts.length ?? 0;
  const correctCount = session?.attempts.filter((attempt) => attempt.isCorrect).length ?? 0;
  const attemptsByQuestionId = useMemo(
    () => new Map((session?.attempts ?? []).map((attempt) => [attempt.questionId, attempt] as const)),
    [session?.attempts]
  );
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
    const restoreKey = `${session.id}:${currentQuestion.id}`;
    if (restoredQuestionUiKeyRef.current === restoreKey) return;
    restoredQuestionUiKeyRef.current = restoreKey;

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

  useEffect(() => {
    if (
      !session ||
      session.completedAt ||
      !isIncrementalPracticeSettings(session.settings)
    ) {
      return;
    }

    const loadedQuestionCount = session.questionOrder?.length ?? 0;
    const totalTargetCount = session.settings?.questionCount ?? loadedQuestionCount;
    if (loadedQuestionCount >= totalTargetCount) return;

    const bufferedQuestionsAfterCurrent = loadedQuestionCount - currentIndex - 1;
    if (bufferedQuestionsAfterCurrent <= FREE_PRACTICE_PREFETCH_THRESHOLD) {
      queueIncrementalPracticePrefetch();
    }
  }, [
    classificationOverrides,
    currentIndex,
    session?.completedAt,
    session?.id,
    session?.questionOrder?.length,
    session?.settings
  ]);

  useEffect(() => {
    if (!keyboardNavigationEnabled || !session || session.completedAt || !mounted) return;

    function handleKeyboardNavigation(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isSubmittingAnswer) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (shouldIgnoreKeyboardNavigationTarget(event.target)) return;
      const activeSession = session;
      if (!activeSession || activeSession.completedAt) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (activeSession.settings?.mode === "simulation") {
          if (currentIndex >= targetCount - 1) return;
          navigateSimulationToQuestion(currentIndex + 1);
          return;
        }

        if (!submittedAttempt || currentIndex >= targetCount - 1) return;
        handleNext();
        return;
      }

      event.preventDefault();
      if (activeSession.settings?.mode === "simulation") {
        if (currentIndex <= 0) return;
        navigateSimulationToQuestion(currentIndex - 1);
        return;
      }

      navigatePracticeToPreviousQuestion();
    }

    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation);
    };
  }, [
    currentIndex,
    errorType,
    isSubmittingAnswer,
    keyboardNavigationEnabled,
    mounted,
    selectedAnswer,
    session,
    submittedAttempt,
    targetCount
  ]);

  function persistSession(
    nextSession: QuizSession,
    options: { deferLocalSave?: boolean } = {}
  ) {
    latestCurrentSessionRef.current = nextSession;
    setSession(nextSession);
    scheduleCurrentSessionCloudSync(nextSession);
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

  function getEliminatedOptionsForQuestion(questionId: string, sourceSession: QuizSession | null = session) {
    const fromMap = sourceSession?.optionEliminationMap?.[questionId];
    if (fromMap) return normalizeEliminatedOptions(fromMap);

    const fromAttempt = sourceSession?.attempts.find((attempt) => attempt.questionId === questionId)?.eliminatedOptions;
    return normalizeEliminatedOptions(fromAttempt);
  }

  function setQuestionEliminatedOptions(
    baseSession: QuizSession,
    questionId: string,
    options: OptionKey[]
  ) {
    const normalizedOptions = normalizeEliminatedOptions(options);
    const nextOptionEliminationMap = {
      ...(baseSession.optionEliminationMap ?? {})
    };

    if (normalizedOptions.length > 0) {
      nextOptionEliminationMap[questionId] = normalizedOptions;
    } else {
      delete nextOptionEliminationMap[questionId];
    }

    return {
      ...baseSession,
      optionEliminationMap:
        Object.keys(nextOptionEliminationMap).length > 0 ? nextOptionEliminationMap : undefined,
      attempts: baseSession.attempts.map((attempt) =>
        attempt.questionId === questionId
          ? {
              ...attempt,
              eliminatedOptions: normalizedOptions.length > 0 ? normalizedOptions : undefined
            }
          : attempt
      )
    } satisfies QuizSession;
  }

  function getSessionWithCurrentDraft(baseSession: QuizSession) {
    if (!currentQuestion) return baseSession;

    const eliminatedOptions = getEliminatedOptionsForQuestion(currentQuestion.id, baseSession);
    let nextSession = setQuestionEliminatedOptions(
      baseSession,
      currentQuestion.id,
      eliminatedOptions
    );
    const existingAttempt =
      nextSession.attempts.find((attempt) => attempt.questionId === currentQuestion.id) ?? null;
    const attemptToPersist =
      submittedAttempt ??
      (selectedAnswer
        ? ({
            ...(existingAttempt ?? {}),
            questionId: currentQuestion.id,
            selectedAnswer,
            correctAnswer: currentQuestion.answer,
            isCorrect: evaluateAttempt(currentQuestion, selectedAnswer),
            confidence: confidenceRef.current,
            errorType: errorType ?? existingAttempt?.errorType,
            answeredAt: existingAttempt?.answeredAt ?? new Date().toISOString(),
            eliminatedOptions: eliminatedOptions.length > 0 ? eliminatedOptions : undefined
          } satisfies Attempt)
        : null);

    if (!attemptToPersist) return nextSession;

    const normalizedAttempt: Attempt = {
      ...attemptToPersist,
      confidence: confidenceRef.current,
      errorType: errorType ?? attemptToPersist.errorType,
      eliminatedOptions: eliminatedOptions.length > 0 ? eliminatedOptions : undefined
    };
    const hasAttempt = nextSession.attempts.some(
      (attempt) => attempt.questionId === normalizedAttempt.questionId
    );

    nextSession = {
      ...nextSession,
      attempts: hasAttempt
        ? nextSession.attempts.map((attempt) =>
            attempt.questionId === normalizedAttempt.questionId ? normalizedAttempt : attempt
          )
        : [...nextSession.attempts, normalizedAttempt]
    };

    return nextSession;
  }

  function scrollQuestionIntoView() {
    window.requestAnimationFrame(() => {
      const target =
        typeof window !== "undefined" && window.innerWidth >= 1280
          ? contentTopRef.current
          : questionTopRef.current;

      target?.scrollIntoView({
        behavior: getQuestionScrollBehavior(),
        block: "start"
      });
    });
  }

  function restoreQuestionUiFromAttempt(
    attempt: Attempt | null,
    options: { revealFeedback?: boolean } = {}
  ) {
    const shouldReveal = options.revealFeedback ?? true;
    setSubmittedAttempt(shouldReveal ? attempt : null);
    setSelectedAnswer(attempt?.selectedAnswer);
    const nextConfidence = attempt?.confidence ?? 4;
    confidenceRef.current = nextConfidence;
    setConfidence(nextConfidence);
    setConfidenceExpanded(nextConfidence <= 3);
    setErrorType(attempt?.errorType);
  }

  function navigateSimulationToQuestion(targetIndex: number) {
    if (!session || targetIndex < 0 || targetIndex >= questionSet.length || targetIndex === currentIndex) {
      return;
    }

    const nextSession: QuizSession = {
      ...getSessionWithCurrentDraft(session),
      currentQuestionIndex: targetIndex,
      isReviewingAnswer: false
    };
    persistSession(nextSession, { deferLocalSave: true });
    const targetQuestionId = nextSession.questionOrder?.[targetIndex];
    const targetAttempt =
      nextSession.attempts.find((attempt) => attempt.questionId === targetQuestionId) ?? null;
    restoreQuestionUiFromAttempt(targetAttempt, {
      revealFeedback: shouldRevealAttemptFeedback(nextSession)
    });
    scrollQuestionIntoView();
  }

  function navigatePracticeToPreviousQuestion() {
    if (!session || currentIndex <= 0 || !currentQuestion) return;

    const targetIndex = currentIndex - 1;
    const targetQuestionId = session.questionOrder?.[targetIndex];
    const targetAttempt = session.attempts.find((attempt) => attempt.questionId === targetQuestionId) ?? null;
    if (!targetAttempt) return;

    const nextSession: QuizSession = {
      ...getSessionWithCurrentDraft(session),
      currentQuestionIndex: targetIndex,
      isReviewingAnswer: true
    };
    persistSession(nextSession, { deferLocalSave: true });
    restoreQuestionUiFromAttempt(targetAttempt);
    scrollQuestionIntoView();
  }

  function buildNextIncrementalPracticeSession(baseSession: QuizSession) {
    const settings = baseSession.settings;
    if (!isIncrementalPracticeSettings(settings)) return null;

    const loadedQuestionIds = new Set(baseSession.questionOrder ?? []);
    const totalTargetCount = settings.questionCount ?? loadedQuestionIds.size;
    if (loadedQuestionIds.size >= totalTargetCount) return null;

    const fallbackQuestions =
      (settings.subjectFilters?.length ?? 0) > 0
        ? getQuestionBankBySubjects(settings.subjectFilters ?? [], classificationOverrides)
        : getQuestionBankBySubjectFilter(settings.subjectFilter ?? "解剖學", classificationOverrides);
    const sourcePool = selectLocalQuestionSet(settings, fallbackQuestions, classificationOverrides);
    const remainingPool = sourcePool.filter((question) => !loadedQuestionIds.has(question.id));
    if (remainingPool.length === 0) return null;

    const remainingTargetCount = Math.max(0, totalTargetCount - loadedQuestionIds.size);
    const nextBatchSize = Math.min(
      FREE_PRACTICE_BATCH_SIZE,
      remainingTargetCount,
      remainingPool.length
    );
    if (nextBatchSize <= 0) return null;

    const completedHistorySessions = loadCompletedHistorySessionsForUser(authSession?.user?.id);
    const batchQuestionIds = createQuestionOrder(
      remainingPool,
      [...completedHistorySessions, baseSession],
      {
        ...settings,
        questionCount: nextBatchSize
      }
    ).filter((id) => !loadedQuestionIds.has(id));

    if (batchQuestionIds.length === 0) return null;

    const sourceQuestionMap = new Map(
      [...sourcePool, ...Array.from(allQuestionFallbackMap.values())].map(
        (question) => [question.id, question] as const
      )
    );
    const batchQuestions = batchQuestionIds
      .map((id) => sourceQuestionMap.get(id))
      .filter((question): question is Question => Boolean(question));
    const mergedGeneratedQuestions = Array.from(
      new Map(
        [...(baseSession.generatedQuestions ?? []), ...batchQuestions].map((question) => [
          question.id,
          question
        ])
      ).values()
    );

    return {
      ...baseSession,
      questionOrder: [...(baseSession.questionOrder ?? []), ...batchQuestionIds],
      generatedQuestions: mergedGeneratedQuestions
    } satisfies QuizSession;
  }

  function queueIncrementalPracticePrefetch() {
    if (incrementalPracticePrefetchRef.current) return;
    incrementalPracticePrefetchRef.current = true;

    window.setTimeout(() => {
      try {
        setSession((current) => {
          if (!current || current.completedAt) return current;
          const nextSession = buildNextIncrementalPracticeSession(current);
          if (!nextSession || nextSession.questionOrder?.length === current.questionOrder?.length) {
            return current;
          }

          saveCurrentSession(nextSession);
          scheduleCurrentSessionCloudSync(nextSession);
          return nextSession;
        });
      } finally {
        incrementalPracticePrefetchRef.current = false;
      }
    }, 0);
  }

  function finalizeCompletedSession(completedSession: QuizSession) {
    takeDeferredCurrentSessionSave();
    clearScheduledCurrentSessionCloudSync();
    currentSessionCloudPendingRef.current = null;
    latestCurrentSessionRef.current = completedSession;
    const completedKey = completedSession.id.replace(/^user-[^:]+:/, "");
    if (completedSessionIdsRef.current.has(completedKey)) {
      return false;
    }
    completedSessionIdsRef.current.add(completedKey);
    setSession(completedSession);
    saveCurrentSession(completedSession);
    const saved = saveCompletedSession(completedSession);
    if (authSession?.user?.id) {
      mergeCompletedQuestionHistoryFromSessionsForUser(authSession.user.id, [completedSession]);
      queuePendingCompletedSessionUploadForUser(authSession.user.id, [completedSession]);
    }
    if (saved !== false) {
      clearMatchingCurrentSessions(completedSession.id, [authSession?.user?.id ?? ""]);
    }
    return saved !== false;
  }

  async function completeSessionAndNavigate(completedSession: QuizSession) {
    finalizeCompletedSession(completedSession);
    try {
      await pushCompletedSessionToSupabase(completedSession);
    } catch (error) {
      console.error("Completed session cloud handoff skipped; pending queue kept local copy:", error);
    }
    void pushQuestionStatsSnapshotToSupabase(completedSession);
    syncCompletedCustomPaper(completedSession);
    router.push(buildResultsHref(completedSession));
  }

  function getSessionReadyForCompletion(baseSession: QuizSession) {
    const pendingSession =
      deferredCurrentSessionRef.current?.id === baseSession.id
        ? deferredCurrentSessionRef.current
        : baseSession;
    const sessionWithDraft = getSessionWithCurrentDraft(pendingSession);

    if (!submittedAttempt) return sessionWithDraft;

    const currentEliminatedOptions = currentQuestion
      ? getEliminatedOptionsForQuestion(currentQuestion.id, sessionWithDraft)
      : [];
    const latestAttempt: Attempt = {
      ...submittedAttempt,
      confidence: confidenceRef.current,
      errorType: errorType ?? submittedAttempt.errorType,
      eliminatedOptions:
        currentEliminatedOptions.length > 0
          ? currentEliminatedOptions
          : submittedAttempt.eliminatedOptions
    };
    const hasAttempt = sessionWithDraft.attempts.some(
      (attempt) => attempt.questionId === latestAttempt.questionId
    );
    const attempts = hasAttempt
      ? sessionWithDraft.attempts.map((attempt) =>
          attempt.questionId === latestAttempt.questionId ? latestAttempt : attempt
        )
      : [...sessionWithDraft.attempts, latestAttempt];

    return {
      ...sessionWithDraft,
      attempts
    } satisfies QuizSession;
  }

  function handleSelectConfidence(value: ConfidenceLevel) {
    confidenceRef.current = value;
    setConfidence(value);
    setConfidenceExpanded(value <= 3);

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
    const eliminatedOptions = getEliminatedOptionsForQuestion(currentQuestion.id);
    const effectiveFeedbackMode = getEffectiveFeedbackMode(session.settings);

    const attempt: Attempt = {
      questionId: currentQuestion.id,
      selectedAnswer: answerToSubmit,
      correctAnswer: currentQuestion.answer,
      isCorrect: evaluateAttempt(currentQuestion, answerToSubmit),
      confidence: confidenceRef.current,
      eliminatedOptions: eliminatedOptions.length > 0 ? eliminatedOptions : undefined,
      answeredAt: new Date().toISOString()
    };

    const nextSessionBase: QuizSession = {
      ...setQuestionEliminatedOptions(
        session,
        currentQuestion.id,
        eliminatedOptions
      ),
      attempts: [...session.attempts.filter((item) => item.questionId !== currentQuestion.id), attempt],
      isReviewingAnswer: effectiveFeedbackMode === "none" ? false : true
    };

    if (session.settings?.mode === "simulation" && effectiveFeedbackMode === "none") {
      const isLast = currentIndex >= targetCount - 1;

      if (isLast) {
        const completedSession: QuizSession = {
          ...nextSessionBase,
          completedAt: new Date().toISOString(),
          isReviewingAnswer: false
        };
        void completeSessionAndNavigate(completedSession);
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
          behavior: getQuestionScrollBehavior(),
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

  function handleToggleEliminatedOption(value: OptionKey) {
    if (
      !session ||
      !currentQuestion ||
      session.settings?.mode !== "simulation" ||
      !simulationOptionEliminationEnabled ||
      isSubmittingAnswer
    ) {
      return;
    }

    const currentOptions = getEliminatedOptionsForQuestion(currentQuestion.id, session);
    const nextOptions = currentOptions.includes(value)
      ? currentOptions.filter((option) => option !== value)
      : [...currentOptions, value];
    const nextSession = setQuestionEliminatedOptions(
      session,
      currentQuestion.id,
      nextOptions
    );
    persistSession(nextSession, { deferLocalSave: true });
    if (submittedAttempt) {
      setSubmittedAttempt({
        ...submittedAttempt,
        eliminatedOptions: nextOptions.length > 0 ? normalizeEliminatedOptions(nextOptions) : undefined
      });
    }
  }

  function handleBlindSimulationPrevious() {
    if (!session || !isBlindSimulation || currentIndex === 0) return;

    const previousSession: QuizSession = {
      ...getSessionWithCurrentDraft(session),
      currentQuestionIndex: currentIndex - 1,
      isReviewingAnswer: false
    };
    persistSession(previousSession, { deferLocalSave: true });
    const previousQuestionId = previousSession.questionOrder?.[currentIndex - 1];
    const previousAttempt =
      previousSession.attempts.find((attempt) => attempt.questionId === previousQuestionId) ?? null;
    restoreQuestionUiFromAttempt(previousAttempt, { revealFeedback: false });
    scrollQuestionIntoView();
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
      ...getSessionWithCurrentDraft(session),
      currentQuestionIndex: targetIndex,
      isReviewingAnswer: false
    };
    persistSession(jumpedSession, { deferLocalSave: true });
    const targetQuestionId = jumpedSession.questionOrder?.[targetIndex];
    const targetAttempt =
      jumpedSession.attempts.find((attempt) => attempt.questionId === targetQuestionId) ?? null;
    restoreQuestionUiFromAttempt(targetAttempt, {
      revealFeedback: shouldRevealAttemptFeedback(jumpedSession)
    });
    scrollQuestionIntoView();
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

      if (!response.ok || !payload.ok || !payload.explanation) {
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

      clearQuestionExplanationBackgroundCache(question.id);
      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) =>
        mergeQuestionExplanationOverrides(current, { [question.id]: override })
      );
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
      const completionSession = getSessionReadyForCompletion(session);
      const completedSession: QuizSession = {
        ...completionSession,
        completedAt: new Date().toISOString(),
        isReviewingAnswer: false
      };
      void completeSessionAndNavigate(completedSession);
      return;
    }

    const nextSession: QuizSession = {
      ...getSessionWithCurrentDraft(session),
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
        behavior: getQuestionScrollBehavior(),
        block: "start"
      });
    });
  }

  function handleEndAfterReview() {
    if (!session) return;

    const completionSession = getSessionReadyForCompletion(session);
    const completedSession: QuizSession = {
      ...completionSession,
      completedAt: new Date().toISOString(),
      isReviewingAnswer: false
    };
    void completeSessionAndNavigate(completedSession);
  }

  if (!mounted) {
    return (
      <main className="shell">
        <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6">
          載入中...
        </div>
      </main>
    );
  }

  if (!session || !currentQuestion) {
    const message =
      loadIssue ||
      "這台裝置保留的作答狀態暫時讀不到題目，回到選科目頁重新開一份就可以。";

    return (
      <main className="shell">
        <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-700">
            QUIZ RECOVERY
          </p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">題目載入卡住了</h1>
          <p className="mt-3 max-w-2xl text-base font-bold leading-8 text-slate-600">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/start"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-card transition hover:-translate-y-0.5"
            >
              回選科目
            </Link>
            <Link
              href="/quiz?new=1&preset=med1"
              className="rounded-full bg-emerald-100 px-5 py-3 text-sm font-black text-emerald-950 ring-1 ring-emerald-200 transition hover:-translate-y-0.5"
            >
              先開醫學一
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const confidenceTrackingEnabled =
    session.settings?.mode !== "simulation" || (session.settings?.enableConfidenceCalibration ?? true);
  const confidenceCalibrationEnabled =
    session.settings?.mode === "simulation" && (session.settings?.enableConfidenceCalibration ?? true);
  const flag =
    confidenceCalibrationEnabled && submittedAttempt && submittedAttempt.isCorrect && submittedAttempt.confidence <= 2
      ? { text: "猜對風險", style: "bg-amber-100 text-amber-900" }
      : confidenceCalibrationEnabled && submittedAttempt && !submittedAttempt.isCorrect && submittedAttempt.confidence >= 4
        ? { text: "錯誤自信", style: "bg-rose-100 text-rose-900" }
        : confidenceCalibrationEnabled && submittedAttempt && !submittedAttempt.isCorrect && submittedAttempt.confidence <= 2
          ? { text: "優先補弱", style: "bg-orange-100 text-orange-900" }
          : confidenceCalibrationEnabled && submittedAttempt && submittedAttempt.confidence <= 3
            ? { text: "低信心", style: "bg-yellow-100 text-yellow-900" }
          : null;
  const difficultyBadge = submittedAttempt ? getDifficultyBadge(currentQuestion) : null;
  const feedbackMode = getEffectiveFeedbackMode(session.settings);
  const isBlindSimulation =
    session.settings?.mode === "simulation" && feedbackMode === "none";
  const shouldShowExplanation = feedbackMode === "full";
  const shouldShowCorrectAnswer = feedbackMode === "full" || feedbackMode === "answer_only";
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

      <div ref={contentTopRef} className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
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
            eliminatedOptions={getEliminatedOptionsForQuestion(currentQuestion.id)}
            showEliminationControls={
              session.settings?.mode === "simulation" && simulationOptionEliminationEnabled
            }
            eliminationDisabled={isSubmittingAnswer}
            onSelect={handleSelectAnswer}
            onToggleEliminatedOption={handleToggleEliminatedOption}
            showMetadata={session.settings?.mode !== "simulation"}
          />

          {!submittedAttempt ? (
            <>
              {confidenceTrackingEnabled ? (
                <ConfidenceSelector
                  key={`answer-${currentQuestion.id}`}
                  value={displayedConfidence}
                  expanded={confidenceExpanded || displayedConfidence <= 3}
                  onExpand={() => undefined}
                  onSelect={handleSelectConfidence}
                />
              ) : null}

              <div className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    已答題數 <span className="font-semibold">{answeredCount}</span>
                  </p>
                  {!isBlindSimulation ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      目前答對數 <span className="font-semibold">{correctCount}</span>
                    </p>
                  ) : null}
                  {confidenceTrackingEnabled ? (
                    <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      本輪平均信心 <span className="font-semibold">{averageConfidence}</span>
                    </p>
                  ) : null}
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
                      ? "送出中..."
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
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <SavedQuestionButton questionId={currentQuestion.id} source="quiz" />
                    <CopyQuestionPromptButton
                      question={currentQuestion}
                      selectedAnswer={submittedAttempt.selectedAnswer}
                      correctAnswer={submittedAttempt.correctAnswer}
                      eliminatedOptions={submittedAttempt.eliminatedOptions}
                    />
                  </div>
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
                      {shouldShowAiExplanationDetails ? (
                        <StructuredExplanationText text={currentQuestion.explanation} label="整題詳解" compact />
                      ) : null}
                      <QuestionExplanationTabs
                        question={currentQuestion}
                        className="mt-3"
                      />
                    </>
                  ) : null}
                  {confidenceTrackingEnabled ? (
                    <p>
                      本題信心：<span className="font-semibold">{getConfidenceLabel(submittedAttempt.confidence)}</span>
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
                      <QuestionReportButton
                        question={currentQuestion}
                        disabled={currentClassificationReportLoading}
                        classificationLoading={currentClassificationReportLoading}
                        classificationMessage={currentClassificationReportMessage}
                        onReportClassification={() => void handleReportClassification(currentQuestion)}
                      />
                    </div>
                    {currentExplanationError ? (
                      <p className="text-sm font-medium text-rose-700">{currentExplanationError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {confidenceTrackingEnabled ? (
                <ConfidenceSelector
                  key={`review-${currentQuestion.id}`}
                  value={displayedConfidence}
                  expanded={confidenceExpanded || displayedConfidence <= 3}
                  onExpand={() => undefined}
                  onSelect={handleSelectConfidence}
                />
              ) : null}
              {!submittedAttempt.isCorrect && shouldShowExplanation ? (
                <ErrorTypeSelector value={errorType} onSelect={handleErrorTypeSelect} />
              ) : null}

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-12 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  {currentIndex === targetCount - 1 ? "查看結果" : "下一題"}
                </button>
                {((session.settings?.mode === "random" && session.settings?.stopAfterReview) ||
                  session.settings?.mode === "custom_paper") &&
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
              ) : null}
            </div>
          </div>
        </div>

        <aside className="simulation-status-sidebar h-fit min-w-0 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5 xl:sticky xl:top-6">
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
                {confidenceTrackingEnabled ? (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    目前信心 <span className="font-semibold">{getConfidenceLabel(displayedConfidence)}</span>
                  </p>
                ) : null}
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  已答題數 <span className="font-semibold">{answeredCount}</span>
                </p>
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  本輪模式 <span className="font-semibold">{getModeLabel(session.settings?.mode ?? "weakness")}</span>
                </p>
              </>
            )}
            {!isBlindSimulation ? (
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
                <SimulationQuestionNavigator
                  attemptsByQuestionId={attemptsByQuestionId}
                  currentIndex={currentIndex}
                  disabled={isSubmittingAnswer}
                  onJump={handleJumpToQuestion}
                  questions={questionSet}
                />
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {session.settings?.mode === "simulation" ? (
        <section className="mt-6 min-w-0 rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5 xl:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">題號選擇</p>
              <p className="mt-1 text-xs text-slate-500">點題號可以直接跳到那一題。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {currentIndex + 1} / {targetCount}
            </span>
          </div>
          <SimulationQuestionNavigator
            attemptsByQuestionId={attemptsByQuestionId}
            currentIndex={currentIndex}
            disabled={isSubmittingAnswer}
            onJump={handleJumpToQuestion}
            questions={questionSet}
            variant="bottom"
          />
        </section>
      ) : null}
    </main>
  );
}
