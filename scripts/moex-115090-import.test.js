const assert = require("node:assert/strict");
const test = require("node:test");

const payload = require("../data/sources/moex_115090_official_questions.json");
const { getMoexPrimarySubject } = require("./moex-primary-subject");
const {
  ALL_OPTION_KEYS,
  MED1_CORRECTIONS,
  MED2_CORRECTIONS,
  OFFICIAL_CORRECTION_FLAG
} = require("./moex-115090-appeal-corrections");

function assertPaper(questions, paperCode) {
  assert.equal(questions.length, 100);
  questions.forEach((question, index) => {
    const questionNumber = index + 1;
    assert.equal(question.question_no, questionNumber);
    assert.equal(
      question.id,
      `MOEX-115090-${paperCode}-Q${String(questionNumber).padStart(3, "0")}`
    );
    assert.deepEqual(Object.keys(question.options), ["A", "B", "C", "D"]);
    assert.ok(question.stem.length > 0);
    assert.ok(Object.values(question.options).every(Boolean));
  });
}

test("115 年第二次兩份官方考卷各有完整 100 題", () => {
  assertPaper(payload.med1Questions, "1301");
  assertPaper(payload.med2Questions, "2301");
});

test("115 年第二次答案與官方答案表的抽樣一致", () => {
  assert.equal(payload.med1Questions[0].answer, "C");
  assert.equal(payload.med1Questions[61].answer, "D");
  assert.equal(payload.med1Questions[99].answer, "A");
  assert.equal(payload.med2Questions[0].official_answer_raw, "A");
  assert.equal(payload.med2Questions[42].official_answer_raw, "D");
  assert.equal(payload.med2Questions[99].official_answer_raw, "C");
});

function assertCorrection(question, correction) {
  assert.deepEqual(question.correct_answers, correction.correctAnswers);
  assert.equal(question.answer_credit_type, correction.answerCreditType);
  assert.equal(question.answer_note, correction.note);
  assert.ok(question.review_flags.includes(OFFICIAL_CORRECTION_FLAG));
}

test("115 年第二次申覆結果完整套用至醫學一", () => {
  for (const [questionNumberText, correction] of Object.entries(MED1_CORRECTIONS)) {
    const question = payload.med1Questions[Number(questionNumberText) - 1];
    assertCorrection(question, correction);
    assert.deepEqual(
      question.corrected_answer,
      correction.answerCreditType === "multiple_accepted"
        ? correction.correctAnswers
        : null
    );
  }

  assert.deepEqual(payload.med1Questions[62].correct_answers, ["B", "D"]);
  assert.deepEqual(payload.med1Questions[65].correct_answers, ALL_OPTION_KEYS);
});

test("115 年第二次申覆結果完整套用至醫學二", () => {
  for (const [questionNumberText, correction] of Object.entries(MED2_CORRECTIONS)) {
    const question = payload.med2Questions[Number(questionNumberText) - 1];
    assertCorrection(question, correction);
    assert.deepEqual(
      question.corrected_answer,
      correction.answerCreditType === "multiple_accepted"
        ? correction.correctAnswers
        : null
    );
  }

  const correctedQuestionNumbers = payload.med2Questions
    .filter((question) => question.review_flags.includes(OFFICIAL_CORRECTION_FLAG))
    .map((question) => question.question_no);
  assert.deepEqual(correctedQuestionNumbers, [14, 25, 55, 68, 95, 98]);
});

test("115 年第二次申覆不改寫原始標準答案", () => {
  assert.equal(payload.med1Questions[62].answer, "D");
  assert.equal(payload.med1Questions[65].answer, "B");
  assert.equal(payload.med2Questions[13].official_answer_raw, "B");
  assert.equal(payload.med2Questions[24].official_answer_raw, "D");
  assert.equal(payload.med2Questions[54].official_answer_raw, "D");
  assert.equal(payload.med2Questions[67].official_answer_raw, "B");
  assert.equal(payload.med2Questions[94].official_answer_raw, "A");
  assert.equal(payload.med2Questions[97].official_answer_raw, "D");
});

test("115 年第二次科目依新版官方題號區間分類", () => {
  for (const question of [...payload.med1Questions, ...payload.med2Questions]) {
    const subject =
      question.classification_v4?.primary_subject ||
      question.classification_v1?.primary_subject_exact;
    assert.equal(subject, getMoexPrimarySubject(question.id), question.id);
  }
});

test("PDF 中被拆開的上下標文字已還原", () => {
  assert.match(payload.med1Questions[61].stem, /PaO₂/);
  assert.match(payload.med1Questions[62].options.D, /Ca²⁺/);
  assert.match(payload.med2Questions[42].options.A, /Cr⁶⁺.*Cr³⁺/);
  assert.match(payload.med2Questions[63].options.B, /Na⁺\/Cl⁻/);
  assert.doesNotMatch(payload.med1Questions[51].options.A, /\+$/);
  assert.doesNotMatch(payload.med2Questions[42].stem, /6\+|3\+/);
});
