"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
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
import { canonicalQuestionBank } from "@/data/med1QuestionBank";
import { subjectRegistry } from "@/data/subjectRegistry";
import { OptionKey, Question, QuestionExplanationOverride } from "@/types/quiz";

const SEARCHABLE_SUBJECTS = Object.values(subjectRegistry)
  .filter(
    (item) =>
      item.enabled &&
      item.subject !== "醫學（一）" &&
      item.subject !== "醫學（二）"
  )
  .sort((left, right) => left.label.localeCompare(right.label, "zh-Hant"));

const ALL_QUESTIONS = Array.from(
  new Map(
    canonicalQuestionBank.map((question) => [question.id, question] as const)
  ).values()
);

const YEAR_OPTIONS = Array.from(
  new Set(
    ALL_QUESTIONS.map((question) => question.sourceYear).filter(
      (year): year is number => typeof year === "number"
    )
  )
).sort((a, b) => b - a);

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;
const PAGE_SIZE = 30;

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

function matchesQuestion(question: Question, normalizedKeyword: string, compactKeyword: string) {
  if (!normalizedKeyword) return true;

  const terms = getSearchTerms(question);
  const joinedTerms = normalizeSearchText(terms.join(" "));
  if (joinedTerms.includes(normalizedKeyword)) return true;

  const compactTerms = compactSearchText(terms.join(""));
  return compactKeyword.length > 0 && compactTerms.includes(compactKeyword);
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

export default function SearchPage() {
  const { session } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [selectedYear, setSelectedYear] = useState("全部");
  const [currentPage, setCurrentPage] = useState(1);
  const [explanationOverrides, setExplanationOverrides] = useState<Record<string, QuestionExplanationOverride>>({});
  const [explanationLoadingMap, setExplanationLoadingMap] = useState<Record<string, boolean>>({});
  const [explanationErrorMap, setExplanationErrorMap] = useState<Record<string, string>>({});

  const normalizedKeyword = normalizeSearchText(keyword);
  const compactKeyword = compactSearchText(keyword);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedSubject, selectedYear]);

  useEffect(() => {
    setExplanationOverrides(loadQuestionExplanationOverrides());
  }, []);

  const filteredResults = useMemo(() => {
    return ALL_QUESTIONS.filter((question) => {
      if (selectedSubject !== "全部" && question.subject !== selectedSubject) return false;
      if (selectedYear !== "全部" && String(question.sourceYear ?? "") !== selectedYear) return false;
      return matchesQuestion(question, normalizedKeyword, compactKeyword);
    });
  }, [compactKeyword, normalizedKeyword, selectedSubject, selectedYear]);

  const totalMatches = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageResults = filteredResults.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    async function fetchSharedExplanationOverrides() {
      if (pageResults.length === 0) return;

      try {
        const sharedOverrides = await loadSharedQuestionExplanationOverrides(
          pageResults.map((question) => question.id)
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
  }, [pageResults]);

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
          accessToken: session.access_token,
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

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.8fr]">
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
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
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
              applyQuestionExplanationOverride(question),
              explanationOverrides[question.id]
            );
            const override = explanationOverrides[question.id];
            const loading = explanationLoadingMap[question.id];
            const error = explanationErrorMap[question.id];

            return (
            <details
              key={renderedQuestion.id}
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
                    <p className="mt-3 break-words text-base font-semibold leading-7 text-ink">
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

              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                <QuestionStemBlock question={renderedQuestion} />

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
                <p>
                  <span className="font-semibold">考點：</span>
                  {renderedQuestion.testedConcept}
                </p>
                <p>
                  <span className="font-semibold">詳解：</span>
                  {renderedQuestion.explanation}
                </p>
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
                  <p>
                    <span className="font-semibold">快速記憶法：</span>
                    {renderedQuestion.memoryTip}
                  </p>
                ) : null}
                <div className="space-y-3">
                  {override ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      已替換詳解・{override.model ?? "gpt-5-mini"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleGenerateQuestionExplanation(renderedQuestion)}
                      disabled={loading}
                      className="min-h-10 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                    >
                      {loading ? "GPT-5-mini 生成中..." : "用 GPT-5-mini 補詳解"}
                    </button>
                  )}
                  {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
                </div>
              </div>
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
    </main>
  );
}
