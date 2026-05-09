"use client";

import { ErrorType } from "@/types/quiz";

const errorTypes: ErrorType[] = ["不懂", "背錯", "看錯題幹", "兩選項猶豫", "粗心"];

type ErrorTypeSelectorProps = {
  value?: ErrorType;
  onSelect: (value: ErrorType) => void;
};

export function ErrorTypeSelector({ value, onSelect }: ErrorTypeSelectorProps) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
      <p className="text-sm font-medium text-rose-700">這題錯因（非必填）</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {errorTypes.map((errorType) => (
          <button
            key={errorType}
            type="button"
            onClick={() => onSelect(errorType)}
            className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              value === errorType
                ? "bg-rose-600 text-white ring-2 ring-rose-200"
                : "bg-white text-slate-700 ring-1 ring-rose-100 hover:bg-rose-100"
            }`}
          >
            {errorType}
          </button>
        ))}
      </div>
    </div>
  );
}
