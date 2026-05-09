import { NextRequest, NextResponse } from "next/server";
import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import { Question, QuizSettings } from "@/types/quiz";

type GenerateQuestionRequestBody = {
  settings?: Partial<QuizSettings>;
  usedQuestionIds?: string[];
  usedConcepts?: string[];
  count?: number;
};

type GeneratedQuestionPayload = {
  chapter: string;
  section: string;
  stem: string;
  options: Record<"A" | "B" | "C" | "D" | "E", string>;
  answer: "A" | "B" | "C" | "D" | "E";
  explanation: string;
  testedConcept: string;
};

function getAllowedSections(settings?: Partial<QuizSettings>) {
  if (settings?.chapter && settings?.section) {
    return [`${settings.chapter} / ${settings.section}`];
  }

  if (settings?.chapter) {
    const item = anatomyOutline.find((chapter) => chapter.chapter === settings.chapter);
    return (item?.sections ?? []).map((section) => `${settings.chapter} / ${section}`);
  }

  return anatomyOutline.flatMap((chapter) =>
    chapter.sections.map((section) => `${chapter.chapter} / ${section}`)
  );
}

function buildPrompt(
  settings: Partial<QuizSettings>,
  usedConcepts: string[],
  count: number
) {
  const allowedSections = getAllowedSections(settings);
  const sampledConcepts = usedConcepts.slice(-12);

  return `你現在是台灣醫學生醫師國考一階解剖學命題助教。請產生 ${count} 題全新的單選題，要求如下：

1. 科目固定為「解剖學」
2. 題型要接近台灣醫師國考一階的解剖學考法
3. 可使用國考常見考點與考古題風格，但不要逐字重製受版權保護的原題
4. 如果適合，請做「考古題風格改寫」而不是原題照抄
5. 題目難度中等偏上，要有鑑別度
6. 選項必須是 A-E 五個
7. 只能輸出 JSON，不要加任何前後文或 markdown code fence
8. 請輸出格式：
{
  "questions": [
    {
      "chapter": string,
      "section": string,
      "stem": string,
      "options": { "A": string, "B": string, "C": string, "D": string, "E": string },
      "answer": "A" | "B" | "C" | "D" | "E",
      "explanation": string,
      "testedConcept": string
    }
  ]
}
9. 所有題目的 testedConcept 都要彼此不同
10. 所有題目都必須是新的，不要重複下方列出的 concepts

允許出題的小節：
${allowedSections.join("\n")}

請避免重複這些最近已出的 testedConcept：
${sampledConcepts.length > 0 ? sampledConcepts.join("\n") : "目前沒有"}

若 settings.usePastExamStyle = true，請更貼近國考考古題常見敘述風格，但仍需自行改寫。
目前設定：
- chapter: ${settings.chapter ?? "不限"}
- section: ${settings.section ?? "不限"}
- usePastExamStyle: ${settings.usePastExamStyle ? "true" : "false"}`;
}

function parseJSON(text: string) {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI 回傳格式不是有效 JSON。");
  }
  return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as
    | GeneratedQuestionPayload
    | { questions: GeneratedQuestionPayload[] };
}

function toQuestion(payload: GeneratedQuestionPayload, usePastExamStyle?: boolean) {
  const question: Question = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject: "解剖學",
    chapter: payload.chapter,
    section: payload.section,
    stem: payload.stem,
    options: payload.options,
    answer: payload.answer,
    explanation: payload.explanation,
    testedConcept: payload.testedConcept,
    source: usePastExamStyle ? "past-exam-inspired" : "ai-generated"
  };

  return question;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateQuestionRequestBody;
  const settings = body.settings ?? {};
  const usedConcepts = body.usedConcepts ?? [];
  const count = Math.max(1, Math.min(body.count ?? 1, 20));

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "OPENAI_API_KEY 尚未設定，無法生成 AI 新題。"
      },
      { status: 503 }
    );
  }

  try {
    const result = await createOpenAIText(buildPrompt(settings, usedConcepts, count), 3200);
    const payload = parseJSON(result.text);
    const rawQuestions = Array.isArray((payload as { questions?: GeneratedQuestionPayload[] }).questions)
      ? (payload as { questions: GeneratedQuestionPayload[] }).questions
      : [payload as GeneratedQuestionPayload];
    const questions = rawQuestions.map((question) =>
      toQuestion(question, settings.usePastExamStyle)
    );

    return NextResponse.json({
      ok: true,
      configured: true,
      model: result.model,
      count: questions.length,
      question: questions[0],
      questions
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        message: error instanceof Error ? error.message : "AI 新題生成失敗。"
      },
      { status: 500 }
    );
  }
}
