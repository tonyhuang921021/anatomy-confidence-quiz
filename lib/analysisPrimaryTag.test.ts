import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAnalysisPrimaryTagClassification,
  applyClassificationOverrideWithPrimaryTagPriority,
  getQuestionPrimaryTag,
  primaryTagIncludesSubject
} from "./analysisPrimaryTag";
import type { Question, QuestionClassificationOverride } from "../types/quiz";

function makeQuestion(id: string, subject: Question["subject"] = "生理學"): Question {
  return {
    id,
    subject,
    chapter: subject,
    section: "舊分類",
    primaryTag: "沒有科目前綴的舊標籤",
    stem: "測試題",
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "測試",
    testedConcept: "測試"
  };
}

test("6200 題新分類會同時校正科目與完整 primaryTag", () => {
  const q94 = applyAnalysisPrimaryTagClassification(
    makeQuestion("MOEX-113090-2301-Q094")
  );
  const q100 = applyAnalysisPrimaryTagClassification(
    makeQuestion("MOEX-113090-2301-Q100")
  );

  assert.equal(q94.subject, "病理學");
  assert.equal(getQuestionPrimaryTag(q94), "病理學－內分泌系統疾病");
  assert.equal(q100.subject, "病理學");
  assert.equal(getQuestionPrimaryTag(q100), "病理學－神經系統疾病");
});

test("舊雲端 override 不會再蓋掉新 6200 題分類", () => {
  const oldOverride: QuestionClassificationOverride = {
    questionId: "MOEX-113090-2301-Q094",
    subject: "生理學",
    chapter: "副甲狀腺生理",
    section: "副甲狀腺素與鈣磷恆定",
    updatedAt: "2026-07-08T06:45:53.317Z"
  };

  const result = applyClassificationOverrideWithPrimaryTagPriority(
    makeQuestion(oldOverride.questionId),
    oldOverride
  );

  assert.equal(result.subject, "病理學");
  assert.equal(getQuestionPrimaryTag(result), "病理學－內分泌系統疾病");
});

test("6200 題之外的新人工分類仍會補上科目前綴", () => {
  const customQuestion = makeQuestion("CUSTOM-QUESTION-1", "解剖學");
  const override: QuestionClassificationOverride = {
    questionId: customQuestion.id,
    subject: "藥理學",
    chapter: "心血管藥理",
    section: "降血壓藥",
    updatedAt: "2026-07-11T00:00:00.000Z"
  };

  const result = applyClassificationOverrideWithPrimaryTagPriority(customQuestion, override);
  assert.equal(result.subject, "藥理學");
  assert.equal(getQuestionPrimaryTag(result), "藥理學－降血壓藥");
});

test("微生物各子科標籤已自帶科目，不重複顯示微生物免疫學", () => {
  assert.equal(primaryTagIncludesSubject("細菌學－革蘭氏陽性菌", "微生物免疫學"), true);
  assert.equal(primaryTagIncludesSubject("病毒學－RNA 病毒", "微生物免疫學"), true);
  assert.equal(primaryTagIncludesSubject("免疫學－先天免疫", "微生物免疫學"), true);
});

test("taxonomy gap 題目也會用可信大科補上原小節前綴", () => {
  const question = makeQuestion("MOEX-100030-1101-Q098", "生理學");
  question.section = "篩檢指標判讀";

  assert.equal(getQuestionPrimaryTag(question), "公共衛生學－篩檢指標判讀");
});
