import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AttemptRow = {
  session_id: string;
  question_id: string;
  answered_at: string;
  is_correct: boolean;
};

const SUPABASE_PAGE_SIZE = 1000;

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

function normalizeAttemptSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

function dedupeAttemptRows(rows: AttemptRow[]) {
  const deduped = new Map<string, AttemptRow>();

  for (const row of rows) {
    const normalizedSessionId = normalizeAttemptSessionId(row.session_id);
    const dedupeKey = `${normalizedSessionId}::${row.question_id}`;
    deduped.set(dedupeKey, {
      ...row,
      session_id: normalizedSessionId
    });
  }

  return Array.from(deduped.values());
}

async function fetchAllAttemptRows(supabase: any, startDate: string) {
  const rows: AttemptRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("question_attempt_logs")
      .select("session_id, question_id, answered_at, is_correct")
      .gte("answered_at", `${startDate}T00:00:00+08:00`)
      .order("answered_at", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as AttemptRow[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

export async function GET() {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法載入首頁社群統計。" },
      { status: 503 }
    );
  }

  try {
    const dayKeys = getRecentTaipeiDayKeys(2);
    const attemptRows = dedupeAttemptRows(await fetchAllAttemptRows(supabase, dayKeys[0]));
    const grouped = new Map<string, { attempts: number; correct: number }>();
    dayKeys.forEach((key) => grouped.set(key, { attempts: 0, correct: 0 }));

    for (const row of attemptRows) {
      const key = getTaipeiDayKey(new Date(row.answered_at));
      if (!dayKeys.includes(key)) continue;
      const current = grouped.get(key) ?? { attempts: 0, correct: 0 };
      current.attempts += 1;
      current.correct += row.is_correct ? 1 : 0;
      grouped.set(key, current);
    }

    return NextResponse.json({
      ok: true,
      points: dayKeys.map((date) => {
        const current = grouped.get(date) ?? { attempts: 0, correct: 0 };
        return {
          date,
          attempts: current.attempts,
          correctRate:
            current.attempts === 0 ? 0 : Number(((current.correct / current.attempts) * 100).toFixed(1))
        };
      })
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "首頁社群統計載入失敗"
      },
      { status: 500 }
    );
  }
}
