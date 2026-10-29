/** Explicitly verified paper contracts; unknown historical tracks stay unset. */
const VERIFIED_EIGHTY_QUESTION_PAPERS = new Set([
  "MOEX-C217-094042-S4001-STAGE1",
  "MOEX-C217-094042-S5001-STAGE1",
  "MOEX-C002-090040-S4004-STAGE1",
  "MOEX-C002-090040-S5004-STAGE1",
  "MOEX-C002-090180-S4004-STAGE1",
  "MOEX-C002-090180-S5004-STAGE1",
  "MOEX-C217-091030-S4004-STAGE1",
  "MOEX-C217-091030-S5004-STAGE1",
  "MOEX-C217-091160-S4001-STAGE1",
  "MOEX-C217-091160-S5001-STAGE1"
]);

export function getVerifiedEightyQuestionPaper(paperKey?: string) {
  return paperKey && VERIFIED_EIGHTY_QUESTION_PAPERS.has(paperKey)
    ? { questionCount: 80, pointsPerQuestion: 1.25, timeMinutes: 60 }
    : null;
}
