"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  loadQuestionCommunityStats,
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
  QuestionCommunityStats,
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
      <div className="space-y-2.5">
        {getOptionKeys(item).map((key) => (
          <div
            key={`${item.question.id}-${key}`}
            className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {key}
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-800 sm:text-[15px] sm:leading-7">
                {renderedQuestion.options[key]}
              </p>
            </div>
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
        <div className="space-y-2.5">
          {getOptionKeysFromQuestion(renderedQuestion).map((key) => {
            const text = renderedQuestion.optionAnalysis?.[key];
            if (!text) return null;
            return (
              <div
                key={`${renderedQuestion.id}-analysis-${key}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {key}
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">
                    {text}
                  </p>
                </div>
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
            <div className="space-y-2.5">
              {getOptionKeysFromQuestion(relatedQuestion).map((key) => (
                <div
                  key={`${relatedQuestion.id}-${key}`}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex min-w-8 justify-center rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {key}
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-800 sm:text-[15px] sm:leading-7">
                      {relatedQuestion.options[key]}
                    </p>
                  </div>
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [communityStatsMap, setCommunityStatsMap] = useState<Record<string, QuestionCommunityStats>>({});
  const [activeCategory, setActiveCategory] = useState<"wrong" | "lowConfidence">("wrong");
  const [isSpotlighted, setIsSpotlighted] = useState(false);
  const wrongItems = sortByRecent(items.filter((item) => item.history.wrong > 0));
  const lowConfidenceItems = sortByRecent(items.filter((item) => item.history.lowConfidence > 0));
  const activeItems = activeCategory === "wrong" ? wrongItems : lowConfidenceItems;

  useEffect(() => {
    if (activeCategory === "wrong" && wrongItems.length === 0 && lowConfidenceItems.length > 0) {
      setActiveCategory("lowConfidence");
      return;
    }

    if (activeCategory === "lowConfidence" && lowConfidenceItems.length === 0 && wrongItems.length > 0) {
      setActiveCategory("wrong");
    }
  }, [activeCategory, lowConfidenceItems.length, wrongItems.length]);

  useEffect(() => {
    async function fetchCommunityStats() {
      if (items.length === 0) return;

      try {
        const stats = await loadQuestionCommunityStats(items.map((item) => item.question.id));
        setCommunityStatsMap(
          Object.fromEntries(stats.map((item) => [item.questionId, item] as const))
        );
      } catch {
        // keep review UI usable without stats
      }
    }

    void fetchCommunityStats();

    function handleFocusSync() {
      void fetchCommunityStats();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocusSync);
      document.addEventListener("visibilitychange", handleFocusSync);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocusSync);
        document.removeEventListener("visibilitychange", handleFocusSync);
      }
    };
  }, [items]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current) return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    if (!mediaQuery.matches) {
      setIsSpotlighted(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSpotlighted(entry.isIntersecting && entry.intersectionRatio >= 0.35);
      },
      {
        threshold: [0.2, 0.35, 0.5],
        rootMargin: "-4% 0px -8% 0px"
      }
    );

    observer.observe(sectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

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

    function handleFocusSync() {
      void fetchSharedExplanationOverrides();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocusSync);
      document.addEventListener("visibilitychange", handleFocusSync);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocusSync);
        document.removeEventListener("visibilitychange", handleFocusSync);
      }
    };
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
    const communityStats = communityStatsMap[question.id];

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {override ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{override.model ?? "gpt-5-mini"}
            </span>
          ) : null}
          {communityStats && communityStats.totalAttempts > 0 ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
              全站答對率 {communityStats.correctRate}% ・ {communityStats.totalAttempts} 人作答
            </span>
          ) : null}
        </div>
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
    <section
      ref={sectionRef}
      className={`rounded-[2rem] bg-white p-4 ring-1 ring-slate-100 transition-all duration-500 ease-out motion-reduce:transition-none sm:p-6 ${
        isSpotlighted
          ? "-mx-5 -translate-y-1 scale-[1.035] bg-white shadow-[0_30px_80px_rgba(15,42,34,0.2)] ring-slate-200"
          : "translate-y-0 scale-[0.97] shadow-card"
      } sm:mx-0 sm:scale-100`}
    >
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
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveCategory("wrong")}
                className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeCategory === "wrong"
                    ? "bg-rose-100 text-rose-900 ring-1 ring-rose-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                錯題
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {wrongItems.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("lowConfidence")}
                className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeCategory === "lowConfidence"
                    ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                沒信心題
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {lowConfidenceItems.length}
                </span>
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">
                  {activeCategory === "wrong" ? "錯題區" : "沒信心題區"}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeCategory === "wrong"
                      ? "bg-rose-100 text-rose-900"
                      : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {activeItems.length} 題
                </span>
              </div>
                <div className="mt-4 grid gap-3 sm:gap-4">
                {activeItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    {activeCategory === "wrong" ? "目前沒有累積錯題。" : "目前沒有累積低信心題。"}
                  </div>
                ) : (
                  activeItems.map((item, index) => (
                    <article
                      key={`${activeCategory}-${item.question.id}`}
                      className={`rounded-3xl border p-5 ${
                        activeCategory === "wrong"
                          ? "border-rose-200 bg-rose-50/60"
                          : "border-amber-200 bg-amber-50/70"
                      }`}
                    >
                      {(() => {
                        const renderedQuestion = applyQuestionExplanationOverride(item.question);
                        return (
                          <>
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                      activeCategory === "wrong"
                                        ? "bg-rose-100 text-rose-900"
                                        : "bg-amber-100 text-amber-900"
                                    }`}
                                  >
                                    {activeCategory === "wrong" ? `錯題 ${index + 1}` : `沒信心 ${index + 1}`}
                                  </span>
                                  <span className="text-sm text-slate-500">
                                    {item.question.chapter} / {item.question.section}
                                  </span>
                                </div>
                                <h4 className="break-words text-base font-semibold leading-7 text-ink sm:text-lg sm:leading-8">
                                  {item.question.stem}
                                </h4>
                                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                  最近作答 <span className="font-semibold">{formatTime(item.history.lastAttemptedAt)}</span>
                                </div>
                              </div>

                              <details className="rounded-2xl bg-white p-3.5 text-sm text-slate-700 sm:p-4">
                                <summary className="cursor-pointer font-semibold text-ink">
                                  查看題目、選項與詳解
                                </summary>
                                {renderQuestionReview(item, renderedQuestion, renderExplanationFooter(renderedQuestion))}
                              </details>

                              <details className="rounded-2xl bg-white p-3.5 text-sm text-slate-700 sm:p-4">
                                <summary className="cursor-pointer font-semibold text-ink">
                                  看相同觀念類似題
                                </summary>
                                {renderRelatedQuestions(item.question, allQuestions)}
                              </details>
                            </div>
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
