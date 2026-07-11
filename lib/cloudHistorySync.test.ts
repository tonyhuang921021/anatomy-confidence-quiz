import assert from "node:assert/strict";
import test from "node:test";
import {
  CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE,
  buildCloudAttemptSessionChunks,
  findUnresolvedCompletedSessionIds,
  getExpectedCloudAttemptCount,
  getSessionIdsNeedingAttemptRows
} from "./cloudHistorySync";

test("large cloud history uses a small number of bounded attempt queries", () => {
  const sessionIds = Array.from({ length: 169 }, (_, index) => `session-${index + 1}`);
  const chunks = buildCloudAttemptSessionChunks(sessionIds);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [60, 60, 49]);
  assert.ok(chunks.every((chunk) => chunk.length <= CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE));
});

test("cloud attempt query chunks keep order and remove duplicate session ids", () => {
  assert.deepEqual(buildCloudAttemptSessionChunks(["a", "b", "a", "", "c"], 2), [
    ["a", "b"],
    ["c"]
  ]);
});

test("中途結束的完成回合以實際答題數判斷，不把整張題卷長度當成缺漏", () => {
  assert.equal(
    getExpectedCloudAttemptCount({
      id: "ended-early",
      questionCount: 100,
      correctCount: 2,
      wrongCount: 1
    }),
    3
  );
});

test("只有 payload 不完整的回合需要補查 attempts", () => {
  const sessions = [
    { id: "complete-payload", correctCount: 7, wrongCount: 3, payloadAttemptCount: 10 },
    { id: "missing-payload", correctCount: 7, wrongCount: 3, payloadAttemptCount: 4 },
    { id: "empty-completed", questionCount: 10, correctCount: 0, wrongCount: 0, payloadAttemptCount: 0 }
  ];

  assert.deepEqual(getSessionIdsNeedingAttemptRows(sessions), ["missing-payload"]);
});

test("completed history is unresolved unless payload or attempt rows are complete", () => {
  const unresolved = findUnresolvedCompletedSessionIds(
    [
      { id: "attempt-rows", correctCount: 8, wrongCount: 2, payloadAttemptCount: 0 },
      { id: "complete-payload", correctCount: 8, wrongCount: 2, payloadAttemptCount: 10 },
      { id: "partial-everywhere", correctCount: 8, wrongCount: 2, payloadAttemptCount: 4 },
      { id: "empty-session", correctCount: 0, wrongCount: 0, payloadAttemptCount: 0 }
    ],
    [
      ["attempt-rows", 10],
      ["partial-everywhere", 6]
    ]
  );

  assert.deepEqual(unresolved, ["partial-everywhere"]);
});
