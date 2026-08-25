"use client";

import { Play } from "lucide-react";
import {
  QuestionOrderModeControl,
  type QuestionOrderMode
} from "@/components/QuestionOrderModeControl";
import {
  PROGRESS_PRACTICE_QUESTION_COUNTS,
  resolveProgressPracticeQuestionCount,
  type ProgressPracticeQuestionCount,
  type ProgressPracticeYearRange
} from "@/lib/progressPractice";
import { PRACTICE_YEAR_OPTIONS } from "@/lib/practiceYears";

type ProgressPracticeSetupProps = {
  idPrefix: string;
  label: string;
  availableQuestionCount: number;
  questionCount: ProgressPracticeQuestionCount;
  yearRange: ProgressPracticeYearRange;
  orderMode: QuestionOrderMode;
  onQuestionCountChange: (count: ProgressPracticeQuestionCount) => void;
  onYearRangeChange: (range: ProgressPracticeYearRange) => void;
  onOrderModeChange: (mode: QuestionOrderMode) => void;
  onStart: () => void;
};

export function ProgressPracticeSetup({
  idPrefix,
  label,
  availableQuestionCount,
  questionCount,
  yearRange,
  orderMode,
  onQuestionCountChange,
  onYearRangeChange,
  onOrderModeChange,
  onStart
}: ProgressPracticeSetupProps) {
  const effectiveQuestionCount = resolveProgressPracticeQuestionCount(
    questionCount,
    availableQuestionCount
  );
  const selectValue =
    questionCount === "all" || questionCount >= availableQuestionCount
      ? "all"
      : String(questionCount);
  const countOptions = PROGRESS_PRACTICE_QUESTION_COUNTS.filter(
    (count) => count < availableQuestionCount
  );

  return (
    <section
      aria-label={`${label}練習設定`}
      className="rounded-lg border border-brand-200 bg-brand-50/45 p-4 sm:p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(8rem,0.45fr)_minmax(17rem,1fr)]">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-500">年份</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-medium text-slate-500" htmlFor={`${idPrefix}-year-from`}>
              從
              <select
                id={`${idPrefix}-year-from`}
                aria-label="起始年份"
                value={yearRange.yearFrom}
                onChange={(event) => {
                  const yearFrom = Number(event.target.value);
                  onYearRangeChange({
                    yearFrom,
                    yearTo: Math.max(yearFrom, yearRange.yearTo)
                  });
                }}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {PRACTICE_YEAR_OPTIONS.map((year) => (
                  <option key={`${idPrefix}-from-${year}`} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-slate-500" htmlFor={`${idPrefix}-year-to`}>
              到
              <select
                id={`${idPrefix}-year-to`}
                aria-label="結束年份"
                value={yearRange.yearTo}
                onChange={(event) => {
                  const yearTo = Number(event.target.value);
                  onYearRangeChange({
                    yearFrom: Math.min(yearRange.yearFrom, yearTo),
                    yearTo
                  });
                }}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {PRACTICE_YEAR_OPTIONS.map((year) => (
                  <option key={`${idPrefix}-to-${year}`} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <label className="grid content-start gap-2 text-xs font-semibold text-slate-500" htmlFor={`${idPrefix}-count`}>
          題數
          <select
            id={`${idPrefix}-count`}
            aria-label="練習題數"
            value={selectValue}
            onChange={(event) => {
              onQuestionCountChange(
                event.target.value === "all"
                  ? "all"
                  : (Number(event.target.value) as ProgressPracticeQuestionCount)
              );
            }}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            {countOptions.map((count) => (
              <option key={`${idPrefix}-count-${count}`} value={count}>{count} 題</option>
            ))}
            <option value="all">全部（{availableQuestionCount} 題）</option>
          </select>
        </label>

        <QuestionOrderModeControl
          mode={orderMode}
          onChange={onOrderModeChange}
          compact
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-brand-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600" aria-live="polite">
          {yearRange.yearFrom}–{yearRange.yearTo} 年・
          <strong className="font-semibold tabular-nums text-ink">{availableQuestionCount}</strong> 題符合
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={effectiveQuestionCount === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play size={15} fill="currentColor" aria-hidden="true" />
          {effectiveQuestionCount > 0 ? `開始 ${effectiveQuestionCount} 題` : "這段年份沒有題目"}
        </button>
      </div>
    </section>
  );
}
