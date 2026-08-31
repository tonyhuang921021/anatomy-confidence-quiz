import assert from "node:assert/strict";
import test from "node:test";
import { PHARMACOLOGY_FLASHCARDS } from "../data/pharmacologyFlashcards";
import {
  ALL_PHARMACOLOGY_REVIEW_SCOPE,
  PHARMACOLOGY_REVIEW_SCOPES,
  getPharmacologyReviewCardIndexes,
  getPharmacologyReviewScopes,
  normalizePharmacologyReviewScope
} from "./pharmacologyReviewScope";

test("所有既有藥卡都能歸入至少一個複習範圍", () => {
  const unmapped = PHARMACOLOGY_FLASHCARDS.filter(
    (card) => getPharmacologyReviewScopes(card.category).length === 0
  );

  assert.deepEqual(unmapped.map((card) => `${card.name}｜${card.category}`), []);
});

test("全部藥物保留原始順序與全部卡片", () => {
  const indexes = getPharmacologyReviewCardIndexes(
    PHARMACOLOGY_FLASHCARDS,
    ALL_PHARMACOLOGY_REVIEW_SCOPE
  );

  assert.equal(indexes.length, PHARMACOLOGY_FLASHCARDS.length);
  assert.deepEqual(indexes, PHARMACOLOGY_FLASHCARDS.map((_, index) => index));
});

test("十二個範圍都有卡片且只包含該範圍", () => {
  for (const scope of PHARMACOLOGY_REVIEW_SCOPES) {
    const indexes = getPharmacologyReviewCardIndexes(PHARMACOLOGY_FLASHCARDS, scope);
    assert.ok(indexes.length > 0, `${scope} 不可為空`);
    assert.ok(
      indexes.every((index) => getPharmacologyReviewScopes(PHARMACOLOGY_FLASHCARDS[index]!.category).includes(scope)),
      `${scope} 混入其他範圍`
    );
  }
});

test("跨領域分類會同時出現在兩個相關範圍", () => {
  assert.deepEqual(getPharmacologyReviewScopes("自泌素/腸胃 > Histamine > H2 blocker"), [
    "自泌素／發炎",
    "腸胃道"
  ]);
  assert.deepEqual(getPharmacologyReviewScopes("泌尿/膽鹼拮抗 > OAB"), ["泌尿", "神經／精神"]);
  assert.deepEqual(getPharmacologyReviewScopes("麻醉科/毒物學 > 惡性高熱"), ["麻醉／止痛", "毒物"]);
  assert.deepEqual(getPharmacologyReviewScopes("泌尿科/毒物學 > 止痛"), ["泌尿", "毒物"]);
});

test("同一藥物的不同舊分類可以落在不同範圍", () => {
  const amiodaroneScopes = new Set(
    PHARMACOLOGY_FLASHCARDS.filter((card) => card.name === "Amiodarone")
      .flatMap((card) => getPharmacologyReviewScopes(card.category))
  );

  assert.ok(amiodaroneScopes.has("心臟"));
  assert.ok(amiodaroneScopes.has("內分泌／代謝"));
});

test("損壞或舊版儲存值會安全回到全部藥物", () => {
  assert.equal(normalizePharmacologyReviewScope("腸胃道"), "腸胃道");
  assert.equal(normalizePharmacologyReviewScope("未知章節"), ALL_PHARMACOLOGY_REVIEW_SCOPE);
  assert.equal(normalizePharmacologyReviewScope(null), ALL_PHARMACOLOGY_REVIEW_SCOPE);
});
