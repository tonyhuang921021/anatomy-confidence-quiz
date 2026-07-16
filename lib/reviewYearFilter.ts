import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  normalizePracticeYearRange,
  toGregorianPracticeYear
} from "./practiceYears";
import type { ReviewQuestionItem } from "../types/quiz";

export type ReviewYearRange = {
  yearFrom: number;
  yearTo: number;
};

export const DEFAULT_REVIEW_YEAR_RANGE: ReviewYearRange = {
  yearFrom: MIN_PRACTICE_SOURCE_YEAR,
  yearTo: MAX_PRACTICE_SOURCE_YEAR
};

export function normalizeReviewYearRange(range: ReviewYearRange): ReviewYearRange {
  const normalized = normalizePracticeYearRange(range);
  const clampedYearFrom = Math.min(
    MAX_PRACTICE_SOURCE_YEAR,
    Math.max(MIN_PRACTICE_SOURCE_YEAR, normalized.yearFrom)
  );
  const clampedYearTo = Math.min(
    MAX_PRACTICE_SOURCE_YEAR,
    Math.max(MIN_PRACTICE_SOURCE_YEAR, normalized.yearTo)
  );

  return {
    yearFrom: Math.min(clampedYearFrom, clampedYearTo),
    yearTo: Math.max(clampedYearFrom, clampedYearTo)
  };
}

export function isFullReviewYearRange(range: ReviewYearRange) {
  const normalized = normalizeReviewYearRange(range);
  return (
    normalized.yearFrom === MIN_PRACTICE_SOURCE_YEAR &&
    normalized.yearTo === MAX_PRACTICE_SOURCE_YEAR
  );
}

export function getReviewItemSourceYear(item: ReviewQuestionItem) {
  if (item.question.sourceType === "AI_GENERATED" || item.question.source === "ai-generated") {
    return null;
  }

  const sourceYear = item.question.sourceYear;
  if (typeof sourceYear !== "number" || !Number.isFinite(sourceYear)) return null;

  const normalizedYear = toGregorianPracticeYear(sourceYear);
  return Number.isFinite(normalizedYear) ? Math.trunc(normalizedYear) : null;
}

export function filterReviewItemsByYear(
  items: ReviewQuestionItem[],
  range: ReviewYearRange
) {
  const normalized = normalizeReviewYearRange(range);
  const includeUnknownYears = isFullReviewYearRange(normalized);

  return items.filter((item) => {
    const sourceYear = getReviewItemSourceYear(item);
    if (sourceYear === null) return includeUnknownYears;
    return sourceYear >= normalized.yearFrom && sourceYear <= normalized.yearTo;
  });
}
