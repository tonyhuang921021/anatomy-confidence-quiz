const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { getMoexPaperGroup, getMoexPrimarySubject } = require("./moex-primary-subject");

const projectRoot = path.resolve(__dirname, "..");
const assignmentsPayload = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "analysisPrimaryTagAssignments.json"), "utf8")
);
const taxonomy = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json"), "utf8")
);
const manualOverrides = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "analysisPrimaryTagManualOverrides.json"), "utf8")
).overrides;

const tagById = new Map(taxonomy.primaryTags.map((tag) => [tag.id, tag]));
const assignments = Object.entries(assignmentsPayload.assignments);
const actualStatusCounts = {
  accepted: 0,
  manualOverride: 0,
  reviewRequired: 0
};
const actualSourceGroupCounts = { "醫學一": 0, "醫學二": 0 };
const actualSubjectCounts = Object.fromEntries(
  taxonomy.scope.subjects.map((subject) => [subject, 0])
);

assert.equal(assignments.length, 6200);
assignments.forEach(([questionId, assignment]) => {
  assert.equal(assignment.sourceGroup, getMoexPaperGroup(questionId), questionId);
  assert.equal(assignment.trustedSubject, getMoexPrimarySubject(questionId), questionId);
  actualSourceGroupCounts[assignment.sourceGroup] += 1;
  actualSubjectCounts[assignment.trustedSubject] += 1;

  if (assignment.status === "accepted") actualStatusCounts.accepted += 1;
  else if (assignment.status === "manual_override") actualStatusCounts.manualOverride += 1;
  else if (assignment.status === "review_required") actualStatusCounts.reviewRequired += 1;
  else assert.fail(`${questionId} 的 status 不合法：${assignment.status}`);

  if (assignment.primaryTagId === taxonomy.taxonomyGap.id) {
    assert.equal(assignment.status, "review_required", questionId);
    assert.equal(assignment.primaryTag, null, questionId);
    assert.equal(assignment.tagSubject, null, questionId);
    return;
  }

  const tag = tagById.get(assignment.primaryTagId);
  assert.ok(tag, `${questionId} 找不到 primaryTagId`);
  assert.equal(tag.subject, assignment.trustedSubject, questionId);
  assert.equal(tag.name, assignment.primaryTag, questionId);
  assert.equal(tag.subject, assignment.tagSubject, questionId);
});

assert.deepEqual(actualSourceGroupCounts, assignmentsPayload.counts.sourceGroups);
assert.deepEqual(actualSubjectCounts, assignmentsPayload.counts.subjects);
assert.equal(actualStatusCounts.accepted, assignmentsPayload.counts.accepted);
assert.equal(actualStatusCounts.manualOverride, assignmentsPayload.counts.manualOverride);
assert.equal(actualStatusCounts.reviewRequired, assignmentsPayload.counts.reviewRequired);
assert.equal(
  actualStatusCounts.accepted +
    actualStatusCounts.manualOverride +
    actualStatusCounts.reviewRequired,
  assignmentsPayload.counts.total
);

Object.entries(manualOverrides).forEach(([questionId, override]) => {
  const assignment = assignmentsPayload.assignments[questionId];
  assert.ok(assignment, `人工覆寫找不到題目：${questionId}`);
  assert.equal(assignment.primaryTagId, override.primaryTagId, questionId);
  assert.equal(
    assignment.status,
    override.forceReview ? "review_required" : "manual_override",
    questionId
  );
});

console.log("primary-tag assignment tests passed");
