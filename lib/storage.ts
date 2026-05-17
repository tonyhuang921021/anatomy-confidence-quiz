import {
  ErrorType,
  Question,
  QuestionExplanationOverride,
  QuizSession,
  QuizSettings
} from "@/types/quiz";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";
const QUESTION_EXPLANATION_OVERRIDES_KEY = "anatomy-confidence-question-explanation-overrides";
const ACTIVE_USER_KEY = "anatomy-confidence-active-user-id";
const GUEST_USER_ID = "guest";

const isBrowser = () => typeof window !== "undefined";

function getScopedKey(baseKey: string) {
  if (!isBrowser()) return `${baseKey}:${GUEST_USER_ID}`;
  const userId = window.localStorage.getItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
  return `${baseKey}:${userId}`;
}

function getScopedKeyForUser(baseKey: string, userId: string) {
  return `${baseKey}:${userId || GUEST_USER_ID}`;
}

function getLegacyOrScopedRaw(baseKey: string) {
  if (!isBrowser()) return null;
  const scopedKey = getScopedKey(baseKey);
  const scopedValue = window.localStorage.getItem(scopedKey);
  if (scopedValue) return scopedValue;

  const legacyValue = window.localStorage.getItem(baseKey);
  if (legacyValue) {
    window.localStorage.setItem(scopedKey, legacyValue);
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
    case "完全沒印象":
    case "看錯題目 / 粗心":
      return errorType;
    default:
      return undefined;
  }
}

function normalizeSession(session: QuizSession): QuizSession {
  return {
    ...session,
    attempts: session.attempts.map((attempt) => ({
      ...attempt,
      errorType: normalizeErrorType(attempt.errorType)
    }))
  };
}

function normalizeSessions(sessions: QuizSession[]) {
  return sessions.map(normalizeSession);
}

export function setActiveStorageUser(userId?: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_USER_KEY, userId || GUEST_USER_ID);
}

export function getActiveStorageUser() {
  if (!isBrowser()) return GUEST_USER_ID;
  return window.localStorage.getItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
}

export function saveCurrentSession(session: QuizSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(CURRENT_SESSION_KEY), JSON.stringify(session));
}

export function loadCurrentSession(): QuizSession | null {
  if (!isBrowser()) return null;
  const raw = getLegacyOrScopedRaw(CURRENT_SESSION_KEY);
  if (!raw) return null;

  try {
    return normalizeSession(JSON.parse(raw) as QuizSession);
  } catch {
    return null;
  }
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(getScopedKey(CURRENT_SESSION_KEY));
}

export function saveCompletedSession(session: QuizSession) {
  if (!isBrowser()) return;
  const sessions = loadCompletedSessions();
  const nextSessions = [...sessions.filter((item) => item.id !== session.id), session];
  saveCompletedSessions(nextSessions);
}

export function saveCompletedSessions(sessions: QuizSession[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(COMPLETED_SESSIONS_KEY), JSON.stringify(sessions));
}

export function loadCompletedSessions(): QuizSession[] {
  return loadCompletedSessionsForUser(getActiveStorageUser());
}

export function loadCompletedSessionsForUser(userId: string): QuizSession[] {
  if (!isBrowser()) return [];
  const scopedKey = getScopedKeyForUser(COMPLETED_SESSIONS_KEY, userId);
  const raw =
    window.localStorage.getItem(scopedKey) ??
    (userId === GUEST_USER_ID ? getLegacyOrScopedRaw(COMPLETED_SESSIONS_KEY) : null);
  if (!raw) return [];

  try {
    return normalizeSessions(JSON.parse(raw) as QuizSession[]);
  } catch {
    return [];
  }
}

export function clearHistory() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(getScopedKey(COMPLETED_SESSIONS_KEY));
  window.localStorage.removeItem(getScopedKey(CURRENT_SESSION_KEY));
}

export function saveQuizSettings(settings: QuizSettings) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(QUIZ_SETTINGS_KEY), JSON.stringify(settings));
}

export function loadQuizSettings(): QuizSettings | null {
  if (!isBrowser()) return null;
  const raw = getLegacyOrScopedRaw(QUIZ_SETTINGS_KEY);
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
    return JSON.parse(raw) as Record<string, QuestionExplanationOverride>;
  } catch {
    return {};
  }
}

export function loadQuestionExplanationOverride(questionId: string) {
  return loadQuestionExplanationOverrides()[questionId];
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
    ...overrides
  };
  window.localStorage.setItem(getScopedKey(QUESTION_EXPLANATION_OVERRIDES_KEY), JSON.stringify(next));
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
