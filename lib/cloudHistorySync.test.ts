import assert from "node:assert/strict";
import test from "node:test";
import {
  CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE,
  buildCloudAttemptSessionChunks,
  findUnresolvedCompletedSessionIds
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

test("completed history is unresolved unless attempts or legacy payload were fully read", () => {
  const unresolved = findUnresolvedCompletedSessionIds(
    [
      { id: "attempt-row", questionCount: 10 },
      { id: "legacy-payload", questionCount: 10 },
      { id: "missing", questionCount: 10 },
      { id: "empty-session", questionCount: 0 }
    ],
    ["attempt-row"],
    ["legacy-payload"]
  );

  assert.deepEqual(unresolved, ["missing"]);
});
