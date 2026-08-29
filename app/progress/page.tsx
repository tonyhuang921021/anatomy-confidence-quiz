"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import {
  buildProgressBlocks,
  calculateProgressMetrics,
  type ProgressBlock
} from "@/lib/progressMetrics";
import { buildProgressPracticeHref } from "@/lib/progressPractice";
import { loadCompletedHistorySessionsForUser } from "@/lib/storage";
import type { Attempt, SubjectName } from "@/types/quiz";

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
  blocks: ProgressBlock[];
};

type GroupProgress = {
  key: "med1" | "med2";
  label: string;
  totalQuestionsInBank: number;
  attemptedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  completionRate: number;
  correctRate: number;
  subjects: SubjectProgress[];
};

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
    blocks: buildProgressBlocks(trackableQuestions, attempts)
  };
}

function aggregateGroup(
  key: "med1" | "med2",
  label: string,
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
    totalQuestionsInBank,
    attemptedQuestions,
    totalAttempts,
    correctAttempts,
    completionRate,
    correctRate,
    subjects
  };
}

export default function ProgressPage() {
  const { user, syncVersion } = useAuth();
  const cloudHistoryHydrating = useCloudHistoryHydration();
  const [sessions, setSessions] = useState<ProgressHistorySession[]>([]);
  const [historyOwnerKey, setHistoryOwnerKey] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ med1: false, med2: false });
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
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
      aggregateGroup("med1", "醫學（一）", med1Progress),
      aggregateGroup("med2", "醫學（二）", med2Progress)
    ],
    [med1Progress, med2Progress]
  );

  const localHistoryReady = historyOwnerKey === activeHistoryOwnerKey;
  const showHistoryLoading =
    !localHistoryReady || Boolean(user?.id && cloudHistoryHydrating && sessions.length === 0);

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel workspace-page-header p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="workspace-page-kicker">進度</p>
            <h1 className="workspace-page-title">醫學一／醫學二進度總覽</h1>
            <p className="mt-3 text-slate-500">
              先選醫學一或醫學二，再展開科目與章節。
            </p>
          </div>
          <div className="workspace-compact-actions">
            <Link
              href="/progress/weakness"
              className="border border-brand-200 bg-white text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              弱點分析
            </Link>
          </div>
        </div>
      </section>

      {showHistoryLoading ? (
        <div className="workspace-empty-state mt-4" aria-live="polite">
          正在讀取完整作答紀錄，完成後會更新進度總覽。
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((group) => {
            const isGroupOpen = openGroups[group.key];
            const groupRegionId = `progress-group-${group.key}`;
            return (
              <section key={group.key} className="workspace-section progress-subject-group">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.key]: !current[group.key]
                    }))
                  }
                  className="flex w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                  aria-expanded={isGroupOpen}
                  aria-controls={groupRegionId}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-xl font-semibold text-ink">{group.label}</h2>
                      <strong className="text-sm tabular-nums text-brand-700">{group.completionRate}% 完成</strong>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      已作答 {group.attemptedQuestions} / {group.totalQuestionsInBank}
                      ・答對率 {group.totalAttempts > 0 ? `${group.correctRate}%` : "尚無資料"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-brand-700">
                    {isGroupOpen ? "收合" : `查看 ${group.subjects.length} 科`}
                  </span>
                </button>

                {isGroupOpen ? (
                  <div id={groupRegionId} className="progress-subject-list">
                    {group.subjects.map((subject) => {
                      const isSubjectOpen = Boolean(openSubjects[subject.subject]);
                      const subjectRegionId = `progress-subject-${group.key}-${subject.subject.replace(/[^A-Za-z0-9\u4e00-\u9fff_-]/g, "-")}`;
                      return (
                        <article key={subject.subject} className="progress-subject-row">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubjects((current) => ({
                                ...current,
                                [subject.subject]: !current[subject.subject]
                              }))
                            }
                            className="flex w-full items-start justify-between gap-4 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                            aria-expanded={isSubjectOpen}
                            aria-controls={subjectRegionId}
                          >
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-ink sm:text-lg">{subject.label}</h3>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                已作答 {subject.attemptedQuestions} / {subject.totalQuestionsInBank}
                                ・答對率 {subject.totalAttempts > 0 ? `${subject.correctRate}%` : "尚無資料"}
                              </p>
                            </div>
                            <span className="shrink-0 pt-0.5 text-xs font-semibold text-brand-700">
                              {isSubjectOpen ? "收合" : `${subject.blocks.length} 章節`}
                            </span>
                          </button>

                          {isSubjectOpen ? (
                            <div id={subjectRegionId} className="border-t border-slate-200 bg-white px-4 pb-2">
                              <div className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_5.5rem] gap-4 border-b border-slate-100 py-3 text-xs font-semibold text-slate-500 md:grid">
                                <span>章節／考點</span>
                                <span>已作答</span>
                                <span>答對率</span>
                                <span className="sr-only">做題</span>
                              </div>
                              {subject.blocks.map((block) => (
                                <div
                                  key={block.key}
                                  className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 border-b border-slate-100 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_9rem_7rem_5.5rem] md:items-center md:gap-4"
                                >
                                  <p className="min-w-0 font-semibold text-ink">{block.label}</p>
                                  <p className="hidden text-sm text-slate-600 md:block">
                                    {block.attemptedQuestions} / {block.totalQuestionsInBank}
                                  </p>
                                  <p className="hidden text-sm text-slate-600 md:block">
                                    {block.totalAttempts > 0 ? `${block.correctRate}%` : "尚無資料"}
                                  </p>
                                  <p className="col-span-2 text-sm leading-6 text-slate-600 md:hidden">
                                    已作答 {block.attemptedQuestions} / {block.totalQuestionsInBank}
                                    ・答對率 {block.totalAttempts > 0 ? `${block.correctRate}%` : "尚無資料"}
                                  </p>
                                  <Link
                                    href={buildProgressPracticeHref(subject.subject, block.fullLabel)}
                                    className="col-start-2 row-start-1 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 md:col-start-4"
                                    aria-label={`前往設定${subject.label}的${block.label}練習`}
                                    title="前往設定這個章節的年份、題數與順序"
                                  >
                                    <Play size={14} fill="currentColor" aria-hidden="true" />
                                    練習
                                  </Link>
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
      )}
    </main>
  );
}
