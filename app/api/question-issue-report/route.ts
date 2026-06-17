import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";

type QuestionIssueReportRequestBody = {
  visitorId?: string;
  accessToken?: string;
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

    const { error } = await supabase.from("question_issue_reports").insert({
      question_id: question.id,
      issue_type: "question_defect",
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
    });

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
