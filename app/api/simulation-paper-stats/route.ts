import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isSafeSimulationPaperKey,
  type SimulationPaperStats
} from "@/lib/simulationPaperStats";
import { withServerTimeout } from "@/lib/serverTimeout";

type SimulationPaperStatsRow = {
  sample_count?: number | string | null;
  average_score?: number | string | null;
  score_0_39?: number | string | null;
  score_40_59?: number | string | null;
  score_60_69?: number | string | null;
  score_70_79?: number | string | null;
  score_80_89?: number | string | null;
  score_90_100?: number | string | null;
};

type CachedStats = {
  expiresAt: number;
  value: SimulationPaperStats;
};

const MINIMUM_SAMPLE_SIZE = 5;
const SERVER_TIMEOUT_MS = 1500;
const MEMORY_CACHE_MS = 15 * 60 * 1000;
const statsCache = new Map<string, CachedStats>();

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400"
};

function toCount(value: number | string | null | undefined) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
}

function buildUnavailableStats(
  paperKey: string,
  unavailableReason: string
): SimulationPaperStats {
  return {
    paperKey,
    sampleCount: 0,
    averageScore: null,
    available: false,
    minimumSampleSize: MINIMUM_SAMPLE_SIZE,
    unavailableReason,
    buckets: {
      score0To39: 0,
      score40To59: 0,
      score60To69: 0,
      score70To79: 0,
      score80To89: 0,
      score90To100: 0
    }
  };
}

function mapStatsRow(paperKey: string, row?: SimulationPaperStatsRow | null) {
  const sampleCount = toCount(row?.sample_count);
  const averageScoreValue = Number(row?.average_score);
  const averageScore = Number.isFinite(averageScoreValue)
    ? Math.round(averageScoreValue * 10) / 10
    : null;

  return {
    paperKey,
    sampleCount,
    averageScore,
    available: sampleCount >= MINIMUM_SAMPLE_SIZE,
    minimumSampleSize: MINIMUM_SAMPLE_SIZE,
    buckets: {
      score0To39: toCount(row?.score_0_39),
      score40To59: toCount(row?.score_40_59),
      score60To69: toCount(row?.score_60_69),
      score70To79: toCount(row?.score_70_79),
      score80To89: toCount(row?.score_80_89),
      score90To100: toCount(row?.score_90_100)
    }
  } satisfies SimulationPaperStats;
}

export async function GET(request: NextRequest) {
  const paperKey = request.nextUrl.searchParams.get("paperKey")?.trim() ?? "";
  if (!paperKey || !isSafeSimulationPaperKey(paperKey)) {
    return NextResponse.json(
      { ok: false, message: "缺少有效的模擬卷編號。" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const cached = statsCache.get(paperKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, { headers: CACHE_HEADERS });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      buildUnavailableStats(paperKey, "級距暫時無法讀取，不影響開始作答。"),
      { headers: CACHE_HEADERS }
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const { data, error } = await withServerTimeout(
      supabase.rpc("get_simulation_paper_score_stats", {
        p_paper_key: paperKey
      }),
      SERVER_TIMEOUT_MS,
      "模擬卷統計讀取逾時"
    );
    if (error) throw error;

    const row = Array.isArray(data)
      ? (data[0] as SimulationPaperStatsRow | undefined)
      : (data as SimulationPaperStatsRow | null);
    const value = mapStatsRow(paperKey, row);
    statsCache.set(paperKey, {
      expiresAt: Date.now() + MEMORY_CACHE_MS,
      value
    });

    return NextResponse.json(value, { headers: CACHE_HEADERS });
  } catch (error) {
    console.warn("[simulation-paper-stats] read failed", error);
    if (cached) {
      return NextResponse.json(cached.value, { headers: CACHE_HEADERS });
    }

    return NextResponse.json(
      buildUnavailableStats(paperKey, "級距暫時無法讀取，不影響開始作答。"),
      { headers: CACHE_HEADERS }
    );
  }
}
