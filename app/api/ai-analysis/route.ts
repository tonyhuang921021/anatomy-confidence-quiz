import { NextRequest, NextResponse } from "next/server";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { createOpenAIAnalysis, isOpenAIConfigured } from "@/lib/openai";
import { generateAIPrompt } from "@/lib/quizAnalysis";
import { QuizSession } from "@/types/quiz";

type AIAnalysisRequestBody = {
  prompt?: string;
  attempts?: QuizSession["attempts"];
  sessions?: QuizSession[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AIAnalysisRequestBody;

  const sessions = body.sessions ?? [];
  const attempts = body.attempts ?? [];
  const prompt =
    body.prompt ||
    generateAIPrompt(attempts, anatomyQuestions, sessions);

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        prompt,
        message: "OPENAI_API_KEY 尚未設定，已先回傳可直接貼到 ChatGPT 的 prompt。"
      },
      { status: 503 }
    );
  }

  try {
    const result = await createOpenAIAnalysis(prompt);
    return NextResponse.json({
      ok: true,
      configured: true,
      prompt,
      model: result.model,
      analysis: result.text
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        prompt,
        message: error instanceof Error ? error.message : "AI 分析失敗。"
      },
      { status: 500 }
    );
  }
}
