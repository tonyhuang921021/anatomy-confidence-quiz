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
const GPT_5_MINI_MAX_OUTPUT_TOKENS = 1600;
const QUESTION_EXPLANATION_MODEL = getOpenAIModel(process.env.QUESTION_EXPLANATION_MODEL);
const QUESTION_EXPLANATION_PROMPT_PREFIX = [
  "你是台灣醫學系國考家教，請用繁體中文寫一份好讀、精準、偏精簡的單題解析。",
  "請嚴格只解釋這一題，不要延伸太多無關內容。",
  "主詳解請聚焦題目核心，不要把各選項的細節重複寫進主詳解。",
  "主詳解 explanation 欄位只能放一般文字，絕對不能放 JSON 字串、物件字串或 optionAnalysis 內容。",
  "各選項的重要說明請放在 optionAnalysis。",
  "輸出順序固定為：先 explanation 整題詳解，再 optionAnalysis 各選項解析，最後 memoryTip。",
  "不要根據任何單一使用者的作答情況來改變詳解內容。",
  "請只輸出 JSON，不要輸出 markdown，不要輸出 code block。",
  "請務必為本題每一個實際存在的選項都提供 optionAnalysis，不能漏掉任何一個選項。",
  "optionAnalysis 只能出現 A、B、C、D、E 這些選項鍵，不可以出現 explanation、summary、note 等額外 key。",
  "如果本題是多重給分，請在主詳解中清楚說明任一個可接受答案都算對。",
  "",
  "JSON 格式：",
  "{",
  '  "explanation": "完整詳解",',
  '  "optionAnalysis": {',
  '    "A": "A 選項解析",',
  '    "B": "B 選項解析",',
  '    "C": "C 選項解析",',
  '    "D": "D 選項解析",',
  '    "E": "E 選項解析（若本題有 E）"',
  "  },",
  '  "memoryTip": "簡短記憶法，沒有就留空字串"',
  "}"
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

  const { error } = await supabase.from("question_explanation_overrides").upsert(
    {
      question_id: questionId,
      explanation: parsed.explanation ?? "",
      option_analysis: parsed.optionAnalysis ?? {},
      memory_tip: parsed.memoryTip ?? "",
      model,
      updated_at: updatedAt || new Date().toISOString()
    },
    { onConflict: "question_id" }
  );

  if (error) {
    throw new Error(`共享詳解寫入失敗：${formatUnknownError(error)}`);
  }
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

  for (const item of normalizedOverrides) {
    await upsertSharedExplanationOverride(
      item.questionId,
      item.parsed,
      item.model,
      accessToken,
      item.updatedAt
    );
  }

  return normalizedOverrides.length;
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
    `考點：${question?.testedConcept ?? ""}`,
    "",
    `題目：${question?.stem ?? ""}`,
    "",
    previousQuestion?.stem
      ? [
          "上一題資訊（本題為承上題時請務必一併參考）：",
          `上一題來源：${previousQuestion.sourceLabel ?? ""}`,
          `上一題題號：${previousQuestion.id ?? ""}`,
          `上一題考點：${previousQuestion.testedConcept ?? ""}`,
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
          "請輸出新的完整 JSON。主詳解只放本題核心解析；各選項解析只放在 optionAnalysis；記憶法只放在 memoryTip。",
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
    "請重新組織主詳解，用不同敘述順序說明核心機轉或判斷邏輯；醫學內容需正確，但不要照抄上一版句子。",
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
    "已經有的 optionAnalysis 可以保留原意，但整體仍請輸出完整 JSON。",
    "不要新增 A-E 以外的 key，不要省略任何實際存在的選項。",
    "",
    `科目：${question?.subject ?? ""}`,
    `章節：${question?.chapter ?? ""} / ${question?.section ?? ""}`,
    `考點：${question?.testedConcept ?? ""}`,
    "",
    `題目：${question?.stem ?? ""}`,
    "",
    previousQuestion?.stem
      ? [
          "上一題資訊（本題為承上題時請務必一併參考）：",
          `上一題來源：${previousQuestion.sourceLabel ?? ""}`,
          `上一題題號：${previousQuestion.id ?? ""}`,
          `上一題考點：${previousQuestion.testedConcept ?? ""}`,
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

export async function POST(request: NextRequest) {
  const body = (await request.json()) as QuestionExplanationRequestBody;
  const action = body.action ?? "generate";
  const startedAt = Date.now();

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
          message: `這個帳號的 AI 功能已被暫停到 ${new Date(activeBan.banned_until).toLocaleString("zh-TW")} 。`
        },
        { status: 429 }
      );
    }

    const fallbackKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateKey = userEmail?.trim().toLowerCase() || visitorId || fallbackKey;

    if (!isBypassEmail(userEmail)) {
      const usageStatus = await checkUsageLimits(rateKey).catch((error) => {
        if (isServerTimeoutError(error)) {
          console.warn("AI explanation usage check skipped:", error.message);
          return { blocked: false };
        }
        throw error;
      });
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
    let result = await createOpenAIText(prompt, GPT_5_MINI_MAX_OUTPUT_TOKENS, QUESTION_EXPLANATION_MODEL);
    let parsed = parseExplanationPayload(result.text);

    if (isTooSimilarToPrevious(parsed, body.previousOverride)) {
      const retryPrompt = buildRegenerationRetryPrompt(body);
      result = await createOpenAIText(
        retryPrompt,
        GPT_5_MINI_MAX_OUTPUT_TOKENS,
        QUESTION_EXPLANATION_MODEL
      );
      parsed = parseExplanationPayload(result.text);
    }

    const missingOptionKeys = getMissingOptionKeys(parsed, body.question?.options);
    if (parsed?.explanation && missingOptionKeys.length > 0) {
      const retryPrompt = buildMissingOptionRetryPrompt(body, parsed, missingOptionKeys);
      result = await createOpenAIText(
        retryPrompt,
        GPT_5_MINI_MAX_OUTPUT_TOKENS,
        QUESTION_EXPLANATION_MODEL
      );
      parsed = parseExplanationPayload(result.text);
    }

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

    await upsertSharedExplanationOverride(
      body.question.id ?? body.question.stem.slice(0, 120),
      parsed,
      result.model,
      body.accessToken
    );

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
      sharedSaved: true,
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
