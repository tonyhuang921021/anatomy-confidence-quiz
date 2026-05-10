const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = "/Users/huangguanlun/Documents/New project";
const anatomyFile = path.join(projectRoot, "data/anatomyQuestions.ts");
const detailedJsonFile =
  "/Users/huangguanlun/Downloads/moex_anatomy_strict_detailed_v3_merged_001_973.json";

const difficultyMap = {
  基礎: "basic",
  易: "easy",
  中: "medium",
  中偏難: "hard",
  難: "hard"
};

function parseAnatomyFile(fileText) {
  const startMarker = "export const anatomyQuestions: Question[] = ";
  const outlineMarker = "\n\nexport const anatomyOutline = ";
  const start = fileText.indexOf(startMarker);
  const outlineStart = fileText.indexOf(outlineMarker);

  if (start === -1 || outlineStart === -1) {
    throw new Error("Could not parse anatomyQuestions.ts");
  }

  const questionsLiteral = fileText
    .slice(start + startMarker.length, outlineStart)
    .trim()
    .replace(/;$/, "");
  const outlineLiteral = fileText
    .slice(outlineStart + "\n\nexport const anatomyOutline = ".length)
    .trim();

  return {
    questions: vm.runInNewContext(questionsLiteral),
    outlineLiteral
  };
}

function compactOptions(question) {
  return {
    A: question.option_A || question.options?.A || "",
    B: question.option_B || question.options?.B || "",
    C: question.option_C || question.options?.C || "",
    D: question.option_D || question.options?.D || "",
    ...(question.option_E || question.options?.E ? { E: question.option_E || question.options?.E } : {})
  };
}

function toSourceRound(value) {
  if (value === "第一次") return 1;
  if (value === "第二次") return 2;
  return undefined;
}

function mapDifficulty(value) {
  return difficultyMap[String(value || "").trim()] || undefined;
}

function buildSourceCitation(question) {
  if (!question.exam_year_roc || !question.exam_session) return undefined;
  return `考選部 ${question.exam_year_roc} 年${question.exam_session}醫師一階醫學（一）`;
}

const anatomyText = fs.readFileSync(anatomyFile, "utf8");
const { questions, outlineLiteral } = parseAnatomyFile(anatomyText);
const detailedData = JSON.parse(fs.readFileSync(detailedJsonFile, "utf8"));

const currentById = new Map(questions.map((question) => [question.id, question]));
let mergedCount = 0;
let missingCount = 0;
const missingIds = [];

for (const detailedQuestion of detailedData.questions) {
  const currentQuestion = currentById.get(detailedQuestion.id);

  if (!currentQuestion) {
    missingCount += 1;
    if (missingIds.length < 20) {
      missingIds.push(detailedQuestion.id);
    }
    continue;
  }

  const explanation =
    detailedQuestion.detail_metadata?.explanation ||
    detailedQuestion.explanation ||
    currentQuestion.explanation;
  const testedConcept =
    detailedQuestion.detail_metadata?.exam_point ||
    detailedQuestion.exam_point ||
    currentQuestion.testedConcept;

  Object.assign(currentQuestion, {
    stem: detailedQuestion.stem || currentQuestion.stem,
    options: compactOptions(detailedQuestion),
    answer: detailedQuestion.answer || currentQuestion.answer,
    explanation,
    testedConcept,
    optionAnalysis:
      detailedQuestion.detail_metadata?.option_analysis ||
      detailedQuestion.option_analysis ||
      currentQuestion.optionAnalysis,
    memoryTip:
      detailedQuestion.detail_metadata?.memory_tip ||
      detailedQuestion.memory_tip ||
      currentQuestion.memoryTip,
    clinicalLink:
      detailedQuestion.detail_metadata?.clinical_link ||
      detailedQuestion.clinical_link ||
      currentQuestion.clinicalLink,
    answerConfidence:
      detailedQuestion.detail_metadata?.answer_confidence ||
      detailedQuestion.answer_confidence ||
      currentQuestion.answerConfidence,
    needsHumanReview:
      detailedQuestion.detail_metadata?.needs_human_review ??
      detailedQuestion.needs_human_review ??
      currentQuestion.needsHumanReview,
    reviewFlags:
      detailedQuestion.review_flags?.length ? detailedQuestion.review_flags : currentQuestion.reviewFlags,
    detailVersion:
      detailedQuestion.detail_metadata?.detail_version ||
      detailedData.metadata?.detail_version ||
      currentQuestion.detailVersion,
    sourceType: "MOEX_PAST_EXAM",
    sourceYear: detailedQuestion.exam_year_gregorian || currentQuestion.sourceYear,
    sourceRound: toSourceRound(detailedQuestion.exam_session) || currentQuestion.sourceRound,
    originalQuestionNumber: detailedQuestion.question_no || currentQuestion.originalQuestionNumber,
    sourceCitation: currentQuestion.sourceCitation || buildSourceCitation(detailedQuestion),
    difficulty: mapDifficulty(detailedQuestion.difficulty) || currentQuestion.difficulty
  });

  mergedCount += 1;
}

const output = `import type { Question } from "@/types/quiz";\n\nexport const anatomyQuestions: Question[] = ${JSON.stringify(
  questions,
  null,
  2
)};\n\nexport const anatomyOutline = ${outlineLiteral}\n`;

fs.writeFileSync(anatomyFile, output);
console.log(
  JSON.stringify(
    {
      mergedCount,
      missingCount,
      missingIds
    },
    null,
    2
  )
);
