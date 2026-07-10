import { getQuestionPrimaryTag } from "@/lib/analysisPrimaryTag";
import type { Question } from "@/types/quiz";

type QuestionPrimaryTagBadgeProps = {
  question: Pick<Question, "id" | "section" | "primaryTag">;
  className?: string;
  prefix?: string;
};

export function QuestionPrimaryTagBadge({
  question,
  className = "rounded-full bg-sky-50 px-3 py-1 text-sky-800 ring-1 ring-sky-100",
  prefix = ""
}: QuestionPrimaryTagBadgeProps) {
  const primaryTag = getQuestionPrimaryTag(question);
  if (!primaryTag) return null;

  return (
    <span className={`max-w-full break-words ${className}`}>
      {prefix ? `${prefix}：` : ""}
      {primaryTag}
    </span>
  );
}
