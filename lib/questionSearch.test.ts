import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuestionSearchIndexEntry,
  filterAndSortQuestionSearch,
  type QuestionSearchRanking
} from "./questionSearch";
import type { Question } from "@/types/quiz";

function makeQuestion(id: string, stem: string, year: number, explanation = ""): Question {
  return {
    id,
    subject: "生理學",
    chapter: "生理學",
    section: "腎臟",
    stem,
    options: { A: "alpha", B: "beta", C: "gamma", D: "delta" },
    answer: "A",
    testedConcept: "腎臟生理",
    explanation,
    sourceYear: year,
    originalQuestionNumber: Number(id.match(/\d+$/)?.[0] ?? 1)
  };
}

function search(
  questions: Question[],
  keyword: string,
  sort: Parameters<typeof filterAndSortQuestionSearch>[0]["sort"] = "recent",
  rankings: Record<string, QuestionSearchRanking> = {}
) {
  return filterAndSortQuestionSearch({
    entries: questions.map(buildQuestionSearchIndexEntry),
    keyword,
    subject: "全部",
    year: "全部",
    sort,
    rankings
  });
}

test("多個關鍵字不必連續或照原順序也能找到題目", () => {
  const result = search(
    [makeQuestion("q-1", "Renal injury eventually causes respiratory failure", 2025)],
    "failure renal"
  );
  assert.equal(result.length, 1);
});

test("題幹命中優先於詳解偶然提及", () => {
  const direct = makeQuestion("q-1", "Aminoglycoside resistance mechanism", 2024);
  const incidental = makeQuestion("q-2", "Unrelated physiology question", 2025, "Aminoglycoside resistance mechanism");
  assert.deepEqual(search([incidental, direct], "aminoglycoside resistance").map((item) => item.id), ["q-1", "q-2"]);
});

test("OCR 字縫不會讓從字首開始搜尋失敗", () => {
  const result = search([makeQuestion("q-1", "p ancreatic lipase", 2025)], "pancreatic");
  assert.equal(result.length, 1);
});

test("答對率排序會把沒有統計的題目放最後", () => {
  const questions = [
    makeQuestion("q-1", "one", 2024),
    makeQuestion("q-2", "two", 2023),
    makeQuestion("q-3", "three", 2025)
  ];
  const rankings = {
    "q-1": { questionId: "q-1", totalAttempts: 100, correctRate: 80, chaosCount: 0 },
    "q-2": { questionId: "q-2", totalAttempts: 20, correctRate: 30, chaosCount: 0 }
  };
  assert.deepEqual(search(questions, "", "accuracy_asc", rankings).map((item) => item.id), ["q-2", "q-1", "q-3"]);
  assert.deepEqual(search(questions, "", "accuracy_desc", rankings).map((item) => item.id), ["q-1", "q-2", "q-3"]);
});

test("選擇答對率排序時不會被題幹相關性蓋過", () => {
  const direct = makeQuestion("q-1", "Aminoglycoside resistance mechanism", 2024);
  const partial = makeQuestion("q-2", "Aminoglycoside adverse effect", 2025);
  const rankings = {
    "q-1": { questionId: "q-1", totalAttempts: 100, correctRate: 90, chaosCount: 0 },
    "q-2": { questionId: "q-2", totalAttempts: 100, correctRate: 20, chaosCount: 0 }
  };
  assert.deepEqual(
    search([direct, partial], "aminoglycoside", "accuracy_asc", rankings).map((item) => item.id),
    ["q-2", "q-1"]
  );
});

test("最多人不要的題目依標記次數排序", () => {
  const questions = [makeQuestion("q-1", "one", 2024), makeQuestion("q-2", "two", 2025)];
  const rankings = {
    "q-1": { questionId: "q-1", totalAttempts: 5, correctRate: 80, chaosCount: 9 },
    "q-2": { questionId: "q-2", totalAttempts: 10, correctRate: 70, chaosCount: 2 }
  };
  assert.deepEqual(search(questions, "", "chaos_desc", rankings).map((item) => item.id), ["q-1", "q-2"]);
});
