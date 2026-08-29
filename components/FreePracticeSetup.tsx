"use client";

import { Check, ChevronDown, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  QuestionOrderModeControl,
  type QuestionOrderMode
} from "@/components/QuestionOrderModeControl";
import {
  PROGRESS_PRACTICE_QUESTION_COUNTS,
  resolveProgressPracticeQuestionCount
} from "@/lib/progressPractice";
import { PRACTICE_YEAR_OPTIONS } from "@/lib/practiceYears";
import type { PracticeQuestionCount, PracticeYearRange } from "@/lib/storage";

type FreePracticeSetupProps = {
  idPrefix: string;
  label: string;
  availableQuestionCount: number;
  questionCount: PracticeQuestionCount;
  yearRange: PracticeYearRange;
  orderMode: QuestionOrderMode;
  stopAfterReview: boolean;
  fastAnswerMode: boolean;
  keyboardNavigationEnabled: boolean;
  onQuestionCountChange: (count: PracticeQuestionCount) => void;
  onYearRangeChange: (range: PracticeYearRange) => void;
  onOrderModeChange: (mode: QuestionOrderMode) => void;
  onStopAfterReviewChange: (enabled: boolean) => void;
  onFastAnswerModeChange: (enabled: boolean) => void;
  onKeyboardNavigationChange: (enabled: boolean) => void;
  onStart: () => void;
};

function SetupChoice({
  selected,
  onClick,
  children
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 min-[360px]:gap-1.5 min-[360px]:px-3 min-[360px]:text-sm ${
        selected
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-white/70 hover:text-ink"
      }`}
    >
      {selected ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

export function FreePracticeSetup({
  idPrefix,
  label,
  availableQuestionCount,
  questionCount,
  yearRange,
  orderMode,
  stopAfterReview,
  fastAnswerMode,
  keyboardNavigationEnabled,
  onQuestionCountChange,
  onYearRangeChange,
  onOrderModeChange,
  onStopAfterReviewChange,
  onFastAnswerModeChange,
  onKeyboardNavigationChange,
  onStart
}: FreePracticeSetupProps) {
  const [expanded, setExpanded] = useState(false);
  const settingsPanelId = `${idPrefix}-settings-panel`;
  const fixedQuestionCount = resolveProgressPracticeQuestionCount(
    questionCount,
    availableQuestionCount
  );
  const effectiveQuestionCount = stopAfterReview
    ? availableQuestionCount
    : fixedQuestionCount;
  const countSummary = stopAfterReview
    ? "不限題數"
    : availableQuestionCount < questionCount
      ? `${fixedQuestionCount} 題（本範圍）`
      : `${questionCount} 題一輪`;
  const orderSummary = orderMode === "unseen" ? "未做優先" : "近年穿插";

  return (
    <section
      aria-label={`${label}自由做題設定`}
      className="rounded-lg border border-brand-200 bg-brand-50/45"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">自由做題設定</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500" aria-live="polite">
            {yearRange.yearFrom}–{yearRange.yearTo} 年・{countSummary}・{orderSummary}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={settingsPanelId}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:self-auto"
        >
          {expanded ? "收起設定" : "調整設定"}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div
        id={settingsPanelId}
        hidden={!expanded}
        className="border-t border-brand-100 px-4 py-5 sm:px-5"
      >
          <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(14rem,0.8fr)_minmax(17rem,1fr)]">
            <fieldset>
              <legend className="text-xs font-semibold text-slate-500">年份</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label
                  className="grid gap-1 text-[11px] font-medium text-slate-500"
                  htmlFor={`${idPrefix}-year-from`}
                >
                  起始年份
                  <select
                    id={`${idPrefix}-year-from`}
                    value={yearRange.yearFrom}
                    onChange={(event) => {
                      const yearFrom = Number(event.target.value);
                      onYearRangeChange({
                        yearFrom,
                        yearTo: Math.max(yearFrom, yearRange.yearTo)
                      });
                    }}
                    className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
                  >
                    {PRACTICE_YEAR_OPTIONS.map((year) => (
                      <option key={`${idPrefix}-from-${year}`} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label
                  className="grid gap-1 text-[11px] font-medium text-slate-500"
                  htmlFor={`${idPrefix}-year-to`}
                >
                  結束年份
                  <select
                    id={`${idPrefix}-year-to`}
                    value={yearRange.yearTo}
                    onChange={(event) => {
                      const yearTo = Number(event.target.value);
                      onYearRangeChange({
                        yearFrom: Math.min(yearRange.yearFrom, yearTo),
                        yearTo
                      });
                    }}
                    className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
                  >
                    {PRACTICE_YEAR_OPTIONS.map((year) => (
                      <option key={`${idPrefix}-to-${year}`} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-500">練習長度</legend>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
              >
                <SetupChoice
                  selected={!stopAfterReview}
                  onClick={() => onStopAfterReviewChange(false)}
                >
                  固定題數
                </SetupChoice>
                <SetupChoice
                  selected={stopAfterReview}
                  onClick={() => onStopAfterReviewChange(true)}
                >
                  不限題數
                </SetupChoice>
              </div>
              {!stopAfterReview ? (
                <label
                  className="mt-2 grid gap-1 text-[11px] font-medium text-slate-500"
                  htmlFor={`${idPrefix}-count`}
                >
                  每輪題數
                  <select
                    id={`${idPrefix}-count`}
                    value={questionCount}
                    onChange={(event) =>
                      onQuestionCountChange(Number(event.target.value) as PracticeQuestionCount)
                    }
                    className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100"
                  >
                    {PROGRESS_PRACTICE_QUESTION_COUNTS.map((count) => (
                      <option key={`${idPrefix}-count-${count}`} value={count}>{count} 題</option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  題池會持續補題，每題看完詳解後都能結束。
                </p>
              )}
            </fieldset>

            <QuestionOrderModeControl
              mode={orderMode}
              onChange={onOrderModeChange}
              compact
            />
          </div>

          <div className="mt-5 grid gap-4 border-t border-brand-100 pt-5 sm:grid-cols-2">
            <fieldset>
              <legend className="text-xs font-semibold text-slate-500">送出答案</legend>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
              >
                <SetupChoice
                  selected={!fastAnswerMode}
                  onClick={() => onFastAnswerModeChange(false)}
                >
                  按鈕送出
                </SetupChoice>
                <SetupChoice
                  selected={fastAnswerMode}
                  onClick={() => onFastAnswerModeChange(true)}
                >
                  點選即送出
                </SetupChoice>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold text-slate-500">方向鍵切題</legend>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
              >
                <SetupChoice
                  selected={!keyboardNavigationEnabled}
                  onClick={() => onKeyboardNavigationChange(false)}
                >
                  關閉
                </SetupChoice>
                <SetupChoice
                  selected={keyboardNavigationEnabled}
                  onClick={() => onKeyboardNavigationChange(true)}
                >
                  開啟
                </SetupChoice>
              </div>
            </fieldset>
          </div>

          <p className="mt-4 text-xs text-slate-500">調整後會自動記住，下次直接沿用。</p>
      </div>

      <div className="flex flex-col gap-3 border-t border-brand-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm text-slate-600">
          <strong className="font-semibold tabular-nums text-ink">{availableQuestionCount}</strong> 題符合目前範圍
          {stopAfterReview && availableQuestionCount > 0 ? "・每題後可結束" : ""}
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={effectiveQuestionCount === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Play size={15} fill="currentColor" aria-hidden="true" />
          {effectiveQuestionCount === 0
            ? "這段年份沒有題目"
            : stopAfterReview
              ? "開始自由做題"
              : `開始 ${effectiveQuestionCount} 題`}
        </button>
      </div>
    </section>
  );
}
