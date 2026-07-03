import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COMMUNITY_STATS_CACHE_CONTROL = "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400";
const DEGRADED_CACHE_CONTROL = "no-store";

type CommunityPoint = {
  date: string;
  attempts: number;
  devices: number;
  correctRate: number;
};

const communityStatsCache = new Map<
  number,
  { points: CommunityPoint[]; updatedAt: string; activeUsers14d?: number | null }
>();

async function fetchActiveUserCount(supabase: ReturnType<typeof getServiceSupabaseClient>, activeSince: string) {
  if (!supabase) return null;
  const pageSize = 1000;
  const maxPages = 10;
  const userIds = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const result = await withServerTimeout(
      supabase
        .from("site_visitors")
        .select("user_id")
        .not("user_id", "is", null)
        .gte("last_seen_at", activeSince)
        .order("last_seen_at", { ascending: false })
        .range(from, to),
      1600,
      "近 14 天活躍用戶數讀取逾時"
    );

    if (result.error) throw result.error;
    const rows = (result.data ?? []) as { user_id?: string | null }[];
    rows.forEach((row) => {
      const userId = row.user_id?.trim();
      if (userId) userIds.add(userId);
    });
    if (rows.length < pageSize) break;
  }

  return userIds.size;
}

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get("days") ?? "2");
  const days = Number.isFinite(requestedDays)
    ? Math.min(14, Math.max(1, Math.trunc(requestedDays)))
    : 2;

  if (isSupabaseRecoveryMode()) {
    const cached = communityStatsCache.get(days);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message: "首頁社群統計維護中",
        points: cached?.points ?? [],
        activeUsers14d: cached?.activeUsers14d ?? null
      },
      {
        headers: {
          "Cache-Control": DEGRADED_CACHE_CONTROL
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
        .select("activity_date, attempts, correct_attempts, devices")
        .in("activity_date", dayKeys),
      1600,
      "首頁社群統計讀取逾時"
    );
    let data = initialResult.data as { activity_date: string; attempts: number; correct_attempts?: number | null; devices?: number | null }[] | null;
    let error = initialResult.error;

    if (error && isMissingCorrectAttemptsColumn(error)) {
      const fallbackResult = await withServerTimeout(
        supabase
          .from("owner_daily_stats")
          .select("activity_date, attempts, devices")
          .in("activity_date", dayKeys),
        1600,
        "首頁社群統計讀取逾時"
      );
      data = fallbackResult.data as { activity_date: string; attempts: number; correct_attempts?: number | null; devices?: number | null }[] | null;
      error = fallbackResult.error;
    }

    if (error) throw error;

    const grouped = new Map(
      ((data ?? []) as { activity_date: string; attempts: number; correct_attempts?: number | null; devices?: number | null }[]).map((row) => [
        row.activity_date,
        {
          attempts: Number(row.attempts ?? 0),
          correctAttempts: Number(row.correct_attempts ?? 0),
          devices: Number(row.devices ?? 0)
        }
      ] as const)
    );

    if (grouped.size === 0) {
      throw new Error("首頁社群統計快照尚未更新");
    }

    const activeSince = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let activeUsers14d: number | null = null;
    try {
      activeUsers14d = await fetchActiveUserCount(supabase, activeSince);
    } catch {
      activeUsers14d = null;
    }

    const points = dayKeys.map((date) => {
      const stats = grouped.get(date);
      const attempts = stats?.attempts ?? 0;
      const correctAttempts = stats?.correctAttempts ?? 0;
      return {
        date,
        attempts,
        devices: stats?.devices ?? 0,
        correctRate: attempts === 0 ? 0 : Number(((correctAttempts / attempts) * 100).toFixed(1))
      };
    });
    communityStatsCache.set(days, { points, updatedAt: new Date().toISOString(), activeUsers14d });

    return NextResponse.json(
      {
        ok: true,
        points,
        activeUsers14d,
        updatedAt: communityStatsCache.get(days)?.updatedAt
      },
      {
        headers: {
          "Cache-Control": COMMUNITY_STATS_CACHE_CONTROL
        }
      }
    );
  } catch (error) {
    const cached = communityStatsCache.get(days);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message: error instanceof Error ? error.message : "首頁社群統計載入失敗",
        points: cached?.points ?? [],
        activeUsers14d: cached?.activeUsers14d ?? null,
        updatedAt: cached?.updatedAt
      },
      {
        headers: {
          "Cache-Control": DEGRADED_CACHE_CONTROL
        }
      }
    );
  }
}
