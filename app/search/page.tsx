"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CopyQuestionPromptButton } from "@/components/CopyQuestionPromptButton";
import { QuestionExplanationTabs } from "@/components/QuestionExplanationTabs";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { QuestionIssueReportButton } from "@/components/QuestionIssueReportButton";
import { SavedQuestionButton } from "@/components/SavedQuestionButton";
import { StructuredExplanationText } from "@/components/StructuredExplanationText";
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

type SearchIndexEntry = {
  question: Question;
  normalizedTerms: string;
  compactTerms: string;
};

type SearchFavoriteRecord = SavedQuestionRecord;

type FavoriteAnswerFeedback = {
  questionId: string;
  answer: OptionKey;
  isCorrect: boolean;
};

function normalizeSearchText(text: string) {
  return text.toLowerCase().trim();
}

function compactSearchText(text: string) {
  return text.toLowerCase().replace(/[\s\-_/]+/g, "");
}

function getSearchTerms(question: Question) {
  const examCode = question.examCode ? String(question.examCode) : "";
  const paperCode = question.paperCode ? String(question.paperCode) : "";
  const questionCode = question.id.match(/Q\d+$/)?.[0] ?? "";

  return [
    question.id,
    question.sourceCitation,
    examCode,
    paperCode,
    examCode && paperCode ? `${examCode}-${paperCode}` : "",
    examCode && paperCode ? `${examCode}_${paperCode}` : "",
    examCode && paperCode ? `${examCode} ${paperCode}` : "",
    examCode && paperCode ? `${examCode}${paperCode}` : "",
    questionCode,
    question.subject,
    question.chapter,
    question.section,
    question.testedConcept,
    question.stem,
    question.explanation,
    question.memoryTip,
    ...Object.values(question.optionAnalysis ?? {}),
    ...Object.values(question.options)
  ].filter((value): value is string => Boolean(value));
}

function buildSearchIndexEntry(question: Question): SearchIndexEntry {
  const joinedTerms = getSearchTerms(question).join(" ");
  return {
    question,
    normalizedTerms: normalizeSearchText(joinedTerms),
    compactTerms: compactSearchText(joinedTerms)
  };
}

function matchesSearchIndexEntry(entry: SearchIndexEntry, normalizedKeyword: string, compactKeyword: string) {
  if (!normalizedKeyword) return true;

  if (entry.normalizedTerms.includes(normalizedKeyword)) return true;

  return compactKeyword.length > 0 && entry.compactTerms.includes(compactKeyword);
}

function compareQuestionsForSearch(left: Question, right: Question, yearSortOrder: "desc" | "asc") {
  const yearLeft = left.sourceYear ?? (yearSortOrder === "desc" ? -Infinity : Infinity);
  const yearRight = right.sourceYear ?? (yearSortOrder === "desc" ? -Infinity : Infinity);
  if (yearLeft !== yearRight) {
    return yearSortOrder === "desc" ? yearRight - yearLeft : yearLeft - yearRight;
  }

  const examLeft = left.examCode ?? "";
  const examRight = right.examCode ?? "";
  if (examLeft !== examRight) {
    return yearSortOrder === "desc"
      ? examRight.localeCompare(examLeft)
      : examLeft.localeCompare(examRight);
  }

  const paperLeft = left.paperCode ?? "";
  const paperRight = right.paperCode ?? "";
  if (paperLeft !== paperRight) {
    return yearSortOrder === "desc"
      ? paperRight.localeCompare(paperLeft)
      : paperLeft.localeCompare(paperRight);
  }

  const questionNoLeft = left.originalQuestionNumber ?? (yearSortOrder === "desc" ? -Infinity : Infinity);
  const questionNoRight = right.originalQuestionNumber ?? (yearSortOrder === "desc" ? -Infinity : Infinity);
  if (questionNoLeft !== questionNoRight) {
    return yearSortOrder === "desc"
      ? questionNoRight - questionNoLeft
      : questionNoLeft - questionNoRight;
  }

  return yearSortOrder === "desc"
    ? right.id.localeCompare(left.id)
    : left.id.localeCompare(right.id);
}

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
  const [yearSortOrder, setYearSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});
  const [classificationReportLoadingMap, setClassificationReportLoadingMap] = useState<Record<string, boolean>>({});
  const [classificationReportMessageMap, setClassificationReportMessageMap] = useState<Record<string, string>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const [favoriteBankOpen, setFavoriteBankOpen] = useState(false);
  const searchFavorites = useSavedQuestionRecords(session?.access_token);
  const [favoritePracticeQuestionId, setFavoritePracticeQuestionId] = useState<string | null>(null);
  const [favoriteSelectedAnswer, setFavoriteSelectedAnswer] = useState<OptionKey | null>(null);
  const [favoriteAnswerFeedback, setFavoriteAnswerFeedback] = useState<FavoriteAnswerFeedback | null>(null);
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});
  const debouncedKeyword = useDebouncedValue(keyword, 220);
  const deferredKeyword = useDeferredValue(debouncedKeyword);
  const isKeywordPending = keyword !== debouncedKeyword || debouncedKeyword !== deferredKeyword;

  const normalizedKeyword = normalizeSearchText(deferredKeyword);
  const compactKeyword = compactSearchText(deferredKeyword);
  const allQuestions = useMemo(
    () =>
      Array.from(
        new Map(
          getCanonicalQuestionBank(classificationOverrides)
            .filter((question) => question.sourceType !== "AI_GENERATED")
            .map((question) => [question.id, question] as const)
        ).values()
      ),
    [classificationOverrides]
  );
  const questionById = useMemo(() => new Map(allQuestions.map((question) => [question.id, question])), [allQuestions]);
  const searchIndex = useMemo(
    () => allQuestions.map((question) => buildSearchIndexEntry(question)),
    [allQuestions]
  );
  const sortedSearchIndex = useMemo(
    () =>
      [...searchIndex].sort((left, right) =>
        compareQuestionsForSearch(left.question, right.question, yearSortOrder)
      ),
    [searchIndex, yearSortOrder]
  );
  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allQuestions.map((question) => question.sourceYear).filter(
            (year): year is number => typeof year === "number"
          )
        )
      ).sort((a, b) => (yearSortOrder === "desc" ? b - a : a - b)),
    [allQuestions, yearSortOrder]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedSubject, selectedYear, yearSortOrder]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, []);

  useEffect(() => {
    void loadConfirmedQuestionClassificationOverrides()
      .then((overrides) => setClassificationOverrides(overrides))
      .catch(() => {
        // keep static bank if override fetch fails
      });
  }, []);

  const filteredResults = useMemo(() => {
    return sortedSearchIndex
      .filter((entry) => {
        const { question } = entry;
        if (selectedSubject !== "全部" && question.subject !== selectedSubject) return false;
        if (selectedYear !== "全部" && String(question.sourceYear ?? "") !== selectedYear) return false;
        return matchesSearchIndexEntry(entry, normalizedKeyword, compactKeyword);
      })
      .map((entry) => entry.question);
  }, [compactKeyword, normalizedKeyword, selectedSubject, selectedYear, sortedSearchIndex]);

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
          const question = questionById.get(record.questionId);
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
    [classificationOverrides, explanationOverrides, questionById, searchFavorites]
  );
  const activeFavoriteItems = useMemo(
    () => favoriteItems.filter((item) => !isQuestionCompletedInFavoriteBank(item.record)),
    [favoriteItems]
  );
  const completedFavoriteCount = favoriteItems.length - activeFavoriteItems.length;
  const favoritePracticeItem = useMemo(() => {
    const selected = activeFavoriteItems.find((item) => item.question.id === favoritePracticeQuestionId);
    return selected ?? activeFavoriteItems[0] ?? null;
  }, [activeFavoriteItems, favoritePracticeQuestionId]);

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
      setExplanationOverrides((current) => ({
        ...current,
        [question.id]: override
      }));
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

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Question Search</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">題目搜尋</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              可先分科目，也可以直接用關鍵字和年份找題。
            </p>
          </div>
          <Link
            href="/"
            className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            返回首頁
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.8fr_1fr]">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">關鍵字</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="可搜題幹、選項、章節、考點"
              className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">科目</span>
            <select
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
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
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="全部">全部年份</option>
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">年份排序</legend>
            <div className="grid min-h-12 grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                <input
                  type="radio"
                  name="year-sort-order"
                  checked={yearSortOrder === "desc"}
                  onChange={() => setYearSortOrder("desc")}
                  className="h-4 w-4 accent-slate-900"
                />
                由近至遠
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                <input
                  type="radio"
                  name="year-sort-order"
                  checked={yearSortOrder === "asc"}
                  onChange={() => setYearSortOrder("asc")}
                  className="h-4 w-4 accent-slate-900"
                />
                由遠至近
              </label>
            </div>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
          {isKeywordPending ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800 ring-1 ring-amber-100">
              搜尋整理中
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">找到 {totalMatches} 題</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            第 {safeCurrentPage} / {totalPages} 頁
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {pageResults.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-card ring-1 ring-slate-100">
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
              className="rounded-[2rem] bg-white p-4 shadow-card ring-1 ring-slate-100 sm:p-5"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
                        {question.subject}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {renderedQuestion.sourceYear ?? "未知年份"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {renderedQuestion.chapter}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-base font-semibold leading-7 text-ink">
                      {renderedQuestion.stem}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {renderedQuestion.id}
                      {renderedQuestion.examCode && renderedQuestion.paperCode
                        ? ` ・ ${renderedQuestion.examCode}-${renderedQuestion.paperCode}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    展開
                  </span>
                </div>
              </summary>

              {isExpanded ? (
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                <QuestionStemBlock question={renderedQuestion} />
                <div className="flex flex-wrap items-center gap-2">
                  <CopyQuestionPromptButton question={renderedQuestion} />
                </div>

                <div className="grid gap-3">
                  {OPTION_KEYS.filter((key) => typeof renderedQuestion.options[key] === "string").map((key) => (
                    <QuestionOptionBlock
                      key={`${renderedQuestion.id}-${key}`}
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
                      ? "ALL"
                      : renderedQuestion.answer}
                </p>
                <p>
                  <span className="font-semibold">章節：</span>
                  {renderedQuestion.chapter} / {renderedQuestion.section}
                </p>
                <StructuredExplanationText text={renderedQuestion.explanation} label="詳解" compact />
                <QuestionExplanationTabs question={renderedQuestion} compact className="mt-3" />
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
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SavedQuestionButton questionId={renderedQuestion.id} source="search" showLabel />
                    {isFavorited ? (
                      <span className="text-xs font-semibold text-slate-500">
                        答對 {favoriteRecord.correctCount} / 2
                      </span>
                    ) : null}
                  </div>
                  {override ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        已替換詳解・{override.model ?? "gpt-5.4-mini"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuestionExplanation(question, override)}
                        disabled={loading}
                        className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                      >
                        {loading ? "重新生成中..." : "重新替換詳解"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleGenerateQuestionExplanation(renderedQuestion)}
                      disabled={loading}
                      className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                    >
                      {loading ? "AI 生成中..." : "用 AI 補詳解"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleReportClassification(renderedQuestion)}
                    disabled={classificationReportLoadingMap[renderedQuestion.id]}
                    className="min-h-10 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {classificationReportLoadingMap[renderedQuestion.id] ? "回報中..." : "回報此題分類錯誤"}
                  </button>
                  <QuestionIssueReportButton
                    question={renderedQuestion}
                    disabled={classificationReportLoadingMap[renderedQuestion.id]}
                  />
                  {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
                  {classificationReportMessageMap[renderedQuestion.id] ? (
                    <p className="text-sm font-medium text-slate-600">
                      {classificationReportMessageMap[renderedQuestion.id]}
                    </p>
                  ) : null}
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
            className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一頁
          </button>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-card ring-1 ring-slate-100">
            第 {safeCurrentPage} / {totalPages} 頁
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safeCurrentPage === totalPages}
            className="min-h-12 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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
        {favoriteItems.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-6 justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[11px] font-bold text-white ring-2 ring-white">
            {favoriteItems.length}
          </span>
        ) : null}
      </button>

      {favoriteBankOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/35 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="搜尋儲存題目"
          onClick={() => setFavoriteBankOpen(false)}
        >
          <section
            className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Saved Bank</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">儲存題目</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {activeFavoriteItems.length > 0
                    ? `還有 ${activeFavoriteItems.length} 題待練，${completedFavoriteCount} 題已答對兩次。`
                    : favoriteItems.length > 0
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
                      <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                        {favoritePracticeItem.question.subject}
                      </span>
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
                  {favoriteItems.length > 0 ? "目前沒有待練題。已答對兩次的題目會待在下面完成區。" : "儲存題目還是空的。"}
                </section>
              )}

              {favoriteItems.length > 0 ? (
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
                              <span className="text-slate-400">{question.sourceYear ?? "未知年份"}</span>
                              <span className="text-slate-400">{question.subject}</span>
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
