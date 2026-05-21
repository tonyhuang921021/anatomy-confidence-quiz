"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QuestionOptionBlock, QuestionStemBlock } from "@/components/QuestionMediaBlock";
import { subjectRegistry } from "@/data/subjectRegistry";
import { Question } from "@/types/quiz";

const SEARCHABLE_SUBJECTS = Object.values(subjectRegistry)
  .filter(
    (item) =>
      item.enabled &&
      item.subject !== "醫學（一）" &&
      item.subject !== "醫學（二）" &&
      item.subject !== "細胞生物學" &&
      item.subject !== "分子生物學" &&
      item.subject !== "其他醫學一"
  )
  .sort((left, right) => left.label.localeCompare(right.label, "zh-Hant"));

const ALL_QUESTIONS = Array.from(
  new Map(
    SEARCHABLE_SUBJECTS.flatMap((subject) =>
      subject.questions.map((question) => [question.id, question] as const)
    )
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
const MAX_RESULTS = 120;

function getSearchHaystack(question: Question) {
  return [
    question.subject,
    question.chapter,
    question.section,
    question.testedConcept,
    question.stem,
    question.explanation,
    ...Object.values(question.options)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function SearchPage() {
  const [selectedSubject, setSelectedSubject] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [selectedYear, setSelectedYear] = useState("全部");

  const normalizedKeyword = keyword.trim().toLowerCase();

  const results = useMemo(() => {
    const filtered = ALL_QUESTIONS.filter((question) => {
      if (selectedSubject !== "全部" && question.subject !== selectedSubject) return false;
      if (selectedYear !== "全部" && String(question.sourceYear ?? "") !== selectedYear) return false;
      if (!normalizedKeyword) return true;
      return getSearchHaystack(question).includes(normalizedKeyword);
    });

    return filtered.slice(0, MAX_RESULTS);
  }, [normalizedKeyword, selectedSubject, selectedYear]);

  const totalMatches = useMemo(() => {
    return ALL_QUESTIONS.filter((question) => {
      if (selectedSubject !== "全部" && question.subject !== selectedSubject) return false;
      if (selectedYear !== "全部" && String(question.sourceYear ?? "") !== selectedYear) return false;
      if (!normalizedKeyword) return true;
      return getSearchHaystack(question).includes(normalizedKeyword);
    }).length;
  }, [normalizedKeyword, selectedSubject, selectedYear]);

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
          {totalMatches > MAX_RESULTS ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
              先顯示前 {MAX_RESULTS} 題
            </span>
          ) : null}
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {results.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-6 text-sm text-slate-500 shadow-card ring-1 ring-slate-100">
            目前沒有符合條件的題目。
          </div>
        ) : (
          results.map((question) => (
            <details
              key={question.id}
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
                        {question.sourceYear ?? "未知年份"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {question.chapter}
                      </span>
                    </div>
                    <p className="mt-3 break-words text-base font-semibold leading-7 text-ink">
                      {question.stem}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{question.id}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    展開
                  </span>
                </div>
              </summary>

              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                <QuestionStemBlock question={question} />

                <div className="grid gap-3">
                  {OPTION_KEYS.filter((key) => typeof question.options[key] === "string").map((key) => (
                    <QuestionOptionBlock
                      key={`${question.id}-${key}`}
                      question={question}
                      optionKey={key}
                      wrapperClassName="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 sm:px-4"
                    />
                  ))}
                </div>

                <p>
                  <span className="font-semibold">正確答案：</span>
                  {question.answerCreditType === "multiple_accepted" && question.acceptedAnswers?.length
                    ? `${question.acceptedAnswers.join("/")} 皆可`
                    : question.answer}
                </p>
                <p>
                  <span className="font-semibold">章節：</span>
                  {question.chapter} / {question.section}
                </p>
                <p>
                  <span className="font-semibold">考點：</span>
                  {question.testedConcept}
                </p>
                <p>
                  <span className="font-semibold">詳解：</span>
                  {question.explanation}
                </p>
              </div>
            </details>
          ))
        )}
      </section>
    </main>
  );
}
