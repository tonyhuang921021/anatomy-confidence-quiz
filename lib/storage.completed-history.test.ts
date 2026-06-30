import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompletedQuestionHistoryEntriesFromSessions,
  mergeCompletedQuestionHistoryEntries
} from "./storage";
import type { Attempt } from "../types/quiz";

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

test("已做題壓縮紀錄要能合併後來完成的 session 題號", () => {
  const existingHistory = buildCompletedQuestionHistoryEntriesFromSessions([
    { attempts: [makeAttempt("q-1", 1)] }
  ]);
  const sessionHistory = buildCompletedQuestionHistoryEntriesFromSessions([
    { attempts: [makeAttempt("q-2", 2)] }
  ]);

  const merged = mergeCompletedQuestionHistoryEntries(existingHistory, sessionHistory);
  const mergedIds = new Set(merged.map((entry) => entry.questionId));

  assert.equal(merged.length, 2);
  assert.ok(mergedIds.has("q-1"));
  assert.ok(mergedIds.has("q-2"));
});
