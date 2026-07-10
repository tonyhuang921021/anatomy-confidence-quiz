const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const assignmentsPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagAssignments.json"
);
const inputPath = path.join(reportDir, "full-6200-input.json");

function main() {
  const assignmentsPayload = JSON.parse(fs.readFileSync(assignmentsPath, "utf8"));
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const inputById = new Map(input.questions.map((question) => [question.questionId, question]));
  const questions = Object.entries(assignmentsPayload.assignments)
    .filter(([, assignment]) => assignment.status === "review_required")
    .map(([questionId, assignment]) => {
      const source = inputById.get(questionId);
      if (!source) throw new Error(`找不到分類輸入：${questionId}`);
      return {
        ...source,
        repairReasons: ["final_review_required"],
        previousClassification: {
          primaryTagId: assignment.primaryTagId,
          primaryTag: assignment.primaryTag,
          secondaryTags: assignment.secondaryTags,
          taskType: assignment.taskType,
          confidence: assignment.modelConfidence,
          evidence: null,
          needsReview: true,
          subjectConflict: false,
          suggestedSubject: assignment.trustedSubject,
          reviewReasons: assignment.reviewReasons,
          answerQualityFlags: assignment.answerQualityFlags
        }
      };
    });

  if (questions.length !== assignmentsPayload.counts.reviewRequired) {
    throw new Error(
      `待覆核題數不一致：counts=${assignmentsPayload.counts.reviewRequired}, rows=${questions.length}`
    );
  }
  const output = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    questionCount: questions.length,
    taxonomyGapCount: questions.filter(
      (question) => question.previousClassification.primaryTagId === "taxonomyGap"
    ).length,
    subjectCounts: Object.fromEntries(
      [...new Set(questions.map((question) => question.trustedSubject))].map((subject) => [
        subject,
        questions.filter((question) => question.trustedSubject === subject).length
      ])
    ),
    questions
  };
  const outputPath = path.join(reportDir, `adjudication-${questions.length}-input.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        questionCount: output.questionCount,
        taxonomyGapCount: output.taxonomyGapCount,
        subjectCounts: output.subjectCounts
      },
      null,
      2
    )
  );
}

main();
