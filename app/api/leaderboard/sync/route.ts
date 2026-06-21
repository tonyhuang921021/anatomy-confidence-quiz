import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LeaderboardSyncBody = {
  accessToken?: string | null;
  displayName?: string | null;
};

type QuizSessionSummaryRow = {
  id: string;
  mode?: string | null;
  question_count?: number | null;
  correct_count?: number | null;
  session_payload?: {
    attempts?: Array<{ isCorrect?: boolean; is_correct?: boolean }>;
  } | null;
};

type AttemptFallbackRow = {
  session_id: string;
  is_correct: boolean;
};

const SESSION_PAGE_SIZE = 1000;
const ATTEMPT_FALLBACK_CHUNK_SIZE = 50;
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

async function fetchCompletedSessionRows(supabase: any, userId: string) {
  const rows: QuizSessionSummaryRow[] = [];

  for (let from = 0; ; from += SESSION_PAGE_SIZE) {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("quiz_sessions")
        .select("id, mode, question_count, correct_count, session_payload")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .range(from, from + SESSION_PAGE_SIZE - 1),
      4000,
      "雲端作答紀錄讀取逾時"
    )) as { data?: QuizSessionSummaryRow[]; error?: unknown };

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < SESSION_PAGE_SIZE) break;
  }

  return rows;
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

async function summarizeCloudSessions(supabase: any, userId: string) {
  const sessionRows = (await fetchCompletedSessionRows(supabase, userId)).filter(
    (row) => row.mode !== "peak_challenge"
  );
  const attemptCounts =
    sessionRows.length > 0
      ? await fetchAttemptCounts(
          supabase,
          userId,
          sessionRows.map((row) => row.id)
        )
      : new Map<string, { total: number; correct: number }>();

  let totalAttempts = 0;
  let correctAttempts = 0;

  for (const row of sessionRows) {
    const payloadAttempts = Array.isArray(row.session_payload?.attempts) ? row.session_payload.attempts : [];
    const attemptCount = attemptCounts.get(row.id);
    const storedQuestionCount = getFiniteCount(row.question_count);
    const storedCorrectCount = getFiniteCount(row.correct_count);
    const hasReasonableStoredQuestionCount =
      storedQuestionCount !== null &&
      storedQuestionCount > 0 &&
      storedQuestionCount <= Math.max(MAX_REASONABLE_SESSION_QUESTION_COUNT, attemptCount?.total ?? 0, payloadAttempts.length);
    const questionCount =
      attemptCount?.total || payloadAttempts.length || (hasReasonableStoredQuestionCount ? storedQuestionCount : 0);
    const payloadCorrectCount = payloadAttempts.filter(
      (attempt) => attempt.isCorrect === true || attempt.is_correct === true
    ).length;
    const correctCount =
      attemptCount?.correct ??
      (payloadAttempts.length > 0
        ? payloadCorrectCount
        : hasReasonableStoredQuestionCount
          ? storedCorrectCount ?? 0
          : 0);

    totalAttempts += questionCount;
    correctAttempts += Math.min(correctCount, questionCount);
  }

  return {
    totalAttempts,
    correctAttempts,
    correctRate: totalAttempts > 0 ? Number(((correctAttempts / totalAttempts) * 100).toFixed(1)) : 0,
    totalSessions: sessionRows.length
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

  const summary = await summarizeCloudSessions(supabase, user.id);
  const displayName = getDisplayName({ id: user.id, email: user.email, user_metadata: user.user_metadata }, body.displayName);

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
