import assert from "node:assert/strict";
import test from "node:test";
import {
  doesAttemptListCover,
  shouldProtectExistingCompletedSession
} from "./quizSessionSyncSafety";
import type { Attempt } from "../types/quiz";

function createAttempt(
  questionId: string,
  answeredAt: string,
  overrides: Partial<Attempt> = {}
): Attempt {
  return {
    questionId,
    selectedAnswer: "A",
    correctAnswer: "A",
    isCorrect: true,
    confidence: 3,
    answeredAt,
    ...overrides
  };
}

test("較短的舊完成紀錄不可覆蓋較完整雲端紀錄", () => {
  assert.equal(
    shouldProtectExistingCompletedSession(
      {
        completedAt: "2026-07-11T01:00:00.000Z",
        correctCount: 70,
        wrongCount: 30,
        payloadAttemptCount: 100,
        updatedAt: "2026-07-11T01:00:00.000Z"
      },
      {
        completedAt: "2026-07-11T00:59:00.000Z",
        correctCount: 7,
        wrongCount: 3,
        payloadAttemptCount: 10,
        updatedAt: "2026-07-11T00:59:00.000Z"
      }
    ),
    true
  );
});

test("較完整的新完成紀錄仍可補上雲端", () => {
  assert.equal(
    shouldProtectExistingCompletedSession(
      {
        completedAt: "2026-07-11T00:59:00.000Z",
        correctCount: 7,
        wrongCount: 3,
        payloadAttemptCount: 10,
        updatedAt: "2026-07-11T00:59:00.000Z"
      },
      {
        completedAt: "2026-07-11T01:00:00.000Z",
        correctCount: 70,
        wrongCount: 30,
        payloadAttemptCount: 100,
        updatedAt: "2026-07-11T01:00:00.000Z"
      }
    ),
    false
  );
});

test("已完成雲端紀錄不可被進行中 checkpoint 倒退", () => {
  assert.equal(
    shouldProtectExistingCompletedSession(
      {
        completedAt: "2026-07-11T01:00:00.000Z",
        correctCount: 80,
        wrongCount: 20,
        payloadAttemptCount: 100
      },
      {
        completedAt: null,
        correctCount: 2,
        wrongCount: 1,
        payloadAttemptCount: 0
      }
    ),
    true
  );
});

test("題數相同但題號不同時，不可誤認為待補傳紀錄已存在雲端", () => {
  const localAttempts = [
    createAttempt("q1", "2026-07-11T01:00:00.000Z"),
    createAttempt("q2", "2026-07-11T01:01:00.000Z")
  ];
  const remoteAttempts = [
    createAttempt("q1", "2026-07-11T01:00:00.000Z"),
    createAttempt("q3", "2026-07-11T01:02:00.000Z")
  ];

  assert.equal(doesAttemptListCover(remoteAttempts, localAttempts), false);
});

test("雲端內容相同且包含本機排除選項時，才可確認補傳完成", () => {
  const localAttempts = [
    createAttempt("q1", "2026-07-11T01:00:00.000Z", {
      eliminatedOptions: ["B", "C"]
    })
  ];
  const remoteAttempts = [
    createAttempt("q1", "2026-07-11T01:00:00.000Z", {
      eliminatedOptions: ["B", "C", "D"]
    })
  ];

  assert.equal(doesAttemptListCover(remoteAttempts, localAttempts), true);
});

test("同題本機答案較新且內容不同時，仍須保留待補傳", () => {
  const localAttempts = [
    createAttempt("q1", "2026-07-11T01:02:00.000Z", {
      selectedAnswer: "B",
      isCorrect: false
    })
  ];
  const remoteAttempts = [
    createAttempt("q1", "2026-07-11T01:00:00.000Z")
  ];

  assert.equal(doesAttemptListCover(remoteAttempts, localAttempts), false);
});
