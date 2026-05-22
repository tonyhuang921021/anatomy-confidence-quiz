import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SubjectName } from "@/types/quiz";

type ApproveClassificationBody = {
  accessToken?: string;
  reportId?: string;
};

type ReportRow = {
  id: string | number;
  question_id: string;
  suggested_subject?: string | null;
  suggested_chapter?: string | null;
  suggested_section?: string | null;
};

const VALID_SUBJECTS = new Set<SubjectName>([
  "醫學（一）",
  "醫學（二）",
  "解剖學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "胚胎學",
  "組織學",
  "寄生蟲學",
  "公共衛生學",
  "細胞生物學",
  "分子生物學",
  "其他醫學一"
]);

function getAllowedEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
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

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法確認套用分類。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as ApproveClassificationBody | null;
    if (!body?.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }

    if (!body.reportId?.trim()) {
      return NextResponse.json({ ok: false, message: "缺少回報編號。" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(body.accessToken);
    if (userError || !userData.user?.email) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    if (!isAllowedEmail(userData.user.email)) {
      return NextResponse.json({ ok: false, message: "你沒有確認分類更動的權限。" }, { status: 403 });
    }

    const { data: report, error: reportError } = await supabase
      .from("question_classification_reports")
      .select("id, question_id, suggested_subject, suggested_chapter, suggested_section")
      .eq("id", body.reportId)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) {
      return NextResponse.json({ ok: false, message: "找不到這筆分類回報。" }, { status: 404 });
    }

    const typedReport = report as ReportRow;
    const subject = typedReport.suggested_subject?.trim() as SubjectName | undefined;
    if (!subject || !VALID_SUBJECTS.has(subject)) {
      return NextResponse.json(
        { ok: false, message: "這筆回報目前沒有可套用的有效科目。" },
        { status: 400 }
      );
    }

    const chapter = typedReport.suggested_chapter?.trim() || subject;
    const section = typedReport.suggested_section?.trim() || chapter;
    const now = new Date().toISOString();

    const { error: overrideError } = await supabase.from("question_classification_overrides").upsert(
      {
        question_id: typedReport.question_id,
        subject,
        chapter,
        section,
        source_report_id: typedReport.id,
        updated_at: now
      },
      { onConflict: "question_id" }
    );

    if (overrideError) throw overrideError;

    const { error: updateReportError } = await supabase
      .from("question_classification_reports")
      .update({
        applied_at: now,
        approved_by_email: userData.user.email
      })
      .eq("id", typedReport.id);

    if (updateReportError) throw updateReportError;

    return NextResponse.json({
      ok: true,
      questionId: typedReport.question_id,
      subject,
      chapter,
      section,
      appliedAt: now,
      approvedByEmail: userData.user.email
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "確認分類更動失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
