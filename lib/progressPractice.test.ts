import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProgressPracticeHref,
  buildProgressPracticeSettings,
  getProgressPracticeQuestionIds,
  normalizeProgressPracticeYearRange,
  resolveProgressPracticeQuestionCount
} from "./progressPractice";
import type { Attempt, Question, QuizSession } from "../types/quiz";

function makeQuestion(id: string, sourceYear?: number, sourceType: Question["sourceType"] = "MOEX_PAST_EXAM"): Question {
  return {
    id,
    subject: "生理學",
    chapter: "循環",
    section: "心臟",
    primaryTag: "生理學－心臟與循環",
    stem: id,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "",
    testedConcept: "心臟",
    sourceType,
    sourceYear
  };
}

function makeAttempt(questionId: string, answeredAt: string): Attempt {
  return {
    questionId,
    selectedAnswer: "A",
    correctAnswer: "A",
    isCorrect: true,
    confidence: 4,
    answeredAt
  };
}

test("章節練習連結會完整保留科目與章節名稱", () => {
  const href = buildProgressPracticeHref("生理學", "生理學－心臟與循環");
  const url = new URL(href, "https://example.test");

  assert.equal(url.pathname, "/progress/practice");
  assert.equal(url.searchParams.get("subject"), "生理學");
  assert.equal(url.searchParams.get("tag"), "生理學－心臟與循環");
});

test("章節練習會依年份排除其他考古題，未知年份只保留在全部年份", () => {
  const questions = [
    makeQuestion("q-2024", 2024),
    makeQuestion("q-2025", 2025),
    makeQuestion("q-unknown"),
    makeQuestion("q-ai", 2025, "AI_GENERATED")
  ];
  const questionIds = questions.map((question) => question.id);

  assert.deepEqual(
    getProgressPracticeQuestionIds({
      questions,
      questionIds,
      yearRange: { yearFrom: 2025, yearTo: 2025 }
    }),
    ["q-2025"]
  );
  assert.deepEqual(
    getProgressPracticeQuestionIds({
      questions,
      questionIds,
      yearRange: { yearFrom: 2011, yearTo: 2026 }
    }),
    ["q-2024", "q-2025", "q-unknown"]
  );
});

test("章節練習年份會交換反向範圍並限制在網站可選年份", () => {
  assert.deepEqual(
    normalizeProgressPracticeYearRange({ yearFrom: 2030, yearTo: 2010 }),
    { yearFrom: 2011, yearTo: 2026 }
  );
});

test("題數超過章節可用題時會自動縮到可用題數", () => {
  assert.equal(resolveProgressPracticeQuestionCount(10, 7), 7);
  assert.equal(resolveProgressPracticeQuestionCount("all", 23), 23);
  assert.equal(resolveProgressPracticeQuestionCount(5, 0), 0);
});

test("章節練習設定同時保存年份、題數、題池與未做優先順序", () => {
  const questions = [
    makeQuestion("new-2025", 2025),
    makeQuestion("seen-2025", 2025),
    makeQuestion("outside-2024", 2024)
  ];
  const sessions: Pick<QuizSession, "id" | "attempts">[] = [
    {
      id: "history",
      attempts: [makeAttempt("seen-2025", "2026-08-01T00:00:00.000Z")]
    }
  ];

  const settings = buildProgressPracticeSettings({
    questions,
    sessions,
    subject: "生理學",
    primaryTag: "生理學－心臟與循環",
    questionIds: questions.map((question) => question.id),
    yearRange: { yearFrom: 2025, yearTo: 2025 },
    questionCount: 5,
    prioritizeUnseen: true,
    customPoolLabel: "進度章節：生理學－心臟與循環"
  });

  assert.ok(settings);
  assert.equal(settings.yearFrom, 2025);
  assert.equal(settings.yearTo, 2025);
  assert.equal(settings.questionCount, 2);
  assert.deepEqual(settings.customQuestionIds, ["new-2025", "seen-2025"]);
  assert.deepEqual(settings.priorityQuestionIds, ["new-2025", "seen-2025"]);
  assert.equal(settings.strictCustomQuestionPool, true);
  assert.equal(settings.customPoolLabel, "進度章節：生理學－心臟與循環");
});
