"use client";

import { useMemo } from "react";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { OptionKey, Question } from "@/types/quiz";

type QuestionCardProps = {
  question: Question;
  selectedAnswer?: OptionKey;
  onSelect: (value: OptionKey) => void;
};

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getSourceLabel(question: Question) {
  if (question.sourceType === "MOEX_PAST_EXAM") {
    const meta = [
      question.sourceYear,
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

export function QuestionCard({ question, selectedAnswer, onSelect }: QuestionCardProps) {
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
    <div className="min-w-0 rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-7">
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="max-w-full break-words rounded-full bg-brand-100 px-3 py-1 text-brand-800">
          {question.subject}
        </span>
        <span className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          {question.chapter}
        </span>
        <span className="max-w-full break-words rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          {question.section}
        </span>
        <span className="max-w-full break-words rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
          {getSourceLabel(question)}
        </span>
      </div>

      {question.sourceCitation ? (
        <p className="mt-3 break-words text-xs leading-6 text-slate-500">{question.sourceCitation}</p>
      ) : null}

      <QuestionStemBlock
        question={question}
        className="mt-5 break-words text-lg font-semibold leading-8 text-ink sm:text-xl"
      />

      <div className="mt-6 grid gap-3">
        {availableOptionKeys.map((key) => {
          const isSelected = selectedAnswer === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`min-h-12 rounded-3xl border px-4 py-4 text-left transition sm:px-5 ${
                isSelected
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                  : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50"
              }`}
            >
              <QuestionOptionBlock
                question={question}
                optionKey={key}
                labelClassName={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isSelected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
                textClassName="min-w-0 break-words text-sm leading-7 text-slate-800 sm:text-base"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
