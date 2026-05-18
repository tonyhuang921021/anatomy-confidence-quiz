"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import { getSeasonalLimitedQuestions } from "@/data/med1QuestionBank";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import { saveQuizSettings } from "@/lib/storage";
import type { QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

export default function StartPage() {
  const router = useRouter();
  const defaultSubjects = useMemo(
    () => selectableSubjects.slice(0, 1).map((item) => item.subject),
    []
  );
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>(defaultSubjects);
  const [excludeAiGenerated, setExcludeAiGenerated] = useState(true);
  const [includeSeasonalLimited, setIncludeSeasonalLimited] = useState(false);
  const seasonalLimitedQuestions = useMemo(() => getSeasonalLimitedQuestions(), []);
  const seasonalDeadline = new Date("2026-05-15T09:00:00+08:00");
  const seasonalAvailable = new Date() < seasonalDeadline;

  function toggleSubject(subject: SubjectName) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function renderSubjectGroup(
    title: string,
    description: string,
    subjects: typeof selectableSubjects
  ) {
    return (
      <section className="rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-100">
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const active = selectedSubjects.includes(subject.subject);
            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleSubject(subject.subject)}
                className={`rounded-3xl border p-5 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">{subject.label}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-500 ring-1 ring-slate-200"
                    }`}
                  >
                    {active ? "已選擇" : "未選"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{subject.questions.length} 題已上線</p>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function handleStart() {
    if (selectedSubjects.length === 0 && !includeSeasonalLimited) return;

    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      questionCount: 10,
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
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Quick Start
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">先選想抽哪些科</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              這裡會直接開始一輪 10 題。你可以只勾一科，也可以混合多科一起抽。
            </p>
          </div>
          <Link
            href="/"
            className="min-h-12 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            返回首頁
          </Link>
        </div>

        <div className="mt-6 space-y-6">
          {renderSubjectGroup(
            "醫學（一）科目",
            "先修基礎科目集中在這裡：解剖、組織、胚胎、生理、生化。",
            med1Subjects
          )}
          {renderSubjectGroup(
            "醫學（二）科目",
            "臨床前後段常一起刷的科目集中在這裡：微免、寄生蟲、公衛、藥理、病理。",
            med2Subjects
          )}
          {seasonalAvailable ? (
            <section className="rounded-[2rem] bg-amber-50 p-5 ring-1 ring-amber-200">
              <div>
                <h2 className="text-xl font-semibold text-ink">季節限定（到 5/15 早上 9 點）</h2>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  只收錄生理學裡和生殖範圍有關的題目。可以單獨勾，也可以和其他科一起抽。
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIncludeSeasonalLimited((current) => !current)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
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
                  <p className="mt-3 text-sm text-slate-600">
                    {seasonalLimitedQuestions.length} 題已收錄
                  </p>
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            目前將抽取 <span className="font-semibold text-ink">{selectedSubjects.length + (includeSeasonalLimited ? 1 : 0)}</span> 個範圍，
            共 <span className="font-semibold text-ink">10 題</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedSubjects(selectableSubjects.map((item) => item.subject))}
              className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100"
            >
              全選
            </button>
            <button
              type="button"
              onClick={() => setExcludeAiGenerated((current) => !current)}
              className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                excludeAiGenerated
                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                  : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {excludeAiGenerated ? "不做 AI 題：已開啟" : "不做 AI 題"}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={selectedSubjects.length === 0 && !includeSeasonalLimited}
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              開始 10 題測驗
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
