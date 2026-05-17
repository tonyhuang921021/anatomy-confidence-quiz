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

type UsageLogRow = {
  rate_key: string;
  visitor_id?: string | null;
  user_email?: string | null;
  question_id: string;
  model: string;
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
    "",
    "輸出格式：",
    "1. 先直接點出正確答案",
    "2. 用 2-4 段說明核心觀念",
    "3. 逐一簡短說明各選項為什麼對或錯",
    "4. 最後補一段臨床或考試記憶重點",
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

    await insertUsageLog({
      rate_key: rateKey,
      visitor_id: visitorId,
      user_email: userEmail,
      question_id: body.question.id ?? body.question.stem.slice(0, 120),
      model: result.model,
      used_at: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      model: result.model,
      explanation: result.text
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
