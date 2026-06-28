import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChangedAttemptRow = {
  question_id: string;
  answered_at: string;
  created_at: string;
};

type AttemptCorrectnessRow = {
  question_id: string;
  is_correct: boolean;
};

const ROLLUP_SETTING_KEY = "stats_rollup_cursor";
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const CURSOR_OVERLAP_MS = 2 * 60 * 1000;
const ROLLUP_PAGE_SIZE = 1000;
const MAX_CHANGED_ATTEMPTS_PER_RUN = 5000;
const QUESTION_ID_CHUNK_SIZE = 100;
const ROLLUP_TIMEOUT_MS = 9000;

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getTaipeiDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getDateRangeForTaipeiDay(dayKey: string) {
  const start = new Date(`${dayKey}T00:00:00+08:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function normalizeIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function readRollupCursor(supabase: any) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("setting_key", ROLLUP_SETTING_KEY)
    .maybeSingle();

  if (error) throw error;
  const value = data?.value as { lastCreatedAt?: unknown } | null | undefined;
  return normalizeIsoTimestamp(value?.lastCreatedAt);
}

async function writeRollupCursor(supabase: any, lastCreatedAt: string) {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        setting_key: ROLLUP_SETTING_KEY,
        value: { lastCreatedAt },
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    );

  if (error) throw error;
}

async function fetchChangedAttemptRows(supabase: any, since: string, until: string) {
  const rows: ChangedAttemptRow[] = [];

  for (let from = 0; rows.length < MAX_CHANGED_ATTEMPTS_PER_RUN; from += ROLLUP_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("question_attempt_logs")
      .select("question_id, answered_at, created_at")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true })
      .range(from, from + ROLLUP_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as ChangedAttemptRow[];
    rows.push(...page);
    if (page.length < ROLLUP_PAGE_SIZE) break;
  }

  return rows.slice(0, MAX_CHANGED_ATTEMPTS_PER_RUN);
}

async function refreshQuestionAccuracyStats(supabase: any, questionIds: string[]) {
  const uniqueQuestionIds = Array.from(new Set(questionIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueQuestionIds.length === 0) return 0;

  const grouped = new Map<string, { total: number; correct: number }>();
  for (const questionId of uniqueQuestionIds) {
    grouped.set(questionId, { total: 0, correct: 0 });
  }

  for (let index = 0; index < uniqueQuestionIds.length; index += QUESTION_ID_CHUNK_SIZE) {
    const chunk = uniqueQuestionIds.slice(index, index + QUESTION_ID_CHUNK_SIZE);

    for (let from = 0; ; from += ROLLUP_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("question_attempt_logs")
        .select("question_id, is_correct")
        .in("question_id", chunk)
        .range(from, from + ROLLUP_PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as AttemptCorrectnessRow[];
      for (const row of page) {
        const current = grouped.get(row.question_id) ?? { total: 0, correct: 0 };
        current.total += 1;
        if (row.is_correct) current.correct += 1;
        grouped.set(row.question_id, current);
      }

      if (page.length < ROLLUP_PAGE_SIZE) break;
    }
  }

  const now = new Date().toISOString();
  const rows = uniqueQuestionIds.map((questionId) => {
    const stats = grouped.get(questionId) ?? { total: 0, correct: 0 };
    return {
      question_id: questionId,
      total_attempts: stats.total,
      correct_attempts: stats.correct,
      correct_rate: stats.total === 0 ? 0 : Number(((stats.correct / stats.total) * 100).toFixed(1)),
      updated_at: now
    };
  });

  const { error } = await supabase
    .from("question_accuracy_stats")
    .upsert(rows, { onConflict: "question_id" });

  if (error) throw error;
  return rows.length;
}

async function countRows(supabaseQuery: Promise<{ count: number | null; error: unknown }>) {
  const { count, error } = await supabaseQuery;
  if (error) throw error;
  return count ?? 0;
}

async function refreshOwnerDailyStats(supabase: any, dayKeys: string[]) {
  const uniqueDayKeys = Array.from(new Set(dayKeys)).sort();
  if (uniqueDayKeys.length === 0) return 0;

  const rows = [];
  for (const dayKey of uniqueDayKeys) {
    const range = getDateRangeForTaipeiDay(dayKey);
    const [attempts, correctAttempts, devices] = await Promise.all([
      countRows(
        supabase
          .from("question_attempt_logs")
          .select("*", { count: "exact", head: true })
          .gte("answered_at", range.start)
          .lt("answered_at", range.end)
      ),
      countRows(
        supabase
          .from("question_attempt_logs")
          .select("*", { count: "exact", head: true })
          .gte("answered_at", range.start)
          .lt("answered_at", range.end)
          .eq("is_correct", true)
      ),
      countRows(
        supabase
          .from("question_attempt_device_daily")
          .select("*", { count: "exact", head: true })
          .eq("activity_date", dayKey)
      )
    ]);

    rows.push({
      activity_date: dayKey,
      attempts,
      correct_attempts: correctAttempts,
      devices,
      updated_at: new Date().toISOString()
    });
  }

  const { error } = await supabase
    .from("owner_daily_stats")
    .upsert(rows, { onConflict: "activity_date" });

  if (error) throw error;
  return rows.length;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET 尚未設定。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "recovery_mode" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法更新統計。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await withServerTimeout(
      (async () => {
        const previousCursor = await readRollupCursor(supabase);
        const until = new Date().toISOString();
        const since = new Date(
          previousCursor
            ? new Date(previousCursor).getTime() - CURSOR_OVERLAP_MS
            : Date.now() - INITIAL_LOOKBACK_MS
        ).toISOString();
        const changedRows = await fetchChangedAttemptRows(supabase, since, until);
        const questionIds = changedRows.map((row) => row.question_id);
        const dayKeys = changedRows.map((row) => getTaipeiDayKey(new Date(row.answered_at)));

        const [questionStatsUpdated, ownerDailyStatsUpdated] = await Promise.all([
          refreshQuestionAccuracyStats(supabase, questionIds),
          refreshOwnerDailyStats(supabase, dayKeys)
        ]);

        const nextCursor =
          changedRows.length >= MAX_CHANGED_ATTEMPTS_PER_RUN
            ? changedRows.at(-1)?.created_at ?? until
            : until;
        await writeRollupCursor(supabase, nextCursor);

        return {
          previousCursor,
          nextCursor,
          changedAttempts: changedRows.length,
          questionStatsUpdated,
          ownerDailyStatsUpdated
        };
      })(),
      ROLLUP_TIMEOUT_MS,
      "統計背景彙總逾時"
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "統計背景彙總失敗";
    return NextResponse.json(
      { ok: false, message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
