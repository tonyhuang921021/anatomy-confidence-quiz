import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

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
  visitor_id?: string;
  activity_date: string;
};

type NormalizedAttemptRow = NonNullable<StatsSyncBody["attemptRows"]>[number];
type NormalizedDeviceDailyRow = NonNullable<StatsSyncBody["deviceDailyRows"]>[number];

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

function dedupeAttemptRows<
  T extends {
    session_id: string;
    question_id: string;
    answered_at?: string;
    is_correct?: boolean;
  }
>(rows: T[]) {
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

function getAttemptKey(row: Pick<NormalizedAttemptRow, "session_id" | "question_id">) {
  return `${normalizeAttemptSessionId(row.session_id)}::${row.question_id}`;
}

async function getNewAttemptRows(
  supabase: any,
  rows: NormalizedAttemptRow[]
) {
  if (rows.length === 0) return [] as NormalizedAttemptRow[];

  const sessionIds = Array.from(new Set(rows.map((row) => normalizeAttemptSessionId(row.session_id))));
  const existingKeys = new Set<string>();

  for (let index = 0; index < sessionIds.length; index += 50) {
    const chunk = sessionIds.slice(index, index + 50);
    const { data, error } = await supabase
      .from("question_attempt_logs")
      .select("session_id, question_id")
      .in("session_id", chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      existingKeys.add(getAttemptKey(row));
    }
  }

  return rows.filter((row) => !existingKeys.has(getAttemptKey(row)));
}

async function refreshQuestionAccuracyStatsFromAttempts(
  supabase: any,
  attemptRows: NormalizedAttemptRow[]
) {
  const uniqueQuestionIds = Array.from(
    new Set(attemptRows.map((row) => row.question_id.trim()).filter(Boolean))
  );
  if (uniqueQuestionIds.length === 0) return;

  const { data, error } = await supabase
    .from("question_accuracy_stats")
    .select("question_id, total_attempts, correct_attempts")
    .in("question_id", uniqueQuestionIds);

  if (error) throw error;

  const currentStats = new Map(
    ((data ?? []) as { question_id: string; total_attempts: number; correct_attempts: number }[]).map((row) => [
      row.question_id,
      {
        total: Number(row.total_attempts ?? 0),
        correct: Number(row.correct_attempts ?? 0)
      }
    ] as const)
  );

  const grouped = new Map<string, { total: number; correct: number }>();
  for (const questionId of uniqueQuestionIds) {
    grouped.set(questionId, { total: 0, correct: 0 });
  }

  for (const row of attemptRows) {
    const current = grouped.get(row.question_id) ?? { total: 0, correct: 0 };
    current.total += 1;
    if (row.is_correct) current.correct += 1;
    grouped.set(row.question_id, current);
  }

  const now = new Date().toISOString();
  const rows = uniqueQuestionIds.map((questionId) => {
    const current = currentStats.get(questionId) ?? { total: 0, correct: 0 };
    const increment = grouped.get(questionId) ?? { total: 0, correct: 0 };
    const stats = {
      total: current.total + increment.total,
      correct: current.correct + increment.correct
    };
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
  if (normalizedRows.length === 0) return [] as NormalizedAttemptRow[];

  const newRows = await getNewAttemptRows(supabase, normalizedRows);
  if (newRows.length === 0) return [] as NormalizedAttemptRow[];

  const { error } = await supabase
    .from("question_attempt_logs")
    .upsert(newRows as any, { onConflict: "session_id,question_id", ignoreDuplicates: true });

  if (!error) return newRows;

  const fallbackRows = newRows.map(({ visitor_id, ...rest }) => rest);
  const { error: fallbackError } = await supabase
    .from("question_attempt_logs")
    .upsert(fallbackRows as any, { onConflict: "session_id,question_id", ignoreDuplicates: true });

  if (fallbackError) throw fallbackError;
  return newRows;
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
  if (rows.length === 0) return [] as NormalizedDeviceDailyRow[];

  const normalizedRows = rows.filter((row) => row.visitor_id?.trim() && row.activity_date?.trim());
  if (normalizedRows.length === 0) return [] as NormalizedDeviceDailyRow[];

  const visitorIds = Array.from(new Set(normalizedRows.map((row) => row.visitor_id)));
  const existingKeys = new Set<string>();

  for (let index = 0; index < visitorIds.length; index += 50) {
    const chunk = visitorIds.slice(index, index + 50);
    const { data, error } = await supabase
      .from("question_attempt_device_daily")
      .select("visitor_id, activity_date")
      .in("visitor_id", chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      existingKeys.add(`${row.visitor_id}::${row.activity_date}`);
    }
  }

  const newRows = normalizedRows.filter(
    (row) => !existingKeys.has(`${row.visitor_id}::${row.activity_date}`)
  );

  const { error } = await supabase
    .from("question_attempt_device_daily")
    .upsert(normalizedRows as any, { onConflict: "visitor_id,activity_date" });

  if (error) throw error;
  return newRows;
}

async function refreshOwnerDailyStatsFromAttempts(
  supabase: any,
  attemptRows: NormalizedAttemptRow[],
  deviceDailyRows: NormalizedDeviceDailyRow[]
) {
  const uniqueDates = Array.from(
    new Set([
      ...attemptRows.map((row) => getTaipeiDayKey(new Date(row.answered_at))),
      ...deviceDailyRows.map((row) => row.activity_date)
    ])
  ).sort();
  if (uniqueDates.length === 0) return;

  const { data, error } = await supabase
    .from("owner_daily_stats")
    .select("activity_date, attempts, devices")
    .in("activity_date", uniqueDates);

  if (error) throw error;

  const currentStats = new Map(
    ((data ?? []) as { activity_date: string; attempts: number; devices: number }[]).map((row) => [
      row.activity_date,
      {
        attempts: Number(row.attempts ?? 0),
        devices: Number(row.devices ?? 0)
      }
    ] as const)
  );
  const attemptMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  for (const row of attemptRows) {
    const dayKey = getTaipeiDayKey(new Date(row.answered_at));
    attemptMap.set(dayKey, (attemptMap.get(dayKey) ?? 0) + 1);
  }

  for (const row of deviceDailyRows) {
    deviceMap.set(row.activity_date, (deviceMap.get(row.activity_date) ?? 0) + 1);
  }

  const rows = uniqueDates.map((activityDate) => ({
    activity_date: activityDate,
    attempts: (currentStats.get(activityDate)?.attempts ?? 0) + (attemptMap.get(activityDate) ?? 0),
    devices: (currentStats.get(activityDate)?.devices ?? 0) + (deviceMap.get(activityDate) ?? 0),
    updated_at: new Date().toISOString()
  }));

  const { error: upsertError } = await supabase
    .from("owner_daily_stats")
    .upsert(rows as any, { onConflict: "activity_date" });

  if (upsertError) throw upsertError;
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: true, deferred: true });
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，無法更新統計。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as StatsSyncBody;
    const newAttemptRows = await upsertAttemptRows(supabase, body.attemptRows ?? []);

    const [, newDeviceDailyRows] = await Promise.all([
      body.deviceRow ? upsertAttemptDevice(supabase, body.deviceRow) : Promise.resolve(),
      upsertAttemptDeviceDaily(supabase, body.deviceDailyRows ?? [])
    ]);

    await Promise.all([
      refreshQuestionAccuracyStatsFromAttempts(supabase, newAttemptRows),
      refreshOwnerDailyStatsFromAttempts(supabase, newAttemptRows, newDeviceDailyRows)
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "統計同步失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
