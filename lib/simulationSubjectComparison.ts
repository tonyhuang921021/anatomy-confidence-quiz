import type { OptionKey, Question, QuizSession } from "@/types/quiz";
import { isQuestionAnswerCorrect } from "./answerScoring";

export const COMPARISON_MIN_PEOPLE = 5;
export const COMPARISON_SCAN_LIMIT = 100;
export type ComparisonPaper = { key: string; questions: Question[] };
export type ComparisonAnswer = { questionId: string; selectedAnswer: string };
export type SubjectCount = { subject: string; total: number; correct: number };
export type PaperSubjectStats = {
  paperKey: string;
  paperSignature: string;
  available: boolean;
  reason: "ready" | "insufficient" | "unavailable";
  sampleCount: number | null;
  minimumPeople: number;
  scanLimit: number;
  calculatedAt: string;
  subjects: { subject: string; total: number; averageCorrect: number }[];
};
const ORDER = ["解剖學", "胚胎學", "組織學", "生理學", "生物化學", "微生物免疫學", "寄生蟲學", "公共衛生學", "藥理學", "病理學"];

export function comparisonSubject(question: Question): string {
  // Match the original results page's existing subject cards. Never compare a
  // learning-category score with a different nominal exam-band denominator.
  return question.subject;
}

export function comparisonClassificationLabel(_paper: ComparisonPaper) {
  return "依本頁既有網站分類，非官方題號配分";
}

// Public question/answer identities, not a user identifier. Exact comparison also
// prevents a cached aggregate from a different answer-key release being used.
export function comparisonPaperSignature(paper: ComparisonPaper) {
  return JSON.stringify(paper.questions.map(q => [q.id, comparisonSubject(q), q.answer,
    q.acceptedAnswers ?? [], q.answerCreditType ?? "standard"]));
}

export function scoreCompletePaper(paper: ComparisonPaper, answers: ComparisonAnswer[]): SubjectCount[] | null {
  if (answers.length !== paper.questions.length || new Set(answers.map(a => a.questionId)).size !== answers.length) return null;
  const map = new Map(answers.map(a => [a.questionId, a.selectedAnswer]));
  const buckets = new Map<string, SubjectCount>();
  for (const q of paper.questions) {
    const answer = map.get(q.id);
    if (!answer || !Object.prototype.hasOwnProperty.call(q.options, answer)) return null;
    const subject = comparisonSubject(q);
    const row = buckets.get(subject) ?? { subject, total: 0, correct: 0 };
    row.total++;
    if (isQuestionAnswerCorrect(q, answer as OptionKey)) row.correct++;
    buckets.set(subject, row);
  }
  return [...buckets.values()].sort((a,b) => {
    const ai = ORDER.indexOf(a.subject), bi = ORDER.indexOf(b.subject);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.subject.localeCompare(b.subject);
  });
}

export function scoreOwnCompletePaper(paper: ComparisonPaper, session: QuizSession) {
  if (session.settings?.mode !== "simulation" || !session.completedAt) return null;
  if (session.questionOrder?.length && (session.questionOrder.length !== paper.questions.length ||
    new Set(session.questionOrder).size !== paper.questions.length ||
    !paper.questions.every(q => session.questionOrder!.includes(q.id)))) return null;
  return scoreCompletePaper(paper, session.attempts);
}

export function unavailableSubjectStats(paper: ComparisonPaper, reason: "insufficient" | "unavailable" = "unavailable"): PaperSubjectStats {
  return { paperKey: paper.key, paperSignature: comparisonPaperSignature(paper), available: false,
    reason, sampleCount: null, minimumPeople: COMPARISON_MIN_PEOPLE, scanLimit: COMPARISON_SCAN_LIMIT,
    calculatedAt: new Date().toISOString(), subjects: [] };
}

export type CohortRecord = { sessionId: string; accountId: string; completedAt: string; answers: ComparisonAnswer[] };
export function aggregatePaperSubjects(paper: ComparisonPaper, records: CohortRecord[]): PaperSubjectStats {
  const people = new Map<string, SubjectCount[]>();
  const seenSessions = new Set<string>();
  const ordered = [...records].sort((a,b) => b.completedAt.localeCompare(a.completedAt) || b.sessionId.localeCompare(a.sessionId));
  for (const record of ordered) {
    if (!record.accountId || !Number.isFinite(Date.parse(record.completedAt)) ||
      seenSessions.has(record.sessionId) || people.has(record.accountId)) continue;
    seenSessions.add(record.sessionId);
    const scores = scoreCompletePaper(paper, record.answers);
    if (!scores) continue;
    // Same low-score exclusion as the existing full-paper score pool.
    if (Math.round(scores.reduce((n,s)=>n+s.correct,0) / paper.questions.length * 100) <= 3) continue;
    people.set(record.accountId, scores);
  }
  const result = unavailableSubjectStats(paper, "insufficient");
  if (people.size < COMPARISON_MIN_PEOPLE) return result; // No small-group counts or sums escape.
  const scores = [...people.values()];
  return { ...result, available: true, reason: "ready", sampleCount: people.size,
    subjects: scores[0].map((s,index) => ({subject:s.subject,total:s.total,
      averageCorrect: scores.reduce((n,rows)=>n+rows[index].correct,0) / scores.length})) };
}

export function isMatchingSubjectStats(value: unknown, paper: ComparisonPaper): value is PaperSubjectStats {
  const v = value as PaperSubjectStats | null;
  if (!v || typeof v.available !== "boolean" || v.paperKey !== paper.key || v.paperSignature !== comparisonPaperSignature(paper) ||
    v.minimumPeople !== COMPARISON_MIN_PEOPLE || v.scanLimit !== COMPARISON_SCAN_LIMIT ||
    !Array.isArray(v.subjects) || !["ready","insufficient","unavailable"].includes(v.reason)) return false;
  if (!v.available) return v.reason !== "ready" && v.sampleCount === null && v.subjects.length === 0;
  if (v.reason !== "ready" || !Number.isInteger(v.sampleCount) || v.sampleCount! < COMPARISON_MIN_PEOPLE || v.sampleCount! > COMPARISON_SCAN_LIMIT) return false;
  const expected = scoreCompletePaper(paper, paper.questions.map(q=>({questionId:q.id,selectedAnswer:q.answer})))!;
  return v.subjects.length === expected.length && expected.every((s,i) => {
    const row = v.subjects[i];
    return row.subject === s.subject && row.total === s.total && Number.isFinite(row.averageCorrect) && row.averageCorrect >= 0 && row.averageCorrect <= row.total;
  });
}
