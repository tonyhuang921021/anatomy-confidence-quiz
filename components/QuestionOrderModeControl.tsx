"use client";

import { useCallback, useEffect, useState } from "react";

export type QuestionOrderMode = "recent" | "unseen";

const QUESTION_ORDER_MODE_STORAGE_KEY = "anatomy-confidence-practice-order-mode";

function readStoredMode(): QuestionOrderMode {
  try {
    return window.localStorage.getItem(QUESTION_ORDER_MODE_STORAGE_KEY) === "unseen"
      ? "unseen"
      : "recent";
  } catch {
    return "recent";
  }
}

export function useQuestionOrderMode() {
  const [mode, setModeState] = useState<QuestionOrderMode>("recent");

  useEffect(() => {
    setModeState(readStoredMode());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === QUESTION_ORDER_MODE_STORAGE_KEY) {
        setModeState(event.newValue === "unseen" ? "unseen" : "recent");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setMode = useCallback((nextMode: QuestionOrderMode) => {
    setModeState(nextMode);
    try {
      window.localStorage.setItem(QUESTION_ORDER_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Keep the in-memory choice when browser storage is unavailable.
    }
  }, []);

  return {
    mode,
    setMode,
    prioritizeUnseen: mode === "unseen"
  };
}

type QuestionOrderModeControlProps = {
  mode: QuestionOrderMode;
  onChange: (mode: QuestionOrderMode) => void;
  className?: string;
};

const MODE_DESCRIPTION: Record<QuestionOrderMode, string> = {
  recent: "先排近年題，每年內穿插沒做過與容易錯的題目。",
  unseen: "所有沒做過的題目跨年份排前，做過的題目排後。"
};

export function QuestionOrderModeControl({
  mode,
  onChange,
  className = ""
}: QuestionOrderModeControlProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">做題順序</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{MODE_DESCRIPTION[mode]}</p>
      </div>
      <div
        role="group"
        aria-label="選擇做題順序"
        className="grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:w-auto"
      >
        <button
          type="button"
          aria-pressed={mode === "recent"}
          onClick={() => onChange("recent")}
          className={`min-h-10 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            mode === "recent"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-white/70 hover:text-ink"
          }`}
        >
          近年優先
        </button>
        <button
          type="button"
          aria-pressed={mode === "unseen"}
          onClick={() => onChange("unseen")}
          className={`min-h-10 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            mode === "unseen"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-white/70 hover:text-ink"
          }`}
        >
          未做優先
        </button>
      </div>
    </div>
  );
}
