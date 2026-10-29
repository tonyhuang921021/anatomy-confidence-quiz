"use client";

import { tokenizeQuestionText } from "@/lib/questionTextFormat";

type FormattedQuestionTextProps = {
  text: string;
  preserveWords?: boolean;
};

export function FormattedQuestionText({ text, preserveWords = false }: FormattedQuestionTextProps) {
  const tokenClassName = preserveWords
    ? "break-words [overflow-wrap:break-word] [word-break:normal]"
    : "[overflow-wrap:anywhere]";

  return (
    <>
      {tokenizeQuestionText(text).map((token, index) => {
        const hasScript = token.subscript || token.superscript;
        const className = hasScript
          ? `${tokenClassName} inline-flex items-baseline whitespace-nowrap align-baseline`
          : tokenClassName;

        return (
          <span key={`${token.text}-${token.subscript ?? ""}-${token.superscript ?? ""}-${index}`} className={className}>
            {preserveWords ? token.text.split(/([①-⑳])/u).map((part, partIndex) => /^[①-⑳]$/u.test(part) ? (
              <span key={`${part}-${partIndex}`} className="question-circled-number" data-digit={part.codePointAt(0)! - 0x2460 + 1} role="img" aria-label={part}>{part}</span>
            ) : part) : token.text}
            {token.subscript ? (
              <sub className="relative top-[0.22em] text-[0.68em] leading-none">{token.subscript}</sub>
            ) : null}
            {token.superscript ? (
              <sup className="relative -top-[0.34em] text-[0.62em] leading-none">{token.superscript}</sup>
            ) : null}
          </span>
        );
      })}
    </>
  );
}
