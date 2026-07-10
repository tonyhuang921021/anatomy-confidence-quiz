const assert = require("assert");
const {
  SUBJECT_REGROUPING_EXAM_CODE,
  getMoexPaperGroup,
  getMoexPrimarySubject,
  parseMoexQuestionIdentity
} = require("./moex-primary-subject");

assert.equal(SUBJECT_REGROUPING_EXAM_CODE, 106100);
assert.deepEqual(parseMoexQuestionIdentity("MOEX-106100-1301-Q074"), {
  examCode: 106100,
  paperCode: "1301",
  questionNumber: 74
});
assert.equal(
  getMoexPrimarySubject("missing-2011-2-100140-1101-q009"),
  "解剖學"
);
assert.equal(getMoexPaperGroup("MOEX-105100-5301-Q042"), "醫學一");
assert.equal(getMoexPaperGroup("MOEX-105100-6301-Q042"), "醫學二");
assert.equal(getMoexPaperGroup("MOEX-115020-1301-Q074"), "醫學一");
assert.equal(getMoexPaperGroup("MOEX-115020-2301-Q029"), "醫學二");

const oldPaperOne = [
  ["MOEX-105100-5301-Q028", "解剖學"],
  ["MOEX-105100-5301-Q029", "胚胎學"],
  ["MOEX-105100-5301-Q032", "胚胎學"],
  ["MOEX-105100-5301-Q033", "組織學"],
  ["MOEX-105100-5301-Q041", "組織學"],
  ["MOEX-105100-5301-Q042", "微生物免疫學"],
  ["MOEX-105100-5301-Q074", "微生物免疫學"],
  ["MOEX-105100-5301-Q075", "寄生蟲學"],
  ["MOEX-105100-5301-Q082", "寄生蟲學"],
  ["MOEX-105100-5301-Q083", "公共衛生學"]
];
const oldPaperTwo = [
  ["MOEX-106020-6301-Q025", "生理學"],
  ["MOEX-106020-6301-Q026", "生物化學"],
  ["MOEX-106020-6301-Q050", "生物化學"],
  ["MOEX-106020-6301-Q051", "藥理學"],
  ["MOEX-106020-6301-Q075", "藥理學"],
  ["MOEX-106020-6301-Q076", "病理學"]
];
const newPaperOne = [
  ["MOEX-106100-1301-Q031", "解剖學"],
  ["MOEX-106100-1301-Q032", "胚胎學"],
  ["MOEX-106100-1301-Q036", "胚胎學"],
  ["MOEX-106100-1301-Q037", "組織學"],
  ["MOEX-106100-1301-Q046", "組織學"],
  ["MOEX-106100-1301-Q047", "生理學"],
  ["MOEX-106100-1301-Q073", "生理學"],
  ["MOEX-106100-1301-Q074", "生物化學"]
];
const newPaperTwo = [
  ["MOEX-107020-6301-Q028", "微生物免疫學"],
  ["MOEX-107020-6301-Q029", "寄生蟲學"],
  ["MOEX-107020-6301-Q035", "寄生蟲學"],
  ["MOEX-107020-6301-Q036", "公共衛生學"],
  ["MOEX-107020-6301-Q050", "公共衛生學"],
  ["MOEX-107020-6301-Q051", "藥理學"],
  ["MOEX-107020-6301-Q075", "藥理學"],
  ["MOEX-107020-6301-Q076", "病理學"]
];

[...oldPaperOne, ...oldPaperTwo, ...newPaperOne, ...newPaperTwo].forEach(
  ([questionId, expected]) => {
    assert.equal(getMoexPrimarySubject(questionId), expected, questionId);
  }
);

console.log("moex-primary-subject tests passed");
