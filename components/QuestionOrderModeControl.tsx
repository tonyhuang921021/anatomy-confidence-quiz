"use client";

import { useCallback, useEffect, useState } from "react";

export type QuestionOrderMode = "recent" | "unseen";

const QUESTION_ORDER_MODE_STORAGE_KEY = "anatomy-confidence-practice-order-mode";

function readStoredMode(defaultMode: QuestionOrderMode): QuestionOrderMode {
  try {
    const storedMode = window.localStorage.getItem(QUESTION_ORDER_MODE_STORAGE_KEY);
    return storedMode === "recent" || storedMode === "unseen"
      ? storedMode
      : defaultMode;
  } catch {
    return defaultMode;
  }
}

export function useQuestionOrderMode(defaultMode: QuestionOrderMode = "recent") {
  const [mode, setModeState] = useState<QuestionOrderMode>(defaultMode);

  useEffect(() => {
    setModeState(readStoredMode(defaultMode));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === QUESTION_ORDER_MODE_STORAGE_KEY) {
        setModeState(
          event.newValue === "recent" || event.newValue === "unseen"
            ? event.newValue
            : defaultMode
        );
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultMode]);

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
  compact?: boolean;
};

const MODE_DESCRIPTION: Record<QuestionOrderMode, string> = {
  recent: "每 3–4 題穿插 1 題近年複習，其餘先出沒做過的題目。",
  unseen: "不分年份，先做完沒做過的題目，再複習做過的題目。"
};

export function QuestionOrderModeControl({
  mode,
  onChange,
  className = "",
  compact = false
}: QuestionOrderModeControlProps) {
  return (
    <div className={`${compact ? "grid content-start gap-2" : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"} ${className}`}>
      <div className="min-w-0">
        <p className={compact ? "text-xs font-semibold text-slate-500" : "text-sm font-semibold text-ink"}>做題順序</p>
        {compact ? null : (
          <p className="mt-1 text-sm leading-6 text-slate-500">{MODE_DESCRIPTION[mode]}</p>
        )}
      </div>
      <div
        role="group"
        aria-label="選擇做題順序"
        className={`grid w-full shrink-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 ${compact ? "" : "sm:w-auto"}`}
      >
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
          近年穿插
        </button>
      </div>
      {compact ? (
        <p className="text-xs leading-5 text-slate-500">{MODE_DESCRIPTION[mode]}</p>
      ) : null}
    </div>
  );
}
