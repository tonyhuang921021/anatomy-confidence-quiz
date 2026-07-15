"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ReviewYearRangeFilter } from "@/components/ReviewYearRangeFilter";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import {
  MANUAL_REVIEW_STATE_CHANGE_EVENT,
  ReviewNotebook,
  getUnresolvedReviewItems,
  readManualReviewStateForScope,
  useReviewCompletionThreshold,
  type ManualReviewState
} from "@/components/ReviewNotebook";
import { applyQuestionClassificationOverride, getQuestionBankBySubjectFilter } from "@/data/med1QuestionBank";
import { loadConfirmedQuestionClassificationOverrides } from "@/lib/cloudSync";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import {
  DEFAULT_REVIEW_YEAR_RANGE,
  filterReviewItemsByYear,
  normalizeReviewYearRange,
  type ReviewYearRange
} from "@/lib/reviewYearFilter";
import {
  buildLatestReviewAttemptMap,
  orderReviewItemsForNextRound
} from "@/lib/reviewQuestionOrder";
import {
  DEFAULT_QUIZ_SETTINGS,
  getReviewQuestionItems,
  getReviewSnapshot,
  mergeQuestionsWithSessionSnapshots
} from "@/lib/quizAnalysis";
import { loadCompletedSessions, saveQuizSettings } from "@/lib/storage";
import {
  QuestionClassificationOverride,
  QuizSession,
  QuizSettings,
  ReviewQuestionItem,
  SubjectName
} from "@/types/quiz";

const SIMULATION_REVIEW_SCOPE = "simulation-review";
const SIMULATION_REVIEW_POOL_LABEL = "模擬考錯題庫";
const SIMULATION_LIKE_MIN_QUESTION_COUNT = 60;

function getSessionQuestionFootprint(session: QuizSession) {
  return Math.max(
    session.questionOrder?.length ?? 0,
    session.generatedQuestions?.length ?? 0,
    session.attempts.length
  );
}

function getSessionPaperKeys(session: QuizSession) {
  const paperKeys = new Set<string>();

  for (const question of session.generatedQuestions ?? []) {
    if (question.examCode && question.paperCode) {
      paperKeys.add(`${question.examCode}-${question.paperCode}`);
    }
  }

  for (const questionId of [
    ...(session.questionOrder ?? []),
    ...session.attempts.map((attempt) => attempt.questionId)
  ]) {
    const moexMatch = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
    if (moexMatch) paperKeys.add(`${moexMatch[1]}-${moexMatch[2]}`);

    const aiMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiMatch) paperKeys.add(aiMatch[1]);
  }

  return paperKeys;
}

function isSimulationSourceSession(session: QuizSession) {
  const settings = session.settings;
  const mode = settings?.mode as string | undefined;

  if (
    settings?.customPoolLabel === SIMULATION_REVIEW_POOL_LABEL ||
    settings?.customPoolLabel === "散題錯題庫" ||
    settings?.customPoolLabel === "散題錯題與沒信心題庫" ||
    settings?.customPoolLabel === "散題待複習題庫"
  ) {
    return false;
  }

  if (mode === "simulation") return true;
  if (mode) return false;

  const paperMode = settings?.paperMode;
  if (paperMode === "past_paper" || paperMode === "ai_paper" || paperMode === "random_past_paper") {
    return true;
  }

  if (getSessionPaperKeys(session).size === 1) return true;

  return !settings && getSessionQuestionFootprint(session) >= SIMULATION_LIKE_MIN_QUESTION_COUNT;
}

function isSimulationReviewCompletionSession(session: QuizSession) {
  return (
    session.settings?.mode === "review" &&
    session.settings?.customPoolLabel === SIMULATION_REVIEW_POOL_LABEL
  );
}

function buildSimulationReviewSettings(
  items: ReviewQuestionItem[],
  yearRange: ReviewYearRange,
  latestReviewAttemptByQuestionId: ReadonlyMap<string, string>
): QuizSettings {
  const orderedItems = orderReviewItemsForNextRound(items, latestReviewAttemptByQuestionId);
  const normalizedYearRange = normalizeReviewYearRange(yearRange);
  const subjectFilters = Array.from(
    new Set(items.map((item) => item.question.subject))
  ) as SubjectName[];

  return {
    ...DEFAULT_QUIZ_SETTINGS,
    mode: "review",
    questionCount: Math.max(1, items.length),
    yearFrom: normalizedYearRange.yearFrom,
    yearTo: normalizedYearRange.yearTo,
    subjectFilter: subjectFilters.length === 1 ? subjectFilters[0] : "全部",
    subjectFilters,
    strictCustomQuestionPool: true,
    preserveCustomQuestionOrder: true,
    customQuestionIds: orderedItems.map((item) => item.question.id),
    customQuestionPayload: orderedItems.map((item) => item.question),
    customPoolLabel: SIMULATION_REVIEW_POOL_LABEL
  };
}

function buildSimulationReviewUrlSettings(
  items: ReviewQuestionItem[],
  yearRange: ReviewYearRange,
  latestReviewAttemptByQuestionId: ReadonlyMap<string, string>
): QuizSettings {
  return {
    ...buildSimulationReviewSettings(items, yearRange, latestReviewAttemptByQuestionId),
    customQuestionPayload: undefined
  };
}

function loadReviewCompletedSessions() {
  return loadCompletedSessions({ includeFullLocalHistory: true });
}

export default function SimulationReviewPage() {
  const [simulationItems, setSimulationItems] = useState<ReviewQuestionItem[]>([]);
  const [latestReviewAttemptByQuestionId, setLatestReviewAttemptByQuestionId] = useState<
    ReadonlyMap<string, string>
  >(() => new Map());
  const [classificationOverrides, setClassificationOverrides] = useState<
    Record<string, QuestionClassificationOverride>
  >({});
  const [localHistoryVersion, setLocalHistoryVersion] = useState(0);
  const [reviewYearRange, setReviewYearRange] = useState<ReviewYearRange>(() => ({
    ...DEFAULT_REVIEW_YEAR_RANGE
  }));
  const [manualReviewState, setManualReviewState] = useState<ManualReviewState>(() =>
    readManualReviewStateForScope(SIMULATION_REVIEW_SCOPE, "guest")
  );
  const { user, syncVersion } = useAuth();
  useCloudHistoryHydration();
  const reviewCompletionThreshold = useReviewCompletionThreshold();
  const baseQuestions = useMemo(() => getQuestionBankBySubjectFilter("全部"), []);
  const allQuestions = useMemo(
    () =>
      baseQuestions.map((question) =>
        applyQuestionClassificationOverride(question, classificationOverrides[question.id])
      ),
    [baseQuestions, classificationOverrides]
  );

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides(baseQuestions.map((question) => question.id))
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static classification if override fetch fails
      });
  }, [baseQuestions, syncVersion]);

  useEffect(() => {
    const sessions = loadReviewCompletedSessions();
    const simulationSourceSessions = sessions.filter(isSimulationSourceSession);
    const historySessions = sessions.filter(
      (session) => isSimulationSourceSession(session) || isSimulationReviewCompletionSession(session)
    );
    const reviewQuestions = mergeQuestionsWithSessionSnapshots(allQuestions, simulationSourceSessions);
    setSimulationItems(getReviewQuestionItems(reviewQuestions, historySessions, Number.MAX_SAFE_INTEGER));
    setLatestReviewAttemptByQuestionId(
      buildLatestReviewAttemptMap(sessions, [SIMULATION_REVIEW_POOL_LABEL])
    );
  }, [allQuestions, syncVersion, localHistoryVersion, user?.id]);

  useEffect(() => {
    const refreshLocalHistory = () => setLocalHistoryVersion((version) => version + 1);
    window.addEventListener("completed-sessions-change", refreshLocalHistory);
    window.addEventListener("completed-question-history-change", refreshLocalHistory);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshLocalHistory);
      window.removeEventListener("completed-question-history-change", refreshLocalHistory);
    };
  }, []);

  useEffect(() => {
    const userId = user?.id ?? "guest";
    setManualReviewState(readManualReviewStateForScope(SIMULATION_REVIEW_SCOPE, userId));

    if (typeof window === "undefined") return;
    const handleManualReviewStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: string; userId?: string }>).detail;
      if (detail?.scope && detail.scope !== SIMULATION_REVIEW_SCOPE) return;
      if (detail?.userId && detail.userId !== userId) return;
      setManualReviewState(readManualReviewStateForScope(SIMULATION_REVIEW_SCOPE, userId));
    };

    window.addEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    return () => {
      window.removeEventListener(MANUAL_REVIEW_STATE_CHANGE_EVENT, handleManualReviewStateChange);
    };
  }, [user?.id]);

  function handleStartSimulationReview(filteredItems: ReviewQuestionItem[]) {
    saveQuizSettings(
      buildSimulationReviewUrlSettings(
        filteredItems,
        reviewYearRange,
        latestReviewAttemptByQuestionId
      )
    );
  }

  const getSimulationReviewHref = useCallback(
    (items: ReviewQuestionItem[]) =>
      buildNewQuizHref(
        buildSimulationReviewUrlSettings(items, reviewYearRange, latestReviewAttemptByQuestionId)
      ),
    [latestReviewAttemptByQuestionId, reviewYearRange]
  );

  const allUnresolvedSimulationItems = useMemo(
    () => getUnresolvedReviewItems(simulationItems, manualReviewState, reviewCompletionThreshold),
    [manualReviewState, reviewCompletionThreshold, simulationItems]
  );
  const yearFilteredSimulationItems = useMemo(
    () => filterReviewItemsByYear(simulationItems, reviewYearRange),
    [reviewYearRange, simulationItems]
  );
  const unresolvedSimulationItems = useMemo(
    () =>
      getUnresolvedReviewItems(
        yearFilteredSimulationItems,
        manualReviewState,
        reviewCompletionThreshold
      ),
    [manualReviewState, reviewCompletionThreshold, yearFilteredSimulationItems]
  );
  const simulationSnapshot = getReviewSnapshot(unresolvedSimulationItems);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Simulation Review</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">模擬考錯題與沒信心題</h1>
            <p className="mt-3 text-slate-500">
              這裡只整理整份模擬考做出來的錯題與低信心題；開始複習時可以一起帶進同一回合，不會和平常散題刷題混在一起。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/simulation"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回模擬考專區
            </Link>
            <Link
              href={getSimulationReviewHref(unresolvedSimulationItems)}
              onClick={(event) => {
                if (unresolvedSimulationItems.length === 0) {
                  event.preventDefault();
                  return;
                }
                handleStartSimulationReview(unresolvedSimulationItems);
              }}
              aria-disabled={unresolvedSimulationItems.length === 0}
              className={`min-h-12 rounded-2xl px-5 py-4 text-sm font-semibold transition ${
                unresolvedSimulationItems.length === 0
                  ? "pointer-events-none bg-slate-200 text-slate-500"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              開始模擬考待複習
            </Link>
          </div>
        </div>
      </section>

      <ReviewYearRangeFilter
        idPrefix="simulation-review"
        value={reviewYearRange}
        onChange={setReviewYearRange}
        filteredCount={simulationSnapshot.total}
        totalCount={allUnresolvedSimulationItems.length}
        poolLabel="模擬考待複習題庫"
      />

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-sky-50 p-5 text-sky-900">
          <p className="text-sm font-medium">模考待複習題</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.total}</p>
        </article>
        <article className="rounded-3xl bg-amber-50 p-5 text-amber-900">
          <p className="text-sm font-medium">模考低信心題</p>
          <p className="mt-2 text-3xl font-bold">{simulationSnapshot.lowConfidence}</p>
        </article>
      </section>

      <div className="mt-8">
        <ReviewNotebook
          title="模擬考待複習題庫"
          description="錯題和沒信心題分開整理；按開始複習會一起帶進同一回合。"
          startLabel="開始模擬考待複習"
          getStartHref={getSimulationReviewHref}
          onStartReview={handleStartSimulationReview}
          items={yearFilteredSimulationItems}
          allQuestions={allQuestions}
          manualEditScope={SIMULATION_REVIEW_SCOPE}
          completionThreshold={reviewCompletionThreshold}
          emptyMessage="這個年份區間目前沒有模擬考待複習題，可以調整上方年份。"
        />
      </div>
    </main>
  );
}
