"use client";

import { ConfidenceLevel } from "@/types/quiz";
import { getConfidenceLabel } from "@/lib/quizAnalysis";

type ConfidenceSelectorProps = {
  value: ConfidenceLevel;
  expanded: boolean;
  onExpand: () => void;
  onSelect: (value: ConfidenceLevel) => void;
};

const lowConfidenceOptions: ConfidenceLevel[] = [1, 2, 3];

export function ConfidenceSelector({
  value,
  expanded,
  onExpand,
  onSelect
}: ConfidenceSelectorProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">目前信心</p>
          <p className="text-base font-semibold text-ink">{getConfidenceLabel(value)}</p>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
            expanded || value <= 3
              ? "bg-amber-100 text-amber-900 ring-2 ring-amber-300"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50"
          }`}
        >
          我不太確定
        </button>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {lowConfidenceOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`min-h-12 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                value === option
                  ? "bg-amber-500 text-white ring-2 ring-amber-200"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50"
              }`}
            >
              <span className="block font-semibold">信心 {option}</span>
              <span className="mt-1 block text-xs opacity-90">{getConfidenceLabel(option)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
