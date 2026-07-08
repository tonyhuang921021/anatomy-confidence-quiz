"use client";

import { useMemo } from "react";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import {
  StructuredExplanationText,
  hasCollapsibleStructuredExplanation,
  isDefaultInlineExplanationSectionTitle
} from "@/components/StructuredExplanationText";
import { buildRelatedQuestionIndex, getRelatedQuestions } from "@/lib/relatedQuestions";
import type { OptionKey, Question } from "@/types/quiz";

type RelatedQuestionsPanelProps = {
  question: Question;
  relatedQuestions: Question[];
};

function getOptionKeysFromQuestion(question: Question) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof question.options[key] === "string"
  );
}

function getAnswerLabel(question: Question) {
  if (
    (question.answerCreditType === "multiple_accepted" ||
      question.answerCreditType === "multiple_answers") &&
    question.acceptedAnswers?.length
  ) {
    return `${question.acceptedAnswers.join("/")} 皆可`;
  }

  if (question.answerCreditType === "all_credit") return "本題一律給分";
  return question.answer;
}

export function RelatedQuestionsPanel({ question, relatedQuestions: questionCatalog }: RelatedQuestionsPanelProps) {
  const relatedQuestionIndex = useMemo(
    () => buildRelatedQuestionIndex(questionCatalog),
    [questionCatalog]
  );
  const relatedQuestions = getRelatedQuestions(question, relatedQuestionIndex);

  if (relatedQuestions.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        目前還找不到同觀念的類似題。
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {relatedQuestions.map((relatedQuestion, index) => {
        const shouldCollapseAiExplanation = hasCollapsibleStructuredExplanation(relatedQuestion.explanation);
        const aiExplanationContent = shouldCollapseAiExplanation ? (
          <StructuredExplanationText
            text={relatedQuestion.explanation}
            label=""
            compact
            sectionFilter={(section) => !isDefaultInlineExplanationSectionTitle(section.title)}
            fallbackToFullText={false}
          />
        ) : undefined;

        return (
          <details key={`${question.id}-related-${relatedQuestion.id}`} className="rounded-2xl bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-ink">
              類似題 {index + 1}：{relatedQuestion.chapter} / {relatedQuestion.section}
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
              <QuestionStemBlock question={relatedQuestion} />
              <div className="space-y-2.5">
                {getOptionKeysFromQuestion(relatedQuestion).map((key) => (
                  <QuestionOptionBlock
                    key={`${relatedQuestion.id}-${key}`}
                    question={relatedQuestion}
                    optionKey={key}
                    wrapperClassName="rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-4"
                    labelClassName="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  />
                ))}
              </div>
              <p>
                <span className="font-semibold">正確答案：</span>
                {getAnswerLabel(relatedQuestion)}
              </p>
              <StructuredExplanationText
                text={relatedQuestion.explanation}
                label="重點解析"
                compact
                sectionFilter={
                  shouldCollapseAiExplanation
                    ? (section) => isDefaultInlineExplanationSectionTitle(section.title)
                    : undefined
                }
              />
              <QuestionExplanationTabs
                question={relatedQuestion}
                compact
                className="mt-3"
                aiExplanationContent={aiExplanationContent}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
