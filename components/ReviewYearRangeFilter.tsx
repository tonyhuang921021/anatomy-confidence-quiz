"use client";

import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  PRACTICE_YEAR_OPTIONS
} from "@/lib/practiceYears";
import {
  isFullReviewYearRange,
  type ReviewYearRange
} from "@/lib/reviewYearFilter";

type ReviewYearRangeFilterProps = {
  idPrefix: string;
  value: ReviewYearRange;
  onChange: (range: ReviewYearRange) => void;
  filteredCount: number;
  totalCount: number;
  poolLabel: string;
};

export function ReviewYearRangeFilter({
  idPrefix,
  value,
  onChange,
  filteredCount,
  totalCount,
  poolLabel
}: ReviewYearRangeFilterProps) {
  const isFullRange = isFullReviewYearRange(value);

  return (
    <section
      aria-label={`${poolLabel}年份篩選`}
      className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">複習年份</p>
          <p className="mt-1 text-sm text-slate-500">
            只篩選{poolLabel}內的題目，不會和其他題池混在一起。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-self-end">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-500" htmlFor={`${idPrefix}-year-from`}>
              起始年份
              <select
                id={`${idPrefix}-year-from`}
                value={value.yearFrom}
                onChange={(event) => {
                  const yearFrom = Number(event.target.value);
                  onChange({
                    yearFrom,
                    yearTo: Math.max(yearFrom, value.yearTo)
                  });
                }}
                className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {PRACTICE_YEAR_OPTIONS.map((year) => (
                  <option key={`${idPrefix}-from-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-semibold text-slate-500" htmlFor={`${idPrefix}-year-to`}>
              結束年份
              <select
                id={`${idPrefix}-year-to`}
                value={value.yearTo}
                onChange={(event) => {
                  const yearTo = Number(event.target.value);
                  onChange({
                    yearFrom: Math.min(value.yearFrom, yearTo),
                    yearTo
                  });
                }}
                className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {PRACTICE_YEAR_OPTIONS.map((year) => (
                  <option key={`${idPrefix}-to-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() =>
              onChange({
                yearFrom: MIN_PRACTICE_SOURCE_YEAR,
                yearTo: MAX_PRACTICE_SOURCE_YEAR
              })
            }
            disabled={isFullRange}
            className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-400"
          >
            全部年份
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-sm sm:px-6"
      >
        <strong className="tabular-nums text-ink">
          {value.yearFrom}–{value.yearTo} 年
        </strong>
        <span className="text-slate-500">
          這個範圍可開始 <strong className="font-semibold text-slate-700">{filteredCount}</strong> 題
          {filteredCount !== totalCount ? `・全部年份共 ${totalCount} 題` : ""}
        </span>
      </div>
    </section>
  );
}
