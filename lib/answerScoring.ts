import type { OptionKey, Question } from "../types/quiz";

type ScorableQuestion = Pick<Question, "answer" | "acceptedAnswers" | "answerCreditType">;

/** Display the same credit policy as scoring, without rewriting stored attempts. */
export function getQuestionAnswerLabel(question: ScorableQuestion) {
  if (question.answerCreditType === "all_credit") return "一律給分";
  if (
    question.answerCreditType === "multiple_accepted" ||
    question.answerCreditType === "multiple_answers"
  ) {
    return [...new Set(question.acceptedAnswers?.length ? question.acceptedAnswers : [question.answer])].join("、");
  }
  return question.answer;
}

export function isQuestionAnswerCorrect(
  question: ScorableQuestion,
  selectedAnswer: OptionKey
) {
  if (question.answerCreditType === "all_credit") {
    return true;
  }

  if (
    question.answerCreditType === "multiple_accepted" ||
    question.answerCreditType === "multiple_answers"
  ) {
    const acceptedAnswers =
      question.acceptedAnswers && question.acceptedAnswers.length > 0
        ? question.acceptedAnswers
        : [question.answer];
    return acceptedAnswers.includes(selectedAnswer);
  }

  return selectedAnswer === question.answer;
}
