import assert from "node:assert/strict";
import test from "node:test";
import { createQuestionOrder } from "./quizAnalysis";
import type { Attempt, Question, QuizSettings } from "../types/quiz";

function makeQuestion(id: string): Question {
  return {
    id,
    subject: "解剖學",
    chapter: "測試章",
    section: "測試節",
    stem: `題目 ${id}`,
    options: {
      A: "A",
      B: "B",
      C: "C",
      D: "D"
    },
    answer: "A",
    explanation: "測試詳解",
    testedConcept: "測試概念",
    sourceType: "MOEX_PAST_EXAM"
  };
}

function makeAttempt(questionId: string, index: number): Attempt {
  return {
    questionId,
    selectedAnswer: "A",
    correctAnswer: "A",
    isCorrect: true,
    confidence: 4,
    answeredAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
  };
}

const baseSettings: QuizSettings = {
  mode: "random",
  questionCount: 10,
  subjectFilter: "解剖學",
  excludeAiGenerated: true,
  excludePreviouslyAnswered: true
};

test("隨機刷題快完成時，剩下的未做題要先全部排進下一輪", () => {
  const questions = Array.from({ length: 20 }, (_, index) => makeQuestion(`q-${index + 1}`));
  const attemptedIds = questions.slice(0, 13).map((question) => question.id);
  const unseenIds = questions.slice(13).map((question) => question.id);
  const order = createQuestionOrder(
    questions,
    [{ attempts: attemptedIds.map(makeAttempt) }],
    baseSettings
  );

  assert.equal(order.length, 10);
  for (const id of unseenIds) {
    assert.ok(order.includes(id), `${id} should be included before old questions fill the round`);
  }
});

test("弱點補強快完成時，也要先抓未做題再用舊題補滿", () => {
  const questions = Array.from({ length: 20 }, (_, index) => makeQuestion(`q-${index + 1}`));
  const attemptedIds = questions.slice(0, 13).map((question) => question.id);
  const unseenIds = questions.slice(13).map((question) => question.id);
  const order = createQuestionOrder(
    questions,
    [{ attempts: attemptedIds.map(makeAttempt) }],
    {
      ...baseSettings,
      mode: "weakness"
    }
  );

  assert.equal(order.length, 10);
  for (const id of unseenIds) {
    assert.ok(order.includes(id), `${id} should be included before old questions fill the round`);
  }
});
