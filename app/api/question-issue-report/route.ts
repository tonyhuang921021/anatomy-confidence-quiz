import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type QuestionIssueReportRequestBody = {
  visitorId?: string;
  accessToken?: string;
  issueCategory?: string | null;
  issueNote?: string | null;
  question?: {
    id?: string;
    subject?: string;
    chapter?: string;
    section?: string;
    stem?: string;
    options?: Record<string, string | undefined>;
    answer?: string;
    acceptedAnswers?: string[];
    explanation?: string;
    testedConcept?: string;
  };
};

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

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return "題目瑕疵回報送出失敗。";
}

function isMissingIssueDetailColumnError(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? error ?? "");
  return message.includes("issue_category") || message.includes("issue_note") || message.includes("schema cache");
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "題目瑕疵回報暫時維護中，先讓登入與同步恢復。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as QuestionIssueReportRequestBody | null;
    const question = body?.question;

    if (!question?.id || !question.stem) {
      return NextResponse.json(
        { ok: false, message: "缺少題目資訊，無法回報題目瑕疵。" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法回報題目瑕疵。" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const accessToken = body?.accessToken?.trim();
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "請先登入帳號，才能回報此題題目瑕疵。" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    const user = userData.user;
    if (userError || !user?.id || !user.email) {
      return NextResponse.json(
        { ok: false, message: "請先登入帳號，才能回報此題題目瑕疵。" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const insertPayload = {
      question_id: question.id,
      issue_type: "question_defect",
      issue_category: body?.issueCategory?.trim() || null,
      issue_note: body?.issueNote?.trim() || null,
      current_subject: question.subject ?? null,
      current_chapter: question.chapter ?? null,
      current_section: question.section ?? null,
      question_stem: question.stem,
      question_options: question.options ?? {},
      answer: question.answer ?? null,
      accepted_answers: question.acceptedAnswers ?? [],
      explanation: question.explanation ?? null,
      tested_concept: question.testedConcept ?? null,
      reporter_email: user.email,
      user_id: user.id,
      visitor_id: body?.visitorId?.trim() || null
    };

    let { error } = await supabase.from("question_issue_reports").insert(insertPayload);
    if (error && isMissingIssueDetailColumnError(error)) {
      const {
        issue_category: _issueCategory,
        issue_note: _issueNote,
        ...legacyPayload
      } = insertPayload;
      const retryResult = await supabase.from("question_issue_reports").insert(legacyPayload);
      error = retryResult.error;
    }

    if (error) throw error;

    return NextResponse.json(
      { ok: true, message: "已回報題目瑕疵，站長會在私有數據頁整理。" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: formatUnknownError(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
