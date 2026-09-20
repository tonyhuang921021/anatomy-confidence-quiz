"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WrongQuestionPdfExport } from "@/components/WrongQuestionPdfExport";
import { ReviewYearRangeFilter } from "@/components/ReviewYearRangeFilter";
import {
  DEFAULT_REVIEW_YEAR_RANGE,
  filterReviewItemsByYear,
  normalizeReviewYearRange,
  type ReviewYearRange
} from "@/lib/reviewYearFilter";
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

function isCustomPaperHistorySession(session: QuizSession) {
  return isCustomPaperSourceSession(session) || isCustomPaperReviewCompletionSession(session);
}

function buildCustomPaperReviewSettings(items: ReviewQuestionItem[], yearRange: ReviewYearRange): QuizSettings {
  const subjectFilters = Array.from(
    new Set(items.map((item) => item.question.subject))
  ) as SubjectName[];

  return {
    ...DEFAULT_QUIZ_SETTINGS,
    mode: "review",
    ...normalizeReviewYearRange(yearRange),
    questionCount: Math.max(1, items.length),
    subjectFilter: subjectFilters.length === 1 ? subjectFilters[0] : "全部",
    subjectFilters,
    strictCustomQuestionPool: true,
    customQuestionIds: items.map((item) => item.question.id),
    customQuestionPayload: items.map((item) => item.question),
    customPoolLabel: CUSTOM_PAPER_REVIEW_POOL_LABEL
  };
}

function buildCustomPaperReviewUrlSettings(items: ReviewQuestionItem[], yearRange: ReviewYearRange): QuizSettings {
  return {
    ...buildCustomPaperReviewSettings(items, yearRange),
    customQuestionPayload: undefined
  };
}

export default function CustomPaperReviewPage() {
  const [customPaperItems, setCustomPaperItems] = useState<ReviewQuestionItem[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [reviewYearRange, setReviewYearRange] = useState<ReviewYearRange>(() => ({ ...DEFAULT_REVIEW_YEAR_RANGE }));
  const [localHistoryVersion, setLocalHistoryVersion] = useState(0);
  const [manualReviewState, setManualReviewState] = useState<ManualReviewState>(() =>
    readManualReviewStateForScope(CUSTOM_PAPER_REVIEW_SCOPE, "guest")
  );
  const { user, syncVersion } = useAuth();
  useCloudHistoryHydration();
  const reviewCompletionThreshold = useReviewCompletionThreshold();
  const allQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);

  useEffect(() => {
    const sessions = loadReviewCompletedSessions();
    const customPaperSourceSessions = sessions.filter(isCustomPaperSourceSession);
    const historySessions = sessions.filter(isCustomPaperHistorySession);
    const reviewQuestions = mergeQuestionsWithSessionSnapshots(allQuestions, customPaperSourceSessions);
    setCustomPaperItems(getReviewQuestionItems(reviewQuestions, historySessions, Number.MAX_SAFE_INTEGER));
  }, [allQuestions, syncVersion, localHistoryVersion, user?.id]);

  useEffect(() => {
    const refresh = () => setLocalHistoryVersion((version) => version + 1);
    window.addEventListener("completed-sessions-change", refresh);
    window.addEventListener("completed-question-history-change", refresh);
    return () => {
      window.removeEventListener("completed-sessions-change", refresh);
      window.removeEventListener("completed-question-history-change", refresh);
    };
  }, []);

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
    saveQuizSettings(buildCustomPaperReviewSettings(filteredItems, reviewYearRange));
  }

  const getCustomPaperReviewHref = useCallback(
    (items: ReviewQuestionItem[]) => buildNewQuizHref(buildCustomPaperReviewUrlSettings(items, reviewYearRange)),
    [reviewYearRange]
  );

  const allUnresolvedCustomPaperItems = useMemo(
    () => getUnresolvedReviewItems(customPaperItems, manualReviewState, reviewCompletionThreshold),
    [customPaperItems, manualReviewState, reviewCompletionThreshold]
  );
  const yearFilteredCustomPaperItems = useMemo(
    () => filterReviewItemsByYear(customPaperItems, reviewYearRange),
    [customPaperItems, reviewYearRange]
  );
  const unresolvedCustomPaperItems = useMemo(
    () => getUnresolvedReviewItems(yearFilteredCustomPaperItems, manualReviewState, reviewCompletionThreshold),
    [yearFilteredCustomPaperItems, manualReviewState, reviewCompletionThreshold]
  );
  const snapshot = getReviewSnapshot(unresolvedCustomPaperItems);

  const pdfHistoryScope = useMemo(() => ({
    label: "自訂卷歷次錯題",
    includesSession: isCustomPaperHistorySession,
    yearRange: reviewYearRange,
    subjects: selectedSubjects
  }), [reviewYearRange, selectedSubjects]);

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel workspace-page-header p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="workspace-page-kicker">自訂卷複習</p>
            <h1 className="workspace-page-title">自訂卷錯題與沒信心題</h1>
            <p className="mt-2 text-sm text-slate-500">自訂卷題池獨立整理，不與其他模式混用。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <WrongQuestionPdfExport questions={allQuestions} historyScope={pdfHistoryScope} />
            <Link
              href="/custom-papers"
              className="min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回自訂卷模式
            </Link>
          </div>
        </div>
      </section>

      <ReviewYearRangeFilter
        idPrefix="custom-paper-review"
        value={reviewYearRange}
        onChange={setReviewYearRange}
        filteredCount={unresolvedCustomPaperItems.length}
        totalCount={allUnresolvedCustomPaperItems.length}
        poolLabel="自訂卷待複習題庫"
        startAction={
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
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              unresolvedCustomPaperItems.length === 0
                ? "pointer-events-none bg-slate-200 text-slate-500"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            複習全部科目 · {unresolvedCustomPaperItems.length} 題
          </Link>
        }
      />

      <section className="saved-summary-strip mt-5" aria-label="自訂卷待複習摘要">
        <article className="saved-summary-item">
          <p className="text-xs font-semibold text-slate-500">待複習</p>
          <p className="mt-1 text-xl font-semibold text-ink">{snapshot.total} 題</p>
        </article>
        <article className="saved-summary-item">
          <p className="text-xs font-semibold text-slate-500">低信心</p>
          <p className="mt-1 text-xl font-semibold text-ink">{snapshot.lowConfidence} 題</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook
          title="自訂卷錯題庫"
          description="這裡只整理自訂卷模式做出來的錯題與低信心題。"
          startLabel={selectedSubjects.length ? "複習所選科目" : "複習全部科目"}
          selectedSubjects={selectedSubjects}
          onSelectedSubjectsChange={setSelectedSubjects}
          getStartHref={getCustomPaperReviewHref}
          onStartReview={handleStartCustomPaperReview}
          items={yearFilteredCustomPaperItems}
          allQuestions={allQuestions}
          manualEditScope={CUSTOM_PAPER_REVIEW_SCOPE}
          completionThreshold={reviewCompletionThreshold}
          emptyMessage="這個年份區間目前沒有自訂卷待複習題，可以調整上方年份。"
        />
      </div>
    </main>
  );
}
