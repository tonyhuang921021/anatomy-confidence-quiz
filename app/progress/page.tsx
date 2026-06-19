"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import { loadCompletedSessions } from "@/lib/storage";
import type { Attempt, CompletionStatus, QuizSession, SubjectName } from "@/types/quiz";

type SectionProgress = {
  chapter: string;
  section: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
  status: CompletionStatus;
  lastAttemptedAt?: string;
};

type SubjectProgress = {
  subject: SubjectName;
  label: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  confidenceTotal: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
  status: CompletionStatus;
  sections: SectionProgress[];
};

type GroupProgress = {
  key: "med1" | "med2";
  label: string;
  description: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  completionRate: number;
  correctRate: number;
  averageConfidence: number;
  masteryScore: number;
  status: CompletionStatus;
  subjects: SubjectProgress[];
};

const statusClasses: Record<CompletionStatus, string> = {
  未開始: "bg-slate-100 text-slate-700",
  進行中: "bg-sky-100 text-sky-800",
  已完成但不穩: "bg-amber-100 text-amber-900",
  已完成且穩定: "bg-emerald-100 text-emerald-800"
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function getStatus(completionRate: number, masteryScore: number): CompletionStatus {
  if (completionRate === 0) return "未開始";
  if (completionRate < 80) return "進行中";
  if (masteryScore < 70) return "已完成但不穩";
  return "已完成且穩定";
}

function formatTime(value?: string) {
  if (!value) return "尚未作答";
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function calculateSectionProgress(
  questionIds: Set<string>,
  attempts: Attempt[],
  chapter: string,
  section: string
): SectionProgress {
  const sectionAttempts = attempts.filter((attempt) => questionIds.has(attempt.questionId));
  const attemptedQuestions = new Set(sectionAttempts.map((attempt) => attempt.questionId)).size;
  const completionRate =
    questionIds.size === 0 ? 0 : round((attemptedQuestions / questionIds.size) * 100);
  const correctRate =
    sectionAttempts.length === 0
      ? 0
      : round((sectionAttempts.filter((attempt) => attempt.isCorrect).length / sectionAttempts.length) * 100);
  const averageConfidence =
    sectionAttempts.length === 0
      ? 0
      : round(
          sectionAttempts.reduce((sum, attempt) => sum + attempt.confidence, 0) / sectionAttempts.length
        );
  const masteryScore = round(
    completionRate * 0.4 + correctRate * 0.4 + (averageConfidence / 5) * 100 * 0.2
  );
  const lastAttemptedAt = sectionAttempts
    .map((attempt) => attempt.answeredAt)
    .sort()
    .at(-1);

  return {
    chapter,
    section,
    totalQuestionsInBank: questionIds.size,
    attemptedQuestions,
    completionRate,
    correctRate,
    averageConfidence,
    masteryScore,
    status: getStatus(completionRate, masteryScore),
    lastAttemptedAt
  };
}

function calculateSubjectProgress(subject: SubjectName, sessions: QuizSession[]): SubjectProgress {
  const subjectItem = subjectRegistry[subject];
  const trackableQuestions = subjectItem.questions.filter((question) => question.sourceType !== "AI_GENERATED");
  const questionMap = new Map(trackableQuestions.map((question) => [question.id, question] as const));
  const attempts = sessions
    .flatMap((session) => session.attempts)
    .filter((attempt) => questionMap.has(attempt.questionId));

  const sectionBuckets = new Map<string, Set<string>>();
  trackableQuestions.forEach((question) => {
    const key = `${question.chapter}__${question.section}`;
    const bucket = sectionBuckets.get(key) ?? new Set<string>();
    bucket.add(question.id);
    sectionBuckets.set(key, bucket);
  });

  const sections = Array.from(sectionBuckets.entries())
    .map(([key, ids]) => {
      const [chapter, section] = key.split("__");
      return calculateSectionProgress(ids, attempts, chapter, section);
    })
    .sort((a, b) => a.chapter.localeCompare(b.chapter) || a.section.localeCompare(b.section));

  const attemptedQuestions = new Set(attempts.map((attempt) => attempt.questionId)).size;
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
  const confidenceTotal = attempts.reduce((sum, attempt) => sum + attempt.confidence, 0);
  const completionRate =
    trackableQuestions.length === 0 ? 0 : round((attemptedQuestions / trackableQuestions.length) * 100);
  const correctRate =
    totalAttempts === 0 ? 0 : round((correctAttempts / totalAttempts) * 100);
  const averageConfidence =
    totalAttempts === 0 ? 0 : round(confidenceTotal / totalAttempts);
  const masteryScore = round(
    completionRate * 0.4 + correctRate * 0.4 + (averageConfidence / 5) * 100 * 0.2
  );

  return {
    subject,
    label: subjectItem.label,
    totalQuestionsInBank: trackableQuestions.length,
    attemptedQuestions,
    totalAttempts,
    correctAttempts,
    confidenceTotal,
    completionRate,
    correctRate,
    averageConfidence,
    masteryScore,
    status: getStatus(completionRate, masteryScore),
    sections
  };
}

function aggregateGroup(
  key: "med1" | "med2",
  label: string,
  description: string,
  subjects: SubjectProgress[]
): GroupProgress {
  const totalQuestionsInBank = subjects.reduce((sum, subject) => sum + subject.totalQuestionsInBank, 0);
  const attemptedQuestions = subjects.reduce((sum, subject) => sum + subject.attemptedQuestions, 0);
  const totalAttempts = subjects.reduce((sum, subject) => sum + subject.totalAttempts, 0);
  const correctAttempts = subjects.reduce((sum, subject) => sum + subject.correctAttempts, 0);
  const confidenceTotal = subjects.reduce((sum, subject) => sum + subject.confidenceTotal, 0);
  const completionRate =
    totalQuestionsInBank === 0 ? 0 : round((attemptedQuestions / totalQuestionsInBank) * 100);
  const correctRate =
    totalAttempts === 0 ? 0 : round((correctAttempts / totalAttempts) * 100);
  const averageConfidence =
    totalAttempts === 0 ? 0 : round(confidenceTotal / totalAttempts);
  const masteryScore = round(
    completionRate * 0.4 + correctRate * 0.4 + (averageConfidence / 5) * 100 * 0.2
  );

  return {
    key,
    label,
    description,
    totalQuestionsInBank,
    attemptedQuestions,
    completionRate,
    correctRate,
    averageConfidence,
    masteryScore,
    status: getStatus(completionRate, masteryScore),
    subjects
  };
}

export default function ProgressPage() {
  const { syncVersion } = useAuth();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ med1: true, med2: true });

  useEffect(() => {
    setSessions(loadCompletedSessions());
  }, [syncVersion]);

  const med1Progress = useMemo(
    () => MED1_SUBJECTS.map((subject) => calculateSubjectProgress(subject, sessions)).filter((subject) => subject.totalQuestionsInBank > 0),
    [sessions]
  );
  const med2Progress = useMemo(
    () => MED2_SUBJECTS.map((subject) => calculateSubjectProgress(subject, sessions)).filter((subject) => subject.totalQuestionsInBank > 0),
    [sessions]
  );

  const groups = useMemo(
    () => [
      aggregateGroup("med1", "醫學（一）", "解剖、組織、胚胎、生理、生化。", med1Progress),
      aggregateGroup("med2", "醫學（二）", "微免、寄生蟲、公衛、藥理、病理。", med2Progress)
    ],
    [med1Progress, med2Progress]
  );

  const allSubjects = [...med1Progress, ...med2Progress];
  const lowCompletion = [...allSubjects]
    .sort((a, b) => a.completionRate - b.completionRate || a.masteryScore - b.masteryScore)
    .slice(0, 5);
  const unstable = allSubjects
    .filter((subject) => subject.completionRate >= 80 && subject.masteryScore < 70)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 5);
  const mastered = [...allSubjects]
    .filter((subject) => subject.attemptedQuestions > 0)
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .slice(0, 5);

  return (
    <main className="shell">
      <section className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Progress Map</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">醫學一／醫學二進度總覽</h1>
            <p className="mt-3 text-slate-500">
              先看醫學一與醫學二，再往下看各科進度。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="min-h-12 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              返回首頁
            </Link>
            <Link
              href="/start"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              開始測驗
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <article key={group.key} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{group.label}</p>
                  <p className="mt-2 text-3xl font-bold text-ink">{group.completionRate}%</p>
                  <p className="mt-2 text-sm text-slate-600">{group.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[group.status]}`}>
                  {group.status}
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
                  style={{ width: `${group.completionRate}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  已作答 <span className="font-semibold">{group.attemptedQuestions}</span> / {group.totalQuestionsInBank}
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  答對率 <span className="font-semibold">{group.correctRate}%</span>
                </p>
                <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  掌握度 <span className="font-semibold">{group.masteryScore}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">完成度最低的科目</h2>
          <div className="mt-4 grid gap-3">
            {lowCompletion.map((subject) => (
              <div key={subject.subject} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">{subject.label}</p>
                <p className="mt-2">完成度 {subject.completionRate}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">已完成但不穩的科目</h2>
          <div className="mt-4 grid gap-3">
            {unstable.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">目前沒有落在這個區間的科目。</p>
            ) : (
              unstable.map((subject) => (
                <div key={subject.subject} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{subject.label}</p>
                  <p className="mt-2">掌握度 {subject.masteryScore}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-ink">掌握度最高的科目</h2>
          <div className="mt-4 grid gap-3">
            {mastered.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">還沒有足夠資料可判定。</p>
            ) : (
              mastered.map((subject) => (
                <div key={subject.subject} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{subject.label}</p>
                  <p className="mt-2">掌握度 {subject.masteryScore}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-5">
        {groups.map((group) => {
          const isGroupOpen = openGroups[group.key];
          return (
            <section key={group.key} className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-slate-100">
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.key]: !current[group.key]
                  }))
                }
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div>
                  <h2 className="text-2xl font-semibold text-ink">{group.label}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    完成度 {group.completionRate}% ・ 掌握度 {group.masteryScore}
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-700">{isGroupOpen ? "收合" : "展開"}</span>
              </button>

              {isGroupOpen ? (
                <div className="mt-5 space-y-4">
                  {group.subjects.map((subject) => (
                    <article key={subject.subject} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">{subject.label}</h3>
                          <p className="mt-2 text-sm text-slate-500">
                            已作答 {subject.attemptedQuestions} / {subject.totalQuestionsInBank} ・ 答對率 {subject.correctRate}% ・ 掌握度 {subject.masteryScore}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[subject.status]}`}>
                          {subject.status}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
