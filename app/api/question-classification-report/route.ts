import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";

type ClassificationReportRequestBody = {
  visitorId?: string;
  accessToken?: string;
  question?: {
    id?: string;
    subject?: string;
    chapter?: string;
    section?: string;
    stem?: string;
    options?: Record<string, string | undefined>;
    explanation?: string;
    testedConcept?: string;
  };
};

type VerifiedUser = {
  id: string;
  email?: string | null;
};

type ParsedClassificationPayload = {
  subject?: string;
  chapter?: string;
  section?: string;
  reason?: string;
};

const HOURLY_LIMIT = 8;
const DAILY_LIMIT = 20;
const CLASSIFICATION_SUBJECTS = [
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
].join("、");

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

function stripJsonCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      typeof record.message === "string" ? record.message.trim() : "",
      typeof record.details === "string" ? record.details.trim() : "",
      typeof record.hint === "string" ? record.hint.trim() : "",
      typeof record.code === "string" ? `code: ${record.code.trim()}` : ""
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "分類回報失敗。";
}

async function getVerifiedUser(accessToken?: string): Promise<VerifiedUser | null> {
  if (!accessToken) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;

  return {
    id: data.user.id,
    email: data.user.email
  };
}

async function checkUsageLimits(supabase: any, actorColumn: "user_id" | "visitor_id", actorValue: string) {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [hourResult, dayResult] = await Promise.all([
    supabase
      .from("question_classification_reports")
      .select("*", { count: "exact", head: true })
      .eq(actorColumn, actorValue)
      .gte("created_at", hourAgo),
    supabase
      .from("question_classification_reports")
      .select("*", { count: "exact", head: true })
      .eq(actorColumn, actorValue)
      .gte("created_at", dayAgo)
  ]);

  const errors = [hourResult.error, dayResult.error].filter(Boolean);
  if (errors.length > 0) throw errors[0];

  if ((hourResult.count ?? 0) >= HOURLY_LIMIT) {
    return {
      blocked: true,
      message: `分類回報太快了，1 小時內最多 ${HOURLY_LIMIT} 次。`
    };
  }

  if ((dayResult.count ?? 0) >= DAILY_LIMIT) {
    return {
      blocked: true,
      message: `今天分類回報已達上限，24 小時內最多 ${DAILY_LIMIT} 次。`
    };
  }

  return { blocked: false };
}

function buildClassificationPrompt(question: NonNullable<ClassificationReportRequestBody["question"]>) {
  const optionLines = Object.entries(question.options ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}. ${value?.trim()}`)
    .join("\n");

  return [
    "你是台灣醫學系國考題庫整理助手，請幫這一題重新判斷最適合的科目分類。",
    `只能從以下科目擇一：${CLASSIFICATION_SUBJECTS}`,
    "請優先依核心考點分類，不要只看器官名稱。",
    "請只輸出 JSON，不要輸出 markdown，不要輸出 code block。",
    "",
    "JSON 格式：",
    "{",
    '  "subject": "科目",',
    '  "chapter": "章節",',
    '  "section": "小節",',
    '  "reason": "一句到兩句，簡短說明為什麼這題應該分到這科"',
    "}",
    "",
    `目前題目 id：${question.id ?? ""}`,
    `目前科目：${question.subject ?? ""}`,
    `目前章節：${question.chapter ?? ""}`,
    `目前小節：${question.section ?? ""}`,
    `testedConcept：${question.testedConcept ?? ""}`,
    `題幹：${question.stem ?? ""}`,
    "選項：",
    optionLines || "無",
    `目前詳解：${question.explanation ?? ""}`
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as ClassificationReportRequestBody | null;
    const question = body?.question;

    if (!question?.id || !question.subject || !question.stem) {
      return NextResponse.json(
        {
          ok: false,
          message: "缺少題目資訊，無法回報分類。"
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法回報分類。"
        },
        { status: 500 }
      );
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message: "OPENAI_API_KEY 尚未設定，暫時無法用 AI 重新分類。"
        },
        { status: 500 }
      );
    }

    const verifiedUser = await getVerifiedUser(body?.accessToken);
    const visitorId = body?.visitorId?.trim() || null;
    const actorColumn = verifiedUser?.id ? "user_id" : "visitor_id";
    const actorValue = verifiedUser?.id || visitorId;

    if (!actorValue) {
      return NextResponse.json(
        {
          ok: false,
          message: "目前無法識別回報來源，請稍後再試。"
        },
        { status: 400 }
      );
    }

    const limitResult = await checkUsageLimits(supabase, actorColumn, actorValue);
    if (limitResult.blocked) {
      return NextResponse.json(
        {
          ok: false,
          message: limitResult.message
        },
        { status: 429 }
      );
    }

    const result = await createOpenAIText(buildClassificationPrompt(question), 600, "gpt-5-mini");
    const parsed = JSON.parse(stripJsonCodeFence(result.text)) as ParsedClassificationPayload;

    const insertPayload = {
      question_id: question.id,
      current_subject: question.subject,
      current_chapter: question.chapter ?? null,
      current_section: question.section ?? null,
      suggested_subject: parsed.subject?.trim() || null,
      suggested_chapter: parsed.chapter?.trim() || null,
      suggested_section: parsed.section?.trim() || null,
      reason: parsed.reason?.trim() || null,
      model: result.model,
      reporter_email: verifiedUser?.email ?? null,
      user_id: verifiedUser?.id ?? null,
      visitor_id: visitorId
    };

    const { error } = await supabase.from("question_classification_reports").insert(insertPayload);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      suggestedSubject: insertPayload.suggested_subject,
      suggestedChapter: insertPayload.suggested_chapter,
      suggestedSection: insertPayload.suggested_section,
      reason: insertPayload.reason
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: formatUnknownError(error)
      },
      { status: 500 }
    );
  }
}
