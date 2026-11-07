import {figureCaptureAllowed} from "@/lib/figureCaptureGate.cjs";
import {backgroundExplanationResponse} from "@/lib/explanationBackgroundResponse";
import {createReservedReads} from "@/lib/explanationReservedReads";
import { explanationPrefix } from "@/lib/explanationStream";
import {waitUntil} from '@vercel/functions';
import { dispatchReplacementImages } from "@/lib/replacementFigures.cjs";
import {commonsSearch,readBoundedImage} from '@/lib/commonsFigureSource.cjs';
import { imageWindowOpen, buildNeedsWithFallback, IMAGE_PROMPT, processSavedImages } from "@/lib/newExplanationFigures.cjs";
import { createHash } from "node:crypto";
import { captureEnabled } from "@/lib/figureQueueRuntime.cjs";
import reviewedIndex from "@/data/reviewedExplanationIndex.json";
import { handleExplanation, formatAcceptedAnswer } from "@/lib/explanation-orchestrator.cjs";
import { appendTeachingContext, MATH_FORMAT_RULE, INTEGRATED_TEACHING_RULE, PRIVATE_SOURCE_RULE, safeTeachingDraft, validPublicTeaching } from '@/lib/teachingContext';
import { resolveTrustedExplanationQuestion, resolveTrustedRelatedQuestions } from "@/lib/trustedQuestionLoader";
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
  operationId?: string;
  baseVersion?: string;
  action?: "replace" | "generate" | "sync_override" | "sync_overrides";
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
  figureNeeds?: unknown;
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
  INTEGRATED_TEACHING_RULE,
  PRIVATE_SOURCE_RULE,
  MATH_FORMAT_RULE,
  "若附有經核對的相關題資料，將共通機制、易混鑑別、延伸概念及可能變化整合到本題教學，不要只列相關題，也不要提年份、卷別或出題次數；仍補足相關題未提到但理解需要的內容。相關題中的可能原因或部分情況不可泛化成所有病例。",
  "圖片由網站根據已核對的資料提供；內部背景僅供教學整合，不輸出題目連結、題號、年份、圖片、引用或網址。",
  "依內容需要使用段落、粗體、條列或 Markdown 表格；只有比較多個機轉、條件或選項確實更清楚時才用表格，不要求每題有表格、延伸段落或圖片，不為湊格式切碎論述。",
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

  const hourlyCount = hourResult.count ?? 0;
  const dailyCount = dayResult.count ?? 0;

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

function compactTextLength(value?: string) {
  return (value ?? "").replace(/\s+/g, "").length;
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
  const correctAnswerText = formatAcceptedAnswer(question);

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
  const parsed = normalizeQuestionExplanationPayload(value);
  return parsed ? {...parsed, figureNeeds: (value as Record<string, unknown>).figureNeeds} : parsed;
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
  return NextResponse.json({ model: QUESTION_EXPLANATION_MODEL, reviewedExplanationsProtected: true, explicitReplacementAvailable: true },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let body: QuestionExplanationRequestBody;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw,"utf8") > 65536) return NextResponse.json({ok:false,code:"request_too_large"},{status:413});
    body = JSON.parse(raw) as QuestionExplanationRequestBody;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
  }
  catch { return NextResponse.json({ ok:false, code:"invalid_request", message:"請求格式不正確。" }, {status:400}); }
  // Preserve protection before sync rejection and before any writes or calls.
  const action = body.action ?? "generate";
  const targetIds = action === "sync_override" ? [body.override?.questionId]
    : action === "sync_overrides" && Array.isArray(body.overrides) ? body.overrides.map(x => x?.questionId)
    : [body.question?.id];
  if (action !== "replace" && targetIds.some(id => typeof id === "string" && hasReviewedExplanation(id.trim()))) {
    return NextResponse.json({ok:false,code:"reviewed_explanation_protected",message:"此題已有已審核完整詳解，保留原文與圖片。"},{status:409});
  }
  if (action === "sync_override" || action === "sync_overrides") {
    if (isSupabaseRecoveryMode()) return NextResponse.json({ok:true,configured:true,syncedCount:0,deferred:true});
    const db=getSupabaseServerClient();
    if (!db || !body.accessToken) return NextResponse.json({ok:false,code:"authentication_required",message:"請先登入後同步詳解。"},{status:401});
    try {
      const auth=await withServerTimeout(db.auth.getUser(body.accessToken),1600,"登入驗證逾時");
      if (auth.error || !auth.data.user?.id || !auth.data.user.email) return NextResponse.json({ok:false,code:"authentication_required",message:"登入狀態無法確認，請重新登入。"},{status:401});
      const items=action === "sync_override" ? (body.override ? [body.override] : []) : (Array.isArray(body.overrides) ? body.overrides : []);
      if (items.length > MAX_SYNC_OVERRIDES_PER_REQUEST) return NextResponse.json({ok:false,code:"sync_batch_too_large",message:`一次最多同步 ${MAX_SYNC_OVERRIDES_PER_REQUEST} 筆。`},{status:413});
      const rows=items.map(item=>({question_id:item.questionId?.trim(),explanation:item.explanation?.trim(),option_analysis:normalizeQuestionOptionAnalysis(item.optionAnalysis ?? {}),memory_tip:item.memoryTip?.trim() ?? "",model:item.model?.trim() || QUESTION_EXPLANATION_MODEL}));
      if (rows.some(item=>!item.question_id || !item.explanation)) return NextResponse.json({ok:false,code:"invalid_sync",message:"同步資料不完整。"},{status:400});
      const result=await withServerTimeout(db.rpc("ai_guard_sync_batch",{p_actor:auth.data.user.id,p_rows:rows}),1600,"同步狀態無法確認");
      const row=Array.isArray(result.data) ? result.data[0] : result.data;
      if (result.error || !row) return NextResponse.json({ok:false,code:"sync_unavailable",recoverable:true,message:"同步暫時不可用，既有詳解不受影響。"},{status:503});
      if (row.status === "reviewed_protected") return NextResponse.json({ok:false,code:"reviewed_explanation_protected",message:"此題已有已審核完整詳解。"},{status:409});
      if (row.status === "existing_conflict") return NextResponse.json({ok:false,code:"existing_explanation_conflict",message:"已有不同的共享詳解，未覆寫原內容。"},{status:409});
      if (row.status !== "ok" || !Number.isInteger(row.inserted) || !Number.isInteger(row.unchanged)) return NextResponse.json({ok:false,code:"sync_unavailable",message:"同步資料無法驗證。"},{status:503});
      return NextResponse.json({ok:true,configured:true,syncedCount:row.inserted+row.unchanged,insertedCount:row.inserted,unchangedCount:row.unchanged});
    } catch { return NextResponse.json({ok:false,code:"sync_unavailable",recoverable:true,message:"同步暫時不可用，既有詳解不受影響。"},{status:503}); }
  }
  if (action !== "generate" && action !== "replace") return NextResponse.json({ok:false,code:"unsupported_action"},{status:400});
  // Neither a missing service role, an unverified credit scope nor an absent
  // price ceiling is permission to send a paid request.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const promoVerified = process.env.QUESTION_EXPLANATION_PROMO_VERIFIED === "true";
  const mode = process.env.QUESTION_EXPLANATION_REASONING_EFFORT || "default";
  const model = process.env.QUESTION_EXPLANATION_MODEL;
  const pricingRevision = process.env.QUESTION_EXPLANATION_PRICING_REVISION;
  const inRate = Number(process.env.QUESTION_EXPLANATION_INPUT_MICROUSD_PER_MILLION);
  const outRate = Number(process.env.QUESTION_EXPLANATION_OUTPUT_MICROUSD_PER_MILLION);
  if (!url || !(serviceRole || anonKey)) {
    return NextResponse.json({ok:false,code:"safe_configuration_missing",message:"AI 詳解暫時不可用，既有詳解不受影響。"},{status:503});
  }
  const db = createClient(url, serviceRole || anonKey!, {auth:{persistSession:false,autoRefreshToken:false}});
  const replacing=action==="replace";
  let replacementReservationAttempted=false;
  const newFigures=process.env.NEW_EXPLANATION_FIGURES_CAPTURE === "1" && imageWindowOpen(process.env) && await figureCaptureAllowed(db);
  let figureQueue=!replacing && !newFigures && captureEnabled(process.env,url) && imageWindowOpen(process.env) && await figureCaptureAllowed(db);
  let actorId = "", verifiedEmail = "";
  // Source commit identifies the reviewed index, independently of deployment commit.
  // Keep it while the verified index is identical; change it only with an atomic,
  // verified snapshot update before enabling the corresponding deployment.
  const reviewedSourceCommit = "f379b49497467abc02d9203228d1956d13565eae";
  const reviewedManifestSha = createHash("sha256").update(JSON.stringify(Object.keys(reviewedIndex).sort()),"utf8").digest("hex");
  let canonicalPrompt = "";
  const requestStarted=Date.now();let delivery:any=null;
  const stages:Record<string,number>={};
  const measured=async<T,>(name:string,work:()=>Promise<T>):Promise<T>=>{const started=Date.now();try{return await work()}finally{stages[name]=(stages[name]||0)+Date.now()-started}};
  let sharedReads=0;
  const reservedReads=createReservedReads(async(id:string)=>measured(++sharedReads===1?"initialSharedMs":"postReserveSharedMs",async()=>{
    const {data,error}=await withServerTimeout(db.from("question_explanation_overrides")
      .select("question_id,explanation,option_analysis,memory_tip,model,updated_at,reading_format")
      .eq("question_id",id).maybeSingle(),1600,"共享詳解讀取逾時");
    if(error)throw error;
    return data?{explanation:data.explanation,optionAnalysis:data.option_analysis??{},memoryTip:data.memory_tip??"",model:data.model,readingFormat:data.reading_format??null,updatedAt:data.updated_at}:null;
  }));
  const reserveRequest=async({actorId:actor,questionId,operationId,baseVersion}:{actorId:string;questionId:string;operationId?:string;baseVersion?:string})=>{
        const runUntil=Date.parse(process.env.QUESTION_EXPLANATION_RUN_UNTIL || "");
        if(!Number.isFinite(runUntil))return {ok:false,code:"safe_configuration_missing"};
        if(Date.now()>=runUntil)return {ok:false,code:"run_window_expired"};
        if (!serviceRole || !isOpenAIConfigured() || !promoVerified || !["gpt-6.1-sol","gpt-6.1-terra"].includes(model || "") || (model === "gpt-6.1-terra" && mode !== "default") ||
            !["low","default"].includes(mode) || !pricingRevision || !Number.isSafeInteger(inRate) || inRate <= 0 ||
            !Number.isSafeInteger(outRate) || outRate <= 0) return {ok:false,code:"safe_configuration_missing"};
        // Do not use the legacy helper's missing-table fail-open behaviour.
        const banQuery = await measured("accountCheckMs",()=>withServerTimeout(db.from("ai_account_bans").select("banned_until")
          .eq("user_email",verifiedEmail).maybeSingle(),1600,"帳號限制查詢逾時"));
        if (banQuery.error) return {ok:false,code:"guard_unavailable"};
        if (banQuery.data?.banned_until) {
          const until = Date.parse(banQuery.data.banned_until);
          if (!Number.isFinite(until)) return {ok:false,code:"guard_unavailable"};
          if (until > Date.now() && !isBypassEmail(verifiedEmail)) return {ok:false,code:"account_banned"};
        }
        if(figureQueue && (!imageWindowOpen(process.env)||!await figureCaptureAllowed(db)))figureQueue=false;
        const id = operationId || crypto.randomUUID();
        if(operationId)replacementReservationAttempted=true;
        const {data,error} = await measured("reserveMs",()=>withServerTimeout(db.rpc(operationId ? "ai_guard_reserve_replacement" : figureQueue ? "figure_guard_reserve" : "ai_guard_reserve",{p_id:id,p_actor:actor,p_question:questionId,p_manifest_sha256:reviewedManifestSha,p_source_commit:reviewedSourceCommit,...(operationId?{p_base_version:baseVersion}:{})}),1600,"預算預留逾時"));
        if (error || data !== "reserved") {if(operationId && !error && typeof data==="string")replacementReservationAttempted=false;return {ok:false,code:typeof data === "string" ? data : "reservation_unavailable"};}
        // Reservation is committed. These independent reads run together;
        // neither is skipped, and start_call still follows full grant validation.
        const fetched = await (operationId ? (work:()=>Promise<any>)=>work() : (work:()=>Promise<any>)=>reservedReads.confirmAndRead(questionId,work))(()=>measured("grantReadMs",()=>withServerTimeout(db.rpc("ai_guard_read_reservation",{p_id:id,p_actor:actor}),1600,"預留驗證逾時")));
        const row = Array.isArray(fetched.data) ? fetched.data[0] : fetched.data;
        if (fetched.error || !row || row.model !== model || row.pricing_revision !== pricingRevision) return {ok:false,code:"reservation_unconfirmed_held"};
        // Token count cannot exceed UTF-8 bytes for normal encoded text. The
        // configured rates must be conservative for the actual provider tier.
        const inputBound = 16000 * inRate, outputBound = 2400 * outRate;
        if (!Number.isSafeInteger(inputBound) || !Number.isSafeInteger(outputBound) ||
            !Number.isSafeInteger(inputBound + outputBound)) return {ok:false,code:"price_ceiling_unconfirmed_held"};
        const worst = Math.ceil((inputBound + outputBound) / 1_000_000);
        const ceiling = Number(row.per_call_ceiling_microusd);
        if (!Number.isSafeInteger(worst) || !Number.isSafeInteger(ceiling) || ceiling < worst) return {ok:false,code:"price_ceiling_unconfirmed_held"};
        return {ok:true,leaseId:id,fence:id,actorId:actor,model,mode,maxCalls:1,ceiling};
  };
  const replacementValue=(row:any)=>({explanation:row.explanation,optionAnalysis:row.option_analysis??{},memoryTip:row.memory_tip??"",model:row.model,updatedAt:row.updated_at,replacementRevision:row.replacement_revision,readingFormat:row.reading_format??null});
  const wantsStream=request.headers.get("accept")?.includes("text/event-stream");
  let emit: (event:any)=>void = ()=>{};
  const run=async()=>{
  try {
    const outcome = await handleExplanation(body, {
      isReviewed: async (id: string) => hasReviewedExplanation(id),
      auth: async (token: string | undefined) => {
        if (!token) return null;
        const {data,error} = await measured("authMs",()=>withServerTimeout(db.auth.getUser(token),1600,"登入驗證逾時"));
        if (error || !data.user?.id || !data.user.email) return null;
        actorId = data.user.id;
        verifiedEmail = data.user.email.trim().toLowerCase();
        return {id:actorId};
      },
      resolveTrusted: async (id: string) => {
        const resolveStart=Date.now();const found = resolveTrustedExplanationQuestion(id);stages.trustedQuestionMs=Date.now()-resolveStart;
        if (!found.ok) return null;
        const q = found.question;
        // Mark restrictions without blocking access to an existing shared row.
        return {...q,trustedContext:found.sharedContext,requiresContext:found.requiresContext,
          hasUnresolvedImage:Boolean(q.stemImage || (q.optionImages && Object.values(q.optionImages).some(Boolean)))};
      },
      prepare: async (q:any) => {
        const prepareStart=Date.now();const trustedContext = q.trustedContext;
        canonicalPrompt = buildQuestionExplanationPrompt({question:{...q,stem:trustedContext ? `${trustedContext}\n\n${q.stem}` : q.stem}});
        if (newFigures) canonicalPrompt += "\n" + IMAGE_PROMPT;
        const related = resolveTrustedRelatedQuestions(q.id);
        canonicalPrompt = appendTeachingContext(canonicalPrompt,related);
        stages.promptPrepareMs=Date.now()-prepareStart;return Buffer.byteLength(canonicalPrompt,"utf8") <= 16000;
      },
      readShared: reservedReads.read,
      reserve: reserveRequest,
      reserveReplacement: reserveRequest,
      readReplacement: async ({actorId:actor,questionId,operationId}:any)=>{
        const {data,error}=await withServerTimeout(db.rpc("explanation_replacement_status",{p_actor:actor,p_question:questionId,p_operation:operationId}),1600,"替換狀態讀取逾時");
        if(error||!data)throw Error("replacement status unavailable");
        if(data.status==="not_found")return null;
        if(data.status==="not_written")return {state:"not_written"};
        return data.status==="completed"?{state:"completed",value:replacementValue(data.value)}:{state:"pending"};
      },
      commitReplacement: async (g:any,id:string,result:any)=>{
        const captureNow=newFigures && imageWindowOpen(process.env) && await figureCaptureAllowed(db);
        const {data,error}=await measured("commitMs",()=>withServerTimeout(db.rpc("ai_guard_commit_replacement",{p_id:g.leaseId,p_actor:actorId,p_explanation:result.explanation,p_option_analysis:result.optionAnalysis,p_memory_tip:result.memoryTip??"",p_needs:captureNow?buildNeedsWithFallback(result.explanation,result.figureNeeds,(resolveTrustedExplanationQuestion(id) as any).question):null}),1600,"替換儲存狀態未確認"));
        if(error||!data)return null;
        if(data.status==="replacement_version_changed")return {conflict:true};
        if(data.status!=="replaced"||data.value?.question_id!==id||data.value?.replacement_revision!==g.leaseId)return null;
        return {winner:{...replacementValue(data.value),figureQueued:data.figureQueued===true,figureTextHash:createHash("sha256").update(data.value.explanation,"utf8").digest("hex")}};
      },
      cancelIfShared: async (g:any) => {
        const {data,error} = await withServerTimeout(db.rpc(figureQueue ? "figure_guard_cancel_if_cached" : "ai_guard_cancel_if_cached",{p_id:g.leaseId,p_actor:actorId}),1600,"預留取消逾時");
        return !error && data === "cancelled";
      },
      start: async (g:any, seq:number) => {
        const {data,error} = await measured("startMs",()=>withServerTimeout(db.rpc("ai_guard_start_call",{p_id:g.leaseId,p_seq:seq}),1600,"預算啟動逾時"));
        return !error && data === "started";
      },
      markUnknown: async (g:any, seq:number) => {
        const {data,error} = await withServerTimeout(db.rpc("ai_guard_mark_unknown",{p_id:g.leaseId,p_seq:seq}),1600,"安全停止逾時");
        return !error && data === "disabled_held";
      },
      callProvider: async (args:any) => {
        const providerStart=Date.now();
        let raw="",last="",firstTextMs:number|null=null;
        const result = await createOpenAIText(canonicalPrompt,2400,args.model,args.mode,wantsStream ? delta=>{
          raw+=delta;if(raw.length>100000)throw Error("Provider output too large");
          const text=safeTeachingDraft(explanationPrefix(raw));
          if(text && text!==last){last=text;firstTextMs ??= Date.now()-requestStarted;emit({type:"draft",text,firstTextMs});}
        } : undefined);
        delivery={firstTextMs,providerMs:Date.now()-providerStart,preProviderMs:providerStart-requestStarted,model:result.servedModel,inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens};
        const parseStart=Date.now();const parsed=parseExplanationPayload(result.text);const value=validPublicTeaching(parsed)?parsed:null;stages.payloadParseMs=Date.now()-parseStart;
        return {usage:result.usageKnown && result.servedModel === args.model ? result.usage : null,value};
      },
      settle: async (g:any, seq:number, usage:any) => {
        // A provider-side bound violation makes the estimate unsafe for every
        // request. Disable further calls and hold this started call for reconciliation.
        if (usage.inputTokens > 16000 || usage.outputTokens > 2400) {
          const stopped = await withServerTimeout(db.rpc("ai_guard_disable",{p_reason:"usage_over_ceiling"}),1600,"安全停止逾時");
          if (stopped.error || stopped.data !== "disabled") throw new Error("安全停止未確認，請立即人工停用並對帳。");
          return false;
        }
        // Reserve and account full per-call ceiling, not a speculative discount.
        const {data,error} = await measured("settleMs",()=>withServerTimeout(db.rpc("ai_guard_settle_call",{p_id:g.leaseId,p_seq:seq,p_cost:g.ceiling,p_input:usage.inputTokens,p_output:usage.outputTokens}),1600,"用量結算逾時"));
        return !error && data === "settled";
      },
      insertIfAbsentFenced: async (g:any, id:string, result:any) => {
        const captureNow=newFigures && imageWindowOpen(process.env) && await figureCaptureAllowed(db);
        const legacyCapture=figureQueue && imageWindowOpen(process.env) && await figureCaptureAllowed(db);
        const {data,error} = await measured("commitMs",()=>withServerTimeout(db.rpc(captureNow ? "figure_guard_commit_new_images" : legacyCapture ? "figure_guard_commit" : "ai_guard_commit",{p_id:g.leaseId,p_actor:actorId,p_explanation:result.explanation,p_option_analysis:result.optionAnalysis,p_memory_tip:result.memoryTip ?? "",...(captureNow ? {p_needs:buildNeedsWithFallback(result.explanation,result.figureNeeds,resolveTrustedExplanationQuestion(id).ok ? (resolveTrustedExplanationQuestion(id) as any).question : null)} : {})}),1600,"共享詳解寫入逾時"));
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row || row.question_id !== id || !["inserted","existing"].includes(row.status)) return null;
        // Text is already durably saved. Image failure never retries paid generation.
        if(row.status==='inserted'&&captureNow){const trusted=resolveTrustedExplanationQuestion(id);if(trusted.ok)waitUntil(processSavedImages({db,question:trusted.question,actor:actorId,search:commonsSearch,loadImage:readBoundedImage,enabled:process.env.NEW_EXPLANATION_FIGURES_WORKER==='1'&&imageWindowOpen(process.env)}));}
        // RPC signature stays compatible with existing queue wrappers. Read the committed marker,
        // never accept a provider/client-supplied format. Failed read is unknown, not a new generation.
        const confirmed=await db.from("question_explanation_overrides").select("question_id,explanation,option_analysis,memory_tip,model,updated_at,reading_format").eq("question_id",id).maybeSingle();
        if(confirmed.error || !confirmed.data || confirmed.data.explanation!==row.explanation)return null;
        return {inserted:row.status === "inserted",winner:{explanation:row.explanation,optionAnalysis:row.option_analysis ?? {},memoryTip:row.memory_tip ?? "",model:row.model,updatedAt:confirmed.data.updated_at,readingFormat:confirmed.data.reading_format??null}};
      },
      close: async (g:any) => {
        const {data,error} = await measured("closeMs",()=>withServerTimeout(db.rpc(figureQueue ? "figure_guard_close" : "ai_guard_close",{p_id:g.leaseId}),1600,"預留結束逾時"));
        if (error || data !== "closed") throw new Error("預留結束未確認，請稍後由管理員對帳。");
      }
    });
    const messages: Record<string,string> = {
      replacement_version_changed:"詳解已被更新，保留較新的版本；請重新確認後再操作。",
      replacement_pending:"先前替換仍在確認中，不會重複生成。",
      replacement_unavailable:"替換功能尚未啟用，原詳解仍可閱讀。",
      invalid_id:"題號不足，無法產生詳解。", authentication_required:"請登入後再使用。",
      untrusted_question:"此題尚無可驗證的官方或站內來源，不會使用客戶端題文生成。",
      trusted_context_missing:"此題缺少可驗證的承上題情境。", source_image_not_supported:"此題需要原圖判讀，請先使用原題及既有詳解。",
      incomplete_explanation:"詳解未包含所有選項，未儲存，請稍後再試。",
      run_window_expired:"本次詳解開放期限已到，既有詳解仍可閱讀。",
      unavailable:"詳解生成的信用核實或安全設定目前不可用，既有詳解仍可閱讀。",
      safe_configuration_missing:"詳解生成的信用核實或安全設定目前不可用，既有詳解仍可閱讀。",
      budget:"本次網站設定的生成額度不足以開始新請求，既有詳解仍可閱讀。", question_busy:"此題正在產生，請稍後再試。",
      actor_busy:"此帳號已有請求進行中。", cooldown:"請稍後再試。", rate:"目前使用次數已達限制，請稍後再試。"
    };
    if (outcome.status === 200 && outcome.value) {
      if(replacing){const trusted=resolveTrustedExplanationQuestion(body.question?.id);if(trusted.ok)dispatchReplacementImages({enabled:process.env.NEW_EXPLANATION_FIGURES_WORKER==='1'&&process.env.NEW_EXPLANATION_FIGURES_CAPTURE==='1'&&imageWindowOpen(process.env),outcome,operationId:body.operationId,question:trusted.question,schedule:waitUntil,processImages:({question,requestId,explanationHash}:any)=>processSavedImages({db,question,actor:actorId,search:async(q:string)=>{if(!imageWindowOpen(process.env))throw Error("image window ended");return commonsSearch(q)},loadImage:async(url:string)=>{if(!imageWindowOpen(process.env))throw Error("image window ended");return readBoundedImage(url)},enabled:true,requestId,explanationHash})});}

      // Final success is emitted only after usage settlement and durable text commit.
      // Images continue independently via waitUntil above.
      const timing={...delivery,stages,responseMs:Date.now()-requestStarted,source:outcome.code,region:process.env.VERCEL_REGION||"unknown"};
      // No actor, token, question text or provider credentials in operational timings.
      console.info("question_explanation_timing",JSON.stringify({questionId:body.question?.id,...timing}));
      return NextResponse.json({ok:true,configured:true,sharedSaved:true,...outcome.value,delivery:timing});
    }
    return NextResponse.json({ok:false,code:outcome.code,recoverable:true,message:messages[outcome.code] || "暫時無法產生詳解，既有詳解不受影響。"},{status:outcome.status});
  } catch (error) {
    console.error("question_explanation_safe_candidate_error",error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ok:false,code:replacing && replacementReservationAttempted?"replacement_unconfirmed_held":"guard_unavailable",recoverable:true,message:"詳解暫時不可用，既有內容不受影響。"},{status:503});
  }
  };
  return backgroundExplanationResponse(nextEmit=>{emit=nextEmit;return run()},waitUntil,Boolean(wantsStream));
}

// Bounds generation and the capped background image lookup.
export const maxDuration = 120;
