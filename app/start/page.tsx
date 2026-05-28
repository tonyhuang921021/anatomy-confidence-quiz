"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import { getSeasonalLimitedQuestions } from "@/data/med1QuestionBank";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { loadPracticeYearRange, saveQuizSettings, type PracticeYearRange } from "@/lib/storage";
import type { QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

export default function StartPage() {
  const router = useRouter();
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [excludeAiGenerated, setExcludeAiGenerated] = useState(true);
  const [includeSeasonalLimited, setIncludeSeasonalLimited] = useState(false);
  const seasonalLimitedQuestions = useMemo(() => getSeasonalLimitedQuestions(), []);
  const availableYears = useMemo(
    () =>
      Array.from(
        new Set(
          selectableSubjects
            .flatMap((item) => item.questions.map((question) => question.sourceYear))
            .filter((year): year is number => typeof year === "number")
        )
      ).sort((a, b) => a - b),
    []
  );
  const defaultPracticeYearRange = useMemo<PracticeYearRange>(
    () => ({
      yearFrom: availableYears[0] ?? 100,
      yearTo: availableYears[availableYears.length - 1] ?? 115
    }),
    [availableYears]
  );
  const [practiceYearRange, setPracticeYearRange] = useState<PracticeYearRange>(defaultPracticeYearRange);
  const seasonalDeadline = new Date("2026-05-15T09:00:00+08:00");
  const seasonalAvailable = new Date() < seasonalDeadline;

  useEffect(() => {
    setPracticeYearRange(loadPracticeYearRange(defaultPracticeYearRange) ?? defaultPracticeYearRange);
  }, [defaultPracticeYearRange]);

  const availableQuestionCount = useMemo(() => {
    const subjectQuestionPool = selectedSubjects.length > 0
      ? selectableSubjects
          .filter((item) => selectedSubjects.includes(item.subject))
          .flatMap((item) => item.questions)
      : [];

    const filteredSubjectQuestions = subjectQuestionPool.filter((question) => {
      if (excludeAiGenerated && question.sourceType === "AI_GENERATED") return false;
      if (
        typeof question.sourceYear === "number" &&
        (question.sourceYear < practiceYearRange.yearFrom || question.sourceYear > practiceYearRange.yearTo)
      ) {
        return false;
      }
      return true;
    });

    const seasonalQuestions = includeSeasonalLimited
      ? seasonalLimitedQuestions.filter((question) => {
          if (excludeAiGenerated && question.sourceType === "AI_GENERATED") return false;
          if (
            typeof question.sourceYear === "number" &&
            (question.sourceYear < practiceYearRange.yearFrom || question.sourceYear > practiceYearRange.yearTo)
          ) {
            return false;
          }
          return true;
        })
      : [];

    return new Set(
      [...filteredSubjectQuestions, ...seasonalQuestions].map((question) => question.id)
    ).size;
  }, [
    excludeAiGenerated,
    includeSeasonalLimited,
    practiceYearRange.yearFrom,
    practiceYearRange.yearTo,
    seasonalLimitedQuestions,
    selectedSubjects
  ]);

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function renderSubjectGroup(
    title: string,
    subjects: typeof selectableSubjects
  ) {
    return (
      <section className="surface-card-muted p-5">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-ink">{title}</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const active = selectedSubjects.includes(subject.subject);
            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleSubject(subject.subject)}
                className={`rounded-[1.6rem] border p-4 text-left transition ${
                  active
                    ? "border-brand-400 bg-white shadow-card ring-1 ring-brand-200"
                    : "border-slate-200/80 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-ink sm:text-lg">{subject.label}</h3>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {subject.questions.length} 題
                    </span>
                  </div>
                  {active ? (
                    <span className="shrink-0 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      已選
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function handleStart() {
    if ((selectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0) return;

    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      questionCount: 10,
      yearFrom: practiceYearRange.yearFrom,
      yearTo: practiceYearRange.yearTo,
      subjectFilter:
        selectedSubjects.length === 1 && !includeSeasonalLimited ? selectedSubjects[0] : "全部",
      subjectFilters: selectedSubjects,
      excludeAiGenerated,
      customQuestionIds: includeSeasonalLimited
        ? seasonalLimitedQuestions
            .filter((question) => !excludeAiGenerated || question.sourceType !== "AI_GENERATED")
            .map((question) => question.id)
        : undefined,
      customPoolLabel: includeSeasonalLimited ? "季節限定" : undefined,
      chapter: undefined,
      section: undefined
    };

    saveQuizSettings(nextSettings);
    router.push("/quiz?new=1");
  }

  return (
    <main className="shell">
      <section className="surface-card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Start</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="display-title text-4xl sm:text-5xl">先選抽哪些科</h1>
              <Link
                href="/"
                className="secondary-pill min-h-10 shrink-0 px-3 py-2 sm:hidden"
              >
                返回首頁
              </Link>
            </div>
            <p className="body-soft mt-3 max-w-2xl text-sm leading-7 sm:text-base">
              可以只勾一科，也可以混著抽。年份範圍只會影響抽題池，每次開始測驗仍固定 10 題。
            </p>
          </div>
          <Link
            href="/"
            className="secondary-pill hidden sm:inline-flex"
          >
            返回首頁
          </Link>
        </div>

        <div className="mt-6 space-y-6">
          {renderSubjectGroup("醫學一", med1Subjects)}
          {renderSubjectGroup("醫學二", med2Subjects)}
          {seasonalAvailable ? (
            <section className="rounded-[2rem] border border-amber-200 bg-[rgba(255,247,232,0.9)] p-5">
              <div>
                <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-ink">季節限定</h2>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIncludeSeasonalLimited((current) => !current)}
                  className={`w-full rounded-[1.6rem] border p-5 text-left transition ${
                    includeSeasonalLimited
                      ? "border-amber-500 bg-amber-100 ring-2 ring-amber-200"
                      : "border-amber-200 bg-white hover:bg-amber-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-ink">生理學・生殖範圍</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        includeSeasonalLimited
                          ? "bg-amber-600 text-white"
                          : "bg-white text-slate-500 ring-1 ring-slate-200"
                      }`}
                    >
                      {includeSeasonalLimited ? "已選擇" : "未選"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{seasonalLimitedQuestions.length} 題</p>
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="surface-card-muted mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            已選 <span className="font-semibold text-ink">{selectedSubjects.length + (includeSeasonalLimited ? 1 : 0)}</span> 個範圍・
            {practiceYearRange.yearFrom} 到 {practiceYearRange.yearTo} 年共{" "}
            <span className="font-semibold text-ink">{availableQuestionCount}</span> 題
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedSubjects(selectableSubjects.map((item) => item.subject))}
              className="secondary-pill bg-white px-4 py-3"
            >
              全選
            </button>
            <button
              type="button"
              onClick={() => setExcludeAiGenerated((current) => !current)}
              className={`min-h-12 rounded-full px-4 py-3 text-sm font-semibold transition ${
                excludeAiGenerated
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {excludeAiGenerated ? "排除 AI 題：開" : "排除 AI 題：關"}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={(selectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0}
              className="primary-pill disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              開始 10 題測驗
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
