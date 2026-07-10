const SUBJECTS = {
  anatomy: "解剖學",
  histology: "組織學",
  embryology: "胚胎學",
  physiology: "生理學",
  biochemistry: "生物化學",
  pharmacology: "藥理學",
  pathology: "病理學",
  microbiologyImmunology: "微生物免疫學",
  parasitology: "寄生蟲學",
  publicHealth: "公共衛生學"
};

// These are the nominal subject bands used to assemble each official paper,
// not a semantic reclassification of integrated or cross-disciplinary stems.
// The official subject regrouping started with exam session 106100.
// Before that session, Medical I contained anatomy/embryology/histology plus
// microbiology/parasitology/public health; Medical II contained the other four.
const SUBJECT_REGROUPING_EXAM_CODE = 106100;
const PAPER_ONE_CODES = new Set(["1101", "1301", "5301"]);
const PAPER_TWO_CODES = new Set(["2101", "2301", "6301"]);

function parseMoexQuestionIdentity(questionId) {
  const examMatch = questionId.match(/(?:^|-)(\d{6})(?:-|_)/);
  const questionMatch = questionId.match(/(?:Q|-)(\d{3})$/i);
  const paperMatches = [
    ...questionId.matchAll(/(?:-|_)(1101|1301|2101|2301|5301|6301)(?:-|_)/g)
  ];
  const paperMatch = paperMatches.at(-1);
  if (!examMatch || !questionMatch || !paperMatch) {
    throw new Error(`無法從 questionId 解析考試場次、試卷與題號：${questionId}`);
  }
  return {
    examCode: Number(examMatch[1]),
    paperCode: paperMatch[1],
    questionNumber: Number(questionMatch[1])
  };
}

function findBandSubject(questionNumber, bands) {
  const match = bands.find(([maximum]) => questionNumber <= maximum);
  if (!match || questionNumber < 1 || questionNumber > 100) {
    throw new Error(`國考題號超出 1 至 100：${questionNumber}`);
  }
  return match[1];
}

function getMoexPrimarySubject(questionId) {
  const identity = parseMoexQuestionIdentity(questionId);
  const isPaperOne = PAPER_ONE_CODES.has(identity.paperCode);
  const isPaperTwo = PAPER_TWO_CODES.has(identity.paperCode);
  if (!isPaperOne && !isPaperTwo) {
    throw new Error(`不支援的醫師國考試卷代碼：${identity.paperCode}`);
  }

  if (identity.examCode < SUBJECT_REGROUPING_EXAM_CODE) {
    return isPaperOne
      ? findBandSubject(identity.questionNumber, [
          [28, SUBJECTS.anatomy],
          [32, SUBJECTS.embryology],
          [41, SUBJECTS.histology],
          [74, SUBJECTS.microbiologyImmunology],
          [82, SUBJECTS.parasitology],
          [100, SUBJECTS.publicHealth]
        ])
      : findBandSubject(identity.questionNumber, [
          [25, SUBJECTS.physiology],
          [50, SUBJECTS.biochemistry],
          [75, SUBJECTS.pharmacology],
          [100, SUBJECTS.pathology]
        ]);
  }

  return isPaperOne
    ? findBandSubject(identity.questionNumber, [
        [31, SUBJECTS.anatomy],
        [36, SUBJECTS.embryology],
        [46, SUBJECTS.histology],
        [73, SUBJECTS.physiology],
        [100, SUBJECTS.biochemistry]
      ])
    : findBandSubject(identity.questionNumber, [
        [28, SUBJECTS.microbiologyImmunology],
        [35, SUBJECTS.parasitology],
        [50, SUBJECTS.publicHealth],
        [75, SUBJECTS.pharmacology],
        [100, SUBJECTS.pathology]
      ]);
}

function getMoexPaperGroup(questionId) {
  const { paperCode } = parseMoexQuestionIdentity(questionId);
  if (PAPER_ONE_CODES.has(paperCode)) return "醫學一";
  if (PAPER_TWO_CODES.has(paperCode)) return "醫學二";
  throw new Error(`不支援的醫師國考試卷代碼：${paperCode}`);
}

module.exports = {
  SUBJECT_REGROUPING_EXAM_CODE,
  getMoexPaperGroup,
  getMoexPrimarySubject,
  parseMoexQuestionIdentity
};
