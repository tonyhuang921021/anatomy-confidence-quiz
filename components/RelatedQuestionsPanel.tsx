"use client";

import { useMemo, useState } from "react";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import {
  StructuredExplanationText,
  hasCollapsibleStructuredExplanation,
  isDefaultInlineExplanationSectionTitle
} from "@/components/StructuredExplanationText";
import { buildRelatedQuestionIndex, getRelatedQuestions } from "@/lib/relatedQuestions";
import { isAcceptedSavedQuestionAnswer } from "@/lib/savedQuestions";
import type { OptionKey, Question, SavedQuestionSource } from "@/types/quiz";

type RelatedQuestionsPanelProps = {
  question: Question;
  relatedQuestions: Question[];
  savedQuestionSource?: SavedQuestionSource;
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

export function RelatedQuestionsPanel({
  question,
  relatedQuestions: questionCatalog,
  savedQuestionSource = "review"
}: RelatedQuestionsPanelProps) {
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, OptionKey>>({});
  const relatedQuestionIndex = useMemo(
    () => buildRelatedQuestionIndex(questionCatalog),
    [questionCatalog]
  );
  const relatedQuestions = getRelatedQuestions(question, relatedQuestionIndex);

  function submitRelatedAnswer(questionId: string, answer: OptionKey) {
    setSubmittedAnswers((current) => ({
      ...current,
      [questionId]: answer
    }));
  }

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
        const submittedAnswer = submittedAnswers[relatedQuestion.id];
        const hasSubmittedAnswer = Boolean(submittedAnswer);
        const isSubmittedAnswerCorrect = submittedAnswer
          ? isAcceptedSavedQuestionAnswer(relatedQuestion, submittedAnswer)
          : false;
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
              <span>類似題 {index + 1}</span>
              <QuestionPrimaryTagBadge
                question={relatedQuestion}
                prefix=""
                className="ml-2 inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-800 ring-1 ring-sky-100"
              />
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
              <div className="flex min-w-0 items-start gap-3">
                <QuestionStemBlock question={relatedQuestion} className="flex-1" />
                <SavedQuestionButton questionId={relatedQuestion.id} source={savedQuestionSource} />
              </div>
              <div className="space-y-2.5">
                {getOptionKeysFromQuestion(relatedQuestion).map((key) => {
                  const isSelected = submittedAnswer === key;
                  const isCorrectOption = isAcceptedSavedQuestionAnswer(relatedQuestion, key);
                  const isWrongSelected =
                    hasSubmittedAnswer &&
                    isSelected &&
                    !isSubmittedAnswerCorrect;
                  const showCorrect =
                    hasSubmittedAnswer &&
                    (isCorrectOption || (relatedQuestion.answerCreditType === "all_credit" && isSelected));
                  const optionClassName = isWrongSelected
                    ? "border-rose-300 bg-rose-50"
                    : showCorrect
                      ? "border-emerald-300 bg-emerald-50"
                      : isSelected
                        ? "border-slate-900 bg-white"
                        : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40";
                  const labelClassName = `mt-0.5 inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                    isWrongSelected
                      ? "bg-rose-600 text-white ring-rose-600"
                      : showCorrect
                        ? "bg-emerald-600 text-white ring-emerald-600"
                        : "bg-white text-slate-700 ring-slate-200"
                  }`;

                  return (
                    <button
                      key={`${relatedQuestion.id}-${key}`}
                      type="button"
                      onClick={() => submitRelatedAnswer(relatedQuestion.id, key)}
                      className={`w-full rounded-2xl border text-left transition ${optionClassName}`}
                    >
                      <QuestionOptionBlock
                        question={relatedQuestion}
                        optionKey={key}
                        wrapperClassName="px-3 py-3 sm:px-4"
                        labelClassName={labelClassName}
                        trailingContent={
                          isWrongSelected ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                              你的答案
                            </span>
                          ) : showCorrect ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              正解
                            </span>
                          ) : null
                        }
                      />
                    </button>
                  );
                })}
              </div>
              {hasSubmittedAnswer ? (
                <div className="space-y-3 rounded-2xl bg-white p-3 text-sm leading-7 ring-1 ring-slate-200 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isSubmittedAnswerCorrect
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {isSubmittedAnswerCorrect ? "答對了" : "答錯了"}
                    </span>
                    <p>
                      <span className="font-semibold">正確答案：</span>
                      {getAnswerLabel(relatedQuestion)}
                    </p>
                  </div>
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
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
