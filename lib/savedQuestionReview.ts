import { DEFAULT_QUIZ_SETTINGS } from "./quizAnalysis";
import type { Question, QuizSettings, SubjectName } from "../types/quiz";

export const SAVED_QUESTION_REVIEW_POOL_LABEL = "儲存題目題庫";

export function buildSavedQuestionReviewSettings(questions: Question[]): QuizSettings {
  const uniqueQuestions = Array.from(
    new Map(questions.map((question) => [question.id, question] as const)).values()
  );
  const subjectFilters = Array.from(
    new Set(uniqueQuestions.map((question) => question.subject))
  ) as SubjectName[];

  return {
    ...DEFAULT_QUIZ_SETTINGS,
    mode: "review",
    questionCount: Math.max(1, uniqueQuestions.length),
    sessionName: "儲存題目複習",
    subjectFilter: subjectFilters.length === 1 ? subjectFilters[0] : "全部",
    subjectFilters,
    excludePreviouslyAnswered: false,
    strictCustomQuestionPool: true,
    customQuestionIds: uniqueQuestions.map((question) => question.id),
    customPoolLabel: SAVED_QUESTION_REVIEW_POOL_LABEL
  };
}

export function isSavedQuestionReviewSettings(settings?: QuizSettings | null) {
  return (
    settings?.mode === "review" &&
    settings.customPoolLabel === SAVED_QUESTION_REVIEW_POOL_LABEL
  );
}
