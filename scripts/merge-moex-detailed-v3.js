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

const anatomyOutline = [
  {
    chapter: "神經解剖",
    sections: ["腦神經", "腦幹核區", "視覺路徑", "聽覺與前庭路徑", "丘腦與基底核", "小腦", "脊髓傳導路徑", "自律神經"]
  },
  {
    chapter: "頭頸部",
    sections: ["顏面神經與三叉神經", "頸動脈鞘", "咽喉解剖", "舌與味覺", "甲狀腺與副甲狀腺"]
  },
  {
    chapter: "胸腔",
    sections: ["心臟與冠狀動脈", "縱膈", "肺與胸膜", "橫膈"]
  },
  {
    chapter: "腹部",
    sections: ["腹膜關係", "胃腸道血管", "肝膽胰脾", "腎臟與後腹腔", "門脈系統"]
  },
  {
    chapter: "骨盆與會陰",
    sections: ["骨盆血管", "泌尿生殖", "直腸與肛管", "會陰三角"]
  },
  {
    chapter: "上肢",
    sections: ["臂神經叢", "肩胛區", "前臂屈伸肌", "手部肌肉", "上肢血管"]
  },
  {
    chapter: "下肢",
    sections: ["腰薦神經叢", "臀區", "大腿前內後區", "小腿肌群", "足部", "下肢血管"]
  }
];

const sectionToChapter = new Map(
  anatomyOutline.flatMap((item) => item.sections.map((section) => [section, item.chapter]))
);

const manualIncludeMap = {
  "MOEX-100140-1101-Q009": "頸動脈鞘",
  "MOEX-100140-1101-Q019": "橫膈",
  "MOEX-101110-1101-Q021": "大腿前內後區",
  "MOEX-103030-1101-Q011": "顏面神經與三叉神經",
  "MOEX-103030-1101-Q032": "聽覺與前庭路徑",
  "MOEX-103100-1101-Q006": "脊髓傳導路徑",
  "MOEX-103100-1101-Q041": "聽覺與前庭路徑",
  "MOEX-104030-1101-Q022": "腰薦神經叢",
  "MOEX-104090-5301-Q024": "脊髓傳導路徑",
  "MOEX-104090-5301-Q025": "腰薦神經叢",
  "MOEX-107020-5301-Q050": "自律神經",
  "MOEX-107100-1301-Q053": "視覺路徑",
  "MOEX-110020-1301-Q050": "自律神經",
  "MOEX-113090-1301-Q053": "視覺路徑"
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

function buildQuestionRecord(detailedQuestion, chapter, section) {
  const explanation =
    detailedQuestion.detail_metadata?.explanation || detailedQuestion.explanation || "考古題匯入，解析待補。";
  const testedConcept =
    detailedQuestion.detail_metadata?.exam_point ||
    detailedQuestion.exam_point ||
    `${section}｜${detailedQuestion.stem.slice(0, 24)}`;

  return {
    id: detailedQuestion.id,
    subject: "解剖學",
    chapter,
    section,
    stem: detailedQuestion.stem,
    options: compactOptions(detailedQuestion),
    answer: detailedQuestion.answer,
    explanation,
    testedConcept,
    optionAnalysis: detailedQuestion.detail_metadata?.option_analysis || detailedQuestion.option_analysis,
    memoryTip: detailedQuestion.detail_metadata?.memory_tip || detailedQuestion.memory_tip,
    clinicalLink: detailedQuestion.detail_metadata?.clinical_link || detailedQuestion.clinical_link,
    answerConfidence: detailedQuestion.detail_metadata?.answer_confidence || detailedQuestion.answer_confidence,
    needsHumanReview:
      detailedQuestion.detail_metadata?.needs_human_review ?? detailedQuestion.needs_human_review,
    reviewFlags: detailedQuestion.review_flags?.length ? detailedQuestion.review_flags : undefined,
    detailVersion:
      detailedQuestion.detail_metadata?.detail_version || detailedData.metadata?.detail_version,
    sourceType: "MOEX_PAST_EXAM",
    sourceCitation: buildSourceCitation(detailedQuestion),
    sourceYear: detailedQuestion.exam_year_gregorian,
    sourceRound: toSourceRound(detailedQuestion.exam_session),
    originalQuestionNumber: detailedQuestion.question_no,
    difficulty: mapDifficulty(detailedQuestion.difficulty)
  };
}

const anatomyText = fs.readFileSync(anatomyFile, "utf8");
const { questions, outlineLiteral } = parseAnatomyFile(anatomyText);
const detailedData = JSON.parse(fs.readFileSync(detailedJsonFile, "utf8"));

const currentById = new Map(questions.map((question) => [question.id, question]));
let mergedCount = 0;
let missingCount = 0;
const missingIds = [];
let appendedCount = 0;

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

for (const detailedQuestion of detailedData.questions) {
  if (currentById.has(detailedQuestion.id)) {
    continue;
  }

  const section = manualIncludeMap[detailedQuestion.id];
  const chapter = section ? sectionToChapter.get(section) : undefined;

  if (
    !section ||
    !chapter ||
    detailedQuestion.answer_credit_type !== "standard" ||
    detailedQuestion.answer === "#" ||
    detailedQuestion.review_flags?.some(
      (flag) => flag.includes("not_strict_anatomy") || flag.includes("needs_removal")
    )
  ) {
    continue;
  }

  const record = buildQuestionRecord(detailedQuestion, chapter, section);
  questions.push(record);
  currentById.set(record.id, record);
  appendedCount += 1;
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
      appendedCount,
      missingCount,
      missingIds
    },
    null,
    2
  )
);
