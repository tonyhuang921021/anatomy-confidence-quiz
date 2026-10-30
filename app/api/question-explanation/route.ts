import { formatRocDate } from "@/lib/rocDate";
import { hasReviewedExplanation } from "@/lib/reviewedExplanations";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, getOpenAIModel, isOpenAIConfigured } from "@/lib/openai";
import { getActiveAIAccountBan } from "@/lib/aiAccountBan";
import {
  normalizeQuestionExplanationPayload,
  normalizeQuestionOptionAnalysis
} from "@/lib/questionExplanationFormat";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { isServerTimeoutError, withServerTimeout } from "@/lib/serverTimeout";

type QuestionExplanationRequestBody = {
  action?: "generate" | "sync_override" | "sync_overrides";
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
    answerCreditType?: string;
    explanation?: string;
    testedConcept?: string;
  };
  previousQuestion?: {
    id?: string;
    stem?: string;
    options?: Record<string, string | undefined>;
    answer?: string;
    acceptedAnswers?: string[];
    answerCreditType?: string;
    explanation?: string;
    testedConcept?: string;
    sourceLabel?: string;
  };
  attempt?: {
    selectedAnswer?: string;
    confidence?: number;
    isCorrect?: boolean;
  };
  previousOverride?: {
    explanation?: string;
    optionAnalysis?: Record<string, string>;
    memoryTip?: string;
    model?: string;
  };
  override?: {
    questionId?: string;
    explanation?: string;
    optionAnalysis?: Record<string, string>;
    memoryTip?: string;
    model?: string;
    updatedAt?: string;
  };
  overrides?: Array<{
    questionId?: string;
    explanation?: string;
    optionAnalysis?: Record<string, string>;
    memoryTip?: string;
    model?: string;
    updatedAt?: string;
  }>;
};

type ParsedExplanationPayload = {
  explanation?: string;
  optionAnalysis?: Record<string, string>;
  memoryTip?: string;
};

type UsageLogRow = {
  rate_key: string;
  visitor_id?: string | null;
  user_email?: string | null;
  question_id: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  used_at: string;
};

const AI_EXPLANATION_USAGE_PREFIX = "AI_EXPLANATION:";

const HOURLY_LIMIT = 30;
const DAILY_LIMIT = 100;
const MAX_SYNC_OVERRIDES_PER_REQUEST = 50;
const GPT_5_MINI_MAX_OUTPUT_TOKENS = 2400;
const QUESTION_EXPLANATION_MODEL = getOpenAIModel(process.env.QUESTION_EXPLANATION_MODEL);
const QUESTION_EXPLANATION_PROMPT_PREFIX = [
  "用自然、清楚的臺灣繁體中文，幫學習者理解這道國考題。",
  "先說明正解及關鍵判斷，再依題目需要解釋機轉、相近概念與選項差異；篇幅和小標按內容需要安排，不設字數下限或固定延伸數量。",
  "各選項的判斷與能區分的原因放在 optionAnalysis，每個實際存在的選項都要說明。",
  "題庫標籤可能不準，以可信題幹、原始選項、官方答案與判分方式為準。若有一律給分或多個可接受答案，應依實際判分說明。",
  "遇到足以影響判斷的爭議、歷史版本或資訊不足，以具體條件說清楚；不要補造原題缺失或虛構來源與連結。",
  "直接說明知識與機轉，不評論模型、提示詞、寫作過程或稿件；不要根據任何單一使用者的作答情況改變內容。",
  "若附有經核對的相關題資料，參考共同原理，補足理解所需但相關題未提到的內容；正文不以年份、卷別或出題次數決定篇幅。",
  "相關題連結及圖片由網站根據已核對的資料提供，不要在生成內容中自行編造題號、圖片、引用或網址。",
  "若比較表有助理解，可在 explanation 使用簡短 Markdown pipe table；不用為了格式湊表格。",
  "只輸出 JSON，不要輸出 HTML、code block 或 JSON 外文字。explanation 為文字；optionAnalysis 僅包含實際存在的 A、B、C、D、E 選項鍵；memoryTip 沒有則留空字串。",
  '{"explanation":"整題詳解","optionAnalysis":{"A":"A 選項解析","B":"B 選項解析"},"memoryTip":""}'
].join("\n");

function logQuestionExplanationRoute(event: {
  action: QuestionExplanationRequestBody["action"] | "generate";
  status: number;
  durationMs: number;
  questionId?: string | null;
  overrideCount?: number;
  syncedCount?: number;
  hasUser?: boolean;
  error?: string;
}) {
  console.info("question_explanation_route", JSON.stringify(event));
}

function isOptionKey(value: string) {
  return ["A", "B", "C", "D", "E"].includes(value);
}

function getRequiredOptionKeys(options?: Record<string, string | undefined>) {
  return Object.entries(options ?? {})
    .filter(([key, value]) => isOptionKey(key) && typeof value === "string" && value.trim())
    .map(([key]) => key);
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

  return "AI 詳解產生失敗。";
}

function getAllowedBypassEmails() {
  return (process.env.AI_EXPLANATION_BYPASS_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isBypassEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedBypassEmails().includes(email.trim().toLowerCase());
}

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getSupabaseWriteClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    return null;
  }

  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  if (!anonKey || !accessToken) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

async function getVerifiedUserEmail(accessToken?: string) {
  if (!accessToken) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;

  return data.user.email;
}

async function checkAIAccountBan(email?: string | null) {
  const supabase = getSupabaseServerClient();
  if (!supabase || !email) return null;
  return getActiveAIAccountBan(supabase, email);
}

async function checkUsageLimits(rateKey: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [hourResult, dayResult] = await withServerTimeout(Promise.all([
    supabase
      .from("ai_explanation_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("rate_key", rateKey)
      .gte("used_at", hourAgo),
    supabase
      .from("ai_explanation_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("rate_key", rateKey)
      .gte("used_at", dayAgo)
  ]), 1600, "AI 詳解用量檢查逾時");

  const errors = [hourResult.error, dayResult.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  if (hourResult.count == null || dayResult.count == null) throw new Error("AI 詳解用量資料不完整");
  const hourlyCount = hourResult.count;
  const dailyCount = dayResult.count;

  if (hourlyCount >= HOURLY_LIMIT) {
    return {
      blocked: true,
      message: `這個裝置在 1 小時內已使用 ${hourlyCount} 題，已暫時冷卻。請稍後再試。`
    };
  }

  if (dailyCount >= DAILY_LIMIT) {
    return {
      blocked: true,
      message: `這個裝置在 24 小時內已使用 ${dailyCount} 題，已暫時冷卻。請明天再試。`
    };
  }

  return { blocked: false };
}

async function insertUsageLog(row: UsageLogRow, accessToken?: string) {
  const supabase = getSupabaseWriteClient(accessToken);
  if (!supabase) return;

  const { error } = await withServerTimeout(
    supabase.from("ai_explanation_usage_logs").insert(row),
    1800,
    "AI 詳解使用紀錄寫入逾時"
  ).catch((error) => {
    console.error("AI explanation usage log skipped:", error);
    return { error: null };
  });
  if (!error) {
    return;
  }

  const fallbackRow = {
    rate_key: row.rate_key,
    visitor_id: row.visitor_id ?? null,
    user_email: row.user_email ?? null,
    question_id: row.question_id,
    model: row.model,
    used_at: row.used_at
  };
  const { error: fallbackError } = await withServerTimeout(
    supabase.from("ai_explanation_usage_logs").insert(fallbackRow),
    1800,
    "AI 詳解使用紀錄寫入逾時"
  ).catch((error) => {
    console.error("AI explanation usage fallback log skipped:", error);
    return { error: null };
  });
  if (fallbackError) {
    console.error("AI explanation usage log skipped:", fallbackError);
  }
}

async function upsertSharedExplanationOverride(
  questionId: string,
  parsed: ParsedExplanationPayload,
  model: string,
  accessToken?: string,
  updatedAt?: string
) {
  const supabase = getSupabaseWriteClient(accessToken);
  if (!supabase) {
    throw new Error("找不到可寫入共享詳解的 Supabase 憑證。");
  }

  const nextUpdatedAt = updatedAt || new Date().toISOString();
  const nextUpdatedAtTime = Date.parse(nextUpdatedAt);
  const { data: existingRow, error: existingError } = await supabase
    .from("question_explanation_overrides")
    .select("updated_at")
    .eq("question_id", questionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`共享詳解版本檢查失敗：${formatUnknownError(existingError)}`);
  }

  const existingUpdatedAtTime = Date.parse(existingRow?.updated_at ?? "");
  if (
    Number.isFinite(existingUpdatedAtTime) &&
    Number.isFinite(nextUpdatedAtTime) &&
    nextUpdatedAtTime < existingUpdatedAtTime
  ) {
    return false;
  }

  const { error } = await supabase.from("question_explanation_overrides").upsert(
    {
      question_id: questionId,
      explanation: parsed.explanation ?? "",
      option_analysis: parsed.optionAnalysis ?? {},
      memory_tip: parsed.memoryTip ?? "",
      model,
      updated_at: nextUpdatedAt
    },
    { onConflict: "question_id" }
  );

  if (error) {
    throw new Error(`共享詳解寫入失敗：${formatUnknownError(error)}`);
  }

  return true;
}

async function syncSharedExplanationOverrides(
  overrides: NonNullable<QuestionExplanationRequestBody["overrides"]>,
  accessToken?: string
) {
  const normalizedOverrides: Array<{
    questionId: string;
    parsed: ParsedExplanationPayload;
    model: string;
    updatedAt?: string;
  }> = [];

  for (const item of overrides) {
    const questionId = item.questionId?.trim();
    const explanation = item.explanation?.trim();
    if (!questionId || !explanation) continue;

    normalizedOverrides.push({
      questionId,
      parsed: {
        explanation,
        optionAnalysis: normalizeQuestionOptionAnalysis(item.optionAnalysis ?? {}),
        memoryTip: item.memoryTip?.trim() ?? ""
      },
      model: item.model?.trim() || QUESTION_EXPLANATION_MODEL,
      updatedAt: item.updatedAt?.trim() || undefined
    });
  }

  if (normalizedOverrides.length === 0) {
    return 0;
  }

  let syncedCount = 0;
  for (const item of normalizedOverrides) {
    const didSync = await upsertSharedExplanationOverride(
      item.questionId,
      item.parsed,
      item.model,
      accessToken,
      item.updatedAt
    );
    if (didSync) syncedCount += 1;
  }

  return syncedCount;
}

function buildQuestionExplanationPrompt(body: QuestionExplanationRequestBody) {
  const question = body.question;
  const previousQuestion = body.previousQuestion;
  const previousOverride = body.previousOverride;
  const optionKeys = getRequiredOptionKeys(question?.options);
  const correctAnswerText =
    (question?.answerCreditType === "multiple_accepted" ||
      question?.answerCreditType === "multiple_answers") &&
    (question.acceptedAnswers?.length ?? 0) > 0
      ? question.acceptedAnswers?.join(" / ")
      : question?.answer ?? "";

  return [
    QUESTION_EXPLANATION_PROMPT_PREFIX,
    "",
    `科目：${question?.subject ?? ""}`,
    `章節：${question?.chapter ?? ""} / ${question?.section ?? ""}`,
    `題庫考點標籤（可能不準，只能參考）：${question?.testedConcept ?? ""}`,
    "",
    `題目：${question?.stem ?? ""}`,
    "",
    previousQuestion?.stem
      ? [
          "上一題資訊（本題為承上題時請務必一併參考）：",
          `上一題來源：${previousQuestion.sourceLabel ?? ""}`,
          `上一題題號：${previousQuestion.id ?? ""}`,
          `上一題題庫考點標籤（可能不準，只能參考）：${previousQuestion.testedConcept ?? ""}`,
          `上一題題目：${previousQuestion.stem ?? ""}`,
          "上一題選項：",
          ...Object.entries(previousQuestion.options ?? {}).map(
            ([key, value]) => `${key}. ${value ?? ""}`
          ),
          `上一題答案：${
            (previousQuestion.answerCreditType === "multiple_accepted" ||
              previousQuestion.answerCreditType === "multiple_answers") &&
            (previousQuestion.acceptedAnswers?.length ?? 0) > 0
              ? previousQuestion.acceptedAnswers?.join(" / ")
              : previousQuestion.answer ?? ""
          }`,
          `上一題解析：${previousQuestion.explanation ?? ""}`,
          ""
        ].join("\n")
      : "",
    "選項：",
    ...Object.entries(question?.options ?? {}).map(([key, value]) => `${key}. ${value ?? ""}`),
    "",
    `本題實際存在的選項鍵：${optionKeys.join(", ")}`,
    `正確答案：${correctAnswerText}`,
    `判分方式：${question?.answerCreditType ?? "standard"}`,
    "",
    previousOverride?.explanation
      ? [
          "這是重新替換詳解。上一版 GPT 覆蓋詳解如下，只能用來避開重複錯誤；不可照抄上一版句子，也不可只微調同一段文字。",
          `上一版模型：${previousOverride.model ?? ""}`,
          `上一版主詳解：${previousOverride.explanation ?? ""}`,
          "上一版各選項解析：",
          JSON.stringify(previousOverride.optionAnalysis ?? {}, null, 2),
          `上一版記憶法：${previousOverride.memoryTip ?? ""}`,
          "",
          "請輸出新的完整 JSON。主詳解要保留本題核心、判斷邏輯與高相關延伸；各選項解析只放在 optionAnalysis；記憶法只放在 memoryTip。",
          "不要評論上一版，不要寫上一版哪裡不足，輸出內容本身就是可直接替換的新詳解。"
        ].join("\n")
      : "",
    ""
  ].join("\n");
}

function normalizeComparisonText(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：「」『』（）()\[\]{}.,!?;:'"`~\-_/\\|]/g, "");
}

function getSimilarityRatio(a?: string, b?: string) {
  const first = normalizeComparisonText(a);
  const second = normalizeComparisonText(b);
  if (!first || !second) return 0;
  if (first === second) return 1;

  const shorter = first.length <= second.length ? first : second;
  const longer = first.length > second.length ? first : second;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.86) {
    return shorter.length / longer.length;
  }

  return 0;
}

function isTooSimilarToPrevious(
  parsed: ParsedExplanationPayload | null,
  previousOverride?: QuestionExplanationRequestBody["previousOverride"]
) {
  if (!parsed?.explanation || !previousOverride?.explanation) return false;

  const explanationSimilarity = getSimilarityRatio(parsed.explanation, previousOverride.explanation);
  if (explanationSimilarity >= 0.86) return true;

  const currentOptions = JSON.stringify(parsed.optionAnalysis ?? {});
  const previousOptions = JSON.stringify(previousOverride.optionAnalysis ?? {});
  return getSimilarityRatio(currentOptions, previousOptions) >= 0.92;
}

function buildRegenerationRetryPrompt(body: QuestionExplanationRequestBody) {
  return [
    buildQuestionExplanationPrompt(body),
    "",
    "系統檢查：你剛才輸出的新版詳解與上一版太相似，使用者按的是「重新替換詳解」，所以必須真的改寫。",
    "請重新組織主詳解，用不同敘述順序說明核心機轉或判斷邏輯，並補上高相關觸類旁通知識；醫學內容需正確，但不要照抄上一版句子。",
    "各選項解析也請重新撰寫成更像真人老師會留下的判斷理由。",
    "不要指出上一版不足，不要加入自我檢討文字。只輸出可直接替換的 JSON。"
  ].join("\n");
}

function getMissingOptionKeys(
  payload: ParsedExplanationPayload | null,
  options?: Record<string, string | undefined>
) {
  const requiredKeys = getRequiredOptionKeys(options);
  return requiredKeys.filter((key) => !payload?.optionAnalysis?.[key]?.trim());
}

function buildMissingOptionRetryPrompt(
  body: QuestionExplanationRequestBody,
  partial: ParsedExplanationPayload,
  missingKeys: string[]
) {
  const question = body.question;
  const previousQuestion = body.previousQuestion;
  const correctAnswerText =
    (question?.answerCreditType === "multiple_accepted" ||
      question?.answerCreditType === "multiple_answers") &&
    (question.acceptedAnswers?.length ?? 0) > 0
      ? question.acceptedAnswers?.join(" / ")
      : question?.answer ?? "";

  return [
    QUESTION_EXPLANATION_PROMPT_PREFIX,
    "",
    "你上一版的主詳解可沿用，但 optionAnalysis 不完整。",
    `請只補齊缺少的選項解析：${missingKeys.join(", ")}。`,
    "已經有的 optionAnalysis 可以保留原意，但整體仍請輸出完整 JSON；缺少的選項解析要說明為什麼對或為什麼不對，不要只寫正確/錯誤。",
    "不要新增 A-E 以外的 key，不要省略任何實際存在的選項。",
    "",
    `科目：${question?.subject ?? ""}`,
    `章節：${question?.chapter ?? ""} / ${question?.section ?? ""}`,
    `題庫考點標籤（可能不準，只能參考）：${question?.testedConcept ?? ""}`,
    "",
    `題目：${question?.stem ?? ""}`,
    "",
    previousQuestion?.stem
      ? [
          "上一題資訊（本題為承上題時請務必一併參考）：",
          `上一題來源：${previousQuestion.sourceLabel ?? ""}`,
          `上一題題號：${previousQuestion.id ?? ""}`,
          `上一題題庫考點標籤（可能不準，只能參考）：${previousQuestion.testedConcept ?? ""}`,
          `上一題題目：${previousQuestion.stem ?? ""}`,
          "上一題選項：",
          ...Object.entries(previousQuestion.options ?? {}).map(
            ([key, value]) => `${key}. ${value ?? ""}`
          ),
          `上一題答案：${
            (previousQuestion.answerCreditType === "multiple_accepted" ||
              previousQuestion.answerCreditType === "multiple_answers") &&
            (previousQuestion.acceptedAnswers?.length ?? 0) > 0
              ? previousQuestion.acceptedAnswers?.join(" / ")
              : previousQuestion.answer ?? ""
          }`,
          `上一題解析：${previousQuestion.explanation ?? ""}`,
          ""
        ].join("\n")
      : "",
    "選項：",
    ...Object.entries(question?.options ?? {}).map(([key, value]) => `${key}. ${value ?? ""}`),
    "",
    `本題實際存在的選項鍵：${getRequiredOptionKeys(question?.options).join(", ")}`,
    `正確答案：${correctAnswerText}`,
    `判分方式：${question?.answerCreditType ?? "standard"}`,
    "",
    `目前主詳解：${partial.explanation ?? ""}`,
    "",
    "目前已有的 optionAnalysis：",
    JSON.stringify(partial.optionAnalysis ?? {}, null, 2),
    "",
    ""
  ].join("\n");
}

function hasCompleteOptionAnalysis(
  payload: ParsedExplanationPayload | null,
  options?: Record<string, string | undefined>
) {
  if (!payload?.explanation) return false;
  const requiredKeys = getRequiredOptionKeys(options);
  if (requiredKeys.length === 0) return true;
  return requiredKeys.every((key) => Boolean(payload.optionAnalysis?.[key]?.trim()));
}

function coerceParsedPayload(value: unknown): ParsedExplanationPayload | null {
  return normalizeQuestionExplanationPayload(value);
}

function parseExplanationPayload(text: string): ParsedExplanationPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const rawCandidates = [trimmed];
  if (codeFenceMatch?.[1]) rawCandidates.unshift(codeFenceMatch[1].trim());

  for (const candidate of rawCandidates) {
    try {
      const rawParsed = JSON.parse(candidate);
      const parsed = coerceParsedPayload(rawParsed);
      if (parsed) return parsed;
      if (typeof rawParsed === "string" && rawParsed.trim() !== candidate.trim()) {
        const nestedParsed = parseExplanationPayload(rawParsed);
        if (nestedParsed) return nestedParsed;
      }
    } catch {
      // continue to looser parsing
    }

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const rawParsed = JSON.parse(candidate.slice(start, end + 1));
        const parsed = coerceParsedPayload(rawParsed);
        if (parsed) return parsed;
        if (typeof rawParsed === "string") {
          const nestedParsed = parseExplanationPayload(rawParsed);
          if (nestedParsed) return nestedParsed;
        }
      } catch {
        // continue to looser parsing
      }
    }
  }

  const optionAnalysis = Object.fromEntries(
    [...trimmed.matchAll(/(?:^|\n)\s*([A-E])[\.\):：-]\s*([\s\S]*?)(?=(?:\n\s*[A-E][\.\):：-])|(?:\n\s*(?:memoryTip|memory tip|快速記憶法|記憶法)[：:])|$)/gi)]
      .map((match) => [match[1].toUpperCase(), match[2].trim()] as const)
      .filter(([, value]) => Boolean(value))
  );

  const memoryTipMatch = trimmed.match(/(?:memoryTip|memory tip|快速記憶法|記憶法)[：:]\s*([\s\S]+)$/i);
  const memoryTip = memoryTipMatch?.[1]?.trim() ?? "";

  const explanation = trimmed
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/(?:^|\n)\s*(?:memoryTip|memory tip|快速記憶法|記憶法)[：:][\s\S]*$/i, "")
    .replace(/(?:^|\n)\s*[A-E][\.\):：-][\s\S]*$/m, "")
    .trim();

  if (!explanation) return null;

  return {
    explanation,
    optionAnalysis,
    memoryTip
  };
}

/** Read-only configuration probe; never calls the model or exposes credentials. */
export async function GET() {
  return NextResponse.json({ model: QUESTION_EXPLANATION_MODEL, reviewedExplanationsProtected: true },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as QuestionExplanationRequestBody;
  const action = body.action ?? "generate";
  const startedAt = Date.now();

  // The checked-in accepted-edition index is authoritative, never client flags.
  // Guard sync as well as generation before authentication, model calls or writes.
  const targetIds = action === "sync_override"
    ? [body.override?.questionId]
    : action === "sync_overrides"
      ? (body.overrides ?? []).map(item => item.questionId)
      : [body.question?.id];
  if (targetIds.some(id => typeof id === "string" && hasReviewedExplanation(id.trim()))) {
    return NextResponse.json({ ok: false, code: "reviewed_explanation_protected",
      message: "此題已有已審核完整詳解，保留原文與圖片，不開放 AI 重新產生或替換。" },
    { status: 409 });
  }

  if (action === "sync_override" || action === "sync_overrides") {
    if (isSupabaseRecoveryMode()) {
      logQuestionExplanationRoute({
        action,
        status: 200,
        durationMs: Date.now() - startedAt,
        overrideCount: action === "sync_override" ? Number(Boolean(body.override)) : body.overrides?.length ?? 0,
        syncedCount: 0
      });
      return NextResponse.json({
        ok: true,
        configured: true,
        syncedCount: 0,
        deferred: true
      });
    }

    try {
      const userEmail = await getVerifiedUserEmail(body.accessToken);
      if (!userEmail) {
        logQuestionExplanationRoute({
          action,
          status: 401,
          durationMs: Date.now() - startedAt,
          overrideCount: action === "sync_override" ? Number(Boolean(body.override)) : body.overrides?.length ?? 0,
          hasUser: false
        });
        return NextResponse.json(
          {
            ok: false,
            configured: true,
            message: "請先登入帳號，才能同步共享詳解。"
          },
          { status: 401 }
        );
      }

      const overrideList =
        action === "sync_override"
          ? body.override
            ? [body.override]
            : []
          : (body.overrides ?? []);

      if (overrideList.length > MAX_SYNC_OVERRIDES_PER_REQUEST) {
        logQuestionExplanationRoute({
          action,
          status: 413,
          durationMs: Date.now() - startedAt,
          overrideCount: overrideList.length,
          hasUser: true,
          error: "sync_override_batch_too_large"
        });
        return NextResponse.json(
          {
            ok: false,
            configured: true,
            message: `一次最多同步 ${MAX_SYNC_OVERRIDES_PER_REQUEST} 筆共享詳解，請稍後再試。`
          },
          { status: 413 }
        );
      }

      const syncedCount = await syncSharedExplanationOverrides(overrideList, body.accessToken);
      logQuestionExplanationRoute({
        action,
        status: 200,
        durationMs: Date.now() - startedAt,
        overrideCount: overrideList.length,
        syncedCount,
        hasUser: true
      });

      return NextResponse.json({
        ok: true,
        configured: true,
        syncedCount
      });
    } catch (error) {
      logQuestionExplanationRoute({
        action,
        status: 500,
        durationMs: Date.now() - startedAt,
        overrideCount: action === "sync_override" ? Number(Boolean(body.override)) : body.overrides?.length ?? 0,
        error: formatUnknownError(error)
      });
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: formatUnknownError(error)
        },
        { status: 500 }
      );
    }
  }

  if (!body.question?.stem || !body.question?.answer) {
    logQuestionExplanationRoute({
      action,
      status: 400,
      durationMs: Date.now() - startedAt,
      questionId: body.question?.id ?? null,
      error: "missing_question_payload"
    });
    return NextResponse.json(
      { ok: false, message: "題目資料不足，無法產生單題詳解。" },
      { status: 400 }
    );
  }

  if (!isOpenAIConfigured()) {
    logQuestionExplanationRoute({
      action,
      status: 503,
      durationMs: Date.now() - startedAt,
      questionId: body.question.id ?? null,
      error: "openai_not_configured"
    });
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPENAI_API_KEY 尚未設定，無法產生 AI 詳解。"
      },
      { status: 503 }
    );
  }

  try {
    const userEmail = await getVerifiedUserEmail(body.accessToken);
    const visitorId = body.visitorId?.trim() || null;

    if (!userEmail) {
      logQuestionExplanationRoute({
        action,
        status: 401,
        durationMs: Date.now() - startedAt,
        questionId: body.question.id ?? null,
        hasUser: false
      });
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: "請先登入帳號，才能使用 AI 補詳解。"
        },
        { status: 401 }
      );
    }

    const activeBan = await checkAIAccountBan(userEmail);
    if (activeBan && !isBypassEmail(userEmail)) {
      logQuestionExplanationRoute({
        action,
        status: 429,
        durationMs: Date.now() - startedAt,
        questionId: body.question.id ?? null,
        hasUser: true,
        error: "ai_account_banned"
      });
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: `這個帳號的 AI 功能已被暫停到 ${formatRocDate(activeBan.banned_until, {hour:"2-digit",minute:"2-digit"})} 。`
        },
        { status: 429 }
      );
    }

    const fallbackKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateKey = userEmail?.trim().toLowerCase() || visitorId || fallbackKey;

    {
      let usageStatus: Awaited<ReturnType<typeof checkUsageLimits>>;
      try { usageStatus = await checkUsageLimits(rateKey); } catch { usageStatus = null; }
      if (!usageStatus) return NextResponse.json({ok:false,configured:true,message:"目前無法核實使用量，請稍後再試；已保存的詳解仍可閱讀。"},{status:503});
      if (usageStatus?.blocked) {
        const blockedMessage =
          "message" in usageStatus && usageStatus.message
            ? usageStatus.message
            : "這個裝置暫時無法使用 AI 詳解，請稍後再試。";
        logQuestionExplanationRoute({
          action,
          status: 429,
          durationMs: Date.now() - startedAt,
          questionId: body.question.id ?? null,
          hasUser: true,
          error: "usage_limited"
        });
        return NextResponse.json(
          {
            ok: false,
            configured: true,
            message: blockedMessage
          },
          { status: 429 }
        );
      }
    }

    const prompt = buildQuestionExplanationPrompt(body);
    const result = await createOpenAIText(prompt, GPT_5_MINI_MAX_OUTPUT_TOKENS, QUESTION_EXPLANATION_MODEL);
    const parsed = parseExplanationPayload(result.text);

    if (!parsed?.explanation) {
      logQuestionExplanationRoute({
        action,
        status: 500,
        durationMs: Date.now() - startedAt,
        questionId: body.question.id ?? null,
        hasUser: true,
        error: "invalid_ai_payload"
      });
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: "AI 回傳格式不正確，無法儲存單題詳解。"
        },
        { status: 500 }
      );
    }

    await insertUsageLog({
      rate_key: rateKey,
      visitor_id: visitorId,
      user_email: userEmail,
      question_id: `${AI_EXPLANATION_USAGE_PREFIX}${body.question.id ?? body.question.stem.slice(0, 120)}`,
      model: result.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
      used_at: new Date().toISOString()
    }, body.accessToken);

    let sharedSaved = true;
    let sharedSaveMessage: string | undefined;
    try {
      await upsertSharedExplanationOverride(
        body.question.id ?? body.question.stem.slice(0, 120),
        parsed,
        result.model,
        body.accessToken
      );
    } catch (error) {
      sharedSaved = false;
      sharedSaveMessage = formatUnknownError(error);
      console.error("AI explanation shared override save skipped:", error);
    }

    logQuestionExplanationRoute({
      action,
      status: 200,
      durationMs: Date.now() - startedAt,
      questionId: body.question.id ?? null,
      hasUser: true
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      sharedSaved,
      sharedSaveMessage,
      model: result.model,
      explanation: parsed.explanation,
      optionAnalysis: parsed.optionAnalysis ?? {},
      memoryTip: parsed.memoryTip ?? ""
    });
  } catch (error) {
    logQuestionExplanationRoute({
      action,
      status: 500,
      durationMs: Date.now() - startedAt,
      questionId: body.question?.id ?? null,
      error: formatUnknownError(error)
    });
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: formatUnknownError(error)
      },
      { status: 500 }
    );
  }
}
