import assert from "node:assert/strict";
import test from "node:test";
import type { Attempt, Question, QuizSession, ReviewQuestionItem } from "../types/quiz";
import {
  buildLatestReviewAttemptMap,
  orderReviewItemsForNextRound
} from "./reviewQuestionOrder";

function makeItem(
  id: string,
  subject: Question["subject"] = "生理學",
  lastAttemptedAt?: string
): ReviewQuestionItem {
  const question: Question = {
    id,
    subject,
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
      correctStreakAfterLatestRisk: 0,
      lastAttemptedAt
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

test("尚未複習的題目中，剛做錯的新題會排在較舊錯題後面", () => {
  const items = [
    makeItem("recent-ai", "生理學", "2026-07-16T10:00:00.000Z"),
    makeItem("older-past-exam", "生理學", "2026-07-10T10:00:00.000Z"),
    makeItem("oldest-past-exam", "解剖學", "2026-07-01T10:00:00.000Z")
  ];

  const order = orderReviewItemsForNextRound(items, new Map()).map(
    (item) => item.question.id
  );

  assert.deepEqual(order, ["oldest-past-exam", "older-past-exam", "recent-ai"]);
});

test("都複習過時仍維持較舊的時間區段在前", () => {
  const items = [makeItem("newest"), makeItem("oldest"), makeItem("middle")];
  const sessions = [
    makeSession("review-1", "散題錯題庫", [
      makeAttempt("newest", "2026-07-15T15:00:00.000Z"),
      makeAttempt("oldest", "2026-07-15T01:00:00.000Z"),
      makeAttempt("middle", "2026-07-15T08:00:00.000Z")
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

test("複習時間相近的題目會穩定打散並交錯不同科目", () => {
  const items = [
    makeItem("anatomy-1", "解剖學"),
    makeItem("anatomy-2", "解剖學"),
    makeItem("anatomy-3", "解剖學"),
    makeItem("physiology-1", "生理學"),
    makeItem("physiology-2", "生理學"),
    makeItem("biochemistry-1", "生物化學")
  ];
  const attempts = items.map((item, index) =>
    makeAttempt(
      item.question.id,
      new Date(Date.UTC(2026, 6, 15, 1, index * 10)).toISOString()
    )
  );
  const latestAttempts = buildLatestReviewAttemptMap(
    [makeSession("review-nearby", "散題待複習題庫", attempts)],
    ["散題待複習題庫"]
  );
  const firstOrder = orderReviewItemsForNextRound(items, latestAttempts);
  const secondOrder = orderReviewItemsForNextRound(items, latestAttempts);
  const firstFourSubjects = firstOrder.slice(0, 4).map((item) => item.question.subject);

  assert.deepEqual(
    firstOrder.map((item) => item.question.id),
    secondOrder.map((item) => item.question.id)
  );
  assert.ok(new Set(firstFourSubjects).size >= 2);
  assert.notEqual(firstOrder[0]?.question.subject, firstOrder[1]?.question.subject);
});

test("相隔超過六小時仍維持較久未複習的批次在前", () => {
  const items = [
    makeItem("recent-anatomy", "解剖學"),
    makeItem("old-physiology", "生理學"),
    makeItem("recent-biochemistry", "生物化學"),
    makeItem("old-anatomy", "解剖學")
  ];
  const sessions = [
    makeSession("review-separated", "散題待複習題庫", [
      makeAttempt("recent-anatomy", "2026-07-15T18:00:00.000Z"),
      makeAttempt("old-physiology", "2026-07-15T01:00:00.000Z"),
      makeAttempt("recent-biochemistry", "2026-07-15T18:20:00.000Z"),
      makeAttempt("old-anatomy", "2026-07-15T01:20:00.000Z")
    ])
  ];
  const order = orderReviewItemsForNextRound(
    items,
    buildLatestReviewAttemptMap(sessions, ["散題待複習題庫"])
  );

  assert.deepEqual(
    new Set(order.slice(0, 2).map((item) => item.question.id)),
    new Set(["old-physiology", "old-anatomy"])
  );
  assert.deepEqual(
    new Set(order.slice(2).map((item) => item.question.id)),
    new Set(["recent-anatomy", "recent-biochemistry"])
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

  const latestAttempts = buildLatestReviewAttemptMap(sessions, ["散題待複習題庫"]);
  const order = orderReviewItemsForNextRound(items, latestAttempts);

  assert.equal(latestAttempts.size, 0);
  assert.deepEqual(
    new Set(order.map((item) => item.question.id)),
    new Set(["practice-question", "simulation-question"])
  );
});
