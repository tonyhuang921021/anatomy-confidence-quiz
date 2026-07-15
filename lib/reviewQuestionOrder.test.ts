import assert from "node:assert/strict";
import test from "node:test";
import type { Attempt, Question, QuizSession, ReviewQuestionItem } from "../types/quiz";
import {
  buildLatestReviewAttemptMap,
  orderReviewItemsForNextRound
} from "./reviewQuestionOrder";

function makeItem(id: string): ReviewQuestionItem {
  const question: Question = {
    id,
    subject: "生理學",
    chapter: "循環",
    section: "血壓",
    stem: `${id} 題幹`,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "詳解",
    testedConcept: "血壓"
  };

  return {
    question,
    riskScore: 1,
    history: {
      questionId: id,
      attempts: 1,
      wrong: 1,
      correct: 0,
      lowConfidence: 0,
      overconfidence: 0,
      correctStreakAfterLatestWrong: 0,
      correctStreakAfterLatestRisk: 0
    }
  };
}

function makeAttempt(questionId: string, answeredAt: string): Attempt {
  return {
    questionId,
    selectedAnswer: "B",
    correctAnswer: "A",
    isCorrect: false,
    confidence: 3,
    answeredAt
  };
}

function makeSession(
  id: string,
  poolLabel: string,
  attempts: Attempt[],
  mode: "review" | "simulation" = "review"
): QuizSession {
  return {
    id,
    subject: "生理學",
    startedAt: attempts[0]?.answeredAt ?? "2026-07-01T00:00:00.000Z",
    completedAt: attempts.at(-1)?.answeredAt,
    settings: {
      mode,
      questionCount: attempts.length,
      customPoolLabel: poolLabel
    },
    attempts
  };
}

test("下一輪先出尚未在該複習題池做過的題目", () => {
  const items = [makeItem("recent"), makeItem("fresh-1"), makeItem("fresh-2")];
  const sessions = [
    makeSession("review-1", "散題待複習題庫", [
      makeAttempt("recent", "2026-07-15T01:00:00.000Z")
    ])
  ];

  assert.deepEqual(
    orderReviewItemsForNextRound(
      items,
      buildLatestReviewAttemptMap(sessions, ["散題待複習題庫"])
    ).map(
      (item) => item.question.id
    ),
    ["fresh-1", "fresh-2", "recent"]
  );
});

test("都複習過時先出隔最久的題目，最近做過的排最後", () => {
  const items = [makeItem("newest"), makeItem("oldest"), makeItem("middle")];
  const sessions = [
    makeSession("review-1", "散題錯題庫", [
      makeAttempt("newest", "2026-07-15T03:00:00.000Z"),
      makeAttempt("oldest", "2026-07-15T01:00:00.000Z"),
      makeAttempt("middle", "2026-07-15T02:00:00.000Z")
    ])
  ];

  assert.deepEqual(
    orderReviewItemsForNextRound(
      items,
      buildLatestReviewAttemptMap(sessions, ["散題錯題庫"])
    ).map(
      (item) => item.question.id
    ),
    ["oldest", "middle", "newest"]
  );
});

test("散題與模擬考複習紀錄不會互相影響排序", () => {
  const items = [makeItem("practice-question"), makeItem("simulation-question")];
  const sessions = [
    makeSession("simulation-review", "模擬考錯題庫", [
      makeAttempt("practice-question", "2026-07-15T03:00:00.000Z")
    ]),
    makeSession("simulation-source", "", [
      makeAttempt("simulation-question", "2026-07-15T04:00:00.000Z")
    ], "simulation")
  ];

  assert.deepEqual(
    orderReviewItemsForNextRound(
      items,
      buildLatestReviewAttemptMap(sessions, ["散題待複習題庫"])
    ).map(
      (item) => item.question.id
    ),
    ["practice-question", "simulation-question"]
  );
});
