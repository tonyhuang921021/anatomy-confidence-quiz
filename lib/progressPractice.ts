import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  normalizePracticeYearRange
} from "./practiceYears";
import {
  buildWeaknessPracticeSettings,
  buildWeaknessQuestionOrder
} from "./weaknessAnalysis";
import type {
  Question,
  QuizSession,
  QuizSettings,
  SubjectName
} from "../types/quiz";

export type ProgressPracticeQuestionCount = 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | "all";

export type ProgressPracticeYearRange = {
  yearFrom: number;
  yearTo: number;
};

export const PROGRESS_PRACTICE_QUESTION_COUNTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export function buildProgressPracticeHref(subject: SubjectName, primaryTag: string) {
  const params = new URLSearchParams({ subject, tag: primaryTag });
  return `/progress/practice?${params.toString()}`;
}

type ProgressPracticeInput = {
  questions: Question[];
  sessions: Pick<QuizSession, "id" | "attempts">[];
  subject: SubjectName;
  primaryTag: string;
  questionIds: string[];
  yearRange: ProgressPracticeYearRange;
  questionCount: ProgressPracticeQuestionCount;
  prioritizeUnseen: boolean;
  customPoolLabel: string;
};

export function normalizeProgressPracticeYearRange(
  range: ProgressPracticeYearRange
): ProgressPracticeYearRange {
  const normalized = normalizePracticeYearRange(range);
  const yearFrom = Math.max(
    MIN_PRACTICE_SOURCE_YEAR,
    Math.min(MAX_PRACTICE_SOURCE_YEAR, normalized.yearFrom)
  );
  const yearTo = Math.max(
    MIN_PRACTICE_SOURCE_YEAR,
    Math.min(MAX_PRACTICE_SOURCE_YEAR, normalized.yearTo)
  );

  return {
    yearFrom: Math.min(yearFrom, yearTo),
    yearTo: Math.max(yearFrom, yearTo)
  };
}

export function getProgressPracticeQuestionIds({
  questions,
  questionIds,
  yearRange
}: Pick<ProgressPracticeInput, "questions" | "questionIds" | "yearRange">) {
  const normalizedRange = normalizeProgressPracticeYearRange(yearRange);
  const explicitQuestionIds = new Set(questionIds);
  const includesUnknownYear =
    normalizedRange.yearFrom === MIN_PRACTICE_SOURCE_YEAR &&
    normalizedRange.yearTo === MAX_PRACTICE_SOURCE_YEAR;

  return questions
    .filter((question) => {
      if (question.sourceType === "AI_GENERATED" || !explicitQuestionIds.has(question.id)) {
        return false;
      }
      if (typeof question.sourceYear !== "number") return includesUnknownYear;
      return (
        question.sourceYear >= normalizedRange.yearFrom &&
        question.sourceYear <= normalizedRange.yearTo
      );
    })
    .map((question) => question.id);
}

export function resolveProgressPracticeQuestionCount(
  requestedCount: ProgressPracticeQuestionCount,
  availableCount: number
) {
  if (availableCount <= 0) return 0;
  return requestedCount === "all"
    ? availableCount
    : Math.min(requestedCount, availableCount);
}

export function buildProgressPracticeSettings({
  questions,
  sessions,
  subject,
  primaryTag,
  questionIds,
  yearRange,
  questionCount,
  prioritizeUnseen,
  customPoolLabel
}: ProgressPracticeInput): QuizSettings | null {
  const normalizedRange = normalizeProgressPracticeYearRange(yearRange);
  const filteredQuestionIds = getProgressPracticeQuestionIds({
    questions,
    questionIds,
    yearRange: normalizedRange
  });
  const questionOrder = buildWeaknessQuestionOrder({
    questions,
    sessions,
    subject,
    primaryTag,
    questionIds: filteredQuestionIds,
    prioritizeUnseen
  });
  const resolvedCount = resolveProgressPracticeQuestionCount(
    questionCount,
    questionOrder.length
  );
  if (resolvedCount === 0) return null;

  const selectedQuestionOrder = questionOrder.slice(0, resolvedCount);
  return {
    ...buildWeaknessPracticeSettings({
      subject,
      primaryTag,
      questionOrder: selectedQuestionOrder,
      customPoolLabel
    }),
    yearFrom: normalizedRange.yearFrom,
    yearTo: normalizedRange.yearTo
  };
}
