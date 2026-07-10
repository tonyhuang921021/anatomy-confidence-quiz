import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import { getActiveAIAccountBan } from "@/lib/aiAccountBan";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import {
  AUTO_CLASSIFICATION_APPROVER,
  autoApplyQuestionClassification
} from "@/lib/questionClassificationAutoApply";
import primaryTagTaxonomy from "@/data/analysisPrimaryTagTaxonomy.json";

type ClassificationReportRequestBody = {
  visitorId?: string;
  accessToken?: string;
  question?: {
    id?: string;
    subject?: string;
    chapter?: string;
    section?: string;
    primaryTag?: string | null;
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
  primaryTag?: string;
  reason?: string;
};

const HOURLY_LIMIT = 8;
const DAILY_LIMIT = 20;
const AI_CLASSIFICATION_USAGE_PREFIX = "AI_CLASSIFICATION:";
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
const PRIMARY_TAGS = primaryTagTaxonomy.primaryTags.map((tag) => ({
  name: tag.name.trim(),
  subject: tag.subject.trim()
}));
const PRIMARY_TAG_BY_NAME = new Map(PRIMARY_TAGS.map((tag) => [tag.name, tag] as const));
const PRIMARY_TAG_CATALOG = Array.from(
  PRIMARY_TAGS.reduce((groups, tag) => {
    const tags = groups.get(tag.subject) ?? [];
    tags.push(tag.name);
    groups.set(tag.subject, tags);
    return groups;
  }, new Map<string, string[]>()).entries()
)
  .map(([subject, tags]) => `${subject}：${tags.join("、")}`)
  .join("\n");

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

function normalizeJsonLikeInput(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function coerceParsedClassificationPayload(value: unknown): ParsedClassificationPayload | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const subject =
    typeof record.subject === "string"
      ? record.subject.trim()
      : typeof record.primary_subject_exact === "string"
        ? record.primary_subject_exact.trim()
        : "";
  const chapter =
    typeof record.chapter === "string"
      ? record.chapter.trim()
      : typeof record.subtopic === "string"
        ? record.subtopic.trim()
        : "";
  const section =
    typeof record.section === "string"
      ? record.section.trim()
      : typeof record.topic === "string"
        ? record.topic.trim()
        : "";
  const primaryTag =
    typeof record.primaryTag === "string"
      ? record.primaryTag.trim()
      : typeof record.primary_tag === "string"
        ? record.primary_tag.trim()
        : section;
  const reason =
    typeof record.reason === "string"
      ? record.reason.trim()
      : typeof record.rationale === "string"
        ? record.rationale.trim()
        : "";

  if (!subject) return null;

  return {
    subject,
    chapter,
    section,
    primaryTag,
    reason
  };
}

function parseClassificationPayload(text: string): ParsedClassificationPayload | null {
  const trimmed = normalizeJsonLikeInput(stripJsonCodeFence(text));
  if (!trimmed) return null;

  const rawCandidates = [trimmed];
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeFenceMatch?.[1]) {
    rawCandidates.unshift(normalizeJsonLikeInput(codeFenceMatch[1]));
  }

  for (const candidate of rawCandidates) {
    try {
      const parsed = coerceParsedClassificationPayload(JSON.parse(candidate));
      if (parsed) return parsed;
    } catch {
      // continue to looser parsing
    }

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = coerceParsedClassificationPayload(JSON.parse(candidate.slice(start, end + 1)));
        if (parsed) return parsed;
      } catch {
        // continue to looser parsing
      }
    }
  }

  const subjectMatch = trimmed.match(/(?:^|\n)\s*(?:subject|科目)\s*["']?\s*[:：]\s*["']?([^\n"'}，,]+)["']?/i);
  const chapterMatch = trimmed.match(/(?:^|\n)\s*(?:chapter|章節)\s*["']?\s*[:：]\s*["']?([^\n"'}]+?)["']?(?=\n|$)/i);
  const sectionMatch = trimmed.match(/(?:^|\n)\s*(?:section|小節)\s*["']?\s*[:：]\s*["']?([^\n"'}]+?)["']?(?=\n|$)/i);
  const primaryTagMatch = trimmed.match(/(?:^|\n)\s*(?:primaryTag|primary_tag|考點分類)\s*["']?\s*[:：]\s*["']?([^\n"'}]+?)["']?(?=\n|$)/i);
  const reasonMatch = trimmed.match(/(?:^|\n)\s*(?:reason|理由)\s*["']?\s*[:：]\s*["']?([\s\S]+?)["']?(?=\n\s*[A-Za-z\u4e00-\u9fff_]+\s*[:：]|\s*$)/i);

  const subject = subjectMatch?.[1]?.trim() ?? "";
  if (!subject) return null;

  return {
    subject,
    chapter: chapterMatch?.[1]?.trim() ?? "",
    section: sectionMatch?.[1]?.trim() ?? "",
    primaryTag: primaryTagMatch?.[1]?.trim() ?? sectionMatch?.[1]?.trim() ?? "",
    reason: reasonMatch?.[1]?.trim() ?? ""
  };
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

async function insertUsageLog(
  supabase: any,
  row: {
    rate_key: string;
    visitor_id?: string | null;
    user_email?: string | null;
    question_id: string;
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    used_at: string;
  }
) {
  const { error } = await supabase.from("ai_explanation_usage_logs").insert(row);
  if (!error) return;

  const fallbackRow = {
    rate_key: row.rate_key,
    visitor_id: row.visitor_id ?? null,
    user_email: row.user_email ?? null,
    question_id: row.question_id,
    model: row.model,
    used_at: row.used_at
  };
  const { error: fallbackError } = await supabase.from("ai_explanation_usage_logs").insert(fallbackRow);
  if (fallbackError) {
    console.error("AI classification usage log skipped:", fallbackError);
  }
}

function buildClassificationPrompt(question: NonNullable<ClassificationReportRequestBody["question"]>) {
  const optionLines = Object.entries(question.options ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}. ${value?.trim()}`)
    .join("\n");

  return [
    "你是台灣醫學系國考題庫整理助手，請幫這一題重新判斷最適合的科目與 primaryTag。",
    `只能從以下科目擇一：${CLASSIFICATION_SUBJECTS}`,
    "primaryTag 必須逐字從下方固定清單擇一，不可自行創造新名稱：",
    PRIMARY_TAG_CATALOG,
    "請優先依核心考點分類，不要只看器官名稱。",
    "請只輸出 JSON，不要輸出 markdown，不要輸出 code block。",
    "",
    "JSON 格式：",
    "{",
    '  "subject": "科目",',
    '  "chapter": "章節",',
    '  "primaryTag": "固定清單中的考點分類",',
    '  "reason": "一句到兩句，簡短說明為什麼這題應該分到這科"',
    "}",
    "",
    `目前題目 id：${question.id ?? ""}`,
    `目前科目：${question.subject ?? ""}`,
    `目前章節：${question.chapter ?? ""}`,
    `目前小節：${question.section ?? ""}`,
    `目前 primaryTag：${question.primaryTag ?? ""}`,
    `testedConcept：${question.testedConcept ?? ""}`,
    `題幹：${question.stem ?? ""}`,
    "選項：",
    optionLines || "無",
    `目前詳解：${question.explanation ?? ""}`
  ].join("\n");
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "分類回報暫時維護中，先讓登入與同步恢復。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

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
    if (!verifiedUser?.id || !verifiedUser.email) {
      return NextResponse.json(
        {
          ok: false,
          message: "請先登入帳號，才能回報此題分類錯誤。"
        },
        { status: 401 }
      );
    }

    const activeBan = await getActiveAIAccountBan(supabase, verifiedUser.email);
    if (activeBan) {
      return NextResponse.json(
        {
          ok: false,
          message: `這個帳號的 AI 功能已被暫停到 ${new Date(activeBan.banned_until).toLocaleString("zh-TW")} 。`
        },
        { status: 429 }
      );
    }
    const visitorId = body?.visitorId?.trim() || null;
    const actorColumn = "user_id" as const;
    const actorValue = verifiedUser.id;

    if (!actorValue) {
      return NextResponse.json(
        {
          ok: false,
          message: "請先登入帳號，才能回報此題分類錯誤。"
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

    const result = await createOpenAIText(buildClassificationPrompt(question), 600);
    const parsed = parseClassificationPayload(result.text);
    if (!parsed?.subject || !parsed.primaryTag) {
      throw new Error("AI 回傳的分類格式不完整，請再試一次。");
    }
    const selectedPrimaryTag = PRIMARY_TAG_BY_NAME.get(parsed.primaryTag.trim());
    if (!selectedPrimaryTag) {
      throw new Error("AI 回傳的 primaryTag 不在固定分類清單，請再試一次。");
    }

    const insertPayload = {
      question_id: question.id,
      current_subject: question.subject,
      current_chapter: question.chapter ?? null,
      current_section: question.primaryTag?.trim() || question.section || null,
      suggested_subject: selectedPrimaryTag.subject,
      suggested_chapter: parsed.chapter?.trim() || null,
      suggested_section: selectedPrimaryTag.name,
      reason: parsed.reason?.trim() || null,
      model: result.model,
      reporter_email: verifiedUser?.email ?? null,
      user_id: verifiedUser?.id ?? null,
      visitor_id: visitorId
    };

    const { data: insertedReport, error } = await supabase
      .from("question_classification_reports")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) throw error;

    const autoApplied = await autoApplyQuestionClassification(supabase, {
      reportId: insertedReport.id,
      questionId: question.id,
      subject: insertPayload.suggested_subject,
      chapter: insertPayload.suggested_chapter,
      section: insertPayload.suggested_section,
      approvedBy: AUTO_CLASSIFICATION_APPROVER
    });

    await insertUsageLog(supabase, {
      rate_key: `ai-classification:${verifiedUser.email.trim().toLowerCase()}`,
      visitor_id: visitorId,
      user_email: verifiedUser.email,
      question_id: `${AI_CLASSIFICATION_USAGE_PREFIX}${question.id}`,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
      used_at: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      suggestedSubject: insertPayload.suggested_subject,
      suggestedChapter: insertPayload.suggested_chapter,
      suggestedSection: insertPayload.suggested_section,
      suggestedPrimaryTag: insertPayload.suggested_section,
      reason: insertPayload.reason,
      appliedAt: autoApplied.appliedAt,
      approvedByEmail: autoApplied.approvedByEmail,
      message: "已回報並依 AI 建議自動套用分類。"
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
