export const MIN_PRACTICE_SOURCE_YEAR = 2009;
export const MAX_PRACTICE_SOURCE_YEAR = 2026;

export const PRACTICE_YEAR_OPTIONS = Array.from(
  { length: MAX_PRACTICE_SOURCE_YEAR - MIN_PRACTICE_SOURCE_YEAR + 1 },
  (_, index) => MIN_PRACTICE_SOURCE_YEAR + index
);

type PracticeYearRangeLike = {
  yearFrom: number;
  yearTo: number;
};

export function toGregorianPracticeYear(year: number) {
  if (!Number.isFinite(year)) return year;
  return year >= 90 && year <= 199 ? year + 1911 : year;
}

// Keep stored range boundaries visible even when a selected pool has no questions
// in that year; all other options come from the actual question pool.
export function getPracticeYearOptions(years: Array<number | undefined>, range: PracticeYearRangeLike) {
  return Array.from(new Set([...years, range.yearFrom, range.yearTo]
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year))))
    .sort((a, b) => a - b);
}

export function normalizePracticeYearRange(range: PracticeYearRangeLike): PracticeYearRangeLike {
  const yearFrom = toGregorianPracticeYear(range.yearFrom);
  const yearTo = toGregorianPracticeYear(range.yearTo);

  return {
    yearFrom: Math.min(yearFrom, yearTo),
    yearTo: Math.max(yearFrom, yearTo)
  };
}
