import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

type BackgroundDataKind = "stats" | "explanations" | "classifications";

const MAX_IDS_BY_KIND: Record<BackgroundDataKind, number> = {
  stats: 100,
  explanations: 20,
  classifications: 500
};

const NO_STORE_CACHE_CONTROL = "no-store";

const CACHE_CONTROL_BY_KIND: Record<BackgroundDataKind, string> = {
  stats: "public, max-age=900, s-maxage=3600, stale-while-revalidate=21600",
  explanations: NO_STORE_CACHE_CONTROL,
  classifications: "public, max-age=21600, s-maxage=86400, stale-while-revalidate=172800"
};

function jsonWithCache(
  payload: unknown,
  kind: BackgroundDataKind,
  init?: ResponseInit,
  cacheControl = CACHE_CONTROL_BY_KIND[kind]
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", cacheControl);

  return NextResponse.json(payload, {
    ...init,
    headers
  });
}

function jsonNoStore(payload: unknown, kind: BackgroundDataKind, init?: ResponseInit) {
  return jsonWithCache(payload, kind, init, NO_STORE_CACHE_CONTROL);
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

function getPublicStatsSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getKind(value: string | null): BackgroundDataKind | null {
  if (value === "stats" || value === "explanations" || value === "classifications") {
    return value;
  }
  return null;
}

function getQuestionIds(request: NextRequest, kind: BackgroundDataKind) {
  const ids = request.nextUrl.searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

  return Array.from(new Set(ids)).sort().slice(0, MAX_IDS_BY_KIND[kind]);
}

function shouldLoadAllClassifications(request: NextRequest) {
  return request.nextUrl.searchParams.get("all") === "1";
}

function emptyPayload(kind: BackgroundDataKind, recovery = false) {
  if (kind === "stats") return { ok: true, stats: [], recovery };
  if (kind === "explanations") return { ok: true, overrides: [], recovery };
  return { ok: true, overrides: [], recovery };
}

function degradedPayload(kind: BackgroundDataKind, message: string) {
  return {
    ...emptyPayload(kind),
    degraded: true,
    message
  };
}

export async function GET(request: NextRequest) {
  const kind = getKind(request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ ok: false, message: "背景資料類型不正確。" }, { status: 400 });
  }

  if (isSupabaseRecoveryMode()) {
    return jsonNoStore(emptyPayload(kind, true), kind);
  }

  const loadAllClassifications = kind === "classifications" && shouldLoadAllClassifications(request);
  const questionIds = getQuestionIds(request, kind);
  if (questionIds.length === 0 && !loadAllClassifications) {
    return jsonWithCache(emptyPayload(kind), kind);
  }

  const serviceSupabase = getServiceSupabaseClient();
  // Public correctness stats already have read-only RLS; keep every other dataset service-only.
  const supabase = serviceSupabase ?? (kind === "stats" ? getPublicStatsSupabaseClient() : null);
  if (!supabase) {
    return jsonNoStore(emptyPayload(kind), kind);
  }

  try {
    if (kind === "stats") {
      const { data, error } = await withServerTimeout(
        supabase
          .from("question_accuracy_stats")
          .select("question_id, total_attempts, correct_attempts, correct_rate, updated_at")
          .in("question_id", questionIds),
        1800,
        "題目統計讀取逾時"
      );

      if (error) throw error;
      return jsonWithCache({ ok: true, stats: data ?? [] }, kind);
    }

    if (kind === "explanations") {
      const { data, error } = await withServerTimeout(
        supabase
          .from("question_explanation_overrides")
          .select("question_id, explanation, option_analysis, memory_tip, model, updated_at")
          .in("question_id", questionIds),
        1800,
        "共享詳解讀取逾時"
      );

      if (error) throw error;
      return jsonWithCache({ ok: true, overrides: data ?? [] }, kind);
    }

    let classificationQuery = supabase
      .from("question_classification_overrides")
      .select("question_id, subject, chapter, section, source_report_id, updated_at");

    if (!loadAllClassifications) {
      classificationQuery = classificationQuery.in("question_id", questionIds);
    }

    const { data, error } = await withServerTimeout(
      classificationQuery.order("updated_at", { ascending: false }).limit(1000),
      1800,
      "題目分類讀取逾時"
    );

    if (error) throw error;
    return jsonWithCache({ ok: true, overrides: data ?? [] }, kind);
  } catch (error) {
    const message = error instanceof Error ? error.message : "背景資料讀取失敗";
    return jsonNoStore(degradedPayload(kind, message), kind);
  }
}
