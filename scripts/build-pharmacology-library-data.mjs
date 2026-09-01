import fs from "node:fs";
import path from "node:path";

const packageRoot = process.argv[2];
const outputRoot = process.argv[3] ?? path.join(process.cwd(), "public/data/pharmacology-library");

if (!packageRoot) {
  throw new Error("Usage: node scripts/build-pharmacology-library-data.mjs <package-root> [output-root]");
}

const QA_FILE_PATTERN = /^batch_(\d{3})\.qa\.jsonl$/;
const DISPLAYABLE_MNEMONIC_POLICIES = new Set(["eligible", "eligible_with_unverified_label"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current);
  return cells;
}

function readScopeMap(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const idIndex = headers.indexOf("drugId");
  const scopeIndex = headers.indexOf("複習範圍（可多選）");
  const scopeMap = new Map();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const drugId = cells[idIndex]?.trim();
    if (!drugId) continue;
    scopeMap.set(
      drugId,
      (cells[scopeIndex] ?? "")
        .split("|")
        .map((scope) => scope.trim())
        .filter(Boolean)
    );
  }

  return scopeMap;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanMnemonicDisplayText(value) {
  return value
    .replace(/\s*[<＜][^>＞]*(?:取自|改自|來自)[^>＞]*[>＞]/gu, "")
    .replace(/\s*[（(][^（）()]*(?:取自|改自|來自)[^（）()]*[）)]\s*/gu, " ")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

function collectStatements(value, pathLabel = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStatements(item, pathLabel));
  }

  if (!value || typeof value !== "object") return [];

  if (typeof value.text === "string" && value.text.trim()) {
    return [
      {
        text: value.text.trim(),
        sourceIds: unique(Array.isArray(value.sourceIds) ? value.sourceIds : []),
        scope: typeof value.scope === "string" && value.scope.trim() ? value.scope.trim() : null,
        detail: pathLabel || null
      }
    ];
  }

  return Object.entries(value).flatMap(([key, nested]) => collectStatements(nested, key));
}

function collectClinicalGroup(clinicalContent, keys) {
  return keys.flatMap((key) => collectStatements(clinicalContent?.[key], key));
}

function legacyValues(drug, field) {
  const variants = drug.legacyTrace?.legacyFieldVariants?.[field];
  if (!Array.isArray(variants)) return [];

  return unique(
    variants
      .slice()
      .sort((left, right) => Number(right.count ?? 0) - Number(left.count ?? 0))
      .map((variant) => (typeof variant.value === "string" ? variant.value.trim() : ""))
      .filter((value) => value && value !== "這筆藥物目前沒有對應口訣。")
  );
}

function makeSummaryItems(drug, field, sourceIds) {
  return legacyValues(drug, field).map((text) => ({ text, sourceIds }));
}

function safeExternalUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
}

const summary = readJson(path.join(packageRoot, "package_summary.json"));
const scopeMap = readScopeMap(path.join(packageRoot, "drug_review_scope_mapping.csv"));
const batchRoot = path.join(packageRoot, "reviewed_batches");
const batchNames = fs.readdirSync(batchRoot).filter((name) => /^batch_\d{3}$/.test(name)).sort();
const batches = new Map();
const sourceById = new Map();
const allDrugs = [];

for (const source of readJson(path.join(packageRoot, "mnemonic_audit/mnemonic_evidence_sources.json"))) {
  if (source?.sourceId) sourceById.set(source.sourceId, source);
}

for (const batchName of batchNames) {
  const batchDirectory = path.join(batchRoot, batchName);
  const qaFilename = fs.readdirSync(batchDirectory).find((name) => QA_FILE_PATTERN.test(name));
  if (!qaFilename) throw new Error(`Missing QA JSONL in ${batchDirectory}`);

  const drugs = readJsonl(path.join(batchDirectory, qaFilename));
  batches.set(batchName, drugs);
  for (const drug of drugs) {
    allDrugs.push({ batch: batchName, drug });
    for (const source of drug.sources ?? []) {
      if (source?.sourceId) sourceById.set(source.sourceId, source);
    }
  }
}

const mnemonicByDrugId = new Map();
const categoryMnemonics = [];
const mnemonicSegments = readJsonl(path.join(packageRoot, "mnemonic_audit/mnemonic_segments.reviewed.jsonl"));

function addMnemonic(drugId, mnemonic) {
  const existing = mnemonicByDrugId.get(drugId) ?? [];
  if (!existing.some((item) => item.segmentId === mnemonic.segmentId)) existing.push(mnemonic);
  mnemonicByDrugId.set(drugId, existing);
}

for (const segment of mnemonicSegments) {
  if (!DISPLAYABLE_MNEMONIC_POLICIES.has(segment.displayPolicy)) continue;

  const mnemonic = {
    segmentId: segment.segmentId,
    text: cleanMnemonicDisplayText(segment.text),
    sourceIds: unique(segment.medicalClaimReview?.sourceIds ?? [])
  };
  const relations = (segment.placementReview?.relations ?? []).filter((relation) => relation.status === "verified");
  const directDrugIds = unique(
    relations
      .filter((relation) => relation.targetType === "drug")
      .map((relation) => relation.targetDrugId)
  );

  for (const drugId of directDrugIds) addMnemonic(drugId, mnemonic);

  if (directDrugIds.length === 0) {
    for (const relation of relations) {
      if (relation.targetType === "category_path" && relation.targetCategoryPath) {
        categoryMnemonics.push({ categoryPath: relation.targetCategoryPath, mnemonic });
      }
    }
  }
}

for (const { drug } of allDrugs) {
  const categoryPaths = (drug.categoryLinks ?? []).map((link) => link.displayPath).filter(Boolean);
  for (const { categoryPath, mnemonic } of categoryMnemonics) {
    if (categoryPaths.some((drugPath) => drugPath === categoryPath || drugPath.startsWith(`${categoryPath} >`))) {
      addMnemonic(drug.drugId, mnemonic);
    }
  }
}

const indexDrugs = [];
const outputBatches = new Map();

for (const { batch, drug } of allDrugs) {
  const clinicalContent = drug.clinicalContent ?? {};
  const mechanismStatements = collectClinicalGroup(clinicalContent, [
    "mechanismOfAction",
    "pharmacodynamics",
    "clinicalEffects"
  ]);
  const indicationStatements = collectClinicalGroup(clinicalContent, [
    "approvedIndications",
    "evidenceSupportedOffLabelUses"
  ]);
  const adverseStatements = collectClinicalGroup(clinicalContent, [
    "adverseEffects",
    "boxedWarnings",
    "contraindications",
    "warningsAndPrecautions"
  ]);
  const practicalStatements = collectClinicalGroup(clinicalContent, [
    "pharmacokinetics",
    "interactions",
    "monitoring",
    "specialPopulations",
    "toxicityAndOverdose"
  ]);
  const pearlStatements = collectClinicalGroup(clinicalContent, ["examPearls"]);
  const allDrugSourceIds = unique((drug.sources ?? []).map((source) => source.sourceId));
  const sourceIdsFor = (statements) => {
    const statementSourceIds = unique(statements.flatMap((statement) => statement.sourceIds));
    return statementSourceIds.length > 0 ? statementSourceIds : allDrugSourceIds.slice(0, 2);
  };
  const scopes = scopeMap.get(drug.drugId) ?? [];
  const categories = (drug.categoryLinks ?? []).map((link) => ({
    path: link.displayPath,
    sourceIds: unique(link.sourceIds ?? [])
  }));
  const directExams = (drug.examEvidence ?? []).filter(
    (item) => item.verificationStatus === "verified_exam_target"
  );
  const mentionExams = (drug.examEvidence ?? []).filter(
    (item) => item.verificationStatus === "verified_mention"
  );
  const level = legacyValues(drug, "examLevel")[0] ?? null;
  const summarySections = [
    {
      key: "mechanism",
      label: "機轉",
      items: makeSummaryItems(drug, "mechanism", sourceIdsFor(mechanismStatements))
    },
    {
      key: "indications",
      label: "用途",
      items: makeSummaryItems(drug, "indications", sourceIdsFor(indicationStatements))
    },
    {
      key: "effects",
      label: "考點",
      items: makeSummaryItems(
        drug,
        "effects",
        sourceIdsFor([...pearlStatements, ...mechanismStatements])
      )
    },
    {
      key: "adverseEffects",
      label: "副作用",
      items: makeSummaryItems(drug, "adverseEffects", sourceIdsFor(adverseStatements))
    }
  ].filter((section) => section.items.length > 0);

  const usedSourceIds = unique([
    ...mechanismStatements,
    ...indicationStatements,
    ...adverseStatements,
    ...practicalStatements,
    ...pearlStatements,
    ...summarySections.flatMap((section) => section.items),
    ...(mnemonicByDrugId.get(drug.drugId) ?? []),
    ...categories
  ].flatMap((item) => item.sourceIds ?? []));
  const sources = usedSourceIds.flatMap((sourceId) => {
    const source = sourceById.get(sourceId);
    const url = safeExternalUrl(source?.url);
    if (!source || !url) return [];
    return [{
      sourceId,
      title: source.title ?? source.publisher ?? "資料來源",
      publisher: source.publisher ?? null,
      url,
      locator: source.locator ?? null
    }];
  });

  const publicDrug = {
    id: drug.drugId,
    name: drug.canonicalName,
    aliases: unique([...(drug.aliases ?? []), ...(drug.brandNames ?? [])]),
    scopes,
    categories,
    level,
    summarySections,
    mnemonics: mnemonicByDrugId.get(drug.drugId) ?? [],
    detailGroups: [
      { key: "mechanism", label: "機轉與藥效", statements: mechanismStatements },
      { key: "indications", label: "用途", statements: indicationStatements },
      { key: "adverse", label: "副作用、警語與禁忌", statements: adverseStatements },
      { key: "practical", label: "藥物特性與使用重點", statements: practicalStatements },
      { key: "pearls", label: "國考重點", statements: pearlStatements }
    ].filter((group) => group.statements.length > 0),
    exams: [...directExams, ...mentionExams].map((exam) => ({
      id: exam.canonicalQuestionId,
      period: exam.examPeriod,
      questionNo: exam.questionNo,
      subject: exam.subject,
      relation: exam.relation,
      verificationStatus: exam.verificationStatus,
      questionUrl: safeExternalUrl(exam.questionPdfUrl),
      answerUrl: safeExternalUrl(exam.standardAnswerPdfUrl),
      amendedAnswerUrl: safeExternalUrl(exam.amendedAnswerPdfUrl)
    })),
    sources
  };

  const outputBatch = outputBatches.get(batch) ?? [];
  outputBatch.push(publicDrug);
  outputBatches.set(batch, outputBatch);

  indexDrugs.push({
    id: publicDrug.id,
    name: publicDrug.name,
    aliases: publicDrug.aliases,
    scopes,
    categories: categories.map((category) => category.path),
    level,
    batch,
    directExamCount: directExams.length,
    mentionExamCount: mentionExams.length,
    exams: publicDrug.exams.map((exam) => ({
      id: exam.id,
      period: exam.period,
      questionNo: exam.questionNo,
      verificationStatus: exam.verificationStatus
    })),
    searchText: unique([
      publicDrug.name,
      ...publicDrug.aliases,
      ...scopes,
      ...categories.map((category) => category.path),
      ...summarySections.flatMap((section) => section.items.map((item) => item.text))
    ]).join(" ")
  });
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(outputRoot, "batches"), { recursive: true });

const index = {
  generatedAt: summary.generatedAt,
  total: indexDrugs.length,
  scopes: unique(indexDrugs.flatMap((drug) => drug.scopes)).sort((left, right) => left.localeCompare(right, "zh-Hant")),
  drugs: indexDrugs.sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }))
};

fs.writeFileSync(path.join(outputRoot, "index.json"), JSON.stringify(index));
for (const [batch, drugs] of outputBatches) {
  fs.writeFileSync(path.join(outputRoot, "batches", `${batch}.json`), JSON.stringify({ batch, drugs }));
}

console.log(
  JSON.stringify({
    outputRoot,
    drugs: index.drugs.length,
    batches: outputBatches.size,
    mnemonics: [...mnemonicByDrugId.values()].reduce((sum, items) => sum + items.length, 0),
    scopes: index.scopes
  }, null, 2)
);
