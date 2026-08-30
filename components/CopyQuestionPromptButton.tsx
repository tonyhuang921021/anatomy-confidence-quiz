"use client";

import { useEffect, useRef, useState } from "react";
import { getQuestionClassificationLabel } from "@/lib/analysisPrimaryTag";
import { OptionKey, Question } from "@/types/quiz";

type CopyQuestionPromptButtonProps = {
  question: Question;
  selectedAnswer?: OptionKey;
  correctAnswer?: OptionKey;
  eliminatedOptions?: OptionKey[];
  className?: string;
  compact?: boolean;
};

const optionKeys: OptionKey[] = ["A", "B", "C", "D", "E"];

function getQuestionSourceLine(question: Question) {
  if (question.sourceType === "AI_GENERATED" || question.source === "ai-generated") {
    return [
      question.examSessionLabel ?? "AI 模擬題",
      question.originalQuestionNumber ? `第 ${question.originalQuestionNumber} 題` : null
    ].filter(Boolean).join(" ");
  }

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
  correctAnswer,
  eliminatedOptions = []
}: {
  question: Question;
  selectedAnswer?: OptionKey;
  correctAnswer?: OptionKey;
  eliminatedOptions?: OptionKey[];
}) {
  const optionsText = optionKeys
    .filter((key) => typeof question.options[key] === "string")
    .map((key) => `${key}. ${question.options[key]}`)
    .join("\n");

  const acceptedAnswerText =
    question.answerCreditType === "all_credit"
      ? `${optionKeys.filter((key) => typeof question.options[key] === "string").join(" / ")} 皆可（官方送分）`
      : (question.answerCreditType === "multiple_accepted" ||
            question.answerCreditType === "multiple_answers") &&
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
    `分類：${getQuestionClassificationLabel(question)}`,
    "",
    "題目：",
    question.stem,
    "",
    "選項：",
    optionsText,
    "",
    `正確答案：${acceptedAnswerText}`,
    selectedAnswer ? `我的答案：${selectedAnswer}` : null,
    eliminatedOptions.length > 0 ? `我作答時打叉排除的選項：${eliminatedOptions.join("、")}` : null
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
  eliminatedOptions,
  className = "",
  compact = false
}: CopyQuestionPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await copyToClipboard(buildQuestionPrompt({ question, selectedAnswer, correctAnswer, eliminatedOptions }));
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1400);
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className={`rounded-full bg-slate-900/90 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 ${
          compact ? "inline-flex h-8 w-8 items-center justify-center p-0" : "min-h-9 px-3 py-1.5"
        }`}
        aria-label={copied ? "題目已複製" : "複製題目給 AI 詳解"}
        title={copied ? "題目已複製" : "複製題目給 AI 詳解"}
      >
        {compact ? (copied ? "✓" : "⧉") : copied ? "已複製" : "複製給 AI"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "題目已複製" : ""}
      </span>
    </span>
  );
}
