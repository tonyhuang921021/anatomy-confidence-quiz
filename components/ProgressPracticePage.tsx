"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ProgressPracticeSetup } from "@/components/ProgressPracticeSetup";
import { useQuestionOrderMode } from "@/components/QuestionOrderModeControl";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { subjectRegistry } from "@/data/subjectRegistry";
import {
  getPracticeQuestionCountPreference,
  getPracticeYearRangePreference
} from "@/lib/accountPreferences";
import { buildProgressBlocks } from "@/lib/progressMetrics";
import {
  buildProgressPracticeSettings,
  getProgressPracticeQuestionIds,
  type ProgressPracticeQuestionCount,
  type ProgressPracticeYearRange
} from "@/lib/progressPractice";
import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  normalizePracticeYearRange
} from "@/lib/practiceYears";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import {
  loadCompletedHistorySessionsForUser,
  loadPracticeQuestionCount,
  loadPracticeYearRange,
  savePracticeQuestionCount,
  savePracticeYearRange
} from "@/lib/storage";
import type { Attempt, QuizSession, SubjectName } from "@/types/quiz";

type ProgressPracticePageProps = {
  subjectParam?: string;
  primaryTagParam?: string;
};

type ProgressPracticeHistorySession = Pick<QuizSession, "id" | "attempts">;

const DEFAULT_YEAR_RANGE: ProgressPracticeYearRange = {
  yearFrom: MIN_PRACTICE_SOURCE_YEAR,
  yearTo: MAX_PRACTICE_SOURCE_YEAR
};

function resolveSubject(value?: string): SubjectName | null {
  if (!value || !Object.prototype.hasOwnProperty.call(subjectRegistry, value)) return null;
  if (value === "醫學（一）" || value === "醫學（二）") return null;
  return value as SubjectName;
}

export function ProgressPracticePage({
  subjectParam,
  primaryTagParam
}: ProgressPracticePageProps) {
  const router = useRouter();
  const { user, syncVersion } = useAuth();
  const cloudHistoryHydrating = useCloudHistoryHydration();
  const { mode: orderMode, setMode: setOrderMode, prioritizeUnseen } = useQuestionOrderMode();
  const [sessions, setSessions] = useState<ProgressPracticeHistorySession[]>([]);
  const [historyOwnerKey, setHistoryOwnerKey] = useState<string | null>(null);
  const [yearRange, setYearRange] = useState<ProgressPracticeYearRange>(DEFAULT_YEAR_RANGE);
  const [questionCount, setQuestionCount] = useState<ProgressPracticeQuestionCount>(10);
  const subject = resolveSubject(subjectParam);
  const activeHistoryOwnerKey = user?.id ?? "__guest__";

  useEffect(() => {
    const refreshSessions = () => {
      setSessions(
        loadCompletedHistorySessionsForUser(user?.id).map((session, index) => ({
          id: "id" in session ? session.id : `progress-practice-history-${index}`,
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

  useEffect(() => {
    const storedRange = user
      ? getPracticeYearRangePreference(user.user_metadata)
      : loadPracticeYearRange(DEFAULT_YEAR_RANGE);
    const storedCount = user
      ? getPracticeQuestionCountPreference(user.user_metadata, 10)
      : loadPracticeQuestionCount(10);

    setYearRange(normalizePracticeYearRange(storedRange ?? DEFAULT_YEAR_RANGE));
    setQuestionCount(storedCount);
  }, [user?.id, user?.user_metadata]);

  const trackableQuestions = useMemo(
    () => subject
      ? subjectRegistry[subject].questions.filter((question) => question.sourceType !== "AI_GENERATED")
      : [],
    [subject]
  );
  const questionIds = useMemo(
    () => new Set(trackableQuestions.map((question) => question.id)),
    [trackableQuestions]
  );
  const relevantAttempts = useMemo<Attempt[]>(
    () => sessions.flatMap((session) => session.attempts).filter((attempt) => questionIds.has(attempt.questionId)),
    [questionIds, sessions]
  );
  const blocks = useMemo(
    () => buildProgressBlocks(trackableQuestions, relevantAttempts),
    [relevantAttempts, trackableQuestions]
  );
  const block = blocks.find((item) => item.fullLabel === primaryTagParam) ?? null;
  const normalizedYearRange = useMemo(() => normalizePracticeYearRange(yearRange), [yearRange]);
  const availableQuestionIds = useMemo(
    () => getProgressPracticeQuestionIds({
      questions: trackableQuestions,
      questionIds: block?.questionIds ?? [],
      yearRange: normalizedYearRange
    }),
    [block?.questionIds, normalizedYearRange, trackableQuestions]
  );
  const localHistoryReady = historyOwnerKey === activeHistoryOwnerKey;
  const showHistoryLoading =
    !localHistoryReady || Boolean(user?.id && cloudHistoryHydrating && sessions.length === 0);

  function handleYearRangeChange(nextRange: ProgressPracticeYearRange) {
    const normalized = normalizePracticeYearRange(nextRange);
    setYearRange(normalized);
    savePracticeYearRange(normalized);
    if (!user) return;

    void getSupabaseBrowserClient().auth.updateUser({
      data: {
        ...user.user_metadata,
        practice_year_from: normalized.yearFrom,
        practice_year_to: normalized.yearTo
      }
    }).then(({ error }) => {
      if (error) console.error("Practice year preference sync skipped:", error);
    }).catch((error) => {
      console.error("Practice year preference sync skipped:", error);
    });
  }

  function handleQuestionCountChange(nextCount: ProgressPracticeQuestionCount) {
    setQuestionCount(nextCount);
    if (nextCount === "all") return;
    savePracticeQuestionCount(nextCount);
    if (!user) return;

    void getSupabaseBrowserClient().auth.updateUser({
      data: {
        ...user.user_metadata,
        practice_question_count: nextCount
      }
    }).then(({ error }) => {
      if (error) console.error("Practice question count sync skipped:", error);
    }).catch((error) => {
      console.error("Practice question count sync skipped:", error);
    });
  }

  function handleStart() {
    if (!subject || !block) return;
    const practiceLabel = block.fullLabel === subject
      ? `${subject}－尚未細分`
      : block.fullLabel;
    const settings = buildProgressPracticeSettings({
      questions: trackableQuestions,
      sessions,
      subject,
      primaryTag: practiceLabel,
      questionIds: block.questionIds,
      yearRange: normalizedYearRange,
      questionCount,
      prioritizeUnseen,
      customPoolLabel: `進度章節：${practiceLabel}`
    });
    if (!settings) return;
    router.push(buildNewQuizHref(settings));
  }

  const label = subject && block
    ? `${subjectRegistry[subject].label}－${block.label}`
    : "章節練習";

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="surface-card workspace-page-panel p-5 sm:p-7">
        <Link
          href="/progress"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          返回進度總覽
        </Link>

        <div className="mt-6">
          <p className="workspace-page-kicker">章節練習</p>
          <h1 className="workspace-page-title mt-1">{label}</h1>
          <p className="mt-3 text-slate-500">先選年份、題數與順序，確認後再開始。</p>
        </div>

        {showHistoryLoading ? (
          <div className="workspace-empty-state mt-6">正在整理章節題目與作答紀錄。</div>
        ) : subject && block ? (
          <div className="mt-6">
            <ProgressPracticeSetup
              idPrefix={`progress-practice-${block.key}`}
              label={label}
              availableQuestionCount={availableQuestionIds.length}
              questionCount={questionCount}
              yearRange={normalizedYearRange}
              orderMode={orderMode}
              onQuestionCountChange={handleQuestionCountChange}
              onYearRangeChange={handleYearRangeChange}
              onOrderModeChange={setOrderMode}
              onStart={handleStart}
            />
          </div>
        ) : (
          <div className="workspace-empty-state mt-6">
            <p className="font-semibold text-ink">找不到這個章節。</p>
            <p className="mt-2 text-sm text-slate-500">請回到進度總覽重新選擇。</p>
          </div>
        )}
      </section>
    </main>
  );
}
