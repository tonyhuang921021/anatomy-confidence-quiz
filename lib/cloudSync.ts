import type { User } from "@supabase/supabase-js";
import type {
  Attempt,
  CustomPaperDetail,
  CustomPaperDifficulty,
  CustomPaperSummary,
  FeedbackMessage,
  LeaderboardEntry,
  OwnerDailyPoint,
  OwnerDashboardStats,
  OwnerExplanationUsageEntry,
  OwnerHourlyPoint,
  OwnerTopAttemptVisitorEntry,
  PeakChallengeLeaderboardEntry,
  QuestionClassificationOverride,
  QuestionExplanationOverride,
  QuestionCommunityStats,
  Question,
  QuestionSourceType,
  SubjectName,
  QuizSession,
  VisitorStats
} from "@/types/quiz";
import {
  compactGeneratedQuestionsForStorage,
  compactQuestionForStorage,
  compactSessionForStorage,
  buildCompletedQuestionHistoryEntriesFromSessions,
  clearMatchingCurrentSessions,
  getCompletedSessionsStorageLengthForUser,
  getCanonicalSessionId,
  loadCompletedHistorySessionsForUser,
  loadCloudCompletedSessionsForUser,
  loadPendingCompletedSessionUploadsForUser,
  loadCurrentSession,
  loadCurrentSessionForUser,
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  mergeCompletedQuestionHistoryFromSessionsForUser,
  normalizeSessions,
  queuePendingCompletedSessionUploadForUser,
  loadRecentLocalCompletedSessionsForUploadForUser,
  removePendingCompletedSessionUploadsForUser,
  saveCurrentSession,
  saveCloudCompletedSessionsForUser,
  saveCompletedQuestionHistoryEntriesForUser,
  saveCompletedSessions
} from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
import { normalizeQuestionExplanationOverride } from "@/lib/questionExplanationFormat";
import { getRecoveryTimestamp, isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { getOrCreateVisitorId } from "@/lib/visitor";

type QuizSessionRow = {
  id: string;
  user_id: string;
  subject: string;
  mode?: string | null;
  session_name?: string | null;
  question_count?: number | null;
  correct_count?: number | null;
  wrong_count?: number | null;
  average_confidence?: number | null;
  started_at: string;
  completed_at: string | null;
  session_payload?: Partial<QuizSession> | null;
  updated_at?: string | null;
};

type QuizSessionAttemptRow = {
  session_id: string;
  user_id: string;
  question_order: number;
  question_id: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  confidence: number | null;
  error_type?: string | null;
  answered_at: string;
  source_mode?: string | null;
  subject_snapshot?: string | null;
  chapter_snapshot?: string | null;
  section_snapshot?: string | null;
};

type QuestionAttemptLogRow = {
  session_id: string;
  question_id: string;
  visitor_id?: string | null;
  is_correct: boolean;
  answered_at: string;
  source_mode: string | null;
};

type QuestionAccuracyStatRow = {
  question_id: string;
  total_attempts: number;
  correct_attempts: number;
  correct_rate: number;
  updated_at?: string | null;
};

type QuestionExplanationOverrideRow = {
  question_id: string;
  explanation: string;
  option_analysis?: Record<string, string> | null;
  memory_tip?: string | null;
  model?: string | null;
  updated_at?: string | null;
};

type QuestionClassificationOverrideRow = {
  question_id: string;
  subject: string;
  chapter: string;
  section: string;
  source_report_id?: string | number | null;
  updated_at?: string | null;
};

type QuestionAttemptDeviceRow = {
  visitor_id: string;
  first_attempt_at: string;
  last_attempt_at: string;
};

type QuestionAttemptDeviceDailyRow = {
  visitor_id: string;
  activity_date: string;
  first_attempt_at: string;
  last_attempt_at: string;
};

type OwnerDailyStatRow = {
  activity_date: string;
  attempts: number;
  devices: number;
  updated_at?: string | null;
};

type AIExplanationUsageLogRow = {
  rate_key: string;
  visitor_id?: string | null;
  user_email?: string | null;
  question_id: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  used_at: string;
};

type SharedQuestionExplanationSyncResult = {
  syncedCount: number;
};

export type CommunityRecentAttemptPoint = {
  date: string;
  attempts: number;
  correctRate: number;
};

const AI_SEARCH_USAGE_PREFIX = "AI_SEARCH:";

const SUPABASE_PAGE_SIZE = 1000;
const CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE = 300;
const CLOUD_COMPLETED_SESSION_FETCH_MAX_ROWS = 3000;
const CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT = 3000;
const CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE = 25;
const CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT = 40;
const CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT = 500;
const CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE = 20;
const CURRENT_SESSION_SYNC_MIN_INTERVAL_MS = 10_000;
const STATS_SYNC_ATTEMPT_BATCH_SIZE = 200;
const CLOUD_SESSION_LOOKUP_TIMEOUT_MS = 3500;
const CLOUD_SYNC_BATCH_TIMEOUT_MS = 3500;
const CLOUD_SYNC_TOTAL_BUDGET_MS = 8500;
const LEADERBOARD_PROFILE_CLIENT_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;
const LEADERBOARD_PROFILE_SYNC_MARKER_PREFIX = "leaderboardProfileSync:";
const CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT = 160_000;
const FEEDBACK_REQUEST_TIMEOUT_MS = 10000;
const FEEDBACK_SESSION_TIMEOUT_MS = 2500;
const QUESTION_EXPLANATION_SYNC_IN_FLIGHT_MS = 20_000;
const QUESTION_EXPLANATION_SYNC_COOLDOWN_MS = 60_000;
const QUESTION_EXPLANATION_SYNC_MARKER_PREFIX = "questionExplanationSync:";

type CurrentSessionSyncState = {
  lastSyncedAt: number;
  lastSignature: string;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  pendingSession: QuizSession | null;
  pendingSignature: string;
};

const currentSessionSyncState = new Map<string, CurrentSessionSyncState>();
const sharedQuestionExplanationSyncsInFlight = new Map<
  string,
  Promise<SharedQuestionExplanationSyncResult>
>();
const recentSharedQuestionExplanationSyncs = new Map<string, number>();

function normalizeAttemptSessionId(sessionId: string) {
  return getCanonicalSessionId(sessionId);
}

function dedupeAttemptRows<
  T extends {
    session_id: string;
    question_id: string;
    answered_at?: string;
    is_correct?: boolean;
  }
>(rows: T[]) {
  const deduped = new Map<string, T>();

  for (const row of rows) {
    const normalizedSessionId = normalizeAttemptSessionId(row.session_id);
    const answeredAt = row.answered_at ?? "";
    const correctness =
      typeof row.is_correct === "boolean" ? (row.is_correct ? "1" : "0") : "";
    const dedupeKey = `${normalizedSessionId}::${row.question_id}::${answeredAt}::${correctness}`;
    deduped.set(dedupeKey, {
      ...row,
      session_id: normalizedSessionId
    });
  }

  return Array.from(deduped.values());
}

function withCloudFallback<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs = CLOUD_SESSION_LOOKUP_TIMEOUT_MS
) {
  return new Promise<T>((resolve) => {
    const timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
    task
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timeoutId));
  });
}

function withClientTimeout<T>(task: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    task
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

async function fetchWithClientTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (!controller) {
    return withClientTimeout(fetch(input, init), timeoutMs, timeoutMessage);
  }

  timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function hashText(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function getQuestionExplanationSyncSignature(
  overrides: Array<{
    questionId: string;
    explanation: string;
    optionAnalysis: Record<string, string>;
    memoryTip: string;
    model: string;
    updatedAt?: string;
  }>
) {
  return hashText(
    overrides
      .map((item) => {
        const optionSignature = Object.entries(item.optionAnalysis)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}:${value.length}`)
          .join(",");
        return [
          item.questionId,
          item.updatedAt ?? "",
          item.model,
          item.explanation.length,
          item.memoryTip.length,
          optionSignature
        ].join("|");
      })
      .sort()
      .join("::")
  );
}

function getQuestionExplanationSyncMarkerKey(signature: string) {
  return `${QUESTION_EXPLANATION_SYNC_MARKER_PREFIX}${signature}`;
}

function readQuestionExplanationSyncMarker(signature: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getQuestionExplanationSyncMarkerKey(signature));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      startedAt?: number;
      completedAt?: number;
    };
    return parsed;
  } catch {
    return null;
  }
}

function getLeaderboardProfileSyncMarkerKey(userId: string) {
  return `${LEADERBOARD_PROFILE_SYNC_MARKER_PREFIX}${userId}`;
}

function readLeaderboardProfileSyncMarker(userId: string) {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(getLeaderboardProfileSyncMarkerKey(userId)) ?? "0");
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLeaderboardProfileSyncMarker(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getLeaderboardProfileSyncMarkerKey(userId), String(Date.now()));
  } catch {
    // Leaderboard freshness is best-effort; storage quota should not block quiz sync.
  }
}

function writeQuestionExplanationSyncMarker(
  signature: string,
  marker: { startedAt?: number; completedAt?: number }
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getQuestionExplanationSyncMarkerKey(signature),
      JSON.stringify(marker)
    );
  } catch {
    // localStorage is best-effort; in-memory dedupe still applies.
  }
}

function clearQuestionExplanationSyncMarker(signature: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getQuestionExplanationSyncMarkerKey(signature));
  } catch {
    // ignore storage cleanup failures
  }
}

function shouldSkipRecentQuestionExplanationSync(signature: string, now: number) {
  const recentSyncedAt = recentSharedQuestionExplanationSyncs.get(signature);
  if (recentSyncedAt && now - recentSyncedAt < QUESTION_EXPLANATION_SYNC_COOLDOWN_MS) {
    return true;
  }

  const marker = readQuestionExplanationSyncMarker(signature);
  if (!marker) return false;

  if (
    marker.completedAt &&
    now - marker.completedAt < QUESTION_EXPLANATION_SYNC_COOLDOWN_MS
  ) {
    return true;
  }

  return Boolean(
    marker.startedAt && now - marker.startedAt < QUESTION_EXPLANATION_SYNC_IN_FLIGHT_MS
  );
}

async function getFeedbackAccessToken(user?: Pick<User, "id" | "email" | "user_metadata"> | null) {
  if (!user) return null;

  try {
    return await withClientTimeout(
      getSupabaseBrowserClient().auth.getSession().then((result) => result.data.session?.access_token ?? null),
      FEEDBACK_SESSION_TIMEOUT_MS,
      "登入狀態讀取逾時，已先用匿名身分送出。"
    );
  } catch {
    return null;
  }
}

async function fetchAIExplanationUsageRows() {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [] as AIExplanationUsageLogRow[];
  }

  const supabase = getSupabaseBrowserClient();
  const primary = await supabase
    .from("ai_explanation_usage_logs")
    .select("rate_key, visitor_id, user_email, question_id, model, input_tokens, output_tokens, total_tokens, used_at")
    .order("used_at", { ascending: false });

  if (!primary.error) {
    return (primary.data ?? []) as AIExplanationUsageLogRow[];
  }

  const fallback = await supabase
    .from("ai_explanation_usage_logs")
    .select("rate_key, visitor_id, user_email, question_id, model, used_at")
    .order("used_at", { ascending: false });

  if (fallback.error) {
    throw fallback.error;
  }

  return ((fallback.data ?? []) as AIExplanationUsageLogRow[]).map((row) => ({
    ...row,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  }));
}

function filterAIUsageRows(
  rows: AIExplanationUsageLogRow[],
  feature: "explanation" | "search"
) {
  return rows.filter((row) => {
    const questionId = row.question_id ?? "";
    if (feature === "search") {
      return questionId.startsWith(AI_SEARCH_USAGE_PREFIX);
    }
    return !questionId.startsWith(AI_SEARCH_USAGE_PREFIX);
  });
}

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function getTaipeiDayRange() {
  const taipeiDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const start = new Date(`${taipeiDate}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function getTaipeiDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getRecentTaipeiDayKeys(days: number) {
  const today = new Date();
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    keys.push(getTaipeiDayKey(current));
  }

  return keys;
}

function getVisitorId() {
  return getOrCreateVisitorId();
}

type OwnerApiPayload = {
  ok?: boolean;
  message?: string;
  stats?: OwnerDashboardStats;
  dailySeries?: OwnerDailyPoint[];
  hourlySeries?: OwnerHourlyPoint[];
  explanationUsage?: OwnerExplanationUsageEntry[];
  searchUsage?: OwnerExplanationUsageEntry[];
};

async function fetchOwnerApiPayload() {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return null;
  }

  const response = await fetch("/api/owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as OwnerApiPayload | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "私有數據載入失敗");
  }

  return payload;
}

function mapQuestionClassificationOverrideRow(
  row: QuestionClassificationOverrideRow
): QuestionClassificationOverride {
  return {
    questionId: row.question_id,
    subject: row.subject as QuestionClassificationOverride["subject"],
    chapter: row.chapter,
    section: row.section,
    sourceReportId:
      row.source_report_id === null || row.source_report_id === undefined
        ? undefined
        : String(row.source_report_id),
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

function getFeedbackDisplayName(user: Pick<User, "email" | "user_metadata">) {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";

  if (displayName) return displayName.slice(0, 24);

  if (user.email) {
    return user.email.split("@")[0].slice(0, 24);
  }

  return "已登入使用者";
}

async function fetchAllQuestionAttemptLogs<Row extends Record<string, unknown>>(
  selectClause: string,
  configure?: (query: any) => any
): Promise<Row[]> {
  const supabase = getSupabaseBrowserClient();
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("question_attempt_logs")
      .select(selectClause)
      .order("answered_at", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (configure) {
      query = configure(query as never) as typeof query;
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

async function fetchAllQuestionAttemptDeviceDailyRows<Row extends Record<string, unknown>>(
  selectClause: string,
  configure?: (query: any) => any
): Promise<Row[]> {
  const supabase = getSupabaseBrowserClient();
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("question_attempt_device_daily")
      .select(selectClause)
      .order("activity_date", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (configure) {
      query = configure(query as never) as typeof query;
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

function sessionFreshnessValue(session: QuizSession) {
  return session.completedAt || session.startedAt || "";
}

function sessionActivityValue(session: QuizSession, fallbackUpdatedAt?: string | null) {
  const answeredAtValues = session.attempts
    .map((attempt) => attempt.answeredAt)
    .filter(Boolean)
    .sort();

  return (
    answeredAtValues[answeredAtValues.length - 1] ||
    session.completedAt ||
    fallbackUpdatedAt ||
    session.startedAt ||
    ""
  );
}

function isCompletedQuizSession(session: QuizSession) {
  return Boolean(session.completedAt);
}

function isCompletedQuizSessionRow(row: Pick<QuizSessionRow, "completed_at" | "session_payload">) {
  return Boolean(row.completed_at || row.session_payload?.completedAt);
}

function calculateAverageConfidence(attempts: Attempt[]) {
  if (attempts.length === 0) return null;
  const average = attempts.reduce((sum, attempt) => sum + attempt.confidence, 0) / attempts.length;
  return Math.round(average * 100) / 100;
}

function compactQuestionForCloud(question: Question): Question {
  return compactQuestionForStorage(question);
}

function buildSessionPayloadForCloud(session: QuizSession): Partial<QuizSession> {
  const compacted = compactSessionForStorage(session);
  const generatedQuestions = (compacted.generatedQuestions ?? []).map(compactQuestionForCloud);
  const shouldRetainGeneratedQuestions =
    generatedQuestions.length > 0 &&
    (session.settings?.mode === "custom_paper" ||
      session.settings?.mode === "simulation" ||
      session.settings?.mode === "peak_challenge" ||
      generatedQuestions.some((question) => question.sourceType !== "MOEX_PAST_EXAM"));

  return {
    settings: compacted.settings,
    questionOrder: compacted.questionOrder,
    generatedQuestions: shouldRetainGeneratedQuestions ? generatedQuestions : undefined,
    currentQuestionIndex: session.completedAt ? undefined : compacted.currentQuestionIndex,
    isReviewingAnswer: session.completedAt ? undefined : compacted.isReviewingAnswer,
    attempts: compacted.attempts.length > 0 ? compacted.attempts : undefined
  };
}

function buildSessionRowForCloud(userId: string, session: QuizSession): QuizSessionRow {
  const correctCount = session.attempts.filter((attempt) => attempt.isCorrect).length;
  const wrongCount = session.attempts.length - correctCount;

  return {
    id: session.id,
    user_id: userId,
    subject: session.subject,
    mode: session.settings?.mode ?? null,
    session_name:
      session.settings?.sessionName ??
      session.settings?.customPaperName ??
      session.settings?.customPoolLabel ??
      null,
    question_count: session.questionOrder?.length ?? session.generatedQuestions?.length ?? session.attempts.length,
    correct_count: correctCount,
    wrong_count: wrongCount,
    average_confidence: calculateAverageConfidence(session.attempts),
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    session_payload: buildSessionPayloadForCloud(session)
  };
}

function mapAttemptToCloudRow(userId: string, session: QuizSession, attempt: Attempt, index: number) {
  const generatedQuestion =
    session.generatedQuestions?.find((question) => question.id === attempt.questionId) ?? null;

  return {
    session_id: session.id,
    user_id: userId,
    question_order: index,
    question_id: attempt.questionId,
    selected_answer: attempt.selectedAnswer,
    correct_answer: attempt.correctAnswer,
    is_correct: attempt.isCorrect,
    confidence: attempt.confidence,
    error_type: attempt.errorType ?? null,
    answered_at: attempt.answeredAt,
    source_mode: session.settings?.mode ?? null,
    subject_snapshot: generatedQuestion?.subject ?? null,
    chapter_snapshot: generatedQuestion?.chapter ?? null,
    section_snapshot: generatedQuestion?.section ?? null
  };
}

function mapCloudAttemptRowToAttempt(row: QuizSessionAttemptRow): Attempt {
  return {
    questionId: row.question_id,
    selectedAnswer: row.selected_answer as Attempt["selectedAnswer"],
    correctAnswer: row.correct_answer as Attempt["correctAnswer"],
    isCorrect: row.is_correct,
    confidence:
      row.confidence && row.confidence >= 1 && row.confidence <= 5
        ? (row.confidence as Attempt["confidence"])
        : 3,
    errorType: row.error_type ? (row.error_type as Attempt["errorType"]) : undefined,
    answeredAt: row.answered_at
  };
}

function buildAttemptMap(rows: QuizSessionAttemptRow[]) {
  const attemptMap = new Map<string, Attempt[]>();

  for (const row of rows) {
    const bucket = attemptMap.get(row.session_id) ?? [];
    bucket.push(mapCloudAttemptRowToAttempt(row));
    attemptMap.set(row.session_id, bucket);
  }

  for (const [sessionId, bucket] of attemptMap.entries()) {
    attemptMap.set(
      sessionId,
      bucket.sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
    );
  }

  return attemptMap;
}

function getSinglePastPaperKeyFromAttempts(attempts: Attempt[]) {
  return getSinglePastPaperKeyFromQuestionIds(attempts.map((attempt) => attempt.questionId));
}

function getSinglePastPaperKeyFromQuestionIds(questionIds: string[]) {
  const paperKeys = new Set<string>();

  for (const questionId of questionIds) {
    const match = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
    if (match) {
      paperKeys.add(`${match[1]}-${match[2]}`);
    }
  }

  return paperKeys.size === 1 ? Array.from(paperKeys)[0] : undefined;
}

function dedupeSessionRows(rows: QuizSessionRow[]) {
  const deduped = new Map<string, QuizSessionRow>();

  for (const row of rows) {
    deduped.set(row.id, row);
  }

  return Array.from(deduped.values());
}

function dedupeSessionAttemptRows(rows: ReturnType<typeof mapAttemptToCloudRow>[]) {
  const deduped = new Map<string, ReturnType<typeof mapAttemptToCloudRow>>();

  for (const row of rows) {
    deduped.set(`${row.session_id}::${row.question_order}`, row);
  }

  return Array.from(deduped.values());
}

function namespaceSessionIdForUser(userId: string, sessionId: string) {
  const prefix = `user-${userId}:`;
  return sessionId.startsWith(prefix) ? sessionId : `${prefix}${sessionId}`;
}

function canonicalizeSessionsForUser(userId: string, sessions: QuizSession[]) {
  return sessions.map((session) => ({
    ...session,
    id: namespaceSessionIdForUser(userId, session.id)
  }));
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

function getInferredPastPaperKey(session: QuizSession) {
  return (
    session.settings?.selectedPaperKey ??
    getSinglePastPaperKeyFromAttempts(session.attempts) ??
    getSinglePastPaperKeyFromQuestionIds(session.questionOrder ?? [])
  );
}

function mergeSimulationMetadata(primary: QuizSession, secondary: QuizSession) {
  if (primary.settings?.mode !== "simulation" || secondary.settings?.mode !== "simulation") {
    return primary;
  }

  const primaryName = primary.settings.sessionName?.trim();
  const secondaryName = secondary.settings.sessionName?.trim();
  const primaryPaperKey = getInferredPastPaperKey(primary);
  const secondaryPaperKey = getInferredPastPaperKey(secondary);
  const shouldUseSecondaryName =
    isGenericSimulationSessionName(primaryName) && !isGenericSimulationSessionName(secondaryName);
  const selectedPaperKey = primaryPaperKey ?? secondaryPaperKey;

  if (!shouldUseSecondaryName && primary.settings.selectedPaperKey && primary.settings.paperMode) {
    return primary;
  }

  return {
    ...primary,
    settings: {
      ...primary.settings,
      sessionName: shouldUseSecondaryName ? secondaryName : primary.settings.sessionName,
      paperMode: primary.settings.paperMode ?? (selectedPaperKey ? "past_paper" : secondary.settings.paperMode),
      selectedPaperKey
    }
  };
}

function mergeQuestionListById(primary?: Question[], secondary?: Question[]) {
  const merged = new Map<string, Question>();

  for (const question of secondary ?? []) {
    if (question?.id) merged.set(question.id, question);
  }

  for (const question of primary ?? []) {
    if (question?.id) merged.set(question.id, question);
  }

  return Array.from(merged.values());
}

function mergeQuestionOrder(primary?: string[], secondary?: string[]) {
  const base = (primary?.length ?? 0) >= (secondary?.length ?? 0) ? primary ?? [] : secondary ?? [];
  const extra = base === primary ? secondary ?? [] : primary ?? [];
  return Array.from(new Set([...base, ...extra].filter(Boolean)));
}

function mergeSessionDetails(primary: QuizSession, secondary: QuizSession) {
  const generatedQuestions = mergeQuestionListById(primary.generatedQuestions, secondary.generatedQuestions);
  const customQuestionPayload = mergeQuestionListById(
    primary.settings?.customQuestionPayload,
    secondary.settings?.customQuestionPayload
  );
  const questionOrder = mergeQuestionOrder(primary.questionOrder, secondary.questionOrder);
  const attempts = primary.attempts.length >= secondary.attempts.length ? primary.attempts : secondary.attempts;
  const baseSettings = primary.settings ?? secondary.settings;
  const settings = baseSettings
    ? {
        ...(secondary.settings ?? {}),
        ...(primary.settings ?? {}),
        mode: baseSettings.mode,
        questionCount: baseSettings.questionCount,
        customQuestionIds: mergeQuestionOrder(
          primary.settings?.customQuestionIds,
          secondary.settings?.customQuestionIds
        ),
        customQuestionPayload: customQuestionPayload.length > 0 ? customQuestionPayload : undefined
      }
    : undefined;

  const merged: QuizSession = {
    ...secondary,
    ...primary,
    settings,
    questionOrder: questionOrder.length > 0 ? questionOrder : undefined,
    generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined,
    attempts
  };

  return mergeSimulationMetadata(merged, secondary);
}

function hasBetterSimulationMetadata(localSession: QuizSession, remoteSession: QuizSession) {
  if (localSession.settings?.mode !== "simulation" || remoteSession.settings?.mode !== "simulation") {
    return false;
  }

  const localName = localSession.settings.sessionName?.trim();
  const remoteName = remoteSession.settings.sessionName?.trim();
  const localPaperKey = getInferredPastPaperKey(localSession);
  const remotePaperKey = getInferredPastPaperKey(remoteSession);

  return (
    (!isGenericSimulationSessionName(localName) && isGenericSimulationSessionName(remoteName)) ||
    Boolean(localPaperKey && !remotePaperKey)
  );
}

function mergeSessions(localSessions: QuizSession[], remoteSessions: QuizSession[]) {
  const merged = new Map<string, QuizSession>();

  for (const session of [...localSessions, ...remoteSessions]) {
    const key = getCanonicalSessionId(session.id);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, session);
      continue;
    }

    if (isCompletedQuizSession(current) && !isCompletedQuizSession(session)) {
      continue;
    }

    if (!isCompletedQuizSession(current) && isCompletedQuizSession(session)) {
      merged.set(key, session);
      continue;
    }

    const currentFreshness = sessionFreshnessValue(current);
    const nextFreshness = sessionFreshnessValue(session);
    const nextAttempts = session.attempts.length;
    const currentAttempts = current.attempts.length;

    if (isCompletedQuizSession(current) && isCompletedQuizSession(session) && nextAttempts !== currentAttempts) {
      merged.set(
        key,
        nextAttempts > currentAttempts
          ? mergeSessionDetails(session, current)
          : mergeSessionDetails(current, session)
      );
      continue;
    }

    if (
      nextFreshness > currentFreshness ||
      (nextFreshness === currentFreshness && nextAttempts >= currentAttempts)
    ) {
      merged.set(key, mergeSessionDetails(session, current));
    } else {
      merged.set(key, mergeSessionDetails(current, session));
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    sessionFreshnessValue(b).localeCompare(sessionFreshnessValue(a))
  );
}

function getSessionsNeedingUpload(localSessions: QuizSession[], remoteSessions: QuizSession[]) {
  const remoteById = new Map(remoteSessions.map((session) => [getCanonicalSessionId(session.id), session] as const));

  return localSessions.filter((localSession) => {
    const remoteSession = remoteById.get(getCanonicalSessionId(localSession.id));
    if (!remoteSession) return true;
    if (!isCompletedQuizSession(localSession) && isCompletedQuizSession(remoteSession)) return false;
    if (isCompletedQuizSession(localSession) && !isCompletedQuizSession(remoteSession)) return true;
    if (localSession.attempts.length > remoteSession.attempts.length) return true;
    if (localSession.attempts.length < remoteSession.attempts.length) return false;

    const localFreshness = sessionFreshnessValue(localSession);
    const remoteFreshness = sessionFreshnessValue(remoteSession);
    if (localFreshness > remoteFreshness) return true;
    if (localFreshness < remoteFreshness) return false;
    if (hasBetterSimulationMetadata(localSession, remoteSession)) return true;

    return localSession.attempts.length > remoteSession.attempts.length;
  });
}

function getRecentSessionsWithinUploadBudget(
  sessions: QuizSession[],
  maxSessions: number,
  maxAttempts: number
) {
  const selected: QuizSession[] = [];
  let attemptCount = 0;

  for (const session of sessions) {
    const nextAttemptCount = session.attempts.length;
    if (selected.length >= maxSessions) break;
    if (selected.length > 0 && attemptCount + nextAttemptCount > maxAttempts) break;
    selected.push(session);
    attemptCount += nextAttemptCount;
  }

  return selected;
}

function mapRowToSession(
  row: QuizSessionRow | null,
  attemptMap?: Map<string, Attempt[]>
) {
  if (!row) return null;

  const payload = row.session_payload ?? {};
  const resolvedAttempts = attemptMap?.get(row.id) ?? payload.attempts ?? [];
  const resolvedQuestionOrder =
    payload.questionOrder && payload.questionOrder.length > 0
      ? payload.questionOrder
      : resolvedAttempts.map((attempt) => attempt.questionId);
  const inferredPastPaperKey =
    row.mode === "simulation" ? getSinglePastPaperKeyFromAttempts(resolvedAttempts) : undefined;
  const payloadSettings = payload.settings
    ? ({
        ...payload.settings,
        sessionName: payload.settings.sessionName ?? row.session_name ?? undefined,
        paperMode: payload.settings.paperMode ?? (inferredPastPaperKey ? "past_paper" : undefined),
        selectedPaperKey: payload.settings.selectedPaperKey ?? inferredPastPaperKey
      } as QuizSession["settings"])
    : undefined;

  return normalizeSessions([
    {
      id: row.id,
      subject: (payload.subject as SubjectName | undefined) ?? (row.subject as SubjectName),
      startedAt: payload.startedAt ?? row.started_at,
      completedAt: payload.completedAt ?? row.completed_at ?? undefined,
      settings:
        payloadSettings ??
        (row.mode
          ? ({
              mode: row.mode,
              sessionName: row.session_name ?? undefined,
              paperMode: inferredPastPaperKey ? "past_paper" : undefined,
              selectedPaperKey: inferredPastPaperKey,
              questionCount: row.question_count ?? resolvedQuestionOrder.length
            } as QuizSession["settings"])
          : undefined),
      questionOrder: resolvedQuestionOrder,
      generatedQuestions: payload.generatedQuestions ?? [],
      currentQuestionIndex: payload.currentQuestionIndex,
      isReviewingAnswer: payload.isReviewingAnswer,
      attempts: resolvedAttempts
    }
  ])[0] ?? null;
}

async function fetchActiveQuizSessionRow(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return null;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, updated_at"
    )
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as QuizSessionRow | null) ?? null;
}

async function fetchSessionAttemptRowsForUser(userId: string, sessionIds: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || sessionIds.length === 0) {
    return [] as QuizSessionAttemptRow[];
  }

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionAttemptRow[] = [];

  for (let index = 0; index < sessionIds.length; index += CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE);

    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      const to = from + SUPABASE_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("quiz_session_attempts")
        .select(
          "session_id, user_id, question_order, question_id, selected_answer, correct_answer, is_correct, confidence, error_type, answered_at, source_mode, subject_snapshot, chapter_snapshot, section_snapshot"
        )
        .eq("user_id", userId)
        .in("session_id", chunk)
        .order("session_id", { ascending: true })
        .order("question_order", { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      const pageRows = (data ?? []) as QuizSessionAttemptRow[];
      rows.push(...pageRows);
      if (pageRows.length < SUPABASE_PAGE_SIZE) break;
    }
  }

  return rows;
}

async function fetchQuizSessionsForUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return [] as QuizSessionRow[];

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionRow[] = [];

  for (
    let from = 0;
    from < CLOUD_COMPLETED_SESSION_FETCH_MAX_ROWS;
    from += CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE
  ) {
    const to = Math.min(
      from + CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE - 1,
      CLOUD_COMPLETED_SESSION_FETCH_MAX_ROWS - 1
    );
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, updated_at"
      )
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const pageRows = (data ?? []) as QuizSessionRow[];
    rows.push(...pageRows);
    if (pageRows.length < CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchQuizSessionByIdForUser(userId: string, sessionId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || !sessionId) return null;

  const supabase = getSupabaseBrowserClient();
  const canonicalSessionId = getCanonicalSessionId(sessionId);
  const candidateIds = Array.from(
    new Set([
      sessionId,
      namespaceSessionIdForUser(userId, sessionId),
      canonicalSessionId,
      namespaceSessionIdForUser(userId, canonicalSessionId)
    ])
  );
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, updated_at"
    )
    .eq("user_id", userId)
    .in("id", candidateIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as QuizSessionRow[];
  const exactMatch = rows.find((row) => row.id === sessionId);
  const namespacedMatch = rows.find((row) => row.id === namespaceSessionIdForUser(userId, canonicalSessionId));
  const canonicalMatch = rows.find((row) => getCanonicalSessionId(row.id) === canonicalSessionId);
  return exactMatch ?? namespacedMatch ?? canonicalMatch ?? null;
}

async function fetchResolvedQuizSessionsForUser(userId: string) {
  const sessionRows = await withCloudFallback(fetchQuizSessionsForUser(userId), [] as QuizSessionRow[]);
  const attemptRows = await withCloudFallback(
    fetchSessionAttemptRowsForUser(
      userId,
      sessionRows.map((row) => row.id)
    ),
    [] as QuizSessionAttemptRow[]
  );
  const attemptMap = buildAttemptMap(attemptRows);

  const sessions = sessionRows
    .filter((row) => {
      const expectedAttempts = Math.max(0, row.question_count ?? 0);
      if (expectedAttempts === 0) return true;
      const attempts = attemptMap.get(row.id);
      return Boolean(attempts?.length);
    })
    .map((row) => mapRowToSession(row, attemptMap))
    .filter((session): session is QuizSession => Boolean(session));

  return {
    sessions,
    sessionsMissingAttemptRows: [] as QuizSession[]
  };
}

export async function loadCompletedSessionFromSupabase(sessionId: string) {
  if (isSupabaseRecoveryMode()) return null;
  if (!isSupabaseConfigured() || !sessionId) return null;

  return withCloudFallback(
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return null;

      const row = await fetchQuizSessionByIdForUser(userId, sessionId);
      if (!row?.completed_at) return null;

      const attemptRows = await fetchSessionAttemptRowsForUser(userId, [row.id]);
      const session = mapRowToSession(row, buildAttemptMap(attemptRows));
      return session ? canonicalizeSessionsForUser(userId, [session])[0] ?? session : null;
    })(),
    null
  );
}

function getLeaderboardDisplayName(user: Pick<User, "id" | "email" | "user_metadata">) {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";

  if (displayName) return displayName.slice(0, 24);

  const emailName = user.email?.split("@")[0]?.trim();
  if (emailName) return emailName.slice(0, 24);

  return `玩家-${user.id.slice(0, 6)}`;
}

function mapQuestionAccuracyStatRow(row: QuestionAccuracyStatRow): QuestionCommunityStats {
  return {
    questionId: row.question_id,
    totalAttempts: row.total_attempts,
    correctAttempts: row.correct_attempts,
    correctRate: Number(row.correct_rate ?? 0),
    updatedAt: row.updated_at ?? undefined
  };
}

function mapQuestionExplanationOverrideRow(
  row: QuestionExplanationOverrideRow
): QuestionExplanationOverride {
  const normalized = normalizeQuestionExplanationOverride({
    explanation: row.explanation,
    optionAnalysis: row.option_analysis ?? {},
    memoryTip: row.memory_tip ?? undefined,
    model: row.model ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString()
  });

  return normalized ?? {
    explanation: row.explanation,
    optionAnalysis: row.option_analysis ?? {},
    memoryTip: row.memory_tip ?? undefined,
    model: row.model ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}

function buildQuestionAttemptLogRows(sessions: QuizSession[]): QuestionAttemptLogRow[] {
  const visitorId = getVisitorId();
  return sessions.flatMap((session) =>
    session.attempts.map((attempt) => ({
      session_id: session.id,
      question_id: attempt.questionId,
      visitor_id: visitorId,
      is_correct: attempt.isCorrect,
      answered_at: attempt.answeredAt,
      source_mode: session.settings?.mode ?? null
    }))
  );
}

function buildLatestAttemptStatsSession(session: QuizSession) {
  const latestAttempt = [...session.attempts]
    .filter((attempt) => attempt.answeredAt)
    .sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
    .at(-1);

  if (!latestAttempt) return null;

  return {
    ...session,
    attempts: [latestAttempt]
  };
}

async function upsertQuestionAttemptLogs(sessions: QuizSession[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const rows = buildQuestionAttemptLogRows(sessions);
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("question_attempt_logs")
    .upsert(rows, { onConflict: "session_id,question_id" });

  if (!error) {
    return;
  }

  const missingVisitorColumn =
    typeof error.message === "string" &&
    (error.message.includes("visitor_id") || error.message.includes("question_attempt_logs"));

  if (!missingVisitorColumn) {
    throw error;
  }

  const fallbackRows = rows.map(({ visitor_id, ...rest }) => rest);
  const { error: fallbackError } = await supabase
    .from("question_attempt_logs")
    .upsert(fallbackRows, { onConflict: "session_id,question_id" });

  if (fallbackError) {
    throw fallbackError;
  }
}

async function refreshQuestionAccuracyStats(questionIds: string[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || questionIds.length === 0) return;

  const uniqueQuestionIds = Array.from(new Set(questionIds));
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("question_attempt_logs")
    .select("question_id, is_correct")
    .in("question_id", uniqueQuestionIds);

  if (error) {
    throw error;
  }

  const grouped = new Map<string, { total: number; correct: number }>();

  for (const questionId of uniqueQuestionIds) {
    grouped.set(questionId, { total: 0, correct: 0 });
  }

  for (const row of data ?? []) {
    const current = grouped.get(row.question_id) ?? { total: 0, correct: 0 };
    current.total += 1;
    if (row.is_correct) {
      current.correct += 1;
    }
    grouped.set(row.question_id, current);
  }

  const now = new Date().toISOString();
  const rows: QuestionAccuracyStatRow[] = uniqueQuestionIds.map((questionId) => {
    const stats = grouped.get(questionId) ?? { total: 0, correct: 0 };
    const correctRate =
      stats.total === 0 ? 0 : Number(((stats.correct / stats.total) * 100).toFixed(1));

    return {
      question_id: questionId,
      total_attempts: stats.total,
      correct_attempts: stats.correct,
      correct_rate: correctRate,
      updated_at: now
    };
  });

  const { error: upsertError } = await supabase
    .from("question_accuracy_stats")
    .upsert(rows, { onConflict: "question_id" });

  if (upsertError) {
    throw upsertError;
  }
}

async function refreshAggregatedStatsViaApi(sessions: QuizSession[]) {
  if (isSupabaseRecoveryMode()) return;
  const attemptRows = dedupeAttemptRows(buildQuestionAttemptLogRows(sessions));
  const questionIds = Array.from(
    new Set(attemptRows.map((attempt) => attempt.question_id))
  );
  const activityDates = Array.from(
    new Set(attemptRows.map((attempt) => getTaipeiDayKey(new Date(attempt.answered_at))))
  );
  const visitorId = getVisitorId();
  const timestamps = attemptRows.map((attempt) => attempt.answered_at).sort((a, b) => a.localeCompare(b));
  const deviceRow =
    visitorId && timestamps.length > 0
      ? {
          visitor_id: visitorId,
          first_attempt_at: timestamps[0],
          last_attempt_at: timestamps[timestamps.length - 1]
        }
      : null;
  const deviceDailyGrouped = new Map<string, { first: string; last: string }>();

  for (const timestamp of timestamps) {
    const dayKey = getTaipeiDayKey(new Date(timestamp));
    const current = deviceDailyGrouped.get(dayKey);
    if (!current) {
      deviceDailyGrouped.set(dayKey, { first: timestamp, last: timestamp });
      continue;
    }
    deviceDailyGrouped.set(dayKey, {
      first: current.first < timestamp ? current.first : timestamp,
      last: current.last > timestamp ? current.last : timestamp
    });
  }

  const deviceDailyRows =
    visitorId
      ? Array.from(deviceDailyGrouped.entries()).map(([activity_date, value]) => ({
          visitor_id: visitorId,
          activity_date,
          first_attempt_at: value.first,
          last_attempt_at: value.last
        }))
      : [];

  if (
    questionIds.length === 0 &&
    activityDates.length === 0 &&
    attemptRows.length === 0 &&
    !deviceRow &&
    deviceDailyRows.length === 0
  ) {
    return;
  }

  const attemptBatches =
    attemptRows.length === 0
      ? [[]]
      : Array.from(
          { length: Math.ceil(attemptRows.length / STATS_SYNC_ATTEMPT_BATCH_SIZE) },
          (_, index) =>
            attemptRows.slice(
              index * STATS_SYNC_ATTEMPT_BATCH_SIZE,
              (index + 1) * STATS_SYNC_ATTEMPT_BATCH_SIZE
            )
        );

  for (const [index, attemptBatch] of attemptBatches.entries()) {
    const response = await fetch("/api/stats-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        attemptRows: attemptBatch,
        deviceRow,
        deviceDailyRows: index === 0 ? deviceDailyRows : [],
        questionIds: Array.from(new Set(attemptBatch.map((attempt) => attempt.question_id))),
        activityDates: Array.from(
          new Set(attemptBatch.map((attempt) => getTaipeiDayKey(new Date(attempt.answered_at))))
        )
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message || "統計聚合更新失敗");
    }
  }
}

async function syncQuestionStatsForSessions(sessions: QuizSession[]) {
  if (sessions.length === 0) return;

  await refreshAggregatedStatsViaApi(sessions);
}

async function syncQuestionStatsForSessionsSafely(sessions: QuizSession[]) {
  try {
    await syncQuestionStatsForSessions(sessions);
  } catch (error) {
    console.error("Question stats sync skipped:", error);
  }
}

async function upsertQuestionAttemptDevice(sessions: QuizSession[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const timestamps = sessions.flatMap((session) => session.attempts.map((attempt) => attempt.answeredAt));
  if (timestamps.length === 0) return;

  const sorted = [...timestamps].sort((a, b) => a.localeCompare(b));
  const firstAttemptAt = sorted[0];
  const lastAttemptAt = sorted[sorted.length - 1];

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("question_attempt_devices")
    .upsert(
      {
        visitor_id: visitorId,
        first_attempt_at: firstAttemptAt,
        last_attempt_at: lastAttemptAt
      } satisfies QuestionAttemptDeviceRow,
      { onConflict: "visitor_id" }
    );

  if (error) {
    throw error;
  }
}

async function upsertQuestionAttemptDeviceDaily(sessions: QuizSession[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const grouped = new Map<string, { first: string; last: string }>();

  for (const timestamp of sessions.flatMap((session) => session.attempts.map((attempt) => attempt.answeredAt))) {
    const dayKey = getTaipeiDayKey(new Date(timestamp));
    const current = grouped.get(dayKey);

    if (!current) {
      grouped.set(dayKey, { first: timestamp, last: timestamp });
      continue;
    }

    grouped.set(dayKey, {
      first: current.first < timestamp ? current.first : timestamp,
      last: current.last > timestamp ? current.last : timestamp
    });
  }

  if (grouped.size === 0) return;

  const rows: QuestionAttemptDeviceDailyRow[] = Array.from(grouped.entries()).map(([activityDate, value]) => ({
    visitor_id: visitorId,
    activity_date: activityDate,
    first_attempt_at: value.first,
    last_attempt_at: value.last
  }));

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("question_attempt_device_daily")
    .upsert(rows, { onConflict: "visitor_id,activity_date" });

  if (error) {
    throw error;
  }
}

async function refreshOwnerDailyStatsForDates(activityDates: string[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || activityDates.length === 0) return;

  const uniqueDates = Array.from(new Set(activityDates)).sort();
  const startDate = uniqueDates[0];
  const endDate = uniqueDates[uniqueDates.length - 1];
  const endDateExclusive = new Date(`${endDate}T00:00:00+08:00`);
  endDateExclusive.setDate(endDateExclusive.getDate() + 1);

  const supabase = getSupabaseBrowserClient();
  const [{ data: attemptRows, error: attemptError }, { data: deviceRows, error: deviceError }] =
    await Promise.all([
      supabase
        .from("question_attempt_logs")
        .select("answered_at")
        .gte("answered_at", `${startDate}T00:00:00+08:00`)
        .lt("answered_at", endDateExclusive.toISOString()),
      supabase
        .from("question_attempt_device_daily")
        .select("activity_date")
        .in("activity_date", uniqueDates)
    ]);

  if (attemptError) throw attemptError;
  if (deviceError) throw deviceError;

  const attemptMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  for (const row of attemptRows ?? []) {
    const dayKey = getTaipeiDayKey(new Date(row.answered_at));
    if (!uniqueDates.includes(dayKey)) continue;
    attemptMap.set(dayKey, (attemptMap.get(dayKey) ?? 0) + 1);
  }

  for (const row of deviceRows ?? []) {
    deviceMap.set(row.activity_date, (deviceMap.get(row.activity_date) ?? 0) + 1);
  }

  const rows: OwnerDailyStatRow[] = uniqueDates.map((activityDate) => ({
    activity_date: activityDate,
    attempts: attemptMap.get(activityDate) ?? 0,
    devices: deviceMap.get(activityDate) ?? 0,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from("owner_daily_stats")
    .upsert(rows, { onConflict: "activity_date" });

  if (error) throw error;
}

async function upsertSessionsForUser(userId: string, sessions: QuizSession[]) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const namespacedSessions = canonicalizeSessionsForUser(userId, sessions);
  const rows = dedupeSessionRows(namespacedSessions.map((session) => buildSessionRowForCloud(userId, session)));
  const incompleteSessionIds = rows
    .filter((row) => !isCompletedQuizSessionRow(row))
    .map((row) => row.id);
  const protectedCompletedSessionIds = new Set<string>();

  if (incompleteSessionIds.length > 0) {
    const { data, error: existingError } = await supabase
      .from("quiz_sessions")
      .select("id, completed_at, session_payload")
      .eq("user_id", userId)
      .in("id", incompleteSessionIds);

    if (existingError) {
      throw existingError;
    }

    for (const row of (data ?? []) as Pick<QuizSessionRow, "id" | "completed_at" | "session_payload">[]) {
      if (isCompletedQuizSessionRow(row)) {
        protectedCompletedSessionIds.add(row.id);
      }
    }
  }

  const safeSessions = namespacedSessions.filter(
    (session) => isCompletedQuizSession(session) || !protectedCompletedSessionIds.has(session.id)
  );
  const safeRows = rows.filter((row) => !protectedCompletedSessionIds.has(row.id));

  for (const sessionId of protectedCompletedSessionIds) {
    clearMatchingCurrentSessions(sessionId, [userId]);
  }

  if (safeRows.length === 0) return;

  const { error } = await supabase
    .from("quiz_sessions")
    .upsert(safeRows, { onConflict: "id" });

  if (error) {
    throw error;
  }

  const attemptRows = dedupeSessionAttemptRows(
    safeSessions.flatMap((session) =>
      session.attempts.map((attempt, index) => mapAttemptToCloudRow(userId, session, attempt, index))
    )
  );

  if (attemptRows.length === 0) return;

  const { error: attemptError } = await supabase
    .from("quiz_session_attempts")
    .upsert(attemptRows, { onConflict: "session_id,question_order" });

  if (attemptError) {
    throw attemptError;
  }
}

async function upsertSessionsForUserInBatches(
  userId: string,
  sessions: QuizSession[],
  batchSize = CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE,
  options: {
    batchTimeoutMs?: number;
    totalBudgetMs?: number;
  } = {}
) {
  const startedAt = Date.now();

  for (let index = 0; index < sessions.length; index += batchSize) {
    if (options.totalBudgetMs && Date.now() - startedAt > options.totalBudgetMs) {
      throw new Error("雲端同步仍在背景整理，先保留本機紀錄。");
    }

    const batch = sessions.slice(index, index + batchSize);
    const task = upsertSessionsForUser(userId, batch);
    if (options.batchTimeoutMs) {
      await withClientTimeout(task, options.batchTimeoutMs, "單批雲端同步逾時，先保留本機紀錄。");
    } else {
      await task;
    }
  }
}

async function upsertSessionsForUserInBatchesSafely(userId: string, sessions: QuizSession[]) {
  try {
    await upsertSessionsForUserInBatches(userId, sessions);
  } catch (error) {
    console.error("Completed session backfill skipped:", error);
  }
}

export async function syncCompletedSessionsForCurrentUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return loadCompletedSessions();
  }

  const localCompletedSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessions(loadCompletedSessionsForUser("guest"), loadCompletedSessions())
      .filter(isCompletedQuizSession)
  );
  const localSessionsToSync = [...localCompletedSessions]
    .sort((left, right) => sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left)))
    .slice(0, CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT);
  const { sessions: fetchedRemoteSessions, sessionsMissingAttemptRows } =
    await fetchResolvedQuizSessionsForUser(userId);
  const remoteSessions = canonicalizeSessionsForUser(
    userId,
    fetchedRemoteSessions.filter(isCompletedQuizSession)
  );
  const mergedSessions = mergeSessions(localCompletedSessions, remoteSessions).filter(isCompletedQuizSession);
  const sessionsToUpload = getSessionsNeedingUpload(localSessionsToSync, remoteSessions);
  const sessionsToBackfill = canonicalizeSessionsForUser(
    userId,
    sessionsMissingAttemptRows.filter(isCompletedQuizSession)
  );

  saveCompletedSessions(mergedSessions);
  saveCompletedQuestionHistoryEntriesForUser(
    userId,
    buildCompletedQuestionHistoryEntriesFromSessions(mergedSessions)
  );
  if (sessionsToBackfill.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToBackfill);
  }
  if (sessionsToUpload.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToUpload);
  }

  return mergedSessions;
}

export async function syncLocalCompletedSessionsForCurrentUser(userId: string) {
  const hasHeavyLocalHistory =
    getCompletedSessionsStorageLengthForUser(userId) > CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT ||
    getCompletedSessionsStorageLengthForUser("guest") > CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT;
  const { sessions: fetchedRemoteSessions } =
    isSupabaseRecoveryMode() || !isSupabaseConfigured()
      ? { sessions: [] as QuizSession[] }
      : await fetchResolvedQuizSessionsForUser(userId);
  const remoteSessions = canonicalizeSessionsForUser(
    userId,
    fetchedRemoteSessions.filter(isCompletedQuizSession)
  );
  const remoteSessionIds = new Set(remoteSessions.map((session) => getCanonicalSessionId(session.id)));
  const pendingCompletedSessionUploads = canonicalizeSessionsForUser(
    userId,
    mergeSessions(
      mergeSessions(
        loadPendingCompletedSessionUploadsForUser(userId),
        loadRecentLocalCompletedSessionsForUploadForUser(userId, undefined, remoteSessionIds)
      ),
      loadRecentLocalCompletedSessionsForUploadForUser("guest", undefined, remoteSessionIds)
    ).filter(isCompletedQuizSession)
  );

  const localCompletedSessions = hasHeavyLocalHistory
    ? pendingCompletedSessionUploads
    : canonicalizeSessionsForUser(
        userId,
        mergeSessions(
          mergeSessions(loadCompletedSessionsForUser("guest"), loadCompletedSessions()),
          pendingCompletedSessionUploads
        )
          .filter(isCompletedQuizSession)
      );
  const mergedSessions = hasHeavyLocalHistory
    ? mergeSessions(pendingCompletedSessionUploads, remoteSessions).filter(isCompletedQuizSession)
    : mergeSessions(localCompletedSessions, remoteSessions).filter(isCompletedQuizSession);
  const localSessionsToSync = getRecentSessionsWithinUploadBudget(
    [...localCompletedSessions].sort((left, right) =>
      sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
    ),
    CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT,
    CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT
  );

  const cloudCacheSessions = hasHeavyLocalHistory ? mergedSessions : remoteSessions;
  if (cloudCacheSessions.length > 0) {
    saveCloudCompletedSessionsForUser(userId, cloudCacheSessions);
  }

  if (hasHeavyLocalHistory) {
    const historySessions = loadCompletedHistorySessionsForUser(userId);
    if (historySessions.length === 0 && remoteSessions.length > 0) {
      saveCompletedQuestionHistoryEntriesForUser(
        userId,
        buildCompletedQuestionHistoryEntriesFromSessions(remoteSessions)
      );
    }
  } else {
    saveCompletedSessions(mergedSessions);
    saveCompletedQuestionHistoryEntriesForUser(
      userId,
      buildCompletedQuestionHistoryEntriesFromSessions(mergedSessions)
    );
  }

  const sessionsToUpload = getSessionsNeedingUpload(localSessionsToSync, remoteSessions);

  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || sessionsToUpload.length === 0) {
    return mergedSessions;
  }

  await upsertSessionsForUserInBatches(
    userId,
    sessionsToUpload,
    Math.min(10, CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE),
    {
      batchTimeoutMs: CLOUD_SYNC_BATCH_TIMEOUT_MS,
      totalBudgetMs: CLOUD_SYNC_TOTAL_BUDGET_MS
    }
  );
  removePendingCompletedSessionUploadsForUser(userId, sessionsToUpload);

  return mergedSessions;
}

export async function syncCurrentSessionForCurrentUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return loadCurrentSession();
  }

  const guestSession = loadCurrentSessionForUser("guest");
  const localUserSession = loadCurrentSessionForUser(userId);
  let localCurrentSession: QuizSession | null =
    [localUserSession, guestSession]
      .filter((session): session is QuizSession => Boolean(session) && !session?.completedAt)
      .sort((left, right) => sessionActivityValue(right).localeCompare(sessionActivityValue(left)))[0] ?? null;

  if (localCurrentSession) {
    const completedSessionIds = new Set(
      mergeSessions(loadCompletedSessionsForUser("guest"), loadCompletedSessionsForUser(userId))
        .filter((completedSession) => Boolean(completedSession.completedAt))
        .map((completedSession) => getCanonicalSessionId(completedSession.id))
    );
    if (completedSessionIds.has(getCanonicalSessionId(localCurrentSession.id))) {
      clearMatchingCurrentSessions(localCurrentSession.id, [userId]);
      localCurrentSession = null;
    }
  }

  const remoteRow = await withCloudFallback(fetchActiveQuizSessionRow(userId), null);
  const remoteAttemptMap = remoteRow
    ? buildAttemptMap(
        await withCloudFallback(fetchSessionAttemptRowsForUser(userId, [remoteRow.id]), [] as QuizSessionAttemptRow[])
      )
    : undefined;
  const remoteCurrentSession = remoteRow ? mapRowToSession(remoteRow, remoteAttemptMap) : null;

  const localActivity = localCurrentSession ? sessionActivityValue(localCurrentSession) : "";
  const remoteActivity = remoteCurrentSession
    ? sessionActivityValue(remoteCurrentSession, remoteRow?.updated_at)
    : "";

  let winner = localCurrentSession;

  if (remoteCurrentSession && (!winner || remoteActivity > localActivity)) {
    winner = canonicalizeSessionsForUser(userId, [remoteCurrentSession])[0] ?? remoteCurrentSession;
    saveCurrentSession(winner);
  }

  if (winner && !winner.completedAt) {
    await withCloudFallback(
      upsertSessionsForUser(userId, canonicalizeSessionsForUser(userId, [winner])).then(() => true),
      false
    );
  }

  return winner ?? remoteCurrentSession ?? null;
}

export async function syncLocalCurrentSessionForCurrentUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return loadCurrentSession();
  }

  const guestSession = loadCurrentSessionForUser("guest");
  const localUserSession = loadCurrentSessionForUser(userId);
  const localCurrentSession =
    [localUserSession, guestSession]
      .filter((session): session is QuizSession => Boolean(session) && !session?.completedAt)
      .sort((left, right) => sessionActivityValue(right).localeCompare(sessionActivityValue(left)))[0] ?? null;

  if (!localCurrentSession) return null;

  const canonicalSession = canonicalizeSessionsForUser(userId, [localCurrentSession])[0] ?? localCurrentSession;
  await withClientTimeout(
    upsertSessionsForUser(userId, [canonicalSession]),
    CLOUD_SYNC_BATCH_TIMEOUT_MS,
    "目前作答雲端同步逾時，先保留本機紀錄。"
  );

  return canonicalSession;
}

export async function pushCompletedSessionToSupabase(session: QuizSession) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const canonicalSessions = canonicalizeSessionsForUser(data.user.id, [session]);
    queuePendingCompletedSessionUploadForUser(data.user.id, canonicalSessions);
    mergeCompletedQuestionHistoryFromSessionsForUser(data.user.id, canonicalSessions);
    if (getCompletedSessionsStorageLengthForUser(data.user.id) <= CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT) {
      saveCompletedSessions(
        mergeSessions(
          loadCompletedSessions(),
          canonicalSessions
        )
      );
    }
    await withClientTimeout(
      upsertSessionsForUser(data.user.id, canonicalSessions),
      CLOUD_SYNC_BATCH_TIMEOUT_MS,
      "完成紀錄雲端同步逾時，先保留本機紀錄。"
    );
    saveCloudCompletedSessionsForUser(
      data.user.id,
      mergeSessions(loadCloudCompletedSessionsForUser(data.user.id), canonicalSessions)
    );
    removePendingCompletedSessionUploadsForUser(data.user.id, canonicalSessions);
    void syncLeaderboardProfileForCurrentUser(data.user, loadCompletedSessions()).catch((error) => {
      console.error("Leaderboard sync skipped:", error);
    });
  }
}

export async function pushQuestionStatsSnapshotToSupabase(session: QuizSession) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;
  if (session.completedAt) {
    await syncQuestionStatsForSessionsSafely([session]);
    return;
  }

  const latestAttemptSession = buildLatestAttemptStatsSession(session);
  if (!latestAttemptSession) return;
  await syncQuestionStatsForSessionsSafely([latestAttemptSession]);
}

export async function pushCurrentSessionToSupabase(session: QuizSession) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || session.completedAt) return;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const userId = user.id;

  const canonicalSession = canonicalizeSessionsForUser(userId, [session])[0];
  if (!canonicalSession) return;

  const latestAttemptAt =
    canonicalSession.attempts
      .map((attempt) => attempt.answeredAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? "";
  const signature = [
    canonicalSession.id,
    canonicalSession.currentQuestionIndex ?? 0,
    canonicalSession.isReviewingAnswer ? "reviewing" : "answering",
    canonicalSession.attempts.length,
    latestAttemptAt,
    canonicalSession.questionOrder?.length ?? 0
  ].join("|");
  const stateKey = `${userId}:${canonicalSession.id}`;
  const now = Date.now();
  const existing = currentSessionSyncState.get(stateKey);

  if (existing?.lastSignature === signature) return;

  async function flush(nextSession: QuizSession, nextSignature: string) {
    await withClientTimeout(
      upsertSessionsForUser(userId, [nextSession]),
      CLOUD_SYNC_BATCH_TIMEOUT_MS,
      "目前作答雲端同步逾時，先保留本機紀錄。"
    );
    currentSessionSyncState.set(stateKey, {
      lastSyncedAt: Date.now(),
      lastSignature: nextSignature,
      pendingTimer: null,
      pendingSession: null,
      pendingSignature: ""
    });
  }

  if (!existing || now - existing.lastSyncedAt >= CURRENT_SESSION_SYNC_MIN_INTERVAL_MS) {
    if (existing?.pendingTimer) {
      clearTimeout(existing.pendingTimer);
    }
    await flush(canonicalSession, signature);
    return;
  }

  const remaining = CURRENT_SESSION_SYNC_MIN_INTERVAL_MS - (now - existing.lastSyncedAt);
  if (existing.pendingTimer) {
    existing.pendingSession = canonicalSession;
    existing.pendingSignature = signature;
    currentSessionSyncState.set(stateKey, existing);
    return;
  }

  const nextState: CurrentSessionSyncState = {
    ...existing,
    pendingSession: canonicalSession,
    pendingSignature: signature,
    pendingTimer: setTimeout(() => {
      const latestState = currentSessionSyncState.get(stateKey);
      const pendingSession = latestState?.pendingSession;
      const pendingSignature = latestState?.pendingSignature || signature;
      latestState?.pendingTimer && clearTimeout(latestState.pendingTimer);
      if (!pendingSession) return;
      void flush(pendingSession, pendingSignature).catch((error) => {
        console.error("Current session cloud sync skipped:", error);
        currentSessionSyncState.set(stateKey, {
          lastSyncedAt: latestState?.lastSyncedAt ?? 0,
          lastSignature: latestState?.lastSignature ?? "",
          pendingTimer: null,
          pendingSession: pendingSession,
          pendingSignature
        });
      });
    }, remaining)
  };
  currentSessionSyncState.set(stateKey, nextState);
}

export async function syncLeaderboardProfileForCurrentUser(
  user: Pick<User, "id" | "email" | "user_metadata">,
  sessions?: QuizSession[],
  options: { force?: boolean } = {}
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  if (!options.force) {
    const lastSyncedAt = readLeaderboardProfileSyncMarker(user.id);
    if (Date.now() - lastSyncedAt < LEADERBOARD_PROFILE_CLIENT_SYNC_MIN_INTERVAL_MS) {
      return;
    }
  }

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  const response = await fetchWithClientTimeout(
    "/api/leaderboard/sync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken,
        displayName: getLeaderboardDisplayName(user)
      })
    },
    8000,
    "刷題榜雲端重算逾時"
  );

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "刷題榜雲端重算失敗");
  }
  writeLeaderboardProfileSyncMarker(user.id);
}

export async function updateLeaderboardDisplayName(
  user: Pick<User, "id" | "email" | "user_metadata">,
  displayName: string
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const trimmed = displayName.trim().slice(0, 24) || getLeaderboardDisplayName(user);
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  const response = await fetchWithClientTimeout(
    "/api/leaderboard/sync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken,
        displayName: trimmed
      })
    },
    8000,
    "刷題榜暱稱同步逾時"
  );

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || "刷題榜暱稱同步失敗");
  }
  writeLeaderboardProfileSyncMarker(user.id);
}

export async function loadLeaderboard(limit = 50, options: { signal?: AbortSignal } = {}) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [] as LeaderboardEntry[];
  }

  const response = await fetch(`/api/leaderboard?limit=${encodeURIComponent(String(limit))}`, {
    signal: options.signal
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; leaderboard?: LeaderboardEntry[] }
    | null;

  if (!response.ok || !payload?.ok || !payload.leaderboard) {
    throw new Error(payload?.message || "刷題榜載入失敗");
  }

  return payload.leaderboard;
}

const BACKGROUND_STATS_LOOKUP_CHUNK_SIZE = 100;
const BACKGROUND_STATS_LOOKUP_LIMIT = 200;
const BACKGROUND_CLASSIFICATION_LOOKUP_LIMIT = 500;
const BACKGROUND_DATA_CACHE_VERSION = "v4";
const BACKGROUND_DATA_STORAGE_PREFIX = `aq:bg:${BACKGROUND_DATA_CACHE_VERSION}:`;
const BACKGROUND_DATA_LOCAL_STORAGE_MAX_BYTES = 180_000;
const BACKGROUND_DATA_TTL_MS = {
  stats: 30 * 60 * 1000,
  explanations: 6 * 60 * 60 * 1000,
  classifications: 12 * 60 * 60 * 1000,
  allClassifications: 24 * 60 * 60 * 1000
};

type BackgroundPayloadBase = {
  ok?: boolean;
  message?: string;
  degraded?: boolean;
  recovery?: boolean;
};

type BackgroundCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const backgroundDataMemoryCache = new Map<string, BackgroundCacheEntry<unknown>>();
const backgroundDataRequestsInFlight = new Map<string, Promise<unknown>>();

function getBackgroundStorage(storageName: "sessionStorage" | "localStorage") {
  if (typeof window === "undefined") return null;
  try {
    return window[storageName] ?? null;
  } catch {
    return null;
  }
}

function readBackgroundStorageCache<T>(
  storageName: "sessionStorage" | "localStorage",
  key: string,
  now: number
): T | undefined {
  const storage = getBackgroundStorage(storageName);
  if (!storage) return undefined;

  try {
    const storageKey = `${BACKGROUND_DATA_STORAGE_PREFIX}${key}`;
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) return undefined;
    const entry = JSON.parse(rawValue) as BackgroundCacheEntry<T>;
    if (!entry || typeof entry.expiresAt !== "number" || entry.expiresAt <= now) {
      storage.removeItem(storageKey);
      return undefined;
    }
    backgroundDataMemoryCache.set(key, entry as BackgroundCacheEntry<unknown>);
    return entry.value;
  } catch {
    return undefined;
  }
}

function shouldPersistBackgroundCacheInLocalStorage(key: string) {
  return (
    key === "classification:all" ||
    key.startsWith("classification:") ||
    key.startsWith("explanation:") ||
    key.startsWith("stats:")
  );
}

function writeBackgroundStorageCache<T>(
  storageName: "sessionStorage" | "localStorage",
  key: string,
  entry: BackgroundCacheEntry<T>
) {
  const storage = getBackgroundStorage(storageName);
  if (!storage) return;

  try {
    const serialized = JSON.stringify(entry);
    if (storageName === "localStorage" && serialized.length > BACKGROUND_DATA_LOCAL_STORAGE_MAX_BYTES) {
      return;
    }
    storage.setItem(`${BACKGROUND_DATA_STORAGE_PREFIX}${key}`, serialized);
  } catch {
    // Browser storage is best-effort. Memory cache still handles the current page.
  }
}

function readBackgroundCache<T>(key: string): T | undefined {
  const now = Date.now();
  const memoryEntry = backgroundDataMemoryCache.get(key) as BackgroundCacheEntry<T> | undefined;
  if (memoryEntry) {
    if (memoryEntry.expiresAt > now) return memoryEntry.value;
    backgroundDataMemoryCache.delete(key);
  }

  const sessionValue = readBackgroundStorageCache<T>("sessionStorage", key, now);
  if (sessionValue !== undefined) return sessionValue;

  return readBackgroundStorageCache<T>("localStorage", key, now);
}

function writeBackgroundCache<T>(key: string, value: T, ttlMs: number) {
  const entry: BackgroundCacheEntry<T> = {
    expiresAt: Date.now() + ttlMs,
    value
  };
  backgroundDataMemoryCache.set(key, entry as BackgroundCacheEntry<unknown>);

  writeBackgroundStorageCache("sessionStorage", key, entry);
  if (shouldPersistBackgroundCacheInLocalStorage(key)) {
    writeBackgroundStorageCache("localStorage", key, entry);
  }
}

function isFreshBackgroundPayload(payload: BackgroundPayloadBase | null | undefined) {
  return Boolean(payload?.ok && !payload.degraded && !payload.recovery);
}

async function fetchBackgroundData<T extends BackgroundPayloadBase>(cacheKey: string, url: string): Promise<T> {
  const existing = backgroundDataRequestsInFlight.get(cacheKey) as Promise<T> | undefined;
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(url);
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || "背景資料讀取失敗");
    }
    return payload;
  })();

  backgroundDataRequestsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    backgroundDataRequestsInFlight.delete(cacheKey);
  }
}

export async function loadQuestionCommunityStats(questionIds: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || questionIds.length === 0) {
    return [] as QuestionCommunityStats[];
  }

  const uniqueQuestionIds = Array.from(new Set(questionIds)).slice(0, BACKGROUND_STATS_LOOKUP_LIMIT);
  const cachedStats = new Map<string, QuestionCommunityStats | null>();
  const missingQuestionIds = uniqueQuestionIds.filter((questionId) => {
    const cachedValue = readBackgroundCache<QuestionCommunityStats | null>(`stats:${questionId}`);
    if (cachedValue !== undefined) {
      cachedStats.set(questionId, cachedValue);
      return false;
    }
    return true;
  });

  for (let index = 0; index < missingQuestionIds.length; index += BACKGROUND_STATS_LOOKUP_CHUNK_SIZE) {
    const requestIds = missingQuestionIds
      .slice(index, index + BACKGROUND_STATS_LOOKUP_CHUNK_SIZE)
      .sort();

    try {
      const payload = await fetchBackgroundData<
        BackgroundPayloadBase & { stats?: QuestionAccuracyStatRow[] }
      >(
        `stats:${requestIds.join(",")}`,
        `/api/question-background-data?kind=stats&ids=${encodeURIComponent(requestIds.join(","))}`
      );
      const mappedStats = (payload.stats ?? []).map((row) =>
        mapQuestionAccuracyStatRow(row as QuestionAccuracyStatRow)
      );
      const mappedStatsByQuestionId = new Map(mappedStats.map((row) => [row.questionId, row] as const));

      if (isFreshBackgroundPayload(payload)) {
        for (const questionId of requestIds) {
          writeBackgroundCache(
            `stats:${questionId}`,
            mappedStatsByQuestionId.get(questionId) ?? null,
            BACKGROUND_DATA_TTL_MS.stats
          );
        }
      }

      for (const stat of mappedStats) {
        cachedStats.set(stat.questionId, stat);
      }
    } catch (error) {
      if (cachedStats.size === 0) {
        throw error;
      }
      break;
    }
  }

  return uniqueQuestionIds
    .map((questionId) => cachedStats.get(questionId))
    .filter((item): item is QuestionCommunityStats => Boolean(item));
}

export async function loadSharedQuestionExplanationOverrides(questionIds: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || questionIds.length === 0) {
    return {} as Record<string, QuestionExplanationOverride>;
  }

  const uniqueQuestionIds = Array.from(new Set(questionIds)).slice(0, 20);
  const cachedOverrides = new Map<string, QuestionExplanationOverride | null>();
  const missingQuestionIds = uniqueQuestionIds.filter((questionId) => {
    const cachedValue = readBackgroundCache<QuestionExplanationOverride | null>(`explanation:${questionId}`);
    if (cachedValue !== undefined) {
      cachedOverrides.set(questionId, cachedValue);
      return false;
    }
    return true;
  });

  if (missingQuestionIds.length > 0) {
    try {
      const requestIds = [...missingQuestionIds].sort();
      const payload = await fetchBackgroundData<
        BackgroundPayloadBase & { overrides?: QuestionExplanationOverrideRow[] }
      >(
        `explanations:${requestIds.join(",")}`,
        `/api/question-background-data?kind=explanations&ids=${encodeURIComponent(requestIds.join(","))}`
      );
      const mappedOverrides = new Map(
        (payload.overrides ?? []).map((row) => {
          const typedRow = row as QuestionExplanationOverrideRow;
          return [typedRow.question_id, mapQuestionExplanationOverrideRow(typedRow)] as const;
        })
      );

      if (isFreshBackgroundPayload(payload)) {
        for (const questionId of missingQuestionIds) {
          writeBackgroundCache(
            `explanation:${questionId}`,
            mappedOverrides.get(questionId) ?? null,
            BACKGROUND_DATA_TTL_MS.explanations
          );
        }
      }

      for (const [questionId, override] of mappedOverrides.entries()) {
        cachedOverrides.set(questionId, override);
      }
    } catch (error) {
      if (cachedOverrides.size === 0) {
        throw error;
      }
    }
  }

  return Object.fromEntries(
    uniqueQuestionIds
      .map((questionId) => [questionId, cachedOverrides.get(questionId)] as const)
      .filter((entry): entry is readonly [string, QuestionExplanationOverride] => Boolean(entry[1]))
  );
}

export async function syncSharedQuestionExplanationOverrides(
  overrides: Array<{
    questionId: string;
    override: QuestionExplanationOverride;
  }>,
  accessToken?: string | null
): Promise<SharedQuestionExplanationSyncResult> {
  if (isSupabaseRecoveryMode()) {
    return { syncedCount: 0 };
  }
  if (!accessToken || overrides.length === 0) {
    return { syncedCount: 0 };
  }

  const normalizedOverrides = overrides
    .map(({ questionId, override }) => ({
      questionId: questionId.trim(),
      explanation: override.explanation,
      optionAnalysis: override.optionAnalysis ?? {},
      memoryTip: override.memoryTip ?? "",
      model: override.model ?? "gpt-5.4-mini",
      updatedAt: override.updatedAt
    }))
    .filter((override) => override.questionId && override.explanation?.trim())
    .sort((left, right) => left.questionId.localeCompare(right.questionId));

  if (normalizedOverrides.length === 0) {
    return { syncedCount: 0 };
  }

  const signature = getQuestionExplanationSyncSignature(normalizedOverrides);
  const now = Date.now();
  if (shouldSkipRecentQuestionExplanationSync(signature, now)) {
    return { syncedCount: 0 };
  }

  const inFlightSync = sharedQuestionExplanationSyncsInFlight.get(signature);
  if (inFlightSync) {
    return inFlightSync;
  }

  writeQuestionExplanationSyncMarker(signature, { startedAt: now });

  const syncTask = (async () => {
    const response = await fetch("/api/question-explanation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "sync_overrides",
        accessToken,
        overrides: normalizedOverrides.map((override) => ({
          questionId: override.questionId,
          explanation: override.explanation,
          optionAnalysis: override.optionAnalysis,
          memoryTip: override.memoryTip,
          model: override.model,
          updatedAt: override.updatedAt
        }))
      })
    });

    const rawText = await response.text();
    const payload = (rawText ? JSON.parse(rawText) : null) as {
      ok?: boolean;
      syncedCount?: number;
      message?: string;
    } | null;

    if (!response.ok || !payload?.ok) {
      clearQuestionExplanationSyncMarker(signature);
      throw new Error(payload?.message || "共享詳解同步失敗。");
    }

    const completedAt = Date.now();
    recentSharedQuestionExplanationSyncs.set(signature, completedAt);
    writeQuestionExplanationSyncMarker(signature, { completedAt });

    return {
      syncedCount: payload.syncedCount ?? 0
    };
  })();

  sharedQuestionExplanationSyncsInFlight.set(signature, syncTask);

  try {
    return await syncTask;
  } finally {
    sharedQuestionExplanationSyncsInFlight.delete(signature);
  }
}

export async function loadConfirmedQuestionClassificationOverrides(questionIds?: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  const hasExplicitQuestionIds = Array.isArray(questionIds);
  const uniqueQuestionIds = Array.from(new Set((questionIds ?? []).filter(Boolean))).slice(
    0,
    BACKGROUND_CLASSIFICATION_LOOKUP_LIMIT
  );

  if (hasExplicitQuestionIds && uniqueQuestionIds.length === 0) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  if (!hasExplicitQuestionIds) {
    const cachedAll = readBackgroundCache<Record<string, QuestionClassificationOverride>>("classification:all");
    if (cachedAll !== undefined) return cachedAll;

    const payload = await fetchBackgroundData<
      BackgroundPayloadBase & { overrides?: QuestionClassificationOverrideRow[] }
    >("classifications:all", "/api/question-background-data?kind=classifications&all=1");
    const mappedOverrides = Object.fromEntries(
      (payload.overrides ?? []).map((row) => {
        const typedRow = row as QuestionClassificationOverrideRow;
        return [typedRow.question_id, mapQuestionClassificationOverrideRow(typedRow)] as const;
      })
    );

    if (isFreshBackgroundPayload(payload)) {
      writeBackgroundCache("classification:all", mappedOverrides, BACKGROUND_DATA_TTL_MS.allClassifications);
      for (const [questionId, override] of Object.entries(mappedOverrides)) {
        writeBackgroundCache(`classification:${questionId}`, override, BACKGROUND_DATA_TTL_MS.classifications);
      }
    }

    return mappedOverrides;
  }

  const cachedOverrides = new Map<string, QuestionClassificationOverride | null>();
  const missingQuestionIds = uniqueQuestionIds.filter((questionId) => {
    const cachedValue = readBackgroundCache<QuestionClassificationOverride | null>(`classification:${questionId}`);
    if (cachedValue !== undefined) {
      cachedOverrides.set(questionId, cachedValue);
      return false;
    }
    return true;
  });

  if (missingQuestionIds.length > 0) {
    try {
      const requestIds = [...missingQuestionIds].sort();
      const payload = await fetchBackgroundData<
        BackgroundPayloadBase & { overrides?: QuestionClassificationOverrideRow[] }
      >(
        `classifications:${requestIds.join(",")}`,
        `/api/question-background-data?kind=classifications&ids=${encodeURIComponent(requestIds.join(","))}`
      );
      const mappedOverrides = new Map(
        (payload.overrides ?? []).map((row) => {
          const typedRow = row as QuestionClassificationOverrideRow;
          return [typedRow.question_id, mapQuestionClassificationOverrideRow(typedRow)] as const;
        })
      );

      if (isFreshBackgroundPayload(payload)) {
        for (const questionId of missingQuestionIds) {
          writeBackgroundCache(
            `classification:${questionId}`,
            mappedOverrides.get(questionId) ?? null,
            BACKGROUND_DATA_TTL_MS.classifications
          );
        }
      }

      for (const [questionId, override] of mappedOverrides.entries()) {
        cachedOverrides.set(questionId, override);
      }
    } catch (error) {
      if (cachedOverrides.size === 0) {
        throw error;
      }
    }
  }

  return Object.fromEntries(
    uniqueQuestionIds
      .map((questionId) => [questionId, cachedOverrides.get(questionId)] as const)
      .filter((entry): entry is readonly [string, QuestionClassificationOverride] => Boolean(entry[1]))
  );
}

export async function trackVisitorPresence(user?: User | null, accessToken?: string | null) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;
  if (!user?.id || !accessToken) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const response = await fetch("/api/visitor-presence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId,
      accessToken
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "訪客狀態同步失敗");
  }
}

export async function loadVisitorStats(options: { includeOnline?: boolean } = {}): Promise<VisitorStats> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return {
      totalVisitors: 0,
      onlineVisitors: 0,
      updatedAt: getRecoveryTimestamp()
    };
  }

  const query = options.includeOnline ? "?includeOnline=1" : "";
  const response = await fetch(`/api/visitor-stats${query}`);
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; stats?: VisitorStats }
    | null;

  if (!response.ok || !payload?.ok || !payload.stats) {
    throw new Error(payload?.message || "訪客統計讀取失敗");
  }

  return payload.stats;
}

export async function loadFeedbackMessagesResult(limit = 20): Promise<{
  messages: FeedbackMessage[];
  degraded: boolean;
  stale: boolean;
  message?: string;
}> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return { messages: [], degraded: true, stale: false, message: "留言板暫時維護中。" };
  }

  const response = await fetch(`/api/feedback?limit=${encodeURIComponent(String(limit))}`);
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; degraded?: boolean; stale?: boolean; message?: string; messages?: FeedbackMessage[] }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "留言讀取失敗");
  }

  return {
    messages: payload.messages ?? [],
    degraded: Boolean(payload.degraded),
    stale: Boolean(payload.stale),
    message: payload.message
  };
}

export async function loadFeedbackMessages(limit = 20): Promise<FeedbackMessage[]> {
  const result = await loadFeedbackMessagesResult(limit);
  return result.messages;
}

export async function createFeedbackMessage(input: {
  content: string;
  isAnonymous: boolean;
  user?: Pick<User, "id" | "email" | "user_metadata"> | null;
  parentId?: string | null;
}) {
  if (isSupabaseRecoveryMode()) {
    throw new Error("留言板暫時維護中，先讓登入與同步恢復。");
  }
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 尚未設定，暫時無法留言。");
  }

  const content = input.content.trim().slice(0, 1200);
  if (!content) {
    throw new Error("留言內容不能是空白。");
  }

  const accessToken = await getFeedbackAccessToken(input.user);

  const response = await fetchWithClientTimeout("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken,
      visitorId: getVisitorId(),
      content,
      isAnonymous: input.isAnonymous,
      parentId: input.parentId ?? null
    })
  }, FEEDBACK_REQUEST_TIMEOUT_MS, "留言送出逾時，請稍後再試。");

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        message?: string | FeedbackMessage;
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.message || typeof payload.message === "string") {
    throw new Error(
      typeof payload?.message === "string" ? payload.message : "留言送出失敗"
    );
  }

  return payload.message;
}

export async function voteFeedbackMessage(input: {
  messageId: string;
  vote: 1 | -1 | null;
  user?: Pick<User, "id" | "email" | "user_metadata"> | null;
}) {
  if (isSupabaseRecoveryMode()) {
    throw new Error("留言板暫時維護中，先讓登入與同步恢復。");
  }
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 尚未設定，暫時無法投票。");
  }

  const accessToken = await getFeedbackAccessToken(input.user);

  const response = await fetchWithClientTimeout("/api/feedback/vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken,
      visitorId: getVisitorId(),
      messageId: input.messageId,
      vote: input.vote
    })
  }, FEEDBACK_REQUEST_TIMEOUT_MS, "留言投票逾時，請稍後再試。");

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        message?: string;
        messageId?: string;
        myVote?: 1 | -1 | null;
        likeCount?: number;
        dislikeCount?: number;
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.messageId) {
    throw new Error(payload?.message || "留言投票失敗");
  }

  return {
    messageId: payload.messageId,
    myVote: payload.myVote ?? null,
    likeCount: payload.likeCount ?? 0,
    dislikeCount: payload.dislikeCount ?? 0
  };
}

export async function loadOwnerDashboardStats(): Promise<OwnerDashboardStats> {
  const payload = await fetchOwnerApiPayload();
  if (!payload?.stats) {
    return {
      totalVisitorDevices: 0,
      totalAttemptDevices: 0,
      attemptDevicesToday: 0,
      attemptVisitorsOverFive: 0,
      onlineVisitors: 0,
      totalSyncedUsers: 0,
      attemptsToday: 0,
      attemptsLast7Days: 0,
      totalAttempts: 0,
      aiExplanationCount: 0,
      aiExplanationInputTokens: 0,
      aiExplanationOutputTokens: 0,
      aiExplanationTotalTokens: 0,
      aiSearchCount: 0,
      aiSearchInputTokens: 0,
      aiSearchOutputTokens: 0,
      aiSearchTotalTokens: 0,
      updatedAt: new Date().toISOString()
    };
  }

  return payload.stats;
}

export async function loadOwnerExplanationUsage(
  feature: "explanation" | "search" = "explanation"
): Promise<OwnerExplanationUsageEntry[]> {
  const payload = await fetchOwnerApiPayload();
  return feature === "search" ? (payload?.searchUsage ?? []) : (payload?.explanationUsage ?? []);
}

export async function loadOwnerDailySeries(days = 14): Promise<OwnerDailyPoint[]> {
  const payload = await fetchOwnerApiPayload();
  return (payload?.dailySeries ?? []).slice(-days);
}

export async function loadOwnerHourlySeries(): Promise<OwnerHourlyPoint[]> {
  const payload = await fetchOwnerApiPayload();
  return (
    payload?.hourlySeries ??
    Array.from({ length: 24 }, (_, hour) => ({
      hour,
      attempts: 0,
      devices: 0
    }))
  );
}

export async function loadRecentCommunityAttemptStats(days = 2): Promise<CommunityRecentAttemptPoint[]> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [];
  }

  const safeDays = Math.min(7, Math.max(1, Math.trunc(days)));
  const response = await fetch(`/api/community-stats?days=${encodeURIComponent(String(safeDays))}`);
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; points?: CommunityRecentAttemptPoint[] }
    | null;

  if (!response.ok || !payload?.ok || !payload.points) {
    throw new Error(payload?.message || "社群作答統計載入失敗");
  }

  return payload.points;
}

function formatVisitorLabel(visitorId?: string | null) {
  if (!visitorId) return "未知裝置";
  const trimmed = visitorId.trim();
  if (trimmed.length <= 8) return `裝置 ${trimmed}`;
  return `裝置 ${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export async function loadOwnerTopAttemptVisitors(limit = 5): Promise<OwnerTopAttemptVisitorEntry[]> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [];
  }

  const data = await fetchAllQuestionAttemptLogs<{ visitor_id?: string | null; answered_at: string }>(
    "visitor_id, answered_at",
    (query) => query.not("visitor_id", "is", null)
  );

  const grouped = new Map<string, OwnerTopAttemptVisitorEntry>();

  for (const row of data ?? []) {
    const visitorId = row.visitor_id?.trim();
    if (!visitorId) continue;

    const current = grouped.get(visitorId) ?? {
      label: formatVisitorLabel(visitorId),
      visitorId,
      attempts: 0,
      lastAttemptedAt: row.answered_at
    };

    current.attempts += 1;
    if (!current.lastAttemptedAt || row.answered_at > current.lastAttemptedAt) {
      current.lastAttemptedAt = row.answered_at;
    }

    grouped.set(visitorId, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.attempts - a.attempts || (b.lastAttemptedAt ?? "").localeCompare(a.lastAttemptedAt ?? ""))
    .slice(0, limit);
}

type GenerateCustomPaperInput = {
  accessToken?: string | null;
  visitorId: string;
  selectedSubjects: string[];
  difficulty: CustomPaperDifficulty;
  name?: string;
  isPublic: boolean;
  doneQuestionIds: string[];
};

type GenerateAISearchCustomPaperInput = {
  accessToken?: string | null;
  visitorId: string;
  selectedSubjects: string[];
  query: string;
  name?: string;
  isPublic: boolean;
  yearFrom?: number;
  yearTo?: number;
};

type ImportJsonCustomPaperInput = {
  accessToken?: string | null;
  visitorId: string;
  rawJson: string;
  name?: string;
  isPublic: boolean;
};

type RecordCustomPaperAttemptInput = {
  accessToken?: string | null;
  visitorId: string;
  paperCode: string;
  session: QuizSession;
};

type UpdateCustomPaperMetadataInput = {
  accessToken?: string | null;
  visitorId: string;
  paperCode: string;
  name?: string;
  isPublic: boolean;
};

function tryParseJson<T>(rawText: string): T | null {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

export async function generateCustomPaper(
  input: GenerateCustomPaperInput
): Promise<CustomPaperDetail> {
  const response = await fetch("/api/custom-papers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "自訂卷產生失敗");
  }

  return payload.paper;
}

export async function generateAISearchCustomPaper(
  input: GenerateAISearchCustomPaperInput
): Promise<CustomPaperDetail> {
  const response = await fetch("/api/custom-papers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate_ai_search",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "AI 智慧檢索自訂卷產生失敗");
  }

  return payload.paper;
}

export async function importJsonCustomPaper(
  input: ImportJsonCustomPaperInput
): Promise<CustomPaperDetail> {
  const response = await fetch("/api/custom-papers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "import_json",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "匯入 JSON 自訂卷失敗");
  }

  return payload.paper;
}

export async function lookupCustomPaper(paperCode: string): Promise<CustomPaperDetail> {
  const response = await fetch(`/api/custom-papers?paperCode=${encodeURIComponent(paperCode)}`);
  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "找不到這份自訂卷");
  }

  return payload.paper;
}

export async function loadPublicCustomPapers(): Promise<CustomPaperSummary[]> {
  const response = await fetch("/api/custom-papers");
  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; papers?: CustomPaperSummary[] }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.papers) {
    throw new Error(payload?.message || rawText || "公開卷載入失敗");
  }

  return payload.papers;
}

export async function recordCustomPaperAttempt(
  input: RecordCustomPaperAttemptInput
) {
  const response = await fetch("/api/custom-papers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "submit_attempt",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string }
  >(rawText);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "自訂卷作答紀錄同步失敗");
  }
}

export async function updateCustomPaperMetadata(
  input: UpdateCustomPaperMetadataInput
): Promise<CustomPaperDetail> {
  const response = await fetch("/api/custom-papers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update_metadata",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "更新自訂卷失敗");
  }

  return payload.paper;
}

type PeakChallengeCandidateInput = {
  questionId: string;
  subject: SubjectName;
  chapter: string;
  section: string;
  stem: string;
  testedConcept?: string;
  riskScore?: number;
  wrongCount?: number;
  lowConfidenceCount?: number;
  sourceType?: QuestionSourceType;
};

async function buildSupabaseAuthHeader() {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return null;
  const client = getSupabaseBrowserClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

export async function loadPeakChallengeLeaderboard(): Promise<PeakChallengeLeaderboardEntry[]> {
  const authHeader = await buildSupabaseAuthHeader();
  const response = await fetch("/api/peak-challenge", {
    headers: authHeader ? { Authorization: authHeader } : undefined,
    cache: "no-store"
  });
  const rawText = await response.text();
  const payload = tryParseJson<
    | {
        ok?: boolean;
        message?: string;
        leaderboard?: PeakChallengeLeaderboardEntry[];
      }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.leaderboard) {
    throw new Error(payload?.message || rawText || "巔峰賽榜單載入失敗");
  }

  return payload.leaderboard;
}

export async function loadPeakChallengeAccessStatus() {
  const authHeader = await buildSupabaseAuthHeader();
  const response = await fetch("/api/peak-challenge", {
    headers: authHeader ? { Authorization: authHeader } : undefined,
    cache: "no-store"
  });
  const rawText = await response.text();
  const payload = tryParseJson<
    | {
        ok?: boolean;
        message?: string;
        attemptStatus?: {
          dailyLimit: number;
          usedAttempts: number;
          remainingAttempts: number | null;
          isOwnerBypass: boolean;
        } | null;
      }
  >(rawText);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "巔峰賽狀態載入失敗");
  }

  return payload.attemptStatus ?? null;
}

export async function claimPeakChallengeStart(input: {
  accessToken?: string | null;
  visitorId?: string;
}) {
  const response = await fetch("/api/peak-challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "start_gate",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<{ ok?: boolean; message?: string; remainingAttempts?: number | null }>(rawText);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "巔峰賽開始失敗");
  }

  return {
    remainingAttempts:
      typeof payload.remainingAttempts === "number" ? payload.remainingAttempts : null
  };
}

export async function generatePeakChallengeSession(input: {
  accessToken?: string | null;
  visitorId?: string;
  wrongPoolCandidates: PeakChallengeCandidateInput[];
  doneQuestionIds: string[];
  desiredCount?: number;
  existingSourceBreakdown?: { pastExam?: number; aiGenerated?: number };
  practicedSubjects?: SubjectName[];
  nextQuestionIndex?: number;
  consumeAttempt?: boolean;
}) {
  const response = await fetch("/api/peak-challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "generate",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<
    | {
        ok?: boolean;
        message?: string;
        sessionTitle?: string;
        questionIds?: string[];
        questions?: CustomPaperDetail["questions"];
        sourceBreakdown?: { pastExam?: number; aiGenerated?: number };
        remainingAttempts?: number | null;
      }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.questionIds || !payload.questions) {
    throw new Error(payload?.message || rawText || "巔峰賽題目產生失敗");
  }

  return {
    sessionTitle: payload.sessionTitle ?? "巔峰賽",
    questionIds: payload.questionIds,
    questions: payload.questions,
    sourceBreakdown: payload.sourceBreakdown ?? {},
    remainingAttempts:
      typeof payload.remainingAttempts === "number" ? payload.remainingAttempts : null
  };
}

export async function recordPeakChallengeRun(input: {
  accessToken?: string | null;
  visitorId?: string;
  session: QuizSession;
}) {
  const response = await fetch("/api/peak-challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "submit",
      ...input
    })
  });

  const rawText = await response.text();
  const payload = tryParseJson<{ ok?: boolean; message?: string }>(rawText);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "巔峰賽成績同步失敗");
  }
}
