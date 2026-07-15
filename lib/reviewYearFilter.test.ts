import assert from "node:assert/strict";
import test from "node:test";
import type { Question, ReviewQuestionItem } from "@/types/quiz";
import {
  DEFAULT_REVIEW_YEAR_RANGE,
  filterReviewItemsByYear,
  normalizeReviewYearRange
} from "./reviewYearFilter";

function makeItem(id: string, sourceYear?: number): ReviewQuestionItem {
  const question: Question = {
    id,
    subject: "生理學",
    chapter: "循環",
    section: "血壓",
    stem: `${id} 題幹`,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "詳解",
    testedConcept: "血壓",
    sourceYear
  };

  return {
    question,
    riskScore: 1,
    history: {
      questionId: id,
      attempts: 1,
      wrong: 1,
      correct: 0,
      lowConfidence: 0,
      overconfidence: 0,
      correctStreakAfterLatestWrong: 0,
      correctStreakAfterLatestRisk: 0
    }
  };
}

test("待複習年份區間同時接受西元年與民國年", () => {
  const items = [makeItem("2022", 2022), makeItem("2024", 2024), makeItem("roc-113", 113)];
  const filtered = filterReviewItemsByYear(items, { yearFrom: 2023, yearTo: 2024 });

  assert.deepEqual(filtered.map((item) => item.question.id), ["2024", "roc-113"]);
});

test("縮小年份時排除無年份題，全年份時保留以避免舊紀錄消失", () => {
  const items = [makeItem("known", 2024), makeItem("unknown")];

  assert.deepEqual(
    filterReviewItemsByYear(items, { yearFrom: 2024, yearTo: 2024 }).map(
      (item) => item.question.id
    ),
    ["known"]
  );
  assert.deepEqual(
    filterReviewItemsByYear(items, DEFAULT_REVIEW_YEAR_RANGE).map(
      (item) => item.question.id
    ),
    ["known", "unknown"]
  );
});

test("反向與超出範圍的年份會正規化到可選區間", () => {
  assert.deepEqual(normalizeReviewYearRange({ yearFrom: 2027, yearTo: 2010 }), {
    yearFrom: 2011,
    yearTo: 2026
  });
  assert.deepEqual(normalizeReviewYearRange({ yearFrom: 2027, yearTo: 2028 }), {
    yearFrom: 2026,
    yearTo: 2026
  });
});
