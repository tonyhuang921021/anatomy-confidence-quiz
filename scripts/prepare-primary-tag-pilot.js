const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "reports", "primary-tag-pilot");
const med1Path = path.join(
  projectRoot,
  "data",
  "sources",
  "moex_med1_100_115_reclassified_v5.json"
);
const med2Path = path.join(
  projectRoot,
  "data",
  "sources",
  "moex_med_stage2_detailed_merged_001_3100_classified_v3.json"
);

const canonicalSubjects = [
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學"
];

function parseArgs(argv) {
  const options = { perSubject: 3 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--per-subject") {
      options.perSubject = Number(argv[index + 1]) || options.perSubject;
    }
  }
  if (!Number.isInteger(options.perSubject) || options.perSubject < 1) {
    throw new Error("--per-subject 必須是正整數。");
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeSubject(value) {
  const subject = String(value ?? "").trim();
  if (subject.includes("解剖")) return "解剖學";
  if (subject.includes("組織")) return "組織學";
  if (subject.includes("胚胎") || subject.includes("發育")) return "胚胎學";
  if (subject.includes("生理")) return "生理學";
  if (subject.includes("生物化學") || subject.includes("分子生物")) return "生物化學";
  if (subject.includes("藥理")) return "藥理學";
  if (subject.includes("病理")) return "病理學";
  if (subject.includes("寄生蟲")) return "寄生蟲學";
  if (subject.includes("公共衛生")) return "公共衛生學";
  if (subject.includes("微生物") || subject.includes("免疫")) return "微生物免疫學";
  return "";
}

function normalizeQuestion(raw, sourceGroup) {
  const classification =
    sourceGroup === "醫學一"
      ? raw.classification_v5 ?? {}
      : raw.classification_v1 ?? {};
  const trustedSubject = normalizeSubject(
    classification.med1_current_five_subject ??
      classification.primary_subject ??
      classification.primary_subject_exact
  );
  if (!raw.id || !trustedSubject || !raw.stem || !raw.options) return null;

  const correctAnswers = Array.isArray(raw.correct_answers)
    ? raw.correct_answers
    : [raw.answer ?? raw.official_answer_raw].filter(Boolean);
  const explanation = String(raw.explanation ?? raw.detail_metadata?.explanation ?? "").trim();
  const existingSubtopic = String(
    classification.subtopic ?? raw.subject_group_keyword ?? raw.exam_point ?? ""
  ).trim();

  return {
    questionId: raw.id,
    sourceGroup,
    trustedSubject,
    stem: String(raw.stem).trim(),
    options: Object.fromEntries(
      Object.entries(raw.options)
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([key, value]) => [key, value.trim()])
    ),
    correctAnswers,
    answerCreditType: String(raw.answer_credit_type ?? "standard"),
    answerNote: String(raw.answer_note ?? "").trim(),
    effectiveExplanation: explanation,
    validationOnly: {
      existingSubtopic,
      existingClassificationConfidence: classification.confidence ?? null,
      existingClassificationMethod:
        classification.classification_method ?? classification.method ?? null
    }
  };
}

function inputLength(question) {
  return [
    question.stem,
    ...Object.values(question.options),
    question.correctAnswers.join(","),
    question.effectiveExplanation
  ].join("\n").length;
}

function selectVariedQuestions(questions, count) {
  if (questions.length <= count) return [...questions];
  const sorted = [...questions].sort((left, right) => {
    return inputLength(left) - inputLength(right) || left.questionId.localeCompare(right.questionId);
  });
  const selected = [];

  for (let index = 0; index < count; index += 1) {
    const quantile = (index + 0.5) / count;
    let candidateIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * quantile));
    while (selected.includes(sorted[candidateIndex]) && candidateIndex + 1 < sorted.length) {
      candidateIndex += 1;
    }
    selected.push(sorted[candidateIndex]);
  }

  return selected;
}

function toModelInput(question) {
  return {
    questionId: question.questionId,
    subject: question.trustedSubject,
    stem: question.stem,
    options: question.options,
    correctAnswers: question.correctAnswers,
    answerCreditType: question.answerCreditType,
    answerNote: question.answerNote,
    explanation: question.effectiveExplanation
  };
}

function buildPromptPreview(questions) {
  return [
    "這是題目輸入預覽；正式 prompt 由 run-primary-tag-pilot.js 搭配 analysisPrimaryTagTaxonomy.json 產生。",
    "primaryTagId 只能從題目大科的固定 taxonomy 選擇；大科衝突只標記覆核，不直接跨科改寫。",
    "一律給分題忽略失效答案鍵，改依題幹、選項與詳解判斷原始考點。",
    "secondaryTags 必須是繁體中文細部考點，不可使用 taxonomy ID。",
    "",
    JSON.stringify(questions.map(toModelInput), null, 2)
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const med1 = (readJson(med1Path).questions ?? [])
    .map((question) => normalizeQuestion(question, "醫學一"))
    .filter(Boolean);
  const med2 = (readJson(med2Path).questions ?? [])
    .map((question) => normalizeQuestion(question, "醫學二"))
    .filter(Boolean);
  const allQuestions = [...med1, ...med2];
  const selected = canonicalSubjects.flatMap((subject) => {
    const candidates = allQuestions.filter((question) => question.trustedSubject === subject);
    return selectVariedQuestions(candidates, options.perSubject);
  });
  const inputFilename = `pilot-${selected.length}-input.json`;
  const previewFilename = `pilot-${selected.length}-prompt-preview.txt`;

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, inputFilename),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceQuestionCount: allQuestions.length,
        selectedQuestionCount: selected.length,
        selectedPerSubject: options.perSubject,
        subjectCounts: Object.fromEntries(
          canonicalSubjects.map((subject) => [
            subject,
            selected.filter((question) => question.trustedSubject === subject).length
          ])
        ),
        questions: selected
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(outputDir, previewFilename),
    buildPromptPreview(selected)
  );

  console.log(`Source questions: ${allQuestions.length}`);
  console.log(`Selected questions: ${selected.length}`);
  console.log(`Selected per subject: ${options.perSubject}`);
  console.log(`Input: ${path.join(outputDir, inputFilename)}`);
  console.log(`Output: ${outputDir}`);
}

main();
