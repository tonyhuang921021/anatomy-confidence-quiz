const assert = require("node:assert/strict");
const test = require("node:test");
const assignments = require("../data/analysisPrimaryTagAssignments.json");
const displayMap = require("../data/analysisPrimaryTagDisplayMap.json");
const runtimeMap = require("../data/analysisPrimaryTagRuntimeMap.json");

const ALLOWED_SUBJECTS = new Set([
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學",
  "藥理學",
  "病理學"
]);
const SUBJECT_BY_CODE = Array.from(ALLOWED_SUBJECTS);
const EXPECTED_SUBJECT_COUNTS = {
  "解剖學": 922,
  "組織學": 297,
  "胚胎學": 142,
  "生理學": 811,
  "生物化學": 811,
  "微生物免疫學": 933,
  "寄生蟲學": 230,
  "公共衛生學": 504,
  "藥理學": 775,
  "病理學": 775
};

test("正式站 primaryTag 顯示映射涵蓋全部 6200 題", () => {
  assert.equal(Object.keys(displayMap).length, 6200);
  assert.deepEqual(Object.keys(displayMap), Object.keys(assignments.assignments));
});

test("有 primaryTag 的題目完整保留，taxonomy gap 明確使用 null", () => {
  for (const [questionId, assignment] of Object.entries(assignments.assignments)) {
    assert.equal(displayMap[questionId], assignment.primaryTag);
  }

  assert.equal(
    Object.values(displayMap).filter((primaryTag) => primaryTag === null).length,
    23
  );
});

test("正式站 runtime 分類同時保留 6200 題的可信科目與版本時間", () => {
  assert.equal(Object.keys(runtimeMap.questions).length, 6200);
  assert.ok(Number.isFinite(Date.parse(runtimeMap.classifiedAt)));

  for (const [questionId, assignment] of Object.entries(assignments.assignments)) {
    const runtime = runtimeMap.questions[questionId];
    assert.ok(runtime, `${questionId} 缺少 runtime 分類`);
    assert.equal(runtime[0], assignment.primaryTag);
    assert.equal(SUBJECT_BY_CODE[runtime[1]], assignment.trustedSubject || assignment.tagSubject);
    assert.ok(ALLOWED_SUBJECTS.has(SUBJECT_BY_CODE[runtime[1]]), `${questionId} 的 runtime 科目不正確`);
    if (runtime[0]) {
      assert.match(runtime[0], /^[^－]+－.+$/u, `${questionId} 的標籤沒有科目前綴`);
    }
  }
});

test("全題庫各大科數量與已覆核分類批次一致", () => {
  const subjectCounts = Object.values(runtimeMap.questions).reduce((counts, runtime) => {
    const subject = SUBJECT_BY_CODE[runtime[1]];
    counts[subject] = (counts[subject] ?? 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(subjectCounts, EXPECTED_SUBJECT_COUNTS);
  assert.equal(Object.values(subjectCounts).reduce((total, count) => total + count, 0), 6200);
});

test("2024 第二次病理題維持病理學，不被舊題號規則帶到生理", () => {
  assert.deepEqual(runtimeMap.questions["MOEX-113090-2301-Q094"], [
    "病理學－內分泌系統疾病",
    9
  ]);
  assert.deepEqual(runtimeMap.questions["MOEX-113090-2301-Q100"], [
    "病理學－神經系統疾病",
    9
  ]);
});
