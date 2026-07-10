const assert = require("node:assert/strict");
const test = require("node:test");
const assignments = require("../data/analysisPrimaryTagAssignments.json");
const displayMap = require("../data/analysisPrimaryTagDisplayMap.json");

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
