import { QuizSession, QuizSettings } from "@/types/quiz";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";
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
    return JSON.parse(raw) as QuizSession;
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
    return JSON.parse(raw) as QuizSession[];
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
