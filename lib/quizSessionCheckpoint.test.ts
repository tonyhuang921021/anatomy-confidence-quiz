import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuizSessionProgressPayload,
  hasQuizSessionDefinitionChanged,
  mergeQuizSessionProgressPayload,
  omitHeavySessionPayload
} from "./quizSessionCheckpoint";
import type { QuizSession } from "@/types/quiz";

const session: QuizSession = {
  id: "session-heavy",
  subject: "解剖學",
  startedAt: "2026-07-12T10:00:00.000Z",
  currentQuestionIndex: 48,
  isReviewingAnswer: true,
  simulationElapsedSeconds: 1234,
  simulationTimerDurationSeconds: 7200,
  optionEliminationMap: { "q-49": ["A", "D"] },
  attempts: [],
  questionOrder: Array.from({ length: 650 }, (_, index) => `q-${index + 1}`),
  generatedQuestions: []
};

test("大型進行中測驗的 checkpoint 不包含完整題池", () => {
  const row = omitHeavySessionPayload({
    id: session.id,
    progress_payload: buildQuizSessionProgressPayload(session),
    session_payload: {
      questionOrder: session.questionOrder,
      generatedQuestions: session.generatedQuestions
    }
  });

  assert.equal("session_payload" in row, false);
  assert.equal(row.progress_payload.currentQuestionIndex, 48);
  assert.equal(JSON.stringify(row).includes("q-650"), false);
});

test("分批載入追加題目時必須完整更新題池定義", () => {
  assert.equal(
    hasQuizSessionDefinitionChanged(
      { questionOrder: ["q-1", "q-2"] },
      { questionOrder: ["q-1", "q-2", "q-3"] }
    ),
    true
  );
  assert.equal(
    hasQuizSessionDefinitionChanged(
      { questionOrder: ["q-1", "q-2"], currentQuestionIndex: 0 },
      { questionOrder: ["q-1", "q-2"], currentQuestionIndex: 1 }
    ),
    false
  );
});

test("讀取雲端紀錄時以輕量進度覆蓋舊的大型 payload 進度", () => {
  const payload = mergeQuizSessionProgressPayload(
    { questionOrder: ["q-1", "q-2"], currentQuestionIndex: 0 },
    { currentQuestionIndex: 1, isReviewingAnswer: true }
  );

  assert.deepEqual(payload.questionOrder, ["q-1", "q-2"]);
  assert.equal(payload.currentQuestionIndex, 1);
  assert.equal(payload.isReviewingAnswer, true);
});
