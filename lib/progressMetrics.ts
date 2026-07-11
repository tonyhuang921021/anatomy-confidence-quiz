import { getAnalysisPrimaryTagAssignment, getQuestionPrimaryTag } from "./analysisPrimaryTag";
import type { Attempt, CompletionStatus, Question } from "../types/quiz";

export type ProgressMetrics = {
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  completionRate: number;
  correctRate: number;
};

export type ProgressBlock = ProgressMetrics & {
  key: string;
  label: string;
  fullLabel: string;
  questionIds: string[];
};

const round = (value: number) => Math.round(value * 10) / 10;

export function calculateProgressMetrics(questionIds: Set<string>, attempts: Attempt[]): ProgressMetrics {
  const relevantAttempts = attempts.filter((attempt) => questionIds.has(attempt.questionId));
  const attemptedQuestions = new Set(relevantAttempts.map((attempt) => attempt.questionId)).size;
  const totalAttempts = relevantAttempts.length;
  const correctAttempts = relevantAttempts.filter((attempt) => attempt.isCorrect).length;

  return {
    totalQuestionsInBank: questionIds.size,
    attemptedQuestions,
    totalAttempts,
    correctAttempts,
    completionRate: questionIds.size === 0 ? 0 : round((attemptedQuestions / questionIds.size) * 100),
    correctRate: totalAttempts === 0 ? 0 : round((correctAttempts / totalAttempts) * 100)
  };
}

export function getProgressStatus(completionRate: number, correctRate: number): CompletionStatus {
  if (completionRate === 0) return "未開始";
  if (completionRate < 80) return "進行中";
  if (correctRate < 70) return "已完成但不穩";
  return "已完成且穩定";
}

export function formatProgressBlockLabel(fullLabel: string, subject: string) {
  const normalized = fullLabel.trim();
  if (!normalized || normalized === subject) return "尚未細分";

  const subjectPrefix = `${subject}－`;
  return normalized.startsWith(subjectPrefix) ? normalized.slice(subjectPrefix.length) : normalized;
}

export function buildProgressBlocks(questions: Question[], attempts: Attempt[]): ProgressBlock[] {
  const buckets = new Map<string, { label: string; ids: Set<string> }>();

  questions.forEach((question) => {
    const analysisAssignment = getAnalysisPrimaryTagAssignment(question.id);
    const fullLabel = analysisAssignment
      ? analysisAssignment.primaryTag?.trim() || analysisAssignment.subject
      : getQuestionPrimaryTag(question) || question.section.trim() || question.subject;
    const key = `${question.subject}\u0000${fullLabel}`;
    const bucket = buckets.get(key) ?? { label: fullLabel, ids: new Set<string>() };
    bucket.ids.add(question.id);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const metrics = calculateProgressMetrics(bucket.ids, attempts);
      const subject = key.split("\u0000", 1)[0];
      return {
        key,
        label: formatProgressBlockLabel(bucket.label, subject),
        fullLabel: bucket.label,
        questionIds: Array.from(bucket.ids),
        ...metrics
      };
    })
    .sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, "zh-TW"));
}
