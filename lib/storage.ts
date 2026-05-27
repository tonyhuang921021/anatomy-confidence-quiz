import {
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
    case "沒學過":
    case "完全沒印象":
    case "看錯題目 / 粗心":
      return errorType;
    default:
      return undefined;
  }
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

function normalizeSession(session: QuizSession): QuizSession {
  return {
    ...session,
    generatedQuestions: (session.generatedQuestions ?? [])
      .map(normalizeStoredQuestion)
      .filter((question): question is Question => Boolean(question)),
    attempts: session.attempts.map((attempt) => ({
      ...attempt,
      errorType: normalizeErrorType(attempt.errorType)
    }))
  };
}

function normalizeSessions(sessions: QuizSession[]) {
  return sessions.map(normalizeSession);
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
  window.localStorage.setItem(ACTIVE_USER_KEY, userId || GUEST_USER_ID);
}

export function getActiveStorageUser() {
  if (!isBrowser()) return GUEST_USER_ID;
  return window.localStorage.getItem(ACTIVE_USER_KEY) || GUEST_USER_ID;
}

export function saveCurrentSession(session: QuizSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(CURRENT_SESSION_KEY), JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: session }));
}

export function loadCurrentSession(): QuizSession | null {
  return loadCurrentSessionForUser(getActiveStorageUser());
}

export function loadCurrentSessionForUser(userId: string): QuizSession | null {
  if (!isBrowser()) return null;
  const scopedKey = getScopedKeyForUser(CURRENT_SESSION_KEY, userId);
  const raw =
    window.localStorage.getItem(scopedKey) ??
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
  window.localStorage.removeItem(getScopedKey(CURRENT_SESSION_KEY));
  window.dispatchEvent(new CustomEvent("current-session-change", { detail: null }));
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
  window.dispatchEvent(new CustomEvent("completed-sessions-change", { detail: sessions }));
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
  window.localStorage.setItem(getScopedKey(QUESTION_EXPLANATION_OVERRIDES_KEY), JSON.stringify(next));
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

export function savePeakChallengePreload(preload: PeakChallengePreload) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(PEAK_CHALLENGE_PRELOAD_KEY), JSON.stringify(preload));
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
  window.localStorage.removeItem(getScopedKey(PEAK_CHALLENGE_PRELOAD_KEY));
}

export function saveHomeToneMode(mode: HomeToneMode) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(HOME_TONE_MODE_KEY), mode);
  window.dispatchEvent(new CustomEvent("home-tone-mode-change", { detail: mode }));
}

export function loadHomeToneMode(): HomeToneMode {
  if (!isBrowser()) return "calm";
  const raw = getLegacyOrScopedRaw(HOME_TONE_MODE_KEY);
  return raw === "anxious" ? "anxious" : "calm";
}

export function saveThemeMode(mode: ThemeMode) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getScopedKey(THEME_MODE_KEY), mode);
  window.dispatchEvent(new CustomEvent("theme-mode-change", { detail: mode }));
}

export function loadThemeMode(): ThemeMode {
  if (!isBrowser()) return "light";
  const raw = getLegacyOrScopedRaw(THEME_MODE_KEY);
  return raw === "dark" ? "dark" : "light";
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
