import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResultReviewNavigation,
  filterResultReviewItems,
  getDefaultResultReviewFilter,
  getResultReviewDetailKey,
  getResultReviewHref,
  getResultReviewNavigationTargetIndex
} from "./resultReviewNavigation";

const items = [
  { attempt: { questionId: "q1", isCorrect: false, confidence: 4 }, questionNumber: 1 },
  { attempt: { questionId: "q2", isCorrect: true, confidence: 2 }, questionNumber: 2 },
  { attempt: { questionId: "q3", isCorrect: true, confidence: 4 }, questionNumber: 3 },
  { attempt: { questionId: "q4", isCorrect: false, confidence: 2 }, questionNumber: 4 }
];

test("回顧只列目前篩選，不重複錯題和答對但沒信心的題目", () => {
  assert.deepEqual(filterResultReviewItems(items, "wrong").map((item) => item.questionNumber), [1, 4]);
  assert.deepEqual(filterResultReviewItems(items, "low-confidence").map((item) => item.questionNumber), [2]);
  assert.deepEqual(filterResultReviewItems(items, "all").map((item) => item.questionNumber), [1, 2, 3, 4]);
});

test("篩選與信心地圖使用同一題目key且保留原題號", () => {
  const wrongItems = filterResultReviewItems(items, "wrong");
  assert.equal(getResultReviewDetailKey(wrongItems[1]), getResultReviewDetailKey(items[3]));
  assert.equal(getResultReviewDetailKey(wrongItems[1]), "all-q4-4");
  const navigation = buildResultReviewNavigation([{
    label: "錯題", detailKeys: wrongItems.map(getResultReviewDetailKey)
  }]);
  assert.deepEqual(navigation, [
    { detailKey: "all-q1-1", sectionLabel: "錯題", sectionIndex: 0, sectionTotal: 2 },
    { detailKey: "all-q4-4", sectionLabel: "錯題", sectionIndex: 1, sectionTotal: 2 }
  ]);
  assert.equal(getResultReviewNavigationTargetIndex(navigation.length, 1, 1), 1);
});

test("預設先錯題，全對時先看沒信心，無待補強或關閉信心時看全部", () => {
  assert.equal(getDefaultResultReviewFilter(items, true), "wrong");
  const correct = items.filter(({ attempt }) => attempt.isCorrect);
  assert.equal(getDefaultResultReviewFilter(correct, true), "low-confidence");
  assert.equal(getDefaultResultReviewFilter(correct, false), "all");
  assert.equal(getDefaultResultReviewFilter([items[2]], true), "all");
  assert.equal(getDefaultResultReviewFilter([], true), "all");
});

test("結果複習入口保留模考、自訂卷與其複習來源", () => {
  for (const settings of [{ mode: "simulation" }, { mode: "review", customPoolLabel: "模擬考錯題庫" }]) {
    assert.equal(getResultReviewHref(settings), "/simulation-review");
  }
  for (const settings of [{ mode: "custom_paper" }, { mode: "review", customPoolLabel: "自訂卷錯題庫" }]) {
    assert.equal(getResultReviewHref(settings), "/custom-papers/review");
  }
  assert.equal(getResultReviewHref({ mode: "random" }), "/review");
  assert.equal(getResultReviewHref({ mode: "review", customPoolLabel: "散題待複習題庫" }), "/review");
  assert.equal(getResultReviewHref(), "/review");
});

test("尚未選題時上下鍵從最後或第一個可見項目開始，空列表不可導覽", () => {
  assert.equal(getResultReviewNavigationTargetIndex(5, -1, 1), 0);
  assert.equal(getResultReviewNavigationTargetIndex(5, -1, -1), 4);
  assert.equal(getResultReviewNavigationTargetIndex(0, -1, 1), -1);
});
