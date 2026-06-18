import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";
import type { LeaderboardEntry } from "@/types/quiz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEADERBOARD_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50;

  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: true, leaderboard: [] },
      { headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, leaderboard: [] },
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

    return NextResponse.json(
      { ok: true, leaderboard: (data ?? []).map((row) => mapLeaderboardRow(row as LeaderboardRow)) },
      { headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "刷題榜載入失敗";
    return NextResponse.json(
      { ok: true, degraded: true, message, leaderboard: [] },
      { headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL } }
    );
  }
}
