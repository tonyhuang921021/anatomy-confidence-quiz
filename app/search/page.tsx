"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionPrimaryTagBadge } from "@/components/QuestionPrimaryTagBadge";
import { QuestionReportButton } from "@/components/QuestionIssueReportButton";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
import { useSavedAISimulationQuestions } from "@/components/useSavedAISimulationQuestions";
import {
  loadConfirmedQuestionClassificationOverrides,
  clearQuestionExplanationBackgroundCache,
  loadSharedQuestionExplanationOverrides,
  syncSharedQuestionExplanationOverrides
} from "@/lib/cloudSync";
import {
  applyQuestionExplanationOverride,
  getPendingQuestionExplanationOverrideSync,
  loadQuestionExplanationOverrides,
  mergeQuestionExplanationOverrides,
  saveQuestionExplanationOverride,
  saveQuestionExplanationOverrides
} from "@/lib/storage";
import {
  isAcceptedSavedQuestionAnswer,
  isSavedQuestionCompleted,
  recordSavedQuestionAnswer,
  removeSavedQuestionRecord,
  useSavedQuestionRecords
} from "@/lib/savedQuestions";
import { getOrCreateVisitorId } from "@/lib/visitor";
import {
  getQuestionPrimaryTag,
  shouldDisplaySubjectBesidePrimaryTag
} from "@/lib/analysisPrimaryTag";
import {
  buildRelatedQuestionContext,
  findPreviousQuestionForContinuation
} from "@/lib/questionContext";
import {
  buildQuestionExplanationRequestQuestion,
  findQuestionSource
} from "@/lib/questionExplanationRequest";
import {
  applyQuestionClassificationOverride,
  getCanonicalQuestionBank
} from "@/data/med1QuestionBank";
import { subjectRegistry } from "@/data/subjectRegistry";
import {
  buildQuestionSearchIndexEntry,
  filterAndSortQuestionSearch,
  isQuestionSearchStatsSort,
  type QuestionSearchRanking,
  type QuestionSearchSort
} from "@/lib/questionSearch";
import { loadQuestionSearchRankings } from "@/lib/questionSearchRankings";
import {
  OptionKey,
  Question,
  QuestionClassificationOverride,
  QuestionExplanationOverride,
  SavedQuestionRecord
} from "@/types/quiz";

const SEARCHABLE_SUBJECTS = Object.values(subjectRegistry)
  .filter(
    (item) =>
      item.enabled &&
      item.subject !== "醫學（一）" &&
      item.subject !== "醫學（二）"
  )
  .sort((left, right) => left.label.localeCompare(right.label, "zh-Hant"));

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
const PAGE_SIZE = 30;

type SearchFavoriteRecord = SavedQuestionRecord;

type FavoriteAnswerFeedback = {
  questionId: string;
  answer: OptionKey;
  isCorrect: boolean;
};

function mergeQuestionExplanationOverride(
  question: Question,
  override?: QuestionExplanationOverride
) {
  if (!override) return question;

  return {
    ...question,
    explanation: override.explanation || question.explanation,
    optionAnalysis: override.optionAnalysis ?? question.optionAnalysis,
    memoryTip: override.memoryTip ?? question.memoryTip
  };
}

function isQuestionCompletedInFavoriteBank(record?: SearchFavoriteRecord) {
  return isSavedQuestionCompleted(record);
}

function isAcceptedFavoriteAnswer(question: Question, answer: OptionKey) {
  return isAcceptedSavedQuestionAnswer(question, answer);
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

export default function SearchPage() {
  const { session } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [selectedYear, setSelectedYear] = useState("全部");
  const [sortMode, setSortMode] = useState<QuestionSearchSort>("recent");
  const [rankingStats, setRankingStats] = useState<Record<string, QuestionSearchRanking>>({});
  const [rankingStatsAttempted, setRankingStatsAttempted] = useState(false);
  const [rankingStatsLoading, setRankingStatsLoading] = useState(false);
  const [rankingStatsError, setRankingStatsError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [favoriteBankOpen, setFavoriteBankOpen] = useState(false);
  const searchFavorites = useSavedQuestionRecords(session?.access_token);
  const searchFavoriteIds = useMemo(
    () => Object.keys(searchFavorites),
    [searchFavorites]
  );
  const {
    questions: savedAISimulationQuestions,
    isLoading: savedAISimulationQuestionsLoading
  } = useSavedAISimulationQuestions(searchFavoriteIds);
  const [favoritePracticeQuestionId, setFavoritePracticeQuestionId] = useState<string | null>(null);
  const [favoriteSelectedAnswer, setFavoriteSelectedAnswer] = useState<OptionKey | null>(null);
  const [favoriteAnswerFeedback, setFavoriteAnswerFeedback] = useState<FavoriteAnswerFeedback | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});
  const debouncedKeyword = useDebouncedValue(keyword, 220);
  const deferredKeyword = useDeferredValue(debouncedKeyword);
  const isKeywordPending = keyword !== debouncedKeyword || debouncedKeyword !== deferredKeyword;

  const canonicalQuestions = useMemo(
    () =>
      Array.from(
        new Map(
          getCanonicalQuestionBank(classificationOverrides)
            .map((question) => [question.id, question] as const)
        ).values()
      ),
    [classificationOverrides]
  );
  const allQuestions = useMemo(
    () => canonicalQuestions.filter((question) => question.sourceType !== "AI_GENERATED"),
    [canonicalQuestions]
  );
  const questionById = useMemo(() => new Map(allQuestions.map((question) => [question.id, question])), [allQuestions]);
  const savedQuestionById = useMemo(
    () =>
      new Map(
        [...canonicalQuestions, ...savedAISimulationQuestions].map(
          (question) => [question.id, question] as const
        )
      ),
    [canonicalQuestions, savedAISimulationQuestions]
  );
  const searchIndex = useMemo(
    () => allQuestions.map((question) => buildQuestionSearchIndexEntry(question)),
    [allQuestions]
  );
  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allQuestions.map((question) => question.sourceYear).filter(
            (year): year is number => typeof year === "number"
          )
        )
      ).sort((a, b) => b - a),
    [allQuestions]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedSubject, selectedYear, sortMode]);

  useEffect(() => {
    if (!isQuestionSearchStatsSort(sortMode) || rankingStatsAttempted) return;
    let cancelled = false;
    setRankingStatsLoading(true);
    setRankingStatsError("");
    void loadQuestionSearchRankings()
      .then((payload) => {
        if (cancelled) return;
        setRankingStats(payload.rankings);
        setRankingStatsAttempted(true);
        setRankingStatsError(payload.degraded ? payload.message || "統計排序暫時無法載入。" : "");
      })
      .catch((error) => {
        if (!cancelled) {
          setRankingStatsAttempted(true);
          setRankingStatsError(error instanceof Error ? error.message : "統計排序暫時無法載入。");
        }
      })
      .finally(() => {
        if (!cancelled) setRankingStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rankingStatsAttempted, sortMode]);

  useEffect(() => {
    setExplanationOverrides((current) =>
      mergeQuestionExplanationOverrides(current, loadQuestionExplanationOverrides())
    );
  }, []);

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides()
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static bank if override fetch fails
      });
  }, []);

  const filteredResults = useMemo(() => {
    return filterAndSortQuestionSearch({
      entries: searchIndex,
      keyword: deferredKeyword,
      subject: selectedSubject,
      year: selectedYear,
      sort: sortMode,
      rankings: rankingStats
    });
  }, [deferredKeyword, rankingStats, searchIndex, selectedSubject, selectedYear, sortMode]);

  const totalMatches = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageResults = useMemo(
    () => filteredResults.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredResults, pageStart]
  );
  const expandedPageQuestionIds = useMemo(
    () => pageResults
      .filter((question) => expandedQuestionIds[question.id])
      .map((question) => question.id),
    [expandedQuestionIds, pageResults]
  );

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (expandedPageQuestionIds.length === 0) return;

      try {
        const questionIds = expandedPageQuestionIds;
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(
          questionIds
        );
        if (Object.keys(sharedOverrides).length > 0) {
          saveQuestionExplanationOverrides(sharedOverrides);
          setExplanationOverrides((current) =>
            mergeQuestionExplanationOverrides(current, sharedOverrides)
          );
        }

        if (session?.access_token) {
          const pendingOverrides = getPendingQuestionExplanationOverrideSync(
            questionIds,
            sharedOverrides
          );
          if (pendingOverrides.length > 0) {
            await syncSharedQuestionExplanationOverrides(pendingOverrides, session.access_token);
          }
        }
      } catch {
        // keep local overrides only
      }
    }

    void fetchSharedExplanationOverrides();
  }, [expandedPageQuestionIds, session?.access_token]);

  const favoriteItems = useMemo(
    () =>
      Object.values(searchFavorites)
        .map((record) => {
          const question = savedQuestionById.get(record.questionId);
          if (!question) return null;
          return {
            record,
            question: mergeQuestionExplanationOverride(
              applyQuestionClassificationOverride(question, classificationOverrides[question.id]),
              explanationOverrides[question.id]
            )
          };
        })
        .filter(
          (item): item is { record: SearchFavoriteRecord; question: Question } =>
            Boolean(item)
        )
        .sort((left, right) => {
          const leftDone = isQuestionCompletedInFavoriteBank(left.record);
          const rightDone = isQuestionCompletedInFavoriteBank(right.record);
          if (leftDone !== rightDone) return leftDone ? 1 : -1;
          return right.record.addedAt.localeCompare(left.record.addedAt);
        }),
    [classificationOverrides, explanationOverrides, savedQuestionById, searchFavorites]
  );
  const activeFavoriteItems = useMemo(
    () => favoriteItems.filter((item) => !isQuestionCompletedInFavoriteBank(item.record)),
    [favoriteItems]
  );
  const searchFavoriteRecords = useMemo(
    () => Object.values(searchFavorites),
    [searchFavorites]
  );
  const completedFavoriteCount = useMemo(
    () => searchFavoriteRecords.filter(isQuestionCompletedInFavoriteBank).length,
    [searchFavoriteRecords]
  );
  const activeFavoriteCount = searchFavoriteRecords.length - completedFavoriteCount;
  const favoritePracticeItem = useMemo(() => {
    if (savedAISimulationQuestionsLoading) return null;
    const selected = activeFavoriteItems.find((item) => item.question.id === favoritePracticeQuestionId);
    return selected ?? activeFavoriteItems[0] ?? null;
  }, [activeFavoriteItems, favoritePracticeQuestionId, savedAISimulationQuestionsLoading]);

  useEffect(() => {
    if (!favoritePracticeItem) {
      setFavoritePracticeQuestionId(null);
      setFavoriteSelectedAnswer(null);
      setFavoriteAnswerFeedback(null);
      return;
    }

    if (favoritePracticeQuestionId !== favoritePracticeItem.question.id) {
      setFavoritePracticeQuestionId(favoritePracticeItem.question.id);
      setFavoriteSelectedAnswer(null);
      setFavoriteAnswerFeedback(null);
    }
  }, [favoritePracticeItem, favoritePracticeQuestionId]);

  function handleRemoveSearchFavorite(questionId: string) {
    removeSavedQuestionRecord(questionId, session?.access_token);
    if (favoritePracticeQuestionId === questionId) {
      setFavoritePracticeQuestionId(null);
      setFavoriteSelectedAnswer(null);
      setFavoriteAnswerFeedback(null);
    }
  }

  function handleSelectFavoritePracticeQuestion(questionId: string) {
    setFavoritePracticeQuestionId(questionId);
    setFavoriteSelectedAnswer(null);
    setFavoriteAnswerFeedback(null);
  }

  function handleSubmitFavoriteAnswer() {
    if (!favoritePracticeItem || !favoriteSelectedAnswer) return;

    const isCorrect = isAcceptedFavoriteAnswer(favoritePracticeItem.question, favoriteSelectedAnswer);
    const questionId = favoritePracticeItem.question.id;
    const nextCorrectCount = isCorrect
      ? Math.min(2, favoritePracticeItem.record.correctCount + 1)
      : favoritePracticeItem.record.correctCount;

    recordSavedQuestionAnswer(questionId, isCorrect, session?.access_token);
    setFavoriteAnswerFeedback({
      questionId,
      answer: favoriteSelectedAnswer,
      isCorrect
    });
    if (nextCorrectCount >= 2) {
      setFavoriteSelectedAnswer(null);
    }
  }

  async function handleGenerateQuestionExplanation(
    question: Question,
    previousOverride?: QuestionExplanationOverride
  ) {
    if (!session?.access_token) {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "請先登入帳號，才能使用 AI 補詳解。"
      }));
      return;
    }

    setExplanationLoadingMap((current) => ({ ...current, [question.id]: true }));
    setExplanationErrorMap((current) => ({ ...current, [question.id]: "" }));

    const previousQuestion = findPreviousQuestionForContinuation(question, allQuestions);
    const sourceQuestion = findQuestionSource(question, allQuestions);

    try {
      const response = await fetch("/api/question-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId: getOrCreateVisitorId(),
          accessToken: session.access_token,
          question: buildQuestionExplanationRequestQuestion(question, sourceQuestion),
          previousQuestion: previousQuestion ? buildRelatedQuestionContext(previousQuestion) : undefined,
          previousOverride
        })
      });

      const payload = (await response.json()) as {
        ok: boolean;
        sharedSaved?: boolean;
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
          [question.id]: payload.message || "AI 詳解產生失敗。"
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

      clearQuestionExplanationBackgroundCache(question.id);
      saveQuestionExplanationOverride(question.id, override);
      setExplanationOverrides((current) =>
        mergeQuestionExplanationOverrides(current, { [question.id]: override })
      );
    } catch {
      setExplanationErrorMap((current) => ({
        ...current,
        [question.id]: "無法連線到 AI 詳解 API。"
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
            primaryTag: getQuestionPrimaryTag(question),
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

  const hasActiveSearchFilters =
    keyword.trim().length > 0 ||
    selectedSubject !== "全部" ||
    selectedYear !== "全部" ||
    sortMode !== "recent";

  function resetSearchFilters() {
    setKeyword("");
    setSelectedSubject("全部");
    setSelectedYear("全部");
    setSortMode("recent");
  }

  function retryRankingStats() {
    setRankingStatsError("");
    setRankingStatsAttempted(false);
  }

  return (
    <main id="main-content" className="shell workspace-page search-page">
      <section className="surface-card workspace-page-panel min-w-0 max-w-full overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="workspace-page-kicker">題庫</p>
              <h1 className="workspace-page-title">題目搜尋</h1>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(16rem,1.45fr)_minmax(10rem,0.8fr)_minmax(9rem,0.62fr)_minmax(13rem,0.95fr)]">
          <label className="min-w-0 space-y-2">
            <span className="text-sm font-semibold text-slate-700">關鍵字</span>
            <span className="relative block">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="題幹、選項、章節或題號"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 pr-14 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
              {keyword ? (
                <button
                  type="button"
                  onClick={() => setKeyword("")}
                  className="absolute right-2 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                  aria-label="清除關鍵字"
                >
                  清除
                </button>
              ) : null}
            </span>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">科目</span>
            <select
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="全部">全部科目</option>
              {SEARCHABLE_SUBJECTS.map((subject) => (
                <option key={subject.subject} value={subject.subject}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">年份</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="全部">全部年份</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">排序</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as QuestionSearchSort)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="recent">近年優先</option>
              <option value="oldest">早年優先</option>
              <option value="accuracy_asc">答對率低到高</option>
              <option value="accuracy_desc">答對率高到低</option>
              <option value="chaos_desc">最多人「這題我們不要了」</option>
            </select>
          </label>
        </div>

        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold text-slate-800">找到 {totalMatches} 題</span>
            <span className="text-slate-500">第 {safeCurrentPage} / {totalPages} 頁</span>
            {isKeywordPending ? <span className="font-semibold text-amber-700">搜尋整理中</span> : null}
            {rankingStatsLoading ? <span className="font-semibold text-brand-700">排行載入中</span> : null}
            {rankingStatsError ? (
              <span className="flex flex-wrap items-center gap-2 text-amber-800">
                <span>{rankingStatsError}</span>
                <button type="button" onClick={retryRankingStats} className="font-semibold underline underline-offset-2">
                  重試
                </button>
              </span>
            ) : null}
          </div>
          {hasActiveSearchFilters ? (
            <button
              type="button"
              onClick={resetSearchFilters}
              className="min-h-10 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
            >
              清除篩選
            </button>
          ) : null}
        </div>
      </section>

      <section className="search-results-list mt-6 grid min-w-0 gap-4">
        {pageResults.length === 0 ? (
          <div className="workspace-empty-state">
            目前沒有符合條件的題目。
          </div>
        ) : (
          pageResults.map((question) => {
            const renderedQuestion = mergeQuestionExplanationOverride(
              applyQuestionClassificationOverride(question, classificationOverrides[question.id]),
              explanationOverrides[question.id]
            );
            const override = explanationOverrides[question.id];
            const loading = explanationLoadingMap[question.id];
            const error = explanationErrorMap[question.id];
            const favoriteRecord = searchFavorites[renderedQuestion.id];
            const isFavorited = Boolean(favoriteRecord);
            const isExpanded = Boolean(expandedQuestionIds[renderedQuestion.id]);
            const ranking = rankingStats[renderedQuestion.id];
            const correctAnswerLabel =
              (renderedQuestion.answerCreditType === "multiple_accepted" ||
                renderedQuestion.answerCreditType === "multiple_answers") &&
              renderedQuestion.acceptedAnswers?.length
                ? `${renderedQuestion.acceptedAnswers.join("/")} 皆可`
                : renderedQuestion.answerCreditType === "all_credit"
                  ? "ALL"
                  : renderedQuestion.answer;

            return (
            <details
              key={renderedQuestion.id}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setExpandedQuestionIds((current) => {
                  if (current[renderedQuestion.id] === open) return current;
                  return {
                    ...current,
                    [renderedQuestion.id]: open
                  };
                });
              }}
              className="search-result-card workspace-section min-w-0 max-w-full overflow-hidden"
            >
              <summary className="min-w-0 cursor-pointer list-none px-4 py-4 transition hover:bg-slate-50/70 sm:px-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {shouldDisplaySubjectBesidePrimaryTag(renderedQuestion) ? (
                        <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                          {question.subject}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {renderedQuestion.sourceYear ?? "未知年份"}
                      </span>
                      <QuestionPrimaryTagBadge question={renderedQuestion} />
                    </div>
                    <p className={`mt-3 whitespace-pre-wrap break-words text-base font-semibold leading-7 text-ink ${isExpanded ? "" : "line-clamp-2"}`}>
                      {renderedQuestion.stem}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {renderedQuestion.id}
                      {renderedQuestion.examCode && renderedQuestion.paperCode
                        ? ` ・ ${renderedQuestion.examCode}-${renderedQuestion.paperCode}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 text-xs font-semibold sm:w-auto sm:shrink-0 sm:justify-end">
                    {ranking && ranking.totalAttempts > 0 ? (
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-sky-800 ring-1 ring-sky-100">
                        答對率 {ranking.correctRate.toFixed(1)}% ・ {ranking.totalAttempts} 人次
                      </span>
                    ) : null}
                    {ranking && ranking.chaosCount > 0 ? (
                      <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-800 ring-1 ring-rose-100">
                        不要了 {ranking.chaosCount} 人
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-white">
                      {isExpanded ? "收合" : "展開"}
                    </span>
                  </div>
                </div>
              </summary>

              {isExpanded ? (
              <div className="search-result-details min-w-0 max-w-full border-t border-slate-100 px-4 py-4 text-sm leading-7 text-slate-700 sm:px-5 sm:py-5">
                <div className="search-result-answer-bar">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="text-xs font-semibold text-slate-500">正確答案</span>
                    <strong className="text-base font-black text-ink">{correctAnswerLabel}</strong>
                  </p>
                  <CopyQuestionPromptButton question={renderedQuestion} />
                </div>

                <div className="search-result-options grid gap-3">
                  {OPTION_KEYS.filter((key) => typeof renderedQuestion.options[key] === "string").map((key) => (
                    <QuestionOptionBlock
                      key={`${renderedQuestion.id}-${key}`}
                      question={renderedQuestion}
                      optionKey={key}
                      wrapperClassName="search-result-option rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
                    />
                  ))}
                </div>

                <StructuredExplanationText text={renderedQuestion.explanation} label="詳解" compact />
                {renderedQuestion.optionAnalysis ? (
                  <div className="space-y-2.5">
                    {OPTION_KEYS.map((key) => {
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
                <div className="search-result-action-dock">
                  <QuestionExplanationTabs
                    question={renderedQuestion}
                    compact
                    className="search-result-source-tabs"
                  />
                  <div className="search-result-utility-actions">
                    <SavedQuestionButton questionId={renderedQuestion.id} source="search" showLabel />
                    {isFavorited ? (
                      <span className="text-xs font-semibold text-slate-500">
                        答對 {favoriteRecord.correctCount} / 2
                      </span>
                    ) : null}
                    {override ? (
                      <>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        已替換詳解・{override.model ?? "gpt-5.4-mini"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuestionExplanation(question, override)}
                        disabled={loading}
                        className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                      >
                        {loading ? "重新生成中..." : "重新替換詳解"}
                      </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuestionExplanation(renderedQuestion)}
                        disabled={loading}
                        className="min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                      >
                        {loading ? "AI 生成中..." : "用 AI 補詳解"}
                      </button>
                    )}
                    <QuestionReportButton
                      question={renderedQuestion}
                      disabled={classificationReportLoadingMap[renderedQuestion.id]}
                      classificationLoading={classificationReportLoadingMap[renderedQuestion.id]}
                      classificationMessage={classificationReportMessageMap[renderedQuestion.id]}
                      onReportClassification={() => void handleReportClassification(renderedQuestion)}
                    />
                  </div>
                  {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
                </div>
              </div>
              ) : null}
            </details>
          );
          })
        )}
      </section>

      {totalMatches > PAGE_SIZE ? (
        <section className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
            className="min-h-10 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一頁
          </button>
          <span className="px-3 py-2 text-sm font-semibold text-slate-600">
            第 {safeCurrentPage} / {totalPages} 頁
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage === totalPages}
            className="min-h-10 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一頁
          </button>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setFavoriteBankOpen(true)}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl ring-1 ring-white/40 transition hover:-translate-y-0.5 hover:bg-black focus:outline-none focus:ring-4 focus:ring-brand-100"
        aria-label="開啟儲存題目"
      >
        <span className="text-xl leading-none">☆</span>
        {searchFavoriteRecords.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-6 justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white">
            {searchFavoriteRecords.length}
          </span>
        ) : null}
      </button>

      {favoriteBankOpen ? (
        <div
          className="fixed inset-0 z-[140] bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="搜尋儲存題目"
          onClick={() => setFavoriteBankOpen(false)}
        >
          <section
            className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Saved Bank</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">儲存題目</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {activeFavoriteCount > 0
                    ? `還有 ${activeFavoriteCount} 題待練，${completedFavoriteCount} 題已答對兩次。`
                    : searchFavoriteRecords.length > 0
                      ? "儲存題都答對兩次了，這區暫時很乖。"
                      : "搜尋頁看到想補的題，就先丟進來。"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFavoriteBankOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700 transition hover:bg-slate-200"
                aria-label="關閉儲存題目"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {favoritePracticeItem ? (
                <section className="rounded-[1.5rem] border border-brand-100 bg-brand-50/50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                        練習中
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                        答對 {favoritePracticeItem.record.correctCount} / 2
                      </span>
                      {shouldDisplaySubjectBesidePrimaryTag(favoritePracticeItem.question) ? (
                        <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                          {favoritePracticeItem.question.subject}
                        </span>
                      ) : null}
                      <QuestionPrimaryTagBadge
                        question={favoritePracticeItem.question}
                        prefix=""
                        className="rounded-full bg-sky-50 px-3 py-1 text-sky-800 ring-1 ring-sky-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSearchFavorite(favoritePracticeItem.question.id)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-700"
                    >
                      移除
                    </button>
                  </div>

                  <QuestionStemBlock question={favoritePracticeItem.question} className="text-sm leading-7" />

                  <div className="mt-4 grid gap-2">
                    {OPTION_KEYS.filter((key) => typeof favoritePracticeItem.question.options[key] === "string").map((key) => {
                      const selected = favoriteSelectedAnswer === key;
                      const feedbackForThisQuestion =
                        favoriteAnswerFeedback?.questionId === favoritePracticeItem.question.id
                          ? favoriteAnswerFeedback
                          : null;
                      const isCorrectOption = isAcceptedFavoriteAnswer(favoritePracticeItem.question, key);
                      const isWrongSelected =
                        feedbackForThisQuestion?.answer === key && !feedbackForThisQuestion.isCorrect;
                      const showCorrect = Boolean(feedbackForThisQuestion) && isCorrectOption;

                      return (
                        <button
                          key={`${favoritePracticeItem.question.id}-favorite-${key}`}
                          type="button"
                          onClick={() => {
                            setFavoriteSelectedAnswer(key);
                            setFavoriteAnswerFeedback(null);
                          }}
                          className={`w-full rounded-2xl text-left transition ${
                            isWrongSelected
                              ? "border border-rose-300 bg-rose-50"
                              : showCorrect
                                ? "border border-emerald-300 bg-emerald-50"
                                : selected
                                  ? "border border-slate-900 bg-white"
                                  : "border border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"
                          }`}
                        >
                          <QuestionOptionBlock
                            question={favoritePracticeItem.question}
                            optionKey={key}
                            wrapperClassName="px-3 py-3"
                            labelClassName={`mt-0.5 inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                              isWrongSelected
                                ? "bg-rose-600 text-white ring-rose-600"
                                : showCorrect
                                  ? "bg-emerald-600 text-white ring-emerald-600"
                                  : "bg-white text-slate-700 ring-slate-200"
                            }`}
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

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitFavoriteAnswer}
                      disabled={!favoriteSelectedAnswer}
                      className="min-h-11 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      送出答案
                    </button>
                    {favoriteAnswerFeedback?.questionId === favoritePracticeItem.question.id ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          favoriteAnswerFeedback.isCorrect
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {favoriteAnswerFeedback.isCorrect ? "答對，進度 +1" : "答錯，這題先繼續留著"}
                      </span>
                    ) : null}
                  </div>
                </section>
              ) : (
                <section className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
                  {savedAISimulationQuestionsLoading
                    ? "正在整理儲存題目。"
                    : searchFavoriteRecords.length > 0
                      ? "目前沒有待練題。已答對兩次的題目會待在下面完成區。"
                      : "儲存題目還是空的。"}
                </section>
              )}

              {!savedAISimulationQuestionsLoading && favoriteItems.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-ink">全部儲存</h3>
                  {favoriteItems.map(({ question, record }) => {
                    const completed = isQuestionCompletedInFavoriteBank(record);
                    return (
                      <div
                        key={`favorite-list-${question.id}`}
                        className={`rounded-2xl border p-3 ${
                          completed
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
                              <span
                                className={`rounded-full px-2 py-0.5 ${
                                  completed
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {completed ? "已完成" : `答對 ${record.correctCount} / 2`}
                              </span>
                              <span className="text-slate-400">
                                {question.sourceType === "AI_GENERATED" || question.source === "ai-generated"
                                  ? "AI 模擬卷"
                                  : question.sourceYear ?? "未知年份"}
                              </span>
                              <span className="text-slate-400">{question.subject}</span>
                              <QuestionPrimaryTagBadge
                                question={question}
                                prefix=""
                                className="text-sky-700"
                              />
                            </div>
                            <p className="line-clamp-2 break-words text-sm font-semibold leading-6 text-slate-800">
                              {question.stem}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectFavoritePracticeQuestion(question.id)}
                              disabled={completed}
                              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-emerald-600"
                            >
                              {completed ? "綠了" : "做這題"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSearchFavorite(question.id)}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
