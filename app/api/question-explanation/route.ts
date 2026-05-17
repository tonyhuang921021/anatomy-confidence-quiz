import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";

type QuestionExplanationRequestBody = {
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
    explanation?: string;
    testedConcept?: string;
  };
  attempt?: {
    selectedAnswer?: string;
    confidence?: number;
    isCorrect?: boolean;
  };
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

const HOURLY_LIMIT = 30;
const DAILY_LIMIT = 100;

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

async function getVerifiedUserEmail(accessToken?: string) {
  if (!accessToken) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;

  return data.user.email;
}

async function checkUsageLimits(rateKey: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [hourResult, dayResult] = await Promise.all([
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
  ]);

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

async function insertUsageLog(row: UsageLogRow) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("ai_explanation_usage_logs").insert(row);
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
  const { error: fallbackError } = await supabase.from("ai_explanation_usage_logs").insert(fallbackRow);
  if (fallbackError) {
    throw fallbackError;
  }
}

async function upsertSharedExplanationOverride(
  questionId: string,
  parsed: ParsedExplanationPayload,
  model: string
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("question_explanation_overrides").upsert(
    {
      question_id: questionId,
      explanation: parsed.explanation ?? "",
      option_analysis: parsed.optionAnalysis ?? {},
      memory_tip: parsed.memoryTip ?? "",
      model,
      updated_at: new Date().toISOString()
    },
    { onConflict: "question_id" }
  );

  if (error) {
    throw error;
  }
}

function buildQuestionExplanationPrompt(body: QuestionExplanationRequestBody) {
  const question = body.question;
  const attempt = body.attempt;

  return [
    "你是台灣醫學系國考家教，請用繁體中文寫一份詳盡但好讀的單題解析。",
    "請嚴格只解釋這一題，不要延伸太多無關內容。",
    "請只輸出 JSON，不要輸出 markdown，不要輸出 code block。",
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
    "}",
    "",
    `科目：${question?.subject ?? ""}`,
    `章節：${question?.chapter ?? ""} / ${question?.section ?? ""}`,
    `考點：${question?.testedConcept ?? ""}`,
    "",
    `題目：${question?.stem ?? ""}`,
    "",
    "選項：",
    ...Object.entries(question?.options ?? {}).map(([key, value]) => `${key}. ${value ?? ""}`),
    "",
    `正確答案：${question?.answer ?? ""}`,
    `使用者答案：${attempt?.selectedAnswer ?? "未作答"}`,
    `使用者信心：${attempt?.confidence ?? "未提供"}`,
    `是否答對：${attempt?.isCorrect ? "答對" : "答錯"}`,
    "",
    `現有解析：${question?.explanation ?? ""}`
  ].join("\n");
}

function normalizeOptionAnalysis(value: unknown) {
  if (!value || typeof value !== "object") return {};

  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const key = typeof record.option === "string" ? record.option.trim().toUpperCase() : "";
          const text =
            typeof record.analysis === "string"
              ? record.analysis.trim()
              : typeof record.text === "string"
                ? record.text.trim()
                : "";
          if (!key || !text) return null;
          return [key, text] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry))
    );
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        if (typeof item !== "string") return null;
        const normalizedKey = key.trim().toUpperCase();
        const normalizedValue = item.trim();
        if (!normalizedKey || !normalizedValue) return null;
        return [normalizedKey, normalizedValue] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

function coerceParsedPayload(value: unknown): ParsedExplanationPayload | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const explanation =
    typeof record.explanation === "string"
      ? record.explanation.trim()
      : typeof record.detailExplanation === "string"
        ? record.detailExplanation.trim()
        : typeof record.analysis === "string"
          ? record.analysis.trim()
          : "";

  const memoryTip =
    typeof record.memoryTip === "string"
      ? record.memoryTip.trim()
      : typeof record.memory_tip === "string"
        ? record.memory_tip.trim()
        : "";

  const optionAnalysis = normalizeOptionAnalysis(
    record.optionAnalysis ?? record.option_analysis ?? record.options
  );

  if (!explanation) return null;

  return {
    explanation,
    optionAnalysis,
    memoryTip
  };
}

function parseExplanationPayload(text: string): ParsedExplanationPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const rawCandidates = [trimmed];
  if (codeFenceMatch?.[1]) rawCandidates.unshift(codeFenceMatch[1].trim());

  for (const candidate of rawCandidates) {
    try {
      const parsed = coerceParsedPayload(JSON.parse(candidate));
      if (parsed) return parsed;
    } catch {
      // continue to looser parsing
    }

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = coerceParsedPayload(JSON.parse(candidate.slice(start, end + 1)));
        if (parsed) return parsed;
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

  if (!body.question?.stem || !body.question?.answer) {
    return NextResponse.json(
      { ok: false, message: "題目資料不足，無法產生單題詳解。" },
      { status: 400 }
    );
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPENAI_API_KEY 尚未設定，無法產生 GPT-5-mini 詳解。"
      },
      { status: 503 }
    );
  }

  try {
    const userEmail = await getVerifiedUserEmail(body.accessToken);
    const visitorId = body.visitorId?.trim() || null;

    if (!userEmail) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: "請先登入帳號，才能使用 GPT-5-mini 補詳解。"
        },
        { status: 401 }
      );
    }

    const fallbackKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rateKey = userEmail?.trim().toLowerCase() || visitorId || fallbackKey;

    if (!isBypassEmail(userEmail)) {
      const usageStatus = await checkUsageLimits(rateKey);
      if (usageStatus?.blocked) {
        return NextResponse.json(
          {
            ok: false,
            configured: true,
            message: usageStatus.message
          },
          { status: 429 }
        );
      }
    }

    const prompt = buildQuestionExplanationPrompt(body);
    const result = await createOpenAIText(prompt, 1400, "gpt-5-mini");
    const parsed = parseExplanationPayload(result.text);

    if (!parsed?.explanation) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          message: "GPT-5-mini 回傳格式不正確，無法儲存單題詳解。"
        },
        { status: 500 }
      );
    }

    await insertUsageLog({
      rate_key: rateKey,
      visitor_id: visitorId,
      user_email: userEmail,
      question_id: body.question.id ?? body.question.stem.slice(0, 120),
      model: result.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
      used_at: new Date().toISOString()
    });

    await upsertSharedExplanationOverride(
      body.question.id ?? body.question.stem.slice(0, 120),
      parsed,
      result.model
    );

    return NextResponse.json({
      ok: true,
      configured: true,
      model: result.model,
      explanation: parsed.explanation,
      optionAnalysis: parsed.optionAnalysis ?? {},
      memoryTip: parsed.memoryTip ?? ""
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : "GPT-5-mini 詳解產生失敗。"
      },
      { status: 500 }
    );
  }
}
