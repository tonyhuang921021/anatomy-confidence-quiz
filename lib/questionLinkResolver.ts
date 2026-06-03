import type { Question, StudyNoteQuestionLink } from "@/types/quiz";

function normalizeQuestionNumber(value: string) {
  const parsed = Number(value.replace(/^0+/, "") || "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeYear(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed >= 100 && parsed <= 199) return parsed + 1911;
  if (parsed >= 1900 && parsed <= 2100) return parsed;
  return null;
}

function inferRoundFromExamCode(examCode: string) {
  const suffix = examCode.slice(3);
  if (suffix === "020" || suffix === "010") return 1;
  if (suffix === "110" || suffix === "120") return 2;
  return null;
}

function parseQuestionReference(rawReference: string) {
  const reference = rawReference.trim();
  const moexMatch = reference.match(/^MOEX-(\d{3,6})-(\d{4})-Q?0*(\d{1,3})$/i);
  if (moexMatch) {
    const [, examCode, paperCode, questionNumberText] = moexMatch;
    return {
      exactId: `MOEX-${examCode}-${paperCode}-Q${questionNumberText.padStart(3, "0")}`,
      year: normalizeYear(examCode.slice(0, 3)),
      round: inferRoundFromExamCode(examCode),
      paperCode,
      questionNumber: normalizeQuestionNumber(questionNumberText),
      hasPaperCode: true
    };
  }

  const withPaperCodeMatch = reference.match(
    /(\d{3,4})\s*[-_/年第\s]*(?:第?\s*)?([12一二])\s*(?:次|回|round)?\s*[-_/\s]+(\d{4})\s*[-_/題\s]*(?:Q|第)?\s*0*(\d{1,3})/i
  );
  if (withPaperCodeMatch) {
    const [, yearText, roundText, paperCode, questionNumberText] = withPaperCodeMatch;
    return {
      year: normalizeYear(yearText),
      round: roundText === "2" || roundText === "二" ? 2 : 1,
      paperCode,
      questionNumber: normalizeQuestionNumber(questionNumberText),
      hasPaperCode: true
    };
  }

  const compactMatch = reference.match(/(\d{3,4})\s*[-_/年第\s]*(?:第?\s*)?([12一二])\s*(?:次|回|round)?\s*[-_/題\s]*(?:Q|第)?\s*0*(\d{1,3})/i);
  if (compactMatch) {
    const [, yearText, roundText, questionNumberText] = compactMatch;
    return {
      year: normalizeYear(yearText),
      round: roundText === "2" || roundText === "二" ? 2 : 1,
      questionNumber: normalizeQuestionNumber(questionNumberText),
      hasPaperCode: false
    };
  }

  return null;
}

function findQuestionByReference(questions: Question[], rawReference: string) {
  const reference = rawReference.trim();
  const exact = questions.find((question) => question.id.toLowerCase() === reference.toLowerCase());
  if (exact) return exact;

  const parsed = parseQuestionReference(reference);
  if (!parsed) return null;

  if (parsed.exactId) {
    const exactParsed = questions.find((question) => question.id.toLowerCase() === parsed.exactId?.toLowerCase());
    if (exactParsed) return exactParsed;
  }

  const candidates = questions.filter((question) => {
    if (parsed.year && question.sourceYear !== parsed.year) return false;
    if (parsed.round && question.sourceRound !== parsed.round) return false;
    if (parsed.paperCode && question.paperCode !== parsed.paperCode) return false;
    return question.originalQuestionNumber === parsed.questionNumber;
  });

  if (!parsed.hasPaperCode && candidates.length > 1) return null;

  return candidates[0] ?? null;
}

export function resolveStudyNoteQuestionLinks(
  links: StudyNoteQuestionLink[],
  questions: Question[]
): StudyNoteQuestionLink[] {
  const resolved = new Map<string, StudyNoteQuestionLink>();

  links.forEach((link) => {
    const question = findQuestionByReference(questions, link.questionId);
    if (!question) return;
    resolved.set(`${question.id}:${link.relationType}`, {
      ...link,
      questionId: question.id
    });
  });

  return Array.from(resolved.values());
}
