import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { isServerTimeoutError, withServerTimeout } from "@/lib/serverTimeout";

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

type NormalizedAttemptRow = NonNullable<StatsSyncBody["attemptRows"]>[number];
type NormalizedDeviceDailyRow = NonNullable<StatsSyncBody["deviceDailyRows"]>[number];

const MAX_REQUEST_BYTES = 300_000;
const MAX_ATTEMPT_ROWS_PER_REQUEST = 250;
const MAX_DEVICE_DAILY_ROWS_PER_REQUEST = 90;
const MAX_DEVICE_IDS_PER_LOOKUP = 50;
const STATS_SYNC_TIMEOUT_MS = 4500;

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

  for (let index = 0; index < sessionIds.length; index += MAX_DEVICE_IDS_PER_LOOKUP) {
    const chunk = sessionIds.slice(index, index + MAX_DEVICE_IDS_PER_LOOKUP);
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

  for (let index = 0; index < visitorIds.length; index += MAX_DEVICE_IDS_PER_LOOKUP) {
    const chunk = visitorIds.slice(index, index + MAX_DEVICE_IDS_PER_LOOKUP);
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
  if (newRows.length === 0) return [];

  const { error } = await supabase
    .from("question_attempt_device_daily")
    .upsert(newRows as any, { onConflict: "visitor_id,activity_date" });

  if (error) throw error;
  return newRows;
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: true, deferred: true });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        message: "統計同步資料量過大，請稍後再分批同步。"
      },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
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
    const attemptRows = body.attemptRows ?? [];
    const deviceDailyRows = body.deviceDailyRows ?? [];

    if (
      attemptRows.length > MAX_ATTEMPT_ROWS_PER_REQUEST ||
      deviceDailyRows.length > MAX_DEVICE_DAILY_ROWS_PER_REQUEST
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "統計同步批次過大，已拒絕本次更新。"
        },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    await withServerTimeout(
      (async () => {
        await upsertAttemptRows(supabase, attemptRows);

        await Promise.all([
          body.deviceRow ? upsertAttemptDevice(supabase, body.deviceRow) : Promise.resolve(),
          upsertAttemptDeviceDaily(supabase, deviceDailyRows)
        ]);
      })(),
      STATS_SYNC_TIMEOUT_MS,
      "統計同步逾時，已改為稍後再補"
    );

    return NextResponse.json({ ok: true, rollupDeferred: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "統計同步失敗";
    if (
      isServerTimeoutError(error) ||
      /timeout|timed out|terminated|connection/i.test(message)
    ) {
      return NextResponse.json(
        { ok: true, deferred: true, message },
        { status: 202, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
