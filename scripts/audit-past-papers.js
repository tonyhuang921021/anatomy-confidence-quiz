const fs = require("fs");
const vm = require("vm");

const VISIBLE_SINGLE_SUBJECTS = new Set([
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
]);

function loadExport(filePath, exportName) {
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(/^import .*$/gm, "");
  const exportStart = source.search(new RegExp(`export const ${exportName}(?::[^=]+)? =`));
  if (exportStart === -1) {
    throw new Error(`Cannot find export ${exportName} in ${filePath}`);
  }
  const nextExport = source.indexOf("\nexport const ", exportStart + 1);
  source = source.slice(exportStart, nextExport === -1 ? undefined : nextExport);
  source = source.replace(
    new RegExp(`export const ${exportName}(?::[^=]+)? =`),
    "globalThis.__out ="
  );
  source = source.replace(/\s+as const;?\s*$/m, ";");
  source = source.replace(/ as const/g, "");
  source = source.replace(/^export default .*$/gm, "");
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { timeout: 10_000 });
  return context.globalThis.__out;
}

function normalizeSubject(rawSubject = "") {
  const subject = rawSubject.trim();
  if (!subject) return "其他醫學一";
  if (subject.includes("解剖")) return "解剖學";
  if (subject.includes("組織")) return "組織學";
  if (subject.includes("胚胎") || subject.includes("發育生物")) return "胚胎學";
  if (subject.includes("生理")) return "生理學";
  if (
    subject.includes("生物化學") ||
    subject.includes("分子生物") ||
    subject.includes("細胞生物")
  ) {
    return "生物化學";
  }
  if (subject.includes("寄生蟲")) return "寄生蟲學";
  if (subject.includes("公共衛生")) return "公共衛生學";
  if (subject.includes("微生物") || subject.includes("免疫")) return "微生物免疫學";
  if (subject.includes("藥理")) return "藥理學";
  if (subject.includes("病理")) return "病理學";
  return "其他醫學一";
}

function fillPastPaperMetadata(question) {
  if (question.examCode && question.paperCode && question.originalQuestionNumber) {
    return question;
  }

  const idMatch = String(question.id || "").match(/^MOEX-(\d+)-(\d+)-Q(\d+)$/i);
  if (!idMatch) return question;
  const [, examCode, paperCode, questionNumber] = idMatch;
  return {
    ...question,
    examCode: question.examCode ?? examCode,
    paperCode: question.paperCode ?? paperCode,
    originalQuestionNumber:
      question.originalQuestionNumber ?? Number.parseInt(questionNumber, 10)
  };
}

function toRemainingQuestion(raw) {
  const acceptedAnswers = (raw.correct_answers ?? [])
    .map((value) => String(value).trim())
    .filter(Boolean);
  const primaryAnswer = String(raw.answer ?? acceptedAnswers[0] ?? "").trim();
  if (!primaryAnswer) return null;
  if (raw.answer_credit_type === "multiple_answers") return null;

  return {
    id: raw.id,
    subject: normalizeSubject(raw.classification_v4?.primary_subject),
    sourceType: raw.source_type === "MOEX_PAST_EXAM" ? "MOEX_PAST_EXAM" : "AI_GENERATED",
    examCode: raw.exam_code,
    paperCode: raw.paper_code,
    originalQuestionNumber: raw.question_no,
    sourceYear: raw.exam_year_gregorian,
    examSessionLabel: raw.exam_session,
    answerCreditType:
      raw.answer_credit_type === "multiple"
        ? "multiple_accepted"
        : raw.answer_credit_type ?? "standard",
    reviewFlags: raw.review_flags ?? [],
    explanation: raw.explanation ?? "",
    optionAnalysis: raw.option_analysis ?? {},
    memoryTip: raw.memory_tip
  };
}

function toMissingQuestion(raw) {
  const rawAnswers = [raw.corrected_answer, raw.official_answer].flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : []
  );
  const primaryAnswer = String(rawAnswers[0] ?? "").trim();
  if (!primaryAnswer) return null;
  if (raw.answer_credit_type === "multiple_answers") return null;
  const [examCode, paperCode] = String(raw.exam_code ?? "").split("-");

  return {
    id: raw.id,
    subject: normalizeSubject(raw.classification_v5?.primary_subject),
    sourceType: "MOEX_PAST_EXAM",
    examCode,
    paperCode,
    originalQuestionNumber: raw.question_no,
    sourceYear: raw.year,
    examSessionLabel: raw.exam_round,
    answerCreditType:
      raw.answer_credit_type === "multiple"
        ? "multiple_accepted"
        : raw.answer_credit_type ?? "standard",
    reviewFlags: raw.review_flags ?? [],
    explanation: raw.explanation ?? "",
    optionAnalysis: raw.option_analysis ?? {},
    memoryTip: raw.memory_tip
  };
}

function scoreQuestion(question) {
  return (
    (question.reviewFlags?.includes("missing_question_filled_v5") ? 100 : 0) +
    (question.answerCreditType === "all_credit" ? 20 : 0) +
    (question.answerCreditType === "multiple_accepted" ? 18 : 0) +
    Math.min(String(question.explanation ?? "").length, 400) +
    Object.keys(question.optionAnalysis ?? {}).length * 20 +
    (question.memoryTip ? 10 : 0)
  );
}

function uniqueQuestionsByPaperSlot(questions) {
  const grouped = new Map();

  questions.forEach((question) => {
    if (question.sourceType !== "MOEX_PAST_EXAM") return;
    const normalized = fillPastPaperMetadata(question);
    if (!normalized.examCode || !normalized.paperCode || !normalized.originalQuestionNumber) return;
    const key = `${normalized.examCode}-${normalized.paperCode}-${normalized.originalQuestionNumber}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(normalized);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.values()).map((bucket) =>
    [...bucket].sort((a, b) => scoreQuestion(b) - scoreQuestion(a))[0]
  );
}

const anatomyQuestions = loadExport("data/anatomyQuestions.ts", "anatomyQuestions");
const remainingSource = loadExport(
  "data/sources/moex_med1_remaining_detailed_v4_merged_001_1827.ts",
  "moexMed1RemainingDetailedV4Merged0011827"
);
const missingQuestions = loadExport(
  "data/sources/moex_med1_missing_22_questions_detailed_v5.ts",
  "moexMed1Missing22QuestionsDetailedV5"
);

const normalizedRemaining = remainingSource.questions.map(toRemainingQuestion).filter(Boolean);
const normalizedMissing = missingQuestions.map(toMissingQuestion).filter(Boolean);

const wholePaperQuestions = uniqueQuestionsByPaperSlot([
  ...anatomyQuestions,
  ...normalizedRemaining,
  ...normalizedMissing
]);

const perPaper = new Map();
wholePaperQuestions.forEach((question) => {
  const paperKey = `${question.examCode}-${question.paperCode}`;
  const paper = perPaper.get(paperKey) ?? {
    paperKey,
    label: `${question.sourceYear ?? ""} ${question.examSessionLabel ?? ""} 醫學（一） ${question.paperCode}`,
    wholePaperNumbers: new Set(),
    singleSubjectNumbers: new Set(),
    wholePaperOnlyNumbers: new Set()
  };

  paper.wholePaperNumbers.add(question.originalQuestionNumber);
  if (VISIBLE_SINGLE_SUBJECTS.has(question.subject)) {
    paper.singleSubjectNumbers.add(question.originalQuestionNumber);
  } else {
    paper.wholePaperOnlyNumbers.add(question.originalQuestionNumber);
  }

  perPaper.set(paperKey, paper);
});

const report = Array.from(perPaper.values())
  .map((paper) => {
    const missingFromAnyBank = [];
    for (let number = 1; number <= 100; number += 1) {
      if (!paper.wholePaperNumbers.has(number)) {
        missingFromAnyBank.push(number);
      }
    }

    return {
      paperKey: paper.paperKey,
      label: paper.label,
      singleSubjectVisible: Array.from(paper.singleSubjectNumbers).sort((a, b) => a - b),
      wholePaperOnly: Array.from(paper.wholePaperOnlyNumbers).sort((a, b) => a - b),
      missingFromAnyBank,
      wholePaperCount: paper.wholePaperNumbers.size,
      singleSubjectCount: paper.singleSubjectNumbers.size
    };
  })
  .sort((a, b) => a.paperKey.localeCompare(b.paperKey));

const summary = {
  totalPapers: report.length,
  completePapers: report.filter((paper) => paper.missingFromAnyBank.length === 0).length,
  papersWithWholePaperOnlyQuestions: report.filter((paper) => paper.wholePaperOnly.length > 0).length,
  papersStillMissingQuestions: report.filter((paper) => paper.missingFromAnyBank.length > 0).length
};

console.log(JSON.stringify({ summary, report }, null, 2));
