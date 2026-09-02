const fs = require("fs");
const path = require("path");

const ALL_OPTION_KEYS = ["A", "B", "C", "D"];
const OFFICIAL_CORRECTION_FLAG = "official_answer_correction_or_credit";

const MED1_CORRECTIONS = {
  63: {
    answerCreditType: "multiple_accepted",
    correctAnswers: ["B", "D"],
    note: "考選部申覆結果：第63題答B或D或BD者均給分。"
  },
  66: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第66題一律給分。"
  }
};

const MED2_CORRECTIONS = {
  14: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第14題一律給分。"
  },
  25: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第25題一律給分。"
  },
  55: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第55題一律給分。"
  },
  68: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第68題一律給分。"
  },
  95: {
    answerCreditType: "multiple_accepted",
    correctAnswers: ["A", "D"],
    note: "考選部申覆結果：第95題答A或D或AD者均給分。"
  },
  98: {
    answerCreditType: "all_credit",
    correctAnswers: ALL_OPTION_KEYS,
    note: "考選部申覆結果：第98題一律給分。"
  }
};

function appendCorrectionFlag(reviewFlags) {
  return Array.from(new Set([...(reviewFlags ?? []), OFFICIAL_CORRECTION_FLAG]));
}

function applyPaperCorrections(questions, corrections, paperCode) {
  const byNumber = new Map(questions.map((question) => [question.question_no, question]));

  for (const [questionNumberText, correction] of Object.entries(corrections)) {
    const questionNumber = Number(questionNumberText);
    const question = byNumber.get(questionNumber);
    if (!question) {
      throw new Error(`${paperCode} 找不到第 ${questionNumber} 題，無法套用申覆結果`);
    }

    question.correct_answers = [...correction.correctAnswers];
    question.answer_credit_type = correction.answerCreditType;
    question.answer_note = correction.note;
    question.review_flags = appendCorrectionFlag(question.review_flags);

    if (paperCode === "1301") {
      question.corrected_answer =
        correction.answerCreditType === "multiple_accepted"
          ? [...correction.correctAnswers]
          : null;
    }

    if (paperCode === "2301") {
      question.corrected_answer =
        correction.answerCreditType === "multiple_accepted"
          ? [...correction.correctAnswers]
          : null;
    }
  }
}

function apply115090AppealCorrections(payload) {
  applyPaperCorrections(payload.med1Questions, MED1_CORRECTIONS, "1301");
  applyPaperCorrections(payload.med2Questions, MED2_CORRECTIONS, "2301");

  payload.metadata = {
    ...payload.metadata,
    answerCorrectionsUpdatedAt: "2026-09-02",
    answerCorrectionSource:
      "考選部 115年第二次專技高考醫師（一）測驗題標準答案更正"
  };

  return payload;
}

if (require.main === module) {
  const projectRoot = path.resolve(__dirname, "..");
  const targetPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(projectRoot, "data", "sources", "moex_115090_official_questions.json");
  const payload = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  apply115090AppealCorrections(payload);
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`已套用 115 年第二次申覆結果：${targetPath}`);
}

module.exports = {
  ALL_OPTION_KEYS,
  MED1_CORRECTIONS,
  MED2_CORRECTIONS,
  OFFICIAL_CORRECTION_FLAG,
  apply115090AppealCorrections
};
