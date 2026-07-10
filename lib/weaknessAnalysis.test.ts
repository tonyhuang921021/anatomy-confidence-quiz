import assert from "node:assert/strict";
import test from "node:test";
import type { Attempt, Question, QuizSession } from "../types/quiz";
import {
  analyzeRecentWeakness,
  buildWeaknessPracticeSettings,
  buildWeaknessQuestionOrder
} from "./weaknessAnalysis";

const NOW = new Date("2026-07-10T12:00:00.000Z");

function makeQuestion(
  id: string,
  primaryTag = "生理學－腎臟、水電解質與酸鹼",
  sourceYear = 2026,
  originalQuestionNumber = 1
): Question {
  return {
    id,
    subject: "生理學",
    chapter: "腎臟生理",
    section: "腎臟生理",
    primaryTag,
    stem: id,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "測試",
    testedConcept: "測試",
    sourceYear,
    originalQuestionNumber
  };
}

function makeAttempt(
  questionId: string,
  isCorrect: boolean,
  answeredAt: string,
  confidence: Attempt["confidence"] = 4
): Attempt {
  return {
    questionId,
    selectedAnswer: isCorrect ? "A" : "B",
    correctAnswer: "A",
    isCorrect,
    confidence,
    answeredAt
  };
}

function makeSession(id: string, attempts: Attempt[]): QuizSession {
  return {
    id,
    subject: "生理學",
    startedAt: attempts[0]?.answeredAt ?? NOW.toISOString(),
    completedAt: attempts.at(-1)?.answeredAt ?? NOW.toISOString(),
    attempts
  };
}

test("近 14 天每題只取最新一次，答錯是主要弱點訊號", () => {
  const questions = Array.from({ length: 6 }, (_, index) => makeQuestion(`q-${index + 1}`));
  const sessions = [
    makeSession("old", [makeAttempt("q-1", false, "2026-06-15T12:00:00.000Z", 5)]),
    makeSession("recent", [
      makeAttempt("q-1", true, "2026-07-09T12:00:00.000Z", 4),
      makeAttempt("q-2", false, "2026-07-09T12:01:00.000Z", 4),
      makeAttempt("q-3", false, "2026-07-09T12:02:00.000Z", 4),
      makeAttempt("q-4", false, "2026-07-09T12:03:00.000Z", 5),
      makeAttempt("q-5", true, "2026-07-09T12:04:00.000Z", 2),
      makeAttempt("q-6", true, "2026-07-09T12:05:00.000Z", 4)
    ])
  ];

  const result = analyzeRecentWeakness({
    questions,
    sessions,
    selectedSubjects: ["生理學"],
    now: NOW
  });

  assert.equal(result.recentUniqueQuestions, 6);
  assert.equal(result.concepts.length, 1);
  assert.equal(result.concepts[0].wrong, 3);
  assert.equal(result.concepts[0].certainWrong, 1);
  assert.equal(result.concepts[0].uncertainCorrect, 1);
  assert.equal(result.concepts[0].correctRate, 50);
});

test("同一場同一題重複提交只採最新一筆", () => {
  const questions = Array.from({ length: 5 }, (_, index) => makeQuestion(`same-${index + 1}`));
  const sessions = [
    makeSession("same-session", [
      makeAttempt("same-1", false, "2026-07-09T10:00:00.000Z", 5),
      makeAttempt("same-1", true, "2026-07-09T10:05:00.000Z", 4),
      makeAttempt("same-2", false, "2026-07-09T10:01:00.000Z", 4),
      makeAttempt("same-3", false, "2026-07-09T10:02:00.000Z", 4),
      makeAttempt("same-4", true, "2026-07-09T10:03:00.000Z", 4),
      makeAttempt("same-5", true, "2026-07-09T10:04:00.000Z", 4)
    ])
  ];

  const result = analyzeRecentWeakness({
    questions,
    sessions,
    selectedSubjects: ["生理學"],
    now: NOW
  });

  assert.equal(result.totalHistoryAttempts, 5);
  assert.equal(result.concepts[0].wrong, 2);
  assert.equal(result.concepts[0].certainWrong, 0);
});

test("少量或單一答錯不會硬湊成觀念群弱點", () => {
  const questions = Array.from({ length: 4 }, (_, index) => makeQuestion(`small-${index + 1}`));
  const sessions = [
    makeSession(
      "small",
      questions.map((question, index) =>
        makeAttempt(question.id, index !== 0, "2026-07-09T12:00:00.000Z", 4)
      )
    )
  ];

  const result = analyzeRecentWeakness({
    questions,
    sessions,
    selectedSubjects: ["生理學"],
    now: NOW
  });

  assert.equal(result.concepts.length, 0);
  assert.equal(result.subjectSummaries[0].dataStatus, "資料有限");
});

test("不同科目的可分析觀念不會被全站前五名截掉", () => {
  const physiologyQuestions = Array.from({ length: 30 }, (_, index) =>
    makeQuestion(`physiology-${index}`, `生理學－測試觀念 ${Math.floor(index / 5) + 1}`)
  );
  const pathologyQuestions = Array.from({ length: 5 }, (_, index) => ({
    ...makeQuestion(`pathology-${index}`, "病理學－腫瘤病理"),
    subject: "病理學" as const
  }));
  const questions = [...physiologyQuestions, ...pathologyQuestions];
  const sessions = [
    makeSession(
      "many-concepts",
      questions.map((question, index) =>
        makeAttempt(
          question.id,
          index % 5 >= 2,
          new Date(NOW.getTime() - index * 1_000).toISOString(),
          4
        )
      )
    )
  ];

  const result = analyzeRecentWeakness({
    questions,
    sessions,
    selectedSubjects: ["生理學", "病理學"],
    now: NOW
  });

  assert.equal(result.concepts.length, 7);
  assert.equal(result.concepts.filter((concept) => concept.subject === "病理學").length, 1);
});

test("複習題目先看近年，再以未做題為主並穿插仍易錯題", () => {
  const questions = [
    makeQuestion("new-1", undefined, 2026, 1),
    makeQuestion("new-2", undefined, 2026, 2),
    makeQuestion("new-3", undefined, 2026, 3),
    makeQuestion("risk", undefined, 2026, 4),
    makeQuestion("stable", undefined, 2026, 5),
    makeQuestion("older-new", undefined, 2025, 1)
  ];
  const sessions = [
    makeSession("history", [
      makeAttempt("risk", false, "2026-07-01T12:00:00.000Z", 4),
      makeAttempt("stable", true, "2026-07-01T12:00:00.000Z", 4)
    ])
  ];

  const order = buildWeaknessQuestionOrder({
    questions,
    sessions,
    subject: "生理學",
    primaryTag: "生理學－腎臟、水電解質與酸鹼"
  });

  assert.deepEqual(order, ["new-1", "new-2", "risk", "new-3", "stable", "older-new"]);
});

test("弱點複習使用可中斷且會正常記錄的獨立題池設定", () => {
  const settings = buildWeaknessPracticeSettings({
    subject: "生理學",
    primaryTag: "生理學－腎臟、水電解質與酸鹼",
    questionOrder: ["q-1", "q-2", "q-3"]
  });

  assert.equal(settings.mode, "random");
  assert.equal(settings.stopAfterReview, true);
  assert.equal(settings.strictCustomQuestionPool, true);
  assert.equal(settings.preserveCustomQuestionOrder, true);
  assert.equal(settings.questionCount, 3);
  assert.deepEqual(settings.customQuestionIds, ["q-1", "q-2", "q-3"]);
  assert.equal(settings.customPoolLabel, "考前弱點：生理學－腎臟、水電解質與酸鹼");
});

test("九千筆歷史仍完整納入，但近期排名只看不同題目", () => {
  const questions = Array.from({ length: 100 }, (_, index) => makeQuestion(`heavy-${index}`));
  const sessions = Array.from({ length: 9000 }, (_, index) =>
    makeSession(`heavy-session-${index}`, [
      makeAttempt(
        `heavy-${index % 100}`,
        index % 3 !== 0,
        new Date(NOW.getTime() - (index % 10) * 60_000).toISOString(),
        4
      )
    ])
  );

  const result = analyzeRecentWeakness({
    questions,
    sessions,
    selectedSubjects: ["生理學"],
    now: NOW
  });

  assert.equal(result.totalHistoryAttempts, 9000);
  assert.equal(result.recentUniqueQuestions, 100);
  assert.equal(result.concepts[0].uniqueQuestions, 100);
});
