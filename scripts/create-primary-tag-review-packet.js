const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");

function parseArgs(argv) {
  const options = {
    result: "",
    overrides: [],
    input: "full-6200-input.json",
    perSubject: 20
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--result") options.result = argv[index + 1] ?? "";
    if (argv[index] === "--overrides") {
      options.overrides = String(argv[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (argv[index] === "--input") options.input = argv[index + 1] ?? options.input;
    if (argv[index] === "--per-subject") {
      options.perSubject = Number(argv[index + 1] ?? options.perSubject);
    }
  }
  if (!options.result) throw new Error("請用 --result 指定分類結果檔。");
  if (!Number.isInteger(options.perSubject) || options.perSubject < 1) {
    throw new Error("--per-subject 必須是正整數。");
  }
  return options;
}

function resolveReportPath(filename) {
  return path.isAbsolute(filename) ? filename : path.join(reportDir, filename);
}

function stableScore(value, salt) {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function pickDistinct(items, count, salt, usedIds = new Set()) {
  return [...items]
    .sort((left, right) =>
      stableScore(left.questionId, salt).localeCompare(stableScore(right.questionId, salt))
    )
    .filter((item) => !usedIds.has(item.questionId))
    .slice(0, count);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const resultPath = resolveReportPath(options.result);
  const inputPath = resolveReportPath(options.input);
  const baseResult = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const overrideResults = options.overrides.map((filename) => {
    const overridePath = resolveReportPath(filename);
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
    ]
  };
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const inputQuestions = input.questions ?? input;
  const inputById = new Map(inputQuestions.map((question) => [question.questionId, question]));
  const requestRiskByQuestionId = new Map();

  (result.requests ?? []).forEach((request) => {
    const retryCount = Math.max((request.attempts ?? []).length - 1, 0);
    const splitCount = (request.fallbackSplits ?? []).length;
    request.questionIds.forEach((questionId) => {
      requestRiskByQuestionId.set(questionId, { retryCount, splitCount });
    });
  });

  const joined = result.results.map((classification) => ({
    ...classification,
    input: inputById.get(classification.questionId),
    requestRisk: requestRiskByQuestionId.get(classification.questionId) ?? {
      retryCount: 0,
      splitCount: 0
    }
  }));
  const conservativeCandidates = joined.filter(
    (item) =>
      item.primaryTagId !== taxonomy.taxonomyGap.id &&
      !item.needsReview &&
      item.confidence >= 0.9
  );

  const usedIds = new Set();
  const byTag = taxonomy.primaryTags.map((tag) => {
    const candidates = conservativeCandidates.filter((item) => item.primaryTagId === tag.id);
    const selected = pickDistinct(candidates, 1, `tag:${tag.id}`, usedIds)[0] ?? null;
    if (selected) usedIds.add(selected.questionId);
    return { tag, candidateCount: candidates.length, selected };
  });

  const randomBySubject = taxonomy.scope.subjects.flatMap((subject) => {
    const candidates = conservativeCandidates.filter((item) => item.trustedSubject === subject);
    const selected = pickDistinct(candidates, options.perSubject, `subject:${subject}`, usedIds);
    selected.forEach((item) => usedIds.add(item.questionId));
    return selected;
  });

  const retryCandidates = conservativeCandidates.filter(
    (item) => item.requestRisk.retryCount > 0 || item.requestRisk.splitCount > 0
  );
  const retrySample = pickDistinct(retryCandidates, 60, "retry-risk", usedIds);
  retrySample.forEach((item) => usedIds.add(item.questionId));

  function compact(item, stratum) {
    if (!item) return null;
    return {
      stratum,
      questionId: item.questionId,
      trustedSubject: item.trustedSubject,
      primaryTagId: item.primaryTagId,
      primaryTag: item.primaryTag,
      confidence: item.confidence,
      taskType: item.taskType,
      evidence: item.evidence,
      secondaryTags: item.secondaryTags,
      stem: item.input?.stem ?? null,
      options: item.input?.options ?? null,
      correctAnswers: item.input?.correctAnswers ?? null,
      effectiveExplanation: item.input?.effectiveExplanation ?? null,
      explanationSource: item.input?.explanationSource ?? null,
      existingChapter: item.input?.validationOnly?.existingChapter ?? null,
      existingSubtopic: item.input?.validationOnly?.existingSubtopic ?? null,
      existingTestedConcept: item.input?.validationOnly?.existingTestedConcept ?? null,
      requestRisk: item.requestRisk,
      humanReview: {
        verdict: "pending",
        correctedPrimaryTagId: null,
        note: ""
      }
    };
  }

  const packet = {
    generatedAt: new Date().toISOString(),
    sourceResult: path.basename(resultPath),
    sourceOverrides: overrideResults.map(({ path: overridePath }) =>
      path.basename(overridePath)
    ),
    sourceInput: path.basename(inputPath),
    samplingPolicy: {
      conservativeCandidateDefinition:
        "固定 taxonomy、無 needsReview、confidence >= 0.90；答案品質旗標不等於分類不可信",
      perTag: "每個 primaryTag 以固定雜湊抽 1 題",
      perSubject: `每科額外以固定雜湊抽 ${options.perSubject} 題`,
      retryRisk: "從曾重試或拆批的合格題中額外固定抽樣最多 60 題"
    },
    population: {
      total: joined.length,
      conservativeCandidates: conservativeCandidates.length
    },
    samples: [
      ...byTag.map(({ tag, selected }) => compact(selected, `per_tag:${tag.id}`)).filter(Boolean),
      ...randomBySubject.map((item) => compact(item, `per_subject:${item.trustedSubject}`)),
      ...retrySample.map((item) => compact(item, "retry_or_split"))
    ],
    tagCoverage: byTag.map(({ tag, candidateCount, selected }) => ({
      tagId: tag.id,
      tagName: tag.name,
      conservativeCandidateCount: candidateCount,
      sampledQuestionId: selected?.questionId ?? null
    }))
  };
  const outputPath = path.join(
    reportDir,
    `review-packet-${packet.samples.length}-${path.basename(resultPath, ".json")}${
      overrideResults.length ? "-with-overrides" : ""
    }.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(packet, null, 2));
  console.log(`Output: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        population: packet.population,
        sampleCount: packet.samples.length,
        perTagCount: byTag.filter(({ selected }) => selected).length,
        perSubjectCount: randomBySubject.length,
        retryRiskCount: retrySample.length,
        unsampledTags: byTag.filter(({ selected }) => !selected).map(({ tag }) => tag.id)
      },
      null,
      2
    )
  );
}

main();
