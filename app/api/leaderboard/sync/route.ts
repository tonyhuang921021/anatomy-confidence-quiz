import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LeaderboardSyncBody = {
  accessToken?: string | null;
  displayName?: string | null;
  forceFullRefresh?: boolean;
};

type QuizSessionSummaryRow = {
  id: string;
  mode?: string | null;
  question_count?: number | null;
  correct_count?: number | null;
  completed_at?: string | null;
};

type AttemptFallbackRow = {
  session_id: string;
  is_correct: boolean;
};

type LeaderboardProfileRow = {
  display_name?: string | null;
  total_attempts?: number | null;
  correct_attempts?: number | null;
  correct_rate?: number | null;
  total_sessions?: number | null;
  updated_at?: string | null;
};

type LeaderboardRollupRow = {
  attempts: number;
  correct_attempts: number;
};

const RECENT_SESSION_ROLLUP_LIMIT = 80;
const FULL_SESSION_ROLLUP_PAGE_SIZE = 1000;
const ATTEMPT_FALLBACK_CHUNK_SIZE = 50;
const ROLLUP_LOOKUP_CHUNK_SIZE = 200;
const LEADERBOARD_PROFILE_MIN_REFRESH_MS = 15 * 60_000;
const MAX_REASONABLE_SESSION_QUESTION_COUNT = 500;

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getDisplayName(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  override?: string | null
) {
  const overrideName = typeof override === "string" ? override.trim() : "";
  if (overrideName) return overrideName.slice(0, 24);

  const metadataName =
    typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim() : "";
  if (metadataName) return metadataName.slice(0, 24);

  const emailName = user.email?.split("@")[0]?.trim();
  if (emailName) return emailName.slice(0, 24);

  return `玩家-${user.id.slice(0, 6)}`;
}

function getFiniteCount(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function hasReasonableStoredSessionCount(
  storedQuestionCount: number | null,
  storedCorrectCount: number | null
) {
  return (
    storedQuestionCount !== null &&
    storedQuestionCount > 0 &&
    storedQuestionCount <= MAX_REASONABLE_SESSION_QUESTION_COUNT &&
    storedCorrectCount !== null &&
    storedCorrectCount >= 0 &&
    storedCorrectCount <= storedQuestionCount
  );
}

function chooseBestSessionCount(
  attemptCount: { total: number; correct: number } | undefined,
  storedQuestionCount: number | null,
  storedCorrectCount: number | null
) {
  const hasReasonableStoredQuestionCount =
    storedQuestionCount !== null &&
    storedQuestionCount > 0 &&
    storedQuestionCount <= Math.max(MAX_REASONABLE_SESSION_QUESTION_COUNT, attemptCount?.total ?? 0);
  const syncedCandidates = [
    attemptCount && attemptCount.total > 0 ? { total: attemptCount.total, correct: attemptCount.correct } : null
  ].filter((candidate): candidate is { total: number; correct: number } => Boolean(candidate));

  const bestSyncedCount = syncedCandidates.reduce(
    (current, candidate) => (candidate.total > current.total ? candidate : current),
    { total: 0, correct: 0 }
  );
  const best =
    bestSyncedCount.total > 0
      ? bestSyncedCount
      : hasReasonableStoredQuestionCount
        ? { total: storedQuestionCount, correct: storedCorrectCount ?? 0 }
        : { total: 0, correct: 0 };

  return {
    total: best.total,
    correct: Math.min(best.correct, best.total)
  };
}

function isFreshProfile(profile: LeaderboardProfileRow | null | undefined) {
  if (!profile?.updated_at) return false;
  return Date.now() - new Date(profile.updated_at).getTime() < LEADERBOARD_PROFILE_MIN_REFRESH_MS;
}

function mapProfileToSummary(profile: LeaderboardProfileRow | null | undefined) {
  const totalAttempts = Number(profile?.total_attempts ?? 0);
  const correctAttempts = Number(profile?.correct_attempts ?? 0);
  return {
    totalAttempts,
    correctAttempts,
    correctRate: totalAttempts > 0 ? Number(profile?.correct_rate ?? 0) : 0,
    totalSessions: Number(profile?.total_sessions ?? 0)
  };
}

async function fetchProfile(supabase: any, userId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("leaderboard_profiles")
      .select("display_name, total_attempts, correct_attempts, correct_rate, total_sessions, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    1600,
    "刷題榜快照讀取逾時"
  )) as { data?: LeaderboardProfileRow | null; error?: unknown };

  if (error) throw error;
  return data ?? null;
}

async function fetchRecentCompletedSessionRows(supabase: any, userId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("quiz_sessions")
      .select("id, mode, question_count, correct_count, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .or("mode.is.null,mode.neq.peak_challenge")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(RECENT_SESSION_ROLLUP_LIMIT),
    2500,
    "近期作答快照讀取逾時"
  )) as { data?: QuizSessionSummaryRow[]; error?: unknown };

  if (error) throw error;
  return data ?? [];
}

async function fetchAllCompletedSessionRows(supabase: any, userId: string) {
  const rows: QuizSessionSummaryRow[] = [];

  for (let from = 0; ; from += FULL_SESSION_ROLLUP_PAGE_SIZE) {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("quiz_sessions")
        .select("id, mode, question_count, correct_count, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .or("mode.is.null,mode.neq.peak_challenge")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .range(from, from + FULL_SESSION_ROLLUP_PAGE_SIZE - 1),
      4000,
      "雲端作答紀錄讀取逾時"
    )) as { data?: QuizSessionSummaryRow[]; error?: unknown };

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < FULL_SESSION_ROLLUP_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchExistingRollupIds(supabase: any, sessionIds: string[]) {
  const ids = new Set<string>();

  for (let index = 0; index < sessionIds.length; index += ROLLUP_LOOKUP_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + ROLLUP_LOOKUP_CHUNK_SIZE);
    const { data, error } = (await withServerTimeout(
      supabase
        .from("leaderboard_session_rollups")
        .select("session_id")
        .in("session_id", chunk),
      2500,
      "刷題榜 session 快照比對逾時"
    )) as { data?: Array<{ session_id: string }>; error?: unknown };

    if (error) throw error;
    for (const row of data ?? []) ids.add(row.session_id);
  }

  return ids;
}

async function fetchAttemptCounts(supabase: any, userId: string, sessionIds: string[]) {
  const countMap = new Map<string, { total: number; correct: number }>();

  for (let index = 0; index < sessionIds.length; index += ATTEMPT_FALLBACK_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + ATTEMPT_FALLBACK_CHUNK_SIZE);
    const { data, error } = (await withServerTimeout(
      supabase
        .from("quiz_session_attempts")
        .select("session_id, is_correct")
        .eq("user_id", userId)
        .in("session_id", chunk),
      4000,
      "雲端作答明細讀取逾時"
    )) as { data?: AttemptFallbackRow[]; error?: unknown };

    if (error) throw error;

    for (const row of data ?? []) {
      const current = countMap.get(row.session_id) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (row.is_correct) current.correct += 1;
      countMap.set(row.session_id, current);
    }
  }

  return countMap;
}

async function upsertSessionRollups(
  supabase: any,
  userId: string,
  sessionRows: QuizSessionSummaryRow[]
) {
  if (sessionRows.length === 0) return 0;

  const rowsNeedingAttemptFallback = sessionRows.filter((row) => {
    const storedQuestionCount = getFiniteCount(row.question_count);
    const storedCorrectCount = getFiniteCount(row.correct_count);
    return !hasReasonableStoredSessionCount(storedQuestionCount, storedCorrectCount);
  });
  const attemptCounts = await fetchAttemptCounts(
    supabase,
    userId,
    rowsNeedingAttemptFallback.map((row) => row.id)
  );

  const rows = sessionRows
    .map((row) => {
      const storedQuestionCount = getFiniteCount(row.question_count);
      const storedCorrectCount = getFiniteCount(row.correct_count);
      const sessionCount = chooseBestSessionCount(
        attemptCounts.get(row.id),
        storedQuestionCount,
        storedCorrectCount
      );

      if (sessionCount.total <= 0) return null;

      return {
        session_id: row.id,
        user_id: userId,
        mode: row.mode ?? null,
        attempts: sessionCount.total,
        correct_attempts: sessionCount.correct,
        completed_at: row.completed_at ?? null,
        counted_at: new Date().toISOString()
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("leaderboard_session_rollups")
    .upsert(rows, { onConflict: "session_id" });

  if (error) throw error;
  return rows.length;
}

async function ensureSessionRollups(supabase: any, userId: string, fullRefresh: boolean) {
  const sessionRows = fullRefresh
    ? await fetchAllCompletedSessionRows(supabase, userId)
    : await fetchRecentCompletedSessionRows(supabase, userId);
  if (sessionRows.length === 0) return 0;

  const existingIds = await fetchExistingRollupIds(
    supabase,
    sessionRows.map((row) => row.id)
  );
  const missingRows = sessionRows.filter((row) => !existingIds.has(row.id));
  return upsertSessionRollups(supabase, userId, missingRows);
}

async function hasAnyRollup(supabase: any, userId: string) {
  const { data, error } = (await withServerTimeout(
    supabase
      .from("leaderboard_session_rollups")
      .select("session_id")
      .eq("user_id", userId)
      .limit(1),
    1600,
    "刷題榜快照檢查逾時"
  )) as { data?: Array<{ session_id: string }>; error?: unknown };

  if (error) throw error;
  return (data ?? []).length > 0;
}

async function summarizeRollups(supabase: any, userId: string) {
  const rows: LeaderboardRollupRow[] = [];

  for (let from = 0; ; from += FULL_SESSION_ROLLUP_PAGE_SIZE) {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("leaderboard_session_rollups")
        .select("attempts, correct_attempts")
        .eq("user_id", userId)
        .range(from, from + FULL_SESSION_ROLLUP_PAGE_SIZE - 1),
      2500,
      "刷題榜快照彙總逾時"
    )) as { data?: LeaderboardRollupRow[]; error?: unknown };

    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < FULL_SESSION_ROLLUP_PAGE_SIZE) break;
  }

  let totalAttempts = 0;
  let correctAttempts = 0;

  for (const row of rows) {
    const attempts = Number(row.attempts ?? 0);
    const correct = Number(row.correct_attempts ?? 0);
    totalAttempts += attempts;
    correctAttempts += Math.min(correct, attempts);
  }

  return {
    totalAttempts,
    correctAttempts,
    correctRate: totalAttempts > 0 ? Number(((correctAttempts / totalAttempts) * 100).toFixed(1)) : 0,
    totalSessions: rows.length
  };
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "recovery_mode" });
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法同步刷題榜。" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as LeaderboardSyncBody;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "請先登入後再同步刷題榜。" }, { status: 401 });
  }

  const { data: authData, error: authError } = (await withServerTimeout(
    supabase.auth.getUser(accessToken),
    2500,
    "登入狀態驗證逾時"
  )) as {
    data?: { user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null };
    error?: unknown;
  };

  const user = authData?.user;
  if (authError || !user?.id) {
    return NextResponse.json({ ok: false, message: "登入狀態已失效，請重新登入。" }, { status: 401 });
  }

  const displayName = getDisplayName({ id: user.id, email: user.email, user_metadata: user.user_metadata }, body.displayName);
  const existingProfile = await fetchProfile(supabase, user.id);

  if (!body.forceFullRefresh && isFreshProfile(existingProfile)) {
    if (existingProfile?.display_name !== displayName) {
      const { error: nameError } = await supabase.from("leaderboard_profiles").upsert(
        {
          user_id: user.id,
          display_name: displayName,
          total_attempts: existingProfile?.total_attempts ?? 0,
          correct_attempts: existingProfile?.correct_attempts ?? 0,
          correct_rate: existingProfile?.correct_rate ?? 0,
          total_sessions: existingProfile?.total_sessions ?? 0,
          updated_at: existingProfile?.updated_at ?? new Date().toISOString()
        },
        { onConflict: "user_id" }
      );
      if (nameError) throw nameError;
    }
    return NextResponse.json({ ok: true, leaderboard: mapProfileToSummary(existingProfile), cached: true });
  }

  const profileAlreadyHasRollups = Number(existingProfile?.total_sessions ?? 0) > 0;
  const shouldFullRefresh = body.forceFullRefresh || (!profileAlreadyHasRollups && !(await hasAnyRollup(supabase, user.id)));
  const addedRollupCount = await ensureSessionRollups(supabase, user.id, shouldFullRefresh);

  if (!body.forceFullRefresh && existingProfile && addedRollupCount === 0) {
    const refreshedAt = new Date().toISOString();
    const { error: refreshError } = await supabase.from("leaderboard_profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName,
        total_attempts: existingProfile.total_attempts ?? 0,
        correct_attempts: existingProfile.correct_attempts ?? 0,
        correct_rate: existingProfile.correct_rate ?? 0,
        total_sessions: existingProfile.total_sessions ?? 0,
        updated_at: refreshedAt
      },
      { onConflict: "user_id" }
    );

    if (refreshError) throw refreshError;

    return NextResponse.json({
      ok: true,
      leaderboard: mapProfileToSummary({ ...existingProfile, display_name: displayName, updated_at: refreshedAt }),
      cached: true
    });
  }

  const summary = await summarizeRollups(supabase, user.id);

  const { error } = await supabase.from("leaderboard_profiles").upsert(
    {
      user_id: user.id,
      display_name: displayName,
      total_attempts: summary.totalAttempts,
      correct_attempts: summary.correctAttempts,
      correct_rate: summary.correctRate,
      total_sessions: summary.totalSessions,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;

  return NextResponse.json({ ok: true, leaderboard: summary });
}
