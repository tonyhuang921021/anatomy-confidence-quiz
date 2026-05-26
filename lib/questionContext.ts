import { Question } from "@/types/quiz";

export type RelatedQuestionContext = {
  id: string;
  stem: string;
  options: Record<string, string | undefined>;
  answer?: string;
  acceptedAnswers?: string[];
  answerCreditType?: string;
  explanation?: string;
  testedConcept?: string;
  sourceLabel?: string;
};

function normalizeContinuationStem(stem: string) {
  return stem.trim().replace(/^[（(【\[]?\s*/, "");
}

export function isContinuationQuestionStem(stem?: string | null) {
  if (!stem) return false;
  return normalizeContinuationStem(stem).startsWith("承上題");
}

function getQuestionSourceLabel(question: Question) {
  const parts = [question.paperCode, question.examCode].filter(Boolean);
  if (parts.length > 0) return parts.join(" / ");
  return question.sourceCitation ?? "";
}

export function buildRelatedQuestionContext(question: Question): RelatedQuestionContext {
  return {
    id: question.id,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    acceptedAnswers: question.acceptedAnswers,
    answerCreditType: question.answerCreditType,
    explanation: question.explanation,
    testedConcept: question.testedConcept,
    sourceLabel: getQuestionSourceLabel(question)
  };
}

export function findPreviousQuestionForContinuation(
  currentQuestion: Question,
  candidateQuestions: Question[]
) {
  if (!isContinuationQuestionStem(currentQuestion.stem)) return null;
  if (!currentQuestion.originalQuestionNumber || currentQuestion.originalQuestionNumber <= 1) return null;

  const previousNumber = currentQuestion.originalQuestionNumber - 1;
  const uniqueCandidates = Array.from(
    new Map(candidateQuestions.map((question) => [question.id, question] as const)).values()
  );

  const matches = uniqueCandidates.filter((question) => {
    if (question.id === currentQuestion.id) return false;
    if (question.originalQuestionNumber !== previousNumber) return false;

    if (currentQuestion.paperCode && question.paperCode === currentQuestion.paperCode) return true;
    if (currentQuestion.examCode && question.examCode === currentQuestion.examCode) return true;
    if (currentQuestion.sourceCitation && question.sourceCitation === currentQuestion.sourceCitation) return true;

    return false;
  });

  if (matches.length === 0) return null;

  return (
    matches.find(
      (question) =>
        Boolean(currentQuestion.paperCode) && question.paperCode === currentQuestion.paperCode
    ) ??
    matches.find(
      (question) =>
        Boolean(currentQuestion.examCode) && question.examCode === currentQuestion.examCode
    ) ??
    matches[0]
  );
}
