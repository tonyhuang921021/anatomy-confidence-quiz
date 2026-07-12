import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResultReviewNavigation,
  getResultReviewNavigationTargetIndex
} from "./resultReviewNavigation";

test("題目回顧依錯題、沒信心、全部題目的畫面順序串接", () => {
  const items = buildResultReviewNavigation([
    { label: "錯題", detailKeys: ["wrong-1", "wrong-2"] },
    { label: "沒信心", detailKeys: ["low-41", "low-78"] },
    { label: "全部", detailKeys: ["all-1", "all-2", "all-3"] }
  ]);

  assert.deepEqual(
    items.map(({ detailKey }) => detailKey),
    ["wrong-1", "wrong-2", "low-41", "low-78", "all-1", "all-2", "all-3"]
  );
  assert.deepEqual(items[3], {
    detailKey: "low-78",
    sectionLabel: "沒信心",
    sectionIndex: 1,
    sectionTotal: 2
  });
});

test("沒信心最後一題往下接全部第一題，往上可以回來", () => {
  const items = buildResultReviewNavigation([
    { label: "沒信心", detailKeys: ["low-41", "low-78"] },
    { label: "全部", detailKeys: ["all-1", "all-2"] }
  ]);
  const lastLowConfidenceIndex = items.findIndex(({ detailKey }) => detailKey === "low-78");
  const firstAllIndex = items.findIndex(({ detailKey }) => detailKey === "all-1");

  assert.equal(
    getResultReviewNavigationTargetIndex(items.length, lastLowConfidenceIndex, 1),
    firstAllIndex
  );
  assert.equal(
    getResultReviewNavigationTargetIndex(items.length, firstAllIndex, -1),
    lastLowConfidenceIndex
  );
});

test("尚未選題時，上下鍵分別從最後與第一個可見回顧項目開始", () => {
  assert.equal(getResultReviewNavigationTargetIndex(5, -1, 1), 0);
  assert.equal(getResultReviewNavigationTargetIndex(5, -1, -1), 4);
  assert.equal(getResultReviewNavigationTargetIndex(0, -1, 1), -1);
});
