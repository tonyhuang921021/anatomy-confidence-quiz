import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRecoveryTimestamp, isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONLINE_WINDOW_MS = 10 * 60 * 1000;
const ONLINE_VISITOR_LIMIT = 30;
const VISITOR_STATS_CACHE_CONTROL = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
const VISITOR_STATS_MEMORY_CACHE_MS = 45 * 1000;
const VISITOR_STATS_DETAIL_MEMORY_CACHE_MS = 60 * 1000;

type SiteVisitorRow = {
  visitor_id: string;
  user_id: string | null;
  display_name?: string | null;
  email?: string | null;
  last_seen_at: string;
};

type VisitorStatsPayload = {
  totalVisitors: number;
  onlineVisitors: number;
  updatedAt: string;
  online?: {
    visitorId: string;
    userId?: string;
    label: string;
    lastSeenAt: string;
  }[];
  degraded?: boolean;
  stale?: boolean;
};

type VisitorStatsQueryResult = {
  data: unknown;
  count: number | null;
  error: unknown;
};

let statsCache: { value: VisitorStatsPayload; cachedAt: number } | null = null;
let statsWithOnlineCache: { value: VisitorStatsPayload; cachedAt: number } | null = null;

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

function getCachedStats(includeOnline: boolean) {
  const cache = includeOnline ? statsWithOnlineCache : statsCache;
  const maxAge = includeOnline ? VISITOR_STATS_DETAIL_MEMORY_CACHE_MS : VISITOR_STATS_MEMORY_CACHE_MS;
  if (!cache || Date.now() - cache.cachedAt > maxAge) return null;
  return cache.value;
}

function setCachedStats(includeOnline: boolean, value: VisitorStatsPayload) {
  const entry = { value, cachedAt: Date.now() };
  if (includeOnline) {
    statsWithOnlineCache = entry;
    statsCache = {
      value: {
        totalVisitors: value.totalVisitors,
        onlineVisitors: value.onlineVisitors,
        updatedAt: value.updatedAt
      },
      cachedAt: entry.cachedAt
    };
    return;
  }
  statsCache = entry;
}

function getFallbackStats(includeOnline: boolean) {
  return (includeOnline ? statsWithOnlineCache : statsCache)?.value ?? statsWithOnlineCache?.value ?? statsCache?.value;
}

function getVisitorLabel(row: SiteVisitorRow) {
  const displayName = row.display_name?.trim();
  if (displayName) return displayName.slice(0, 24);
  const emailName = row.email?.split("@")[0]?.trim();
  if (emailName) return emailName.slice(0, 24);
  return "已登入同學";
}

function mapOnlineVisitors(rows: SiteVisitorRow[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    visitorId: row.visitor_id,
    userId: row.user_id ?? undefined,
    label: getVisitorLabel(row),
    lastSeenAt: row.last_seen_at
  }));
}

function fetchOnlineVisitorCount(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  onlineSince: string
): Promise<VisitorStatsQueryResult> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const client = supabase as any;
  return withServerTimeout(
    client
      .from("site_visitors")
      .select("visitor_id", { count: "exact", head: true })
      .not("user_id", "is", null)
      .gte("last_seen_at", onlineSince),
    1400,
    "訪客統計讀取逾時"
  );
}

function fetchOnlineVisitorList(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  onlineSince: string
): Promise<VisitorStatsQueryResult> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const client = supabase as any;
  return withServerTimeout(
    client
      .from("site_visitors")
      .select("visitor_id,user_id,display_name,email,last_seen_at", { count: "exact" })
      .not("user_id", "is", null)
      .gte("last_seen_at", onlineSince)
      .order("last_seen_at", { ascending: false })
      .limit(ONLINE_VISITOR_LIMIT),
    1400,
    "訪客統計讀取逾時"
  );
}

export async function GET(request: NextRequest) {
  const includeOnline = request.nextUrl.searchParams.get("includeOnline") === "1";
  const cached = getCachedStats(includeOnline);
  if (cached) {
    return NextResponse.json(
      { ok: true, stats: cached },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  }

  if (isSupabaseRecoveryMode()) {
    const fallback = getFallbackStats(includeOnline);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stats: fallback
          ? { ...fallback, degraded: true, stale: true }
          : { totalVisitors: 0, onlineVisitors: 0, updatedAt: getRecoveryTimestamp(), degraded: true }
      },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    const fallback = getFallbackStats(includeOnline);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        stats: fallback
          ? { ...fallback, degraded: true, stale: true }
          : { totalVisitors: 0, onlineVisitors: 0, updatedAt: new Date().toISOString(), degraded: true }
      },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  }

  try {
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const result = includeOnline
      ? await fetchOnlineVisitorList(supabase, onlineSince)
      : await fetchOnlineVisitorCount(supabase, onlineSince);

    if (result.error) throw result.error;

    const rows = includeOnline ? ((result.data ?? []) as SiteVisitorRow[]) : [];
    const stats: VisitorStatsPayload = {
      totalVisitors: 0,
      onlineVisitors: result.count ?? rows.length,
      updatedAt: new Date().toISOString(),
      ...(includeOnline ? { online: mapOnlineVisitors(rows) } : {})
    };
    setCachedStats(includeOnline, stats);

    return NextResponse.json(
      { ok: true, stats },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "visitor-stats-failed";
    const fallback = getFallbackStats(includeOnline);
    return NextResponse.json(
      {
        ok: true,
        degraded: true,
        message,
        stats: fallback
          ? { ...fallback, degraded: true, stale: true }
          : { totalVisitors: 0, onlineVisitors: 0, updatedAt: new Date().toISOString(), degraded: true }
      },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  }
}
