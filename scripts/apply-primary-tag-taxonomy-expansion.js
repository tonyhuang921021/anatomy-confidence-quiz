const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const reportDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const taxonomyPath = path.join(projectRoot, "data", "analysisPrimaryTagTaxonomy.json");
const reviewPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagExpansionReview.json"
);

function parseArgs(argv) {
  const options = { design: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--design") options.design = argv[index + 1] ?? "";
  }
  if (!options.design) throw new Error("請用 --design 指定 taxonomy gap 設計結果。");
  return options;
}

function resolveReportPath(filename) {
  return path.isAbsolute(filename) ? filename : path.join(reportDir, filename);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const designPath = resolveReportPath(options.design);
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  const design = JSON.parse(fs.readFileSync(designPath, "utf8"));
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  if (path.basename(designPath) !== review.sourceDesign) {
    throw new Error("人工覆核檔與 design 結果不一致。");
  }
  const existingIds = new Set(taxonomy.primaryTags.map((tag) => tag.id));
  const existingNames = new Set(taxonomy.primaryTags.map((tag) => tag.name));
  const rejectedIds = new Set(Object.keys(review.rejected));
  const additions = design.taxonomyAdditions
    .filter((tag) => !rejectedIds.has(tag.id))
    .map((proposedTag) => {
      const reviewedTag = {
        ...proposedTag,
        ...(review.tagOverrides[proposedTag.id] ?? {})
      };
      const { singleQuestionJustification, ...tag } = reviewedTag;
      return {
        ...tag,
        expansionEvidence: {
          sourceModel: design.model,
          sourcePromptVersion: design.promptVersion,
          sourceQuestionCount: design.decisions.filter(
            (decision) => decision.primaryTagId === proposedTag.id
          ).length,
          singleQuestionJustification: singleQuestionJustification || null
        }
      };
    });

  additions.forEach((tag) => {
    if (existingIds.has(tag.id) || existingNames.has(tag.name)) {
      throw new Error(`新增標籤與既有 taxonomy 衝突：${tag.id}`);
    }
    existingIds.add(tag.id);
    existingNames.add(tag.name);
  });
  const subjectOrder = new Map(
    taxonomy.scope.subjects.map((subject, index) => [subject, index])
  );
  const primaryTags = [...taxonomy.primaryTags, ...additions].sort(
    (left, right) =>
      subjectOrder.get(left.subject) - subjectOrder.get(right.subject) ||
      left.id.localeCompare(right.id)
  );
  const subjectSummary = taxonomy.subjectSummary.map((summary) => ({
    ...summary,
    primaryTagCount: primaryTags.filter((tag) => tag.subject === summary.subject).length
  }));
  const subjectCounts = subjectSummary.map((summary) => summary.primaryTagCount);
  const output = {
    ...taxonomy,
    schemaVersion: "1.1.0",
    primaryTags,
    subjectSummary,
    qualityAudit: {
      ...taxonomy.qualityAudit,
      status: "pass_with_monitoring",
      totalPrimaryTags: primaryTags.length,
      estimatedMeanQuestionsPerPrimaryTagAt6200Questions: Number(
        (6200 / primaryTags.length).toFixed(1)
      ),
      subjectCountRange: {
        minimum: Math.min(...subjectCounts),
        maximum: Math.max(...subjectCounts)
      },
      expansionAudit: {
        reviewedAt: review.reviewedAt,
        sourceDesign: review.sourceDesign,
        sourceModel: design.model,
        proposedCount: design.taxonomyAdditions.length,
        acceptedCount: additions.length,
        rejected: review.rejected
      }
    },
    sourceBasis: [
      ...taxonomy.sourceBasis,
      {
        sourceId: "AI_GAP_EXPANSION_20260710",
        statement:
          "gpt-5.4 compared 144 taxonomy-gap questions by official major subject; proposed chapter-level additions were schema-validated and manually reviewed before inclusion."
      }
    ]
  };
  fs.writeFileSync(taxonomyPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Updated: ${taxonomyPath}`);
  console.log(
    JSON.stringify(
      {
        previousTagCount: taxonomy.primaryTags.length,
        acceptedAdditions: additions.length,
        rejectedAdditions: rejectedIds.size,
        finalTagCount: primaryTags.length,
        subjectSummary
      },
      null,
      2
    )
  );
}

main();
