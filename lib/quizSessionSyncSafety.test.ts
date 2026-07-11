import assert from "node:assert/strict";
import test from "node:test";
import { shouldProtectExistingCompletedSession } from "./quizSessionSyncSafety";

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
