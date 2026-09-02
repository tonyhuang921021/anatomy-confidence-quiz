import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompletedQuestionHistoryEntriesFromSessions,
  clearCurrentSession,
  commitUploadedCompletedSessionsForUser,
  discardCurrentSession,
  getPendingQuestionExplanationOverrideSync,
  loadCloudCompletedSessionsForUser,
  loadCompletedQuestionHistoryEntriesForUser,
  loadCompletedHistorySessionsForUser,
  loadCompletedSessions,
  loadCompletedSessionsForUser,
  loadPendingCompletedSessionUploadsForUser,
  loadRecentCompletedSessionHandoffForUser,
  loadQuestionExplanationOverride,
  loadCurrentSession,
  loadCurrentSessionForUser,
  mergeCompletedQuestionHistoryEntries,
  mergeQuestionExplanationOverrides,
  queuePendingCompletedSessionUploadForUser,
  saveCloudCompletedSessionsForUser,
  saveCompletedQuestionHistoryEntriesForUser,
  saveCompletedSession,
  saveCompletedSessionsForUser,
  saveRecentCompletedSessionHandoffForUser,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides,
  saveCurrentSession,
  setActiveStorageUser
} from "./storage";
import type { Attempt, QuizSession } from "../types/quiz";

function createStorageMock(options: { failWrites?: boolean; maxBytes?: number } = {}): Storage {
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
      const currentBytes = Array.from(data.entries()).reduce(
        (sum, [storedKey, storedValue]) => sum + storedKey.length + storedValue.length,
        0
      );
      const existingValue = data.get(key);
      const nextBytes =
        currentBytes -
        (existingValue ? key.length + existingValue.length : 0) +
        key.length +
        value.length;
      if (options.maxBytes && nextBytes > options.maxBytes) {
        throw new Error("storage quota exceeded");
      }
      data.set(key, value);
    }
  } as Storage;
}

function installBrowserStorage(options: {
  failLocalWrites?: boolean;
  failSessionWrites?: boolean;
  maxLocalBytes?: number;
  maxSessionBytes?: number;
} = {}) {
  const localStorage = createStorageMock({
    failWrites: options.failLocalWrites,
    maxBytes: options.maxLocalBytes
  });
  const sessionStorage = createStorageMock({
    failWrites: options.failSessionWrites,
    maxBytes: options.maxSessionBytes
  });
  const listeners = new Map<string, Set<EventListener>>();
  const windowMock = {
    localStorage,
    sessionStorage,
    addEventListener(type: string, listener: EventListener) {
      const bucket = listeners.get(type) ?? new Set<EventListener>();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      const type = event.type;
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
      return true;
    }
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

test("申覆題重判後會取代同次數的舊壓縮統計", () => {
  const common = {
    questionId: "MOEX-115090-1301-Q063",
    attempts: 1,
    lowConfidence: 0,
    overconfidence: 0,
    lastAttemptedAt: "2026-09-01T00:00:00.000Z",
    latestErrorType: undefined,
    latestSelectedAnswer: "B" as const,
    latestCorrectAnswer: "C" as const,
    latestConfidence: 4 as const
  };
  const stale = {
    ...common,
    correct: 0,
    wrong: 1,
    lastAttemptCorrect: false
  };
  const regraded = {
    ...common,
    correct: 1,
    wrong: 0,
    lastAttemptCorrect: true
  };

  assert.deepEqual(
    mergeCompletedQuestionHistoryEntries([stale], [regraded]),
    [regraded]
  );
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

test("指定帳號儲存完成回合時，不依賴目前 active user", () => {
  installBrowserStorage();
  setActiveStorageUser("guest");

  saveCompletedSessionsForUser("user-target", [
    makeSession("target-session", ["q-target"])
  ]);

  assert.ok(
    loadCompletedSessionsForUser("user-target").some(
      (session) => session.id === "target-session"
    )
  );
  assert.equal(
    loadCompletedSessionsForUser("guest").some(
      (session) => session.id === "target-session"
    ),
    false
  );
});

test("儲存較短完成回合清單時，不覆蓋已存在的每題歷史", () => {
  installBrowserStorage();
  setActiveStorageUser("user-history-merge");

  saveCompletedQuestionHistoryEntriesForUser(
    "user-history-merge",
    buildCompletedQuestionHistoryEntriesFromSessions([
      { attempts: [makeAttempt("q-existing", 1), makeAttempt("q-newer", 2)] }
    ])
  );

  saveCompletedSessionsForUser("user-history-merge", [
    makeSession("shorter-session", ["q-existing"])
  ]);

  const loadedIds = new Set(
    loadCompletedQuestionHistoryEntriesForUser("user-history-merge").map(
      (entry) => entry.questionId
    )
  );

  assert.ok(loadedIds.has("q-existing"));
  assert.ok(loadedIds.has("q-newer"));
});

test("儲存較短完成回合清單時，也不縮掉既有作答紀錄清單", () => {
  installBrowserStorage();
  setActiveStorageUser("user-session-list-merge");

  saveCompletedSessionsForUser("user-session-list-merge", [
    makeSession("existing-session", ["q-existing"])
  ]);

  saveCompletedSessionsForUser("user-session-list-merge", [
    makeSession("new-session", ["q-new"])
  ]);

  const loadedSessionIds = new Set(
    loadCompletedSessionsForUser("user-session-list-merge").map((session) => session.id)
  );

  assert.ok(loadedSessionIds.has("existing-session"));
  assert.ok(loadedSessionIds.has("new-session"));
});

test("同一回合較新的短副本不可覆蓋較早的完整作答紀錄", () => {
  installBrowserStorage();
  const userId = "user-same-session-fuller-local";
  const fullSession = makeSession(
    "same-session",
    Array.from({ length: 100 }, (_, index) => `q-${index + 1}`)
  );
  const shorterCloudSession = {
    ...makeSession(
      "user-user-same-session-fuller-local:same-session",
      Array.from({ length: 6 }, (_, index) => `q-${index + 1}`)
    ),
    completedAt: new Date(Date.UTC(2026, 0, 3)).toISOString()
  };

  setActiveStorageUser(userId);
  saveCompletedSessionsForUser(userId, [fullSession]);
  saveCloudCompletedSessionsForUser(userId, [shorterCloudSession]);

  const loaded = loadCompletedSessionsForUser(userId, {
    includeFullLocalHistory: true
  });
  const restored = loaded.find(
    (session) => session.id.endsWith("same-session")
  );

  assert.ok(restored);
  assert.equal(restored.attempts.length, 100);
  assert.equal(restored.questionOrder?.length, 100);
  assert.equal(restored.settings?.questionCount, 100);
});

test("同一回合不同副本的題目要取聯集，不可依最後寫入順序遺失", () => {
  installBrowserStorage();
  const userId = "user-same-session-union";
  const firstCopy = makeSession("union-session", ["q-1", "q-2"]);
  const secondCopy = {
    ...makeSession("user-user-same-session-union:union-session", ["q-2", "q-3"]),
    completedAt: new Date(Date.UTC(2026, 0, 4)).toISOString()
  };

  setActiveStorageUser(userId);
  saveCompletedSessionsForUser(userId, [firstCopy]);
  saveCloudCompletedSessionsForUser(userId, [secondCopy]);

  const loaded = loadCompletedSessionsForUser(userId, {
    includeFullLocalHistory: true
  });
  const restored = loaded.find((session) => session.id.endsWith("union-session"));
  const restoredQuestionIds = new Set(
    restored?.attempts.map((attempt) => attempt.questionId)
  );

  assert.ok(restored);
  assert.equal(restored.attempts.length, 3);
  assert.deepEqual(restoredQuestionIds, new Set(["q-1", "q-2", "q-3"]));
});

test("同一回合同題改答案時保留較新的答案，但不能縮掉其他題", () => {
  installBrowserStorage();
  const userId = "user-same-session-newer-answer";
  const fullSession = makeSession("answer-session", ["q-1", "q-2"]);
  const changedAttempt = {
    ...makeAttempt("q-1", 10),
    selectedAnswer: "B" as const,
    isCorrect: false,
    confidence: 2 as const,
    errorType: "兩選項猶豫" as const
  };
  const newerCopy: QuizSession = {
    ...makeSession("user-user-same-session-newer-answer:answer-session", ["q-1"]),
    completedAt: new Date(Date.UTC(2026, 0, 5)).toISOString(),
    attempts: [changedAttempt]
  };

  setActiveStorageUser(userId);
  saveCompletedSessionsForUser(userId, [fullSession]);
  saveCloudCompletedSessionsForUser(userId, [newerCopy]);

  const restored = loadCompletedSessionsForUser(userId, {
    includeFullLocalHistory: true
  }).find((session) => session.id.endsWith("answer-session"));
  const updatedAttempt = restored?.attempts.find(
    (attempt) => attempt.questionId === "q-1"
  );

  assert.ok(restored);
  assert.equal(restored.attempts.length, 2);
  assert.equal(updatedAttempt?.selectedAnswer, "B");
  assert.equal(updatedAttempt?.isCorrect, false);
  assert.equal(updatedAttempt?.confidence, 2);
  assert.equal(updatedAttempt?.errorType, "兩選項猶豫");
});

test("跨分頁 storage 事件要清掉完成回合記憶體快取", () => {
  const { localStorage } = installBrowserStorage();
  const userId = "user-cross-tab-cache";
  const storageKey = `anatomy-confidence-completed-sessions:${userId}`;
  const firstSession = makeSession("first-tab-session", ["q-first"]);
  const secondSession = makeSession("second-tab-session", ["q-second"]);

  setActiveStorageUser(userId);
  saveCompletedSessionsForUser(userId, [firstSession]);
  assert.equal(loadCompletedSessionsForUser(userId).length, 1);

  localStorage.setItem(storageKey, JSON.stringify([firstSession, secondSession]));
  window.dispatchEvent({ type: "storage", key: storageKey } as unknown as Event);

  const loadedSessionIds = new Set(
    loadCompletedSessionsForUser(userId).map((session) => session.id)
  );

  assert.ok(loadedSessionIds.has("first-tab-session"));
  assert.ok(loadedSessionIds.has("second-tab-session"));
});

test("雲端完成回合快取也要合併進每題歷史，不可讓舊快取倒退進度", () => {
  installBrowserStorage();
  setActiveStorageUser("user-cloud-history-merge");

  saveCompletedQuestionHistoryEntriesForUser(
    "user-cloud-history-merge",
    buildCompletedQuestionHistoryEntriesFromSessions([
      { attempts: [makeAttempt("q-local-latest", 3)] }
    ])
  );

  saveCloudCompletedSessionsForUser("user-cloud-history-merge", [
    makeSession("cloud-session", ["q-cloud"])
  ]);

  const loadedIds = new Set(
    loadCompletedQuestionHistoryEntriesForUser("user-cloud-history-merge").map(
      (entry) => entry.questionId
    )
  );

  assert.ok(loadedIds.has("q-local-latest"));
  assert.ok(loadedIds.has("q-cloud"));
});

test("登入帳號讀完成回合時，也要看得到同裝置 guest 完成紀錄", () => {
  installBrowserStorage();

  setActiveStorageUser("guest");
  saveCompletedSession(makeSession("guest-completed-session", ["q-guest-completed"]));

  setActiveStorageUser("user-merged-completed");
  saveCompletedSession(makeSession("user-completed-session", ["q-user-completed"]));

  const loaded = loadCompletedSessions();
  const loadedIds = new Set(loaded.map((session) => session.id));

  assert.ok(loadedIds.has("guest-completed-session"));
  assert.ok(loadedIds.has("user-completed-session"));
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

test("完整讀取完成場次時，不會被超大本機歷史的最近 recovery 快取截短", () => {
  const { localStorage } = installBrowserStorage();
  const userId = "user-heavy-full-history";
  const heavySessions = Array.from({ length: 260 }, (_, index) => {
    const session = makeSession(`heavy-session-${index}`, [`q-heavy-${index}`]);
    return {
      ...session,
      settings: {
        ...session.settings!,
        sessionName: `heavy-${index}-${"x".repeat(6500)}`
      }
    } satisfies QuizSession;
  });

  localStorage.setItem(
    `anatomy-confidence-completed-sessions:${userId}`,
    JSON.stringify(heavySessions)
  );

  const defaultIds = loadCompletedSessionsForUser(userId).map((session) => session.id);
  assert.ok(!defaultIds.includes("heavy-session-0"));

  const fullIds = loadCompletedSessionsForUser(userId, { includeFullLocalHistory: true }).map(
    (session) => session.id
  );
  assert.ok(fullIds.includes("heavy-session-0"));
  assert.ok(fullIds.includes("heavy-session-259"));
});

test("九千筆作答壓縮後仍保留完整題目與作答次數", () => {
  const attempts = Array.from({ length: 9000 }, (_, index) => ({
    ...makeAttempt(`q-heavy-attempt-${index % 6000}`, index % 28),
    answeredAt: new Date(Date.UTC(2026, 6, 1, 0, index)).toISOString()
  }));

  const entries = buildCompletedQuestionHistoryEntriesFromSessions([{ attempts }]);

  assert.equal(entries.length, 6000);
  assert.equal(entries.reduce((sum, entry) => sum + entry.attempts, 0), 9000);
  assert.ok(entries.some((entry) => entry.questionId === "q-heavy-attempt-0"));
  assert.ok(entries.some((entry) => entry.questionId === "q-heavy-attempt-5999"));
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

test("待補傳佇列可保留超過舊版八十回的離線紀錄", () => {
  installBrowserStorage();
  const userId = "user-large-pending-queue";
  const sessions = Array.from({ length: 120 }, (_, index) =>
    makeSession(`pending-session-${index}`, [`q-pending-${index}`])
  );

  queuePendingCompletedSessionUploadForUser(userId, sessions);

  assert.equal(loadPendingCompletedSessionUploadsForUser(userId).length, 120);
});

test("儲存空間不足時優先清除可重抓雲端快取並保住待補傳紀錄", () => {
  const { localStorage, sessionStorage } = installBrowserStorage({ maxLocalBytes: 9_000 });
  const userId = "user-critical-pending";
  const cloudSession = {
    ...makeSession("cloud-cache-session", ["q-cloud-cache"]),
    settings: {
      ...makeSession("cloud-cache-session", ["q-cloud-cache"]).settings!,
      sessionName: "c".repeat(6_000)
    }
  } satisfies QuizSession;
  const pendingSession = {
    ...makeSession("critical-pending-session", ["q-critical-pending"]),
    settings: {
      ...makeSession("critical-pending-session", ["q-critical-pending"]).settings!,
      sessionName: "p".repeat(3_000)
    }
  } satisfies QuizSession;

  saveCloudCompletedSessionsForUser(userId, [cloudSession]);
  queuePendingCompletedSessionUploadForUser(userId, pendingSession);

  assert.equal(
    localStorage.getItem(`anatomy-confidence-cloud-completed-sessions:${userId}`),
    null
  );
  assert.ok(
    localStorage.getItem(`anatomy-confidence-pending-completed-session-uploads:${userId}`)
  );
  assert.equal(
    sessionStorage.getItem(`anatomy-confidence-pending-completed-session-uploads:${userId}`),
    null
  );
});

test("瀏覽器空間已滿時完整歷史仍保留記憶體中的最新雲端結果", () => {
  const { localStorage } = installBrowserStorage({
    maxLocalBytes: 4_000,
    maxSessionBytes: 1_000
  });
  const userId = "user-memory-cloud-results";
  const olderSession = makeSession("older-local-session", ["q-older"]);
  const latestCloudSession = {
    ...makeSession("latest-cloud-session", ["q-latest"]),
    completedAt: new Date(Date.UTC(2026, 6, 13)).toISOString(),
    settings: {
      ...makeSession("latest-cloud-session", ["q-latest"]).settings!,
      mode: "simulation" as const,
      sessionName: "最新雲端模擬考".repeat(500)
    }
  } satisfies QuizSession;

  saveCompletedSessionsForUser(userId, [olderSession]);
  assert.ok(localStorage.getItem(`anatomy-confidence-completed-sessions:${userId}`));

  assert.equal(saveCloudCompletedSessionsForUser(userId, [latestCloudSession]), false);

  const loadedIds = new Set(
    loadCompletedSessionsForUser(userId, { includeFullLocalHistory: true }).map(
      (session) => session.id
    )
  );
  assert.ok(loadedIds.has("older-local-session"));
  assert.ok(loadedIds.has("latest-cloud-session"));
});

test("確認完成紀錄上傳時不會因清除待補傳佇列讓最新紀錄消失", () => {
  installBrowserStorage({
    maxLocalBytes: 4_000,
    failSessionWrites: true
  });
  const userId = "user-atomic-completed-sync";
  const olderSession = makeSession("older-persisted-session", ["q-older"]);
  const uploadedSession = {
    ...makeSession("fresh-uploaded-session", ["q-fresh"]),
    completedAt: new Date(Date.UTC(2026, 6, 13, 3, 33)).toISOString(),
    settings: {
      ...makeSession("fresh-uploaded-session", ["q-fresh"]).settings!,
      sessionName: "最新完成紀錄".repeat(350)
    }
  } satisfies QuizSession;

  setActiveStorageUser(userId);
  saveCompletedSessionsForUser(userId, [olderSession]);
  queuePendingCompletedSessionUploadForUser(userId, uploadedSession);
  assert.equal(loadPendingCompletedSessionUploadsForUser(userId).length, 1);

  const visibleSnapshots: string[][] = [];
  window.addEventListener("completed-sessions-change", () => {
    visibleSnapshots.push(
      loadCompletedSessionsForUser(userId, { includeFullLocalHistory: true }).map(
        (session) => session.id
      )
    );
  });

  assert.equal(
    commitUploadedCompletedSessionsForUser(userId, uploadedSession),
    false
  );

  assert.equal(loadPendingCompletedSessionUploadsForUser(userId).length, 0);
  assert.ok(
    loadCompletedSessionsForUser(userId, { includeFullLocalHistory: true }).some(
      (session) => session.id === uploadedSession.id
    )
  );
  assert.ok(
    visibleSnapshots.every((sessionIds) => sessionIds.includes(uploadedSession.id))
  );
  assert.equal(visibleSnapshots.length, 1);
});

test("其他分頁清除待補傳佇列時不會清掉本分頁的記憶體完成紀錄", () => {
  installBrowserStorage({
    maxLocalBytes: 4_000,
    failSessionWrites: true
  });
  const userId = "user-cross-tab-pending-clear";
  const uploadedSession = {
    ...makeSession("cross-tab-uploaded-session", ["q-cross-tab"]),
    settings: {
      ...makeSession("cross-tab-uploaded-session", ["q-cross-tab"]).settings!,
      sessionName: "跨分頁最新完成紀錄".repeat(350)
    }
  } satisfies QuizSession;

  setActiveStorageUser(userId);
  queuePendingCompletedSessionUploadForUser(userId, uploadedSession);
  assert.equal(saveCloudCompletedSessionsForUser(userId, [uploadedSession]), false);

  window.dispatchEvent({
    type: "storage",
    key: `anatomy-confidence-pending-completed-session-uploads:${userId}`
  } as unknown as Event);

  assert.ok(
    loadCompletedSessionsForUser(userId, { includeFullLocalHistory: true }).some(
      (session) => session.id === uploadedSession.id
    )
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

test("刪除進行中測驗後，舊分頁不能把同一 session 寫回本機", () => {
  installBrowserStorage();
  setActiveStorageUser("user-1");
  const activeSession = {
    ...makeSession("active-session", ["q-1", "q-2"]),
    completedAt: undefined
  } satisfies QuizSession;

  saveCurrentSession(activeSession);
  assert.equal(loadCurrentSession()?.id, "active-session");

  discardCurrentSession(activeSession.id, ["user-1"]);
  saveCurrentSession({ ...activeSession, currentQuestionIndex: 1 });

  assert.equal(loadCurrentSession(), null);
});

test("localStorage 空間不足時，49 題續作要改存 sessionStorage 並蓋過舊測驗", () => {
  const { localStorage, sessionStorage } = installBrowserStorage({ maxLocalBytes: 1_500 });
  const userId = "user-resume-fallback";
  setActiveStorageUser(userId);

  const oldSession = {
    ...makeSession("old-random-session", ["q-old"]),
    completedAt: undefined,
    attempts: []
  } satisfies QuizSession;
  assert.equal(saveCurrentSession(oldSession), true);

  const customQuestionIds = Array.from(
    { length: 49 },
    (_, index) => `MOEX-112020_2301-Q${String(index + 1).padStart(3, "0")}`
  );
  const resumedSession = {
    ...makeSession("session-antibiotics", customQuestionIds.slice(0, 10)),
    completedAt: undefined,
    settings: {
      mode: "random" as const,
      questionCount: 49,
      subjectFilter: "藥理學" as const,
      customPoolLabel: "進度區塊：藥理學－抗細菌藥",
      customQuestionIds,
      strictCustomQuestionPool: true,
      stopAfterReview: true
    },
    attempts: customQuestionIds.slice(0, 3).map(makeAttempt)
  } satisfies QuizSession;

  assert.equal(saveCurrentSession(resumedSession), true);

  const scopedKey = `anatomy-confidence-current-session:${userId}`;
  assert.equal(JSON.parse(localStorage.getItem(scopedKey) ?? "null")?.id, oldSession.id);
  assert.equal(
    JSON.parse(sessionStorage.getItem(scopedKey) ?? "null")?.id,
    resumedSession.id
  );
  assert.equal(loadCurrentSession()?.id, resumedSession.id);

  clearCurrentSession();
  assert.equal(localStorage.getItem(scopedKey), null);
  assert.equal(sessionStorage.getItem(scopedKey), null);
});

test("current session 無法寫入任何瀏覽器儲存時要回報失敗", () => {
  installBrowserStorage({ failLocalWrites: true, failSessionWrites: true });
  const activeSession = {
    ...makeSession("unpersisted-session", ["q-1"]),
    completedAt: undefined,
    attempts: []
  } satisfies QuizSession;

  assert.equal(saveCurrentSession(activeSession), false);
  assert.equal(loadCurrentSession(), null);
});

test("目前測驗同時存在本機與分頁副本時，較新的短副本不能縮掉完整進度", () => {
  const { localStorage, sessionStorage } = installBrowserStorage();
  const userId = "user-current-copy-merge";
  const storageKey = `anatomy-confidence-current-session:${userId}`;
  const fullSession: QuizSession = {
    ...makeSession(
      "current-copy-session",
      Array.from({ length: 20 }, (_, index) => `q-${index + 1}`)
    ),
    completedAt: undefined,
    attempts: Array.from({ length: 13 }, (_, index) =>
      makeAttempt(`q-${index + 1}`, index + 1)
    ),
    currentQuestionIndex: 13
  };
  const shorterSession: QuizSession = {
    ...fullSession,
    attempts: Array.from({ length: 6 }, (_, index) => ({
      ...makeAttempt(`q-${index + 1}`, index + 20),
      answeredAt: new Date(Date.UTC(2026, 1, index + 1)).toISOString()
    })),
    currentQuestionIndex: 6
  };

  localStorage.setItem(storageKey, JSON.stringify(fullSession));
  sessionStorage.setItem(storageKey, JSON.stringify(shorterSession));

  const restored = loadCurrentSessionForUser(userId);

  assert.ok(restored);
  assert.equal(restored.attempts.length, 13);
  assert.equal(restored.currentQuestionIndex, 13);
});

test("目前測驗儲存出現不同 session 時，仍以最後真正活動的測驗為準", () => {
  const { localStorage, sessionStorage } = installBrowserStorage();
  const userId = "user-current-different-session";
  const storageKey = `anatomy-confidence-current-session:${userId}`;
  const olderLargeSession: QuizSession = {
    ...makeSession("older-large-session", ["old-1", "old-2", "old-3"]),
    completedAt: undefined,
    startedAt: "2026-01-01T00:00:00.000Z"
  };
  const newerSession: QuizSession = {
    ...makeSession("newer-session", ["new-1"]),
    completedAt: undefined,
    startedAt: "2026-03-01T00:00:00.000Z",
    attempts: [
      {
        ...makeAttempt("new-1", 1),
        answeredAt: "2026-03-01T00:01:00.000Z"
      }
    ]
  };

  localStorage.setItem(storageKey, JSON.stringify(olderLargeSession));
  sessionStorage.setItem(storageKey, JSON.stringify(newerSession));

  assert.equal(loadCurrentSessionForUser(userId)?.id, "newer-session");
});
