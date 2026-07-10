const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const pilotDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");

function parseArgs(argv) {
  const options = { result: "", overrides: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--result") options.result = argv[index + 1] ?? "";
    if (argv[index] === "--overrides") {
      options.overrides = String(argv[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (!options.result) throw new Error("請用 --result 指定結果檔。");
  return options;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const resultPath = path.isAbsolute(options.result)
    ? options.result
    : path.join(pilotDir, options.result);
  const baseResult = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const overrideResults = options.overrides.map((filename) => {
    const overridePath = path.isAbsolute(filename) ? filename : path.join(pilotDir, filename);
    return {
      path: overridePath,
      payload: JSON.parse(fs.readFileSync(overridePath, "utf8"))
    };
  });
  const effectiveResultsById = new Map(
    baseResult.results.map((item) => [item.questionId, item])
  );
  overrideResults.forEach(({ payload }) => {
    payload.results.forEach((item) => effectiveResultsById.set(item.questionId, item));
  });
  const result = {
    ...baseResult,
    results: baseResult.results.map((item) => effectiveResultsById.get(item.questionId)),
    requests: [
      ...(baseResult.requests ?? []),
      ...overrideResults.flatMap(({ payload }) => payload.requests ?? [])
    ],
    usage: [baseResult, ...overrideResults.map(({ payload }) => payload)].reduce(
      (total, payload) => {
        Object.keys(total).forEach((key) => {
          total[key] += payload.usage?.[key] ?? 0;
        });
        return total;
      },
      { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
    ),
    estimatedStandardCostUsd: [baseResult, ...overrideResults.map(({ payload }) => payload)].reduce(
      (total, payload) => total + (payload.estimatedStandardCostUsd ?? 0),
      0
    )
  };
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const taxonomyGapId = taxonomy.taxonomyGap.id;
  const tagById = new Map(taxonomy.primaryTags.map((tag) => [tag.id, tag]));
  const tagCounts = new Map(taxonomy.primaryTags.map((tag) => [tag.id, 0]));
  const reviewReasonCounts = new Map();

  result.results.forEach((item) => {
    if (tagCounts.has(item.primaryTagId)) increment(tagCounts, item.primaryTagId);
    item.reviewReasons.forEach((reason) => increment(reviewReasonCounts, reason));
  });

  const subjectSummaries = taxonomy.scope.subjects.map((subject) => {
    const questions = result.results.filter((item) => item.trustedSubject === subject);
    const subjectTags = taxonomy.primaryTags.filter((tag) => tag.subject === subject);
    const selectedTagCounts = subjectTags
      .map((tag) => ({ id: tag.id, name: tag.name, count: tagCounts.get(tag.id) ?? 0 }))
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
    return {
      subject,
      questionCount: questions.length,
      assignedCount: questions.filter((item) => item.primaryTagId !== taxonomyGapId).length,
      taxonomyGapCount: questions.filter((item) => item.primaryTagId === taxonomyGapId).length,
      subjectConflictCount: questions.filter((item) => item.subjectConflict).length,
      needsReviewCount: questions.filter((item) => item.needsReview).length,
      lowConfidenceCount: questions.filter((item) => item.confidence < 0.85).length,
      averageConfidence: round(
        questions.reduce((sum, item) => sum + item.confidence, 0) / Math.max(questions.length, 1)
      ),
      selectedPrimaryTagCount: selectedTagCounts.filter((tag) => tag.count > 0).length,
      totalPrimaryTagCount: subjectTags.length,
      topTags: selectedTagCounts.filter((tag) => tag.count > 0).slice(0, 5),
      unselectedTags: selectedTagCounts.filter((tag) => tag.count === 0)
    };
  });

  const audit = {
    generatedAt: new Date().toISOString(),
    sourceResult: path.basename(resultPath),
    sourceOverrides: overrideResults.map(({ path: overridePath }) => path.basename(overridePath)),
    taxonomyId: taxonomy.taxonomyId,
    overall: {
      questionCount: result.results.length,
      assignedCount: result.results.filter((item) => item.primaryTagId !== taxonomyGapId).length,
      taxonomyGapCount: result.results.filter((item) => item.primaryTagId === taxonomyGapId).length,
      taxonomyGapRate: round(
        result.results.filter((item) => item.primaryTagId === taxonomyGapId).length /
          Math.max(result.results.length, 1)
      ),
      subjectConflictCount: result.results.filter((item) => item.subjectConflict).length,
      needsReviewCount: result.results.filter((item) => item.needsReview).length,
      lowConfidenceCount: result.results.filter((item) => item.confidence < 0.85).length,
      averageConfidence: round(
        result.results.reduce((sum, item) => sum + item.confidence, 0) /
          Math.max(result.results.length, 1)
      ),
      selectedPrimaryTagCount: [...tagCounts.values()].filter((count) => count > 0).length,
      totalPrimaryTagCount: taxonomy.primaryTags.length,
      answerQualityFlagCount: result.results.filter(
        (item) => (item.answerQualityFlags ?? []).length > 0
      ).length,
      conservativeAutoCandidateCount: result.results.filter(
        (item) =>
          item.primaryTagId !== taxonomyGapId &&
          !item.needsReview &&
          item.confidence >= 0.9
      ).length,
      retryRequestCount: result.requests.filter(
        (request) => (request.attempts ?? []).length > 1
      ).length,
      fallbackSplitRequestCount: result.requests.filter(
        (request) => (request.fallbackSplits ?? []).length > 0
      ).length,
      usage: result.usage,
      estimatedStandardCostUsd: result.estimatedStandardCostUsd
    },
    reviewReasonCounts: Object.fromEntries(
      [...reviewReasonCounts.entries()].sort((left, right) => right[1] - left[1])
    ),
    subjectSummaries,
    taxonomyGapQuestions: result.results.filter((item) => item.primaryTagId === taxonomyGapId),
    subjectConflictQuestions: result.results.filter((item) => item.subjectConflict),
    lowConfidenceQuestions: result.results.filter((item) => item.confidence < 0.85),
    tagDistribution: taxonomy.primaryTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      subject: tag.subject,
      count: tagCounts.get(tag.id) ?? 0
    }))
  };
  const outputPath = path.join(
    pilotDir,
    `audit-${result.results.length}-${path.basename(resultPath, ".json")}${
      overrideResults.length ? "-with-overrides" : ""
    }.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(audit, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(JSON.stringify(audit.overall, null, 2));
}

main();
