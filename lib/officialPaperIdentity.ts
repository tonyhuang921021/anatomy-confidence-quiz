import type { Question } from "../types/quiz";

type PaperQuestion = Pick<Question, "examCode" | "paperCode" | "officialExam">;

/** Display the official selector when known, preserving labels for legacy data. */
export function getOfficialPaperDisplayCode(question: PaperQuestion): string | undefined {
  const subjectCode = question.officialExam?.subjectCode || question.paperCode;
  return question.examCode && subjectCode ? `${question.examCode}-${subjectCode}` : undefined;
}

/** Preserve legacy paper keys while giving distinct official tracks distinct keys. */
export function getOfficialPaperKey(question: PaperQuestion): string | undefined {
  if (!question.examCode || !question.paperCode) return undefined;
  const official = question.officialExam;
  return official
    ? `MOEX-C${official.categoryCode}-${question.examCode}-S${official.subjectCode}-${official.trackCode}`
    : `${question.examCode}-${question.paperCode}`;
}

export function getOfficialPaperKeyFromQuestionId(questionId: string): string | undefined {
  const official = questionId.match(/^(MOEX-C\d+-\d+-S\d+-[A-Z0-9]+)-Q\d+$/);
  if (official) return official[1];
  const legacy = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
  return legacy ? `${legacy[1]}-${legacy[2]}` : undefined;
}
