import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type ReviewStatsAction = "fetch" | "sync";

type ReviewStatsRequestBody = {
  accessToken?: string;
  action?: ReviewStatsAction;
  rows?: Array<{
    drugKey?: string;
    name?: string;
    category?: string;
    known?: number;
    unknown?: number;
    seen?: number;
    lastSeenAt?: number | null;
    updatedAt?: number | null;
  }>;
};

type PharmacologyReviewStatsUpsertRow = {
  user_id: string;
  drug_key: string;
  drug_name: string;
  category: string;
  known_count: number;
  unknown_count: number;
  seen_count: number;
  last_seen_at: string | null;
  updated_at: string;
};

const MAX_SYNC_ROWS = 2500;

function getSupabaseServerClient() {
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

function clampCount(value: unknown) {
  const numericValue = Math.floor(Number(value) || 0);
  return Math.min(999999, Math.max(0, numericValue));
}

function epochMsToIso(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoToEpochMs(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatError(error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "string" && error.trim()
        ? error.trim()
        : "";

  if (message.includes("pharmacology_review_stats") && (message.includes("Could not find") || message.includes("does not exist"))) {
    return "藥理雲端同步資料表尚未建立，請先在 Supabase 套用 schema.sql 的 pharmacology_review_stats 區塊。";
  }

  if (message) return message;
  return "藥理複習雲端紀錄暫時無法同步。";
}

function isUpsertRow(value: PharmacologyReviewStatsUpsertRow | null): value is PharmacologyReviewStatsUpsertRow {
  return value !== null;
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "雲端同步暫時維護中，藥理卡會先保存在本機。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as ReviewStatsRequestBody | null;
    const accessToken = body?.accessToken?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "請先登入，才能同步藥理複習紀錄。" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, message: "Supabase server key 尚未設定，暫時只能使用本機藥理紀錄。" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    const user = userData.user;
    if (userError || !user?.id) {
      return NextResponse.json(
        { ok: false, message: "登入狀態已過期，請重新登入後同步藥理紀錄。" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body?.action === "fetch") {
      const { data, error } = await supabase
        .from("pharmacology_review_stats")
        .select("drug_key, drug_name, category, known_count, unknown_count, seen_count, last_seen_at, updated_at")
        .eq("user_id", user.id);

      if (error) throw error;

      return NextResponse.json(
        {
          ok: true,
          rows: (data ?? []).map((row) => ({
            drugKey: row.drug_key,
            name: row.drug_name,
            category: row.category,
            known: row.known_count,
            unknown: row.unknown_count,
            seen: row.seen_count,
            lastSeenAt: isoToEpochMs(row.last_seen_at),
            updatedAt: isoToEpochMs(row.updated_at)
          }))
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = Array.isArray(body?.rows) ? body.rows.slice(0, MAX_SYNC_ROWS) : [];
    const upsertRows = rows
      .map((row) => {
        const drugKey = row.drugKey?.trim();
        const drugName = row.name?.trim();
        const category = row.category?.trim();
        if (!drugKey || !drugName || !category) return null;

        const lastSeenAt = epochMsToIso(row.lastSeenAt);
        return {
          user_id: user.id,
          drug_key: drugKey,
          drug_name: drugName,
          category,
          known_count: clampCount(row.known),
          unknown_count: clampCount(row.unknown),
          seen_count: clampCount(row.seen),
          last_seen_at: lastSeenAt,
          updated_at: epochMsToIso(row.updatedAt) ?? lastSeenAt ?? new Date().toISOString()
        };
      })
      .filter(isUpsertRow);

    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from("pharmacology_review_stats")
        .upsert(upsertRows, { onConflict: "user_id,drug_key" });

      if (error) throw error;
    }

    return NextResponse.json({ ok: true, synced: upsertRows.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: formatError(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
