"use client";

import { formatRocExamLabel, formatRocYear } from "@/lib/rocDate";


import { type MouseEvent, type ReactNode, useMemo } from "react";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { getQuestionPrimaryTag, isLegacyQuestionPrimaryTagPending, primaryTagIncludesSubject } from "@/lib/analysisPrimaryTag";
import { useQuestionChangeFeedback } from "@/components/useQuestionChangeFeedback";
import { OptionKey, Question } from "@/types/quiz";

type QuestionCardProps = {
  animateQuestionChanges?: boolean;
  question: Question;
  selectedAnswer?: OptionKey;
  submittedResult?: {
    selectedAnswer: OptionKey;
    correctAnswer: OptionKey;
    isCorrect: boolean;
  };
  eliminatedOptions?: OptionKey[];
  showEliminationControls?: boolean;
  eliminationDisabled?: boolean;
  onSelect: (value: OptionKey) => void;
  onToggleEliminatedOption?: (value: OptionKey) => void;
  showMetadata?: boolean;
  metadataExtra?: ReactNode;
};

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getSourceLabel(question: Question) {
  if (question.sourceType === "MOEX_PAST_EXAM") {
    const meta = [
      question.sourceYear ? formatRocYear(question.sourceYear) : null,
      question.sourceRound && `第 ${question.sourceRound} 次`,
      question.originalQuestionNumber && `第 ${question.originalQuestionNumber} 題`
    ]
      .filter(Boolean)
      .join(" ");
    return meta ? `考古題 ${meta}` : "考古題";
  }

  if (question.sourceType === "AI_GENERATED") {
    return "AI 補題";
  }

  if (question.source === "past-exam-inspired") return "考古題風格";
  if (question.source === "ai-generated") return "GPT 新題";
  return "本地題庫";
}

function getStableHash(text: string) {
  return text.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function getAcceptedAnswerSet(question: Question, fallbackAnswer: OptionKey) {
  if (question.answerCreditType === "all_credit") {
    return new Set(optionKeys.filter((key) => typeof question.options[key] === "string"));
  }

  if (
    (question.answerCreditType === "multiple_accepted" ||
      question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
  ) {
    return new Set(question.acceptedAnswers);
  }

  return new Set<OptionKey>([fallbackAnswer]);
}

export function QuestionCard({
  animateQuestionChanges = false,
  question,
  selectedAnswer,
  submittedResult,
  eliminatedOptions = [],
  showEliminationControls = false,
  eliminationDisabled = false,
  onSelect,
  onToggleEliminatedOption,
  showMetadata = true,
  metadataExtra
}: QuestionCardProps) {
  const questionRef = useQuestionChangeFeedback(question.id, animateQuestionChanges);
  const primaryTag = getQuestionPrimaryTag(question);
  const availableOptionKeys = useMemo(
    () =>
      optionKeys
        .filter((key) => typeof question.options[key] === "string")
        .sort(
          (a, b) =>
            getStableHash(`${question.id}-${a}`) - getStableHash(`${question.id}-${b}`)
        ),
    [question.id, question.options]
  );

  return (
    <div
      ref={questionRef}
      data-question-id={question.id}
      role={animateQuestionChanges ? "group" : undefined}
      aria-label={animateQuestionChanges ? "作答題目" : undefined}
      tabIndex={animateQuestionChanges ? -1 : undefined}
      className="study-question min-w-0 rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 sm:p-7"
    >
      {showMetadata ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {question.officialSource && (question.subject === "醫學（一）" || question.subject === "醫學（二）") ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">學科分類待核對</span>
            ) : null}
            {!primaryTag || !primaryTagIncludesSubject(primaryTag, question.subject) ? (
              <span className="max-w-full break-words rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                {question.subject}
              </span>
            ) : null}
            {primaryTag ? (
              <QuestionPrimaryTagBadge question={question} />
            ) : isLegacyQuestionPrimaryTagPending(question.id) ? (
              <span className="max-w-full break-words rounded-full bg-amber-50 px-3 py-1 text-amber-900">細分類待核對</span>
            ) : (
              <>
                <span className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {question.chapter}
                </span>
                {question.section ? <span className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {question.section}
                </span> : null}
              </>
            )}
            <span className="max-w-full break-words rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
              {getSourceLabel(question)}
            </span>
            {metadataExtra}
          </div>

          {question.sourceCitation ? (
            <p className="mt-3 break-words text-xs leading-6 text-slate-500">{formatRocExamLabel(question.sourceCitation)}</p>
          ) : null}
        </>
      ) : null}

      <QuestionStemBlock
        question={question}
        className={`${showMetadata ? "mt-5" : ""} break-words text-lg font-semibold leading-8 text-ink sm:text-xl`}
      />

      <div className="mt-6 grid gap-3">
        {availableOptionKeys.map((key) => {
          const isSelected = selectedAnswer === key;
          const acceptedAnswers = submittedResult
            ? getAcceptedAnswerSet(question, submittedResult.correctAnswer)
            : new Set<OptionKey>();
          const isCorrectOption = acceptedAnswers.has(key);
          const isSubmittedSelected = submittedResult?.selectedAnswer === key;
          const isAllCreditSelected =
            question.answerCreditType === "all_credit" && isSubmittedSelected;
          const isCorrectSelected =
            Boolean(submittedResult) && isSubmittedSelected && (submittedResult?.isCorrect || isCorrectOption);
          const isWrongSelected =
            Boolean(submittedResult) &&
            isSubmittedSelected &&
            !submittedResult?.isCorrect &&
            !isCorrectOption &&
            question.answerCreditType !== "all_credit";
          const reviewTone = isWrongSelected
            ? "wrong"
            : isCorrectOption || isCorrectSelected || isAllCreditSelected
              ? "correct"
              : null;
          const optionClassName = submittedResult
            ? reviewTone === "wrong"
              ? "border-rose-400 bg-rose-50 ring-2 ring-rose-200"
              : reviewTone === "correct"
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                : "border-slate-200 bg-white"
            : isSelected
              ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
              : "study-option-idle border-slate-200 bg-white";
          const labelClassName = submittedResult
            ? reviewTone === "wrong"
              ? "bg-rose-600 text-white"
              : reviewTone === "correct"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600"
            : isSelected
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-600";
          const answerBadge =
            submittedResult && isSubmittedSelected && (isCorrectOption || submittedResult.isCorrect)
              ? question.answerCreditType === "all_credit"
                ? "你的答案"
                : "你的答案 / 正解"
              : submittedResult && isSubmittedSelected
                ? "你的答案"
                : submittedResult && isCorrectOption
                ? "正解"
                  : "";
          const isEliminated = eliminatedOptions.includes(key);
          const showEliminationButton = showEliminationControls && Boolean(onToggleEliminatedOption);
          const handleToggleElimination = (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleEliminatedOption?.(key);
          };
          return (
            <div
              key={key}
              className={`study-option flex min-h-12 min-w-0 max-w-full items-stretch overflow-hidden rounded-3xl border ${optionClassName}`}
            >
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-pressed={isSelected}
                className="study-choice min-w-0 max-w-full flex-1 rounded-[inherit] px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-5"
              >
                <QuestionOptionBlock
                  question={question}
                  optionKey={key}
                  labelClassName={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    labelClassName
                  }`}
                  textClassName="min-w-0 max-w-full break-words text-sm leading-7 text-slate-800 [overflow-wrap:break-word] [word-break:normal] sm:text-base"
                  trailingContent={
                    answerBadge ? (
                      <span
                        className={`study-answer-badge inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-5 ${
                          reviewTone === "wrong"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {answerBadge}
                      </span>
                    ) : null
                  }
                />
              </button>
              {showEliminationButton ? (
                <div className="flex shrink-0 items-center px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    aria-label={`${isEliminated ? "取消排除" : "排除"}選項 ${key}`}
                    aria-pressed={isEliminated}
                    title={`${isEliminated ? "取消排除" : "排除"}選項 ${key}`}
                    disabled={eliminationDisabled}
                    onClick={handleToggleElimination}
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-base font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      isEliminated
                        ? "border-rose-300 bg-rose-100 text-rose-700 shadow-sm"
                        : "border-slate-200 bg-white/90 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    }`}
                  >
                    X
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
