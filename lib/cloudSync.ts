import type { User } from "@supabase/supabase-js";
import type {
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
  QuestionSourceType,
  SubjectName,
  QuizSession,
  VisitorStats
} from "@/types/quiz";
import {
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  saveCompletedSessions
} from "@/lib/storage";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured
} from "@/lib/supabase/client";
import { getOrCreateVisitorId } from "@/lib/visitor";

type QuizSessionRow = {
  id: string;
  user_id: string;
  subject: string;
  started_at: string;
  completed_at: string | null;
  session_payload: QuizSession;
  updated_at?: string | null;
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

const AI_SEARCH_USAGE_PREFIX = "AI_SEARCH:";

type FeedbackMessageRow = {
  id: string | number;
  content: string;
  parent_id?: string | number | null;
  display_name?: string | null;
  is_anonymous: boolean;
  created_at: string;
};

const SUPABASE_PAGE_SIZE = 1000;
const FEEDBACK_HOURLY_LIMIT = 3;
const FEEDBACK_DAILY_LIMIT = 10;

function normalizeAttemptSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
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

async function fetchAIExplanationUsageRows() {
  if (!isSupabaseConfigured()) {
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

function mapFeedbackMessageRow(row: FeedbackMessageRow): FeedbackMessage {
  return {
    id: String(row.id),
    content: row.content,
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    displayName: row.display_name ?? undefined,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at
  };
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
    const current = merged.get(session.id);
    if (!current) {
      merged.set(session.id, session);
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
      merged.set(session.id, session);
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    sessionFreshnessValue(b).localeCompare(sessionFreshnessValue(a))
  );
}

function mapRowToSession(row: QuizSessionRow | null) {
  return row?.session_payload ?? null;
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

async function upsertQuestionAttemptLogs(sessions: QuizSession[]) {
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
  const attemptRows = buildQuestionAttemptLogRows(sessions);
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

  const response = await fetch("/api/stats-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      attemptRows,
      deviceRow,
      deviceDailyRows,
      questionIds,
      activityDates
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || "統計聚合更新失敗");
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
  if (!isSupabaseConfigured() || sessions.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const rows: QuizSessionRow[] = sessions.map((session) => ({
    id: session.id,
    user_id: userId,
    subject: session.subject,
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    session_payload: session
  }));

  const { error } = await supabase
    .from("quiz_sessions")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function syncCompletedSessionsForCurrentUser(userId: string) {
  if (!isSupabaseConfigured()) {
    return loadCompletedSessions();
  }

  const supabase = getSupabaseBrowserClient();
  const localSessions = canonicalizeSessionsForUser(
    userId,
    mergeSessions(loadCompletedSessionsForUser("guest"), loadCompletedSessions())
  );
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, user_id, subject, started_at, completed_at, session_payload, updated_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  const remoteSessions = canonicalizeSessionsForUser(
    userId,
    (data ?? [])
      .map((row) => mapRowToSession(row as QuizSessionRow))
      .filter((session): session is QuizSession => Boolean(session))
  );
  const mergedSessions = mergeSessions(localSessions, remoteSessions);

  saveCompletedSessions(mergedSessions);
  await upsertSessionsForUser(userId, mergedSessions);
  await syncQuestionStatsForSessionsSafely(mergedSessions);

  return mergedSessions;
}

export async function pushCompletedSessionToSupabase(session: QuizSession) {
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
  }

  await syncQuestionStatsForSessionsSafely(
    data.user ? canonicalizeSessionsForUser(data.user.id, [session]) : [session]
  );
}

export async function pushQuestionStatsSnapshotToSupabase(session: QuizSession) {
  if (!isSupabaseConfigured()) return;
  await syncQuestionStatsForSessionsSafely([session]);
}

export async function syncLeaderboardProfileForCurrentUser(
  user: Pick<User, "id" | "email" | "user_metadata">,
  sessions?: QuizSession[]
) {
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
  if (!isSupabaseConfigured()) {
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

export async function loadQuestionCommunityStats(questionIds: string[]) {
  if (!isSupabaseConfigured() || questionIds.length === 0) {
    return [] as QuestionCommunityStats[];
  }

  const supabase = getSupabaseBrowserClient();
  const uniqueQuestionIds = Array.from(new Set(questionIds));
  const { data, error } = await supabase
    .from("question_accuracy_stats")
    .select("question_id, total_attempts, correct_attempts, correct_rate, updated_at")
    .in("question_id", uniqueQuestionIds);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapQuestionAccuracyStatRow(row as QuestionAccuracyStatRow));
}

export async function loadSharedQuestionExplanationOverrides(questionIds: string[]) {
  if (!isSupabaseConfigured() || questionIds.length === 0) {
    return {} as Record<string, QuestionExplanationOverride>;
  }

  const supabase = getSupabaseBrowserClient();
  const uniqueQuestionIds = Array.from(new Set(questionIds));
  const { data, error } = await supabase
    .from("question_explanation_overrides")
    .select("question_id, explanation, option_analysis, memory_tip, model, updated_at")
    .in("question_id", uniqueQuestionIds);

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((row) => {
      const typedRow = row as QuestionExplanationOverrideRow;
      return [typedRow.question_id, mapQuestionExplanationOverrideRow(typedRow)] as const;
    })
  );
}

export async function loadConfirmedQuestionClassificationOverrides(questionIds?: string[]) {
  if (!isSupabaseConfigured()) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  const supabase = getSupabaseBrowserClient();
  const uniqueQuestionIds = Array.from(new Set((questionIds ?? []).filter(Boolean)));
  let query = supabase
    .from("question_classification_overrides")
    .select("question_id, subject, chapter, section, source_report_id, updated_at");

  if (uniqueQuestionIds.length > 0) {
    query = query.in("question_id", uniqueQuestionIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((row) => {
      const typedRow = row as QuestionClassificationOverrideRow;
      return [typedRow.question_id, mapQuestionClassificationOverrideRow(typedRow)] as const;
    })
  );
}

export async function trackVisitorPresence(userId?: string | null) {
  if (!isSupabaseConfigured()) return;

  const visitorId = getVisitorId();
  if (!visitorId) return;

  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("site_visitors").upsert(
    {
      visitor_id: visitorId,
      user_id: userId ?? null,
      last_seen_at: now
    },
    { onConflict: "visitor_id" }
  );

  if (error) {
    throw error;
  }
}

export async function loadVisitorStats(): Promise<VisitorStats> {
  if (!isSupabaseConfigured()) {
    return {
      totalVisitors: 0,
      onlineVisitors: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseBrowserClient();
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

  const [{ count: totalVisitors, error: totalError }, { count: onlineVisitors, error: onlineError }] =
    await Promise.all([
      supabase.from("site_visitors").select("*", { count: "exact", head: true }),
      supabase
        .from("site_visitors")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", onlineSince)
    ]);

  if (totalError) throw totalError;
  if (onlineError) throw onlineError;

  return {
    totalVisitors: totalVisitors ?? 0,
    onlineVisitors: onlineVisitors ?? 0,
    updatedAt: new Date().toISOString()
  };
}

export async function loadFeedbackMessages(limit = 40): Promise<FeedbackMessage[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("feedback_messages")
    .select("id, content, parent_id, display_name, is_anonymous, created_at")
    .order("created_at", { ascending: false })
    .limit(limit * 4);

  if (error) {
    throw error;
  }

  const flatMessages = ((data ?? []) as FeedbackMessageRow[]).map(mapFeedbackMessageRow);
  const byParent = new Map<string, FeedbackMessage[]>();
  const roots: FeedbackMessage[] = [];

  for (const entry of flatMessages) {
    if (!entry.parentId) {
      roots.push({ ...entry, replies: [] });
      continue;
    }
    const group = byParent.get(entry.parentId) ?? [];
    group.push({ ...entry, replies: [] });
    byParent.set(entry.parentId, group);
  }

  return roots.slice(0, limit).map((entry) => ({
    ...entry,
    replies: (byParent.get(entry.id) ?? []).sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }));
}

export async function createFeedbackMessage(input: {
  content: string;
  isAnonymous: boolean;
  user?: Pick<User, "id" | "email" | "user_metadata"> | null;
  parentId?: string | null;
}) {
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
  if (!isSupabaseConfigured()) {
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

  const supabase = getSupabaseBrowserClient();
  const now = new Date();
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString();
  const dailySeries = await loadOwnerDailySeries(7);
  const todayPoint = dailySeries[dailySeries.length - 1];
  const attemptsToday = todayPoint?.attempts ?? 0;
  const attemptDevicesToday = todayPoint?.devices ?? 0;
  const attemptsLast7Days = dailySeries.reduce((sum, row) => sum + row.attempts, 0);

  const [
    totalVisitorsResult,
    totalAttemptDevicesResult,
    allAttemptVisitorRows,
    onlineVisitorsResult,
    totalUsersResult,
    totalAttemptsResult,
    aiExplanationUsageRows
  ] = await Promise.all([
    supabase.from("site_visitors").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_devices").select("*", { count: "exact", head: true }),
    fetchAllQuestionAttemptLogs<{ visitor_id?: string | null }>("visitor_id"),
    supabase
      .from("site_visitors")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", onlineSince),
    supabase.from("leaderboard_profiles").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_logs").select("*", { count: "exact", head: true }),
    fetchAIExplanationUsageRows()
  ]);

  const errors = [
    totalVisitorsResult.error,
    totalAttemptDevicesResult.error,
    onlineVisitorsResult.error,
    totalUsersResult.error,
    totalAttemptsResult.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0] as Error;
  }

  const aiUsageRows = filterAIUsageRows(aiExplanationUsageRows, "explanation");
  const aiSearchRows = filterAIUsageRows(aiExplanationUsageRows, "search");
  const visitorAttemptCountMap = new Map<string, number>();
  for (const row of allAttemptVisitorRows) {
    const visitorId = row.visitor_id?.trim();
    if (!visitorId) continue;
    visitorAttemptCountMap.set(visitorId, (visitorAttemptCountMap.get(visitorId) ?? 0) + 1);
  }
  const attemptVisitorsOverFive = Array.from(visitorAttemptCountMap.values()).filter((count) => count > 5).length;
  const aiExplanationCount = aiUsageRows.length;
  const aiExplanationInputTokens = aiUsageRows.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
  const aiExplanationOutputTokens = aiUsageRows.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
  const aiExplanationTotalTokens = aiUsageRows.reduce(
    (sum, row) => sum + (row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0)),
    0
  );
  const aiSearchCount = aiSearchRows.length;
  const aiSearchInputTokens = aiSearchRows.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
  const aiSearchOutputTokens = aiSearchRows.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
  const aiSearchTotalTokens = aiSearchRows.reduce(
    (sum, row) => sum + (row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0)),
    0
  );

  return {
    totalVisitorDevices: totalVisitorsResult.count ?? 0,
    totalAttemptDevices: totalAttemptDevicesResult.count ?? 0,
    attemptDevicesToday,
    attemptVisitorsOverFive,
    onlineVisitors: onlineVisitorsResult.count ?? 0,
    totalSyncedUsers: totalUsersResult.count ?? 0,
    attemptsToday,
    attemptsLast7Days,
    totalAttempts: totalAttemptsResult.count ?? 0,
    aiExplanationCount,
    aiExplanationInputTokens,
    aiExplanationOutputTokens,
    aiExplanationTotalTokens,
    aiSearchCount,
    aiSearchInputTokens,
    aiSearchOutputTokens,
    aiSearchTotalTokens,
    updatedAt: now.toISOString()
  };
}

export async function loadOwnerExplanationUsage(
  feature: "explanation" | "search" = "explanation"
): Promise<OwnerExplanationUsageEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const grouped = new Map<string, OwnerExplanationUsageEntry>();

  for (const row of filterAIUsageRows(await fetchAIExplanationUsageRows(), feature)) {
    const key = row.user_email?.trim().toLowerCase() || row.visitor_id || row.rate_key;
    const current = grouped.get(key) ?? {
      label: row.user_email?.trim() || row.visitor_id || row.rate_key,
      userEmail: row.user_email ?? undefined,
      visitorId: row.visitor_id ?? undefined,
      explanationCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      lastUsedAt: row.used_at
    };

    current.explanationCount += 1;
    current.inputTokens += row.input_tokens ?? 0;
    current.outputTokens += row.output_tokens ?? 0;
    current.totalTokens += row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
    if (!current.lastUsedAt || row.used_at > current.lastUsedAt) {
      current.lastUsedAt = row.used_at;
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.explanationCount !== a.explanationCount) {
      return b.explanationCount - a.explanationCount;
    }
    return b.totalTokens - a.totalTokens;
  });
}

export async function loadOwnerDailySeries(days = 14): Promise<OwnerDailyPoint[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const dayKeys = getRecentTaipeiDayKeys(days);
  const startDate = dayKeys[0];
  const [attemptRows, deviceRows] = await Promise.all([
    fetchAllQuestionAttemptLogs<{ answered_at: string }>("answered_at", (query) =>
      query.gte("answered_at", `${startDate}T00:00:00+08:00`)
    ),
    fetchAllQuestionAttemptDeviceDailyRows<{ activity_date: string }>("activity_date", (query) =>
      query.gte("activity_date", startDate)
    )
  ]);

  const attemptMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  for (const row of attemptRows ?? []) {
    const key = getTaipeiDayKey(new Date(row.answered_at));
    if (!dayKeys.includes(key)) continue;
    attemptMap.set(key, (attemptMap.get(key) ?? 0) + 1);
  }

  for (const row of deviceRows ?? []) {
    if (!dayKeys.includes(row.activity_date)) continue;
    deviceMap.set(row.activity_date, (deviceMap.get(row.activity_date) ?? 0) + 1);
  }

  return dayKeys.map((date) => ({
    date,
    attempts: attemptMap.get(date) ?? 0,
    devices: deviceMap.get(date) ?? 0
  }));
}

export async function loadOwnerHourlySeries(): Promise<OwnerHourlyPoint[]> {
  if (!isSupabaseConfigured()) {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      attempts: 0,
      devices: 0
    }));
  }

  const supabase = getSupabaseBrowserClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const data = await fetchAllQuestionAttemptLogs<{ answered_at: string; visitor_id?: string | null }>(
    "answered_at, visitor_id",
    (query) => query.gte("answered_at", sevenDaysAgo)
  );

  const hourAttemptMap = new Map<number, number>();
  const hourDeviceMap = new Map<number, Set<string>>();

  for (const row of data ?? []) {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        hourCycle: "h23"
      }).format(new Date(row.answered_at))
    );

    hourAttemptMap.set(hour, (hourAttemptMap.get(hour) ?? 0) + 1);

    const visitorId = row.visitor_id?.trim();
    if (!hourDeviceMap.has(hour)) {
      hourDeviceMap.set(hour, new Set<string>());
    }
    if (visitorId) {
      hourDeviceMap.get(hour)?.add(visitorId);
    }
  }

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    attempts: hourAttemptMap.get(hour) ?? 0,
    devices: hourDeviceMap.get(hour)?.size ?? 0
  }));
}

function formatVisitorLabel(visitorId?: string | null) {
  if (!visitorId) return "未知裝置";
  const trimmed = visitorId.trim();
  if (trimmed.length <= 8) return `裝置 ${trimmed}`;
  return `裝置 ${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export async function loadOwnerTopAttemptVisitors(limit = 5): Promise<OwnerTopAttemptVisitorEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
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

export async function loadPeakChallengeLeaderboard(): Promise<PeakChallengeLeaderboardEntry[]> {
  const response = await fetch("/api/peak-challenge");
  const rawText = await response.text();
  const payload = tryParseJson<
    | { ok?: boolean; message?: string; leaderboard?: PeakChallengeLeaderboardEntry[] }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.leaderboard) {
    throw new Error(payload?.message || rawText || "巔峰賽榜單載入失敗");
  }

  return payload.leaderboard;
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
      }
  >(rawText);

  if (!response.ok || !payload?.ok || !payload.questionIds || !payload.questions) {
    throw new Error(payload?.message || rawText || "巔峰賽題目產生失敗");
  }

  return {
    sessionTitle: payload.sessionTitle ?? "巔峰賽",
    questionIds: payload.questionIds,
    questions: payload.questions,
    sourceBreakdown: payload.sourceBreakdown ?? {}
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
