const fs = require("fs");
const path = require("path");
const { getMoexPaperGroup, getMoexPrimarySubject } = require("./moex-primary-subject");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");

function parseArgs(argv) {
  const options = { result: "", input: "full-6200-input.json" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--result") options.result = argv[index + 1] ?? "";
    if (argv[index] === "--input") options.input = argv[index + 1] ?? options.input;
  }
  if (!options.result) throw new Error("請用 --result 指定第一階段分類結果檔。");
  return options;
}

function resolveReportPath(filename) {
  return path.isAbsolute(filename) ? filename : path.join(reportDir, filename);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const resultPath = resolveReportPath(options.result);
  const inputPath = resolveReportPath(options.input);
  const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const inputQuestions = input.questions ?? input;
  const resultById = new Map(result.results.map((item) => [item.questionId, item]));
  const repairResults = inputQuestions
    .map((source) => ({ source, previousClassification: resultById.get(source.questionId) }))
    .filter(({ source, previousClassification }) => {
      if (!previousClassification) throw new Error(`找不到第一階段結果：${source.questionId}`);
      return (
        previousClassification.trustedSubject !== getMoexPrimarySubject(source.questionId) ||
        previousClassification.primaryTagId === "taxonomyGap" ||
        previousClassification.needsReview ||
        previousClassification.confidence < 0.9
      );
    });
  const questions = repairResults.map(({ source, previousClassification }) => {
    const trustedSubject = getMoexPrimarySubject(source.questionId);
    const repairReasons = [];
    if (previousClassification.trustedSubject !== trustedSubject) {
      repairReasons.push("official_subject_mismatch");
    }
    if (previousClassification.primaryTagId === "taxonomyGap") {
      repairReasons.push("previous_taxonomy_gap");
    }
    if (previousClassification.needsReview) repairReasons.push("previous_needs_review");
    if (previousClassification.confidence < 0.9) repairReasons.push("previous_low_confidence");
    return {
      ...source,
      legacyTrustedSubject: previousClassification.trustedSubject,
      trustedSubject,
      sourceGroup: getMoexPaperGroup(source.questionId),
      repairReasons,
      previousClassification: {
        primaryTagId: previousClassification.primaryTagId,
        primaryTag: previousClassification.primaryTag,
        secondaryTags: previousClassification.secondaryTags,
        taskType: previousClassification.taskType,
        confidence: previousClassification.confidence,
        evidence: previousClassification.evidence,
        needsReview: previousClassification.needsReview,
        subjectConflict: previousClassification.subjectConflict,
        suggestedSubject: previousClassification.suggestedSubject,
        reviewReasons: previousClassification.reviewReasons,
        answerQualityFlags: previousClassification.answerQualityFlags ?? []
      }
    };
  });
  if (questions.length === 0) throw new Error("沒有題目符合修復條件。");

  const output = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceResult: path.basename(resultPath),
    sourceInput: path.basename(inputPath),
    selectionPolicy:
      "official subject mismatch, taxonomyGap, model needsReview, or model confidence below 0.90; answer-quality flags alone are not selected",
    questionCount: questions.length,
    questions
  };
  const outputPath = path.join(reportDir, `repair-${questions.length}-input.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(`Questions: ${questions.length}`);
}

main();
