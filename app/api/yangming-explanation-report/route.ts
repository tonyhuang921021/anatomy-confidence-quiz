import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type YangmingExplanationReportRequestBody = {
  accessToken?: string | null;
  visitorId?: string | null;
  questionId?: string | null;
  reason?: string | null;
  reportType?: "report" | "correction" | null;
  proposedBody?: string | null;
  keptAssetIndexes?: number[] | null;
  sourceLabel?: string | null;
  sourceFile?: string | null;
};

const MAX_REASON_LENGTH = 1200;
const MAX_PROPOSED_BODY_LENGTH = 30000;

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

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const details = typeof record.details === "string" ? record.details : "";
  const code = typeof record.code === "string" ? record.code : "";
  return (
    code === "42703" ||
    message.includes("Could not find") ||
    message.includes("column") ||
    details.includes("column")
  );
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "陽明詳解回報暫時維護中，先讓登入與同步恢復。" },
      { status: 503 }
    );
  }

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
    const reportType = body.reportType === "correction" ? "correction" : "report";
    const proposedBody = body.proposedBody?.trim() ?? "";
    const requestedKeptAssetIndexes = Array.isArray(body.keptAssetIndexes)
      ? body.keptAssetIndexes.filter((index) => Number.isInteger(index) && index >= 0)
      : null;

    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入帳號，才能回報陽明詳解。" }, { status: 401 });
    }
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }
    if (reason.length < 2) {
      return NextResponse.json({ ok: false, message: "請簡單填一下回報原因。" }, { status: 400 });
    }
    if (reportType === "correction" && proposedBody.length < 10) {
      return NextResponse.json({ ok: false, message: "修正版內容太短，請至少保留主要詳解文字。" }, { status: 400 });
    }

    const { data, error: authError } = await supabase.auth.getUser(body.accessToken);
    if (authError || !data.user?.id) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    const { data: currentExplanation, error: currentExplanationError } = await supabase
      .from("yangming_question_explanations")
      .select("question_id, body, author, reviewer, source_label, source_file, source_page_start, source_page_end, question_stem_snapshot, answer_snapshot, assets")
      .eq("question_id", questionId)
      .maybeSingle();
    if (currentExplanationError) throw currentExplanationError;

    const previousBody =
      typeof currentExplanation?.body === "string" ? currentExplanation.body : null;
    const previousAssets = Array.isArray(currentExplanation?.assets) ? currentExplanation.assets : [];
    const clippedProposedBody =
      reportType === "correction" ? proposedBody.slice(0, MAX_PROPOSED_BODY_LENGTH) : null;
    const appliedAt = reportType === "correction" ? new Date().toISOString() : null;

    const baseReportRow = {
      question_id: questionId,
      reason: reason.slice(0, MAX_REASON_LENGTH),
      user_id: data.user.id,
      reporter_email: data.user.email ?? null,
      visitor_id: body.visitorId?.trim() || null,
      source_label: body.sourceLabel?.trim() || null,
      source_file: body.sourceFile?.trim() || null
    };
    const { error } = await supabase.from("yangming_explanation_reports").insert({
      ...baseReportRow,
      report_type: reportType,
      proposed_body: clippedProposedBody,
      previous_body: previousBody,
      previous_assets: reportType === "correction" ? previousAssets : null,
      kept_asset_indexes: reportType === "correction" ? requestedKeptAssetIndexes : null,
      applied_at: appliedAt
    });

    if (error) {
      if (!isMissingColumnError(error)) throw error;
      const { error: fallbackError } = await supabase
        .from("yangming_explanation_reports")
        .insert(baseReportRow);
      if (fallbackError) throw fallbackError;
    }

    if (reportType === "correction" && clippedProposedBody) {
      const now = new Date().toISOString();
      const nextAssets =
        requestedKeptAssetIndexes === null
          ? previousAssets
          : previousAssets.filter((_, index) => requestedKeptAssetIndexes.includes(index));
      const { error: updateError } = await supabase
        .from("yangming_question_explanations")
        .upsert(
          {
            question_id: questionId,
            body: clippedProposedBody,
            author: currentExplanation?.author ?? null,
            reviewer: currentExplanation?.reviewer ?? null,
            source_label:
              currentExplanation?.source_label ?? body.sourceLabel?.trim() ?? "同學修正版",
            source_file: currentExplanation?.source_file ?? body.sourceFile?.trim() ?? null,
            source_page_start: currentExplanation?.source_page_start ?? null,
            source_page_end: currentExplanation?.source_page_end ?? null,
            question_stem_snapshot: currentExplanation?.question_stem_snapshot ?? null,
            answer_snapshot: currentExplanation?.answer_snapshot ?? null,
            sections: [],
            assets: nextAssets,
            match_status: "community_corrected",
            match_score: 1,
            updated_at: now
          },
          { onConflict: "question_id" }
        );
      if (updateError) throw updateError;
    }

    return NextResponse.json({ ok: true, applied: reportType === "correction" });
  } catch (error) {
    return NextResponse.json({ ok: false, message: formatUnknownError(error) }, { status: 500 });
  }
}
