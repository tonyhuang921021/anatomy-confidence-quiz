import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMMUNITY_STATS_CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=1800";

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

function getTaipeiDayRange(dayKey: string) {
  const start = new Date(`${dayKey}T00:00:00+08:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function isMissingCorrectAttemptsColumn(error: unknown) {
  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const haystack = [
    maybeError?.code,
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("correct_attempts") ||
    haystack.includes("pgrst204") ||
    haystack.includes("42703")
  );
}

async function countAttemptsForDay(supabase: ReturnType<typeof getServiceSupabaseClient>, dayKey: string) {
  if (!supabase) {
    return { attempts: 0, correctRate: 0 };
  }

  const { startIso, endIso } = getTaipeiDayRange(dayKey);
  const [attemptResult, correctResult] = await withServerTimeout(
    Promise.all([
      supabase
        .from("question_attempt_logs")
        .select("session_id", { count: "exact", head: true })
        .gte("answered_at", startIso)
        .lt("answered_at", endIso),
      supabase
        .from("question_attempt_logs")
        .select("session_id", { count: "exact", head: true })
        .eq("is_correct", true)
        .gte("answered_at", startIso)
        .lt("answered_at", endIso)
    ]),
    1600,
    "首頁社群統計補查逾時"
  );

  if (attemptResult.error) throw attemptResult.error;
  if (correctResult.error) throw correctResult.error;

  const attempts = attemptResult.count ?? 0;
  const correct = correctResult.count ?? 0;

  return {
    attempts,
    correctRate: attempts === 0 ? 0 : Number(((correct / attempts) * 100).toFixed(1))
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") ?? "2");
  const days = Number.isFinite(requestedDays)
    ? Math.min(7, Math.max(1, Math.trunc(requestedDays)))
    : 2;

  if (isSupabaseRecoveryMode()) {
    const dayKeys = getRecentTaipeiDayKeys(days);
    return NextResponse.json(
      {
        ok: true,
        points: dayKeys.map((date) => ({
          date,
          attempts: 0,
          correctRate: 0
        }))
      },
      {
        headers: {
          "Cache-Control": COMMUNITY_STATS_CACHE_CONTROL
        }
      }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法載入首頁社群統計。" },
      { status: 503 }
    );
  }

  try {
    const dayKeys = getRecentTaipeiDayKeys(days);
    const initialResult = await withServerTimeout(
      supabase
        .from("owner_daily_stats")
        .select("activity_date, attempts, correct_attempts")
        .in("activity_date", dayKeys),
      1600,
      "首頁社群統計讀取逾時"
    );
    let data = initialResult.data as { activity_date: string; attempts: number; correct_attempts?: number | null }[] | null;
    let error = initialResult.error;

    if (error && isMissingCorrectAttemptsColumn(error)) {
      const fallbackResult = await withServerTimeout(
        supabase
          .from("owner_daily_stats")
          .select("activity_date, attempts")
          .in("activity_date", dayKeys),
        1600,
        "首頁社群統計讀取逾時"
      );
      data = fallbackResult.data as { activity_date: string; attempts: number; correct_attempts?: number | null }[] | null;
      error = fallbackResult.error;
    }

    if (error) throw error;

    const grouped = new Map(
      ((data ?? []) as { activity_date: string; attempts: number; correct_attempts?: number | null }[]).map((row) => [
        row.activity_date,
        {
          attempts: Number(row.attempts ?? 0),
          correctAttempts: Number(row.correct_attempts ?? 0)
        }
      ] as const)
    );

    const fallbackDayKeys = dayKeys.filter((date) => {
      const stats = grouped.get(date);
      return !stats || stats.attempts === 0;
    });
    const fallbackCounts = new Map<string, { attempts: number; correctRate: number }>();

    if (fallbackDayKeys.length > 0) {
      const fallbackResults = await withServerTimeout(
        Promise.all(
          fallbackDayKeys
            .slice(-2)
            .map(async (date) => [date, await countAttemptsForDay(supabase, date)] as const)
        ),
        2200,
        "首頁社群統計補查逾時"
      );

      for (const [date, stats] of fallbackResults) {
        fallbackCounts.set(date, stats);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        points: dayKeys.map((date) => {
          const fallbackStats = fallbackCounts.get(date);
          if (fallbackStats) {
            return {
              date,
              attempts: fallbackStats.attempts,
              correctRate: fallbackStats.correctRate
            };
          }
          const stats = grouped.get(date);
          const attempts = stats?.attempts ?? 0;
          const correctAttempts = stats?.correctAttempts ?? 0;
          return {
            date,
            attempts,
            correctRate: attempts === 0 ? 0 : Number(((correctAttempts / attempts) * 100).toFixed(1))
          };
        })
      },
      {
        headers: {
          "Cache-Control": COMMUNITY_STATS_CACHE_CONTROL
        }
      }
    );
  } catch (error) {
    const dayKeys = getRecentTaipeiDayKeys(days);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        message: error instanceof Error ? error.message : "首頁社群統計載入失敗",
        points: dayKeys.map((date) => ({
          date,
          attempts: 0,
          correctRate: 0
        }))
      },
      {
        headers: {
          "Cache-Control": COMMUNITY_STATS_CACHE_CONTROL
        }
      }
    );
  }
}
