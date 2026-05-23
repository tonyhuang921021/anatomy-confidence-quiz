import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type StatsSyncBody = {
  questionIds?: string[];
  activityDates?: string[];
  attemptRows?: {
    session_id: string;
    question_id: string;
    visitor_id?: string | null;
    is_correct: boolean;
    answered_at: string;
    source_mode?: string | null;
  }[];
  deviceRow?: {
    visitor_id: string;
    first_attempt_at: string;
    last_attempt_at: string;
  } | null;
  deviceDailyRows?: {
    visitor_id: string;
    activity_date: string;
    first_attempt_at: string;
    last_attempt_at: string;
  }[];
};

type QuestionAttemptLogRow = {
  session_id: string;
  question_id: string;
  is_correct: boolean;
  answered_at: string;
};

type QuestionAttemptDeviceDailyRow = {
  activity_date: string;
};

function getTaipeiDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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

function normalizeAttemptSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

function dedupeAttemptRows<T extends { session_id: string; question_id: string }>(rows: T[]) {
  const deduped = new Map<string, T>();

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

async function refreshQuestionAccuracyStats(
  supabase: any,
  questionIds: string[]
) {
  const uniqueQuestionIds = Array.from(new Set(questionIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueQuestionIds.length === 0) return;

  const { data, error } = await supabase
    .from("question_attempt_logs")
    .select("session_id, question_id, is_correct, answered_at")
    .in("question_id", uniqueQuestionIds);

  if (error) throw error;

  const grouped = new Map<string, { total: number; correct: number }>();
  for (const questionId of uniqueQuestionIds) {
    grouped.set(questionId, { total: 0, correct: 0 });
  }

  const dedupedRows = dedupeAttemptRows((data ?? []) as QuestionAttemptLogRow[]);

  for (const row of dedupedRows) {
    const current = grouped.get(row.question_id) ?? { total: 0, correct: 0 };
    current.total += 1;
    if (row.is_correct) current.correct += 1;
    grouped.set(row.question_id, current);
  }

  const now = new Date().toISOString();
  const rows = uniqueQuestionIds.map((questionId) => {
    const stats = grouped.get(questionId) ?? { total: 0, correct: 0 };
    return {
      question_id: questionId,
      total_attempts: stats.total,
      correct_attempts: stats.correct,
      correct_rate: stats.total === 0 ? 0 : Number(((stats.correct / stats.total) * 100).toFixed(1)),
      updated_at: now
    };
  });

  const { error: upsertError } = await supabase
    .from("question_accuracy_stats")
    .upsert(rows as any, { onConflict: "question_id" });

  if (upsertError) throw upsertError;
}

async function upsertAttemptRows(
  supabase: any,
  rows: NonNullable<StatsSyncBody["attemptRows"]>
) {
  const normalizedRows = dedupeAttemptRows(rows);
  if (normalizedRows.length === 0) return;

  const { error } = await supabase
    .from("question_attempt_logs")
    .upsert(normalizedRows as any, { onConflict: "session_id,question_id" });

  if (!error) return;

  const fallbackRows = normalizedRows.map(({ visitor_id, ...rest }) => rest);
  const { error: fallbackError } = await supabase
    .from("question_attempt_logs")
    .upsert(fallbackRows as any, { onConflict: "session_id,question_id" });

  if (fallbackError) throw fallbackError;
}

async function upsertAttemptDevice(
  supabase: any,
  row: NonNullable<StatsSyncBody["deviceRow"]>
) {
  const { error } = await supabase
    .from("question_attempt_devices")
    .upsert(row as any, { onConflict: "visitor_id" });

  if (error) throw error;
}

async function upsertAttemptDeviceDaily(
  supabase: any,
  rows: NonNullable<StatsSyncBody["deviceDailyRows"]>
) {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("question_attempt_device_daily")
    .upsert(rows as any, { onConflict: "visitor_id,activity_date" });

  if (error) throw error;
}

async function refreshOwnerDailyStats(
  supabase: any,
  activityDates: string[]
) {
  const uniqueDates = Array.from(new Set(activityDates.map((date) => date.trim()).filter(Boolean))).sort();
  if (uniqueDates.length === 0) return;

  const startDate = uniqueDates[0];
  const endDate = uniqueDates[uniqueDates.length - 1];
  const endDateExclusive = new Date(`${endDate}T00:00:00+08:00`);
  endDateExclusive.setDate(endDateExclusive.getDate() + 1);

  const [{ data: attemptRows, error: attemptError }, { data: deviceRows, error: deviceError }] =
    await Promise.all([
      supabase
        .from("question_attempt_logs")
        .select("session_id, question_id, answered_at")
        .gte("answered_at", `${startDate}T00:00:00+08:00`)
        .lt("answered_at", endDateExclusive.toISOString()),
      supabase
        .from("question_attempt_device_daily")
        .select("activity_date")
        .in("activity_date", uniqueDates)
    ]);

  if (attemptError) throw attemptError;
  if (deviceError) throw deviceError;

  const attemptMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  const dedupedAttemptRows = dedupeAttemptRows((attemptRows ?? []) as QuestionAttemptLogRow[]);

  for (const row of dedupedAttemptRows) {
    const dayKey = getTaipeiDayKey(new Date(row.answered_at));
    if (!uniqueDates.includes(dayKey)) continue;
    attemptMap.set(dayKey, (attemptMap.get(dayKey) ?? 0) + 1);
  }

  for (const row of (deviceRows ?? []) as QuestionAttemptDeviceDailyRow[]) {
    deviceMap.set(row.activity_date, (deviceMap.get(row.activity_date) ?? 0) + 1);
  }

  const rows = uniqueDates.map((activityDate) => ({
    activity_date: activityDate,
    attempts: attemptMap.get(activityDate) ?? 0,
    devices: deviceMap.get(activityDate) ?? 0,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from("owner_daily_stats")
    .upsert(rows as any, { onConflict: "activity_date" });

  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法更新統計。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as StatsSyncBody;
    await Promise.all([
      upsertAttemptRows(supabase, body.attemptRows ?? []),
      body.deviceRow ? upsertAttemptDevice(supabase, body.deviceRow) : Promise.resolve(),
      upsertAttemptDeviceDaily(supabase, body.deviceDailyRows ?? [])
    ]);
    await Promise.all([
      refreshQuestionAccuracyStats(supabase, body.questionIds ?? []),
      refreshOwnerDailyStats(supabase, body.activityDates ?? [])
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "統計同步失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
