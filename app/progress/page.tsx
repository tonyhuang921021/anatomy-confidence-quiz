"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  QuestionOrderModeControl,
  useQuestionOrderMode
} from "@/components/QuestionOrderModeControl";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import {
  completionStatusClasses,
  getCompletionStatusLabel
} from "@/lib/completionStatusDisplay";
import {
  buildProgressBlocks,
  calculateProgressMetrics,
  getProgressStatus,
  type ProgressBlock
} from "@/lib/progressMetrics";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { loadCompletedHistorySessionsForUser } from "@/lib/storage";
import {
  buildWeaknessPracticeSettings,
  buildWeaknessQuestionOrder
} from "@/lib/weaknessAnalysis";
import type { Attempt, CompletionStatus, SubjectName } from "@/types/quiz";

type ProgressHistorySession = {
  id: string;
  attempts: Attempt[];
};

type SubjectProgress = {
  subject: SubjectName;
  label: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  completionRate: number;
  correctRate: number;
  status: CompletionStatus;
  blocks: ProgressBlock[];
};

type GroupProgress = {
  key: "med1" | "med2";
  label: string;
  description: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  completionRate: number;
  correctRate: number;
  status: CompletionStatus;
  subjects: SubjectProgress[];
};

function getRemainingQuestions(item: { totalQuestionsInBank: number; attemptedQuestions: number }) {
  return Math.max(0, item.totalQuestionsInBank - item.attemptedQuestions);
}

function calculateSubjectProgress(subject: SubjectName, sessions: ProgressHistorySession[]): SubjectProgress {
  const subjectItem = subjectRegistry[subject];
  const trackableQuestions = subjectItem.questions.filter((question) => question.sourceType !== "AI_GENERATED");
  const questionMap = new Map(trackableQuestions.map((question) => [question.id, question] as const));
  const attempts = sessions
    .flatMap((session) => session.attempts)
    .filter((attempt) => questionMap.has(attempt.questionId));

  const metrics = calculateProgressMetrics(new Set(trackableQuestions.map((question) => question.id)), attempts);

  return {
    subject,
    label: subjectItem.label,
    ...metrics,
    status: getProgressStatus(metrics.completionRate, metrics.correctRate),
    blocks: buildProgressBlocks(trackableQuestions, attempts)
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
  const completionRate =
    totalQuestionsInBank === 0 ? 0 : Math.round((attemptedQuestions / totalQuestionsInBank) * 1000) / 10;
  const correctRate =
    totalAttempts === 0 ? 0 : Math.round((correctAttempts / totalAttempts) * 1000) / 10;

  return {
    key,
    label,
    description,
    totalQuestionsInBank,
    attemptedQuestions,
    totalAttempts,
    correctAttempts,
    completionRate,
    correctRate,
    status: getProgressStatus(completionRate, correctRate),
    subjects
  };
}

export default function ProgressPage() {
  const router = useRouter();
  const { user, syncVersion } = useAuth();
  const cloudHistoryHydrating = useCloudHistoryHydration();
  const [sessions, setSessions] = useState<ProgressHistorySession[]>([]);
  const [historyOwnerKey, setHistoryOwnerKey] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ med1: true, med2: true });
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const { mode: questionOrderMode, setMode: setQuestionOrderMode, prioritizeUnseen } =
    useQuestionOrderMode();
  const activeHistoryOwnerKey = user?.id ?? "__guest__";

  useEffect(() => {
    const refreshSessions = () => {
      setSessions(
        loadCompletedHistorySessionsForUser(user?.id).map((session, index) => ({
          id: "id" in session ? session.id : `progress-history-${index}`,
          attempts: session.attempts
        }))
      );
      setHistoryOwnerKey(activeHistoryOwnerKey);
    };

    refreshSessions();
    window.addEventListener("completed-sessions-change", refreshSessions);
    window.addEventListener("completed-question-history-change", refreshSessions);
    window.addEventListener("storage", refreshSessions);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshSessions);
      window.removeEventListener("completed-question-history-change", refreshSessions);
      window.removeEventListener("storage", refreshSessions);
    };
  }, [activeHistoryOwnerKey, syncVersion, user?.id]);

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

  const localHistoryReady = historyOwnerKey === activeHistoryOwnerKey;
  const showHistoryLoading =
    !localHistoryReady || Boolean(user?.id && cloudHistoryHydrating && sessions.length === 0);

  function startBlockPractice(subject: SubjectName, block: ProgressBlock) {
    const practiceLabel =
      block.fullLabel === subject ? `${subject}－尚未細分` : block.fullLabel;
    const questionOrder = buildWeaknessQuestionOrder({
      questions: subjectRegistry[subject].questions,
      sessions,
      subject,
      primaryTag: practiceLabel,
      questionIds: block.questionIds,
      prioritizeUnseen
    });
    if (questionOrder.length === 0) return;

    router.push(
      buildNewQuizHref(
        buildWeaknessPracticeSettings({
          subject,
          primaryTag: practiceLabel,
          questionOrder,
          customPoolLabel: `進度區塊：${practiceLabel}`
        })
      )
    );
  }

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="workspace-page-kicker">進度</p>
            <h1 className="workspace-page-title">醫學一／醫學二進度總覽</h1>
            <p className="mt-3 text-slate-500">
              先看醫學一與醫學二，再往下看各科進度。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/progress/weakness"
              className="min-h-12 rounded-2xl bg-brand-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              弱點分析
            </Link>
          </div>
        </div>

        <QuestionOrderModeControl
          mode={questionOrderMode}
          onChange={setQuestionOrderMode}
          className="mt-6 border-y border-slate-100 py-5"
        />

        {showHistoryLoading ? (
          <div className="mt-6 rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
            正在讀取完整作答紀錄，完成後會更新進度總覽。
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <article key={group.key} className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{group.label}</p>
                    <p className="mt-2 text-3xl font-bold text-ink">{group.completionRate}%</p>
                    <p className="mt-2 text-sm text-slate-600">{group.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completionStatusClasses[group.status]}`}>
                    {getCompletionStatusLabel(group.status)}
                  </span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400"
                    style={{ width: `${group.completionRate}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    已作答 <span className="font-semibold">{group.attemptedQuestions}</span> / {group.totalQuestionsInBank}
                    <span className="mt-1 block text-xs text-slate-500">剩 {getRemainingQuestions(group)} 題</span>
                  </p>
                  <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                    答對率 <span className="font-semibold">{group.totalAttempts > 0 ? `${group.correctRate}%` : "尚未作答"}</span>
                    <span className="mt-1 block text-xs text-slate-500">共 {group.totalAttempts} 次作答</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showHistoryLoading ? null : (
        <>
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
                        完成度 {group.completionRate}% ・ 答對率 {group.totalAttempts > 0 ? `${group.correctRate}%` : "尚未作答"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-700">{isGroupOpen ? "收合" : "展開"}</span>
                  </button>

                  {isGroupOpen ? (
                    <div className="mt-5 space-y-4">
                      {group.subjects.map((subject) => {
                        const isSubjectOpen = Boolean(openSubjects[subject.subject]);
                        return (
                          <article key={subject.subject} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenSubjects((current) => ({
                                  ...current,
                                  [subject.subject]: !current[subject.subject]
                                }))
                              }
                              className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-slate-100"
                              aria-expanded={isSubjectOpen}
                            >
                              <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-ink">{subject.label}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                  完成度 {subject.completionRate}% ・ 已作答 {subject.attemptedQuestions} / {subject.totalQuestionsInBank}
                                  ・ 答對率 {subject.totalAttempts > 0 ? `${subject.correctRate}%` : "尚未作答"}
                                </p>
                                <p className="mt-1 text-xs font-medium text-brand-700">
                                  {isSubjectOpen ? "收合區塊" : `查看 ${subject.blocks.length} 個區塊`}
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${completionStatusClasses[subject.status]}`}>
                                {getCompletionStatusLabel(subject.status)}
                              </span>
                            </button>

                            {isSubjectOpen ? (
                              <div className="border-t border-slate-200 bg-white px-4 pb-2">
                                <div className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_7rem_3rem] gap-4 border-b border-slate-100 py-3 text-xs font-semibold text-slate-500 md:grid">
                                  <span>區塊</span>
                                  <span>已作答</span>
                                  <span>完成度</span>
                                  <span>答對率</span>
                                  <span className="sr-only">做題</span>
                                </div>
                                {subject.blocks.map((block) => (
                                  <div
                                    key={block.key}
                                    className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2 border-b border-slate-100 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem_3rem] md:items-center md:gap-4"
                                  >
                                    <p className="min-w-0 font-semibold text-ink">{block.label}</p>
                                    <p className="hidden text-sm text-slate-600 md:block">
                                      {block.attemptedQuestions} / {block.totalQuestionsInBank}
                                    </p>
                                    <p className="hidden text-sm text-slate-600 md:block">
                                      {block.completionRate}%
                                    </p>
                                    <p className="hidden text-sm text-slate-600 md:block">
                                      {block.totalAttempts > 0 ? `${block.correctRate}%` : "尚未作答"}
                                    </p>
                                    <p className="col-span-2 text-sm leading-6 text-slate-600 md:hidden">
                                      已作答 {block.attemptedQuestions} / {block.totalQuestionsInBank}
                                      ・ 完成度 {block.completionRate}%
                                      ・ 答對率 {block.totalAttempts > 0 ? `${block.correctRate}%` : "尚未作答"}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => startBlockPractice(subject.subject, block)}
                                      className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:col-start-5"
                                      aria-label={`開始做${subject.label}的${block.label}題目`}
                                      title="開始做這個區塊"
                                    >
                                      <span aria-hidden="true">▶</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
