"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import {
  MANUAL_REVIEW_STATE_CHANGE_EVENT,
  ReviewNotebook,
  getUnresolvedReviewItems,
  readManualReviewStateForScope,
  useReviewCompletionThreshold,
  type ManualReviewState
} from "@/components/ReviewNotebook";
import { getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot,
  mergeQuestionsWithSessionSnapshots
} from "@/lib/quizAnalysis";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import { QuizSession, QuizSettings, ReviewQuestionItem, SubjectName } from "@/types/quiz";

const CUSTOM_PAPER_REVIEW_SCOPE = "custom-paper-review";
const CUSTOM_PAPER_REVIEW_POOL_LABEL = "自訂卷錯題庫";

function isCustomPaperSourceSession(session: QuizSession) {
  return session.settings?.mode === "custom_paper";
}

function isCustomPaperReviewCompletionSession(session: QuizSession) {
  return (
    session.settings?.mode === "review" &&
    session.settings?.customPoolLabel === CUSTOM_PAPER_REVIEW_POOL_LABEL
  );
}

function loadReviewCompletedSessions() {
  return loadCompletedSessions({ includeFullLocalHistory: true });
}

function buildCustomPaperReviewSettings(items: ReviewQuestionItem[]): QuizSettings {
  const subjectFilters = Array.from(
    new Set(items.map((item) => item.question.subject))
  ) as SubjectName[];

  return {
    ...DEFAULT_QUIZ_SETTINGS,
    mode: "review",
    questionCount: Math.max(1, items.length),
    subjectFilter: subjectFilters.length === 1 ? subjectFilters[0] : "全部",
    subjectFilters,
    strictCustomQuestionPool: true,
    customQuestionIds: items.map((item) => item.question.id),
    customQuestionPayload: items.map((item) => item.question),
    customPoolLabel: CUSTOM_PAPER_REVIEW_POOL_LABEL
  };
}

function buildCustomPaperReviewUrlSettings(items: ReviewQuestionItem[]): QuizSettings {
  return {
    ...buildCustomPaperReviewSettings(items),
    customQuestionPayload: undefined
  };
}

export default function CustomPaperReviewPage() {
  const [customPaperItems, setCustomPaperItems] = useState<ReviewQuestionItem[]>([]);
  const [manualReviewState, setManualReviewState] = useState<ManualReviewState>(() =>
    readManualReviewStateForScope(CUSTOM_PAPER_REVIEW_SCOPE, "guest")
  );
  const { user, syncVersion } = useAuth();
  useCloudHistoryHydration();
  const reviewCompletionThreshold = useReviewCompletionThreshold();
  const allQuestions = getQuestionBankBySubjectFilter("全部");

  useEffect(() => {
    const sessions = loadReviewCompletedSessions();
    const customPaperSourceSessions = sessions.filter(isCustomPaperSourceSession);
    const historySessions = sessions.filter(
      (session) => isCustomPaperSourceSession(session) || isCustomPaperReviewCompletionSession(session)
    );
    const reviewQuestions = mergeQuestionsWithSessionSnapshots(allQuestions, customPaperSourceSessions);
    setCustomPaperItems(getReviewQuestionItems(reviewQuestions, historySessions, Number.MAX_SAFE_INTEGER));
  }, [syncVersion]);

  useEffect(() => {
    const userId = user?.id ?? "guest";
    setManualReviewState(readManualReviewStateForScope(CUSTOM_PAPER_REVIEW_SCOPE, userId));

    if (typeof window === "undefined") return;
    const handleManualReviewStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: string; userId?: string }>).detail;
      if (detail?.scope && detail.scope !== CUSTOM_PAPER_REVIEW_SCOPE) return;
      if (detail?.userId && detail.userId !== userId) return;
      setManualReviewState(readManualReviewStateForScope(CUSTOM_PAPER_REVIEW_SCOPE, userId));
    };

    window.addEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    return () => {
      window.removeEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    };
  }, [user?.id]);

  function handleStartCustomPaperReview(filteredItems: ReviewQuestionItem[] = customPaperItems) {
    saveQuizSettings(buildCustomPaperReviewSettings(filteredItems));
  }

  const getCustomPaperReviewHref = useCallback(
    (items: ReviewQuestionItem[]) => buildNewQuizHref(buildCustomPaperReviewUrlSettings(items)),
    []
  );

  const unresolvedCustomPaperItems = useMemo(
    () => getUnresolvedReviewItems(customPaperItems, manualReviewState, reviewCompletionThreshold),
    [customPaperItems, manualReviewState, reviewCompletionThreshold]
  );
  const snapshot = getReviewSnapshot(unresolvedCustomPaperItems);

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Custom Paper Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">自訂卷錯題與沒信心題</h1>
            <p className="mt-3 text-slate-500">
              這裡只整理自訂卷模式累積下來的錯題與低信心題，不會和其他模式混在一起。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/custom-papers"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回自訂卷模式
            </Link>
            <Link
              href={getCustomPaperReviewHref(unresolvedCustomPaperItems)}
              onClick={(event) => {
                if (unresolvedCustomPaperItems.length === 0) {
                  event.preventDefault();
                  return;
                }
                handleStartCustomPaperReview(unresolvedCustomPaperItems);
              }}
              aria-disabled={unresolvedCustomPaperItems.length === 0}
              className={`min-h-12 rounded-2xl px-5 py-4 text-sm font-semibold transition ${
                unresolvedCustomPaperItems.length === 0
                  ? "pointer-events-none bg-slate-200 text-slate-500"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              開始自訂卷錯題複習
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-rose-50 p-5 text-rose-900">
          <p className="text-sm font-medium">自訂卷錯題庫</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">自訂卷低信心題</p>
          <p className="mt-2 text-3xl font-bold">{snapshot.lowConfidence}</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook
          title="自訂卷錯題庫"
          description="這裡只整理自訂卷模式做出來的錯題與低信心題。"
          startLabel="開始自訂卷錯題複習"
          getStartHref={getCustomPaperReviewHref}
          onStartReview={handleStartCustomPaperReview}
          items={customPaperItems}
          allQuestions={allQuestions}
          manualEditScope={CUSTOM_PAPER_REVIEW_SCOPE}
          completionThreshold={reviewCompletionThreshold}
        />
      </div>
    </main>
  );
}
