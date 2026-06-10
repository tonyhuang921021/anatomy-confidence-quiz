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
};

function renderImage(src: string, alt: string) {
  return (
    <img
      src={src}
      alt={alt}
      className="mt-3 block max-h-[480px] max-w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
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
    <div className={`min-w-0 ${className ?? ""}`}>
      <p className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">
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
  wrapperClassName
}: QuestionOptionBlockProps) {
  const optionText = question.options[optionKey];
  const optionImage = question.optionImages?.[optionKey];

  if (typeof optionText !== "string") {
    return null;
  }

  return (
    <div className={wrapperClassName}>
      <div className="flex items-start gap-3">
        <span
          className={
            labelClassName ??
            "mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
          }
        >
          {optionKey}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={
              textClassName ??
              "min-w-0 text-sm font-medium leading-6 text-slate-800 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-7"
            }
          >
            <FormattedQuestionText text={optionText} />
          </p>
          {optionImage ? renderImage(optionImage, `${question.id} 選項 ${optionKey} 圖片`) : null}
        </div>
      </div>
    </div>
  );
}
