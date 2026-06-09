import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const VISITOR_STATS_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

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

export async function GET() {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: true, stats: { totalVisitors: 0, onlineVisitors: 0, updatedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  }

  try {
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const [{ count: totalVisitors, error: totalError }, { count: onlineVisitors, error: onlineError }] =
      await Promise.all([
        supabase.from("site_visitors").select("*", { count: "exact", head: true }),
        supabase
          .from("site_visitors")
          .select("*", { count: "exact", head: true })
          .gte("last_seen_at", onlineSince)
      ]);

    if (totalError) throw totalError;
    if (onlineError) throw onlineError;

    return NextResponse.json(
      {
        ok: true,
        stats: {
          totalVisitors: totalVisitors ?? 0,
          onlineVisitors: onlineVisitors ?? 0,
          updatedAt: new Date().toISOString()
        }
      },
      { headers: { "Cache-Control": VISITOR_STATS_CACHE_CONTROL } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "visitor-stats-failed";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
