import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuizSessionNavigationIntent,
  getRequestedResumeStatus,
  shouldPreserveSelectedQuizSession
} from "./quizSessionNavigation";
import type { QuizSession } from "../types/quiz";

function makeSession(id: string): QuizSession {
  return {
    id,
    subject: "藥理學",
    startedAt: "2026-07-14T02:48:46.619Z",
    settings: {
      mode: "random",
      questionCount: 49,
      subjectFilter: "藥理學",
      customPoolLabel: "進度區塊：藥理學－抗細菌藥"
    },
    questionOrder: Array.from({ length: 10 }, (_, index) => `Q${index + 1}`),
    currentQuestionIndex: 3,
    attempts: []
  };
}

test("指定續作 session 可比對雲端 namespaced id", () => {
  const intent = getQuizSessionNavigationIntent(
    new URLSearchParams("resume=1&sessionId=session-antibiotics")
  );
  const session = makeSession("user-123:session-antibiotics");

  assert.equal(
    getRequestedResumeStatus({ intent, session, reusable: true }),
    "ready"
  );
  assert.equal(shouldPreserveSelectedQuizSession(intent), true);
});

test("指定續作 session 遺失或被其他 session 取代時不可改開新測驗", () => {
  const intent = getQuizSessionNavigationIntent(
    new URLSearchParams("resume=1&sessionId=session-antibiotics")
  );

  assert.equal(
    getRequestedResumeStatus({ intent, session: null, reusable: false }),
    "missing"
  );
  assert.equal(
    getRequestedResumeStatus({
      intent,
      session: makeSession("session-random-all"),
      reusable: true
    }),
    "mismatch"
  );
  assert.equal(
    getRequestedResumeStatus({
      intent,
      session: makeSession("session-antibiotics"),
      reusable: false
    }),
    "unusable"
  );
});

test("舊版沒有 sessionId 的 resume=1 仍可沿用有效 current session", () => {
  const intent = getQuizSessionNavigationIntent(new URLSearchParams("resume=1"));

  assert.equal(
    getRequestedResumeStatus({
      intent,
      session: makeSession("session-antibiotics"),
      reusable: true
    }),
    "ready"
  );
});

test("new=1 優先於 resume 並維持明確新開測驗語意", () => {
  const intent = getQuizSessionNavigationIntent(
    new URLSearchParams("new=1&resume=1&sessionId=session-antibiotics")
  );

  assert.equal(intent.forceNew, true);
  assert.equal(intent.resumeRequested, false);
  assert.equal(shouldPreserveSelectedQuizSession(intent), true);
});
