import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type YangmingExplanationReportRequestBody = {
  accessToken?: string | null;
  visitorId?: string | null;
  questionId?: string | null;
  reason?: string | null;
  sourceLabel?: string | null;
  sourceFile?: string | null;
};

const MAX_REASON_LENGTH = 1200;

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

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      typeof record.message === "string" ? record.message.trim() : "",
      typeof record.details === "string" ? record.details.trim() : "",
      typeof record.hint === "string" ? record.hint.trim() : "",
      typeof record.code === "string" ? `code: ${record.code.trim()}` : ""
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return "陽明詳解回報失敗。";
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法回報陽明詳解。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as YangmingExplanationReportRequestBody;
    const questionId = body.questionId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";

    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入帳號，才能回報陽明詳解。" }, { status: 401 });
    }
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }
    if (reason.length < 2) {
      return NextResponse.json({ ok: false, message: "請簡單填一下回報原因。" }, { status: 400 });
    }

    const { data, error: authError } = await supabase.auth.getUser(body.accessToken);
    if (authError || !data.user?.id) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    const { data: activation, error: activationError } = await supabase
      .from("yangming_mode_activations")
      .select("id")
      .eq("user_id", data.user.id)
      .limit(1)
      .maybeSingle();
    if (activationError) throw activationError;
    if (!activation) {
      return NextResponse.json({ ok: false, message: "尚未啟用陽明詳解。" }, { status: 403 });
    }

    const { error } = await supabase.from("yangming_explanation_reports").insert({
      question_id: questionId,
      reason: reason.slice(0, MAX_REASON_LENGTH),
      user_id: data.user.id,
      reporter_email: data.user.email ?? null,
      visitor_id: body.visitorId?.trim() || null,
      source_label: body.sourceLabel?.trim() || null,
      source_file: body.sourceFile?.trim() || null
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: formatUnknownError(error) }, { status: 500 });
  }
}
