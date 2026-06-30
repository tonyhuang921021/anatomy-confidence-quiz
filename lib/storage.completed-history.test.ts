import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompletedQuestionHistoryEntriesFromSessions,
  loadCompletedHistorySessionsForUser,
  mergeCompletedQuestionHistoryEntries,
  saveCompletedQuestionHistoryEntriesForUser,
  saveCompletedSession,
  setActiveStorageUser
} from "./storage";
import type { Attempt, QuizSession } from "../types/quiz";

function createStorageMock(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  } as Storage;
}

function installBrowserStorage() {
  const localStorage = createStorageMock();
  const sessionStorage = createStorageMock();
  const windowMock = {
    localStorage,
    sessionStorage,
    dispatchEvent: () => true
  } as unknown as Window & typeof globalThis;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowMock,
    writable: true
  });
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

function makeSession(id: string, questionIds: string[]): QuizSession {
  return {
    id,
    subject: "解剖學",
    startedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    completedAt: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    settings: {
      mode: "random",
      questionCount: questionIds.length,
      subjectFilter: "解剖學"
    },
    questionOrder: questionIds,
    currentQuestionIndex: 0,
    isReviewingAnswer: false,
    attempts: questionIds.map(makeAttempt)
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

test("登入帳號讀已做題時，也要合併同裝置 guest 暫存紀錄", () => {
  installBrowserStorage();

  setActiveStorageUser("guest");
  saveCompletedSession(makeSession("guest-session", ["q-guest"]));

  setActiveStorageUser("user-1");
  saveCompletedQuestionHistoryEntriesForUser(
    "user-1",
    buildCompletedQuestionHistoryEntriesFromSessions([
      { attempts: [makeAttempt("q-user", 2)] }
    ])
  );

  const historySessions = loadCompletedHistorySessionsForUser("user-1");
  const attemptedIds = new Set(
    historySessions.flatMap((session) => session.attempts.map((attempt) => attempt.questionId))
  );

  assert.ok(attemptedIds.has("q-user"));
  assert.ok(attemptedIds.has("q-guest"));
});
