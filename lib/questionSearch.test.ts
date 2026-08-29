import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSearchFilterSummary,
  buildSearchPracticeSettings,
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

test("短英文縮寫不會誤命中其他單字中間的相同字串", () => {
  const iga = makeQuestion("q-1", "IgA 在黏膜免疫的作用", 2025);
  const ligament = makeQuestion("q-2", "anterior cruciate ligament 受傷", 2024);
  const ligand = makeQuestion("q-3", "ligand-gated ion channel", 2023);
  const igaSubtype = makeQuestion("q-4", "IgA1 與 IgA2 的差異", 2022);

  assert.deepEqual(search([ligament, ligand, igaSubtype, iga], "IgA").map((item) => item.id), ["q-1", "q-4"]);
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

test("搜尋條件摘要只留下使用者真正選過的條件", () => {
  assert.equal(
    buildSearchFilterSummary({
      keyword: "  IgA 腎病  ",
      subject: "病理學",
      year: "2026",
      sort: "accuracy_asc"
    }),
    "「IgA 腎病」 · 病理學 · 2026 年 · 答對率低到高"
  );
  assert.equal(
    buildSearchFilterSummary({
      keyword: "",
      subject: "全部",
      year: "全部",
      sort: "recent",
      browseAll: true
    }),
    "全部題庫 · 近年優先"
  );
});

test("搜尋多選建立獨立私人練習並保留原題順序與科目", () => {
  const physiology = makeQuestion("MOEX-TEST-2301-Q001", "腎臟生理", 2025);
  const pathology: Question = {
    ...makeQuestion("MOEX-TEST-2302-Q002", "腎臟病理", 2024),
    subject: "病理學",
    chapter: "腎臟病理"
  };
  const settings = buildSearchPracticeSettings([pathology, physiology, pathology]);

  assert.ok(settings);
  assert.equal(settings.mode, "search_practice");
  assert.equal(settings.questionCount, 2);
  assert.deepEqual(settings.customQuestionIds, [pathology.id, physiology.id]);
  assert.deepEqual(settings.subjectFilters, ["病理學", "生理學"]);
  assert.equal(settings.subjectFilter, "全部");
  assert.equal(settings.sessionName, "搜尋私人練習・混合科目（2 題）");
  assert.equal(settings.strictCustomQuestionPool, true);
  assert.equal(settings.preserveCustomQuestionOrder, true);
  assert.equal(settings.customPaperCode, undefined);
  assert.equal(settings.customPaperIsPublic, undefined);
});

test("搜尋未選題時不會建立空白私人練習", () => {
  assert.equal(buildSearchPracticeSettings([]), null);
});
