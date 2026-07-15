import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import {
  isServerTimeoutError,
  withAbortableServerTimeout
} from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChangedAttemptRow = {
  question_id: string;
  answered_at: string;
  created_at: string;
};

const ROLLUP_SETTING_KEY = "stats_rollup_cursor";
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const CURSOR_OVERLAP_MS = 2 * 60 * 1000;
const ROLLUP_PAGE_SIZE = 1000;
const MAX_CHANGED_ATTEMPTS_PER_RUN = 500;
const ROLLUP_TIMEOUT_MS = 20_000;
const ROLLUP_LEASE_SECONDS = 180;

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function readRollupCursor(supabase: any, signal: AbortSignal) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("setting_key", ROLLUP_SETTING_KEY)
    .maybeSingle()
    .abortSignal(signal);

  if (error) throw error;
  const value = data?.value as { lastCreatedAt?: unknown } | null | undefined;
  return normalizeIsoTimestamp(value?.lastCreatedAt);
}

async function writeRollupCursor(supabase: any, lastCreatedAt: string, signal: AbortSignal) {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        setting_key: ROLLUP_SETTING_KEY,
        value: { lastCreatedAt },
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    )
    .abortSignal(signal);

  if (error) throw error;
}

async function fetchChangedAttemptRows(
  supabase: any,
  since: string,
  until: string,
  signal: AbortSignal
) {
  const rows: ChangedAttemptRow[] = [];

  for (let from = 0; rows.length < MAX_CHANGED_ATTEMPTS_PER_RUN; from += ROLLUP_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("question_attempt_logs")
      .select("question_id, answered_at, created_at")
      .gte("created_at", since)
      .lte("created_at", until)
      .order("created_at", { ascending: true })
      .range(from, from + ROLLUP_PAGE_SIZE - 1)
      .abortSignal(signal);

    if (error) throw error;

    const page = (data ?? []) as ChangedAttemptRow[];
    rows.push(...page);
    if (page.length < ROLLUP_PAGE_SIZE) break;
  }

  return rows.slice(0, MAX_CHANGED_ATTEMPTS_PER_RUN);
}

async function refreshQuestionAccuracyStats(
  supabase: any,
  questionIds: string[],
  signal: AbortSignal
) {
  const uniqueQuestionIds = Array.from(new Set(questionIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueQuestionIds.length === 0) return 0;

  const { data, error } = await supabase
    .rpc("refresh_question_accuracy_stats_for_questions", {
      p_question_ids: uniqueQuestionIds
    })
    .abortSignal(signal);

  if (error) throw error;
  return Number(data ?? 0);
}

async function countRows(supabaseQuery: Promise<{ count: number | null; error: unknown }>) {
  const { count, error } = await supabaseQuery;
  if (error) throw error;
  return count ?? 0;
}

async function refreshOwnerDailyStats(
  supabase: any,
  dayKeys: string[],
  signal: AbortSignal
) {
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
          .abortSignal(signal)
      ),
      countRows(
        supabase
          .from("question_attempt_logs")
          .select("*", { count: "exact", head: true })
          .gte("answered_at", range.start)
          .lt("answered_at", range.end)
          .eq("is_correct", true)
          .abortSignal(signal)
      ),
      countRows(
        supabase
          .from("question_attempt_device_daily")
          .select("*", { count: "exact", head: true })
          .eq("activity_date", dayKey)
          .abortSignal(signal)
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
    .upsert(rows, { onConflict: "activity_date" })
    .abortSignal(signal);

  if (error) throw error;
  return rows.length;
}

async function acquireRollupLease(supabase: any, owner: string, signal: AbortSignal) {
  const { data, error } = await supabase.rpc("try_acquire_stats_rollup_lease", {
    p_owner: owner,
    p_lease_seconds: ROLLUP_LEASE_SECONDS
  }).abortSignal(signal);
  if (error) throw error;
  return data === true;
}

async function releaseRollupLease(supabase: any, owner: string, signal: AbortSignal) {
  const { error } = await supabase.rpc("release_stats_rollup_lease", {
    p_owner: owner
  }).abortSignal(signal);
  if (error) throw error;
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

  const leaseOwner = randomUUID();
  let leaseAcquired = false;
  let timedOut = false;

  try {
    leaseAcquired = await withAbortableServerTimeout(
      (signal) => acquireRollupLease(supabase, leaseOwner, signal),
      5000,
      "統計彙總 lease 取得逾時"
    );
    if (!leaseAcquired) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "lease_busy" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await withAbortableServerTimeout(
      async (signal) => {
        const previousCursor = await readRollupCursor(supabase, signal);
        const until = new Date().toISOString();
        const since = new Date(
          previousCursor
            ? new Date(previousCursor).getTime() - CURSOR_OVERLAP_MS
            : Date.now() - INITIAL_LOOKBACK_MS
        ).toISOString();
        const changedRows = await fetchChangedAttemptRows(supabase, since, until, signal);
        const questionIds = changedRows.map((row) => row.question_id);
        const dayKeys = [
          getTaipeiDayKey(new Date()),
          ...changedRows.map((row) => getTaipeiDayKey(new Date(row.answered_at)))
        ];

        const [questionStatsUpdated, ownerDailyStatsUpdated] = await Promise.all([
          refreshQuestionAccuracyStats(supabase, questionIds, signal),
          refreshOwnerDailyStats(supabase, dayKeys, signal)
        ]);

        const nextCursor =
          changedRows.length >= MAX_CHANGED_ATTEMPTS_PER_RUN
            ? changedRows.at(-1)?.created_at ?? until
            : until;
        await writeRollupCursor(supabase, nextCursor, signal);

        return {
          previousCursor,
          nextCursor,
          changedAttempts: changedRows.length,
          questionStatsUpdated,
          ownerDailyStatsUpdated
        };
      },
      ROLLUP_TIMEOUT_MS,
      "統計背景彙總逾時"
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (isServerTimeoutError(error)) {
      timedOut = true;
      return NextResponse.json(
        { ok: false, deferred: true, message: error.message },
        { status: 202, headers: { "Cache-Control": "no-store" } }
      );
    }
    const message = getErrorMessage(error, "統計背景彙總失敗");
    console.error("統計背景彙總失敗：", error);
    return NextResponse.json(
      { ok: false, message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    if (leaseAcquired && !timedOut) {
      try {
        await withAbortableServerTimeout(
          (signal) => releaseRollupLease(supabase, leaseOwner, signal),
          3000,
          "統計彙總 lease 釋放逾時"
        );
      } catch (releaseError) {
        console.error("統計彙總 lease 釋放失敗：", releaseError);
      }
    }
  }
}
