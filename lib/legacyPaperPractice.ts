import type { Question } from '../types/quiz';
/** Original paper identity is preserved; this is not a scientific-subject classification. */
export function getLegacyPaperPracticeQuestions(bank: readonly Question[]) {
  return Array.from(new Map(bank.filter(question =>
    Boolean(question.officialSource) && (question.sourceYear === 2009 || question.sourceYear === 2010)
  ).map(question => [question.id, question])).values());
}
