import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import type { LeaderboardEntry } from "@/types/quiz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEADERBOARD_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=900";
const DEGRADED_CACHE_CONTROL = "no-store";
const CURRENT_USER_RANK_LOOKUP_LIMIT = 5000;

const leaderboardCache = new Map<number, { leaderboard: LeaderboardEntry[]; updatedAt: string }>();

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  total_attempts: number;
  correct_attempts: number;
  correct_rate: number;
  total_sessions: number;
  updated_at?: string | null;
};

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

function isUuid(value: string | null) {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function mapLeaderboardRow(row: LeaderboardRow, rankPosition?: number): LeaderboardEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    totalAttempts: row.total_attempts,
    correctAttempts: row.correct_attempts,
    correctRate: Number(row.correct_rate ?? 0),
    totalSessions: row.total_sessions,
    rankPosition,
    updatedAt: row.updated_at ?? undefined
  };
}

async function fetchCurrentUserEntry(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  currentUserId: string | null
) {
  if (!supabase || !isUuid(currentUserId)) return null;

  const { data, error } = await withServerTimeout(
    supabase
      .from("leaderboard_profiles")
      .select("user_id, display_name, total_attempts, correct_attempts, correct_rate, total_sessions, updated_at")
      .order("total_attempts", { ascending: false })
      .order("correct_rate", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(CURRENT_USER_RANK_LOOKUP_LIMIT),
    1800,
    "你的刷題榜名次讀取逾時"
  );

  if (error) throw error;

  const rows = (data ?? []) as LeaderboardRow[];
  const index = rows.findIndex((row) => row.user_id === currentUserId);
  return index >= 0 ? mapLeaderboardRow(rows[index], index + 1) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
  const currentUserId = url.searchParams.get("currentUserId");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50;

  if (isSupabaseRecoveryMode()) {
    const cached = leaderboardCache.get(limit);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message: "刷題榜維護中",
        leaderboard: cached?.leaderboard ?? [],
        currentUserEntry: null,
        updatedAt: cached?.updatedAt
      },
      { headers: { "Cache-Control": DEGRADED_CACHE_CONTROL } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, leaderboard: [], currentUserEntry: null },
      { headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL } }
    );
  }

  try {
    const { data, error } = await withServerTimeout(
      supabase
        .from("leaderboard_profiles")
        .select("user_id, display_name, total_attempts, correct_attempts, correct_rate, total_sessions, updated_at")
        .order("total_attempts", { ascending: false })
        .order("correct_rate", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      1800,
      "刷題榜讀取逾時"
    );

    if (error) throw error;

    const leaderboard = (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow));
    const currentUserEntry = await fetchCurrentUserEntry(supabase, currentUserId);
    const updatedAt = new Date().toISOString();
    leaderboardCache.set(limit, { leaderboard, updatedAt });

    return NextResponse.json(
      { ok: true, leaderboard, currentUserEntry, updatedAt },
      { headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "刷題榜載入失敗";
    const cached = leaderboardCache.get(limit);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stale: Boolean(cached),
        message,
        leaderboard: cached?.leaderboard ?? [],
        currentUserEntry: null,
        updatedAt: cached?.updatedAt
      },
      { headers: { "Cache-Control": DEGRADED_CACHE_CONTROL } }
    );
  }
}
