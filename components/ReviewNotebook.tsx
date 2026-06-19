"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionIssueReportButton } from "@/components/QuestionIssueReportButton";
import { YangmingExplanationPanel } from "@/components/YangmingExplanationPanel";
import {
  loadConfirmedQuestionClassificationOverrides,
  loadQuestionCommunityStats,
  loadSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import { applyQuestionClassificationOverride } from "@/data/med1QuestionBank";
import {
  applyQuestionExplanationOverride,
  loadQuestionExplanationOverrides,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides
} from "@/lib/storage";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { useAuth } from "@/components/AuthProvider";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionCommunityStats,
  QuestionExplanationOverride,
  ReviewQuestionItem,
  SubjectName
} from "@/types/quiz";

type RenderedReviewQuestionItem = ReviewQuestionItem & {
  renderedQuestion: Question;
};

type RelatedQuestionIndex = {
  byConcept: Map<string, Question[]>;
  bySection: Map<string, Question[]>;
};

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sortByRecent<T extends ReviewQuestionItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const timeA = a.history.lastAttemptedAt ? new Date(a.history.lastAttemptedAt).getTime() : 0;
    const timeB = b.history.lastAttemptedAt ? new Date(b.history.lastAttemptedAt).getTime() : 0;
    return timeB - timeA || b.riskScore - a.riskScore || b.history.wrong - a.history.wrong;
  });
}

function isResolvedReviewItem(item: ReviewQuestionItem) {
  return (
    (item.history.wrong > 0 || item.history.lowConfidence > 0) &&
    item.history.correct >= 2 &&
    item.history.lastAttemptCorrect === true
  );
}

function applyLocalExplanationOverride(
  question: Question,
  override?: QuestionExplanationOverride
) {
  if (!override) return question;
  return {
    ...question,
    explanation: override.explanation || question.explanation,
    optionAnalysis:
      override.optionAnalysis && Object.keys(override.optionAnalysis).length > 0
        ? { ...question.optionAnalysis, ...override.optionAnalysis }
        : question.optionAnalysis,
    memoryTip: override.memoryTip || question.memoryTip
  };
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

function normalizeRelatedConcept(question: Question) {
  return question.testedConcept.trim().toLowerCase();
}

function getSectionKey(question: Question) {
  return `${question.chapter}__${question.section}`;
}

function buildRelatedQuestionIndex(allQuestions: Question[]): RelatedQuestionIndex {
  const byConcept = new Map<string, Question[]>();
  const bySection = new Map<string, Question[]>();

  for (const question of allQuestions) {
    const conceptKey = normalizeRelatedConcept(question);
    const conceptQuestions = byConcept.get(conceptKey);
    if (conceptQuestions) {
      conceptQuestions.push(question);
    } else {
      byConcept.set(conceptKey, [question]);
    }

    const sectionKey = getSectionKey(question);
    const sectionQuestions = bySection.get(sectionKey);
    if (sectionQuestions) {
      sectionQuestions.push(question);
    } else {
      bySection.set(sectionKey, [question]);
    }
  }

  return { byConcept, bySection };
}

function getRelatedQuestions(currentQuestion: Question, index: RelatedQuestionIndex, limit = 4) {
  const normalizedConcept = normalizeRelatedConcept(currentQuestion);

  const sameConcept = (index.byConcept.get(normalizedConcept) ?? []).filter(
    (question) => question.id !== currentQuestion.id
  );

  const sameSection = (index.bySection.get(getSectionKey(currentQuestion)) ?? []).filter(
    (question) =>
      question.id !== currentQuestion.id &&
      normalizeRelatedConcept(question) !== normalizedConcept
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
      <QuestionStemBlock question={renderedQuestion} />
      <p>
        <span className="font-semibold">最後錯因：</span>
        {item.history.latestErrorType ?? "未填"}
      </p>
      <div className="space-y-2.5">
        {getOptionKeys(item).map((key) => (
          <QuestionOptionBlock
            key={`${item.question.id}-${key}`}
            question={renderedQuestion}
            optionKey={key}
            wrapperClassName="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
          />
        ))}
      </div>
      <p>
        <span className="font-semibold">正確答案：</span>
        {(renderedQuestion.answerCreditType === "multiple_accepted" ||
          renderedQuestion.answerCreditType === "multiple_answers") &&
        renderedQuestion.acceptedAnswers?.length
          ? `${renderedQuestion.acceptedAnswers.join("/")} 皆可`
          : renderedQuestion.answerCreditType === "all_credit"
            ? "本題一律給分"
            : renderedQuestion.answer}
      </p>
      <p>
        <span className="font-semibold">重點解析：</span>
        {renderedQuestion.explanation}
      </p>
      <YangmingExplanationPanel questionId={renderedQuestion.id} compact className="mt-3" />
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
        <div className="memory-tip-box">
          <span className="font-semibold">快速記憶法：</span>
          {renderedQuestion.memoryTip}
        </div>
      ) : null}
      {footer}
    </div>
  );
}

function renderRelatedQuestions(question: Question, relatedQuestionIndex: RelatedQuestionIndex) {
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
      {relatedQuestions.map((relatedQuestion, index) => (
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
              {(relatedQuestion.answerCreditType === "multiple_accepted" ||
                relatedQuestion.answerCreditType === "multiple_answers") &&
              relatedQuestion.acceptedAnswers?.length
                ? `${relatedQuestion.acceptedAnswers.join("/")} 皆可`
                : relatedQuestion.answerCreditType === "all_credit"
                  ? "本題一律給分"
                  : relatedQuestion.answer}
            </p>
            <p>
              <span className="font-semibold">詳解：</span>
              {relatedQuestion.explanation}
            </p>
            <YangmingExplanationPanel questionId={relatedQuestion.id} compact className="mt-3" />
            {relatedQuestion.memoryTip ? (
              <div className="memory-tip-box">
                <span className="font-semibold">快速記憶法：</span>
                {relatedQuestion.memoryTip}
              </div>
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
  onStartReview?: (items: ReviewQuestionItem[]) => void;
  fullscreenMobile?: boolean;
  headerAction?: ReactNode;
};

export function ReviewNotebook({
  items,
  allQuestions,
  title = "錯題與低信心題筆記",
  description = "先把錯題和沒信心的題目分開看，每區都依最近作答時間排序。",
  startLabel = "開始錯題複習",
  startHref = "/quiz?new=1",
  onStartReview,
  fullscreenMobile = false,
  headerAction
}: ReviewNotebookProps) {
  const { session } = useAuth();
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [communityStatsMap, setCommunityStatsMap] = useState<Record<string, QuestionCommunityStats>>({});
  const [openQuestionIds, setOpenQuestionIds] = useState<Set<string>>(() => new Set());
  const [openRelatedQuestionIds, setOpenRelatedQuestionIds] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<"wrong" | "lowConfidence" | "resolved">("wrong");
  const [visibleCount, setVisibleCount] = useState(40);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const questionIdsKey = useMemo(
    () => items.map((item) => item.question.id).join("|"),
    [items]
  );
  const renderedAllQuestions = useMemo(
    () =>
      allQuestions.map((question) =>
        applyQuestionClassificationOverride(question, classificationOverrides[question.id])
      ),
    [allQuestions, classificationOverrides]
  );
  const renderedItems = useMemo<RenderedReviewQuestionItem[]>(
    () =>
      items.map((item) => ({
        ...item,
        renderedQuestion: applyQuestionClassificationOverride(
          item.question,
          classificationOverrides[item.question.id]
        )
      })),
    [items, classificationOverrides]
  );
  const relatedQuestionIndex = useMemo(
    () => buildRelatedQuestionIndex(renderedAllQuestions),
    [renderedAllQuestions]
  );
  const availableSubjects = useMemo(
    () =>
      Array.from(new Set(renderedItems.map((item) => item.renderedQuestion.subject))).sort((a, b) =>
        a.localeCompare(b, "zh-Hant")
      ) as SubjectName[],
    [renderedItems]
  );
  const filteredItems = useMemo(
    () =>
      selectedSubjects.length === 0
        ? renderedItems
        : renderedItems.filter((item) => selectedSubjects.includes(item.renderedQuestion.subject)),
    [renderedItems, selectedSubjects]
  );
  const unresolvedItems = useMemo(
    () => filteredItems.filter((item) => !isResolvedReviewItem(item)),
    [filteredItems]
  );
  const resolvedItems = useMemo(
    () => sortByRecent(filteredItems.filter((item) => isResolvedReviewItem(item))),
    [filteredItems]
  );
  const wrongItems = useMemo(
    () => sortByRecent(unresolvedItems.filter((item) => item.history.wrong > 0)),
    [unresolvedItems]
  );
  const lowConfidenceItems = useMemo(
    () => sortByRecent(unresolvedItems.filter((item) => item.history.lowConfidence > 0)),
    [unresolvedItems]
  );
  const activeItems = useMemo(
    () =>
      activeCategory === "wrong"
        ? wrongItems
        : activeCategory === "lowConfidence"
          ? lowConfidenceItems
          : resolvedItems,
    [activeCategory, lowConfidenceItems, resolvedItems, wrongItems]
  );
  const visibleItems = useMemo(
    () => activeItems.slice(0, visibleCount),
    [activeItems, visibleCount]
  );
  const visibleQuestionIds = useMemo(
    () => visibleItems.map((item) => item.question.id),
    [visibleItems]
  );
  const visibleQuestionIdsKey = useMemo(() => visibleQuestionIds.join("|"), [visibleQuestionIds]);

  useEffect(() => {
    if (activeCategory === "resolved" && resolvedItems.length === 0) {
      if (wrongItems.length > 0) {
        setActiveCategory("wrong");
        return;
      }

      if (lowConfidenceItems.length > 0) {
        setActiveCategory("lowConfidence");
        return;
      }
    }

    if (activeCategory === "wrong" && wrongItems.length === 0 && lowConfidenceItems.length > 0) {
      setActiveCategory("lowConfidence");
      return;
    }

    if (activeCategory === "lowConfidence" && lowConfidenceItems.length === 0 && wrongItems.length > 0) {
      setActiveCategory("wrong");
      return;
    }

    if (
      activeCategory !== "resolved" &&
      wrongItems.length === 0 &&
      lowConfidenceItems.length === 0 &&
      resolvedItems.length > 0
    ) {
      setActiveCategory("resolved");
    }
  }, [activeCategory, lowConfidenceItems.length, resolvedItems.length, wrongItems.length]);

  useEffect(() => {
    setVisibleCount(40);
  }, [activeCategory, questionIdsKey, selectedSubjects]);

  useEffect(() => {
    setSelectedSubjects((current) => current.filter((subject) => availableSubjects.includes(subject)));
  }, [availableSubjects]);

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function clearSubjectFilter() {
    setSelectedSubjects([]);
  }

  function setQuestionDetailsOpen(questionId: string, isOpen: boolean) {
    setOpenQuestionIds((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  }

  function setRelatedDetailsOpen(questionId: string, isOpen: boolean) {
    setOpenRelatedQuestionIds((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.add(questionId);
      } else {
        next.delete(questionId);
      }
      return next;
    });
  }

  useEffect(() => {
    async function fetchCommunityStats() {
      if (visibleQuestionIds.length === 0) return;

      const missingQuestionIds = visibleQuestionIds.filter((id) => !communityStatsMap[id]);
      if (missingQuestionIds.length === 0) return;

      try {
        const stats = await loadQuestionCommunityStats(missingQuestionIds);
        setCommunityStatsMap((current) => ({
          ...current,
          ...Object.fromEntries(stats.map((item) => [item.questionId, item] as const))
        }));
      } catch {
        // keep review UI usable without stats
      }
    }

    void fetchCommunityStats();
  }, [visibleQuestionIdsKey]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, [items, questionIdsKey]);

  useEffect(() => {
    if (items.length === 0) return;

    void loadConfirmedQuestionClassificationOverrides(items.map((item) => item.question.id))
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [items, questionIdsKey]);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (visibleQuestionIds.length === 0) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(visibleQuestionIds);
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
  }, [visibleQuestionIdsKey]);

  async function handleGenerateQuestionExplanation(
    question: Question,
    previousOverride?: QuestionExplanationOverride
  ) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 GPT-5.4-mini 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const previousQuestion = findPreviousQuestionForContinuation(question, allQuestions);

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
          previousQuestion: previousQuestion ? buildRelatedQuestionContext(previousQuestion) : undefined,
          previousOverride,
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
          [question.id]: payload.message || "GPT-5.4-mini 詳解產生失敗。"
        }));
        return;
      }

      const override: QuestionExplanationOverride = {
        explanation: payload.explanation ?? "",
        optionAnalysis: payload.optionAnalysis ?? {},
        memoryTip: payload.memoryTip ?? "",
        model: payload.model ?? "gpt-5.4-mini",
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
        [question.id]: "無法連線到 GPT-5.4-mini 詳解 API。"
      }));
    } finally {
      setExplanationLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  async function handleReportClassification(question: Question) {
    if (!session?.access_token) {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能回報此題分類錯誤。"
      }));
      return;
    }
    setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: true }));
    setClassificationReportMessageMap((current) => ({ ...current, [question.id]: "" }));

    try {
      const response = await fetch("/api/question-classification-report", {
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
            explanation: question.explanation,
            testedConcept: question.testedConcept
          }
        })
      });

      const rawText = await response.text();
      const payload = (rawText ? JSON.parse(rawText) : null) as {
        ok: boolean;
        suggestedSubject?: string | null;
        suggestedChapter?: string | null;
        suggestedSection?: string | null;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        if (response.status === 429 && payload?.message && typeof window !== "undefined") {
          window.alert(payload.message);
        }
        setClassificationReportMessageMap((current) => ({
          ...current,
          [question.id]: payload?.message || rawText || "分類回報失敗。"
        }));
        return;
      }

      const suggestedPath = [
        payload.suggestedSubject,
        payload.suggestedChapter,
        payload.suggestedSection
      ].filter(Boolean).join(" / ");

      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]:
          payload.message ||
          (suggestedPath
            ? `已回報並自動套用到 ${suggestedPath}。`
            : "已回報並依 AI 建議自動套用分類。")
      }));
    } catch {
      setClassificationReportMessageMap((current) => ({
        ...current,
        [question.id]: "無法連線到分類回報 API。"
      }));
    } finally {
      setClassificationReportLoadingMap((current) => ({ ...current, [question.id]: false }));
    }
  }

  function renderExplanationFooter(question: Question) {
    const override = explanationOverrides[question.id];
    const loading = explanationLoadingMap[question.id];
    const error = explanationErrorMap[question.id];
    const reportLoading = classificationReportLoadingMap[question.id];
    const reportMessage = classificationReportMessageMap[question.id];
    const communityStats = communityStatsMap[question.id];

    return (
      <div className="space-y-3">
        <CopyQuestionPromptButton
          question={question}
          correctAnswer={question.answer}
        />
        <div className="flex flex-wrap items-center gap-2">
          {override ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              已替換詳解・{override.model ?? "gpt-5.4-mini"}
            </span>
          ) : null}
          {communityStats && communityStats.totalAttempts > 0 ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
              全站答對率 {communityStats.correctRate}% ・ {communityStats.totalAttempts} 人作答
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!override ? (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "GPT-5.4-mini 生成中..." : "用 GPT-5.4-mini 補詳解"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleGenerateQuestionExplanation(question, override)}
              disabled={loading}
              className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "重新生成中..." : "重新替換詳解"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleReportClassification(question)}
            disabled={reportLoading}
            className="min-h-10 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
          >
            {reportLoading ? "回報中..." : "回報此題分類錯誤"}
          </button>
          <QuestionIssueReportButton question={question} disabled={reportLoading} />
        </div>
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
        {reportMessage ? <p className="text-sm font-medium text-slate-600">{reportMessage}</p> : null}
      </div>
    );
  }

  return (
    <section
      className={
        fullscreenMobile
          ? "bg-transparent p-0 shadow-none ring-0"
          : "rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${fullscreenMobile ? "text-xl" : "text-2xl"} font-semibold text-ink`}>{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {headerAction}
          <Link
            href={startHref}
            onClick={(event) => {
              if (unresolvedItems.length === 0) {
                event.preventDefault();
                return;
              }
              onStartReview?.(unresolvedItems);
            }}
            aria-disabled={unresolvedItems.length === 0}
            className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              unresolvedItems.length === 0
                ? "pointer-events-none bg-slate-200 text-slate-500"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {startLabel}
          </Link>
        </div>
      </div>

      <div className={`${fullscreenMobile ? "mt-4" : "mt-6"} grid gap-8`}>
        {items.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
            目前還沒有累積錯題或低信心題，先去刷一輪題目吧。
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">科目篩選</span>
                <button
                  type="button"
                  onClick={clearSubjectFilter}
                  className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    selectedSubjects.length === 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  全部
                </button>
                {availableSubjects.map((subject) => {
                  const active = selectedSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${
                        active
                          ? "bg-brand-100 text-brand-900 ring-1 ring-brand-300"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {subject}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                {selectedSubjects.length === 0
                  ? "目前顯示全部科目的錯題與低信心題。"
                  : `目前只顯示 ${selectedSubjects.join("、")}。`}
              </p>
            </div>
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
              <button
                type="button"
                onClick={() => setActiveCategory("resolved")}
                className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeCategory === "resolved"
                    ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                已解決
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">
                  {resolvedItems.length}
                </span>
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-ink">
                  {activeCategory === "wrong"
                    ? "錯題區"
                    : activeCategory === "lowConfidence"
                      ? "沒信心題區"
                      : "已解決錯題"}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeCategory === "wrong"
                      ? "bg-rose-100 text-rose-900"
                      : activeCategory === "lowConfidence"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {activeItems.length} 題
                </span>
              </div>
                <div className="mt-4 grid gap-3 sm:gap-4">
                {activeItems.length === 0 ? (
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                    {activeCategory === "wrong"
                      ? "目前沒有符合篩選條件的錯題。"
                      : activeCategory === "lowConfidence"
                        ? "目前沒有符合篩選條件的低信心題。"
                        : "目前還沒有答對兩次以上的已解決錯題。"}
                  </div>
                ) : (
                  visibleItems.map((item, index) => (
                    <article
                      key={`${activeCategory}-${item.question.id}`}
                      className={`rounded-3xl border p-5 ${
                        activeCategory === "wrong"
                          ? "border-rose-200 bg-rose-50/60"
                          : activeCategory === "lowConfidence"
                            ? "border-amber-200 bg-amber-50/70"
                            : "border-emerald-200 bg-emerald-50/70"
                      }`}
                    >
                      {(() => {
                        const renderedQuestion = applyLocalExplanationOverride(
                          applyQuestionExplanationOverride(item.renderedQuestion),
                          explanationOverrides[item.question.id]
                        );
                        const isQuestionOpen = openQuestionIds.has(item.question.id);
                        const isRelatedOpen = openRelatedQuestionIds.has(item.question.id);
                        return (
                          <>
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        activeCategory === "wrong"
                                          ? "bg-rose-100 text-rose-900"
                                          : activeCategory === "lowConfidence"
                                            ? "bg-amber-100 text-amber-900"
                                            : "bg-emerald-100 text-emerald-900"
                                      }`}
                                    >
                                      {activeCategory === "wrong"
                                        ? `錯題 ${index + 1}`
                                        : activeCategory === "lowConfidence"
                                          ? `沒信心 ${index + 1}`
                                          : `已解決 ${index + 1}`}
                                    </span>
                                    <span className="min-w-0 text-sm text-slate-500">
                                      {renderedQuestion.chapter} / {renderedQuestion.section}
                                    </span>
                                  </div>
                                  <span className="shrink-0 pt-0.5 text-[11px] font-medium text-slate-400 sm:text-xs">
                                    最近作答 {formatTime(item.history.lastAttemptedAt)}
                                  </span>
                                </div>
                                <h4 className="break-words text-base font-semibold leading-7 text-ink sm:text-lg sm:leading-8">
                                  {renderedQuestion.stem}
                                </h4>
                              </div>

                              <details
                                open={isQuestionOpen}
                                onToggle={(event) =>
                                  setQuestionDetailsOpen(item.question.id, event.currentTarget.open)
                                }
                                className="rounded-2xl bg-white p-3.5 text-sm text-slate-700 sm:p-4"
                              >
                                <summary className="cursor-pointer font-semibold text-ink">
                                  查看題目、選項與詳解
                                </summary>
                                {isQuestionOpen
                                  ? renderQuestionReview(
                                      item,
                                      renderedQuestion,
                                      renderExplanationFooter(renderedQuestion)
                                    )
                                  : null}
                              </details>

                              <details
                                open={isRelatedOpen}
                                onToggle={(event) =>
                                  setRelatedDetailsOpen(item.question.id, event.currentTarget.open)
                                }
                                className="rounded-2xl bg-white p-3.5 text-sm text-slate-700 sm:p-4"
                              >
                                <summary className="cursor-pointer font-semibold text-ink">
                                  看相同觀念類似題
                                </summary>
                                {isRelatedOpen
                                  ? renderRelatedQuestions(renderedQuestion, relatedQuestionIndex)
                                  : null}
                              </details>
                            </div>
                          </>
                        );
                      })()}
                    </article>
                  ))
                )}
              </div>
              {activeItems.length > visibleItems.length ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + 40)}
                    className="min-h-11 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                  >
                    再顯示 40 題
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
