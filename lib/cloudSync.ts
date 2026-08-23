import type { User } from "@supabase/supabase-js";
import type {
  Attempt,
  CustomPaperDetail,
  CustomPaperDifficulty,
  CustomPaperSearchPreview,
  CustomPaperSummary,
  FeedbackMessage,
  LeaderboardEntry,
  OwnerDailyPoint,
  OwnerDashboardStats,
  OwnerExplanationUsageEntry,
  OwnerHourlyPoint,
  OwnerTopAttemptVisitorEntry,
  QuestionClassificationOverride,
  QuestionExplanationOverride,
  QuestionCommunityStats,
  Question,
  SubjectName,
  QuizSession,
  VisitorStats
} from "@/types/quiz";
import {
  compactGeneratedQuestionsForStorage,
  compactQuestionForStorage,
  compactSessionForStorage,
  clearMatchingCurrentSessions,
  discardCurrentSession,
  getCompletedSessionsStorageLengthForUser,
  getCanonicalSessionId,
  loadCloudCompletedSessionsForUser,
  loadPendingCompletedSessionUploadsForUser,
  loadRecentCompletedSessionHandoffForUser,
  loadCurrentSession,
  loadCurrentSessionForUser,
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  mergeQuizSessionCopies,
  mergeCompletedQuestionHistoryFromSessionsForUser,
  normalizeSessions,
  isCurrentSessionDiscarded,
  queuePendingCompletedSessionUploadForUser,
  loadRecentLocalCompletedSessionsForUploadForUser,
  commitUploadedCompletedSessionsForUser,
  saveCurrentSession,
  saveCloudCompletedSessionsForUser,
  saveCompletedSessionsForUser,
  saveRecentCompletedSessionHandoffForUser
} from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
import {
  chooseMoreCompleteResumableSessionItem,
  createResumableQuizSessionListItem,
  getCanonicalResumableSessionId,
  isResumableQuizSession,
  isResumableSessionHydrationComplete,
  mergeResumableQuizSessionItems,
  mergeResumableQuizSessions,
  type ResumableQuizSessionListItem
} from "@/lib/resumableSessions";
import {
  buildCloudAttemptSessionChunks,
  filterResolvedCompletedSessionIds,
  findUnresolvedCompletedSessionIds,
  getSessionIdsNeedingAttemptRows
} from "@/lib/cloudHistorySync";
import { normalizeQuestionExplanationOverride } from "@/lib/questionExplanationFormat";
import {
  getFeedbackAuthorizationHeaders,
  getFeedbackIdentityIntent
} from "@/lib/feedbackAuth";
import { getRecoveryTimestamp, isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  buildQuizSessionProgressPayload,
  hasQuizSessionDefinitionChanged,
  mergeQuizSessionProgressPayload,
  omitHeavySessionPayload,
  type QuizSessionProgressPayload
} from "@/lib/quizSessionCheckpoint";
import { doesAttemptListCover } from "@/lib/quizSessionSyncSafety";
import {
  getQuizSessionNavigationIntent,
  shouldPreserveSelectedQuizSession
} from "@/lib/quizSessionNavigation";

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
  progress_payload?: QuizSessionProgressPayload | null;
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
const CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE = 8;
const CLOUD_COMPLETED_SESSION_UPLOAD_ATTEMPT_BATCH_SIZE = 800;
const CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT = 40;
const CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT = 500;
const CLOUD_RECOVERABLE_REVIEW_SESSION_FETCH_LIMIT = 160;
const CLOUD_RECOVERABLE_REVIEW_SESSION_GRACE_MS = 90_000;
const CLOUD_ACTIVE_SESSION_COMPARE_LIMIT = 8;
const CURRENT_SESSION_SYNC_MIN_INTERVAL_MS = 45_000;
const STATS_SYNC_ATTEMPT_BATCH_SIZE = 200;
const CLOUD_SESSION_LOOKUP_TIMEOUT_MS = 3500;
const CLOUD_RESUMABLE_LIST_TIMEOUT_MS = 6000;
const CLOUD_COMPLETED_HISTORY_READ_TIMEOUT_MS = 20_000;
const CLOUD_SYNC_BATCH_TIMEOUT_MS = 24000;
const CLOUD_DIRECT_SYNC_TIMEOUT_MS = 7000;
const CLOUD_SERVER_SYNC_TIMEOUT_MS = 12000;
const CLOUD_SYNC_TOTAL_BUDGET_MS = 45000;
const CLOUD_MANUAL_SYNC_TOTAL_BUDGET_MS = 55000;
const LEADERBOARD_PROFILE_CLIENT_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;
const LEADERBOARD_PROFILE_SYNC_MARKER_PREFIX = "leaderboardProfileSync:";
const COMPLETED_SESSION_UPLOAD_MARKER_PREFIX = "completedSessionUpload:";
const CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT = 160_000;
const CLOUD_HEAVY_LOCAL_HISTORY_RECOVERY_LIMIT = 240;
const FEEDBACK_REQUEST_TIMEOUT_MS = 10000;
const FEEDBACK_AUTH_REFRESH_TIMEOUT_MS = 6000;
const QUESTION_EXPLANATION_SYNC_IN_FLIGHT_MS = 20_000;
const QUESTION_EXPLANATION_SYNC_COOLDOWN_MS = 60_000;
const QUESTION_EXPLANATION_SYNC_MARKER_PREFIX = "questionExplanationSync:";

type CurrentSessionSyncState = {
  lastSyncedAt: number;
  lastSignature: string;
  syncedAttemptSignatures: Map<number, string>;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  pendingSession: QuizSession | null;
  pendingSignature: string;
};

type CompletedSessionSyncOptions = {
  hydrateRemoteHistory?: boolean;
  uploadAllPending?: boolean;
  readRemoteOnly?: boolean;
  historyMode?: "simulation";
};

const currentSessionSyncState = new Map<string, CurrentSessionSyncState>();
const COMPLETED_SESSION_UPLOAD_DEDUPE_MS = 2 * 60 * 1000;
const COMPLETED_SESSION_UPLOAD_IN_FLIGHT_MARKER_MS = CLOUD_SYNC_BATCH_TIMEOUT_MS + 10_000;
const completedSessionUploadsInFlight = new Map<string, Promise<void>>();
const recentCompletedSessionUploads = new Map<string, number>();
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

async function withAbortableClientTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(message);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

async function refreshFeedbackAccessToken() {
  try {
    const { data, error } = await withClientTimeout(
      getSupabaseBrowserClient().auth.refreshSession(),
      FEEDBACK_AUTH_REFRESH_TIMEOUT_MS,
      "登入狀態刷新逾時"
    );
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function postFeedbackRequest(
  url: string,
  body: Record<string, unknown>,
  accessToken: string | null | undefined,
  timeoutMessage: string
) {
  const send = (token?: string | null) =>
    fetchWithClientTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getFeedbackAuthorizationHeaders(token)
      },
      body: JSON.stringify({
        ...body,
        accessToken: token ?? null
      })
    }, FEEDBACK_REQUEST_TIMEOUT_MS, timeoutMessage);

  let response = await send(accessToken);
  if (response.status !== 401 || !accessToken) return response;

  const refreshedAccessToken = await refreshFeedbackAccessToken();
  if (!refreshedAccessToken || refreshedAccessToken === accessToken) return response;

  response = await send(refreshedAccessToken);
  return response;
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

function sessionUpdatedAtValueForCloud(session: QuizSession) {
  const values = [
    session.startedAt,
    session.completedAt,
    ...session.attempts.map((attempt) => attempt.answeredAt)
  ].filter((value): value is string => Boolean(value));

  return values.sort().at(-1) ?? new Date().toISOString();
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

function buildSessionPayloadForCloud(
  session: QuizSession,
  options: { includeAttempts?: boolean } = {}
): Partial<QuizSession> {
  const compacted = compactSessionForStorage(session);
  const generatedQuestions = (compacted.generatedQuestions ?? []).map(compactQuestionForCloud);
  const includeAttempts = options.includeAttempts ?? true;
  const shouldRetainGeneratedQuestions =
    generatedQuestions.length > 0 &&
    (session.settings?.mode === "custom_paper" ||
      session.settings?.mode === "simulation" ||
      generatedQuestions.some((question) => question.sourceType !== "MOEX_PAST_EXAM"));

  return {
    settings: compacted.settings,
    questionOrder: compacted.questionOrder,
    optionEliminationMap: compacted.optionEliminationMap,
    simulationElapsedSeconds: compacted.simulationElapsedSeconds,
    simulationTimerDurationSeconds: compacted.simulationTimerDurationSeconds,
    generatedQuestions: shouldRetainGeneratedQuestions ? generatedQuestions : undefined,
    currentQuestionIndex: session.completedAt ? undefined : compacted.currentQuestionIndex,
    isReviewingAnswer: session.completedAt ? undefined : compacted.isReviewingAnswer,
    attempts: includeAttempts && compacted.attempts.length > 0 ? compacted.attempts : undefined
  };
}

function buildSessionRowForCloud(
  userId: string,
  session: QuizSession,
  options: { includeAttemptsInPayload?: boolean } = {}
): QuizSessionRow {
  const correctCount = session.attempts.filter((attempt) => attempt.isCorrect).length;
  const wrongCount = session.attempts.length - correctCount;
  const includeAttemptsInPayload =
    options.includeAttemptsInPayload ?? Boolean(session.completedAt);

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
    updated_at: sessionUpdatedAtValueForCloud(session),
    progress_payload: buildQuizSessionProgressPayload(session),
    session_payload: buildSessionPayloadForCloud(session, {
      includeAttempts: includeAttemptsInPayload
    })
  };
}

function buildActiveSessionDefinitionRow(
  row: QuizSessionRow,
  existing?: QuizSessionRow
): QuizSessionRow {
  return {
    ...row,
    correct_count: existing?.correct_count ?? 0,
    wrong_count: existing?.wrong_count ?? 0,
    average_confidence: existing?.average_confidence ?? null,
    updated_at: existing?.updated_at ?? row.started_at,
    progress_payload: existing?.progress_payload ?? row.progress_payload
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

function getAttemptUploadSignature(attempt: Attempt) {
  return [
    attempt.questionId,
    attempt.selectedAnswer,
    attempt.correctAnswer,
    attempt.isCorrect ? "1" : "0",
    attempt.confidence,
    attempt.errorType ?? "",
    attempt.answeredAt
  ].join("|");
}

function getAttemptRowUploadSignature(row: QuizSessionAttemptRow) {
  return [
    row.question_id,
    row.selected_answer,
    row.correct_answer,
    row.is_correct ? "1" : "0",
    row.confidence,
    row.error_type ?? "",
    row.answered_at,
    row.source_mode ?? "",
    row.subject_snapshot ?? "",
    row.chapter_snapshot ?? "",
    row.section_snapshot ?? ""
  ].join("|");
}

function hashSyncSignature(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function getCompletedSessionUploadKey(userId: string, sessions: QuizSession[]) {
  const sessionSignatures = sessions
    .map((session) => {
      const attemptSignature = session.attempts.map(getAttemptUploadSignature).join("\n");
      return [
        getCanonicalSessionId(session.id),
        session.completedAt ?? "",
        session.settings?.mode ?? "",
        session.attempts.length,
        hashSyncSignature(attemptSignature)
      ].join(":");
    })
    .sort()
    .join("|");

  return `${userId}:${sessionSignatures}`;
}

function getCompletedSessionUploadMarkerKey(uploadKey: string) {
  return `${COMPLETED_SESSION_UPLOAD_MARKER_PREFIX}${hashSyncSignature(uploadKey)}`;
}

function readCompletedSessionUploadMarker(uploadKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getCompletedSessionUploadMarkerKey(uploadKey));
    if (!raw) return null;
    return JSON.parse(raw) as {
      startedAt?: number;
      completedAt?: number;
    };
  } catch {
    return null;
  }
}

function writeCompletedSessionUploadMarker(
  uploadKey: string,
  marker: { startedAt?: number; completedAt?: number }
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getCompletedSessionUploadMarkerKey(uploadKey), JSON.stringify(marker));
  } catch {
    // Browser storage is best-effort; in-memory dedupe still protects this tab.
  }
}

function pruneRecentCompletedSessionUploads(now = Date.now()) {
  for (const [key, uploadedAt] of recentCompletedSessionUploads) {
    if (now - uploadedAt > COMPLETED_SESSION_UPLOAD_DEDUPE_MS) {
      recentCompletedSessionUploads.delete(key);
    }
  }
}

function isCloudSyncTimeoutError(error: unknown) {
  return error instanceof Error && error.message.includes("逾時");
}

function getAttemptRowsNeedingUpload(
  userId: string,
  session: QuizSession,
  syncedAttemptSignatures?: Map<number, string>
) {
  return session.attempts
    .map((attempt, index) => {
      const signature = getAttemptUploadSignature(attempt);
      if (syncedAttemptSignatures?.get(index) === signature) return null;
      return {
        row: mapAttemptToCloudRow(userId, session, attempt, index),
        index,
        signature
      };
    })
    .filter(
      (
        item
      ): item is {
        row: ReturnType<typeof mapAttemptToCloudRow>;
        index: number;
        signature: string;
      } => Boolean(item)
    );
}

async function fetchExistingAttemptSignatureMap(
  userId: string,
  sessionIds: string[]
) {
  if (sessionIds.length === 0) return new Map<string, string>();

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("quiz_session_attempts")
    .select(
      "session_id, question_order, question_id, selected_answer, correct_answer, is_correct, confidence, error_type, answered_at, source_mode, subject_snapshot, chapter_snapshot, section_snapshot"
    )
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as Array<QuizSessionAttemptRow & { question_order: number }>).map((row) => [
      `${row.session_id}::${row.question_order}`,
      getAttemptRowUploadSignature(row)
    ])
  );
}

async function getCloudSessionSyncAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshCloudSessionSyncAccessToken() {
  try {
    const { data, error } = await withClientTimeout(
      getSupabaseBrowserClient().auth.refreshSession(),
      FEEDBACK_AUTH_REFRESH_TIMEOUT_MS,
      "登入狀態刷新逾時"
    );
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function syncSessionsThroughServer(
  sessions: QuizSession[],
  options: { activeCheckpoint?: boolean } = {}
) {
  let accessToken = await getCloudSessionSyncAccessToken();
  if (!accessToken) {
    throw new Error("登入狀態讀取失敗，先保留本機紀錄。");
  }

  const sendRequest = (token: string) =>
    fetchWithClientTimeout(
      "/api/quiz-session-sync",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activeCheckpoint: Boolean(options.activeCheckpoint),
          sessions
        })
      },
      CLOUD_SERVER_SYNC_TIMEOUT_MS,
      "伺服器雲端同步逾時，先保留本機紀錄。"
    );

  let response = await sendRequest(accessToken);
  if (response.status === 401) {
    const refreshedAccessToken = await refreshCloudSessionSyncAccessToken();
    if (refreshedAccessToken) {
      accessToken = refreshedAccessToken;
      response = await sendRequest(accessToken);
    }
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "伺服器雲端同步失敗。");
  }
}

function getCurrentSessionSyncSignature(session: QuizSession) {
  const latestAttemptAt =
    session.attempts
      .map((attempt) => attempt.answeredAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? "";

  return [
    session.id,
    session.currentQuestionIndex ?? 0,
    session.attempts.length,
    latestAttemptAt
  ].join("|");
}

function buildSyncedAttemptSignatureMap(session: QuizSession) {
  return new Map(
    session.attempts.map((attempt, index) => [index, getAttemptUploadSignature(attempt)])
  );
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

    const aiMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiMatch) {
      paperKeys.add(aiMatch[1]);
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
  const inferredPaperMode = selectedPaperKey
    ? selectedPaperKey.startsWith("AI-")
      ? "ai_paper"
      : "past_paper"
    : secondary.settings.paperMode;

  if (!shouldUseSecondaryName && primary.settings.selectedPaperKey && primary.settings.paperMode) {
    return primary;
  }

  return {
    ...primary,
    settings: {
      ...primary.settings,
      sessionName: shouldUseSecondaryName ? secondaryName : primary.settings.sessionName,
      paperMode: primary.settings.paperMode ?? inferredPaperMode,
      selectedPaperKey
    }
  };
}

function normalizeAttemptEliminatedOptions(options?: Attempt["eliminatedOptions"]): NonNullable<Attempt["eliminatedOptions"]> {
  return Array.from(new Set((options ?? []).filter(Boolean))) as NonNullable<Attempt["eliminatedOptions"]>;
}

function mergeAttemptListMetadata(primary: Attempt[], secondary: Attempt[]) {
  const secondaryByQuestionId = new Map(secondary.map((attempt) => [attempt.questionId, attempt] as const));

  return primary.map((attempt, index) => {
    const metadataSource = secondaryByQuestionId.get(attempt.questionId) ?? secondary[index];
    const eliminatedOptions = normalizeAttemptEliminatedOptions(
      attempt.eliminatedOptions?.length ? attempt.eliminatedOptions : metadataSource?.eliminatedOptions
    );

    return {
      ...attempt,
      eliminatedOptions: eliminatedOptions.length > 0 ? eliminatedOptions : undefined
    };
  });
}

function mergeSessionDetails(primary: QuizSession, secondary: QuizSession) {
  return mergeSimulationMetadata(
    mergeQuizSessionCopies(primary, secondary),
    secondary
  );
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
    if (!doesAttemptListCover(remoteSession.attempts, localSession.attempts)) {
      return true;
    }
    if (hasBetterSimulationMetadata(localSession, remoteSession)) return true;

    return false;
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

function getCompletedSessionSourceUserIds(userId: string) {
  return Array.from(new Set([userId || "guest", userId === "guest" ? null : "guest"].filter(Boolean))) as string[];
}

function mergeSessionLists(lists: QuizSession[][]) {
  return lists.reduce<QuizSession[]>((merged, list) => mergeSessions(merged, list), []);
}

function getConfirmedPendingSessions(
  pendingSessions: QuizSession[],
  remoteSessions: QuizSession[]
) {
  const remoteById = new Map(
    remoteSessions.map((session) => [getCanonicalSessionId(session.id), session] as const)
  );

  return pendingSessions.filter((pendingSession) => {
    if (!isCompletedQuizSession(pendingSession)) return false;
    const remoteSession = remoteById.get(getCanonicalSessionId(pendingSession.id));
    return Boolean(
      remoteSession?.completedAt &&
        doesAttemptListCover(remoteSession.attempts, pendingSession.attempts)
    );
  });
}

function mapRowToSession(
  row: QuizSessionRow | null,
  attemptMap?: Map<string, Attempt[]>,
  options: { inferRecoverableCompletion?: boolean } = {}
) {
  if (!row) return null;

  const payload = mergeQuizSessionProgressPayload(
    row.session_payload,
    row.progress_payload
  );
  const payloadAttempts = payload.attempts ?? [];
  const resolvedAttempts = attemptMap?.get(row.id)
    ? mergeAttemptListMetadata(attemptMap.get(row.id) ?? [], payloadAttempts)
    : payloadAttempts;
  const resolvedQuestionOrder =
    payload.questionOrder && payload.questionOrder.length > 0
      ? payload.questionOrder
      : resolvedAttempts.map((attempt) => attempt.questionId);
  const completedAt =
    payload.completedAt ??
    row.completed_at ??
    (options.inferRecoverableCompletion === false
      ? undefined
      : getRecoverableReviewSessionCompletedAt(row, resolvedAttempts));
  const inferredPastPaperKey =
    row.mode === "simulation" ? getSinglePastPaperKeyFromAttempts(resolvedAttempts) : undefined;
  const inferredPaperMode = inferredPastPaperKey
    ? inferredPastPaperKey.startsWith("AI-")
      ? "ai_paper"
      : "past_paper"
    : undefined;
  const payloadSettings = payload.settings
    ? ({
        ...payload.settings,
        sessionName: payload.settings.sessionName ?? row.session_name ?? undefined,
        paperMode: payload.settings.paperMode ?? inferredPaperMode,
        selectedPaperKey: payload.settings.selectedPaperKey ?? inferredPastPaperKey
      } as QuizSession["settings"])
    : undefined;

  return normalizeSessions([
    {
      id: row.id,
      subject: (payload.subject as SubjectName | undefined) ?? (row.subject as SubjectName),
      startedAt: payload.startedAt ?? row.started_at,
      completedAt: completedAt ?? undefined,
      settings:
        payloadSettings ??
        (row.mode
          ? ({
              mode: row.mode,
              sessionName: row.session_name ?? undefined,
              paperMode: inferredPaperMode,
              selectedPaperKey: inferredPastPaperKey,
              questionCount: row.question_count ?? resolvedQuestionOrder.length
            } as QuizSession["settings"])
          : undefined),
      questionOrder: resolvedQuestionOrder,
      generatedQuestions: payload.generatedQuestions ?? [],
      optionEliminationMap: payload.optionEliminationMap,
      simulationElapsedSeconds: payload.simulationElapsedSeconds,
      simulationTimerDurationSeconds: payload.simulationTimerDurationSeconds,
      currentQuestionIndex: payload.currentQuestionIndex,
      isReviewingAnswer: payload.isReviewingAnswer,
      attempts: resolvedAttempts
    }
  ])[0] ?? null;
}

function getLatestAttemptAnsweredAt(attempts: Attempt[]) {
  return attempts
    .map((attempt) => attempt.answeredAt)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .at(-1);
}

function getRecoverableReviewSessionCompletedAt(row: QuizSessionRow, attempts: Attempt[]) {
  if (row.completed_at || row.session_payload?.completedAt) return undefined;
  if (row.mode !== "review") return undefined;

  const expectedAttempts = Math.max(0, Number(row.question_count ?? 0));
  if (expectedAttempts === 0 || attempts.length < expectedAttempts) return undefined;

  const updatedAtTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  if (updatedAtTime && Date.now() - updatedAtTime < CLOUD_RECOVERABLE_REVIEW_SESSION_GRACE_MS) {
    return undefined;
  }

  return getLatestAttemptAnsweredAt(attempts) ?? row.updated_at ?? row.started_at;
}

async function fetchActiveQuizSessionRowsForUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return [] as QuizSessionRow[];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, progress_payload, updated_at"
    )
    .eq("user_id", userId)
    .is("completed_at", null)
    .or("mode.neq.discarded,mode.is.null")
    .order("updated_at", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(CLOUD_ACTIVE_SESSION_COMPARE_LIMIT);

  if (error) {
    throw error;
  }

  return (data ?? []) as QuizSessionRow[];
}

async function fetchActiveQuizSessionRowForUser(userId: string, sessionId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return null;

  const namespacedSessionId = namespaceSessionIdForUser(userId, sessionId);
  const { data, error } = await getSupabaseBrowserClient()
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, progress_payload, updated_at"
    )
    .eq("user_id", userId)
    .eq("id", namespacedSessionId)
    .is("completed_at", null)
    .maybeSingle();

  if (error) throw error;
  const row = data as QuizSessionRow | null;
  return row?.mode === "discarded" ? null : row;
}

function mapActiveQuizSessionRowToListItem(
  row: QuizSessionRow
): ResumableQuizSessionListItem | null {
  const session = mapRowToSession(row, undefined, { inferRecoverableCompletion: false });
  if (!session || session.completedAt) return null;

  const answeredCount = Math.max(
    session.attempts.length,
    Math.max(0, row.correct_count ?? 0) + Math.max(0, row.wrong_count ?? 0)
  );
  const item = createResumableQuizSessionListItem(session, {
    answeredCount,
    totalCount: Math.max(
      session.settings?.questionCount ?? 0,
      row.question_count ?? 0,
      session.questionOrder?.length ?? 0,
      session.generatedQuestions?.length ?? 0
    ),
    lastActivityAt: row.updated_at ?? session.startedAt,
    // Header counts and attempt rows are separate writes. Always hydrate the
    // selected cloud item before resuming so a lagging header cannot hide rows.
    needsCloudHydration: true
  });
  return item.totalCount > 0 ? item : null;
}

function mapActiveQuizSessionRowsToListItems(
  rows: QuizSessionRow[],
  userId: string
) {
  return rows
    .filter((row) => !isCurrentSessionDiscarded(row.id, userId))
    .map(mapActiveQuizSessionRowToListItem)
    .filter((item): item is ResumableQuizSessionListItem => Boolean(item));
}

function isExplicitQuizSessionNavigation() {
  if (typeof window === "undefined" || window.location.pathname !== "/quiz") return false;
  return shouldPreserveSelectedQuizSession(
    getQuizSessionNavigationIntent(new URLSearchParams(window.location.search))
  );
}

async function hydrateResumableQuizSessionListItem(
  userId: string,
  item: ResumableQuizSessionListItem
) {
  if (!item.needsCloudHydration) return item.session;
  const hydrated = await fetchHydratedActiveQuizSessionForUser(userId, item.session.id);
  return isResumableSessionHydrationComplete(hydrated, item.answeredCount)
    ? hydrated
    : null;
}

async function fetchHydratedActiveQuizSessionForUser(
  userId: string,
  sessionId: string
) {
  const row = await fetchActiveQuizSessionRowForUser(userId, sessionId);
  if (!row) return null;
  const attemptRows = await fetchSessionAttemptRowsForUser(userId, [row.id]);
  return mapRowToSession(row, buildAttemptMap(attemptRows));
}

async function fetchSessionAttemptRowsForUser(
  userId: string,
  sessionIds: string[],
  signal?: AbortSignal
) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || sessionIds.length === 0) {
    return [] as QuizSessionAttemptRow[];
  }

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionAttemptRow[] = [];

  for (const chunk of buildCloudAttemptSessionChunks(sessionIds)) {
    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      if (signal?.aborted) throw new Error("雲端紀錄讀取已中止");
      const to = from + SUPABASE_PAGE_SIZE - 1;
      let query = supabase
        .from("quiz_session_attempts")
        .select(
          "session_id, user_id, question_order, question_id, selected_answer, correct_answer, is_correct, confidence, error_type, answered_at, source_mode, subject_snapshot, chapter_snapshot, section_snapshot"
        )
        .eq("user_id", userId)
        .in("session_id", chunk)
        .order("session_id", { ascending: true })
        .order("question_order", { ascending: true })
        .range(from, to);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;

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

export async function loadResumableQuizSessionsForCurrentUser(userId?: string | null) {
  const localSessions = [
    userId ? loadCurrentSessionForUser(userId) : null,
    loadCurrentSessionForUser("guest")
  ];
  const localItems = localSessions
    .filter(isResumableQuizSession)
    .map((session) => createResumableQuizSessionListItem(session));

  if (!userId || isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return {
      items: mergeResumableQuizSessionItems(localItems),
      cloudError: undefined as string | undefined
    };
  }

  try {
    const cloudRows = await withClientTimeout(
      fetchActiveQuizSessionRowsForUser(userId),
      CLOUD_RESUMABLE_LIST_TIMEOUT_MS,
      "可繼續測驗清單讀取逾時，先顯示這台裝置的紀錄。"
    );
    const cloudItems = mapActiveQuizSessionRowsToListItems(cloudRows, userId);
    return {
      items: mergeResumableQuizSessionItems([...localItems, ...cloudItems]),
      cloudError: undefined as string | undefined
    };
  } catch (error) {
    return {
      items: mergeResumableQuizSessionItems(localItems),
      cloudError: error instanceof Error ? error.message : "雲端清單讀取失敗，先顯示這台裝置的紀錄。"
    };
  }
}

export async function loadResumableQuizSessionForCurrentUser(input: {
  sessionId: string;
  userId?: string | null;
  expectedAnsweredCount?: number;
}) {
  const userId = input.userId;
  const localSessions = [
    userId ? loadCurrentSessionForUser(userId) : null,
    loadCurrentSessionForUser("guest")
  ];
  const canonicalId = getCanonicalResumableSessionId(input.sessionId);
  const matchingLocalSession = localSessions.find(
    (session) =>
      isResumableQuizSession(session) &&
      getCanonicalResumableSessionId(session.id) === canonicalId
  );

  if (!userId || isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    if (matchingLocalSession) return matchingLocalSession;
    throw new Error("這份測驗目前不在這台裝置上，請稍後再試。");
  }

  const cloudSession = await withClientTimeout(
    fetchHydratedActiveQuizSessionForUser(userId, input.sessionId),
    CLOUD_SERVER_SYNC_TIMEOUT_MS,
    "這份測驗完整紀錄讀取逾時，原紀錄仍保留，請稍後再試。"
  );

  if (!isResumableQuizSession(cloudSession)) {
    if (matchingLocalSession) return matchingLocalSession;
    throw new Error("這份測驗可能已在另一台裝置完成或刪除，請重新整理清單。");
  }

  const resolvedSession = mergeResumableQuizSessions(
    matchingLocalSession ? [matchingLocalSession] : [],
    [cloudSession],
    1
  )[0] ?? cloudSession;
  const expectedAnsweredCount = Math.max(
    0,
    input.expectedAnsweredCount ?? 0,
    matchingLocalSession?.attempts.length ?? 0
  );

  if (!isResumableSessionHydrationComplete(resolvedSession, expectedAnsweredCount)) {
    throw new Error(
      `清單顯示已答 ${expectedAnsweredCount} 題，但雲端明細目前只讀到 ${resolvedSession.attempts.length} 題。已保留原紀錄，不會用較短版本覆蓋；請回原裝置同步或稍後再試。`
    );
  }

  return resolvedSession;
}

export async function deleteResumableQuizSession(input: {
  sessionId: string;
  userId?: string | null;
  accessToken?: string | null;
}) {
  if (!input.sessionId) return;

  if (input.userId && isSupabaseConfigured()) {
    if (isSupabaseRecoveryMode()) {
      throw new Error("雲端同步維護中，暫時不能刪除這份進行中測驗。");
    }
    if (!input.accessToken) {
      throw new Error("登入狀態已過期，請重新登入後再刪除。");
    }

    const response = await fetchWithClientTimeout(
      "/api/quiz-session-sync",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.accessToken}`
        },
        body: JSON.stringify({ sessionId: input.sessionId })
      },
      CLOUD_SERVER_SYNC_TIMEOUT_MS,
      "刪除進行中測驗逾時，原紀錄仍保留。"
    );
    const rawText = await response.text();
    const payload = tryParseJson<{ ok?: boolean; message?: string }>(rawText);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || rawText || "刪除進行中測驗失敗。");
    }
  }

  discardCurrentSession(input.sessionId, input.userId ? [input.userId] : []);
}

async function fetchQuizSessionsForUser(
  userId: string,
  signal?: AbortSignal,
  historyMode?: CompletedSessionSyncOptions["historyMode"]
) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return [] as QuizSessionRow[];

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionRow[] = [];

  for (
    let from = 0;
    from < CLOUD_COMPLETED_SESSION_FETCH_MAX_ROWS;
    from += CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE
  ) {
    if (signal?.aborted) throw new Error("雲端紀錄讀取已中止");
    const to = Math.min(
      from + CLOUD_COMPLETED_SESSION_FETCH_PAGE_SIZE - 1,
      CLOUD_COMPLETED_SESSION_FETCH_MAX_ROWS - 1
    );
    let query = supabase
      .from("quiz_sessions")
      .select(
        "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, progress_payload, updated_at"
      )
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .range(from, to);
    if (historyMode) query = query.eq("mode", historyMode);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;

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

async function fetchRecoverableReviewSessionRowsForUser(userId: string, signal?: AbortSignal) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) return [] as QuizSessionRow[];

  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, progress_payload, updated_at"
    )
    .eq("user_id", userId)
    .eq("mode", "review")
    .is("completed_at", null)
    .gt("question_count", 0)
    .order("updated_at", { ascending: false })
    .limit(CLOUD_RECOVERABLE_REVIEW_SESSION_FETCH_LIMIT);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as QuizSessionRow[];
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
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, progress_payload, updated_at"
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

function getCloudSessionAttemptSummary(row: QuizSessionRow) {
  return {
    id: row.id,
    questionCount: row.question_count,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    payloadAttemptCount: row.session_payload?.attempts?.length ?? 0
  };
}

async function fetchResolvedQuizSessionsForUser(
  userId: string,
  signal?: AbortSignal,
  historyMode?: CompletedSessionSyncOptions["historyMode"]
) {
  const sessionRows = await fetchQuizSessionsForUser(userId, signal, historyMode);
  const recoverableReviewRows = historyMode
    ? []
    : await fetchRecoverableReviewSessionRowsForUser(userId, signal);
  const allSessionRows = Array.from(
    new Map([...sessionRows, ...recoverableReviewRows].map((row) => [row.id, row] as const)).values()
  );
  const sessionIdsNeedingAttemptRows = getSessionIdsNeedingAttemptRows(
    sessionRows.map(getCloudSessionAttemptSummary)
  );
  const attemptSessionIds = Array.from(
    new Set([
      ...sessionIdsNeedingAttemptRows,
      ...recoverableReviewRows.map((row) => row.id)
    ])
  );
  const attemptRows = await fetchSessionAttemptRowsForUser(
    userId,
    attemptSessionIds,
    signal
  );
  const attemptMap = buildAttemptMap(attemptRows);
  const unresolvedCompletedSessionIds = findUnresolvedCompletedSessionIds(
    sessionRows.map(getCloudSessionAttemptSummary),
    Array.from(attemptMap.entries()).map(([sessionId, attempts]) => [
      sessionId,
      attempts.length
    ] as const)
  );

  const resolvedCompletedSessionIds = new Set(
    filterResolvedCompletedSessionIds(
      sessionRows.map((row) => row.id),
      unresolvedCompletedSessionIds
    )
  );
  if (unresolvedCompletedSessionIds.length > 0) {
    console.warn(
      `Skipped ${unresolvedCompletedSessionIds.length} incomplete cloud sessions while keeping resolved history visible.`
    );
  }

  const sessions = allSessionRows
    .filter(
      (row) =>
        !row.completed_at || resolvedCompletedSessionIds.has(row.id)
    )
    .map((row) => mapRowToSession(row, attemptMap))
    .filter((session): session is QuizSession => Boolean(session));
  const recoveredCompletionSessions = recoverableReviewRows
    .map((row) => mapRowToSession(row, attemptMap))
    .filter((session): session is QuizSession => Boolean(session?.completedAt && session.attempts.length > 0));

  return {
    sessions,
    sessionsMissingAttemptRows: [] as QuizSession[],
    recoveredCompletionSessions,
    unresolvedCompletedSessionIds
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
      if (!row) return null;

      const attemptRows = await fetchSessionAttemptRowsForUser(userId, [row.id]);
      const session = mapRowToSession(row, buildAttemptMap(attemptRows));
      if (!session?.completedAt) return null;
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

async function upsertSessionsForUser(
  userId: string,
  sessions: QuizSession[],
  options: {
    activeCheckpoint?: boolean;
    syncedAttemptSignatures?: Map<number, string>;
    protectedServerOnly?: boolean;
  } = {}
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const shouldUseServerFallback = typeof window !== "undefined";
  const runDirectUpsert = async () => {
  const supabase = getSupabaseBrowserClient();
  const namespacedSessions = canonicalizeSessionsForUser(userId, sessions);
  const rows = dedupeSessionRows(
    namespacedSessions.map((session) =>
      buildSessionRowForCloud(userId, session, {
        includeAttemptsInPayload: !options.activeCheckpoint || Boolean(session.completedAt)
      })
    )
  );
  const incompleteSessionIds = rows
    .filter((row) => !isCompletedQuizSessionRow(row))
    .map((row) => row.id);
  const protectedCompletedSessionIds = new Set<string>();
  const discardedSessionIds = new Set<string>();
  const existingActiveSessionIds = new Set<string>();
  const sessionsRequiringFullPayloadIds = new Set<string>();
  const existingActiveRowsById = new Map<string, QuizSessionRow>();
  const incomingRowsById = new Map(rows.map((row) => [row.id, row] as const));

  if (incompleteSessionIds.length > 0) {
    const { data, error: existingError } = await supabase
      .from("quiz_sessions")
      .select("id, mode, completed_at, correct_count, wrong_count, average_confidence, started_at, session_payload, progress_payload, updated_at")
      .eq("user_id", userId)
      .in("id", incompleteSessionIds);

    if (existingError) {
      throw existingError;
    }

    for (const row of (data ?? []) as QuizSessionRow[]) {
      if (row.mode === "discarded") {
        discardedSessionIds.add(row.id);
      } else if (isCompletedQuizSessionRow(row)) {
        protectedCompletedSessionIds.add(row.id);
      } else {
        existingActiveSessionIds.add(row.id);
        existingActiveRowsById.set(row.id, row);
        if (
          hasQuizSessionDefinitionChanged(
            row.session_payload,
            incomingRowsById.get(row.id)?.session_payload
          )
        ) {
          sessionsRequiringFullPayloadIds.add(row.id);
        }
      }
    }
  }

  const safeSessions = namespacedSessions.filter(
    (session) =>
      !discardedSessionIds.has(session.id) &&
      !protectedCompletedSessionIds.has(session.id)
  );
  const safeRows = rows.filter(
    (row) =>
      !discardedSessionIds.has(row.id) &&
      !protectedCompletedSessionIds.has(row.id)
  );

  for (const sessionId of protectedCompletedSessionIds) {
    clearMatchingCurrentSessions(sessionId, [userId]);
  }

  if (safeRows.length === 0) return;

  if (options.activeCheckpoint) {
    const fullRows = safeRows.filter(
      (row) =>
        !existingActiveSessionIds.has(row.id) ||
        sessionsRequiringFullPayloadIds.has(row.id)
    );
    if (fullRows.length > 0) {
      const { error } = await supabase
        .from("quiz_sessions")
        .upsert(
          fullRows.map((row) =>
            buildActiveSessionDefinitionRow(row, existingActiveRowsById.get(row.id))
          ),
          { onConflict: "id" }
        );
      if (error) throw error;
    }
  } else {
    const { error } = await supabase
      .from("quiz_sessions")
      .upsert(safeRows, { onConflict: "id" });
    if (error) throw error;
  }

  const attemptRowsWithSignatures = safeSessions.flatMap((session) => {
    if (options.activeCheckpoint && !session.completedAt) {
      return getAttemptRowsNeedingUpload(userId, session, options.syncedAttemptSignatures);
    }

    return session.attempts.map((attempt, index) => ({
      row: mapAttemptToCloudRow(userId, session, attempt, index),
      index,
      signature: getAttemptUploadSignature(attempt)
    }));
  });
  const dedupedAttemptRowsWithSignatures = Array.from(
    attemptRowsWithSignatures
      .reduce((map, item) => {
        map.set(`${item.row.session_id}::${item.row.question_order}`, item);
        return map;
      }, new Map<string, (typeof attemptRowsWithSignatures)[number]>())
      .values()
  );
  let attemptRows = dedupeSessionAttemptRows(dedupedAttemptRowsWithSignatures.map((item) => item.row));

  if (
    attemptRows.length > 0 &&
    (!options.activeCheckpoint || !options.syncedAttemptSignatures)
  ) {
    const existingAttemptSignatures = await fetchExistingAttemptSignatureMap(
      userId,
      Array.from(new Set(attemptRows.map((row) => row.session_id)))
    );
    attemptRows = attemptRows.filter((row) => {
      const existingSignature = existingAttemptSignatures.get(`${row.session_id}::${row.question_order}`);
      return existingSignature !== getAttemptRowUploadSignature(row);
    });
  }

  if (attemptRows.length > 0) {
    const { error: attemptError } = await supabase
      .from("quiz_session_attempts")
      .upsert(attemptRows, { onConflict: "session_id,question_order" });

    if (attemptError) {
      throw attemptError;
    }
  }

  if (options.activeCheckpoint) {
    for (const row of safeRows) {
      const checkpointRow = omitHeavySessionPayload(row);
      const { error } = await supabase
        .from("quiz_sessions")
        .update(checkpointRow)
        .eq("id", row.id)
        .eq("user_id", userId)
        .is("completed_at", null);
      if (error) throw error;
    }
  }

  if (options.activeCheckpoint && options.syncedAttemptSignatures) {
    for (const item of dedupedAttemptRowsWithSignatures) {
      options.syncedAttemptSignatures.set(item.index, item.signature);
    }
  }
  };

  if (shouldUseServerFallback && !options.activeCheckpoint) {
    try {
      await syncSessionsThroughServer(sessions, {
        activeCheckpoint: false
      });
      return;
    } catch (serverError) {
      if (options.protectedServerOnly || isCloudSyncTimeoutError(serverError)) {
        throw serverError;
      }
      console.warn("Server session sync failed; falling back to direct browser sync.", serverError);
      await runDirectUpsert();
      return;
    }
  }

  try {
    await runDirectUpsert();
  } catch (error) {
    throw error;
  }
}

async function upsertSessionsForUserInBatches(
  userId: string,
  sessions: QuizSession[],
  batchSize = CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE,
  options: {
    batchAttemptLimit?: number;
    batchTimeoutMs?: number;
    totalBudgetMs?: number;
    protectedServerOnly?: boolean;
  } = {}
) {
  const startedAt = Date.now();
  const batchAttemptLimit = options.batchAttemptLimit ?? CLOUD_COMPLETED_SESSION_UPLOAD_ATTEMPT_BATCH_SIZE;

  for (let index = 0; index < sessions.length;) {
    if (options.totalBudgetMs && Date.now() - startedAt > options.totalBudgetMs) {
      throw new Error("雲端同步仍在背景整理，先保留本機紀錄。");
    }

    const batch: QuizSession[] = [];
    let batchAttemptCount = 0;

    while (index < sessions.length && batch.length < batchSize) {
      const session = sessions[index];
      const attemptCount = session.attempts.length;
      if (batch.length > 0 && batchAttemptCount + attemptCount > batchAttemptLimit) {
        break;
      }

      batch.push(session);
      batchAttemptCount += attemptCount;
      index += 1;

      if (attemptCount >= batchAttemptLimit) {
        break;
      }
    }

    if (batch.length === 0) {
      index += 1;
      continue;
    }

    const task = upsertSessionsForUser(userId, batch, {
      protectedServerOnly: options.protectedServerOnly
    });
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

function getCurrentSessionSyncStateKey(userId: string, sessionId: string) {
  return `${userId}:${namespaceSessionIdForUser(userId, sessionId)}`;
}

function clearCurrentSessionSyncStateForSession(userId: string, sessionId: string) {
  const stateKey = getCurrentSessionSyncStateKey(userId, sessionId);
  const existing = currentSessionSyncState.get(stateKey);
  if (existing?.pendingTimer) {
    clearTimeout(existing.pendingTimer);
  }
  currentSessionSyncState.delete(stateKey);
}

function rememberSyncedCurrentSessionState(
  userId: string,
  session: QuizSession,
  syncedAttemptSignatures = buildSyncedAttemptSignatureMap(session)
) {
  const stateKey = getCurrentSessionSyncStateKey(userId, session.id);
  const existing = currentSessionSyncState.get(stateKey);
  if (existing?.pendingTimer) {
    clearTimeout(existing.pendingTimer);
  }

  currentSessionSyncState.set(stateKey, {
    lastSyncedAt: Date.now(),
    lastSignature: getCurrentSessionSyncSignature(session),
    syncedAttemptSignatures,
    pendingTimer: null,
    pendingSession: null,
    pendingSignature: ""
  });
}

export async function syncCompletedSessionsForCurrentUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return loadCompletedSessions();
  }

  const sourceUserIds = getCompletedSessionSourceUserIds(userId);
  const localCompletedSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessionLists(sourceUserIds.map((sourceUserId) => loadCompletedSessionsForUser(sourceUserId)))
      .filter(isCompletedQuizSession)
  );
  const localSessionsToSync = [...localCompletedSessions]
    .sort((left, right) => sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left)))
    .slice(0, CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT);
  const {
    sessions: fetchedRemoteSessions,
    sessionsMissingAttemptRows,
    recoveredCompletionSessions
  } = await fetchResolvedQuizSessionsForUser(userId);
  const remoteSessions = canonicalizeSessionsForUser(
    userId,
    fetchedRemoteSessions.filter(isCompletedQuizSession)
  );
  const mergedSessions = mergeSessions(localCompletedSessions, remoteSessions).filter(isCompletedQuizSession);
  const mergedSessionsToSync = [...mergedSessions]
    .sort((left, right) =>
      sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
    )
    .slice(0, CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT);
  const sessionsToUpload = getSessionsNeedingUpload(mergedSessionsToSync, remoteSessions);
  const sessionsToBackfill = canonicalizeSessionsForUser(
    userId,
    sessionsMissingAttemptRows.filter(isCompletedQuizSession)
  );
  const sessionsToRepair = canonicalizeSessionsForUser(
    userId,
    recoveredCompletionSessions.filter(isCompletedQuizSession)
  );

  if (mergedSessions.length > 0) {
    saveCompletedSessionsForUser(userId, mergedSessions);
    mergeCompletedQuestionHistoryFromSessionsForUser(userId, mergedSessions);
  }
  if (sessionsToBackfill.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToBackfill);
  }
  if (sessionsToRepair.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToRepair);
  }
  if (sessionsToUpload.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToUpload);
  }

  return mergedSessions;
}

export async function syncLocalCompletedSessionsForCurrentUser(
  userId: string,
  options: CompletedSessionSyncOptions = {}
) {
  const uploadAllPending = options.uploadAllPending === true;
  const hydrateRemoteHistory = options.hydrateRemoteHistory ?? !uploadAllPending;
  const readRemoteOnly = options.readRemoteOnly === true;
  const sourceUserIds = getCompletedSessionSourceUserIds(userId);
  const hasHeavyLocalHistory =
    sourceUserIds.some(
      (sourceUserId) =>
        getCompletedSessionsStorageLengthForUser(sourceUserId) > CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT
    );
  let fetchedRemoteSessions: QuizSession[] = [];
  const canReachCloud = !isSupabaseRecoveryMode() && isSupabaseConfigured();
  let shouldUploadLocalSessions = canReachCloud && !readRemoteOnly;
  let hasVerifiedRemoteSessions = false;
  let remoteHistoryReadError: unknown = null;
  const rawPendingUploadSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessionLists(
      sourceUserIds.map((sourceUserId) =>
        loadPendingCompletedSessionUploadsForUser(sourceUserId)
      )
    ).filter(isCompletedQuizSession)
  );

  if (shouldUploadLocalSessions && rawPendingUploadSessions.length > 0) {
    const pendingSessionsToUpload = uploadAllPending
      ? [...rawPendingUploadSessions]
          .sort((left, right) =>
            sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
          )
          .slice(0, CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT)
      : getRecentSessionsWithinUploadBudget(
          [...rawPendingUploadSessions].sort((left, right) =>
            sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
          ),
          CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT,
          CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT
        );

    try {
      await upsertSessionsForUserInBatches(
        userId,
        pendingSessionsToUpload,
        Math.min(10, CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE),
        {
          batchTimeoutMs: CLOUD_SYNC_BATCH_TIMEOUT_MS,
          totalBudgetMs: uploadAllPending
            ? CLOUD_MANUAL_SYNC_TOTAL_BUDGET_MS
            : CLOUD_SYNC_TOTAL_BUDGET_MS,
          protectedServerOnly: true
        }
      );
      commitUploadedCompletedSessionsForUser(
        userId,
        pendingSessionsToUpload,
        sourceUserIds
      );
    } catch (error) {
      console.warn("Pending completed sessions remain queued for retry.", error);
    }
  }

  if (canReachCloud && hydrateRemoteHistory) {
    try {
      const resolved = await withAbortableClientTimeout(
        (signal) => fetchResolvedQuizSessionsForUser(userId, signal, options.historyMode),
        CLOUD_COMPLETED_HISTORY_READ_TIMEOUT_MS,
        "完整雲端紀錄讀取逾時，已保留這台裝置的紀錄與待補傳佇列。"
      );
      fetchedRemoteSessions = resolved.sessions;
      hasVerifiedRemoteSessions = true;
    } catch (error) {
      shouldUploadLocalSessions = false;
      remoteHistoryReadError = error;
      fetchedRemoteSessions = loadCloudCompletedSessionsForUser(userId);
      console.warn("Completed session cloud read failed; keeping local history visible.", error);
    }
  } else if (canReachCloud) {
    fetchedRemoteSessions = loadCloudCompletedSessionsForUser(userId);
  }
  const remoteSessions = canonicalizeSessionsForUser(
    userId,
    fetchedRemoteSessions.filter(isCompletedQuizSession)
  );
  const confirmedPendingSessions = hasVerifiedRemoteSessions
    ? getConfirmedPendingSessions(rawPendingUploadSessions, remoteSessions)
    : [];
  if (confirmedPendingSessions.length > 0) {
    commitUploadedCompletedSessionsForUser(
      userId,
      confirmedPendingSessions,
      sourceUserIds
    );
  }

  const recentLocalCompletedSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessionLists(
      sourceUserIds.map((sourceUserId) =>
        loadRecentLocalCompletedSessionsForUploadForUser(
          sourceUserId,
          CLOUD_HEAVY_LOCAL_HISTORY_RECOVERY_LIMIT
        )
      )
    ).filter(isCompletedQuizSession)
  );
  const recentHandoffSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessionLists(
      sourceUserIds.map((sourceUserId) =>
        loadRecentCompletedSessionHandoffForUser(sourceUserId)
      )
    ).filter(isCompletedQuizSession)
  );
  const pendingCompletedSessionUploads = canonicalizeSessionsForUser(
    userId,
    mergeSessionLists([
      ...sourceUserIds.map((sourceUserId) => loadPendingCompletedSessionUploadsForUser(sourceUserId)),
      recentLocalCompletedSessions,
      recentHandoffSessions
    ]).filter(isCompletedQuizSession)
  );

  const localCompletedSessions =
    hasHeavyLocalHistory && !uploadAllPending
      ? pendingCompletedSessionUploads
      : canonicalizeSessionsForUser(
          userId,
          mergeSessionLists([
            ...sourceUserIds.map((sourceUserId) =>
              loadCompletedSessionsForUser(sourceUserId, {
                includeFullLocalHistory: uploadAllPending
              })
            ),
            pendingCompletedSessionUploads
          ])
            .filter(isCompletedQuizSession)
        );
  const mergedSessions =
    hasHeavyLocalHistory && !uploadAllPending
      ? mergeSessions(pendingCompletedSessionUploads, remoteSessions).filter(isCompletedQuizSession)
      : mergeSessions(localCompletedSessions, remoteSessions).filter(isCompletedQuizSession);
  const localSessionsToSync = getRecentSessionsWithinUploadBudget(
    [...localCompletedSessions].sort((left, right) =>
      sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
    ),
    CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT,
    CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT
  );
  const cloudCacheSessions =
    hasHeavyLocalHistory && uploadAllPending
      ? remoteSessions
      : hasHeavyLocalHistory
        ? mergedSessions
        : remoteSessions;
  if (cloudCacheSessions.length > 0) {
    saveCloudCompletedSessionsForUser(
      userId,
      mergeSessions(loadCloudCompletedSessionsForUser(userId), cloudCacheSessions)
    );
  }

  if (hasHeavyLocalHistory) {
    if (mergedSessions.length > 0) {
      mergeCompletedQuestionHistoryFromSessionsForUser(userId, mergedSessions);
    }
  } else {
    if (mergedSessions.length > 0) {
      saveCompletedSessionsForUser(userId, mergedSessions);
      mergeCompletedQuestionHistoryFromSessionsForUser(userId, mergedSessions);
    }
  }

  if (remoteHistoryReadError) {
    throw remoteHistoryReadError;
  }

  const sessionsToUpload = uploadAllPending
    ? getSessionsNeedingUpload(
        [...mergedSessions].sort((left, right) =>
          sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
        ),
        remoteSessions
      ).slice(0, CLOUD_COMPLETED_SESSION_UPLOAD_LIMIT)
    : hydrateRemoteHistory
      ? getSessionsNeedingUpload(
          getRecentSessionsWithinUploadBudget(
            [...mergedSessions].sort((left, right) =>
              sessionFreshnessValue(right).localeCompare(sessionFreshnessValue(left))
            ),
            CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT,
            CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT
          ),
          remoteSessions
        )
      : getRecentSessionsWithinUploadBudget(
          pendingCompletedSessionUploads,
          CLOUD_LIGHT_COMPLETED_SESSION_UPLOAD_LIMIT,
          CLOUD_LIGHT_COMPLETED_ATTEMPT_UPLOAD_LIMIT
        );

  if (readRemoteOnly || !shouldUploadLocalSessions || sessionsToUpload.length === 0) {
    return mergedSessions;
  }

  await upsertSessionsForUserInBatches(
    userId,
    sessionsToUpload,
    Math.min(10, CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE),
    {
      batchTimeoutMs: CLOUD_SYNC_BATCH_TIMEOUT_MS,
      totalBudgetMs: uploadAllPending ? CLOUD_MANUAL_SYNC_TOTAL_BUDGET_MS : CLOUD_SYNC_TOTAL_BUDGET_MS
    }
  );
  commitUploadedCompletedSessionsForUser(
    userId,
    sessionsToUpload,
    sourceUserIds
  );

  return mergedSessions;
}

export async function syncCurrentSessionForCurrentUser(userId: string) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return loadCurrentSession();
  }

  const guestSession = loadCurrentSessionForUser("guest");
  const localUserSession = loadCurrentSessionForUser(userId);
  let localCurrentSession: QuizSession | null =
    mergeResumableQuizSessions([localUserSession, guestSession], [])[0] ?? null;

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

  const remoteActiveRows = await withCloudFallback<QuizSessionRow[] | null>(
    fetchActiveQuizSessionRowsForUser(userId),
    null
  );
  if (!remoteActiveRows) {
    return localCurrentSession;
  }
  const remoteItems = mapActiveQuizSessionRowsToListItems(remoteActiveRows, userId);
  const preserveExplicitSessionSelection = isExplicitQuizSessionNavigation();
  const latestRemoteItem = preserveExplicitSessionSelection
    ? null
    : ([...remoteItems].sort((left, right) =>
        right.lastActivityAt.localeCompare(left.lastActivityAt)
      )[0] ?? null);
  const betterRemoteForLocal = localCurrentSession && !preserveExplicitSessionSelection
    ? chooseMoreCompleteResumableSessionItem(localCurrentSession, remoteItems)
    : null;
  const localActivity = localCurrentSession ? sessionActivityValue(localCurrentSession) : "";
  const remoteCandidate = betterRemoteForLocal ?? latestRemoteItem;
  const shouldHydrateRemote = Boolean(
    remoteCandidate &&
      (betterRemoteForLocal || !localCurrentSession || remoteCandidate.lastActivityAt > localActivity)
  );
  const remoteCurrentSession = shouldHydrateRemote && remoteCandidate
    ? await withCloudFallback<QuizSession | null>(
        hydrateResumableQuizSessionListItem(userId, remoteCandidate),
        null
      )
    : null;
  const remoteHydrationIncomplete = Boolean(
    shouldHydrateRemote &&
      remoteCandidate &&
      !remoteCurrentSession &&
      remoteCandidate.answeredCount > (localCurrentSession?.attempts.length ?? 0)
  );
  const remoteSyncedAttemptSignatures = remoteCurrentSession
    ? buildSyncedAttemptSignatureMap(remoteCurrentSession)
    : new Map<number, string>();

  if (betterRemoteForLocal && remoteCurrentSession) {
    const winner = canonicalizeSessionsForUser(userId, [remoteCurrentSession])[0] ?? remoteCurrentSession;
    saveCurrentSession(winner);
    rememberSyncedCurrentSessionState(userId, winner, remoteSyncedAttemptSignatures);
    return winner;
  }

  const remoteActivity = remoteCurrentSession ? remoteCandidate?.lastActivityAt ?? "" : "";

  let winner = localCurrentSession;
  let shouldUploadWinner =
    Boolean(localCurrentSession) &&
    !remoteHydrationIncomplete &&
    (!remoteCandidate || !remoteCurrentSession || localActivity > remoteActivity);

  if (remoteCurrentSession && (!winner || remoteActivity > localActivity)) {
    winner = canonicalizeSessionsForUser(userId, [remoteCurrentSession])[0] ?? remoteCurrentSession;
    saveCurrentSession(winner);
    shouldUploadWinner = false;
    rememberSyncedCurrentSessionState(userId, winner, remoteSyncedAttemptSignatures);
  }

  if (winner && !winner.completedAt && shouldUploadWinner) {
    const syncedAttemptSignatures =
      remoteCurrentSession &&
      getCanonicalSessionId(remoteCurrentSession.id) === getCanonicalSessionId(winner.id)
        ? remoteSyncedAttemptSignatures
        : undefined;
    const canonicalWinner = canonicalizeSessionsForUser(userId, [winner]);
    await withCloudFallback(
      upsertSessionsForUser(userId, canonicalWinner, {
        activeCheckpoint: true,
        syncedAttemptSignatures
      }).then(() => true),
      false
    );
    const syncedWinner = canonicalWinner[0];
    if (syncedWinner) {
      rememberSyncedCurrentSessionState(
        userId,
        syncedWinner,
        syncedAttemptSignatures ?? buildSyncedAttemptSignatureMap(syncedWinner)
      );
    }
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
    mergeResumableQuizSessions([localUserSession, guestSession], [])[0] ?? null;

  if (!localCurrentSession) return null;

  const canonicalSession = canonicalizeSessionsForUser(userId, [localCurrentSession])[0] ?? localCurrentSession;
  const remoteActiveRows = await withCloudFallback<QuizSessionRow[] | null>(
    fetchActiveQuizSessionRowsForUser(userId),
    null
  );
  if (!remoteActiveRows) {
    return canonicalSession;
  }

  const moreCompleteRemoteItem = isExplicitQuizSessionNavigation()
    ? null
    : chooseMoreCompleteResumableSessionItem(
        canonicalSession,
        mapActiveQuizSessionRowsToListItems(remoteActiveRows, userId)
      );
  const moreCompleteRemoteSession = moreCompleteRemoteItem
    ? await withCloudFallback<QuizSession | null>(
        hydrateResumableQuizSessionListItem(userId, moreCompleteRemoteItem),
        null
      )
    : null;
  if (moreCompleteRemoteItem && !moreCompleteRemoteSession) {
    return canonicalSession;
  }
  if (moreCompleteRemoteSession) {
    const winner = canonicalizeSessionsForUser(userId, [moreCompleteRemoteSession])[0] ?? moreCompleteRemoteSession;
    saveCurrentSession(winner);
    rememberSyncedCurrentSessionState(
      userId,
      winner,
      buildSyncedAttemptSignatureMap(winner)
    );
    return winner;
  }

  await withClientTimeout(
    upsertSessionsForUser(userId, [canonicalSession], {
      activeCheckpoint: true
    }),
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
    for (const canonicalSession of canonicalSessions) {
      clearCurrentSessionSyncStateForSession(data.user.id, canonicalSession.id);
    }
    saveRecentCompletedSessionHandoffForUser(data.user.id, canonicalSessions);
    queuePendingCompletedSessionUploadForUser(data.user.id, canonicalSessions);
    mergeCompletedQuestionHistoryFromSessionsForUser(data.user.id, canonicalSessions);
    if (getCompletedSessionsStorageLengthForUser(data.user.id) <= CLOUD_HEAVY_LOCAL_HISTORY_READ_LIMIT) {
      saveCompletedSessionsForUser(
        data.user.id,
        mergeSessions(
          loadCompletedSessionsForUser(data.user.id),
          canonicalSessions
        )
      );
    }

    const uploadKey = getCompletedSessionUploadKey(data.user.id, canonicalSessions);
    const now = Date.now();
    pruneRecentCompletedSessionUploads(now);
    try {
      const recentUploadedAt = recentCompletedSessionUploads.get(uploadKey);
      const uploadMarker = readCompletedSessionUploadMarker(uploadKey);
      const markerCompletedAt = Number(uploadMarker?.completedAt ?? 0);
      const markerStartedAt = Number(uploadMarker?.startedAt ?? 0);
      const wasRecentlyUploaded = Boolean(
        (recentUploadedAt && now - recentUploadedAt <= COMPLETED_SESSION_UPLOAD_DEDUPE_MS) ||
        (markerCompletedAt > 0 && now - markerCompletedAt <= COMPLETED_SESSION_UPLOAD_DEDUPE_MS)
      );

      if (!wasRecentlyUploaded) {
        if (
          markerStartedAt > 0 &&
          now - markerStartedAt <= COMPLETED_SESSION_UPLOAD_IN_FLIGHT_MARKER_MS
        ) {
          return;
        }

        writeCompletedSessionUploadMarker(uploadKey, { startedAt: now });
        let uploadTask = completedSessionUploadsInFlight.get(uploadKey);
        if (!uploadTask) {
          const nextUploadTask = withClientTimeout(
            upsertSessionsForUser(data.user.id, canonicalSessions),
            CLOUD_SYNC_BATCH_TIMEOUT_MS,
            "完成紀錄雲端同步逾時，先保留本機紀錄。"
          ).then(() => {
            const completedAt = Date.now();
            recentCompletedSessionUploads.set(uploadKey, completedAt);
            writeCompletedSessionUploadMarker(uploadKey, { startedAt: now, completedAt });
          });
          uploadTask = nextUploadTask.finally(() => {
            completedSessionUploadsInFlight.delete(uploadKey);
          });
          completedSessionUploadsInFlight.set(uploadKey, uploadTask);
        }

        await uploadTask;
      }
      commitUploadedCompletedSessionsForUser(
        data.user.id,
        canonicalSessions
      );
    } catch (error) {
      console.error("Completed session cloud upload deferred:", error);
    }
    void syncLeaderboardProfileForCurrentUser(data.user, loadCompletedSessionsForUser(data.user.id)).catch((error) => {
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

export async function pushCurrentSessionToSupabase(
  session: QuizSession,
  options: { force?: boolean } = {}
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured() || session.completedAt) return;
  if (isCurrentSessionDiscarded(session.id)) return;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  const userId = user.id;

  const canonicalSession = canonicalizeSessionsForUser(userId, [session])[0];
  if (!canonicalSession) return;

  const remoteActiveRows = await withCloudFallback<QuizSessionRow[] | null>(
    fetchActiveQuizSessionRowsForUser(userId),
    null
  );
  if (!remoteActiveRows) {
    return;
  }
  const moreCompleteRemoteItem = isExplicitQuizSessionNavigation()
    ? null
    : chooseMoreCompleteResumableSessionItem(
        canonicalSession,
        mapActiveQuizSessionRowsToListItems(remoteActiveRows, userId)
      );
  const moreCompleteRemoteSession = moreCompleteRemoteItem
    ? await withCloudFallback<QuizSession | null>(
        hydrateResumableQuizSessionListItem(userId, moreCompleteRemoteItem),
        null
      )
    : null;
  if (moreCompleteRemoteItem && !moreCompleteRemoteSession) {
    return;
  }
  if (moreCompleteRemoteSession) {
    const winner = canonicalizeSessionsForUser(userId, [moreCompleteRemoteSession])[0] ?? moreCompleteRemoteSession;
    saveCurrentSession(winner);
    rememberSyncedCurrentSessionState(
      userId,
      winner,
      buildSyncedAttemptSignatureMap(winner)
    );
    return;
  }

  const signature = getCurrentSessionSyncSignature(canonicalSession);
  const stateKey = getCurrentSessionSyncStateKey(userId, canonicalSession.id);
  const now = Date.now();
  const existing = currentSessionSyncState.get(stateKey);

  if (!options.force && existing?.lastSignature === signature) return;

  async function flush(
    nextSession: QuizSession,
    nextSignature: string,
    syncedAttemptSignatures?: Map<number, string>
  ) {
    await withClientTimeout(
      upsertSessionsForUser(userId, [nextSession], {
        activeCheckpoint: true,
        syncedAttemptSignatures
      }),
      CLOUD_SYNC_BATCH_TIMEOUT_MS,
      "目前作答雲端同步逾時，先保留本機紀錄。"
    );
    currentSessionSyncState.set(stateKey, {
      lastSyncedAt: Date.now(),
      lastSignature: nextSignature,
      syncedAttemptSignatures:
        syncedAttemptSignatures ?? buildSyncedAttemptSignatureMap(nextSession),
      pendingTimer: null,
      pendingSession: null,
      pendingSignature: ""
    });
  }

  if (options.force || !existing || now - existing.lastSyncedAt >= CURRENT_SESSION_SYNC_MIN_INTERVAL_MS) {
    if (existing?.pendingTimer) {
      clearTimeout(existing.pendingTimer);
    }
    await flush(
      canonicalSession,
      signature,
      existing?.syncedAttemptSignatures
    );
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
      void flush(
        pendingSession,
        pendingSignature,
        latestState?.syncedAttemptSignatures ?? new Map<number, string>()
      ).catch((error) => {
        console.error("Current session cloud sync skipped:", error);
        currentSessionSyncState.set(stateKey, {
          lastSyncedAt: latestState?.lastSyncedAt ?? 0,
          lastSignature: latestState?.lastSignature ?? "",
          syncedAttemptSignatures:
            latestState?.syncedAttemptSignatures ?? new Map<number, string>(),
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

type LeaderboardLoadResult = {
  leaderboard: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
};

export async function loadLeaderboardResult(
  limit = 50,
  options: { signal?: AbortSignal; currentUserId?: string } = {}
): Promise<LeaderboardLoadResult> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return { leaderboard: [], currentUserEntry: null };
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (options.currentUserId) {
    params.set("currentUserId", options.currentUserId);
  }

  const response = await fetch(`/api/leaderboard?${params.toString()}`, {
    signal: options.signal
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        message?: string;
        leaderboard?: LeaderboardEntry[];
        currentUserEntry?: LeaderboardEntry | null;
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.leaderboard) {
    throw new Error(payload?.message || "刷題榜載入失敗");
  }

  return {
    leaderboard: payload.leaderboard,
    currentUserEntry: payload.currentUserEntry ?? null
  };
}

export async function loadLeaderboard(limit = 50, options: { signal?: AbortSignal } = {}) {
  const result = await loadLeaderboardResult(limit, options);
  return result.leaderboard;
}

const BACKGROUND_STATS_LOOKUP_CHUNK_SIZE = 100;
const BACKGROUND_STATS_LOOKUP_LIMIT = 200;
const BACKGROUND_CLASSIFICATION_LOOKUP_LIMIT = 500;
const BACKGROUND_EXPLANATION_LOOKUP_CHUNK_SIZE = 20;
const BACKGROUND_EXPLANATION_SYNC_CHUNK_SIZE = 50;
const BACKGROUND_DATA_CACHE_VERSION = "v5";
const BACKGROUND_DATA_STORAGE_PREFIX = `aq:bg:${BACKGROUND_DATA_CACHE_VERSION}:`;
const BACKGROUND_DATA_LOCAL_STORAGE_MAX_BYTES = 180_000;
const BACKGROUND_DATA_TTL_MS = {
  stats: 30 * 60 * 1000,
  explanations: 60 * 1000,
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

function removeBackgroundStorageCache(storageName: "sessionStorage" | "localStorage", key: string) {
  const storage = getBackgroundStorage(storageName);
  if (!storage) return;

  try {
    storage.removeItem(`${BACKGROUND_DATA_STORAGE_PREFIX}${key}`);
  } catch {
    // Browser storage is best-effort.
  }
}

export function clearQuestionExplanationBackgroundCache(questionIds: string | string[]) {
  const ids = Array.isArray(questionIds) ? questionIds : [questionIds];
  const normalizedIds = ids.map((questionId) => questionId.trim()).filter(Boolean);
  if (normalizedIds.length === 0) return;

  for (const questionId of normalizedIds) {
    const key = `explanation:${questionId}`;
    backgroundDataMemoryCache.delete(key);
    removeBackgroundStorageCache("sessionStorage", key);
    removeBackgroundStorageCache("localStorage", key);
  }

  for (const cacheKey of Array.from(backgroundDataRequestsInFlight.keys())) {
    if (
      cacheKey.startsWith("explanations:") &&
      normalizedIds.some((questionId) => cacheKey.includes(questionId))
    ) {
      backgroundDataRequestsInFlight.delete(cacheKey);
    }
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

  const uniqueQuestionIds = Array.from(new Set(questionIds.map((questionId) => questionId.trim()).filter(Boolean)));
  const cachedOverrides = new Map<string, QuestionExplanationOverride | null>();
  const missingQuestionIds = uniqueQuestionIds.filter((questionId) => {
    const cachedValue = readBackgroundCache<QuestionExplanationOverride | null>(`explanation:${questionId}`);
    if (cachedValue !== undefined) {
      cachedOverrides.set(questionId, cachedValue);
      return false;
    }
    return true;
  });

  for (let start = 0; start < missingQuestionIds.length; start += BACKGROUND_EXPLANATION_LOOKUP_CHUNK_SIZE) {
    try {
      const requestIds = missingQuestionIds
        .slice(start, start + BACKGROUND_EXPLANATION_LOOKUP_CHUNK_SIZE)
        .sort();
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
        for (const questionId of requestIds) {
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
      break;
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
    let syncedCount = 0;
    for (let start = 0; start < normalizedOverrides.length; start += BACKGROUND_EXPLANATION_SYNC_CHUNK_SIZE) {
      const chunk = normalizedOverrides.slice(start, start + BACKGROUND_EXPLANATION_SYNC_CHUNK_SIZE);
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "sync_overrides",
          accessToken,
          overrides: chunk.map((override) => ({
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

      syncedCount += payload.syncedCount ?? 0;
    }

    const completedAt = Date.now();
    recentSharedQuestionExplanationSyncs.set(signature, completedAt);
    writeQuestionExplanationSyncMarker(signature, { completedAt });
    clearQuestionExplanationBackgroundCache(
      normalizedOverrides.map((override) => override.questionId)
    );

    return {
      syncedCount
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

export async function loadFeedbackMessagesResult(
  limit = 20,
  options: { fresh?: boolean } = {}
): Promise<{
  messages: FeedbackMessage[];
  degraded: boolean;
  stale: boolean;
  message?: string;
}> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return { messages: [], degraded: true, stale: false, message: "留言板暫時維護中。" };
  }

  const freshQuery = options.fresh ? `&fresh=1&ts=${Date.now()}` : "";
  const response = await fetch(
    `/api/feedback?limit=${encodeURIComponent(String(limit))}${freshQuery}`,
    options.fresh ? { cache: "no-store" } : undefined
  );
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
  accessToken?: string | null;
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

  const identityIntent = getFeedbackIdentityIntent({
    isAnonymous: input.isAnonymous,
    hasUser: Boolean(input.user?.id),
    accessToken: input.accessToken
  });
  if (identityIntent === "authentication-pending") {
    throw new Error("登入狀態正在刷新，這則留言尚未送出，請稍後再試。");
  }
  const accessToken = identityIntent === "authenticated" ? input.accessToken : null;
  let response: Response;

  try {
    response = await postFeedbackRequest(
      "/api/feedback",
      {
        visitorId: getVisitorId(),
        content,
        isAnonymous: input.isAnonymous,
        parentId: input.parentId ?? null
      },
      accessToken,
      "留言送出逾時"
    );
  } catch {
    throw new Error("留言送出逾時，內容仍保留在輸入框；請先重新整理留言，不用再次送出。");
  }

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
  accessToken?: string | null;
  user?: Pick<User, "id" | "email" | "user_metadata"> | null;
}) {
  if (isSupabaseRecoveryMode()) {
    throw new Error("留言板暫時維護中，先讓登入與同步恢復。");
  }
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 尚未設定，暫時無法投票。");
  }

  const identityIntent = getFeedbackIdentityIntent({
    isAnonymous: false,
    hasUser: Boolean(input.user?.id),
    accessToken: input.accessToken
  });
  if (identityIntent === "authentication-pending") {
    throw new Error("登入狀態正在刷新，這次投票尚未送出，請稍後再試。");
  }
  const accessToken = identityIntent === "authenticated" ? input.accessToken : null;

  const response = await postFeedbackRequest(
    "/api/feedback/vote",
    {
      visitorId: getVisitorId(),
      messageId: input.messageId,
      vote: input.vote
    },
    accessToken,
    "留言投票逾時，請稍後再試。"
  );

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

type PreviewAISearchCustomPaperInput = Omit<
  GenerateAISearchCustomPaperInput,
  "name" | "isPublic"
>;

type CreateAISearchCustomPaperInput = {
  accessToken?: string | null;
  visitorId: string;
  questionIds: string[];
  query: string;
  name?: string;
  isPublic: boolean;
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
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "generate",
        ...input
      })
    },
    20_000,
    "自訂卷產生逾時，請稍後再試。"
  );

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
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "generate_ai_search",
        ...input
      })
    },
    60_000,
    "AI 智慧檢索逾時，請縮小年份或科目範圍後再試。"
  );

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "AI 智慧檢索自訂卷產生失敗");
  }

  return payload.paper;
}

export async function previewAISearchCustomPaper(
  input: PreviewAISearchCustomPaperInput
): Promise<CustomPaperSearchPreview> {
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "preview_ai_search",
        ...input
      })
    },
    60_000,
    "AI 搜題逾時，請縮小年份或科目範圍後再試。"
  );

  const rawText = await response.text();
  const payload = tryParseJson<{
    ok?: boolean;
    message?: string;
    search?: CustomPaperSearchPreview;
  }>(rawText);

  if (!response.ok || !payload?.ok || !payload.search) {
    throw new Error(payload?.message || rawText || "AI 搜題預覽失敗");
  }

  return payload.search;
}

export async function createAISearchCustomPaper(
  input: CreateAISearchCustomPaperInput
): Promise<CustomPaperDetail> {
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "create_ai_search_paper",
        ...input
      })
    },
    20_000,
    "建立自訂卷逾時，搜尋結果仍保留在畫面上，可以稍後再試。"
  );

  const rawText = await response.text();
  const payload = tryParseJson<{
    ok?: boolean;
    message?: string;
    paper?: CustomPaperDetail;
  }>(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "AI 搜題建卷失敗");
  }

  return payload.paper;
}

export async function importJsonCustomPaper(
  input: ImportJsonCustomPaperInput
): Promise<CustomPaperDetail> {
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "import_json",
        ...input
      })
    },
    20_000,
    "JSON 自訂卷匯入逾時，原始內容仍保留在畫面上。"
  );

  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; paper?: CustomPaperDetail }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.paper) {
    throw new Error(payload?.message || rawText || "匯入 JSON 自訂卷失敗");
  }

  return payload.paper;
}

export async function lookupCustomPaper(
  paperCode: string,
  accessToken?: string | null,
  visitorId?: string | null
): Promise<CustomPaperDetail> {
  const response = await fetchWithClientTimeout(
    `/api/custom-papers?paperCode=${encodeURIComponent(paperCode)}`,
    {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(visitorId ? { "X-Visitor-ID": visitorId } : {})
      }
    },
    15_000,
    "自訂卷讀取逾時，請稍後再試。"
  );
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
  const response = await fetchWithClientTimeout(
    "/api/custom-papers",
    {},
    15_000,
    "公開卷讀取逾時，請稍後再試。"
  );
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
