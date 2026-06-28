"use client";

import {
  toggleSavedQuestionRecord,
  useSavedQuestionRecords
} from "@/lib/savedQuestions";
import { useAuth } from "@/components/AuthProvider";
import { SavedQuestionSource } from "@/types/quiz";

type SavedQuestionButtonProps = {
  questionId: string;
  source: SavedQuestionSource;
  className?: string;
  showLabel?: boolean;
};

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
    >
      <path
        d="M7.25 4.75h9.5v14.5L12 16.55l-4.75 2.7V4.75Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavedQuestionButton({
  questionId,
  source,
  className = "",
  showLabel = false
}: SavedQuestionButtonProps) {
  const { session } = useAuth();
  const savedQuestionRecords = useSavedQuestionRecords(session?.access_token);
  const record = savedQuestionRecords[questionId];
  const isSaved = Boolean(record);
  const label = isSaved ? "取消儲存題目" : "儲存題目";
  const progressLabel = record ? `，答對 ${record.correctCount} / 2` : "";

  return (
    <button
      type="button"
      onClick={() => toggleSavedQuestionRecord(questionId, source, session?.access_token)}
      aria-pressed={isSaved}
      aria-label={`${label}${progressLabel}`}
      title={`${label}${progressLabel}`}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-brand-100 ${
        isSaved
          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      } ${className}`}
    >
      <BookmarkIcon filled={isSaved} />
      {showLabel ? <span>{isSaved ? "已儲存" : "儲存題目"}</span> : <span className="sr-only">{label}</span>}
    </button>
  );
}
