import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type BackgroundDataKind = "stats" | "explanations" | "classifications";

const MAX_IDS_BY_KIND: Record<BackgroundDataKind, number> = {
  stats: 40,
  explanations: 20,
  classifications: 60
};

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

  return Array.from(new Set(ids)).slice(0, MAX_IDS_BY_KIND[kind]);
}

function emptyPayload(kind: BackgroundDataKind, recovery = false) {
  if (kind === "stats") return { ok: true, stats: [], recovery };
  if (kind === "explanations") return { ok: true, overrides: {}, recovery };
  return { ok: true, overrides: {}, recovery };
}

export async function GET(request: NextRequest) {
  const kind = getKind(request.nextUrl.searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ ok: false, message: "背景資料類型不正確。" }, { status: 400 });
  }

  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(emptyPayload(kind, true));
  }

  const questionIds = getQuestionIds(request, kind);
  if (questionIds.length === 0) {
    return NextResponse.json(emptyPayload(kind));
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(emptyPayload(kind));
  }

  try {
    if (kind === "stats") {
      const { data, error } = await supabase
        .from("question_accuracy_stats")
        .select("question_id, total_attempts, correct_attempts, correct_rate, updated_at")
        .in("question_id", questionIds);

      if (error) throw error;
      return NextResponse.json({ ok: true, stats: data ?? [] });
    }

    if (kind === "explanations") {
      const { data, error } = await supabase
        .from("question_explanation_overrides")
        .select("question_id, explanation, option_analysis, memory_tip, model, updated_at")
        .in("question_id", questionIds);

      if (error) throw error;
      return NextResponse.json({ ok: true, overrides: data ?? [] });
    }

    const { data, error } = await supabase
      .from("question_classification_overrides")
      .select("question_id, subject, chapter, section, source_report_id, updated_at")
      .in("question_id", questionIds);

    if (error) throw error;
    return NextResponse.json({ ok: true, overrides: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "背景資料讀取失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
