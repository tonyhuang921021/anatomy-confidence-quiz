import assert from "node:assert/strict";
import test from "node:test";
import type { Attempt, Question } from "../types/quiz";
import {
  buildProgressBlocks,
  calculateProgressMetrics,
  formatProgressBlockLabel,
  getProgressStatus
} from "./progressMetrics";

function makeQuestion(id: string, primaryTag?: string): Question {
  return {
    id,
    subject: "生理學",
    chapter: "生理學",
    section: "舊分類",
    primaryTag,
    stem: id,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "",
    testedConcept: ""
  };
}

function makeAttempt(questionId: string, isCorrect: boolean): Attempt {
  return {
    questionId,
    selectedAnswer: isCorrect ? "A" : "B",
    correctAnswer: "A",
    isCorrect,
    confidence: 3,
    answeredAt: "2026-07-11T00:00:00.000Z"
  };
}

test("完成度以不重複題目計算，答對率保留每次作答", () => {
  const metrics = calculateProgressMetrics(
    new Set(["q1", "q2"]),
    [makeAttempt("q1", false), makeAttempt("q1", true)]
  );

  assert.equal(metrics.attemptedQuestions, 1);
  assert.equal(metrics.completionRate, 50);
  assert.equal(metrics.totalAttempts, 2);
  assert.equal(metrics.correctRate, 50);
});

test("每個新分類都會保留，包含尚未作答的區塊", () => {
  const blocks = buildProgressBlocks(
    [
      makeQuestion("q1", "生理學－心臟與循環"),
      makeQuestion("q2", "生理學－心臟與循環"),
      makeQuestion("q3", "生理學－腎臟、水電解質與酸鹼")
    ],
    [makeAttempt("q1", true)]
  );

  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks.map((block) => [block.label, block.attemptedQuestions, block.totalQuestionsInBank]),
    [
      ["心臟與循環", 1, 2],
      ["腎臟、水電解質與酸鹼", 0, 1]
    ]
  );
  assert.deepEqual(blocks[0]?.questionIds, ["q1", "q2"]);
});

test("進度狀態只使用完成度與答對率", () => {
  assert.equal(getProgressStatus(0, 0), "未開始");
  assert.equal(getProgressStatus(40, 100), "進行中");
  assert.equal(getProgressStatus(90, 60), "已完成但不穩");
  assert.equal(getProgressStatus(90, 80), "已完成且穩定");
});

test("區塊名稱移除重複科目前綴", () => {
  assert.equal(formatProgressBlockLabel("生理學－心臟與循環", "生理學"), "心臟與循環");
  assert.equal(formatProgressBlockLabel("生理學", "生理學"), "尚未細分");
  assert.equal(formatProgressBlockLabel("細菌學－革蘭氏陽性菌", "微生物免疫學"), "細菌學－革蘭氏陽性菌");
});

test("只有可信大科但沒有新子分類的題目會集中到尚未細分", () => {
  const blocks = buildProgressBlocks(
    [
      {
        ...makeQuestion("missing-2012-1-101030-1101-q023", "舊標籤不應顯示"),
        subject: "解剖學",
        section: "舊小節也不應顯示"
      }
    ],
    []
  );

  assert.equal(blocks[0]?.label, "尚未細分");
});
