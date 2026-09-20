import { getCanonicalQuestionBank } from "../data/med1QuestionBank";
import { getPdfChapter } from "./wrongQuestionPdf";
import type { OptionKey, Question, QuizSession } from "../types/quiz";

function makeDemoSession(id: string, questions: Question[], day: string, mode: "simulation" | "random"): QuizSession {
  return {
    id, subject: "醫學（一）", startedAt: `${day}T01:00:00.000Z`, completedAt: `${day}T02:00:00.000Z`,
    settings: { mode, questionCount: questions.length }, questionOrder: questions.map((question) => question.id),
    attempts: questions.map((question, index) => ({
      questionId: question.id,
      selectedAnswer: (["A", "B", "C", "D"] as OptionKey[]).find((key) => key !== question.answer)!,
      correctAnswer: question.answer, isCorrect: false, confidence: 3,
      answeredAt: `${day}T01:${String(index).padStart(2, "0")}:00.000Z`
    }))
  };
}

// Call from server pages or isolated preview capture scripts; only the selected
// question records are passed into client components, never the whole bank.
export function createWrongQuestionPdfDemo() {
  const bank = getCanonicalQuestionBank();
  const questions: Question[] = [];
  for (const subject of ["解剖學", "生理學", "生物化學"] as const) {
    const pool = bank.filter((question) => question.subject === subject && question.sourceYear === 2026 && question.sourceRound === 1 && getPdfChapter(question) !== "未細分章節");
    questions.push(...pool.slice(0, 3));
  }
  const imageQuestion = bank.filter((question) => question.stemImage).sort((left, right) => (right.sourceYear ?? 0) - (left.sourceYear ?? 0))[0];
  if (imageQuestion && !questions.some((question) => question.id === imageQuestion.id)) questions.push(imageQuestion);
  const currentQuestions = [...questions.slice(0, 2), ...questions.slice(3, 5), ...questions.slice(6, 7), ...(imageQuestion ? [imageQuestion] : [])];
  const currentWrongIds = new Set(currentQuestions.map((question) => question.id));
  const currentSession = makeDemoSession("pdf-demo-current", questions, "2026-09-20", "random");
  currentSession.attempts = currentSession.attempts.map((attempt) => currentWrongIds.has(attempt.questionId)
    ? attempt
    : { ...attempt, selectedAnswer: attempt.correctAnswer, isCorrect: true, confidence: 5 });
  const olderSession = makeDemoSession("pdf-demo-older", questions, "2026-09-13", "random");
  return { questions, currentSession, sessions: [olderSession, currentSession] };
}
