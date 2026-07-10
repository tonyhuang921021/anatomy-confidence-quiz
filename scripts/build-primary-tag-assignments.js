const fs = require("fs");
const path = require("path");
const {
  getMoexPaperGroup,
  getMoexPrimarySubject
} = require("./moex-primary-subject");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");
const overridesPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagManualOverrides.json"
);
const outputPath = path.join(projectRoot, "data", "analysisPrimaryTagAssignments.json");

function parseArgs(argv) {
  const options = { result: "", repairs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--result") options.result = argv[index + 1] ?? "";
    if (argv[index] === "--repair") {
      options.repairs.push(
        ...String(argv[index + 1] ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }
  }
  if (!options.result) throw new Error("請用 --result 指定分類結果檔。");
  return options;
}

function resolveResultPath(filename) {
  return path.isAbsolute(filename) ? filename : path.join(reportDir, filename);
}

function isConservativeCandidate(item, taxonomyGapId) {
  return (
    item.primaryTagId !== taxonomyGapId &&
    !item.needsReview &&
    item.confidence >= 0.9
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const resultPath = resolveResultPath(options.result);
  const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const repairs = options.repairs.map((filename) => {
    const repairPath = resolveResultPath(filename);
    return {
      path: repairPath,
      payload: JSON.parse(fs.readFileSync(repairPath, "utf8"))
    };
  });
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const manualOverrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
  const tagById = new Map(taxonomy.primaryTags.map((tag) => [tag.id, tag]));
  const overrides = manualOverrides.overrides ?? {};
  const seenQuestionIds = new Set();
  const counts = {
    total: 0,
    accepted: 0,
    manualOverride: 0,
    reviewRequired: 0
  };

  Object.entries(overrides).forEach(([questionId, override]) => {
    if (
      override.primaryTagId !== taxonomy.taxonomyGap.id &&
      !tagById.has(override.primaryTagId)
    ) {
      throw new Error(`${questionId} 的人工覆寫標籤不在固定 taxonomy。`);
    }
    if (override.forceReview && override.primaryTagId !== taxonomy.taxonomyGap.id) {
      throw new Error(`${questionId} forceReview 時必須使用 taxonomyGap。`);
    }
  });

  const effectiveResultsById = new Map(
    result.results.map((item) => [item.questionId, item])
  );
  repairs.forEach(({ payload }) => {
    payload.results.forEach((item) => {
      if (!effectiveResultsById.has(item.questionId)) {
        throw new Error(`修復結果找不到原始題目：${item.questionId}`);
      }
      effectiveResultsById.set(item.questionId, item);
    });
  });
  const effectiveResults = result.results.map((item) =>
    effectiveResultsById.get(item.questionId)
  );

  const assignments = Object.fromEntries(
    [...effectiveResults]
      .sort((left, right) => left.questionId.localeCompare(right.questionId))
      .map((item) => {
        if (seenQuestionIds.has(item.questionId)) {
          throw new Error(`分類結果有重複 questionId：${item.questionId}`);
        }
        seenQuestionIds.add(item.questionId);
        const override = overrides[item.questionId];
        const primaryTagId = override?.primaryTagId ?? item.primaryTagId;
        const selectedTag = tagById.get(primaryTagId);
        const trustedSubject = getMoexPrimarySubject(item.questionId);
        const sourceGroup = getMoexPaperGroup(item.questionId);
        if (item.trustedSubject !== trustedSubject) {
          throw new Error(
            `${item.questionId} 的 trustedSubject 不是官方題號分科：${item.trustedSubject} != ${trustedSubject}`
          );
        }
        if (selectedTag && selectedTag.subject !== trustedSubject) {
          throw new Error(
            `${item.questionId} 的 primaryTag 不屬於官方大科：${selectedTag.subject} != ${trustedSubject}`
          );
        }
        const accepted = isConservativeCandidate(item, taxonomy.taxonomyGap.id);
        const status = override
          ? override.forceReview
            ? "review_required"
            : "manual_override"
          : accepted
            ? "accepted"
            : "review_required";
        counts.total += 1;
        if (status === "manual_override") counts.manualOverride += 1;
        if (status === "accepted") counts.accepted += 1;
        if (status === "review_required") counts.reviewRequired += 1;

        return [
          item.questionId,
          {
            primaryTagId,
            primaryTag: selectedTag?.name ?? null,
            tagSubject: selectedTag?.subject ?? null,
            secondaryTags: item.secondaryTags,
            taskType: item.taskType,
            modelConfidence: item.confidence,
            status,
            sourceGroup,
            trustedSubject,
            suggestedSubject: trustedSubject,
            reviewReasons: item.reviewReasons ?? [],
            answerQualityFlags: item.answerQualityFlags ?? [],
            manualOverrideReason: override?.reason ?? null
          }
        ];
      })
  );

  const missingOverrides = Object.keys(overrides).filter(
    (questionId) => !seenQuestionIds.has(questionId)
  );
  if (missingOverrides.length > 0) {
    throw new Error(`人工覆寫找不到題目：${missingOverrides.join(", ")}`);
  }
  if (counts.total !== result.questionCount || counts.total !== 6200) {
    throw new Error(`題數不符：result=${result.questionCount}, assignments=${counts.total}`);
  }
  const assignmentValues = Object.values(assignments);
  const sourceGroupCounts = Object.fromEntries(
    ["醫學一", "醫學二"].map((sourceGroup) => [
      sourceGroup,
      assignmentValues.filter((item) => item.sourceGroup === sourceGroup).length
    ])
  );
  const subjectCounts = Object.fromEntries(
    taxonomy.scope.subjects.map((subject) => [
      subject,
      assignmentValues.filter((item) => item.trustedSubject === subject).length
    ])
  );
  if (sourceGroupCounts["醫學一"] + sourceGroupCounts["醫學二"] !== counts.total) {
    throw new Error(`最終試卷分組遺漏：${JSON.stringify(sourceGroupCounts)}`);
  }

  const output = {
    schemaVersion: "1.0.0",
    taxonomyId: taxonomy.taxonomyId,
    taxonomySchemaVersion: taxonomy.schemaVersion,
    classifier: {
      model: result.model,
      promptVersion: result.promptVersion,
      completedAt: result.completedAt,
      sourceResult: path.basename(resultPath),
      repairs: repairs.map(({ path: repairPath, payload }) => ({
        model: payload.model,
        promptVersion: payload.promptVersion,
        completedAt: payload.completedAt,
        sourceRepair: path.basename(repairPath)
      }))
    },
    safetyPolicy: {
      accepted:
        "Fixed taxonomy, no review flag, and model confidence >= 0.90. Answer-quality flags are tracked separately.",
      manualOverride: "Human-reviewed deterministic correction.",
      reviewRequired: "Must not be used in automatic weakness analysis."
    },
    counts: {
      ...counts,
      sourceGroups: sourceGroupCounts,
      subjects: subjectCounts
    },
    assignments
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
  console.log(`Output: ${outputPath}`);
  console.log(JSON.stringify(counts, null, 2));
}

main();
