export const MIN_PRACTICE_SOURCE_YEAR = 2011;
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
  return year >= 100 && year <= 199 ? year + 1911 : year;
}

export function normalizePracticeYearRange(range: PracticeYearRangeLike): PracticeYearRangeLike {
  const yearFrom = toGregorianPracticeYear(range.yearFrom);
  const yearTo = toGregorianPracticeYear(range.yearTo);

  return {
    yearFrom: Math.min(yearFrom, yearTo),
    yearTo: Math.max(yearFrom, yearTo)
  };
}
