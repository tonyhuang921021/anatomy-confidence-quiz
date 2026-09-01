import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PHARMACOLOGY_LIBRARY_SCOPES,
  filterPharmacologyLibraryItems,
  getPharmacologyExamPeriods,
  sortPharmacologyLibraryExams,
  type PharmacologyLibraryExam,
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
    exams: [],
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
    exams: [],
    searchText: "Amiodarone 心臟 抗心律不整 Class III 肺纖維化"
  }
];

test("空白查詢會保留目前範圍內所有藥物", () => {
  assert.deepEqual(
    filterPharmacologyLibraryItems(ITEMS, "  ", "心臟").map((item) => item.id),
    ["amiodarone"]
  );
});

test("國考題依最近考期排序並去除重複題目", () => {
  const exams: PharmacologyLibraryExam[] = [
    { id: "older", period: "107-1", questionNo: 72, verificationStatus: "verified_mention" },
    { id: "newer-b", period: "114-2", questionNo: 55, verificationStatus: "verified_exam_target" },
    { id: "newer-a", period: "114-2", questionNo: 8, verificationStatus: "verified_exam_target" },
    { id: "older", period: "107-1", questionNo: 72, verificationStatus: "verified_mention" }
  ];

  assert.deepEqual(sortPharmacologyLibraryExams(exams).map((exam) => exam.id), ["newer-a", "newer-b", "older"]);
  assert.deepEqual(getPharmacologyExamPeriods(exams), ["114-2", "107-1"]);
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
