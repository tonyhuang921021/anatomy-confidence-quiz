import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseMoreCompleteResumableSessionItem,
  createResumableQuizSessionListItem,
  getEmptyResultsPrimaryAction,
  isResumableSessionHydrationComplete,
  mergeResumableQuizSessionItems,
  mergeResumableQuizSessions
} from "./resumableSessions";
import type { Attempt, QuizSession } from "../types/quiz";

function attempts(count: number, answeredAt = "2026-07-10T12:00:00.000Z"): Attempt[] {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `Q${index + 1}`,
    selectedAnswer: "A",
    correctAnswer: "A",
    isCorrect: true,
    confidence: 4,
    answeredAt
  }));
}

function makeSession(id: string, overrides: Partial<QuizSession> = {}): QuizSession {
  return {
    id,
    subject: "生理學",
    startedAt: "2026-07-10T10:00:00.000Z",
    questionOrder: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    attempts: attempts(1),
    settings: {
      mode: "simulation",
      questionCount: 5,
      selectedPaperKey: "2024-2-med1"
    },
    ...overrides
  };
}

test("同一 session 的本機與雲端 checkpoint 只保留較完整版本", () => {
  const local = makeSession("session-a", { attempts: attempts(2) });
  const remote = makeSession("user-123:session-a", { attempts: attempts(4) });

  const merged = mergeResumableQuizSessions([local], [remote]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.attempts.length, 4);
});

test("同一份固定考卷的重複 session 只顯示進度最完整的一筆", () => {
  const older = makeSession("older", { attempts: attempts(2) });
  const newer = makeSession("newer", { attempts: attempts(4) });

  const merged = mergeResumableQuizSessions([older], [newer]);

  assert.deepEqual(merged.map((session) => session.id), ["newer"]);
});

test("不同散題測驗不會因模式相同被錯誤合併", () => {
  const first = makeSession("random-a", {
    settings: { mode: "random", questionCount: 5 },
    questionOrder: ["A1", "A2", "A3"]
  });
  const second = makeSession("random-b", {
    settings: { mode: "random", questionCount: 5 },
    questionOrder: ["B1", "B2", "B3"]
  });

  const merged = mergeResumableQuizSessions([first], [second]);

  assert.equal(merged.length, 2);
});

test("兩份不同的搜尋私人練習都會留在續作清單", () => {
  const first = makeSession("search-a", {
    subject: "生理學",
    settings: {
      mode: "search_practice",
      questionCount: 2,
      customPoolLabel: "搜尋私人練習",
      customQuestionIds: ["A1", "A2"]
    },
    questionOrder: ["A1", "A2"]
  });
  const second = makeSession("search-b", {
    subject: "生理學",
    settings: {
      mode: "search_practice",
      questionCount: 2,
      customPoolLabel: "搜尋私人練習",
      customQuestionIds: ["B1", "B2"]
    },
    questionOrder: ["B1", "B2"]
  });

  assert.equal(mergeResumableQuizSessions([first], [second]).length, 2);
});

test("同一搜尋題組的本機與雲端副本只保留較完整進度", () => {
  const settings = {
    mode: "search_practice" as const,
    questionCount: 3,
    customPoolLabel: "搜尋私人練習",
    customQuestionIds: ["A1", "A2", "A3"]
  };
  const local = makeSession("search-local", {
    settings,
    questionOrder: ["A1", "A2", "A3"],
    attempts: attempts(1)
  });
  const cloud = makeSession("search-cloud", {
    settings,
    questionOrder: ["A1", "A2", "A3"],
    attempts: attempts(3)
  });

  const merged = mergeResumableQuizSessions([local], [cloud]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "search-cloud");
});

test("已完成或沒有題目的 session 不會出現在繼續測驗", () => {
  const completed = makeSession("done", { completedAt: "2026-07-10T13:00:00.000Z" });
  const empty = makeSession("empty", { questionOrder: [] });

  assert.deepEqual(mergeResumableQuizSessions([completed, empty], []), []);
});

test("清單可用雲端摘要判斷較完整進度，不必先下載全部 attempts", () => {
  const local = makeSession("session-a", { attempts: attempts(2) });
  const cloudSummary = makeSession("user-123:session-a", { attempts: [] });

  const merged = mergeResumableQuizSessionItems([
    createResumableQuizSessionListItem(local),
    createResumableQuizSessionListItem(cloudSummary, {
      answeredCount: 5,
      lastActivityAt: "2026-07-10T13:00:00.000Z",
      needsCloudHydration: true
    })
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.answeredCount, 5);
  assert.equal(merged[0]?.session.attempts.length, 0);
  assert.equal(merged[0]?.needsCloudHydration, true);
  assert.equal(
    chooseMoreCompleteResumableSessionItem(local, merged)?.session.id,
    cloudSummary.id
  );
});

test("分批載入中的散題清單仍顯示完整目標題數", () => {
  const session = makeSession("large-random", {
    settings: { mode: "random", questionCount: 650 },
    questionOrder: Array.from({ length: 10 }, (_, index) => `Q${index + 1}`),
    attempts: []
  });

  const item = createResumableQuizSessionListItem(session);

  assert.equal(item.totalCount, 650);
});

test("摘要較完整但屬於不同散題時，不會覆蓋目前測驗", () => {
  const current = makeSession("random-current", {
    settings: { mode: "random", questionCount: 10 },
    questionOrder: ["A1", "A2"],
    attempts: attempts(1)
  });
  const other = makeSession("random-other", {
    settings: { mode: "random", questionCount: 10 },
    questionOrder: ["B1", "B2"],
    attempts: []
  });
  const otherSummary = createResumableQuizSessionListItem(other, {
    answeredCount: 10,
    needsCloudHydration: true
  });

  assert.equal(chooseMoreCompleteResumableSessionItem(current, [otherSummary]), null);
});

test("清單顯示 13 題但明細只有 6 題時不可視為完整續作紀錄", () => {
  const partial = makeSession("partial", {
    questionOrder: Array.from({ length: 20 }, (_, index) => `Q${index + 1}`),
    attempts: attempts(6)
  });

  assert.equal(isResumableSessionHydrationComplete(partial, 13), false);
  assert.equal(isResumableSessionHydrationComplete(partial, 6), true);
});

test("作答紀錄空白時，有未完成測驗就顯示忠實的續作入口", () => {
  assert.deepEqual(
    getEmptyResultsPrimaryAction({
      currentSession: makeSession("user-123:unfinished"),
      scope: "default"
    }),
    {
      href: "/quiz?resume=1&sessionId=unfinished",
      label: "繼續作答"
    }
  );
});

test("沒有未完成測驗時，開始測驗會先回到設定流程", () => {
  assert.deepEqual(
    getEmptyResultsPrimaryAction({ currentSession: null, scope: "default" }),
    { href: "/start", label: "開始測驗" }
  );
  assert.deepEqual(
    getEmptyResultsPrimaryAction({ currentSession: null, scope: "simulation" }),
    { href: "/simulation", label: "回到模擬考專區" }
  );
});
