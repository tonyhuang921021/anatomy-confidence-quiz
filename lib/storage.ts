import {
  ConfidenceLevel,
  ErrorType,
  OptionKey,
  Question,
  QuestionExplanationOverride,
  QuizSession,
  QuizSettings
} from "@/types/quiz";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";
const QUESTION_EXPLANATION_OVERRIDES_KEY = "anatomy-confidence-question-explanation-overrides";
const PEAK_CHALLENGE_PRELOAD_KEY = "anatomy-confidence-peak-challenge-preload";
const HOME_TONE_MODE_KEY = "anatomy-confidence-home-tone-mode";
const THEME_MODE_KEY = "anatomy-confidence-theme-mode";
const PRACTICE_YEAR_RANGE_KEY = "anatomy-confidence-practice-year-range";
const PRACTICE_QUESTION_COUNT_KEY = "anatomy-confidence-practice-question-count";
const PRACTICE_STOP_AFTER_REVIEW_KEY = "anatomy-confidence-practice-stop-after-review";
const PRACTICE_FAST_ANSWER_MODE_KEY = "anatomy-confidence-practice-fast-answer-mode";
const ACTIVE_USER_KEY = "anatomy-confidence-active-user-id";
const GUEST_USER_ID = "guest";
const completedSessionsMemoryCache = new Map<string, QuizSession[]>();

const isBrowser = () => typeof window !== "undefined";

function safeLocalStorageGetItem(key: string) {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSetItem(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Ignore storage write failures on restrictive browsers/private mode.
    return false;
  }
}

function safeLocalStorageRemoveItem(key: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    // Ignore storage delete failures on restrictive browsers/private mode.
    return false;
  }
}

function safeSessionStorageGetItem(key: string) {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSetItem(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeSessionStorageRemoveItem(key: string) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getScopedKey(baseKey: string) {
  if (!isBrowser()) return `${baseKey}:${GUEST_USER_ID}`;
  const userId = safeLocalStorageGetItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
  return `${baseKey}:${userId}`;
}

function getScopedKeyForUser(baseKey: string, userId: string) {
  return `${baseKey}:${userId || GUEST_USER_ID}`;
}

export function getCanonicalSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

function sessionDedupeKey(session: QuizSession) {
  return getCanonicalSessionId(session.id);
}

function getLegacyOrScopedRaw(baseKey: string) {
  if (!isBrowser()) return null;
  const scopedKey = getScopedKey(baseKey);
  const scopedValue = safeLocalStorageGetItem(scopedKey);
  if (scopedValue) return scopedValue;

  const legacyValue = safeLocalStorageGetItem(baseKey);
  if (legacyValue) {
    safeLocalStorageSetItem(scopedKey, legacyValue);
    return legacyValue;
  }

  return null;
}

function normalizeErrorType(errorType?: string): ErrorType | undefined {
  switch (errorType) {
    case "不懂":
      return "完全沒印象";
    case "看錯題幹":
    case "粗心":
      return "看錯題目 / 粗心";
    case "背錯":
    case "兩選項猶豫":
    case "忘記了":
    case "沒學過":
    case "完全沒印象":
    case "看錯題目 / 粗心":
      return errorType;
    default:
      return undefined;
  }
}

function normalizeConfidenceLevel(value: unknown): ConfidenceLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 4;
}

function isOptionKey(value: unknown): value is OptionKey {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function normalizeStoredQuestion(question: unknown): Question | null {
  if (!question || typeof question !== "object") return null;

  const raw = question as Partial<Question> & {
    options?: Partial<Record<OptionKey, unknown>>;
    acceptedAnswers?: unknown[];
  };

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
  const chapter = typeof raw.chapter === "string" ? raw.chapter.trim() : "";
  const section = typeof raw.section === "string" ? raw.section.trim() : "";
  const stem = typeof raw.stem === "string" ? raw.stem.trim() : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";
  const testedConcept = typeof raw.testedConcept === "string" ? raw.testedConcept.trim() : "";
  const answer = typeof raw.answer === "string" ? raw.answer.trim().toUpperCase() : "";
  const options = (raw.options ?? {}) as Record<string, unknown>;
  const optionA = typeof options.A === "string" ? options.A.trim() : "";
  const optionB = typeof options.B === "string" ? options.B.trim() : "";
  const optionC = typeof options.C === "string" ? options.C.trim() : "";
  const optionD = typeof options.D === "string" ? options.D.trim() : "";
  const optionE = typeof options.E === "string" && options.E.trim() ? options.E.trim() : undefined;

  if (
    !id ||
    !subject ||
    !chapter ||
    !section ||
    !stem ||
    !explanation ||
    !testedConcept ||
    !isOptionKey(answer) ||
    !optionA ||
    !optionB ||
    !optionC ||
    !optionD
  ) {
    return null;
  }

  const acceptedAnswers = Array.isArray(raw.acceptedAnswers)
    ? raw.acceptedAnswers
        .map((value) => String(value).trim().toUpperCase())
        .filter((value): value is OptionKey => isOptionKey(value))
    : undefined;

  return {
    ...raw,
    id,
    subject: subject as Question["subject"],
    chapter,
    section,
    stem,
    explanation,
    testedConcept,
    answer,
    options: {
      A: optionA,
      B: optionB,
      C: optionC,
      D: optionD,
      E: optionE
    },
    acceptedAnswers: acceptedAnswers && acceptedAnswers.length > 0 ? acceptedAnswers : undefined,
    answerCreditType:
      raw.answerCreditType === "all_credit"
        ? "all_credit"
        : raw.answerCreditType === "multiple_accepted" || raw.answerCreditType === "multiple_answers"
          ? "multiple_accepted"
          : "standard"
  };
}

function normalizeStoredAttempt(attempt: unknown) {
  if (!attempt || typeof attempt !== "object") return null;
  const raw = attempt as Partial<QuizSession["attempts"][number]>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  const selectedAnswer = typeof raw.selectedAnswer === "string" ? raw.selectedAnswer.trim().toUpperCase() : "";
  const correctAnswer = typeof raw.correctAnswer === "string" ? raw.correctAnswer.trim().toUpperCase() : "";
  const answeredAt = typeof raw.answeredAt === "string" && raw.answeredAt.trim()
    ? raw.answeredAt
    : new Date(0).toISOString();

  if (!questionId || !isOptionKey(selectedAnswer) || !isOptionKey(correctAnswer)) {
    return null;
  }

  return {
    questionId,
    selectedAnswer,
    correctAnswer,
    isCorrect: Boolean(raw.isCorrect),
    confidence: normalizeConfidenceLevel(raw.confidence),
    errorType: normalizeErrorType(raw.errorType),
    answeredAt
  };
}

function normalizeSession(session: QuizSession): QuizSession {
  const normalizedAttempts = Array.isArray(session.attempts)
    ? session.attempts
        .map(normalizeStoredAttempt)
        .filter((attempt): attempt is NonNullable<ReturnType<typeof normalizeStoredAttempt>> => Boolean(attempt))
    : [];

  return {
    ...session,
    subject: typeof session.subject === "string" && session.subject.trim()
      ? session.subject
      : "解剖學",
    startedAt:
      typeof session.startedAt === "string" && session.startedAt.trim()
        ? session.startedAt
        : new Date(0).toISOString(),
    completedAt:
      typeof session.completedAt === "string" && session.completedAt.trim()
        ? session.completedAt
        : undefined,
    questionOrder: Array.isArray(session.questionOrder)
      ? session.questionOrder.filter((questionId): questionId is string => typeof questionId === "string" && questionId.trim().length > 0)
      : [],
    generatedQuestions: (session.generatedQuestions ?? [])
      .map(normalizeStoredQuestion)
      .filter((question): question is Question => Boolean(question)),
    currentQuestionIndex:
      typeof session.currentQuestionIndex === "number" && session.currentQuestionIndex >= 0
        ? session.currentQuestionIndex
        : 0,
    attempts: normalizedAttempts
  };
}

export function normalizeSessions(sessions: QuizSession[]) {
  return sessions.map(normalizeSession);
}

function dedupeSessionsByCanonicalId(sessions: QuizSession[]) {
  const dedupedBySession = new Map<string, QuizSession>();
  for (const session of sessions) {
    const key = sessionDedupeKey(session);
    const current = dedupedBySession.get(key);
    if (!current) {
      dedupedBySession.set(key, session);
      continue;
    }

    const currentFreshness = current.completedAt ?? current.startedAt;
    const nextFreshness = session.completedAt ?? session.startedAt;
    if (
      nextFreshness > currentFreshness ||
      (nextFreshness === currentFreshness && session.attempts.length >= current.attempts.length)
    ) {
      dedupedBySession.set(key, session);
    }
  }
  return Array.from(dedupedBySession.values());
}

export function compactQuestionForStorage(question: Question): Question {
  return {
    id: question.id,
    subject: question.subject,
    chapter: question.chapter,
    section: question.section,
    stem: question.stem,
    explanation: question.explanation,
    testedConcept: question.testedConcept,
    answer: question.answer,
    options: question.options,
    acceptedAnswers: question.acceptedAnswers,
    answerCreditType: question.answerCreditType,
    source: question.source,
    sourceType: question.sourceType,
    sourceYear: question.sourceYear,
    sourceRound: question.sourceRound,
    paperCode: question.paperCode,
    examCode: question.examCode,
    originalQuestionNumber: question.originalQuestionNumber,
    memoryTip: question.memoryTip,
    optionAnalysis: question.optionAnalysis,
    difficulty: question.difficulty
  };
}

export function compactGeneratedQuestionsForStorage(session: QuizSession) {
  const generatedQuestions = (session.generatedQuestions ?? []).filter(Boolean);
  if (generatedQuestions.length === 0) return undefined;

  const retainedQuestions = generatedQuestions
    .filter((question) => question.sourceType !== "MOEX_PAST_EXAM")
    .map(compactQuestionForStorage);

  return retainedQuestions.length > 0 ? retainedQuestions : undefined;
}

export function compactSessionForStorage(session: QuizSession): QuizSession {
  return {
    ...session,
    generatedQuestions: compactGeneratedQuestionsForStorage(session)
  };
}

function normalizeQuestionExplanationOverride(
  override?: QuestionExplanationOverride | null
): QuestionExplanationOverride | null {
  if (!override) return null;

  const rawExplanation = override.explanation?.trim() ?? "";
  if (!rawExplanation) {
    return {
      ...override,
      optionAnalysis: override.optionAnalysis ?? {}
    };
  }

  const looksLikeJson =
    rawExplanation.startsWith("{") &&
    rawExplanation.includes("\"explanation\"") &&
    rawExplanation.includes("\"optionAnalysis\"");

  if (!looksLikeJson) {
    return {
      ...override,
      optionAnalysis: override.optionAnalysis ?? {}
    };
  }

  try {
    const parsed = JSON.parse(rawExplanation) as {
      explanation?: string;
      optionAnalysis?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
      memoryTip?: string;
    };

    return {
      ...override,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : rawExplanation,
      optionAnalysis:
        parsed.optionAnalysis && typeof parsed.optionAnalysis === "object"
          ? parsed.optionAnalysis
          : override.optionAnalysis ?? {},
      memoryTip:
        typeof parsed.memoryTip === "string"
          ? parsed.memoryTip
          : override.memoryTip
    };
  } catch {
    return {
      ...override,
      optionAnalysis: override.optionAnalysis ?? {}
    };
  }
}

export function setActiveStorageUser(userId?: string) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(ACTIVE_USER_KEY, userId || GUEST_USER_ID);
}

export function getActiveStorageUser() {
  if (!isBrowser()) return GUEST_USER_ID;
  return safeLocalStorageGetItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
}

export function saveCurrentSession(session: QuizSession) {
  if (!isBrowser()) return;
  const canonicalId = getCanonicalSessionId(session.id);
  const alreadyCompleted = loadCompletedSessions().some(
    (completedSession) =>
      Boolean(completedSession.completedAt) &&
      getCanonicalSessionId(completedSession.id) === canonicalId
  );

  if (!session.completedAt && alreadyCompleted) {
    clearMatchingCurrentSessions(session.id);
    return;
  }

  safeLocalStorageSetItem(getScopedKey(CURRENT_SESSION_KEY), JSON.stringify(compactSessionForStorage(session)));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: session }));
}

export function loadCurrentSession(): QuizSession | null {
  return loadCurrentSessionForUser(getActiveStorageUser());
}

export function loadCurrentSessionForUser(userId: string): QuizSession | null {
  if (!isBrowser()) return null;
  const scopedKey = getScopedKeyForUser(CURRENT_SESSION_KEY, userId);
  const raw =
    safeLocalStorageGetItem(scopedKey) ??
    (userId === GUEST_USER_ID ? getLegacyOrScopedRaw(CURRENT_SESSION_KEY) : null);
  if (!raw) return null;

  try {
    return normalizeSession(JSON.parse(raw) as QuizSession);
  } catch {
    return null;
  }
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  safeLocalStorageRemoveItem(getScopedKey(CURRENT_SESSION_KEY));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: null }));
}

export function clearCurrentSessionForUser(userId: string) {
  if (!isBrowser()) return;
  safeLocalStorageRemoveItem(getScopedKeyForUser(CURRENT_SESSION_KEY, userId));
}

export function clearMatchingCurrentSessions(sessionId: string, userIds: string[] = []) {
  if (!isBrowser()) return;
  const canonicalId = getCanonicalSessionId(sessionId);
  const scopedUserIds = Array.from(new Set([getActiveStorageUser(), GUEST_USER_ID, ...userIds].filter(Boolean)));

  for (const userId of scopedUserIds) {
    const current = loadCurrentSessionForUser(userId);
    if (current && getCanonicalSessionId(current.id) === canonicalId) {
      safeLocalStorageRemoveItem(getScopedKeyForUser(CURRENT_SESSION_KEY, userId));
    }
  }

  const legacyRaw = safeLocalStorageGetItem(CURRENT_SESSION_KEY);
  if (legacyRaw) {
    try {
      const legacySession = normalizeSession(JSON.parse(legacyRaw) as QuizSession);
      if (getCanonicalSessionId(legacySession.id) === canonicalId) {
        safeLocalStorageRemoveItem(CURRENT_SESSION_KEY);
      }
    } catch {
      // Ignore malformed legacy current sessions.
    }
  }

  window.dispatchEvent(new CustomEvent("current-session-change", { detail: null }));
}

export function saveCompletedSession(session: QuizSession) {
  if (!isBrowser()) return;
  const sessions = loadCompletedSessions();
  const nextKey = sessionDedupeKey(session);
  const nextSessions = [...sessions.filter((item) => sessionDedupeKey(item) !== nextKey), session];
  return saveCompletedSessions(nextSessions);
}

export function saveCompletedSessions(sessions: QuizSession[]) {
  if (!isBrowser()) return;
  const scopedKey = getScopedKey(COMPLETED_SESSIONS_KEY);
  const activeUser = getActiveStorageUser();
  const normalized = dedupeSessionsByCanonicalId(normalizeSessions(sessions))
    .filter((session) => Boolean(session.completedAt))
    .sort((left, right) =>
    (left.completedAt ?? left.startedAt).localeCompare(right.completedAt ?? right.startedAt)
  );

  completedSessionsMemoryCache.set(activeUser, normalized);

  let persisted = normalized.map(compactSessionForStorage);
  let didPersist = safeLocalStorageSetItem(scopedKey, JSON.stringify(persisted));

  while (!didPersist && persisted.length > 1) {
    persisted = persisted.slice(1);
    didPersist = safeLocalStorageSetItem(scopedKey, JSON.stringify(persisted));
  }

  if (!didPersist) {
    window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
    return false;
  }

  for (const session of persisted) {
    clearMatchingCurrentSessions(session.id);
  }

  window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
  return true;
}

export function loadCompletedSessions(): QuizSession[] {
  return loadCompletedSessionsForUser(getActiveStorageUser());
}

export function loadCompletedSessionsForUser(userId: string): QuizSession[] {
  if (!isBrowser()) return [];
  const cachedSessions = completedSessionsMemoryCache.get(userId);
  if (cachedSessions) return cachedSessions;

  const scopedKey = getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId);
  const raw =
    safeLocalStorageGetItem(scopedKey) ??
    (userId === GUEST_USER_ID ? getLegacyOrScopedRaw(COMPLETED_SESSIONS_KEY) : null);
  if (!raw) return [];

  try {
    return dedupeSessionsByCanonicalId(normalizeSessions(JSON.parse(raw) as QuizSession[]));
  } catch {
    return [];
  }
}

export function clearHistory() {
  if (!isBrowser()) return;
  completedSessionsMemoryCache.delete(getActiveStorageUser());
  safeLocalStorageRemoveItem(getScopedKey(COMPLETED_SESSIONS_KEY));
  safeLocalStorageRemoveItem(getScopedKey(CURRENT_SESSION_KEY));
}

export function saveQuizSettings(settings: QuizSettings) {
  if (!isBrowser()) return;
  const scopedKey = getScopedKey(QUIZ_SETTINGS_KEY);
  const serializedSettings = JSON.stringify(settings);
  const didPersist = safeLocalStorageSetItem(scopedKey, serializedSettings);
  if (didPersist) {
    safeSessionStorageRemoveItem(scopedKey);
    return;
  }

  // If a student's browser storage is already full, keep the newest start-page
  // choice alive for this tab instead of falling back to an older subject.
  safeSessionStorageSetItem(scopedKey, serializedSettings);
}

export function loadQuizSettings(): QuizSettings | null {
  if (!isBrowser()) return null;
  const scopedKey = getScopedKey(QUIZ_SETTINGS_KEY);
  const raw = safeSessionStorageGetItem(scopedKey) ?? getLegacyOrScopedRaw(QUIZ_SETTINGS_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as QuizSettings;
  } catch {
    return null;
  }
}

export function loadQuestionExplanationOverrides() {
  if (!isBrowser()) return {} as Record<string, QuestionExplanationOverride>;
  const raw = getLegacyOrScopedRaw(QUESTION_EXPLANATION_OVERRIDES_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, QuestionExplanationOverride>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([questionId, override]) => {
          const normalized = normalizeQuestionExplanationOverride(override);
          if (!normalized) return null;
          return [questionId, normalized] as const;
        })
        .filter((entry): entry is readonly [string, QuestionExplanationOverride] => Boolean(entry))
    );
  } catch {
    return {};
  }
}

export function loadQuestionExplanationOverride(questionId: string) {
  return loadQuestionExplanationOverrides()[questionId];
}

export function loadQuestionExplanationOverridesForIds(questionIds: string[]) {
  const allOverrides = loadQuestionExplanationOverrides();
  return Object.fromEntries(
    questionIds
      .map((questionId) => {
        const override = allOverrides[questionId];
        if (!override) return null;
        return [questionId, override] as const;
      })
      .filter((entry): entry is readonly [string, QuestionExplanationOverride] => Boolean(entry))
  );
}

const QUESTION_EXPLANATION_BACKGROUND_LOOKUP_LIMIT = 20;

export function getPendingQuestionExplanationOverrideSync(
  questionIds: string[],
  sharedOverrides: Record<string, QuestionExplanationOverride>
) {
  const lookupQuestionIds = questionIds.slice(0, QUESTION_EXPLANATION_BACKGROUND_LOOKUP_LIMIT);
  const localOverrides = loadQuestionExplanationOverridesForIds(lookupQuestionIds);

  return Object.entries(localOverrides)
    .filter(([questionId, localOverride]) => {
      const sharedOverride = sharedOverrides[questionId];
      if (!sharedOverride) return true;

      const localUpdatedAt = localOverride.updatedAt ?? "";
      const sharedUpdatedAt = sharedOverride.updatedAt ?? "";
      if (localUpdatedAt && sharedUpdatedAt && localUpdatedAt <= sharedUpdatedAt) {
        return false;
      }

      return (
        localOverride.explanation !== sharedOverride.explanation ||
        JSON.stringify(localOverride.optionAnalysis ?? {}) !==
          JSON.stringify(sharedOverride.optionAnalysis ?? {}) ||
        (localOverride.memoryTip ?? "") !== (sharedOverride.memoryTip ?? "") ||
        (localOverride.model ?? "") !== (sharedOverride.model ?? "")
      );
    })
    .map(([questionId, override]) => ({
      questionId,
      override
    }));
}

export function saveQuestionExplanationOverride(
  questionId: string,
  override: QuestionExplanationOverride
) {
  if (!isBrowser()) return;
  saveQuestionExplanationOverrides({
    [questionId]: override
  });
}

export function saveQuestionExplanationOverrides(
  overrides: Record<string, QuestionExplanationOverride>
) {
  if (!isBrowser()) return;
  const current = loadQuestionExplanationOverrides();
  const next = {
    ...current,
    ...Object.fromEntries(
      Object.entries(overrides)
        .map(([questionId, override]) => {
          const normalized = normalizeQuestionExplanationOverride(override);
          if (!normalized) return null;
          return [questionId, normalized] as const;
        })
        .filter((entry): entry is readonly [string, QuestionExplanationOverride] => Boolean(entry))
    )
  };
  safeLocalStorageSetItem(getScopedKey(QUESTION_EXPLANATION_OVERRIDES_KEY), JSON.stringify(next));
}

export type PeakChallengePreload = {
  fingerprint: string;
  questionIds: string[];
  questions: Question[];
  sourceBreakdown: { pastExam?: number; aiGenerated?: number };
  preparedAt: string;
};

export type HomeToneMode = "calm" | "anxious";
export type ThemeMode = "light" | "dark";
export type PracticeYearRange = {
  yearFrom: number;
  yearTo: number;
};

export type PracticeQuestionCount = 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;

export function savePeakChallengePreload(preload: PeakChallengePreload) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PEAK_CHALLENGE_PRELOAD_KEY), JSON.stringify(preload));
}

export function loadPeakChallengePreload(): PeakChallengePreload | null {
  if (!isBrowser()) return null;
  const raw = getLegacyOrScopedRaw(PEAK_CHALLENGE_PRELOAD_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PeakChallengePreload;
  } catch {
    return null;
  }
}

export function clearPeakChallengePreload() {
  if (!isBrowser()) return;
  safeLocalStorageRemoveItem(getScopedKey(PEAK_CHALLENGE_PRELOAD_KEY));
}

export function saveHomeToneMode(mode: HomeToneMode) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(HOME_TONE_MODE_KEY), mode);
  window.dispatchEvent(new CustomEvent("home-tone-mode-change", { detail: mode }));
}

export function loadHomeToneMode(): HomeToneMode {
  if (!isBrowser()) return "calm";
  const raw = getLegacyOrScopedRaw(HOME_TONE_MODE_KEY);
  return raw === "anxious" ? "anxious" : "calm";
}

export function saveThemeMode(mode: ThemeMode) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(THEME_MODE_KEY), mode);
  window.dispatchEvent(new CustomEvent("theme-mode-change", { detail: mode }));
}

export function loadThemeMode(): ThemeMode {
  if (!isBrowser()) return "light";
  const raw = getLegacyOrScopedRaw(THEME_MODE_KEY);
  return raw === "dark" ? "dark" : "light";
}

export function savePracticeYearRange(range: PracticeYearRange) {
  if (!isBrowser()) return;
  const normalized = {
    yearFrom: Math.min(range.yearFrom, range.yearTo),
    yearTo: Math.max(range.yearFrom, range.yearTo)
  };
  safeLocalStorageSetItem(getScopedKey(PRACTICE_YEAR_RANGE_KEY), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("practice-year-range-change", { detail: normalized }));
}

export function savePracticeQuestionCount(count: PracticeQuestionCount) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PRACTICE_QUESTION_COUNT_KEY), String(count));
  window.dispatchEvent(new CustomEvent("practice-question-count-change", { detail: count }));
}

export function loadPracticeQuestionCount(defaultCount: PracticeQuestionCount = 10): PracticeQuestionCount {
  if (!isBrowser()) return defaultCount;
  const raw = getLegacyOrScopedRaw(PRACTICE_QUESTION_COUNT_KEY);
  const value = Number(raw);
  return [5, 10, 15, 20, 25, 30, 35, 40, 45, 50].includes(value)
    ? (value as PracticeQuestionCount)
    : defaultCount;
}

export function savePracticeStopAfterReview(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PRACTICE_STOP_AFTER_REVIEW_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("practice-stop-after-review-change", { detail: enabled }));
}

export function loadPracticeStopAfterReview(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(PRACTICE_STOP_AFTER_REVIEW_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function savePracticeFastAnswerMode(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PRACTICE_FAST_ANSWER_MODE_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("practice-fast-answer-mode-change", { detail: enabled }));
}

export function loadPracticeFastAnswerMode(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(PRACTICE_FAST_ANSWER_MODE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function loadPracticeYearRange(defaultRange?: PracticeYearRange): PracticeYearRange | null {
  if (!isBrowser()) return defaultRange ?? null;
  const raw = getLegacyOrScopedRaw(PRACTICE_YEAR_RANGE_KEY);
  if (!raw) return defaultRange ?? null;

  try {
    const parsed = JSON.parse(raw) as Partial<PracticeYearRange>;
    if (
      typeof parsed.yearFrom === "number" &&
      Number.isFinite(parsed.yearFrom) &&
      typeof parsed.yearTo === "number" &&
      Number.isFinite(parsed.yearTo)
    ) {
      return {
        yearFrom: Math.min(parsed.yearFrom, parsed.yearTo),
        yearTo: Math.max(parsed.yearFrom, parsed.yearTo)
      };
    }
  } catch {
    return defaultRange ?? null;
  }

  return defaultRange ?? null;
}

export function applyQuestionExplanationOverride(question: Question): Question {
  const override = loadQuestionExplanationOverride(question.id);
  if (!override) return question;

  return {
    ...question,
    explanation: override.explanation || question.explanation,
    optionAnalysis: override.optionAnalysis ?? question.optionAnalysis,
    memoryTip: override.memoryTip ?? question.memoryTip
  };
}
