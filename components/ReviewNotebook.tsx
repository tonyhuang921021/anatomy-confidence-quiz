"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  loadSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import {
  applyQuestionExplanationOverride,
  loadQuestionExplanationOverrides,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides
} from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { useAuth } from "@/components/AuthProvider";
import {
  OptionKey,
  Question,
  QuestionExplanationOverride,
  ReviewQuestionItem
} from "@/types/quiz";

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sortByRecent(items: ReviewQuestionItem[]) {
  return [...items].sort((a, b) => {
    const timeA = a.history.lastAttemptedAt ? new Date(a.history.lastAttemptedAt).getTime() : 0;
    const timeB = b.history.lastAttemptedAt ? new Date(b.history.lastAttemptedAt).getTime() : 0;
    return timeB - timeA || b.riskScore - a.riskScore || b.history.wrong - a.history.wrong;
  });
}

function getOptionKeys(item: ReviewQuestionItem) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof item.question.options[key] === "string"
  );
}

function getOptionKeysFromQuestion(question: Question) {
  return (["A", "B", "C", "D", "E"] as OptionKey[]).filter(
    (key) => typeof question.options[key] === "string"
  );
}

function getRelatedQuestions(currentQuestion: Question, allQuestions: Question[], limit = 4) {
  const normalizedConcept = currentQuestion.testedConcept.trim().toLowerCase();

  const sameConcept = allQuestions.filter(
    (question) =>
      question.id !== currentQuestion.id &&
      question.testedConcept.trim().toLowerCase() === normalizedConcept
  );

  const sameSection = allQuestions.filter(
    (question) =>
      question.id !== currentQuestion.id &&
      question.section === currentQuestion.section &&
      question.chapter === currentQuestion.chapter &&
      question.testedConcept.trim().toLowerCase() !== normalizedConcept
  );

  return [...sameConcept, ...sameSection].slice(0, limit);
}

function renderQuestionReview(
  item: ReviewQuestionItem,
  renderedQuestion: Question,
  footer: ReactNode
) {
  return (
    <div className="mt-4 space-y-3 leading-7">
      <p>
        <span className="font-semibold">最後錯因：</span>
        {item.history.latestErrorType ?? "未填"}
      </p>
      <div className="grid gap-3">
        {getOptionKeys(item).map((key) => (
          <div key={`${item.question.id}-${key}`} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              {key}. {renderedQuestion.options[key]}
            </p>
          </div>
        ))}
      </div>
      <p>
        <span className="font-semibold">正確答案：</span>
        {renderedQuestion.answerCreditType === "multiple_accepted" &&
        renderedQuestion.acceptedAnswers?.length
          ? renderedQuestion.acceptedAnswers.join(" / ")
          : renderedQuestion.answer}
      </p>
      <p>
        <span className="font-semibold">重點解析：</span>
        {renderedQuestion.explanation}
      </p>
      {renderedQuestion.optionAnalysis ? (
        <div className="grid gap-3">
          {getOptionKeysFromQuestion(renderedQuestion).map((key) => {
            const text = renderedQuestion.optionAnalysis?.[key];
            if (!text) return null;
            return (
              <div key={`${renderedQuestion.id}-analysis-${key}`} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{key} 選項解析</p>
                <p className="mt-1 leading-7 text-slate-700">{text}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      {renderedQuestion.memoryTip ? (
        <p>
          <span className="font-semibold">快速記憶法：</span>
          {renderedQuestion.memoryTip}
        </p>
      ) : null}
      {footer}
    </div>
  );
}

function renderRelatedQuestions(question: Question, allQuestions: Question[]) {
  const relatedQuestions = getRelatedQuestions(question, allQuestions);

  if (relatedQuestions.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        目前還找不到同觀念的類似題。
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {relatedQuestions.map((relatedQuestion, index) => (
        <details key={`${question.id}-related-${relatedQuestion.id}`} className="rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-ink">
            類似題 {index + 1}：{relatedQuestion.chapter} / {relatedQuestion.section}
          </summary>
          <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
            <p>{relatedQuestion.stem}</p>
            <div className="grid gap-3">
              {getOptionKeysFromQuestion(relatedQuestion).map((key) => (
                <div key={`${relatedQuestion.id}-${key}`} className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">
                    {key}. {relatedQuestion.options[key]}
                  </p>
                </div>
              ))}
            </div>
            <p>
              <span className="font-semibold">正確答案：</span>
              {relatedQuestion.answerCreditType === "multiple_accepted" &&
              relatedQuestion.acceptedAnswers?.length
                ? relatedQuestion.acceptedAnswers.join(" / ")
                : relatedQuestion.answer}
            </p>
            <p>
              <span className="font-semibold">詳解：</span>
              {relatedQuestion.explanation}
            </p>
            {relatedQuestion.memoryTip ? (
              <p>
                <span className="font-semibold">快速記憶法：</span>
                {relatedQuestion.memoryTip}
              </p>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

type ReviewNotebookProps = {
  items: ReviewQuestionItem[];
  allQuestions: Question[];
  title?: string;
  description?: string;
  startLabel?: string;
  startHref?: string;
  onStartReview?: () => void;
};

export function ReviewNotebook({
  items,
  allQuestions,
  title = "錯題與低信心題筆記",
  description = "先把錯題和沒信心的題目分開看，每區都依最近作答時間排序。",
  startLabel = "開始錯題複習",
  startHref = "/quiz?new=1",
  onStartReview
}: ReviewNotebookProps) {
  const { session } = useAuth();
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const wrongItems = sortByRecent(items.filter((item) => item.history.wrong > 0));
  const lowConfidenceItems = sortByRecent(items.filter((item) => item.history.lowConfidence > 0));

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, [items]);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (items.length === 0) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(
          items.map((item) => item.question.id)
        );
        if (Object.keys(sharedOverrides).length === 0) return;

        saveQuestionExplanationOverrides(sharedOverrides);
        setExplanationOverrides((current) => ({
          ...current,
          ...sharedOverrides
        }));
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [items]);

  async function handleGenerateQuestionExplanation(question: Question) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 GPT-5-mini 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session?.access_token ?? null,
          question: {
            id: question.id,
            subject: question.subject,
            chapter: question.chapter,
            section: question.section,
            stem: question.stem,
            options: question.options,
            answer: question.answer,
            acceptedAnswers: question.acceptedAnswers,
            answerCreditType: question.answerCreditType,
            explanation: question.explanation,
            testedConcept: question.testedConcept
          },
          attempt: {
            selectedAnswer: question.answer,
            confidence: 3,
            isCorrect: false
          }
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        explanation?: string;
        optionAnalysis?: Partial<Record<OptionKey, string>>;
        memoryTip?: string;
        model?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.explanation) {
        if (response.status === 429 && payload.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setExplanationErrorMap((current) => ({
          ...current,
          [question.id]: payload.message || "GPT-5-mini 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5-mini",
        updatedAt: new Date().toISOString()
      };

      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) => ({
        ...current,
        [question.id]: override
      }));
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 GPT-5-mini 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  function renderExplanationFooter(question: Question) {
    const override = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];

    return (
      <div className="space-y-3">
        {override ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{override.model ?? "gpt-5-mini"}
            </span>
          </div>
        ) : null}
        {!override ? (
          <button
            type="button"
            onClick={() => void handleGenerateQuestionExplanation(question)}
            disabled={loading}
            className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "GPT-5-mini 生成中..." : "用 GPT-5-mini 補詳解"}
          </button>
        ) : null}
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <Link
          href={startHref}
          onClick={onStartReview}
          className="min-h-12 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {startLabel}
        </Link>
      </div>

      <div className="mt-6 grid gap-8">
        {items.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            目前還沒有累積錯題或低信心題，先去刷一輪題目吧。
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">錯題區</h3>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
                  {wrongItems.length} 題
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                {wrongItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    目前沒有累積錯題。
                  </div>
                ) : (
                  wrongItems.map((item, index) => (
                    <article
                      key={`wrong-${item.question.id}`}
                      className="rounded-3xl border border-rose-200 bg-rose-50/60 p-5"
                    >
                      {(() => {
                        const renderedQuestion = applyQuestionExplanationOverride(item.question);
                        return (
                          <>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-900">
                              錯題 {index + 1}
                            </span>
                            <span className="text-sm text-slate-500">
                              {item.question.chapter} / {item.question.section}
                            </span>
                          </div>
                          <h4 className="mt-3 break-words text-lg font-semibold leading-8 text-ink">
                            {item.question.stem}
                          </h4>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                        </div>
                      </div>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          查看題目、選項與詳解
                        </summary>
                        {renderQuestionReview(item, renderedQuestion, renderExplanationFooter(renderedQuestion))}
                      </details>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          看相同觀念類似題
                        </summary>
                        {renderRelatedQuestions(item.question, allQuestions)}
                      </details>
                          </>
                        );
                      })()}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">沒信心題區</h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  {lowConfidenceItems.length} 題
                </span>
              </div>
              <div className="mt-4 grid gap-4">
                {lowConfidenceItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    目前沒有累積低信心題。
                  </div>
                ) : (
                  lowConfidenceItems.map((item, index) => (
                    <article
                      key={`low-${item.question.id}`}
                      className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5"
                    >
                      {(() => {
                        const renderedQuestion = applyQuestionExplanationOverride(item.question);
                        return (
                          <>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                              低信心 {index + 1}
                            </span>
                            <span className="text-sm text-slate-500">
                              {item.question.chapter} / {item.question.section}
                            </span>
                          </div>
                          <h4 className="mt-3 break-words text-lg font-semibold leading-8 text-ink">
                            {item.question.stem}
                          </h4>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                          最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                        </div>
                      </div>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          查看題目、選項與詳解
                        </summary>
                        {renderQuestionReview(item, renderedQuestion, renderExplanationFooter(renderedQuestion))}
                      </details>

                      <details className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer font-semibold text-ink">
                          看相同觀念類似題
                        </summary>
                        {renderRelatedQuestions(item.question, allQuestions)}
                      </details>
                          </>
                        );
                      })()}
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
