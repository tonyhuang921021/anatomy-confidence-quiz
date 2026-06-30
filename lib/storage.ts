import {
  ConfidenceLevel,
  ErrorType,
  OptionKey,
  Question,
  QuestionExplanationOverride,
  QuizSession,
  QuizSettings
} from "@/types/quiz";
import { normalizeQuestionExplanationOverride as normalizeQuestionExplanationOverridePayload } from "@/lib/questionExplanationFormat";
import { normalizePracticeYearRange } from "@/lib/practiceYears";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const CLOUD_COMPLETED_SESSIONS_KEY = "anatomy-confidence-cloud-completed-sessions";
const PENDING_COMPLETED_SESSION_UPLOADS_KEY = "anatomy-confidence-pending-completed-session-uploads";
const COMPLETED_QUESTION_HISTORY_KEY = "anatomy-confidence-completed-question-history";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";
const QUESTION_EXPLANATION_OVERRIDES_KEY = "anatomy-confidence-question-explanation-overrides";
const PEAK_CHALLENGE_PRELOAD_KEY = "anatomy-confidence-peak-challenge-preload";
const HOME_TONE_MODE_KEY = "anatomy-confidence-home-tone-mode";
const THEME_MODE_KEY = "anatomy-confidence-theme-mode";
const PRACTICE_YEAR_RANGE_KEY = "anatomy-confidence-practice-year-range";
const PRACTICE_QUESTION_COUNT_KEY = "anatomy-confidence-practice-question-count";
const PRACTICE_STOP_AFTER_REVIEW_KEY = "anatomy-confidence-practice-stop-after-review";
const PRACTICE_FAST_ANSWER_MODE_KEY = "anatomy-confidence-practice-fast-answer-mode";
const PRACTICE_CONFIDENCE_CALIBRATION_KEY = "anatomy-confidence-practice-confidence-calibration";
const ACTIVE_USER_KEY = "anatomy-confidence-active-user-id";
const GUEST_USER_ID = "guest";
const completedSessionsMemoryCache = new Map<string, QuizSession[]>();
const completedSessionIdMemoryCache = new Map<string, Set<string>>();
const completedQuestionHistoryMemoryCache = new Map<string, CompletedQuestionHistoryEntry[]>();
const COMPLETED_SESSIONS_HEAVY_READ_LIMIT = 160_000;
const COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT = 1_500_000;
const PENDING_COMPLETED_SESSION_UPLOAD_LIMIT = 80;

export type CompletedQuestionHistoryEntry = {
  questionId: string;
  attempts: number;
  correct: number;
  wrong: number;
  lowConfidence: number;
  overconfidence: number;
  lastAttemptedAt: string;
  lastAttemptCorrect: boolean;
  latestErrorType?: ErrorType;
  latestSelectedAnswer: OptionKey;
  latestCorrectAnswer: OptionKey;
  latestConfidence: ConfidenceLevel;
};

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

function buildCompletedSessionIdSet(sessions: QuizSession[]) {
  return new Set(
    sessions
      .filter((session) => Boolean(session.completedAt))
      .map((session) => getCanonicalSessionId(session.id))
  );
}

function cacheCompletedSessionsForUser(userId: string, sessions: QuizSession[]) {
  completedSessionsMemoryCache.set(userId, sessions);
  completedSessionIdMemoryCache.set(userId, buildCompletedSessionIdSet(sessions));
}

function cacheCompletedQuestionHistoryForUser(userId: string, entries: CompletedQuestionHistoryEntry[]) {
  completedQuestionHistoryMemoryCache.set(userId, entries);
}

function getCompletedQuestionHistoryScopedKeyForUser(userId: string) {
  return getScopedKeyForUser(COMPLETED_QUESTION_HISTORY_KEY, userId);
}

function getCloudCompletedSessionsScopedKeyForUser(userId: string) {
  return getScopedKeyForUser(CLOUD_COMPLETED_SESSIONS_KEY, userId);
}

function normalizeCompletedQuestionHistoryEntry(entry: unknown): CompletedQuestionHistoryEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Partial<CompletedQuestionHistoryEntry>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  const latestSelectedAnswer =
    typeof raw.latestSelectedAnswer === "string" ? raw.latestSelectedAnswer.trim().toUpperCase() : "";
  const latestCorrectAnswer =
    typeof raw.latestCorrectAnswer === "string" ? raw.latestCorrectAnswer.trim().toUpperCase() : "";

  if (!questionId || !isOptionKey(latestSelectedAnswer) || !isOptionKey(latestCorrectAnswer)) {
    return null;
  }

  const correct = Math.max(0, Math.floor(Number(raw.correct) || 0));
  const wrong = Math.max(0, Math.floor(Number(raw.wrong) || 0));
  const lowConfidence = Math.max(0, Math.floor(Number(raw.lowConfidence) || 0));
  const overconfidence = Math.max(0, Math.floor(Number(raw.overconfidence) || 0));
  const attempts = Math.max(
    1,
    Math.floor(Number(raw.attempts) || 1),
    correct + wrong,
    lowConfidence,
    overconfidence
  );

  return {
    questionId,
    attempts,
    correct: Math.min(correct, attempts),
    wrong: Math.min(wrong, attempts),
    lowConfidence: Math.min(lowConfidence, attempts),
    overconfidence: Math.min(overconfidence, attempts),
    lastAttemptedAt:
      typeof raw.lastAttemptedAt === "string" && raw.lastAttemptedAt.trim()
        ? raw.lastAttemptedAt
        : new Date(0).toISOString(),
    lastAttemptCorrect: Boolean(raw.lastAttemptCorrect),
    latestErrorType: normalizeErrorType(raw.latestErrorType),
    latestSelectedAnswer,
    latestCorrectAnswer,
    latestConfidence: normalizeConfidenceLevel(raw.latestConfidence)
  };
}

function mergeAttemptIntoCompletedQuestionHistory(
  history: Map<string, CompletedQuestionHistoryEntry>,
  attempt: QuizSession["attempts"][number]
) {
  const existing = history.get(attempt.questionId);
  const base: CompletedQuestionHistoryEntry =
    existing ?? {
      questionId: attempt.questionId,
      attempts: 0,
      correct: 0,
      wrong: 0,
      lowConfidence: 0,
      overconfidence: 0,
      lastAttemptedAt: attempt.answeredAt,
      lastAttemptCorrect: attempt.isCorrect,
      latestErrorType: attempt.errorType,
      latestSelectedAnswer: attempt.selectedAnswer,
      latestCorrectAnswer: attempt.correctAnswer,
      latestConfidence: attempt.confidence
    };

  base.attempts += 1;
  base.correct += attempt.isCorrect ? 1 : 0;
  base.wrong += attempt.isCorrect ? 0 : 1;
  base.lowConfidence += attempt.confidence <= 2 ? 1 : 0;
  base.overconfidence += !attempt.isCorrect && attempt.confidence >= 4 ? 1 : 0;

  if (!base.lastAttemptedAt || attempt.answeredAt >= base.lastAttemptedAt) {
    base.lastAttemptedAt = attempt.answeredAt;
    base.lastAttemptCorrect = attempt.isCorrect;
    base.latestErrorType = attempt.errorType;
    base.latestSelectedAnswer = attempt.selectedAnswer;
    base.latestCorrectAnswer = attempt.correctAnswer;
    base.latestConfidence = attempt.confidence;
  }

  history.set(attempt.questionId, base);
}

export function buildCompletedQuestionHistoryEntriesFromSessions(
  sessions: Pick<QuizSession, "attempts">[]
) {
  const history = new Map<string, CompletedQuestionHistoryEntry>();

  for (const session of sessions) {
    for (const attempt of session.attempts ?? []) {
      mergeAttemptIntoCompletedQuestionHistory(history, attempt);
    }
  }

  return Array.from(history.values()).sort((left, right) =>
    right.lastAttemptedAt.localeCompare(left.lastAttemptedAt)
  );
}

export function mergeCompletedQuestionHistoryEntries(
  existing: CompletedQuestionHistoryEntry[],
  next: CompletedQuestionHistoryEntry[]
) {
  const merged = new Map(existing.map((entry) => [entry.questionId, { ...entry }] as const));

  for (const entry of next) {
    const current = merged.get(entry.questionId);
    if (!current) {
      merged.set(entry.questionId, { ...entry });
      continue;
    }

    const aggregateSource =
      entry.attempts > current.attempts ? entry : current;
    const latestSource =
      entry.lastAttemptedAt >= current.lastAttemptedAt ? entry : current;

    merged.set(entry.questionId, {
      questionId: entry.questionId,
      attempts: aggregateSource.attempts,
      correct: aggregateSource.correct,
      wrong: aggregateSource.wrong,
      lowConfidence: aggregateSource.lowConfidence,
      overconfidence: aggregateSource.overconfidence,
      lastAttemptedAt: latestSource.lastAttemptedAt,
      lastAttemptCorrect: latestSource.lastAttemptCorrect,
      latestErrorType: latestSource.latestErrorType,
      latestSelectedAnswer: latestSource.latestSelectedAnswer,
      latestCorrectAnswer: latestSource.latestCorrectAnswer,
      latestConfidence: latestSource.latestConfidence
    });
  }

  return Array.from(merged.values()).sort((left, right) =>
    right.lastAttemptedAt.localeCompare(left.lastAttemptedAt)
  );
}

export function saveCompletedQuestionHistoryEntriesForUser(
  userId: string,
  entries: CompletedQuestionHistoryEntry[]
) {
  if (!isBrowser()) return false;
  const normalized = entries
    .map(normalizeCompletedQuestionHistoryEntry)
    .filter((entry): entry is CompletedQuestionHistoryEntry => Boolean(entry));

  cacheCompletedQuestionHistoryForUser(userId, normalized);
  return safeLocalStorageSetItem(
    getCompletedQuestionHistoryScopedKeyForUser(userId),
    JSON.stringify(normalized)
  );
}

export function mergeCompletedQuestionHistoryEntriesForUser(
  userId: string,
  entries: CompletedQuestionHistoryEntry[]
) {
  return saveCompletedQuestionHistoryEntriesForUser(
    userId,
    mergeCompletedQuestionHistoryEntries(loadCompletedQuestionHistoryEntriesForUser(userId), entries)
  );
}

export function loadCompletedQuestionHistoryEntriesForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return [] as CompletedQuestionHistoryEntry[];
  const cached = completedQuestionHistoryMemoryCache.get(userId);
  if (cached) return cached;

  const raw =
    safeLocalStorageGetItem(getCompletedQuestionHistoryScopedKeyForUser(userId)) ??
    (userId === GUEST_USER_ID ? safeLocalStorageGetItem(COMPLETED_QUESTION_HISTORY_KEY) : null);
  if (!raw) {
    cacheCompletedQuestionHistoryForUser(userId, []);
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown[];
    const normalized = parsed
      .map(normalizeCompletedQuestionHistoryEntry)
      .filter((entry): entry is CompletedQuestionHistoryEntry => Boolean(entry));
    cacheCompletedQuestionHistoryForUser(userId, normalized);
    return normalized;
  } catch {
    cacheCompletedQuestionHistoryForUser(userId, []);
    return [];
  }
}

export function mergeCompletedQuestionHistoryFromSessionsForUser(
  userId: string,
  sessions: Pick<QuizSession, "attempts">[]
) {
  const existing = loadCompletedQuestionHistoryEntriesForUser(userId);
  const next = buildCompletedQuestionHistoryEntriesFromSessions(sessions);
  return saveCompletedQuestionHistoryEntriesForUser(
    userId,
    mergeCompletedQuestionHistoryEntries(existing, next)
  );
}

function buildSyntheticAttemptsFromQuestionHistory(entries: CompletedQuestionHistoryEntry[]) {
  const syntheticAttempts: QuizSession["attempts"] = [];
  const epoch = new Date(0).toISOString();

  for (const entry of entries) {
    let wrongLowConfidence = Math.min(entry.wrong, entry.lowConfidence);
    let wrongOverconfidence = Math.min(
      Math.max(0, entry.wrong - wrongLowConfidence),
      entry.overconfidence
    );
    let wrongRegular = Math.max(0, entry.wrong - wrongLowConfidence - wrongOverconfidence);
    let correctLowConfidence = Math.min(
      entry.correct,
      Math.max(0, entry.lowConfidence - wrongLowConfidence)
    );
    let correctRegular = Math.max(0, entry.correct - correctLowConfidence);
    const latestBucket = entry.lastAttemptCorrect
      ? entry.latestConfidence <= 2
        ? "correctLowConfidence"
        : "correctRegular"
      : entry.latestConfidence <= 2
        ? "wrongLowConfidence"
        : entry.latestConfidence >= 4
          ? "wrongOverconfidence"
          : "wrongRegular";

    if (latestBucket === "correctLowConfidence" && correctLowConfidence > 0) correctLowConfidence -= 1;
    if (latestBucket === "correctRegular" && correctRegular > 0) correctRegular -= 1;
    if (latestBucket === "wrongLowConfidence" && wrongLowConfidence > 0) wrongLowConfidence -= 1;
    if (latestBucket === "wrongOverconfidence" && wrongOverconfidence > 0) wrongOverconfidence -= 1;
    if (latestBucket === "wrongRegular" && wrongRegular > 0) wrongRegular -= 1;

    const pushAttempt = (
      count: number,
      isCorrect: boolean,
      confidence: ConfidenceLevel,
      answeredAt = epoch
    ) => {
      for (let index = 0; index < count; index += 1) {
        syntheticAttempts.push({
          questionId: entry.questionId,
          selectedAnswer: entry.latestSelectedAnswer,
          correctAnswer: entry.latestCorrectAnswer,
          isCorrect,
          confidence,
          errorType: isCorrect ? undefined : entry.latestErrorType,
          answeredAt
        });
      }
    };

    pushAttempt(wrongLowConfidence, false, 2);
    pushAttempt(wrongOverconfidence, false, 4);
    pushAttempt(wrongRegular, false, 3);
    pushAttempt(correctLowConfidence, true, 2);
    pushAttempt(correctRegular, true, 4);

    if (entry.attempts > 0) {
      syntheticAttempts.push({
        questionId: entry.questionId,
        selectedAnswer: entry.latestSelectedAnswer,
        correctAnswer: entry.latestCorrectAnswer,
        isCorrect: entry.lastAttemptCorrect,
        confidence: entry.latestConfidence,
        errorType: entry.lastAttemptCorrect ? undefined : entry.latestErrorType,
        answeredAt: entry.lastAttemptedAt
      });
    }
  }

  return syntheticAttempts;
}

export function loadCompletedHistorySessionsForUser(userId = getActiveStorageUser()) {
  const historyEntries = loadCompletedQuestionHistoryEntriesForUser(userId);
  if (historyEntries.length > 0) {
    return [{ attempts: buildSyntheticAttemptsFromQuestionHistory(historyEntries) }];
  }

  if (getCompletedSessionsStorageLengthForUser(userId) > COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT) {
    return loadRecentLocalCompletedSessionsForUploadForUser(userId);
  }

  return loadCompletedSessionsForUser(userId);
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

function normalizeCompletedSessionList(sessions: QuizSession[]) {
  return dedupeSessionsByCanonicalId(normalizeSessions(sessions))
    .filter((session) => Boolean(session.completedAt))
    .sort((left, right) =>
      (left.completedAt ?? left.startedAt).localeCompare(right.completedAt ?? right.startedAt)
    );
}

function parseCompletedSessionsRaw(raw: string | null) {
  if (!raw) return [] as QuizSession[];

  try {
    return normalizeCompletedSessionList(JSON.parse(raw) as QuizSession[]);
  } catch {
    return [] as QuizSession[];
  }
}

function isJsonWhitespace(char: string) {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}

function isEscapedJsonQuote(raw: string, quoteIndex: number) {
  let slashCount = 0;
  for (let index = quoteIndex - 1; index >= 0 && raw[index] === "\\"; index -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function shouldSkipRecoveredSession(session: QuizSession, excludedSessionIds?: Set<string>) {
  return excludedSessionIds?.has(getCanonicalSessionId(session.id)) ?? false;
}

function parseRecentCompletedSessionsFromRaw(
  raw: string | null,
  limit = PENDING_COMPLETED_SESSION_UPLOAD_LIMIT,
  excludedSessionIds?: Set<string>
) {
  if (!raw || limit <= 0) return [] as QuizSession[];
  if (raw.length <= COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT) {
    return parseCompletedSessionsRaw(raw)
      .filter((session) => !shouldSkipRecoveredSession(session, excludedSessionIds))
      .slice(-limit);
  }

  const sessions: QuizSession[] = [];
  let scanEnd = raw.length - 1;

  while (scanEnd >= 0 && isJsonWhitespace(raw[scanEnd])) scanEnd -= 1;
  if (raw[scanEnd] === "]") scanEnd -= 1;

  let depth = 0;
  let inString = false;
  let objectEnd = -1;

  for (let index = scanEnd; index >= 0 && sessions.length < limit; index -= 1) {
    const char = raw[index];

    if (char === "\"" && !isEscapedJsonQuote(raw, index)) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "}") {
      if (depth === 0) objectEnd = index + 1;
      depth += 1;
      continue;
    }

    if (char === "{") {
      depth -= 1;
      if (depth === 0 && objectEnd > index) {
        try {
          const session = normalizeSession(JSON.parse(raw.slice(index, objectEnd)) as QuizSession);
          if (session.completedAt && !shouldSkipRecoveredSession(session, excludedSessionIds)) {
            sessions.push(session);
          }
        } catch {
          // Keep scanning older sessions when one tail object is malformed.
        }
        objectEnd = -1;
      }
    }
  }

  return normalizeCompletedSessionList(sessions.reverse()).slice(-limit);
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
  return normalizeQuestionExplanationOverridePayload(override);
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
  const activeUser = getActiveStorageUser();
  const canonicalId = getCanonicalSessionId(session.id);
  const alreadyCompleted = completedSessionIdMemoryCache.get(activeUser)?.has(canonicalId) ?? false;

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
  const activeUser = getActiveStorageUser();
  mergeCompletedQuestionHistoryFromSessionsForUser(activeUser, [session]);

  if (
    getCompletedSessionsStorageLengthForUser(activeUser) > COMPLETED_SESSIONS_HEAVY_READ_LIMIT &&
    !completedSessionsMemoryCache.has(activeUser)
  ) {
    const normalized = normalizeCompletedSessionList([
      ...loadCloudCompletedSessionsForUser(activeUser),
      session
    ]);
    saveCloudCompletedSessionsForUser(activeUser, normalized);
    cacheCompletedSessionsForUser(activeUser, normalized);
    for (const item of normalized) {
      clearMatchingCurrentSessions(item.id);
    }
    window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
    return true;
  }

  const sessions = loadCompletedSessions();
  const nextKey = sessionDedupeKey(session);
  const nextSessions = [...sessions.filter((item) => sessionDedupeKey(item) !== nextKey), session];
  return saveCompletedSessions(nextSessions);
}

export function saveCompletedSessions(sessions: QuizSession[]) {
  if (!isBrowser()) return;
  const scopedKey = getScopedKey(COMPLETED_SESSIONS_KEY);
  const activeUser = getActiveStorageUser();
  const normalized = normalizeCompletedSessionList(sessions);

  cacheCompletedSessionsForUser(activeUser, normalized);
  saveCompletedQuestionHistoryEntriesForUser(
    activeUser,
    buildCompletedQuestionHistoryEntriesFromSessions(normalized)
  );

  const persisted = normalized.map(compactSessionForStorage);
  const didPersist = safeLocalStorageSetItem(scopedKey, JSON.stringify(persisted));

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

export function getCompletedSessionsStorageLengthForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return 0;
  const scopedRaw = safeLocalStorageGetItem(getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId));
  const legacyRaw = userId === GUEST_USER_ID ? safeLocalStorageGetItem(COMPLETED_SESSIONS_KEY) : null;
  return Math.max(scopedRaw?.length ?? 0, legacyRaw?.length ?? 0);
}

export function loadRecentLocalCompletedSessionsForUploadForUser(
  userId = getActiveStorageUser(),
  limit = PENDING_COMPLETED_SESSION_UPLOAD_LIMIT,
  excludedSessionIds?: Set<string>
) {
  if (!isBrowser()) return [] as QuizSession[];
  const rawValues = [
    safeLocalStorageGetItem(getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId)),
    userId === GUEST_USER_ID ? safeLocalStorageGetItem(COMPLETED_SESSIONS_KEY) : null
  ].filter((raw): raw is string => Boolean(raw));
  const recoverableSessions = rawValues
    .flatMap((raw) => parseRecentCompletedSessionsFromRaw(raw, limit, excludedSessionIds));

  return normalizeCompletedSessionList(recoverableSessions).slice(-limit);
}

export function loadCloudCompletedSessionsForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return [] as QuizSession[];
  return parseCompletedSessionsRaw(
    safeLocalStorageGetItem(getCloudCompletedSessionsScopedKeyForUser(userId))
  );
}

export function saveCloudCompletedSessionsForUser(userId: string, sessions: QuizSession[]) {
  if (!isBrowser()) return false;
  const normalized = normalizeCompletedSessionList(sessions);
  const didPersist = safeLocalStorageSetItem(
    getCloudCompletedSessionsScopedKeyForUser(userId),
    JSON.stringify(normalized.map(compactSessionForStorage))
  );

  if (didPersist) {
    completedSessionsMemoryCache.delete(userId);
    completedSessionIdMemoryCache.delete(userId);
  } else {
    cacheCompletedSessionsForUser(
      userId,
      normalizeCompletedSessionList([
        ...(completedSessionsMemoryCache.get(userId) ?? []),
        ...normalized,
        ...loadPendingCompletedSessionUploadsForUser(userId)
      ])
    );
  }

  if (userId === getActiveStorageUser()) {
    window.dispatchEvent(
      new CustomEvent("completed-sessions-change", {
        detail: loadCompletedSessionsForUser(userId)
      })
    );
  }

  return didPersist;
}

function getPendingCompletedSessionUploadsScopedKeyForUser(userId: string) {
  return getScopedKeyForUser(PENDING_COMPLETED_SESSION_UPLOADS_KEY, userId);
}

export function loadPendingCompletedSessionUploadsForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return [] as QuizSession[];
  const scopedKey = getPendingCompletedSessionUploadsScopedKeyForUser(userId);
  const localSessions = parseCompletedSessionsRaw(safeLocalStorageGetItem(scopedKey));
  const sessionSessions = parseCompletedSessionsRaw(safeSessionStorageGetItem(scopedKey));
  return normalizeCompletedSessionList([...localSessions, ...sessionSessions]);
}

function savePendingCompletedSessionUploadsForUser(userId: string, sessions: QuizSession[]) {
  if (!isBrowser()) return false;
  const scopedKey = getPendingCompletedSessionUploadsScopedKeyForUser(userId);
  const normalized = normalizeCompletedSessionList(sessions)
    .slice(-PENDING_COMPLETED_SESSION_UPLOAD_LIMIT);
  const payload = JSON.stringify(normalized.map(compactSessionForStorage));
  const didPersist = safeLocalStorageSetItem(scopedKey, payload);
  const didStore = didPersist ? true : safeSessionStorageSetItem(scopedKey, payload);

  if (didPersist) {
    safeSessionStorageRemoveItem(scopedKey);
  }

  completedSessionsMemoryCache.delete(userId);
  completedSessionIdMemoryCache.delete(userId);

  if (userId === getActiveStorageUser()) {
    window.dispatchEvent(
      new CustomEvent("completed-sessions-change", {
        detail: loadCompletedSessionsForUser(userId)
      })
    );
  }

  return didStore;
}

export function queuePendingCompletedSessionUploadForUser(userId: string, sessions: QuizSession | QuizSession[]) {
  if (!isBrowser()) return false;
  const incoming = Array.isArray(sessions) ? sessions : [sessions];
  const nextSessions = normalizeCompletedSessionList([
    ...loadPendingCompletedSessionUploadsForUser(userId),
    ...incoming
  ]);
  return savePendingCompletedSessionUploadsForUser(userId, nextSessions);
}

export function removePendingCompletedSessionUploadsForUser(userId: string, sessions: QuizSession | QuizSession[]) {
  if (!isBrowser()) return false;
  const sessionList = Array.isArray(sessions) ? sessions : [sessions];
  const completedIds = new Set(sessionList.map((session) => getCanonicalSessionId(session.id)));
  const remaining = loadPendingCompletedSessionUploadsForUser(userId)
    .filter((session) => !completedIds.has(getCanonicalSessionId(session.id)));
  return savePendingCompletedSessionUploadsForUser(userId, remaining);
}

export function loadCompletedSessionsForUser(userId: string): QuizSession[] {
  if (!isBrowser()) return [];
  const cachedSessions = completedSessionsMemoryCache.get(userId);
  if (cachedSessions) return cachedSessions;

  const cloudSessions = loadCloudCompletedSessionsForUser(userId);
  const pendingSessions = loadPendingCompletedSessionUploadsForUser(userId);
  const scopedKey = getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId);
  const raw =
    safeLocalStorageGetItem(scopedKey) ??
    (userId === GUEST_USER_ID ? getLegacyOrScopedRaw(COMPLETED_SESSIONS_KEY) : null);
  if (!raw) {
    const normalized = normalizeCompletedSessionList([...cloudSessions, ...pendingSessions]);
    cacheCompletedSessionsForUser(userId, normalized);
    return normalized;
  }

  if (raw.length > COMPLETED_SESSIONS_HEAVY_READ_LIMIT) {
    if (raw.length > COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT) {
      const normalized = normalizeCompletedSessionList([
        ...cloudSessions,
        ...pendingSessions,
        ...loadRecentLocalCompletedSessionsForUploadForUser(userId)
      ]);
      cacheCompletedSessionsForUser(userId, normalized);
      return normalized;
    }

    const normalized = normalizeCompletedSessionList([
      ...parseCompletedSessionsRaw(raw),
      ...cloudSessions,
      ...pendingSessions
    ]);
    cacheCompletedSessionsForUser(userId, normalized);
    return normalized;
  }

  const normalized = normalizeCompletedSessionList([
    ...parseCompletedSessionsRaw(raw),
    ...cloudSessions,
    ...pendingSessions
  ]);
  cacheCompletedSessionsForUser(userId, normalized);
  return normalized;
}

export function clearHistory() {
  if (!isBrowser()) return;
  const activeUser = getActiveStorageUser();
  completedSessionsMemoryCache.delete(activeUser);
  completedSessionIdMemoryCache.delete(activeUser);
  completedQuestionHistoryMemoryCache.delete(activeUser);
  safeLocalStorageRemoveItem(getScopedKey(COMPLETED_SESSIONS_KEY));
  safeLocalStorageRemoveItem(getScopedKey(CLOUD_COMPLETED_SESSIONS_KEY));
  safeLocalStorageRemoveItem(getScopedKey(PENDING_COMPLETED_SESSION_UPLOADS_KEY));
  safeSessionStorageRemoveItem(getScopedKey(PENDING_COMPLETED_SESSION_UPLOADS_KEY));
  safeLocalStorageRemoveItem(getScopedKey(COMPLETED_QUESTION_HISTORY_KEY));
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
  const normalized = normalizePracticeYearRange(range);
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

export function savePracticeConfidenceCalibration(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PRACTICE_CONFIDENCE_CALIBRATION_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("practice-confidence-calibration-change", { detail: enabled }));
}

export function loadPracticeConfidenceCalibration(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(PRACTICE_CONFIDENCE_CALIBRATION_KEY);
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
      return normalizePracticeYearRange({
        yearFrom: parsed.yearFrom,
        yearTo: parsed.yearTo
      });
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
