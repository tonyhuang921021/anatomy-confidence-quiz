const assert = require("node:assert/strict");
const test = require("node:test");

const payload = require("../data/sources/moex_115090_official_questions.json");
const { getMoexPrimarySubject } = require("./moex-primary-subject");

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
