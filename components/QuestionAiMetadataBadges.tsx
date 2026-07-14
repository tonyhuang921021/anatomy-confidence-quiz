import type { DifficultyLevel, Question } from "@/types/quiz";

type QuestionAiMetadataBadgesProps = {
  question: Question;
  className?: string;
};

const DIFFICULTY_LABELS: Record<
  DifficultyLevel,
  { label: string; className: string }
> = {
  basic: {
    label: "基礎",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-100"
  },
  easy: {
    label: "簡單",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-100"
  },
  medium: {
    label: "中等",
    className: "bg-amber-50 text-amber-900 ring-amber-100"
  },
  hard: {
    label: "困難",
    className: "bg-rose-50 text-rose-800 ring-rose-100"
  }
};

export function QuestionAiMetadataBadges({
  question,
  className = ""
}: QuestionAiMetadataBadgesProps) {
  const isAiQuestion =
    question.sourceType === "AI_GENERATED" || question.source === "ai-generated";
  const difficulty = question.difficulty
    ? DIFFICULTY_LABELS[question.difficulty]
    : undefined;

  if (!isAiQuestion || (!difficulty && !question.isDetailQuestion)) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="AI 題目標籤"
    >
      {difficulty ? (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${difficulty.className}`}
        >
          難度 {difficulty.label}
        </span>
      ) : null}
      {question.isDetailQuestion ? (
        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800 ring-1 ring-sky-100">
          細節題
        </span>
      ) : null}
    </div>
  );
}
