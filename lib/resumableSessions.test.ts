import assert from "node:assert/strict";
import test from "node:test";
import { mergeResumableQuizSessions } from "./resumableSessions";
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

test("已完成或沒有題目的 session 不會出現在繼續測驗", () => {
  const completed = makeSession("done", { completedAt: "2026-07-10T13:00:00.000Z" });
  const empty = makeSession("empty", { questionOrder: [] });

  assert.deepEqual(mergeResumableQuizSessions([completed, empty], []), []);
});
