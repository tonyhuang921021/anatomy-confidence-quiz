import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionTrackKeys, questionMatchesSubjectTracks } from "./questionTrackFilters";
import type { Question } from "../types/quiz";

function makeQuestion(primaryTag: string, stem = "測試題"): Question {
  return {
    id: `track-test-${primaryTag}`,
    subject: "微生物免疫學",
    chapter: "舊章節",
    section: "舊分類",
    primaryTag,
    stem,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "測試詳解",
    testedConcept: "舊考點"
  };
}

test("微免三科散題以新 primaryTag 分流", () => {
  assert.deepEqual(getQuestionTrackKeys(makeQuestion("細菌學－革蘭氏陽性菌")), ["bacteria"]);
  assert.deepEqual(getQuestionTrackKeys(makeQuestion("病毒學－RNA 病毒")), ["virus"]);
  assert.deepEqual(getQuestionTrackKeys(makeQuestion("免疫學－先天免疫")), ["immunity"]);
});

test("真菌與跨科治療標籤會進入對應的既有三科題池", () => {
  assert.deepEqual(
    getQuestionTrackKeys(makeQuestion("真菌學－醫學真菌與抗真菌治療")),
    ["bacteria"]
  );
  assert.deepEqual(
    getQuestionTrackKeys(makeQuestion("微生物免疫學－抗病毒藥物")),
    ["virus"]
  );
  assert.deepEqual(
    getQuestionTrackKeys(makeQuestion("微生物免疫學－免疫調節治療")),
    ["immunity"]
  );
});

test("題幹提到其他子科不會再把題目混入多個題池", () => {
  const immuneQuestion = makeQuestion(
    "免疫學－免疫缺陷、移植、腫瘤與疫苗",
    "病毒感染後的抗體與 T 細胞反應為何？"
  );

  assert.deepEqual(getQuestionTrackKeys(immuneQuestion), ["immunity"]);
  assert.equal(questionMatchesSubjectTracks(immuneQuestion, "微生物免疫學", ["virus"]), false);
  assert.equal(questionMatchesSubjectTracks(immuneQuestion, "微生物免疫學", ["immunity"]), true);
});
