import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type ReviewQuestionState = "resolved" | "unresolved";

type ReviewQuestionStateRecord = {
  scope: string;
  questionId: string;
  state: ReviewQuestionState;
  updatedAt: string;
};

type ReviewQuestionStateRow = {
  scope: string;
  question_id: string;
  state: ReviewQuestionState;
  updated_at: string;
};

type ReviewQuestionStateUpsertRow = {
  user_id: string;
  scope: string;
  question_id: string;
  state: ReviewQuestionState;
  updated_at: string;
};

type ReviewQuestionStatesRequestBody = {
  action?: "sync";
  scope?: unknown;
  records?: unknown[];
};

type ServiceSupabaseClient = any;

const MAX_REVIEW_STATE_RECORDS = 5000;

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

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

function normalizeScope(value: unknown) {
  const scope = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9:_-]{1,80}$/i.test(scope) ? scope : "";
}

function normalizeQuestionId(value: unknown) {
  const questionId = typeof value === "string" ? value.trim() : "";
  return questionId.length > 0 && questionId.length <= 180 ? questionId : "";
}

function normalizeIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function normalizeState(value: unknown): ReviewQuestionState | null {
  return value === "resolved" || value === "unresolved" ? value : null;
}

function normalizeRecord(value: unknown, fallbackScope = ""): ReviewQuestionStateRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReviewQuestionStateRecord>;
  const scope = normalizeScope(raw.scope ?? fallbackScope);
  const questionId = normalizeQuestionId(raw.questionId);
  const state = normalizeState(raw.state);

  if (!scope || !questionId || !state) return null;

  return {
    scope,
    questionId,
    state,
    updatedAt: normalizeIsoString(raw.updatedAt)
  };
}

function rowToRecord(row: ReviewQuestionStateRow): ReviewQuestionStateRecord | null {
  const scope = normalizeScope(row.scope);
  const questionId = normalizeQuestionId(row.question_id);
  const state = normalizeState(row.state);

  if (!scope || !questionId || !state) return null;

  return {
    scope,
    questionId,
    state,
    updatedAt: normalizeIsoString(row.updated_at)
  };
}

function recordToUpsertRow(userId: string, record: ReviewQuestionStateRecord): ReviewQuestionStateUpsertRow {
  return {
    user_id: userId,
    scope: record.scope,
    question_id: record.questionId,
    state: record.state,
    updated_at: record.updatedAt
  };
}

function chooseNewerRecord(
  left: ReviewQuestionStateRecord | undefined,
  right: ReviewQuestionStateRecord | undefined
) {
  if (!left) return right ?? null;
  if (!right) return left;
  return right.updatedAt >= left.updatedAt ? right : left;
}

function getRecordKey(record: Pick<ReviewQuestionStateRecord, "scope" | "questionId">) {
  return `${record.scope}\n${record.questionId}`;
}

function formatError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (code === "42P01" || message.includes("review_question_states")) {
    return "複習完成區同步資料表尚未建立，請先套用 review_question_states migration。";
  }

  return message || "複習完成區同步失敗。";
}

async function getAuthedUser(request: NextRequest, supabase: ServiceSupabaseClient) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    return { userId: "", error: NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 }) };
  }

  return { userId: data.user.id, error: null };
}

async function loadCloudRecords(
  supabase: ServiceSupabaseClient,
  userId: string,
  scopes: string[]
) {
  let query = supabase
    .from("review_question_states")
    .select("scope, question_id, state, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_REVIEW_STATE_RECORDS);

  if (scopes.length > 0) {
    query = query.in("scope", scopes);
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Map(
    ((data ?? []) as ReviewQuestionStateRow[])
      .map(rowToRecord)
      .filter((record): record is ReviewQuestionStateRecord => Boolean(record))
      .map((record) => [getRecordKey(record), record] as const)
  );
}

export async function GET(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "複習完成區同步暫時維護中，先保存在本機。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase 尚未設定，完成區會先留在本機。" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const scope = normalizeScope(request.nextUrl.searchParams.get("scope"));
    const cloudRecords = await loadCloudRecords(supabase, userId, scope ? [scope] : []);

    return NextResponse.json(
      { ok: true, records: Array.from(cloudRecords.values()) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (loadError) {
    return NextResponse.json(
      { ok: false, message: formatError(loadError) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "複習完成區同步暫時維護中，先保存在本機。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase 尚未設定，完成區會先留在本機。" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { userId, error } = await getAuthedUser(request, supabase);
  if (error) return error;

  try {
    const body = (await request.json().catch(() => null)) as ReviewQuestionStatesRequestBody | null;
    if (body?.action !== "sync") {
      return NextResponse.json(
        { ok: false, message: "不支援的複習完成區操作。" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const fallbackScope = normalizeScope(body.scope);
    const localRecords = new Map(
      (Array.isArray(body.records) ? body.records.slice(0, MAX_REVIEW_STATE_RECORDS) : [])
        .map((value) => normalizeRecord(value, fallbackScope))
        .filter((record): record is ReviewQuestionStateRecord => Boolean(record))
        .map((record) => [getRecordKey(record), record] as const)
    );
    const scopes = Array.from(
      new Set([
        ...(fallbackScope ? [fallbackScope] : []),
        ...Array.from(localRecords.values()).map((record) => record.scope)
      ])
    );
    const cloudRecords = await loadCloudRecords(supabase, userId, scopes);
    const recordKeys = new Set([...Array.from(cloudRecords.keys()), ...Array.from(localRecords.keys())]);
    const recordsToUpsert: ReviewQuestionStateUpsertRow[] = [];
    const mergedRecords: ReviewQuestionStateRecord[] = [];

    recordKeys.forEach((key) => {
      const localRecord = localRecords.get(key);
      const cloudRecord = cloudRecords.get(key);
      const latestRecord = chooseNewerRecord(cloudRecord, localRecord);
      if (!latestRecord) return;

      if (localRecord && (!cloudRecord || localRecord.updatedAt >= cloudRecord.updatedAt)) {
        recordsToUpsert.push(recordToUpsertRow(userId, latestRecord));
      }
      mergedRecords.push(latestRecord);
    });

    if (recordsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("review_question_states")
        .upsert(recordsToUpsert, { onConflict: "user_id,scope,question_id" });

      if (upsertError) throw upsertError;
    }

    return NextResponse.json(
      {
        ok: true,
        records: mergedRecords.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (syncError) {
    return NextResponse.json(
      { ok: false, message: formatError(syncError) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
