const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const assignmentsPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagAssignments.json"
);
const outputPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagDisplayMap.json"
);
const runtimeOutputPath = path.join(
  projectRoot,
  "data",
  "analysisPrimaryTagRuntimeMap.json"
);

const ALLOWED_SUBJECTS = new Set([
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學",
  "藥理學",
  "病理學"
]);
const SUBJECT_CODES = new Map(
  Array.from(ALLOWED_SUBJECTS).map((subject, index) => [subject, index])
);

function getClassifiedAt(payload) {
  const timestamps = [
    payload.classifier?.completedAt,
    ...(payload.classifier?.repairs ?? []).map((repair) => repair?.completedAt)
  ]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    throw new Error("找不到 primaryTag 分類完成時間");
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function main() {
  const payload = JSON.parse(fs.readFileSync(assignmentsPath, "utf8"));
  const entries = Object.entries(payload.assignments ?? {});
  const displayMap = Object.fromEntries(
    entries.map(([questionId, assignment]) => {
      const primaryTag = assignment?.primaryTag?.trim() || null;

      return [questionId, primaryTag];
    })
  );

  if (Object.keys(displayMap).length !== 6200) {
    throw new Error(`顯示標籤題數不符：${Object.keys(displayMap).length}`);
  }

  const runtimeQuestions = Object.fromEntries(
    entries.map(([questionId, assignment]) => {
      const subject = assignment?.trustedSubject?.trim() || assignment?.tagSubject?.trim();
      if (!ALLOWED_SUBJECTS.has(subject)) {
        throw new Error(`${questionId} 的可信科目不正確：${subject || "空白"}`);
      }

      return [
        questionId,
        [assignment?.primaryTag?.trim() || null, SUBJECT_CODES.get(subject)]
      ];
    })
  );
  const runtimeMap = {
    classifiedAt: getClassifiedAt(payload),
    questions: runtimeQuestions
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(displayMap)}\n`);
  fs.writeFileSync(runtimeOutputPath, `${JSON.stringify(runtimeMap)}\n`);
  console.log(`Output: ${outputPath}`);
  console.log(`Runtime: ${runtimeOutputPath}`);
  console.log(`Questions: ${Object.keys(displayMap).length}`);
}

main();
