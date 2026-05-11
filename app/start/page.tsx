"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
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
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));

  function startSingleSubject(subject: SubjectName) {
    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      questionCount: 10,
      subjectFilter: subject,
      subjectFilters: [subject],
      chapter: undefined,
      section: undefined
    };

    saveQuizSettings(nextSettings);
    router.push("/quiz?new=1");
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
          {subjects.map((subject) => (
            <article
              key={subject.subject}
              className="rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink">{subject.label}</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {subject.questions.length} 題
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">直接開始這一科的 10 題練習。</p>

              <button
                type="button"
                onClick={() => startSingleSubject(subject.subject)}
                className="mt-4 min-h-12 w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                開始 {subject.label} 10 題
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              Quick Start
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">選科後直接開始 10 題</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              這裡不再做混刷設定。每一個科目都可以直接開始該科 10 題。
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
            "解剖、組織、胚胎、生理、生化。",
            med1Subjects
          )}
          {renderSubjectGroup(
            "醫學（二）科目",
            "微免、寄生蟲、公衛、藥理、病理。",
            med2Subjects
          )}
        </div>
      </section>
    </main>
  );
}
