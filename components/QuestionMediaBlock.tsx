import { formatRocYear } from "@/lib/rocDate";
import { type ReactNode } from "react";
import { OptionKey, Question } from "@/types/quiz";
import { FormattedQuestionText } from "@/components/FormattedQuestionText";

type QuestionStemBlockProps = {
  question: Question;
  className?: string;
};

type QuestionStemMediaProps = {
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

function renderImage(src: string, alt: string, dimensions?: { width: number; height: number }) {
  return (
    <img
      key={`${alt}:${src}`}
      src={src}
      alt={alt}
      width={dimensions?.width}
      height={dimensions?.height}
      className="mt-3 block h-auto max-h-[480px] max-w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
      style={{
        width: "auto",
        height: "auto"
      }}
      loading="lazy"
    />
  );
}

export function QuestionStemMedia({ question, className }: QuestionStemMediaProps) {
  if (!question.stemImage) return null;

  return (
    <div className={`min-w-0 max-w-full ${className ?? ""}`}>
      {renderImage(question.stemImage, `${question.id} 題目圖片`, question.officialSource?.image === question.stemImage ? question.officialSource : undefined)}
    </div>
  );
}

export function QuestionStemBlock({ question, className }: QuestionStemBlockProps) {
  return (
    <div className={`min-w-0 max-w-full ${className ?? ""}`}>
      {question.sharedContext ? (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm font-normal leading-7 text-slate-700">
          <p className="font-semibold">共同情境{question.sharedContext.sourceQuestionNumber ? `（原第 ${question.sharedContext.sourceQuestionNumber} 題題幹）` : ""}</p>
          <FormattedQuestionText text={question.sharedContext.stem} />
        </div>
      ) : null}
      <p className="min-w-0 max-w-full font-semibold text-slate-900 [overflow-wrap:anywhere]">
        <FormattedQuestionText text={question.stem} />
      </p>
      <QuestionStemMedia question={question} />
      {question.officialSource ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-normal text-slate-600">
          <summary className="cursor-pointer font-semibold">查看官方原題（含圖表）</summary>
          <p className="mt-2 text-xs leading-6">{formatRocYear(question.sourceYear)}舊制：{question.officialSource.scope}</p>
          <p className="mt-1 text-xs leading-6">歷史題依當年官方最終答案採分；法規與醫學知識可能已有更新。</p>
          <img
            key={`${question.id}:${question.officialSource.image}`}
            src={question.officialSource.image}
            alt={`${question.id} 官方原題完整圖，含原始選項及圖表`}
            width={question.officialSource.width}
            height={question.officialSource.height}
            loading="lazy"
            className="mt-3 h-auto w-full rounded-lg border border-slate-100"
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <a href={`${question.officialSource.questionUrl}#page=${question.officialSource.page}`} target="_blank" rel="noopener noreferrer" className="underline">考選部題本第 {question.officialSource.page} 頁</a>
            <a href={question.officialSource.answerUrl} target="_blank" rel="noopener noreferrer" className="underline">考選部最終更正答案</a>
          </div>
        </details>
      ) : null}
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
              "min-w-0 max-w-full break-words text-sm font-medium leading-6 text-slate-800 [overflow-wrap:break-word] [word-break:normal] sm:text-[15px] sm:leading-7"
            }
          >
            <span className="min-w-0 max-w-full break-words [overflow-wrap:break-word] [word-break:normal]">
              <FormattedQuestionText text={optionText} preserveWords />
            </span>
            {trailingContent ? <span className="ml-2 inline-flex align-middle">{trailingContent}</span> : null}
          </div>
          {optionImage ? renderImage(optionImage, `${question.id} 選項 ${optionKey} 圖片`) : null}
        </div>
      </div>
    </div>
  );
}
