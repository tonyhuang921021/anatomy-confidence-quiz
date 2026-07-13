import {
  ConfidenceLevel,
  ErrorType,
  OptionKey,
  Question,
  QuestionExplanationOverride,
  QuizSession,
  QuizSettings
} from "../types/quiz";
import { normalizeQuestionExplanationOverride as normalizeQuestionExplanationOverridePayload } from "./questionExplanationFormat";
import { normalizePracticeYearRange } from "./practiceYears";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const CURRENT_SESSION_DISCARDS_KEY = "anatomy-confidence-current-session-discards";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const CLOUD_COMPLETED_SESSIONS_KEY = "anatomy-confidence-cloud-completed-sessions";
const PENDING_COMPLETED_SESSION_UPLOADS_KEY = "anatomy-confidence-pending-completed-session-uploads";
const RECENT_COMPLETED_SESSION_HANDOFF_KEY = "anatomy-confidence-recent-completed-session-handoff";
const COMPLETED_QUESTION_HISTORY_KEY = "anatomy-confidence-completed-question-history";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";
const QUESTION_EXPLANATION_OVERRIDES_KEY = "anatomy-confidence-question-explanation-overrides";
const HOME_TONE_MODE_KEY = "anatomy-confidence-home-tone-mode";
const THEME_MODE_KEY = "anatomy-confidence-theme-mode";
const PRACTICE_YEAR_RANGE_KEY = "anatomy-confidence-practice-year-range";
const PRACTICE_QUESTION_COUNT_KEY = "anatomy-confidence-practice-question-count";
const PRACTICE_STOP_AFTER_REVIEW_KEY = "anatomy-confidence-practice-stop-after-review";
const PRACTICE_FAST_ANSWER_MODE_KEY = "anatomy-confidence-practice-fast-answer-mode";
const REVIEW_COMPLETION_THRESHOLD_KEY = "anatomy-confidence-review-completion-threshold";
const SIMULATION_CONFIDENCE_CALIBRATION_KEY = "anatomy-confidence-simulation-confidence-calibration";
const PHARMACOLOGY_REVERSE_SWIPE_KEY = "anatomy-confidence-pharmacology-reverse-swipe";
const KEYBOARD_QUESTION_NAVIGATION_KEY = "anatomy-confidence-keyboard-question-navigation";
const SIMULATION_OPTION_ELIMINATION_KEY = "anatomy-confidence-simulation-option-elimination";
const ACTIVE_USER_KEY = "anatomy-confidence-active-user-id";
const GUEST_USER_ID = "guest";
const completedSessionsMemoryCache = new Map<string, QuizSession[]>();
const completedSessionIdMemoryCache = new Map<string, Set<string>>();
const completedQuestionHistoryMemoryCache = new Map<string, CompletedQuestionHistoryEntry[]>();
const COMPLETED_SESSIONS_HEAVY_READ_LIMIT = 160_000;
const COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT = 1_500_000;
const COMPLETED_SESSIONS_RECENT_RECOVERY_LIMIT = 240;
const CLOUD_COMPLETED_SESSIONS_FALLBACK_LIMITS = [500, 300, 180, 90] as const;
const PENDING_COMPLETED_SESSION_UPLOAD_LIMIT = 240;
const RECENT_COMPLETED_SESSION_HANDOFF_LIMIT = 24;
const COMPLETED_STORAGE_SYNC_CHANNEL = "anatomy-confidence-completed-storage-sync";
const COMPLETED_STORAGE_SYNC_SOURCE_ID = `tab-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`;
const CURRENT_SESSION_DISCARD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CompletedStorageSyncChange = {
  sourceId: string;
  userId?: string;
  sessions?: boolean;
  history?: boolean;
  current?: boolean;
  completedSessions?: QuizSession[];
  historyEntries?: CompletedQuestionHistoryEntry[];
};

type LoadCompletedSessionsOptions = {
  includeFullLocalHistory?: boolean;
};

let completedStorageSyncInstalled = false;
let completedStorageSyncInstalledWindow: Window | null = null;
let completedStorageSyncChannel: BroadcastChannel | null | undefined;

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

function getUserIdFromScopedStorageKey(key: string, baseKey: string) {
  if (key === baseKey) return GUEST_USER_ID;
  const prefix = `${baseKey}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) || GUEST_USER_ID : null;
}

function getCompletedStorageChangeFromKey(key: string | null): Omit<CompletedStorageSyncChange, "sourceId"> | null {
  if (!key) return null;

  const sessionUserId =
    getUserIdFromScopedStorageKey(key, COMPLETED_SESSIONS_KEY) ??
    getUserIdFromScopedStorageKey(key, CLOUD_COMPLETED_SESSIONS_KEY) ??
    getUserIdFromScopedStorageKey(key, PENDING_COMPLETED_SESSION_UPLOADS_KEY) ??
    getUserIdFromScopedStorageKey(key, RECENT_COMPLETED_SESSION_HANDOFF_KEY);
  if (sessionUserId) return { userId: sessionUserId, sessions: true, history: true };

  const historyUserId = getUserIdFromScopedStorageKey(key, COMPLETED_QUESTION_HISTORY_KEY);
  if (historyUserId) return { userId: historyUserId, history: true };

  const currentUserId = getUserIdFromScopedStorageKey(key, CURRENT_SESSION_KEY);
  if (currentUserId) return { userId: currentUserId, current: true };

  return null;
}

function invalidateCompletedStorageCaches(userId?: string) {
  if (!userId) {
    completedSessionsMemoryCache.clear();
    completedSessionIdMemoryCache.clear();
    completedQuestionHistoryMemoryCache.clear();
    return;
  }

  completedSessionsMemoryCache.delete(userId);
  completedSessionIdMemoryCache.delete(userId);
  completedQuestionHistoryMemoryCache.delete(userId);
}

function getCompletedSessionBroadcastPayload(sessions: QuizSession[]) {
  return sessions
    .filter((session) => Boolean(session.completedAt))
    .slice(-32)
    .map(compactSessionForStorage);
}

function getCompletedHistoryBroadcastPayload(entries: CompletedQuestionHistoryEntry[]) {
  return mergeCompletedQuestionHistoryEntries([], entries).slice(0, 120);
}

function applyExternalCompletedStoragePayload(change: CompletedStorageSyncChange) {
  if (!change.userId) return;

  const incomingSessions = normalizeCompletedSessionList(change.completedSessions ?? []);
  if (incomingSessions.length > 0) {
    const existingSessions = loadCompletedSessionsForUser(change.userId);
    const mergedSessions = normalizeCompletedSessionList([
      ...existingSessions,
      ...incomingSessions
    ]);
    cacheCompletedSessionsForUser(change.userId, mergedSessions);

    const existingHistory = loadCompletedQuestionHistoryEntriesForUser(change.userId);
    const incomingHistory = buildCompletedQuestionHistoryEntriesFromSessions(incomingSessions);
    cacheCompletedQuestionHistoryForUser(
      change.userId,
      mergeCompletedQuestionHistoryEntries(existingHistory, incomingHistory)
    );
  }

  const incomingHistory = getCompletedHistoryBroadcastPayload(change.historyEntries ?? []);
  if (incomingHistory.length > 0) {
    const existingHistory = loadCompletedQuestionHistoryEntriesForUser(change.userId);
    cacheCompletedQuestionHistoryForUser(
      change.userId,
      mergeCompletedQuestionHistoryEntries(existingHistory, incomingHistory)
    );
  }
}

function dispatchCompletedStorageChange(change: Omit<CompletedStorageSyncChange, "sourceId">) {
  if (!isBrowser()) return;
  const userId = change.userId || getActiveStorageUser();

  if (change.sessions) {
    window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: { userId } }));
  }

  if (change.history) {
    window.dispatchEvent(new CustomEvent("completed-question-history-change", { detail: { userId } }));
  }

  if (change.current) {
    window.dispatchEvent(new CustomEvent("current-session-change", { detail: null }));
  }
}

function handleExternalCompletedStorageChange(change: CompletedStorageSyncChange) {
  if (!isBrowser() || change.sourceId === COMPLETED_STORAGE_SYNC_SOURCE_ID) return;
  invalidateCompletedStorageCaches(change.userId);
  applyExternalCompletedStoragePayload(change);
  dispatchCompletedStorageChange(change);
}

function getCompletedStorageSyncChannel() {
  if (!isBrowser() || typeof BroadcastChannel === "undefined") return null;
  if (completedStorageSyncChannel !== undefined) return completedStorageSyncChannel;

  try {
    completedStorageSyncChannel = new BroadcastChannel(COMPLETED_STORAGE_SYNC_CHANNEL);
    (completedStorageSyncChannel as BroadcastChannel & { unref?: () => void }).unref?.();
    completedStorageSyncChannel.onmessage = (event) => {
      const change = event.data as CompletedStorageSyncChange | undefined;
      if (!change || typeof change !== "object") return;
      handleExternalCompletedStorageChange(change);
    };
  } catch {
    completedStorageSyncChannel = null;
  }

  return completedStorageSyncChannel;
}

function installCompletedStorageCrossTabSync() {
  if (!isBrowser()) return;
  if (completedStorageSyncInstalled && completedStorageSyncInstalledWindow === window) return;
  completedStorageSyncInstalled = true;
  completedStorageSyncInstalledWindow = window;

  getCompletedStorageSyncChannel();
  window.addEventListener("storage", (event) => {
    const change = getCompletedStorageChangeFromKey(event.key);
    if (!change) return;
    invalidateCompletedStorageCaches(change.userId);
    dispatchCompletedStorageChange(change);
  });
}

function broadcastCompletedStorageChange(change: Omit<CompletedStorageSyncChange, "sourceId">) {
  if (!isBrowser()) return;
  installCompletedStorageCrossTabSync();
  const payload: CompletedStorageSyncChange = {
    sourceId: COMPLETED_STORAGE_SYNC_SOURCE_ID,
    ...change
  };

  try {
    getCompletedStorageSyncChannel()?.postMessage(payload);
  } catch {
    // BroadcastChannel is a freshness hint; local writes still remain durable.
  }
}

installCompletedStorageCrossTabSync();

function getCompletedHistorySourceUserIds(userId: string) {
  const targetUserId = userId || getActiveStorageUser();
  const sourceUserIds = [targetUserId];

  if (targetUserId !== GUEST_USER_ID) {
    sourceUserIds.push(GUEST_USER_ID);
  }

  return Array.from(new Set(sourceUserIds));
}

export function freeLocalStorageSpaceForAuth() {
  if (!isBrowser()) return 0;

  const removableBaseKeys = [
    CLOUD_COMPLETED_SESSIONS_KEY
  ] as const;
  const activeUserId = safeLocalStorageGetItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
  const removableKeys = new Set<string>();

  for (const baseKey of removableBaseKeys) {
    removableKeys.add(baseKey);
    removableKeys.add(getScopedKeyForUser(baseKey, activeUserId));
    removableKeys.add(getScopedKeyForUser(baseKey, GUEST_USER_ID));
  }

  const existingKeys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) existingKeys.push(key);
    }
  } catch {
    return 0;
  }

  let removedCount = 0;
  for (const key of existingKeys) {
    const canRemove =
      removableKeys.has(key) ||
      removableBaseKeys.some((baseKey) => key.startsWith(`${baseKey}:`));
    if (canRemove && safeLocalStorageRemoveItem(key)) {
      removedCount += 1;
    }
  }

  return removedCount;
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

function getRecentCompletedSessionHandoffScopedKeyForUser(userId: string) {
  return getScopedKeyForUser(RECENT_COMPLETED_SESSION_HANDOFF_KEY, userId);
}

function persistCriticalCompletedSessionPayload(userId: string, key: string, payload: string) {
  if (safeLocalStorageSetItem(key, payload)) {
    safeSessionStorageRemoveItem(key);
    return true;
  }

  // The cloud cache is replaceable. Pending/handoff records are not, so free it
  // before falling back to tab-scoped sessionStorage.
  const cloudCacheKey = getCloudCompletedSessionsScopedKeyForUser(userId);
  if (cloudCacheKey !== key && safeLocalStorageGetItem(cloudCacheKey)) {
    safeLocalStorageRemoveItem(cloudCacheKey);
    if (safeLocalStorageSetItem(key, payload)) {
      safeSessionStorageRemoveItem(key);
      return true;
    }
  }

  return Boolean(safeSessionStorageSetItem(key, payload));
}

function tryPersistJsonToLocalStorageWithSessionFallback(key: string, value: string) {
  if (safeLocalStorageSetItem(key, value)) {
    safeSessionStorageRemoveItem(key);
    return true;
  }

  return Boolean(safeSessionStorageSetItem(key, value));
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

  const scopedKey = getCompletedQuestionHistoryScopedKeyForUser(userId);
  const serialized = JSON.stringify(normalized);
  const changed = safeLocalStorageGetItem(scopedKey) !== serialized;

  cacheCompletedQuestionHistoryForUser(userId, normalized);
  const didPersist = tryPersistJsonToLocalStorageWithSessionFallback(scopedKey, serialized);

  if (changed && userId === getActiveStorageUser()) {
    window.dispatchEvent(
      new CustomEvent("completed-question-history-change", { detail: { userId } })
    );
  }

  if (changed) {
    broadcastCompletedStorageChange({
      userId,
      history: true,
      historyEntries: getCompletedHistoryBroadcastPayload(normalized)
    });
  }

  return didPersist;
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

  const rawValues = [
    safeLocalStorageGetItem(getCompletedQuestionHistoryScopedKeyForUser(userId)) ??
      null,
    safeSessionStorageGetItem(getCompletedQuestionHistoryScopedKeyForUser(userId)) ?? null,
    userId === GUEST_USER_ID ? safeLocalStorageGetItem(COMPLETED_QUESTION_HISTORY_KEY) : null,
    userId === GUEST_USER_ID ? safeSessionStorageGetItem(COMPLETED_QUESTION_HISTORY_KEY) : null
  ].filter((raw): raw is string => Boolean(raw));

  if (rawValues.length === 0) {
    cacheCompletedQuestionHistoryForUser(userId, []);
    return [];
  }

  const entries = rawValues.flatMap((raw) => {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      return parsed
        .map(normalizeCompletedQuestionHistoryEntry)
        .filter((entry): entry is CompletedQuestionHistoryEntry => Boolean(entry));
    } catch {
      return [] as CompletedQuestionHistoryEntry[];
    }
  });

  if (entries.length === 0) {
    cacheCompletedQuestionHistoryForUser(userId, []);
    return [];
  }

  const normalized = mergeCompletedQuestionHistoryEntries([], entries);
  cacheCompletedQuestionHistoryForUser(userId, normalized);
  return normalized;
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
  const sourceUserIds = getCompletedHistorySourceUserIds(userId);
  const historyEntries = mergeCompletedQuestionHistoryEntries(
    [],
    sourceUserIds.flatMap((sourceUserId) =>
      loadCompletedQuestionHistoryEntriesForUser(sourceUserId)
    )
  );
  const shouldUseTailRecovery =
    sourceUserIds.some(
      (sourceUserId) =>
        getCompletedSessionsStorageLengthForUser(sourceUserId) >
        COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT
    );
  const localSessions = sourceUserIds.flatMap((sourceUserId) =>
    shouldUseTailRecovery
      ? loadRecentLocalCompletedSessionsForUploadForUser(
          sourceUserId,
          COMPLETED_SESSIONS_RECENT_RECOVERY_LIMIT
        )
      : loadCompletedSessionsForUser(sourceUserId)
  );
  const sessionDerivedEntries = buildCompletedQuestionHistoryEntriesFromSessions([
    ...localSessions,
    ...sourceUserIds.flatMap((sourceUserId) => loadCloudCompletedSessionsForUser(sourceUserId)),
    ...sourceUserIds.flatMap((sourceUserId) =>
      loadPendingCompletedSessionUploadsForUser(sourceUserId)
    )
  ]);
  const mergedEntries = mergeCompletedQuestionHistoryEntries(historyEntries, sessionDerivedEntries);

  if (mergedEntries.length > 0) {
    if (JSON.stringify(mergedEntries) !== JSON.stringify(historyEntries)) {
      saveCompletedQuestionHistoryEntriesForUser(userId, mergedEntries);
    }
    return [{ attempts: buildSyntheticAttemptsFromQuestionHistory(mergedEntries) }];
  }

  if (shouldUseTailRecovery) {
    return sourceUserIds.flatMap((sourceUserId) =>
      loadRecentLocalCompletedSessionsForUploadForUser(
        sourceUserId,
        COMPLETED_SESSIONS_RECENT_RECOVERY_LIMIT
      )
    );
  }

  return sourceUserIds.flatMap((sourceUserId) => loadCompletedSessionsForUser(sourceUserId));
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

function normalizeOptionKeys(value: unknown): OptionKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
        .filter((item): item is OptionKey => isOptionKey(item))
    )
  );
  return options.length > 0 ? options : undefined;
}

function normalizeOptionEliminationMap(value: unknown): QuizSession["optionEliminationMap"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([questionId, options]) => {
      const normalizedOptions = normalizeOptionKeys(options);
      return questionId.trim() && normalizedOptions ? [questionId.trim(), normalizedOptions] as const : null;
    })
    .filter((entry): entry is readonly [string, OptionKey[]] => Boolean(entry));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
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
    eliminatedOptions: normalizeOptionKeys(raw.eliminatedOptions),
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
    optionEliminationMap: normalizeOptionEliminationMap(session.optionEliminationMap),
    simulationElapsedSeconds:
      typeof session.simulationElapsedSeconds === "number" &&
      Number.isFinite(session.simulationElapsedSeconds) &&
      session.simulationElapsedSeconds > 0
        ? Math.floor(session.simulationElapsedSeconds)
        : undefined,
    simulationTimerDurationSeconds:
      typeof session.simulationTimerDurationSeconds === "number" &&
      Number.isFinite(session.simulationTimerDurationSeconds) &&
      session.simulationTimerDurationSeconds > 0
        ? Math.floor(session.simulationTimerDurationSeconds)
        : undefined,
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

function getQuestionExplanationOverrideTime(override?: QuestionExplanationOverride | null) {
  const rawValue = override?.updatedAt;
  if (!rawValue) return null;
  const timestamp = Date.parse(rawValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function shouldReplaceQuestionExplanationOverride(
  currentOverride?: QuestionExplanationOverride | null,
  nextOverride?: QuestionExplanationOverride | null
) {
  if (!nextOverride) return false;
  if (!currentOverride) return true;

  const currentTime = getQuestionExplanationOverrideTime(currentOverride);
  const nextTime = getQuestionExplanationOverrideTime(nextOverride);

  if (currentTime !== null && nextTime !== null) {
    return nextTime >= currentTime;
  }

  if (currentTime !== null && nextTime === null) {
    return false;
  }

  return true;
}

function areQuestionExplanationOverridesEqual(
  leftOverride?: QuestionExplanationOverride | null,
  rightOverride?: QuestionExplanationOverride | null
) {
  if (!leftOverride || !rightOverride) return leftOverride === rightOverride;
  return (
    leftOverride.explanation === rightOverride.explanation &&
    (leftOverride.memoryTip ?? "") === (rightOverride.memoryTip ?? "") &&
    (leftOverride.model ?? "") === (rightOverride.model ?? "") &&
    (leftOverride.updatedAt ?? "") === (rightOverride.updatedAt ?? "") &&
    JSON.stringify(leftOverride.optionAnalysis ?? {}) ===
      JSON.stringify(rightOverride.optionAnalysis ?? {})
  );
}

export function mergeQuestionExplanationOverrides(
  currentOverrides: Record<string, QuestionExplanationOverride>,
  incomingOverrides: Record<string, QuestionExplanationOverride>
) {
  const merged = { ...currentOverrides };
  let changed = false;

  for (const [questionId, incomingOverride] of Object.entries(incomingOverrides)) {
    if (
      shouldReplaceQuestionExplanationOverride(merged[questionId], incomingOverride) &&
      !areQuestionExplanationOverridesEqual(merged[questionId], incomingOverride)
    ) {
      merged[questionId] = incomingOverride;
      changed = true;
    }
  }

  return changed ? merged : currentOverrides;
}

export function setActiveStorageUser(userId?: string) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(ACTIVE_USER_KEY, userId || GUEST_USER_ID);
}

export function getActiveStorageUser() {
  if (!isBrowser()) return GUEST_USER_ID;
  return safeLocalStorageGetItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
}

function loadCurrentSessionDiscardMap(userId: string) {
  const raw = safeLocalStorageGetItem(
    getScopedKeyForUser(CURRENT_SESSION_DISCARDS_KEY, userId || GUEST_USER_ID)
  );
  if (!raw) return {} as Record<string, number>;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const cutoff = Date.now() - CURRENT_SESSION_DISCARD_TTL_MS;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([sessionId, discardedAt]) =>
          Boolean(sessionId) && typeof discardedAt === "number" && discardedAt >= cutoff
      )
    ) as Record<string, number>;
  } catch {
    return {} as Record<string, number>;
  }
}

export function isCurrentSessionDiscarded(
  sessionId: string,
  userId = getActiveStorageUser()
) {
  if (!isBrowser() || !sessionId) return false;
  return Boolean(loadCurrentSessionDiscardMap(userId)[getCanonicalSessionId(sessionId)]);
}

function markCurrentSessionDiscardedForUser(sessionId: string, userId: string) {
  const canonicalId = getCanonicalSessionId(sessionId);
  const discardMap = loadCurrentSessionDiscardMap(userId);
  discardMap[canonicalId] = Date.now();
  safeLocalStorageSetItem(
    getScopedKeyForUser(CURRENT_SESSION_DISCARDS_KEY, userId || GUEST_USER_ID),
    JSON.stringify(discardMap)
  );
}

export function discardCurrentSession(sessionId: string, userIds: string[] = []) {
  if (!isBrowser() || !sessionId) return;
  const scopedUserIds = Array.from(
    new Set([getActiveStorageUser(), GUEST_USER_ID, ...userIds].filter(Boolean))
  );
  for (const userId of scopedUserIds) {
    markCurrentSessionDiscardedForUser(sessionId, userId);
  }
  clearMatchingCurrentSessions(sessionId, userIds);
}

export function saveCurrentSession(session: QuizSession) {
  if (!isBrowser()) return;
  const activeUser = getActiveStorageUser();
  const canonicalId = getCanonicalSessionId(session.id);
  const alreadyCompleted = completedSessionIdMemoryCache.get(activeUser)?.has(canonicalId) ?? false;

  if (!session.completedAt && isCurrentSessionDiscarded(session.id, activeUser)) {
    clearMatchingCurrentSessions(session.id, [activeUser]);
    return;
  }

  if (!session.completedAt && alreadyCompleted) {
    clearMatchingCurrentSessions(session.id);
    return;
  }

  safeLocalStorageSetItem(getScopedKey(CURRENT_SESSION_KEY), JSON.stringify(compactSessionForStorage(session)));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: session }));
  broadcastCompletedStorageChange({ userId: activeUser, current: true });
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
    const session = normalizeSession(JSON.parse(raw) as QuizSession);
    if (session && !session.completedAt && isCurrentSessionDiscarded(session.id, userId)) {
      safeLocalStorageRemoveItem(scopedKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  const activeUser = getActiveStorageUser();
  safeLocalStorageRemoveItem(getScopedKey(CURRENT_SESSION_KEY));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: null }));
  broadcastCompletedStorageChange({ userId: activeUser, current: true });
}

export function clearCurrentSessionForUser(userId: string) {
  if (!isBrowser()) return;
  safeLocalStorageRemoveItem(getScopedKeyForUser(CURRENT_SESSION_KEY, userId));
  broadcastCompletedStorageChange({ userId, current: true });
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
  for (const userId of scopedUserIds) {
    broadcastCompletedStorageChange({ userId, current: true });
  }
}

export function saveCompletedSession(session: QuizSession) {
  if (!isBrowser()) return;
  const activeUser = getActiveStorageUser();
  saveRecentCompletedSessionHandoffForUser(activeUser, session);
  mergeCompletedQuestionHistoryFromSessionsForUser(activeUser, [session]);

  if (
    getCompletedSessionsStorageLengthForUser(activeUser) > COMPLETED_SESSIONS_HEAVY_READ_LIMIT &&
    !completedSessionsMemoryCache.has(activeUser)
  ) {
    const normalized = normalizeCompletedSessionList([
      ...loadCloudCompletedSessionsForUser(activeUser),
      ...loadPendingCompletedSessionUploadsForUser(activeUser),
      ...loadRecentLocalCompletedSessionsForUploadForUser(
        activeUser,
        COMPLETED_SESSIONS_RECENT_RECOVERY_LIMIT
      ),
      session
    ]);
    saveCloudCompletedSessionsForUser(activeUser, normalized);
    cacheCompletedSessionsForUser(activeUser, normalized);
    for (const item of normalized) {
      clearMatchingCurrentSessions(item.id);
    }
    window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
    broadcastCompletedStorageChange({
      userId: activeUser,
      sessions: true,
      history: true,
      current: true,
      completedSessions: getCompletedSessionBroadcastPayload(normalized)
    });
    return true;
  }

  const sessions = loadCompletedSessions();
  const nextKey = sessionDedupeKey(session);
  const nextSessions = [...sessions.filter((item) => sessionDedupeKey(item) !== nextKey), session];
  return saveCompletedSessions(nextSessions);
}

export function saveCompletedSessions(sessions: QuizSession[]) {
  return saveCompletedSessionsForUser(getActiveStorageUser(), sessions);
}

export function saveCompletedSessionsForUser(userId: string, sessions: QuizSession[]) {
  if (!isBrowser()) return;
  const activeUser = userId || GUEST_USER_ID;
  const scopedKey = getScopedKeyForUser(COMPLETED_SESSIONS_KEY, activeUser);
  const incoming = normalizeCompletedSessionList(sessions);
  const normalized =
    incoming.length > 0
      ? normalizeCompletedSessionList([
          ...(completedSessionsMemoryCache.get(activeUser) ?? []),
          ...loadCloudCompletedSessionsForUser(activeUser),
          ...loadPendingCompletedSessionUploadsForUser(activeUser),
          ...loadRecentCompletedSessionHandoffForUser(activeUser),
          ...incoming
        ])
      : incoming;

  cacheCompletedSessionsForUser(activeUser, normalized);
  if (normalized.length > 0) {
    mergeCompletedQuestionHistoryFromSessionsForUser(activeUser, normalized);
  } else {
    saveCompletedQuestionHistoryEntriesForUser(activeUser, []);
  }

  const persisted = normalized.map(compactSessionForStorage);
  const didPersist = tryPersistJsonToLocalStorageWithSessionFallback(
    scopedKey,
    JSON.stringify(persisted)
  );

  if (!didPersist) {
    if (activeUser === getActiveStorageUser()) {
      window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
    }
    broadcastCompletedStorageChange({
      userId: activeUser,
      sessions: true,
      history: true,
      current: true,
      completedSessions: getCompletedSessionBroadcastPayload(normalized)
    });
    return false;
  }

  for (const session of persisted) {
    clearMatchingCurrentSessions(session.id, [activeUser]);
  }

  if (activeUser === getActiveStorageUser()) {
    window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: normalized }));
  }
  broadcastCompletedStorageChange({
    userId: activeUser,
    sessions: true,
    history: true,
    current: true,
    completedSessions: getCompletedSessionBroadcastPayload(normalized)
  });
  return true;
}

export function loadCompletedSessions(options: LoadCompletedSessionsOptions = {}): QuizSession[] {
  return loadCompletedSessionsAcrossUserScopes(getActiveStorageUser(), options);
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
    safeSessionStorageGetItem(getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId)),
    userId === GUEST_USER_ID ? safeLocalStorageGetItem(COMPLETED_SESSIONS_KEY) : null,
    userId === GUEST_USER_ID ? safeSessionStorageGetItem(COMPLETED_SESSIONS_KEY) : null
  ].filter((raw): raw is string => Boolean(raw));
  const recoverableSessions = rawValues
    .flatMap((raw) => parseRecentCompletedSessionsFromRaw(raw, limit, excludedSessionIds));

  return normalizeCompletedSessionList(recoverableSessions).slice(-limit);
}

export function loadCloudCompletedSessionsForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return [] as QuizSession[];
  const scopedKey = getCloudCompletedSessionsScopedKeyForUser(userId);
  return normalizeCompletedSessionList([
    ...parseCompletedSessionsRaw(safeLocalStorageGetItem(scopedKey)),
    ...parseCompletedSessionsRaw(safeSessionStorageGetItem(scopedKey))
  ]);
}

export function loadRecentCompletedSessionHandoffForUser(userId = getActiveStorageUser()) {
  if (!isBrowser()) return [] as QuizSession[];
  const scopedKey = getRecentCompletedSessionHandoffScopedKeyForUser(userId);
  return normalizeCompletedSessionList([
    ...parseCompletedSessionsRaw(safeLocalStorageGetItem(scopedKey)),
    ...parseCompletedSessionsRaw(safeSessionStorageGetItem(scopedKey)),
    ...(userId === GUEST_USER_ID
      ? parseCompletedSessionsRaw(safeLocalStorageGetItem(RECENT_COMPLETED_SESSION_HANDOFF_KEY))
      : []),
    ...(userId === GUEST_USER_ID
      ? parseCompletedSessionsRaw(safeSessionStorageGetItem(RECENT_COMPLETED_SESSION_HANDOFF_KEY))
      : [])
  ]);
}

export function saveRecentCompletedSessionHandoffForUser(
  userId: string,
  sessions: QuizSession | QuizSession[]
) {
  if (!isBrowser()) return false;
  const incoming = Array.isArray(sessions) ? sessions : [sessions];
  const normalized = normalizeCompletedSessionList([
    ...loadRecentCompletedSessionHandoffForUser(userId),
    ...incoming
  ]).slice(-RECENT_COMPLETED_SESSION_HANDOFF_LIMIT);
  const scopedKey = getRecentCompletedSessionHandoffScopedKeyForUser(userId);
  const payload = JSON.stringify(normalized.map(compactSessionForStorage));
  const didStore = persistCriticalCompletedSessionPayload(userId, scopedKey, payload);

  completedSessionsMemoryCache.delete(userId);
  completedSessionIdMemoryCache.delete(userId);
  broadcastCompletedStorageChange({
    userId,
    sessions: true,
    history: true,
    completedSessions: getCompletedSessionBroadcastPayload(normalized)
  });

  return didStore;
}

export function saveCloudCompletedSessionsForUser(userId: string, sessions: QuizSession[]) {
  if (!isBrowser()) return false;
  const normalized = normalizeCompletedSessionList(sessions);
  const scopedKey = getCloudCompletedSessionsScopedKeyForUser(userId);
  const fullPayload = JSON.stringify(normalized.map(compactSessionForStorage));
  let didPersist = safeLocalStorageSetItem(scopedKey, fullPayload);

  if (didPersist) {
    safeSessionStorageRemoveItem(scopedKey);
  } else {
    didPersist = Boolean(safeSessionStorageSetItem(scopedKey, fullPayload));

    for (const limit of CLOUD_COMPLETED_SESSIONS_FALLBACK_LIMITS) {
      if (normalized.length <= limit) continue;

      const fallbackPayload = JSON.stringify(
        normalized.slice(-limit).map(compactSessionForStorage)
      );
      if (safeLocalStorageSetItem(scopedKey, fallbackPayload)) {
        didPersist = true;
        break;
      }
    }
  }

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

  if (normalized.length > 0) {
    mergeCompletedQuestionHistoryFromSessionsForUser(userId, normalized);
  }

  if (userId === getActiveStorageUser()) {
    window.dispatchEvent(
      new CustomEvent("completed-sessions-change", {
        detail: loadCompletedSessionsForUser(userId)
      })
    );
  }

  broadcastCompletedStorageChange({
    userId,
    sessions: true,
    history: true,
    completedSessions: getCompletedSessionBroadcastPayload(normalized)
  });
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
  const didStore = persistCriticalCompletedSessionPayload(userId, scopedKey, payload);

  completedSessionsMemoryCache.delete(userId);
  completedSessionIdMemoryCache.delete(userId);

  if (userId === getActiveStorageUser()) {
    window.dispatchEvent(
      new CustomEvent("completed-sessions-change", {
        detail: loadCompletedSessionsForUser(userId)
      })
    );
  }

  broadcastCompletedStorageChange({
    userId,
    sessions: true,
    history: true,
    completedSessions: getCompletedSessionBroadcastPayload(normalized)
  });
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

export function loadCompletedSessionsForUser(
  userId: string,
  options: LoadCompletedSessionsOptions = {}
): QuizSession[] {
  if (!isBrowser()) return [];
  const cachedSessions = completedSessionsMemoryCache.get(userId);
  if (cachedSessions && !options.includeFullLocalHistory) return cachedSessions;
  const memorySessions = cachedSessions ?? [];

  const cloudSessions = loadCloudCompletedSessionsForUser(userId);
  const handoffSessions = loadRecentCompletedSessionHandoffForUser(userId);
  const pendingSessions = loadPendingCompletedSessionUploadsForUser(userId);
  const scopedKey = getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId);
  const sessionStorageSessions = [
    ...parseCompletedSessionsRaw(safeSessionStorageGetItem(scopedKey)),
    ...parseCompletedSessionsRaw(
      userId === GUEST_USER_ID ? safeSessionStorageGetItem(COMPLETED_SESSIONS_KEY) : null
    )
  ];
  const raw =
    safeLocalStorageGetItem(scopedKey) ??
    (userId === GUEST_USER_ID ? getLegacyOrScopedRaw(COMPLETED_SESSIONS_KEY) : null);
  if (!raw) {
    const normalized = normalizeCompletedSessionList([
      ...memorySessions,
      ...sessionStorageSessions,
      ...handoffSessions,
      ...cloudSessions,
      ...pendingSessions
    ]);
    cacheCompletedSessionsForUser(userId, normalized);
    return normalized;
  }

  if (raw.length > COMPLETED_SESSIONS_HEAVY_READ_LIMIT) {
    if (raw.length > COMPLETED_SESSIONS_UPLOAD_RECOVERY_READ_LIMIT && !options.includeFullLocalHistory) {
      const normalized = normalizeCompletedSessionList([
        ...memorySessions,
        ...sessionStorageSessions,
        ...handoffSessions,
        ...cloudSessions,
        ...pendingSessions,
        ...loadRecentLocalCompletedSessionsForUploadForUser(
          userId,
          COMPLETED_SESSIONS_RECENT_RECOVERY_LIMIT
        )
      ]);
      cacheCompletedSessionsForUser(userId, normalized);
      return normalized;
    }

    const normalized = normalizeCompletedSessionList([
      ...memorySessions,
      ...parseCompletedSessionsRaw(raw),
      ...sessionStorageSessions,
      ...handoffSessions,
      ...cloudSessions,
      ...pendingSessions
    ]);
    cacheCompletedSessionsForUser(userId, normalized);
    return normalized;
  }

  const normalized = normalizeCompletedSessionList([
    ...memorySessions,
    ...parseCompletedSessionsRaw(raw),
    ...sessionStorageSessions,
    ...handoffSessions,
    ...cloudSessions,
    ...pendingSessions
  ]);
  cacheCompletedSessionsForUser(userId, normalized);
  return normalized;
}

export function loadCompletedSessionsAcrossUserScopes(
  userId = getActiveStorageUser(),
  options: LoadCompletedSessionsOptions = {}
) {
  if (!isBrowser()) return [] as QuizSession[];
  return normalizeCompletedSessionList(
    getCompletedHistorySourceUserIds(userId).flatMap((sourceUserId) =>
      loadCompletedSessionsForUser(sourceUserId, options)
    )
  );
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
  safeLocalStorageRemoveItem(getScopedKey(RECENT_COMPLETED_SESSION_HANDOFF_KEY));
  safeSessionStorageRemoveItem(getScopedKey(COMPLETED_SESSIONS_KEY));
  safeSessionStorageRemoveItem(getScopedKey(CLOUD_COMPLETED_SESSIONS_KEY));
  safeSessionStorageRemoveItem(getScopedKey(PENDING_COMPLETED_SESSION_UPLOADS_KEY));
  safeSessionStorageRemoveItem(getScopedKey(RECENT_COMPLETED_SESSION_HANDOFF_KEY));
  safeLocalStorageRemoveItem(getScopedKey(COMPLETED_QUESTION_HISTORY_KEY));
  safeSessionStorageRemoveItem(getScopedKey(COMPLETED_QUESTION_HISTORY_KEY));
  safeLocalStorageRemoveItem(getScopedKey(CURRENT_SESSION_KEY));
  safeSessionStorageRemoveItem(getScopedKey(CURRENT_SESSION_KEY));
  safeLocalStorageRemoveItem(getScopedKey(CURRENT_SESSION_DISCARDS_KEY));
  broadcastCompletedStorageChange({
    userId: activeUser,
    sessions: true,
    history: true,
    current: true
  });
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

const QUESTION_EXPLANATION_PENDING_SYNC_LIMIT = 200;

export function getPendingQuestionExplanationOverrideSync(
  questionIds: string[],
  sharedOverrides: Record<string, QuestionExplanationOverride>
) {
  const lookupQuestionIds = Array.from(
    new Set(questionIds.map((questionId) => questionId.trim()).filter(Boolean))
  ).slice(0, QUESTION_EXPLANATION_PENDING_SYNC_LIMIT);
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
  const normalizedIncoming = Object.fromEntries(
    Object.entries(overrides)
      .map(([questionId, override]) => {
        const normalized = normalizeQuestionExplanationOverride(override);
        if (!normalized) return null;
        return [questionId, normalized] as const;
      })
      .filter((entry): entry is readonly [string, QuestionExplanationOverride] => Boolean(entry))
  );
  const next = mergeQuestionExplanationOverrides(current, normalizedIncoming);
  safeLocalStorageSetItem(getScopedKey(QUESTION_EXPLANATION_OVERRIDES_KEY), JSON.stringify(next));
}

export type HomeToneMode = "calm" | "anxious";
export type ThemeMode = "light" | "dark";
export type PracticeYearRange = {
  yearFrom: number;
  yearTo: number;
};

export type PracticeQuestionCount = 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;
export type ReviewCompletionThreshold = 1 | 2;

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

export function saveReviewCompletionThreshold(threshold: ReviewCompletionThreshold) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(REVIEW_COMPLETION_THRESHOLD_KEY), String(threshold));
  window.dispatchEvent(new CustomEvent("review-completion-threshold-change", { detail: threshold }));
}

export function loadReviewCompletionThreshold(
  defaultValue: ReviewCompletionThreshold = 2
): ReviewCompletionThreshold {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(REVIEW_COMPLETION_THRESHOLD_KEY);
  return raw === "1" || raw === "2" ? (Number(raw) as ReviewCompletionThreshold) : defaultValue;
}

export function saveKeyboardQuestionNavigation(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(KEYBOARD_QUESTION_NAVIGATION_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("keyboard-question-navigation-change", { detail: enabled }));
}

export function loadKeyboardQuestionNavigation(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(KEYBOARD_QUESTION_NAVIGATION_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function saveSimulationConfidenceCalibration(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(SIMULATION_CONFIDENCE_CALIBRATION_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("simulation-confidence-calibration-change", { detail: enabled }));
}

export function loadSimulationConfidenceCalibration(defaultValue = true) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(SIMULATION_CONFIDENCE_CALIBRATION_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function saveSimulationOptionElimination(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(SIMULATION_OPTION_ELIMINATION_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("simulation-option-elimination-change", { detail: enabled }));
}

export function loadSimulationOptionElimination(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(SIMULATION_OPTION_ELIMINATION_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
}

export function savePharmacologyReverseSwipe(enabled: boolean) {
  if (!isBrowser()) return;
  safeLocalStorageSetItem(getScopedKey(PHARMACOLOGY_REVERSE_SWIPE_KEY), enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("pharmacology-reverse-swipe-change", { detail: enabled }));
}

export function loadPharmacologyReverseSwipe(defaultValue = false) {
  if (!isBrowser()) return defaultValue;
  const raw = getLegacyOrScopedRaw(PHARMACOLOGY_REVERSE_SWIPE_KEY);
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
