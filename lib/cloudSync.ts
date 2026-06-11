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
  clearMatchingCurrentSessions,
  getCanonicalSessionId,
  loadCurrentSession,
  loadCurrentSessionForUser,
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  normalizeSessions,
  saveCurrentSession,
  saveCompletedSessions
} from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
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
  session_payload: Partial<QuizSession> | null;
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

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  total_attempts: number;
  correct_attempts: number;
  correct_rate: number;
  total_sessions: number;
  updated_at?: string | null;
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
const CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE = 20;
const CURRENT_SESSION_SYNC_MIN_INTERVAL_MS = 30_000;
const STATS_SYNC_ATTEMPT_BATCH_SIZE = 200;
const CLOUD_SESSION_LOOKUP_TIMEOUT_MS = 3500;

type CurrentSessionSyncState = {
  lastSyncedAt: number;
  lastSignature: string;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  pendingSession: QuizSession | null;
  pendingSignature: string;
};

const currentSessionSyncState = new Map<string, CurrentSessionSyncState>();

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

    if (
      nextFreshness > currentFreshness ||
      (nextFreshness === currentFreshness && nextAttempts >= currentAttempts)
    ) {
      merged.set(key, session);
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

    const localFreshness = sessionFreshnessValue(localSession);
    const remoteFreshness = sessionFreshnessValue(remoteSession);
    if (localFreshness > remoteFreshness) return true;
    if (localFreshness < remoteFreshness) return false;

    return localSession.attempts.length > remoteSession.attempts.length;
  });
}

function mapRowToSession(
  row: QuizSessionRow | null,
  attemptMap?: Map<string, Attempt[]>
) {
  if (!row) return null;

  const payload = row.session_payload ?? {};
  const resolvedAttempts = attemptMap?.get(row.id) ?? payload.attempts ?? [];

  return normalizeSessions([
    {
      id: row.id,
      subject: (payload.subject as SubjectName | undefined) ?? (row.subject as SubjectName),
      startedAt: payload.startedAt ?? row.started_at,
      completedAt: payload.completedAt ?? row.completed_at ?? undefined,
      settings: payload.settings,
      questionOrder: payload.questionOrder ?? [],
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
    const { data, error } = await supabase
      .from("quiz_session_attempts")
      .select(
        "session_id, user_id, question_order, question_id, selected_answer, correct_answer, is_correct, confidence, error_type, answered_at, source_mode, subject_snapshot, chapter_snapshot, section_snapshot"
      )
      .eq("user_id", userId)
      .in("session_id", chunk)
      .order("question_order", { ascending: true });

    if (error) {
      throw error;
    }

    rows.push(...((data ?? []) as QuizSessionAttemptRow[]));
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
        "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, updated_at"
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
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select(
      "id, user_id, subject, mode, session_name, question_count, correct_count, wrong_count, average_confidence, started_at, completed_at, session_payload, updated_at"
    )
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as QuizSessionRow | null) ?? null;
}

async function fetchResolvedQuizSessionsForUser(userId: string) {
  const sessionRows = await fetchQuizSessionsForUser(userId);
  const sessionRowsNeedingAttemptRows = sessionRows.filter((row) => {
    const payloadAttempts = row.session_payload?.attempts ?? [];
    return payloadAttempts.length === 0;
  });
  const attemptRows = await fetchSessionAttemptRowsForUser(
    userId,
    sessionRowsNeedingAttemptRows.map((row) => row.id)
  );
  const attemptMap = buildAttemptMap(attemptRows);

  const sessions = sessionRows
    .map((row) => mapRowToSession(row, attemptMap))
    .filter((session): session is QuizSession => Boolean(session));

  const sessionsMissingAttemptRows = sessionRows
    .filter((row) => {
      const payloadAttempts = row.session_payload?.attempts ?? [];
      return payloadAttempts.length > 0 && !attemptMap.has(row.id);
    })
    .map((row) => mapRowToSession(row))
    .filter((session): session is QuizSession => Boolean(session));

  return {
    sessions,
    sessionsMissingAttemptRows
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

function summarizeLeaderboardSessions(sessions: QuizSession[]) {
  const completedSessions = sessions.filter(
    (session) => Boolean(session.completedAt) && session.settings?.mode !== "peak_challenge"
  );
  const totalAttempts = completedSessions.reduce((sum, session) => sum + session.attempts.length, 0);
  const correctAttempts = completedSessions.reduce(
    (sum, session) => sum + session.attempts.filter((attempt) => attempt.isCorrect).length,
    0
  );
  const correctRate = totalAttempts === 0 ? 0 : Number(((correctAttempts / totalAttempts) * 100).toFixed(1));

  return {
    totalAttempts,
    correctAttempts,
    correctRate,
    totalSessions: completedSessions.length
  };
}

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    totalAttempts: row.total_attempts,
    correctAttempts: row.correct_attempts,
    correctRate: Number(row.correct_rate ?? 0),
    totalSessions: row.total_sessions,
    updatedAt: row.updated_at ?? undefined
  };
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
  return {
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
  batchSize = CLOUD_COMPLETED_SESSION_UPLOAD_BATCH_SIZE
) {
  for (let index = 0; index < sessions.length; index += batchSize) {
    await upsertSessionsForUser(userId, sessions.slice(index, index + batchSize));
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
  if (sessionsToBackfill.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToBackfill);
  }
  if (sessionsToUpload.length > 0) {
    void upsertSessionsForUserInBatchesSafely(userId, sessionsToUpload);
  }

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

  const remoteRow = await fetchActiveQuizSessionRow(userId);
  const remoteAttemptMap = remoteRow
    ? buildAttemptMap(await fetchSessionAttemptRowsForUser(userId, [remoteRow.id]))
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
    await upsertSessionsForUser(userId, canonicalizeSessionsForUser(userId, [winner]));
  }

  return winner ?? remoteCurrentSession ?? null;
}

export async function pushCompletedSessionToSupabase(session: QuizSession) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const canonicalSessions = canonicalizeSessionsForUser(data.user.id, [session]);
    saveCompletedSessions(
      mergeSessions(
        loadCompletedSessions(),
        canonicalSessions
      )
    );
    await upsertSessionsForUser(data.user.id, canonicalSessions);
    await syncLeaderboardProfileForCurrentUser(data.user, loadCompletedSessions());
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
    await upsertSessionsForUser(userId, [nextSession]);
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
  sessions?: QuizSession[]
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const sourceSessions = sessions ?? loadCompletedSessions();
  const summary = summarizeLeaderboardSessions(sourceSessions);

  const { error } = await supabase.from("leaderboard_profiles").upsert(
    {
      user_id: user.id,
      display_name: getLeaderboardDisplayName(user),
      total_attempts: summary.totalAttempts,
      correct_attempts: summary.correctAttempts,
      correct_rate: summary.correctRate,
      total_sessions: summary.totalSessions,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function updateLeaderboardDisplayName(
  user: Pick<User, "id" | "email" | "user_metadata">,
  displayName: string
) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const trimmed = displayName.trim().slice(0, 24) || getLeaderboardDisplayName(user);

  const { error } = await supabase.from("leaderboard_profiles").upsert(
    {
      user_id: user.id,
      display_name: trimmed,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function loadLeaderboard(limit = 50) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [] as LeaderboardEntry[];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("leaderboard_profiles")
    .select("user_id, display_name, total_attempts, correct_attempts, correct_rate, total_sessions, updated_at")
    .order("total_attempts", { ascending: false })
    .order("correct_rate", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow));
}

const BACKGROUND_STATS_LOOKUP_LIMIT = 40;
const BACKGROUND_CLASSIFICATION_LOOKUP_LIMIT = 60;

export async function loadQuestionCommunityStats(questionIds: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || questionIds.length === 0) {
    return [] as QuestionCommunityStats[];
  }

  const uniqueQuestionIds = Array.from(new Set(questionIds)).slice(0, BACKGROUND_STATS_LOOKUP_LIMIT);
  const response = await fetch(
    `/api/question-background-data?kind=stats&ids=${encodeURIComponent(uniqueQuestionIds.join(","))}`,
    { cache: "no-store" }
  );
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; stats?: QuestionAccuracyStatRow[] }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "題目統計讀取失敗");
  }

  return (payload.stats ?? []).map((row) => mapQuestionAccuracyStatRow(row as QuestionAccuracyStatRow));
}

export async function loadSharedQuestionExplanationOverrides(questionIds: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured() || questionIds.length === 0) {
    return {} as Record<string, QuestionExplanationOverride>;
  }

  const uniqueQuestionIds = Array.from(new Set(questionIds)).slice(0, 20);
  const response = await fetch(
    `/api/question-background-data?kind=explanations&ids=${encodeURIComponent(uniqueQuestionIds.join(","))}`,
    { cache: "no-store" }
  );
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; overrides?: QuestionExplanationOverrideRow[] }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "共享詳解讀取失敗");
  }

  return Object.fromEntries(
    (payload.overrides ?? []).map((row) => {
      const typedRow = row as QuestionExplanationOverrideRow;
      return [typedRow.question_id, mapQuestionExplanationOverrideRow(typedRow)] as const;
    })
  );
}

export async function syncSharedQuestionExplanationOverrides(
  overrides: Array<{
    questionId: string;
    override: QuestionExplanationOverride;
  }>,
  accessToken?: string | null
) {
  if (isSupabaseRecoveryMode()) {
    return { syncedCount: 0 };
  }
  if (!accessToken || overrides.length === 0) {
    return { syncedCount: 0 };
  }

  const response = await fetch("/api/question-explanation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "sync_overrides",
      accessToken,
      overrides: overrides.map(({ questionId, override }) => ({
        questionId,
        explanation: override.explanation,
        optionAnalysis: override.optionAnalysis ?? {},
        memoryTip: override.memoryTip ?? "",
        model: override.model ?? "gpt-5-mini",
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
    throw new Error(payload?.message || "共享詳解同步失敗。");
  }

  return {
    syncedCount: payload.syncedCount ?? 0
  };
}

export async function loadConfirmedQuestionClassificationOverrides(questionIds?: string[]) {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  const uniqueQuestionIds = Array.from(new Set((questionIds ?? []).filter(Boolean))).slice(
    0,
    BACKGROUND_CLASSIFICATION_LOOKUP_LIMIT
  );

  if (uniqueQuestionIds.length === 0) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  const response = await fetch(
    `/api/question-background-data?kind=classifications&ids=${encodeURIComponent(uniqueQuestionIds.join(","))}`,
    { cache: "no-store" }
  );
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; overrides?: QuestionClassificationOverrideRow[] }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "分類覆蓋讀取失敗");
  }

  return Object.fromEntries(
    (payload.overrides ?? []).map((row) => {
      const typedRow = row as QuestionClassificationOverrideRow;
      return [typedRow.question_id, mapQuestionClassificationOverrideRow(typedRow)] as const;
    })
  );
}

export async function trackVisitorPresence(userId?: string | null) {
  if (isSupabaseRecoveryMode()) return;
  if (!isSupabaseConfigured()) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const response = await fetch("/api/visitor-presence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId,
      userId: userId ?? null
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "訪客狀態同步失敗");
  }
}

export async function loadVisitorStats(): Promise<VisitorStats> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return {
      totalVisitors: 0,
      onlineVisitors: 0,
      updatedAt: getRecoveryTimestamp()
    };
  }

  const response = await fetch("/api/visitor-stats");
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; stats?: VisitorStats }
    | null;

  if (!response.ok || !payload?.ok || !payload.stats) {
    throw new Error(payload?.message || "訪客統計讀取失敗");
  }

  return payload.stats;
}

export async function loadFeedbackMessages(limit = 20): Promise<FeedbackMessage[]> {
  if (isSupabaseRecoveryMode() || !isSupabaseConfigured()) {
    return [];
  }

  const response = await fetch(`/api/feedback?limit=${encodeURIComponent(String(limit))}`, {
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; messages?: FeedbackMessage[] }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "留言讀取失敗");
  }

  return payload.messages ?? [];
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

  const accessToken = input.user
    ? (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token ?? null
    : null;

  const response = await fetch("/api/feedback", {
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
  });

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
  const response = await fetch(`/api/community-stats?days=${encodeURIComponent(String(safeDays))}`, {
    cache: "no-store"
  });
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
