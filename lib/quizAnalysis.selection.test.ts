import assert from "node:assert/strict";
import test from "node:test";
import { buildQuestionHistoryMap, createQuestionOrder, generateAIPrompt } from "./quizAnalysis";
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

test("開始頁帶入剩餘未做題時，散題要優先照這批題目往前排", () => {
  const questions = Array.from({ length: 30 }, (_, index) => makeQuestion(`q-${index + 1}`));
  const attemptedIds = questions.slice(0, 22).map((question) => question.id);
  const priorityQuestionIds = ["q-30", "q-29", "q-28", "q-27", "q-26", "q-25", "q-24", "q-23"];
  const order = createQuestionOrder(
    questions,
    [{ attempts: attemptedIds.map(makeAttempt) }],
    {
      ...baseSettings,
      priorityQuestionIds
    }
  );

  assert.deepEqual(order.slice(0, priorityQuestionIds.length), priorityQuestionIds);
});

test("剩餘未做題已在上一回答過後，不會再被 priority 當作未做題排入", () => {
  const questions = Array.from({ length: 30 }, (_, index) => makeQuestion(`q-${index + 1}`));
  const attemptedIds = questions.slice(0, 22).map((question) => question.id);
  const justAnsweredId = "q-30";
  const priorityQuestionIds = ["q-30", "q-29", "q-28", "q-27", "q-26", "q-25", "q-24", "q-23"];
  const order = createQuestionOrder(
    questions,
    [{ attempts: [...attemptedIds, justAnsweredId].map(makeAttempt) }],
    {
      ...baseSettings,
      priorityQuestionIds
    }
  );

  assert.equal(order.includes(justAnsweredId), false);
  assert.deepEqual(order.slice(0, priorityQuestionIds.length - 1), priorityQuestionIds.slice(1));
});

test("錯題完成 streak 只看最近一次答錯後的連續答對，不被低信心答對重置", () => {
  const questionId = "q-wrong-review";
  const attempts: Attempt[] = [
    {
      questionId,
      selectedAnswer: "B",
      correctAnswer: "A",
      isCorrect: false,
      confidence: 4,
      answeredAt: new Date(Date.UTC(2026, 0, 1)).toISOString()
    },
    {
      questionId,
      selectedAnswer: "A",
      correctAnswer: "A",
      isCorrect: true,
      confidence: 2,
      answeredAt: new Date(Date.UTC(2026, 0, 2)).toISOString()
    },
    {
      questionId,
      selectedAnswer: "A",
      correctAnswer: "A",
      isCorrect: true,
      confidence: 2,
      answeredAt: new Date(Date.UTC(2026, 0, 3)).toISOString()
    }
  ];

  const history = buildQuestionHistoryMap([{ attempts }]).get(questionId);

  assert.equal(history?.wrong, 1);
  assert.equal(history?.correct, 2);
  assert.equal(history?.correctStreakAfterLatestWrong, 2);
  assert.equal(history?.correctStreakAfterLatestRisk, 0);
});

test("錯題複習只收到錯題池時，不會用未做過題目補滿", () => {
  const reviewQuestion = makeQuestion("q-review-only");
  const order = createQuestionOrder(
    [reviewQuestion],
    [
      {
        attempts: [
          {
            questionId: reviewQuestion.id,
            selectedAnswer: "B",
            correctAnswer: "A",
            isCorrect: false,
            confidence: 4,
            answeredAt: new Date(Date.UTC(2026, 0, 4)).toISOString()
          }
        ]
      }
    ],
    {
      ...baseSettings,
      mode: "review",
      questionCount: 10,
      strictCustomQuestionPool: true,
      customQuestionIds: [reviewQuestion.id],
      customPoolLabel: "散題錯題庫"
    }
  );

  assert.deepEqual(order, [reviewQuestion.id]);
});

test("AI prompt 會保留模擬考作答時打叉排除的選項", () => {
  const question = makeQuestion("q-elimination");
  const attempt: Attempt = {
    questionId: question.id,
    selectedAnswer: "B",
    correctAnswer: "A",
    isCorrect: false,
    confidence: 4,
    eliminatedOptions: ["C", "D"],
    answeredAt: new Date(Date.UTC(2026, 0, 4)).toISOString()
  };

  const prompt = generateAIPrompt([attempt], [question], [{ attempts: [attempt] }], [question], {
    detailLevel: "concise"
  });

  assert.match(prompt, /作答時打叉排除：C、D/);
});
