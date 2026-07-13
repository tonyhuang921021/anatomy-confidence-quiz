import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withServerTimeout } from "@/lib/serverTimeout";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type AccuracyRow = {
  question_id: string;
  total_attempts: number;
  correct_rate: number;
};

type ReactionRow = {
  question_id: string;
};

type RankingTuple = [string, number, number, number];

const PAGE_SIZE = 1000;
const MAX_ROWS = 10000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=900, stale-while-revalidate=3600";
const SERVER_CACHE_TTL_MS = 15 * 60 * 1000;

let serverCache: { expiresAt: number; rankings: RankingTuple[] } | null = null;
let serverRequestInFlight: Promise<RankingTuple[]> | null = null;

export const dynamic = "force-dynamic";

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function loadAccuracyRows(supabase: any) {
  const rows: AccuracyRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("question_accuracy_stats")
        .select("question_id, total_attempts, correct_rate")
        .gt("total_attempts", 0)
        .order("question_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1),
      1800,
      "題目答對率排名載入逾時"
    )) as { data?: AccuracyRow[]; error?: unknown };
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadChaosRows(supabase: any) {
  const rows: ReactionRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("question_supplement_reactions")
        .select("question_id")
        .eq("reaction_type", "pure_chaos")
        .order("question_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1),
      1800,
      "題目快速標記排名載入逾時"
    )) as { data?: ReactionRow[]; error?: unknown };
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function buildRankings(supabase: any): Promise<RankingTuple[]> {
  const accuracyRows = await loadAccuracyRows(supabase);
  const chaosRows = await loadChaosRows(supabase);
  const rankingMap = new Map<string, {
    questionId: string;
    totalAttempts: number;
    correctRate: number;
    chaosCount: number;
  }>(
    accuracyRows.map((row) => [
      row.question_id,
      {
        questionId: row.question_id,
        totalAttempts: Math.max(0, Number(row.total_attempts ?? 0)),
        correctRate: Math.max(0, Math.min(100, Number(row.correct_rate ?? 0))),
        chaosCount: 0
      }
    ])
  );

  for (const row of chaosRows) {
    const current = rankingMap.get(row.question_id) ?? {
      questionId: row.question_id,
      totalAttempts: 0,
      correctRate: 0,
      chaosCount: 0
    };
    current.chaosCount += 1;
    rankingMap.set(row.question_id, current);
  }

  return Array.from(rankingMap.values()).map((ranking) => [
    ranking.questionId,
    ranking.totalAttempts,
    ranking.correctRate,
    ranking.chaosCount
  ]);
}

async function loadRankingsWithServerGuard(supabase: any) {
  if (serverCache && serverCache.expiresAt > Date.now()) return serverCache.rankings;
  if (serverRequestInFlight) return serverRequestInFlight;

  serverRequestInFlight = buildRankings(supabase);
  try {
    const rankings = await serverRequestInFlight;
    serverCache = {
      expiresAt: Date.now() + SERVER_CACHE_TTL_MS,
      rankings
    };
    return rankings;
  } finally {
    serverRequestInFlight = null;
  }
}

export async function GET() {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: true, rankings: [], recovery: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, rankings: [], degraded: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const rankings = await loadRankingsWithServerGuard(supabase);

    return NextResponse.json(
      { ok: true, rankings },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: true,
        rankings: [],
        degraded: true,
        message: error instanceof Error ? error.message : "搜尋排名載入失敗"
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
