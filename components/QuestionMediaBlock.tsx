import { type ReactNode } from "react";
import { OptionKey, Question } from "@/types/quiz";
import { FormattedQuestionText } from "@/components/FormattedQuestionText";

type QuestionStemBlockProps = {
  question: Question;
  className?: string;
};

type QuestionOptionBlockProps = {
  question: Question;
  optionKey: OptionKey;
  labelClassName?: string;
  textClassName?: string;
  wrapperClassName?: string;
  trailingContent?: ReactNode;
};

function renderImage(src: string, alt: string) {
  return (
    <img
      src={src}
      alt={alt}
      className="mt-3 block h-auto max-h-[480px] max-w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
      style={{
        width: "auto",
        height: "auto"
      }}
      loading="lazy"
    />
  );
}

export function QuestionStemBlock({ question, className }: QuestionStemBlockProps) {
  return (
    <div className={`min-w-0 max-w-full ${className ?? ""}`}>
      <p className="min-w-0 max-w-full font-semibold text-slate-900 [overflow-wrap:anywhere]">
        <FormattedQuestionText text={question.stem} />
      </p>
      {question.stemImage ? renderImage(question.stemImage, `${question.id} 題目圖片`) : null}
    </div>
  );
}

export function QuestionOptionBlock({
  question,
  optionKey,
  labelClassName,
  textClassName,
  wrapperClassName,
  trailingContent
}: QuestionOptionBlockProps) {
  const optionText = question.options[optionKey];
  const optionImage = question.optionImages?.[optionKey];

  if (typeof optionText !== "string") {
    return null;
  }

  return (
    <div className={`min-w-0 max-w-full ${wrapperClassName ?? ""}`}>
      <div className="flex min-w-0 max-w-full items-start gap-3">
        <span
          className={
            labelClassName
              ? `${labelClassName} shrink-0`
              : "mt-0.5 inline-flex min-w-8 shrink-0 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
          }
        >
          {optionKey}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={
              textClassName ??
              "min-w-0 max-w-full text-sm font-medium leading-6 text-slate-800 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-7"
            }
          >
            <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">
              <FormattedQuestionText text={optionText} />
            </span>
            {trailingContent ? <span className="ml-2 inline-flex align-middle">{trailingContent}</span> : null}
          </div>
          {optionImage ? renderImage(optionImage, `${question.id} 選項 ${optionKey} 圖片`) : null}
        </div>
      </div>
    </div>
  );
}
