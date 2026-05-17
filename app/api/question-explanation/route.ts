import { NextRequest, NextResponse } from "next/server";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";

type QuestionExplanationRequestBody = {
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
    const prompt = buildQuestionExplanationPrompt(body);
    const result = await createOpenAIText(prompt, 1400, "gpt-5-mini");

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
