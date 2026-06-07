import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type YangmingExplanationRequestBody = {
  accessToken?: string | null;
  questionId?: string | null;
};

type YangmingExplanationRow = {
  question_id: string;
  body: string;
  author?: string | null;
  reviewer?: string | null;
  assets?: unknown;
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

function normalizeAssets(value: unknown): { src: string; alt?: string }[] {
  if (!Array.isArray(value)) return [];
  const assets: { src: string; alt?: string }[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { src?: unknown; alt?: unknown };
    if (typeof record.src !== "string" || !record.src.trim()) continue;

    assets.push({
      src: record.src.trim(),
      alt: typeof record.alt === "string" ? record.alt : undefined
    });
  }

  return assets;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as YangmingExplanationRequestBody;
    const questionId = body.questionId?.trim();
    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }

    const { data, error: authError } = await supabase.auth.getUser(body.accessToken);
    if (authError || !data.user) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    const activationFilter = data.user.email
      ? `user_id.eq.${data.user.id},user_email.eq.${data.user.email}`
      : `user_id.eq.${data.user.id}`;
    const { data: activationRows, error: activationError } = await supabase
      .from("yangming_mode_activations")
      .select("id")
      .or(activationFilter)
      .limit(1);

    if (activationError) {
      throw activationError;
    }

    if (!activationRows?.length) {
      return NextResponse.json({ ok: false, message: "尚未啟用。" }, { status: 403 });
    }

    const { data: explanationRow, error: explanationError } = await supabase
      .from("yangming_question_explanations")
      .select("question_id, body, author, reviewer, assets")
      .eq("question_id", questionId)
      .maybeSingle();

    if (explanationError) {
      const message = String(explanationError.message ?? "");
      if (message.includes("yangming_question_explanations") && (message.includes("does not exist") || message.includes("Could not find"))) {
        return NextResponse.json({ ok: true, explanation: null });
      }
      throw explanationError;
    }

    const row = explanationRow as YangmingExplanationRow | null;
    if (!row?.body) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    return NextResponse.json({
      ok: true,
      explanation: {
        body: row.body,
        author: row.author ?? undefined,
        reviewer: row.reviewer ?? undefined,
        assets: normalizeAssets(row.assets)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "詳解載入失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
