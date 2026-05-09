import { NextRequest, NextResponse } from "next/server";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import { Question } from "@/types/quiz";

type ReviewQuestionRequestBody = {
  question: Question;
};

function buildReviewPrompt(question: Question) {
  return `你現在是台灣醫學生醫師國考一階解剖學題目審稿助教。請幫我複查下面這題有沒有怪怪的地方。

請用繁體中文回答，並依序輸出：
1. 題目是否合理
2. 有沒有模糊、歧義、錯誤或不夠精準
3. 正確答案是否合理
4. 如果要修改，請給我簡短修正版建議

題目資料：
chapter: ${question.chapter}
section: ${question.section}
stem: ${question.stem}
options:
A. ${question.options.A}
B. ${question.options.B}
C. ${question.options.C}
D. ${question.options.D}
E. ${question.options.E}
answer: ${question.answer}
explanation: ${question.explanation}
testedConcept: ${question.testedConcept}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ReviewQuestionRequestBody;

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPENAI_API_KEY 尚未設定，無法進行題目複查。"
      },
      { status: 503 }
    );
  }

  try {
    const result = await createOpenAIText(buildReviewPrompt(body.question), 900);
    return NextResponse.json({
      ok: true,
      configured: true,
      model: result.model,
      review: result.text
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : "題目複查失敗。"
      },
      { status: 500 }
    );
  }
}
