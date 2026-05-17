import type { User } from "@supabase/supabase-js";
import type {
  LeaderboardEntry,
  OwnerDailyPoint,
  OwnerDashboardStats,
  OwnerExplanationUsageEntry,
  QuestionExplanationOverride,
  QuestionCommunityStats,
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

function sessionFreshnessValue(session: QuizSession) {
  return session.completedAt || session.startedAt || "";
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
  const completedSessions = sessions.filter((session) => Boolean(session.completedAt));
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

  if (error) {
    throw error;
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

async function syncQuestionStatsForSessions(sessions: QuizSession[]) {
  if (sessions.length === 0) return;

  await upsertQuestionAttemptLogs(sessions);
  await upsertQuestionAttemptDevice(sessions);
  await upsertQuestionAttemptDeviceDaily(sessions);
  await refreshQuestionAccuracyStats(
    sessions.flatMap((session) => session.attempts.map((attempt) => attempt.questionId))
  );
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
  const localSessions = mergeSessions(
    loadCompletedSessionsForUser("guest"),
    loadCompletedSessions()
  );
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, user_id, subject, started_at, completed_at, session_payload, updated_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  const remoteSessions = (data ?? [])
    .map((row) => mapRowToSession(row as QuizSessionRow))
    .filter((session): session is QuizSession => Boolean(session));
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
    await upsertSessionsForUser(data.user.id, [session]);
  }

  await syncQuestionStatsForSessionsSafely([session]);
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

export async function loadOwnerDashboardStats(): Promise<OwnerDashboardStats> {
  if (!isSupabaseConfigured()) {
    return {
      totalVisitorDevices: 0,
      totalAttemptDevices: 0,
      attemptDevicesToday: 0,
      onlineVisitors: 0,
      totalSyncedUsers: 0,
      attemptsToday: 0,
      attemptsLast7Days: 0,
      totalAttempts: 0,
      aiExplanationCount: 0,
      aiExplanationInputTokens: 0,
      aiExplanationOutputTokens: 0,
      aiExplanationTotalTokens: 0,
      updatedAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseBrowserClient();
  const now = new Date();
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { startIso, endIso } = getTaipeiDayRange();

  const [
    totalVisitorsResult,
    totalAttemptDevicesResult,
    todayAttemptDevicesResult,
    onlineVisitorsResult,
    totalUsersResult,
    totalAttemptsResult,
    todayAttemptsResult,
    last7DaysAttemptsResult,
    aiExplanationUsageRows
  ] = await Promise.all([
    supabase.from("site_visitors").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_devices").select("*", { count: "exact", head: true }),
    supabase
      .from("question_attempt_devices")
      .select("*", { count: "exact", head: true })
      .gte("last_attempt_at", startIso)
      .lt("last_attempt_at", endIso),
    supabase
      .from("site_visitors")
      .select("*", { count: "exact", head: true })
      .gte("last_seen_at", onlineSince),
    supabase.from("leaderboard_profiles").select("*", { count: "exact", head: true }),
    supabase.from("question_attempt_logs").select("*", { count: "exact", head: true }),
    supabase
      .from("question_attempt_logs")
      .select("*", { count: "exact", head: true })
      .gte("answered_at", startIso)
      .lt("answered_at", endIso),
    supabase
      .from("question_attempt_logs")
      .select("*", { count: "exact", head: true })
      .gte("answered_at", sevenDaysAgo),
    fetchAIExplanationUsageRows()
  ]);

  const errors = [
    totalVisitorsResult.error,
    totalAttemptDevicesResult.error,
    todayAttemptDevicesResult.error,
    onlineVisitorsResult.error,
    totalUsersResult.error,
    totalAttemptsResult.error,
    todayAttemptsResult.error,
    last7DaysAttemptsResult.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0] as Error;
  }

  const aiUsageRows = aiExplanationUsageRows;
  const aiExplanationCount = aiUsageRows.length;
  const aiExplanationInputTokens = aiUsageRows.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0);
  const aiExplanationOutputTokens = aiUsageRows.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
  const aiExplanationTotalTokens = aiUsageRows.reduce(
    (sum, row) => sum + (row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0)),
    0
  );

  return {
    totalVisitorDevices: totalVisitorsResult.count ?? 0,
    totalAttemptDevices: totalAttemptDevicesResult.count ?? 0,
    attemptDevicesToday: todayAttemptDevicesResult.count ?? 0,
    onlineVisitors: onlineVisitorsResult.count ?? 0,
    totalSyncedUsers: totalUsersResult.count ?? 0,
    attemptsToday: todayAttemptsResult.count ?? 0,
    attemptsLast7Days: last7DaysAttemptsResult.count ?? 0,
    totalAttempts: totalAttemptsResult.count ?? 0,
    aiExplanationCount,
    aiExplanationInputTokens,
    aiExplanationOutputTokens,
    aiExplanationTotalTokens,
    updatedAt: now.toISOString()
  };
}

export async function loadOwnerExplanationUsage(): Promise<OwnerExplanationUsageEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const grouped = new Map<string, OwnerExplanationUsageEntry>();

  for (const row of await fetchAIExplanationUsageRows()) {
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

  const [{ data: attemptRows, error: attemptError }, { data: deviceRows, error: deviceError }] =
    await Promise.all([
      supabase
        .from("question_attempt_logs")
        .select("answered_at")
        .gte("answered_at", `${startDate}T00:00:00+08:00`),
      supabase
        .from("question_attempt_device_daily")
        .select("activity_date")
        .gte("activity_date", startDate)
    ]);

  if (attemptError) throw attemptError;
  if (deviceError) throw deviceError;

  const attemptMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  for (const row of attemptRows ?? []) {
    const key = getTaipeiDayKey(new Date(row.answered_at));
    attemptMap.set(key, (attemptMap.get(key) ?? 0) + 1);
  }

  for (const row of deviceRows ?? []) {
    deviceMap.set(row.activity_date, (deviceMap.get(row.activity_date) ?? 0) + 1);
  }

  return dayKeys.map((date) => ({
    date,
    attempts: attemptMap.get(date) ?? 0,
    devices: deviceMap.get(date) ?? 0
  }));
}
