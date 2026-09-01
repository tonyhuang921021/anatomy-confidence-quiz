import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const libraryRoot = path.join(projectRoot, "public/data/pharmacology-library");
const batchRoot = path.join(libraryRoot, "batches");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toLookupId(id) {
  return id.replace(/^(MOEX-\d{6})_(\d{4}-Q\d{3})$/, "$1-$2");
}

const stage2 = readJson(
  path.join(projectRoot, "data/sources/moex_med_stage2_detailed_merged_001_3100_classified_v3.json")
).questions;
const latest = readJson(
  path.join(projectRoot, "data/sources/moex_115090_official_questions.json")
).med2Questions;
const availableIds = new Set([...stage2, ...latest].map((question) => toLookupId(question.id)));

const references = [];
for (const fileName of fs.readdirSync(batchRoot).filter((name) => name.endsWith(".json"))) {
  const batch = readJson(path.join(batchRoot, fileName));
  for (const drug of batch.drugs) {
    for (const exam of drug.exams ?? []) {
      references.push({ id: exam.id, drug: drug.name, period: exam.period, questionNo: exam.questionNo });
    }
  }
}

const uniqueReferences = [...new Map(references.map((reference) => [reference.id, reference])).values()];
const unresolved = uniqueReferences.filter((reference) => !availableIds.has(reference.id));

if (unresolved.length > 0) {
  console.error(JSON.stringify({ unresolved }, null, 2));
  throw new Error(`${unresolved.length} pharmacology exam IDs do not resolve to the question bank`);
}

console.log(
  JSON.stringify(
    {
      drugExamReferences: references.length,
      uniqueExamIds: uniqueReferences.length,
      resolvedExamIds: uniqueReferences.length
    },
    null,
    2
  )
);
