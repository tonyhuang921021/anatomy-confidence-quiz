const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getMoexPrimarySubject } = require("./moex-primary-subject");

const [
  med1QuestionPdf,
  med1AnswerPdf,
  med2QuestionPdf,
  med2AnswerPdf,
  outputArgument
] = process.argv.slice(2);

if (!med1QuestionPdf || !med1AnswerPdf || !med2QuestionPdf || !med2AnswerPdf) {
  throw new Error(
    "用法：node scripts/import-moex-115090.js <1301試題PDF> <1301答案PDF> <2301試題PDF> <2301答案PDF> [輸出JSON]"
  );
}

const projectRoot = path.resolve(__dirname, "..");
const outputPath = outputArgument
  ? path.resolve(outputArgument)
  : path.join(projectRoot, "data", "sources", "moex_115090_official_questions.json");

function extractPdfText(pdfPath, suffix) {
  const textPath = path.join(os.tmpdir(), `moex-115090-${process.pid}-${suffix}.txt`);
  execFileSync("pdftotext", ["-layout", path.resolve(pdfPath), textPath]);
  const text = fs.readFileSync(textPath, "utf8");
  fs.rmSync(textPath, { force: true });
  return text;
}

function normalizeText(parts) {
  return parts
    .map((part) => part.replace(/\f/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\u00ad/g, "")
    .replace(/([A-Za-z])[-‐]\s+([A-Za-z])/g, "$1-$2")
    .replace(/\s+([，。；：！？、）〕］】])/g, "$1")
    .replace(/([（〔［【])\s+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseQuestions(pdfText) {
  const questions = [];
  let currentQuestion = null;
  let currentOption = null;

  function finishCurrentQuestion() {
    if (!currentQuestion) return;
    currentQuestion.stem = normalizeText(currentQuestion.stemParts);
    currentQuestion.options = Object.fromEntries(
      Object.entries(currentQuestion.optionParts).map(([key, parts]) => [
        key,
        normalizeText(parts)
      ])
    );
    delete currentQuestion.stemParts;
    delete currentQuestion.optionParts;
    questions.push(currentQuestion);
  }

  for (const rawLine of pdfText.split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, "").trim();
    if (!line) continue;

    const questionMatch = line.match(/^(\d{1,3})\.(.*)$/);
    const expectedQuestionNumber = currentQuestion
      ? currentQuestion.question_no + 1
      : 1;
    if (questionMatch && Number(questionMatch[1]) === expectedQuestionNumber) {
      finishCurrentQuestion();
      currentQuestion = {
        question_no: Number(questionMatch[1]),
        stemParts: [questionMatch[2]],
        optionParts: {}
      };
      currentOption = null;
      continue;
    }

    if (!currentQuestion) continue;

    const optionMatch = line.match(/^([A-D])\.(.*)$/);
    if (optionMatch) {
      currentOption = optionMatch[1];
      currentQuestion.optionParts[currentOption] = [optionMatch[2]];
      continue;
    }

    if (currentOption) {
      currentQuestion.optionParts[currentOption].push(line);
    } else {
      currentQuestion.stemParts.push(line);
    }
  }

  finishCurrentQuestion();
  return questions;
}

function parseAnswers(pdfText) {
  const fullWidthToAscii = { "Ａ": "A", "Ｂ": "B", "Ｃ": "C", "Ｄ": "D" };
  const answers = pdfText
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("答案"))
    .flatMap((line) => Array.from(line).map((value) => fullWidthToAscii[value]).filter(Boolean));

  if (answers.length !== 100) {
    throw new Error(`答案數量應為 100，實際為 ${answers.length}`);
  }
  return answers;
}

function questionId(paperCode, questionNumber) {
  return `MOEX-115090-${paperCode}-Q${String(questionNumber).padStart(3, "0")}`;
}

function patchExtractedText(paperCode, questions) {
  const byNumber = new Map(questions.map((question) => [question.question_no, question]));

  if (paperCode === "1301") {
    byNumber.get(52).options.A = "剛開始進行再極化（repolarization）時";
    byNumber.get(52).options.B =
      "電位門控型鈉離子通道（voltage-gated Na⁺ channel）主要呈現不活化（inactivated）狀態";
    byNumber.get(52).options.C =
      "電位門控型鉀離子通道（voltage-gated K⁺ channel）部分仍維持在開啟狀態";
    byNumber.get(62).stem =
      "下列何者對於偵測動脈氧分壓（PaO₂）下降，進而引發肺通氣量增加，具有最主要之角色？";
    byNumber.get(63).options = {
      A: "氯離子（Cl⁻）於小腸與大腸以主動運輸（active transport）吸收",
      B: "氫離子（H⁺）於小腸以主動運輸（active transport）分泌",
      C: "鈉離子（Na⁺）於小腸與葡萄糖反向交換（exchange）而分泌",
      D: "鈣離子（Ca²⁺）於小腸以主動運輸（active transport）吸收"
    };
    byNumber.get(63).stem =
      "在正常生理狀態下，腸胃道對於各種電解質（electrolytes）的吸收或分泌，下列敘述何者最適當？";
  }

  if (paperCode === "2301") {
    byNumber.get(43).stem = "關於環境毒性化學物質的敘述，下列何者最不適當？";
    byNumber.get(43).options.A = "Cr⁶⁺ 的毒性通常較 Cr³⁺ 強";
    byNumber.get(59).stem =
      "下列藥物中，何者為 ADP P2Y₁₂ receptor 拮抗劑，可抑制血小板凝集活性？";
    byNumber.get(64).options.A = "主要作用部位在近端腎小管";
    byNumber.get(64).options.B = "可抑制 Na⁺/Cl⁻ 共同運送系統";
  }

  return questions;
}

function validateQuestions(questions, paperCode) {
  if (questions.length !== 100) {
    throw new Error(`${paperCode} 題數應為 100，實際為 ${questions.length}`);
  }

  questions.forEach((question, index) => {
    const expectedNumber = index + 1;
    if (question.question_no !== expectedNumber) {
      throw new Error(`${paperCode} 題號中斷：預期 ${expectedNumber}，實際 ${question.question_no}`);
    }
    const optionKeys = Object.keys(question.options);
    if (optionKeys.join("") !== "ABCD") {
      throw new Error(`${paperCode} 第 ${expectedNumber} 題選項不完整：${optionKeys.join(",")}`);
    }
    if (!question.stem || Object.values(question.options).some((option) => !option)) {
      throw new Error(`${paperCode} 第 ${expectedNumber} 題有空白題幹或選項`);
    }
  });
}

function buildMed1Question(question, answer) {
  const id = questionId("1301", question.question_no);
  const subject = getMoexPrimarySubject(id);
  return {
    id,
    source_type: "MOEX_PAST_EXAM",
    exam_year_roc: 115,
    exam_year_gregorian: 2026,
    exam_session: "第二次",
    exam_code: "115090",
    paper_code: "1301",
    question_no: question.question_no,
    stem: question.stem,
    options: question.options,
    answer,
    correct_answers: [answer],
    answer_credit_type: "standard",
    explanation: "",
    option_analysis: {},
    exam_point: subject,
    classification_v4: {
      primary_subject: subject,
      topic_section: subject
    },
    review_flags: ["official_115_second_exam_import", "primary_tag_pending_enrichment"],
    detail_phase: "official_question_only",
    source_question_pdf: "115090_1301.pdf",
    source_answer_pdf: "115090_ANS1301.pdf"
  };
}

function buildMed2Question(question, answer) {
  const id = questionId("2301", question.question_no);
  const subject = getMoexPrimarySubject(id);
  return {
    id,
    year: 2026,
    roc_year: 115,
    exam_round: "第二次",
    exam_code: "2301",
    subject_group: "醫學（二）",
    question_no: question.question_no,
    stem: question.stem,
    options: question.options,
    official_answer_raw: answer,
    correct_answers: [answer],
    corrected_answer: null,
    answer_credit_type: "single",
    classification_v1: {
      primary_subject_exact: subject,
      subtopic: subject,
      classification_method: "official_question_number_band",
      confidence: "high",
      notes: "115 年第二次新版醫學（二）依官方題號區間分類。"
    },
    explanation: "",
    option_analysis: {},
    exam_point: subject,
    memory_tip: "",
    clinical_link: "",
    review_flags: ["official_115_second_exam_import", "primary_tag_pending_enrichment"],
    source_pdf: "115090_2301.pdf",
    answer_pdf: "115090_ANS2301.pdf"
  };
}

const med1Questions = patchExtractedText(
  "1301",
  parseQuestions(extractPdfText(med1QuestionPdf, "1301"))
);
const med2Questions = patchExtractedText(
  "2301",
  parseQuestions(extractPdfText(med2QuestionPdf, "2301"))
);
const med1Answers = parseAnswers(extractPdfText(med1AnswerPdf, "answers-1301"));
const med2Answers = parseAnswers(extractPdfText(med2AnswerPdf, "answers-2301"));

validateQuestions(med1Questions, "1301");
validateQuestions(med2Questions, "2301");

const payload = {
  metadata: {
    examCode: "115090",
    rocYear: 115,
    year: 2026,
    examRound: "第二次",
    importedAt: "2026-07-20",
    notes: "官方題目與標準答案；詳解及細分 primaryTag 待後續補充。"
  },
  med1Questions: med1Questions.map((question, index) =>
    buildMed1Question(question, med1Answers[index])
  ),
  med2Questions: med2Questions.map((question, index) =>
    buildMed2Question(question, med2Answers[index])
  )
};

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

const med1SubjectCounts = countBy(
  payload.med1Questions,
  (question) => question.classification_v4.primary_subject
);
const med2SubjectCounts = countBy(
  payload.med2Questions,
  (question) => question.classification_v1.primary_subject_exact
);
const expectedMed1Counts = {
  "解剖學": 31,
  "胚胎學": 5,
  "組織學": 10,
  "生理學": 27,
  "生物化學": 27
};
const expectedMed2Counts = {
  "微生物免疫學": 28,
  "寄生蟲學": 7,
  "公共衛生學": 15,
  "藥理學": 25,
  "病理學": 25
};

for (const [subject, expectedCount] of Object.entries(expectedMed1Counts)) {
  if ((med1SubjectCounts[subject] ?? 0) !== expectedCount) {
    throw new Error(`1301 ${subject} 題數不符`);
  }
}
for (const [subject, expectedCount] of Object.entries(expectedMed2Counts)) {
  if ((med2SubjectCounts[subject] ?? 0) !== expectedCount) {
    throw new Error(`2301 ${subject} 題數不符`);
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`輸出：${outputPath}`);
console.log("1301：100 題；2301：100 題；官方答案各 100 筆");
