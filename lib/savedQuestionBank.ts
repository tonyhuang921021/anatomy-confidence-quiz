import type { Question } from "@/types/quiz";

const AI_SIMULATION_QUESTION_ID_PATTERN = /^(AI-[A-Z0-9-]+)-Q\d+$/i;

export function getAISimulationPaperKeyFromQuestionId(questionId: string) {
  return questionId.trim().match(AI_SIMULATION_QUESTION_ID_PATTERN)?.[1];
}

export async function loadSavedAISimulationQuestions(questionIds: string[]) {
  const requestedIds = Array.from(
    new Set(
      questionIds
        .map((questionId) => questionId.trim())
        .filter((questionId) => Boolean(getAISimulationPaperKeyFromQuestionId(questionId)))
    )
  );
  if (requestedIds.length === 0) return [];

  const requestedIdSet = new Set(requestedIds);
  const paperKeys = Array.from(
    new Set(
      requestedIds
        .map(getAISimulationPaperKeyFromQuestionId)
        .filter((paperKey): paperKey is string => Boolean(paperKey))
    )
  );
  const { getQuestionsForAISimulationPaper } = await import("../data/aiSimulationPapers");
  const questionMap = new Map<string, Question>();

  paperKeys.forEach((paperKey) => {
    getQuestionsForAISimulationPaper(paperKey).forEach((question) => {
      if (requestedIdSet.has(question.id)) questionMap.set(question.id, question);
    });
  });

  return requestedIds
    .map((questionId) => questionMap.get(questionId))
    .filter((question): question is Question => Boolean(question));
}
