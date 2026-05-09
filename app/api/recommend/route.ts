import { NextRequest, NextResponse } from "next/server";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import {
  calculateCompletionStats,
  createQuestionOrder,
  DEFAULT_QUIZ_SETTINGS,
  getNextRecommendedSections
} from "@/lib/quizAnalysis";
import { QuizSession, QuizSettings } from "@/types/quiz";

type RecommendRequestBody = {
  sessions?: QuizSession[];
  settings?: Partial<QuizSettings>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RecommendRequestBody;
  const sessions = body.sessions ?? [];
  const settings: QuizSettings = {
    ...DEFAULT_QUIZ_SETTINGS,
    ...(body.settings ?? {})
  };

  const order = createQuestionOrder(anatomyQuestions, sessions, settings);
  const recommendedSections = getNextRecommendedSections(
    calculateCompletionStats(anatomyQuestions, sessions).sections,
    5
  );

  return NextResponse.json({
    settings,
    questionOrder: order,
    questions: anatomyQuestions.filter((question) => order.includes(question.id)),
    recommendedSections
  });
}
