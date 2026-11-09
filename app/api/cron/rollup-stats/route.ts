import {discoverPmcFigures} from '@/lib/pmcFigureSource.cjs';
import {resolveTrustedExplanationQuestion} from "@/lib/trustedQuestionLoader";
import {createFinalFigureReviewer} from "@/lib/finalFigureRuntime.cjs";
import { planRollup, fetchRollupPage, boundRollupDays, nextRollupCursor, type RollupCursor } from "@/lib/statsRollupBatch";
import {scheduleNewImageContinuation} from "@/lib/newExplanationImageContinuation.cjs";
import {commonsSearch,readBoundedImage} from "@/lib/commonsFigureSource.cjs";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { scheduleFigureWorker } from "@/lib/figureQueueRuntime.cjs";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import {
  isServerTimeoutError,
  withAbortableServerTimeout
} from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLLUP_SETTING_KEY = "stats_rollup_cursor";
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
  return data?.value ?? null;
}

async function writeRollupCursor(supabase: any, value: RollupCursor, signal: AbortSignal) {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        setting_key: ROLLUP_SETTING_KEY,
        value,
        updated_at: new Date().toISOString()
      },
      { onConflict: "setting_key" }
    )
    .abortSignal(signal);

  if (error) throw error;
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

  // Existing cron authorization and recovery checks ran above. A disabled
  // figure worker adds no calls; errors cannot alter the rollup response.
  scheduleFigureWorker({env:process.env,db:supabase,waitUntil,report:message=>console.error(message)});
  scheduleNewImageContinuation({discover:discoverPmcFigures,env:process.env,db:supabase,finalReview:createFinalFigureReviewer({db:supabase,readQuestion:(id:string)=>{const result=resolveTrustedExplanationQuestion(id);return result.ok?result.question:null}}),waitUntil,search:commonsSearch,loadImage:readBoundedImage,report:(message:string)=>console.error(message)});

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
        // Repair historical mutations independently of the created_at cursor.
        if(process.env.QUIZ_STATS_REPAIR_ENABLED === "true"){
          const {error}=await supabase.rpc("drain_quiz_stats_dirty",{p_limit:25}).abortSignal(signal);
          if(error)throw error;
        }
        const previousValue = await readRollupCursor(supabase, signal);
        const plan = planRollup(previousValue, new Date().toISOString());
        const page = await fetchRollupPage(supabase, plan, signal);
        const batch = boundRollupDays(page, getTaipeiDayKey(new Date()), value => getTaipeiDayKey(new Date(value)));
        const changedRows = batch.rows;
        const questionIds = changedRows.map((row) => row.question_id);
        const dayKeys = [
          getTaipeiDayKey(new Date()),
          ...changedRows.map((row) => getTaipeiDayKey(new Date(row.answered_at)))
        ];

        const updates = await Promise.allSettled([
          refreshQuestionAccuracyStats(supabase, questionIds, signal),
          refreshOwnerDailyStats(supabase, dayKeys, signal)
        ]);
        // Do not release the lease while the other refresh is still running
        // after one branch fails. Partial writes are safe to recompute.
        if (updates[0].status === "rejected") throw updates[0].reason;
        if (updates[1].status === "rejected") throw updates[1].reason;
        const questionStatsUpdated = updates[0].value;
        const ownerDailyStatsUpdated = updates[1].value;

        // Cursor is committed only after both idempotent absolute refreshes.
        // Failed or uncertain refreshes replay the batch; they never skip it.
        const cursor = nextRollupCursor(plan, changedRows, batch.hasMore);
        await writeRollupCursor(supabase, cursor, signal);

        return {
          previousCursor: plan.previousCursor,
          nextCursor: cursor.lastCreatedAt,
          scanComplete: !cursor.scan,
          fetchedAttempts: page.length,
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
