import assert from "node:assert/strict";
import test from "node:test";
import type { Attempt, OptionKey } from "../types/quiz";
import {
  ANSWER_KEY_REVISION_QUESTION_IDS,
  getRegradedCorrectness,
  regradeAttemptForCurrentAnswerKey,
  regradeSessionForCurrentAnswerKey
} from "./answerKeyRevisions";

function buildAttempt(
  questionId: string,
  selectedAnswer: OptionKey,
  isCorrect = false
): Attempt {
  return {
    questionId,
    selectedAnswer,
    correctAnswer: "A",
    isCorrect,
    confidence: 4,
    errorType: isCorrect ? undefined : "背錯",
    eliminatedOptions: ["C"],
    answeredAt: "2026-08-31T12:00:00.000Z"
  };
}

test("115-2 醫學一第 63 題接受 B 或 D", () => {
  for (const answer of ["A", "B", "C", "D"] as OptionKey[]) {
    assert.equal(
      getRegradedCorrectness("MOEX-115090-1301-Q063", answer, false),
      answer === "B" || answer === "D"
    );
  }
});

test("115-2 醫學二第 95 題接受 A 或 D", () => {
  for (const answer of ["A", "B", "C", "D"] as OptionKey[]) {
    assert.equal(
      getRegradedCorrectness("MOEX-115090-2301-Q095", answer, false),
      answer === "A" || answer === "D"
    );
  }
});

test("六題一律給分會接受所有既有選項", () => {
  const allCreditIds = ANSWER_KEY_REVISION_QUESTION_IDS.filter(
    (questionId) =>
      questionId !== "MOEX-115090-1301-Q063" &&
      questionId !== "MOEX-115090-2301-Q095"
  );

  assert.equal(allCreditIds.length, 6);
  for (const questionId of allCreditIds) {
    for (const answer of ["A", "B", "C", "D", "E"] as OptionKey[]) {
      assert.equal(getRegradedCorrectness(questionId, answer, false), true);
    }
  }
});

test("重判只改正誤並保留原始作答內容", () => {
  const original = buildAttempt("MOEX-115090-1301-Q063", "B");
  const regraded = regradeAttemptForCurrentAnswerKey(original);

  assert.equal(regraded.isCorrect, true);
  assert.equal(regraded.errorType, undefined);
  assert.equal(regraded.selectedAnswer, original.selectedAnswer);
  assert.equal(regraded.correctAnswer, original.correctAnswer);
  assert.equal(regraded.confidence, original.confidence);
  assert.equal(regraded.answeredAt, original.answeredAt);
  assert.deepEqual(regraded.eliminatedOptions, original.eliminatedOptions);
});

test("無關題目完全不變，重複重判也是冪等", () => {
  const unrelated = buildAttempt("MOEX-114020-1301-Q063", "B");
  assert.equal(regradeAttemptForCurrentAnswerKey(unrelated), unrelated);

  const session = {
    id: "session-old-115090",
    subject: "醫學（一）" as const,
    startedAt: "2026-08-31T11:00:00.000Z",
    completedAt: "2026-08-31T13:00:00.000Z",
    attempts: [buildAttempt("MOEX-115090-1301-Q066", "A")]
  };
  const once = regradeSessionForCurrentAnswerKey(session);
  const twice = regradeSessionForCurrentAnswerKey(once);

  assert.equal(once.attempts[0].isCorrect, true);
  assert.deepEqual(once.scoreRevisions, [
    {
      revisionId: "moex-115090-appeal-v1",
      previousCorrectCount: 0,
      regradedCorrectCount: 1,
      totalCount: 1,
      appliedAt: "2026-09-02"
    }
  ]);
  assert.deepEqual(twice, once);
});
