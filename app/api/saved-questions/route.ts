import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import {
  mergeSavedQuestionSyncRecords,
  shouldUpsertLocalRecord
} from "@/lib/cloudSyncWriteGuard";
import {
  SavedQuestionRecord,
  SavedQuestionSource,
  SavedQuestionTombstone
} from "@/types/quiz";

type SavedQuestionsRequestBody = {
  action?: "sync";
  records?: unknown[];
  deletedRecords?: unknown[];
};

type SavedQuestionRow = {
  question_id: string;
  source_context: string | null;
  correct_count: number | null;
  attempts: number | null;
  last_answered_at: string | null;
  added_at: string | null;
  updated_at: string | null;
};

type SavedQuestionUpsertRow = {
  user_id: string;
  question_id: string;
  source_context: SavedQuestionSource | null;
  correct_count: number;
  attempts: number;
  last_answered_at: string | null;
  added_at: string;
  updated_at: string;
};

type ServiceSupabaseClient = any;

const MAX_SYNC_RECORDS = 1500;

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

function normalizeIsoString(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function normalizeOptionalIsoString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeCount(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeSource(value: unknown): SavedQuestionSource | undefined {
  return value === "search" ||
    value === "quiz" ||
    value === "results" ||
    value === "review" ||
    value === "saved"
    ? value
    : undefined;
}

function normalizeRecord(value: unknown): SavedQuestionRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedQuestionRecord>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  if (!questionId) return null;

  const addedAt = normalizeIsoString(raw.addedAt);
  return {
    questionId,
    addedAt,
    updatedAt: normalizeIsoString(raw.updatedAt, raw.lastAnsweredAt ?? addedAt),
    correctCount: Math.min(2, normalizeCount(raw.correctCount)),
    attempts: normalizeCount(raw.attempts),
    lastAnsweredAt: normalizeOptionalIsoString(raw.lastAnsweredAt) ?? undefined,
    source: normalizeSource(raw.source)
  };
}

function normalizeTombstone(value: unknown): SavedQuestionTombstone | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedQuestionTombstone>;
  const questionId = typeof raw.questionId === "string" ? raw.questionId.trim() : "";
  if (!questionId) return null;

  return {
    questionId,
    deletedAt: normalizeIsoString(raw.deletedAt)
  };
}

function rowToRecord(row: SavedQuestionRow): SavedQuestionRecord | null {
  if (!row.question_id) return null;
  const addedAt = normalizeIsoString(row.added_at);
  return {
    questionId: row.question_id,
    addedAt,
    updatedAt: normalizeIsoString(row.updated_at, addedAt),
    correctCount: Math.min(2, normalizeCount(row.correct_count)),
    attempts: normalizeCount(row.attempts),
    lastAnsweredAt: normalizeOptionalIsoString(row.last_answered_at) ?? undefined,
    source: normalizeSource(row.source_context)
  };
}

function recordToUpsertRow(userId: string, record: SavedQuestionRecord): SavedQuestionUpsertRow {
  return {
    user_id: userId,
    question_id: record.questionId,
    source_context: record.source ?? null,
    correct_count: Math.min(2, normalizeCount(record.correctCount)),
    attempts: normalizeCount(record.attempts),
    last_answered_at: record.lastAnsweredAt ?? null,
    added_at: record.addedAt,
    updated_at: record.updatedAt
  };
}

function savedQuestionRecordsAreEqual(
  left: SavedQuestionRecord,
  right: SavedQuestionRecord
) {
  return left.questionId === right.questionId &&
    left.source === right.source &&
    left.correctCount === right.correctCount &&
    left.attempts === right.attempts &&
    left.lastAnsweredAt === right.lastAnsweredAt &&
    left.addedAt === right.addedAt;
}

function formatError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (code === "42P01" || message.includes("saved_questions")) {
    return "儲存題目資料表尚未建立，請先套用 saved_questions migration。";
  }

  return message || "儲存題目同步失敗。";
}

async function loadCloudRecordMap(supabase: ServiceSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("saved_questions")
    .select("question_id, source_context, correct_count, attempts, last_answered_at, added_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_SYNC_RECORDS);

  if (error) throw error;

  return Object.fromEntries(
    ((data ?? []) as SavedQuestionRow[])
      .map(rowToRecord)
      .filter((record): record is SavedQuestionRecord => Boolean(record))
      .map((record) => [record.questionId, record] as const)
  );
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "儲存題目同步暫時維護中，先保存在本機。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase 尚未設定，儲存題目會先留在本機。" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "請先登入，才能同步儲存題目。" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData.user;
  if (userError || !user?.id) {
    return NextResponse.json(
      { ok: false, message: "登入驗證失敗，請重新登入後同步儲存題目。" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as SavedQuestionsRequestBody | null;
    if (body?.action !== "sync") {
      return NextResponse.json(
        { ok: false, message: "不支援的儲存題目操作。" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const localRecords = new Map(
      (Array.isArray(body.records) ? body.records.slice(0, MAX_SYNC_RECORDS) : [])
        .map(normalizeRecord)
        .filter((record): record is SavedQuestionRecord => Boolean(record))
        .map((record) => [record.questionId, record] as const)
    );
    const tombstones = new Map(
      (Array.isArray(body.deletedRecords) ? body.deletedRecords.slice(0, MAX_SYNC_RECORDS) : [])
        .map(normalizeTombstone)
        .filter((record): record is SavedQuestionTombstone => Boolean(record))
        .map((record) => [record.questionId, record] as const)
    );
    const cloudRecords = await loadCloudRecordMap(supabase, user.id);
    const questionIds = new Set([
      ...Object.keys(cloudRecords),
      ...Array.from(localRecords.keys()),
      ...Array.from(tombstones.keys())
    ]);
    const recordsToUpsert: SavedQuestionUpsertRow[] = [];
    const questionIdsToDelete: string[] = [];
    const acknowledgedDeletedQuestionIds: string[] = [];
    const mergedRecords: SavedQuestionRecord[] = [];

    questionIds.forEach((questionId) => {
      const localRecord = localRecords.get(questionId);
      const cloudRecord = cloudRecords[questionId];
      const tombstone = tombstones.get(questionId);
      const latestRecord = mergeSavedQuestionSyncRecords(cloudRecord, localRecord);

      if (tombstone && (!latestRecord || tombstone.deletedAt >= latestRecord.updatedAt)) {
        if (cloudRecord) questionIdsToDelete.push(questionId);
        acknowledgedDeletedQuestionIds.push(questionId);
        return;
      }

      if (!latestRecord) return;

      if (
        localRecord &&
        shouldUpsertLocalRecord(latestRecord, cloudRecord, savedQuestionRecordsAreEqual)
      ) {
        recordsToUpsert.push(recordToUpsertRow(user.id, latestRecord));
      }
      mergedRecords.push(latestRecord);
    });

    if (questionIdsToDelete.length > 0) {
      const { error } = await supabase
        .from("saved_questions")
        .delete()
        .eq("user_id", user.id)
        .in("question_id", questionIdsToDelete);

      if (error) throw error;
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await supabase
        .from("saved_questions")
        .upsert(recordsToUpsert, { onConflict: "user_id,question_id" });

      if (error) throw error;
    }

    return NextResponse.json(
      {
        ok: true,
        records: mergedRecords.sort((left, right) => right.addedAt.localeCompare(left.addedAt)),
        acknowledgedDeletedQuestionIds
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: formatError(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
