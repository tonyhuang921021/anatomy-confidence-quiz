import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
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
    const { data, error } = await supabase
      .from("owner_daily_stats")
      .select("activity_date, attempts")
      .in("activity_date", dayKeys);

    if (error) throw error;

    const grouped = new Map(
      ((data ?? []) as { activity_date: string; attempts: number }[]).map((row) => [
        row.activity_date,
        Number(row.attempts ?? 0)
      ] as const)
    );

    return NextResponse.json(
      {
        ok: true,
        points: dayKeys.map((date) => {
          return {
            date,
            attempts: grouped.get(date) ?? 0,
            correctRate: 0
          };
        })
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "首頁社群統計載入失敗"
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
        }
      }
    );
  }
}
