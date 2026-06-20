import type { Question } from "@/types/quiz";

export function buildQuestionExplanationRequestQuestion(
  question: Question,
  sourceQuestion?: Question
) {
  const source = sourceQuestion ?? question;

  return {
    id: question.id,
    subject: question.subject,
    chapter: question.chapter,
    section: question.section,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    acceptedAnswers: question.acceptedAnswers,
    answerCreditType: question.answerCreditType,
    explanation: source.explanation,
    testedConcept: question.testedConcept
  };
}

export function findQuestionSource(question: Question, sourceQuestions: Question[]) {
  return sourceQuestions.find((candidate) => candidate.id === question.id) ?? question;
}
