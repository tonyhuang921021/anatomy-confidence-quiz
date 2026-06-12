"use client";

import { useState } from "react";
import { OptionKey, Question } from "@/types/quiz";

type CopyQuestionPromptButtonProps = {
  question: Question;
  selectedAnswer?: OptionKey;
  correctAnswer?: OptionKey;
  className?: string;
  compact?: boolean;
};

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getQuestionSourceLine(question: Question) {
  const parts = [
    question.sourceYear ? `${question.sourceYear} 年` : null,
    question.sourceRound ? `第 ${question.sourceRound} 次` : null,
    question.examSessionLabel,
    question.originalQuestionNumber ? `第 ${question.originalQuestionNumber} 題` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : question.id;
}

function buildQuestionPrompt({
  question,
  selectedAnswer,
  correctAnswer
}: {
  question: Question;
  selectedAnswer?: OptionKey;
  correctAnswer?: OptionKey;
}) {
  const optionsText = optionKeys
    .filter((key) => typeof question.options[key] === "string")
    .map((key) => `${key}. ${question.options[key]}`)
    .join("\n");

  const acceptedAnswerText =
    (question.answerCreditType === "multiple_accepted" || question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
      ? `${question.acceptedAnswers.join(" / ")} 皆可`
      : correctAnswer ?? question.answer;

  return [
    "請用繁體中文詳細解釋這題，請包含：",
    "1. 題目在考的核心知識點。",
    "2. 正確答案為什麼正確。",
    "3. 每個錯誤選項為什麼錯。",
    "4. 相關延伸觀念、國考常見陷阱與好記的整理方式。",
    "",
    `題目代碼：${question.id}`,
    `來源：${getQuestionSourceLine(question)}`,
    `分類：${question.subject} / ${question.chapter} / ${question.section}`,
    "",
    "題目：",
    question.stem,
    "",
    "選項：",
    optionsText,
    "",
    `正確答案：${acceptedAnswerText}`,
    selectedAnswer ? `我的答案：${selectedAnswer}` : null,
    "",
    question.testedConcept ? `目前標記觀念：${question.testedConcept}` : null,
    question.explanation ? `網站原本詳解：${question.explanation}` : null
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CopyQuestionPromptButton({
  question,
  selectedAnswer,
  correctAnswer,
  className = "",
  compact = false
}: CopyQuestionPromptButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(buildQuestionPrompt({ question, selectedAnswer, correctAnswer }));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`rounded-full bg-slate-900/90 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
          compact ? "inline-flex h-8 w-8 items-center justify-center p-0" : "min-h-9 px-3 py-1.5"
        }`}
        aria-label="複製題目給 AI 詳解"
        title="複製題目給 AI 詳解"
      >
        {compact ? "⧉" : "複製給 AI"}
      </button>
      {copied ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
          已複製
        </span>
      ) : null}
    </span>
  );
}
