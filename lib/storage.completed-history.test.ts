import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompletedQuestionHistoryEntriesFromSessions,
  getPendingQuestionExplanationOverrideSync,
  loadCloudCompletedSessionsForUser,
  loadCompletedQuestionHistoryEntriesForUser,
  loadCompletedHistorySessionsForUser,
  loadCompletedSessionsForUser,
  loadRecentCompletedSessionHandoffForUser,
  loadQuestionExplanationOverride,
  mergeCompletedQuestionHistoryEntries,
  mergeQuestionExplanationOverrides,
  saveCloudCompletedSessionsForUser,
  saveCompletedQuestionHistoryEntriesForUser,
  saveCompletedSession,
  saveRecentCompletedSessionHandoffForUser,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides,
  setActiveStorageUser
} from "./storage";
import type { Attempt, QuizSession } from "../types/quiz";

function createStorageMock(options: { failWrites?: boolean } = {}): Storage {
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
      if (options.failWrites) {
        throw new Error("storage quota exceeded");
      }
      data.set(key, value);
    }
  } as Storage;
}

function installBrowserStorage(options: { failLocalWrites?: boolean } = {}) {
  const localStorage = createStorageMock({ failWrites: options.failLocalWrites });
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

  return { localStorage, sessionStorage };
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

test("localStorage 寫不下時，完成題目歷史要落到 sessionStorage", () => {
  const { sessionStorage } = installBrowserStorage({ failLocalWrites: true });
  setActiveStorageUser("user-session-fallback");

  saveCompletedQuestionHistoryEntriesForUser(
    "user-session-fallback",
    buildCompletedQuestionHistoryEntriesFromSessions([
      { attempts: [makeAttempt("q-session-history", 3)] }
    ])
  );

  assert.ok(
    sessionStorage.getItem("anatomy-confidence-completed-question-history:user-session-fallback")
  );
});

test("讀已做題時，要合併 sessionStorage 的完成題目歷史", () => {
  const { sessionStorage } = installBrowserStorage();
  const entries = buildCompletedQuestionHistoryEntriesFromSessions([
    { attempts: [makeAttempt("q-session-read", 4)] }
  ]);
  sessionStorage.setItem(
    "anatomy-confidence-completed-question-history:user-session-read",
    JSON.stringify(entries)
  );

  const loaded = loadCompletedQuestionHistoryEntriesForUser("user-session-read");

  assert.ok(loaded.some((entry) => entry.questionId === "q-session-read"));
});

test("localStorage 寫不下時，雲端完成場次快取要落到 sessionStorage", () => {
  const { sessionStorage } = installBrowserStorage({ failLocalWrites: true });
  const session = makeSession("cloud-session-fallback", ["q-cloud-1"]);

  saveCloudCompletedSessionsForUser("user-cloud-fallback", [session]);

  assert.ok(
    sessionStorage.getItem("anatomy-confidence-cloud-completed-sessions:user-cloud-fallback")
  );
});

test("讀完成場次時，要合併 sessionStorage 的雲端與本機快取", () => {
  const { sessionStorage } = installBrowserStorage();
  const cloudSession = makeSession("cloud-session-read", ["q-cloud-read"]);
  const localSession = makeSession("local-session-read", ["q-local-read"]);

  sessionStorage.setItem(
    "anatomy-confidence-cloud-completed-sessions:user-completed-read",
    JSON.stringify([cloudSession])
  );
  sessionStorage.setItem(
    "anatomy-confidence-completed-sessions:user-completed-read",
    JSON.stringify([localSession])
  );

  assert.ok(
    loadCloudCompletedSessionsForUser("user-completed-read").some(
      (session) => session.id === "cloud-session-read"
    )
  );
  assert.ok(
    loadCompletedSessionsForUser("user-completed-read").some(
      (session) => session.id === "local-session-read"
    )
  );
});

test("剛完成 handoff 也要被進度歷史讀到", () => {
  installBrowserStorage();
  const session = makeSession("handoff-session-read", ["q-handoff-read"]);

  saveRecentCompletedSessionHandoffForUser("user-handoff-read", session);

  assert.ok(
    loadRecentCompletedSessionHandoffForUser("user-handoff-read").some(
      (item) => item.id === "handoff-session-read"
    )
  );
  assert.ok(
    loadCompletedHistorySessionsForUser("user-handoff-read")
      .flatMap((item) => item.attempts)
      .some((attempt) => attempt.questionId === "q-handoff-read")
  );
});

test("共享詳解較舊時，不會覆蓋本機較新的 AI 詳解", () => {
  const merged = mergeQuestionExplanationOverrides(
    {
      "q-explanation": {
        explanation: "新的詳解",
        optionAnalysis: {},
        memoryTip: "新記憶點",
        model: "gpt-5.4-mini",
        updatedAt: "2026-07-03T00:10:00.000Z"
      }
    },
    {
      "q-explanation": {
        explanation: "舊的詳解",
        optionAnalysis: {},
        memoryTip: "舊記憶點",
        model: "gpt-5.4-mini",
        updatedAt: "2026-07-03T00:00:00.000Z"
      }
    }
  );

  assert.equal(merged["q-explanation"].explanation, "新的詳解");
  assert.equal(merged["q-explanation"].memoryTip, "新記憶點");
});

test("儲存共享詳解時，也要保護已存在的較新本機詳解", () => {
  installBrowserStorage();
  setActiveStorageUser("user-1");

  saveQuestionExplanationOverride("q-stored-explanation", {
    explanation: "本機剛生成的新詳解",
    optionAnalysis: {},
    memoryTip: "",
    model: "gpt-5.4-mini",
    updatedAt: "2026-07-03T00:10:00.000Z"
  });

  saveQuestionExplanationOverrides({
    "q-stored-explanation": {
      explanation: "背景同步回來的舊詳解",
      optionAnalysis: {},
      memoryTip: "",
      model: "gpt-5.4-mini",
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  });

  assert.equal(
    loadQuestionExplanationOverride("q-stored-explanation")?.explanation,
    "本機剛生成的新詳解"
  );
});

test("第 20 題之後的新詳解也要排入共享同步", () => {
  installBrowserStorage();
  setActiveStorageUser("user-1");

  const questionIds = Array.from({ length: 25 }, (_, index) => `q-${index + 1}`);
  saveQuestionExplanationOverride("q-25", {
    explanation: "第 25 題的新詳解",
    optionAnalysis: {},
    memoryTip: "",
    model: "gpt-5.4-mini",
    updatedAt: "2026-07-03T01:20:00.000Z"
  });

  const pendingOverrides = getPendingQuestionExplanationOverrideSync(questionIds, {});

  assert.ok(pendingOverrides.some((item) => item.questionId === "q-25"));
});
