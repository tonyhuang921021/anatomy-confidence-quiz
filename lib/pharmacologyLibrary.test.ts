import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PHARMACOLOGY_LIBRARY_SCOPES,
  filterPharmacologyLibraryItems,
  type PharmacologyLibraryIndexItem
} from "./pharmacologyLibrary";

const ITEMS: PharmacologyLibraryIndexItem[] = [
  {
    id: "amantadine",
    name: "Amantadine",
    aliases: [],
    scopes: ["感染", "神經／精神"],
    categories: ["感染科 > 抗流感"],
    level: "A",
    batch: "batch_001",
    directExamCount: 1,
    mentionExamCount: 3,
    searchText: "Amantadine 感染 神經／精神 抗流感 M2 ion channel Parkinson"
  },
  {
    id: "amiodarone",
    name: "Amiodarone",
    aliases: [],
    scopes: ["心臟"],
    categories: ["心臟科 > 抗心律不整"],
    level: "A",
    batch: "batch_001",
    directExamCount: 2,
    mentionExamCount: 4,
    searchText: "Amiodarone 心臟 抗心律不整 Class III 肺纖維化"
  }
];

test("空白查詢會保留目前範圍內所有藥物", () => {
  assert.deepEqual(
    filterPharmacologyLibraryItems(ITEMS, "  ", "心臟").map((item) => item.id),
    ["amiodarone"]
  );
});

test("搜尋會正規化大小寫與全形字", () => {
  assert.deepEqual(
    filterPharmacologyLibraryItems(ITEMS, "ＡＭＡＮＴＡＤＩＮＥ", ALL_PHARMACOLOGY_LIBRARY_SCOPES).map(
      (item) => item.id
    ),
    ["amantadine"]
  );
});

test("可用中文考點搜尋並同時套用範圍", () => {
  assert.deepEqual(
    filterPharmacologyLibraryItems(ITEMS, "肺纖維化", "心臟").map((item) => item.id),
    ["amiodarone"]
  );
  assert.equal(filterPharmacologyLibraryItems(ITEMS, "肺纖維化", "感染").length, 0);
});
