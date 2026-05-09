import { QuizSession, QuizSettings } from "@/types/quiz";

const CURRENT_SESSION_KEY = "anatomy-confidence-current-session";
const COMPLETED_SESSIONS_KEY = "anatomy-confidence-completed-sessions";
const QUIZ_SETTINGS_KEY = "anatomy-confidence-quiz-settings";

const isBrowser = () => typeof window !== "undefined";

export function saveCurrentSession(session: QuizSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
}

export function loadCurrentSession(): QuizSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(CURRENT_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as QuizSession;
  } catch {
    return null;
  }
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CURRENT_SESSION_KEY);
}

export function saveCompletedSession(session: QuizSession) {
  if (!isBrowser()) return;
  const sessions = loadCompletedSessions();
  const nextSessions = [...sessions.filter((item) => item.id !== session.id), session];
  window.localStorage.setItem(COMPLETED_SESSIONS_KEY, JSON.stringify(nextSessions));
}

export function loadCompletedSessions(): QuizSession[] {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(COMPLETED_SESSIONS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as QuizSession[];
  } catch {
    return [];
  }
}

export function clearHistory() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(COMPLETED_SESSIONS_KEY);
  window.localStorage.removeItem(CURRENT_SESSION_KEY);
}

export function saveQuizSettings(settings: QuizSettings) {
  if (!isBrowser()) return;
  window.localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadQuizSettings(): QuizSettings | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(QUIZ_SETTINGS_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as QuizSettings;
  } catch {
    return null;
  }
}
