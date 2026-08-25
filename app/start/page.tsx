"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCloudHistoryHydration } from "@/components/useCloudHistoryHydration";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import { getQuestionBankBySubjects, getSeasonalLimitedQuestions } from "@/data/med1QuestionBank";
import { loadConfirmedQuestionClassificationOverrides } from "@/lib/cloudSync";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
import {
  getAllSubjectTrackKeys,
  getSubjectTrackLabels,
  getSubjectTracks,
  isTrackSubject,
  MICROBIOLOGY_SUBJECT,
  questionMatchesSubjectTracks,
  type SubjectTrackKey,
  type TrackSubject
} from "@/lib/questionTrackFilters";
import {
  loadPracticeQuestionCount,
  loadPracticeStopAfterReview,
  loadPracticeYearRange,
  loadCompletedHistorySessionsForUser,
  loadCurrentSessionForUser,
  savePracticeYearRange,
  saveQuizSettings,
  type PracticeQuestionCount,
  type PracticeYearRange
} from "@/lib/storage";
import {
  getPracticeQuestionCountPreference,
  getPracticeStopAfterReviewPreference,
  getPracticeYearRangePreference
} from "@/lib/accountPreferences";
import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  PRACTICE_YEAR_OPTIONS,
  normalizePracticeYearRange
} from "@/lib/practiceYears";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Question, QuestionClassificationOverride, QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

export default function StartPage() {
  const router = useRouter();
  const { user, syncVersion } = useAuth();
  const cloudHistoryHydrating = useCloudHistoryHydration();
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [microbiologyExpanded, setMicrobiologyExpanded] = useState(false);
  const [selectedMicrobiologyTracks, setSelectedMicrobiologyTracks] = useState<SubjectTrackKey<typeof MICROBIOLOGY_SUBJECT>[]>([]);
  const [includeSeasonalLimited, setIncludeSeasonalLimited] = useState(false);
  const seasonalLimitedQuestions = useMemo(() => getSeasonalLimitedQuestions(), []);
  const seasonalLimitedPastExamCount = useMemo(
    () => seasonalLimitedQuestions.filter((question) => question.sourceType !== "AI_GENERATED").length,
    [seasonalLimitedQuestions]
  );
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
      yearFrom: availableYears[0] ?? MIN_PRACTICE_SOURCE_YEAR,
      yearTo: availableYears[availableYears.length - 1] ?? MAX_PRACTICE_SOURCE_YEAR
    }),
    [availableYears]
  );
  const [practiceYearRange, setPracticeYearRange] = useState<PracticeYearRange>(defaultPracticeYearRange);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState<PracticeQuestionCount>(10);
  const [practiceStopAfterReview, setPracticeStopAfterReview] = useState(false);
  const [attemptedQuestionIds, setAttemptedQuestionIds] = useState<Set<string>>(() => new Set());
  const [historyOwnerKey, setHistoryOwnerKey] = useState<string | null>(null);
  const [classificationOverrides, setClassificationOverrides] = useState<Record<string, QuestionClassificationOverride>>({});
  const excludeAiGenerated = true;
  const seasonalDeadline = new Date("2026-05-15T09:00:00+08:00");
  const seasonalAvailable = new Date() < seasonalDeadline;
  const activeHistoryOwnerKey = user?.id ?? "guest";

  useEffect(() => {
    const refreshAttemptedQuestionIds = () => {
      const completedAttempts = loadCompletedHistorySessionsForUser(user?.id)
        .flatMap((session) => session.attempts ?? []);
      const currentSession = loadCurrentSessionForUser(activeHistoryOwnerKey);
      const currentAttempts = currentSession?.completedAt ? [] : currentSession?.attempts ?? [];
      setAttemptedQuestionIds(
        new Set(
          [...completedAttempts, ...currentAttempts]
            .map((attempt) => attempt.questionId)
        )
      );
      setHistoryOwnerKey(activeHistoryOwnerKey);
    };

    refreshAttemptedQuestionIds();
    window.addEventListener("completed-sessions-change", refreshAttemptedQuestionIds);
    window.addEventListener("completed-question-history-change", refreshAttemptedQuestionIds);
    window.addEventListener("current-session-change", refreshAttemptedQuestionIds);
    window.addEventListener("storage", refreshAttemptedQuestionIds);
    return () => {
      window.removeEventListener("completed-sessions-change", refreshAttemptedQuestionIds);
      window.removeEventListener("completed-question-history-change", refreshAttemptedQuestionIds);
      window.removeEventListener("current-session-change", refreshAttemptedQuestionIds);
      window.removeEventListener("storage", refreshAttemptedQuestionIds);
    };
  }, [activeHistoryOwnerKey, syncVersion, user?.id]);

  useEffect(() => {
    const accountRange = user
      ? getPracticeYearRangePreference(user.user_metadata)
      : null;
    const nextRange = accountRange ?? loadPracticeYearRange(defaultPracticeYearRange) ?? defaultPracticeYearRange;
    setPracticeYearRange(normalizePracticeYearRange(nextRange));
  }, [defaultPracticeYearRange, user?.id, user?.user_metadata]);

  useEffect(() => {
    const nextCount = user
      ? getPracticeQuestionCountPreference(user?.user_metadata, 10)
      : loadPracticeQuestionCount(10);
    const nextStopAfterReview = user
      ? getPracticeStopAfterReviewPreference(user?.user_metadata, false)
      : loadPracticeStopAfterReview(false);
    setPracticeQuestionCount(nextCount);
    setPracticeStopAfterReview(nextStopAfterReview);
  }, [user?.id, user?.user_metadata]);

  useEffect(() => {
    let cancelled = false;

    async function refreshClassificationOverrides() {
      try {
        const overrides = await loadConfirmedQuestionClassificationOverrides();
        if (!cancelled) setClassificationOverrides(overrides);
      } catch {
        if (!cancelled) setClassificationOverrides({});
      }
    }

    void refreshClassificationOverrides();

    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveSelectedSubjects = useMemo(() => {
    const baseSubjects = selectedSubjects.filter((subject) => subject !== MICROBIOLOGY_SUBJECT);

    return selectedMicrobiologyTracks.length > 0
      ? [...baseSubjects, MICROBIOLOGY_SUBJECT]
      : baseSubjects;
  }, [selectedMicrobiologyTracks.length, selectedSubjects]);

  const selectedSubjectQuestionPool = useMemo(() => {
    if (effectiveSelectedSubjects.length === 0) return [];

    const runtimeSubjectQuestions = getQuestionBankBySubjects(
      effectiveSelectedSubjects,
      classificationOverrides
    );

    if (selectedMicrobiologyTracks.length === 0 || !effectiveSelectedSubjects.includes(MICROBIOLOGY_SUBJECT)) {
      return runtimeSubjectQuestions;
    }

    return runtimeSubjectQuestions.filter((question) => {
      if (question.subject !== MICROBIOLOGY_SUBJECT) return true;
      return questionMatchesSubjectTracks(question, MICROBIOLOGY_SUBJECT, selectedMicrobiologyTracks);
    });
  }, [classificationOverrides, effectiveSelectedSubjects, selectedMicrobiologyTracks]);

  const availableQuestions = useMemo(() => {
    const filteredSubjectQuestions = selectedSubjectQuestionPool.filter((question) => {
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
    );
  }, [
    excludeAiGenerated,
    includeSeasonalLimited,
    practiceYearRange.yearFrom,
    practiceYearRange.yearTo,
    seasonalLimitedQuestions,
    selectedSubjectQuestionPool
  ]);
  const availableQuestionCount = availableQuestions.size;
  const unattemptedAvailableQuestionIds = useMemo(() => {
    const ids: string[] = [];
    availableQuestions.forEach((questionId) => {
      if (!attemptedQuestionIds.has(questionId)) ids.push(questionId);
    });
    return ids;
  }, [attemptedQuestionIds, availableQuestions]);
  const unattemptedAvailableQuestionCount = unattemptedAvailableQuestionIds.length;
  const practiceHistoryReady =
    historyOwnerKey === activeHistoryOwnerKey && !cloudHistoryHydrating;
  const effectiveQuestionCount = practiceStopAfterReview
    ? availableQuestionCount
    : Math.min(practiceQuestionCount, availableQuestionCount);
  const willFillWithSeenQuestions =
    availableQuestionCount > 0 &&
    unattemptedAvailableQuestionCount < effectiveQuestionCount;

  function toggleSubject(subject: SubjectName) {
    if (subject === MICROBIOLOGY_SUBJECT) {
      toggleTrackSubject(subject);
      return;
    }

    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function getSelectedTrackKeys(subject: TrackSubject) {
    return selectedMicrobiologyTracks;
  }

  function setSelectedTrackKeys(subject: TrackSubject, keys: string[]) {
    setSelectedMicrobiologyTracks(keys as SubjectTrackKey<typeof MICROBIOLOGY_SUBJECT>[]);
  }

  function setTrackExpanded(subject: TrackSubject, expanded: boolean | ((current: boolean) => boolean)) {
    setMicrobiologyExpanded(expanded);
  }

  function isTrackExpanded(subject: TrackSubject) {
    return microbiologyExpanded;
  }

  function toggleTrackSubject(subject: TrackSubject) {
    const allKeys = getAllSubjectTrackKeys(subject);
    const selectedKeys = getSelectedTrackKeys(subject);
    const hasAllTracks = selectedKeys.length === allKeys.length;

    setSelectedTrackKeys(subject, hasAllTracks ? [] : allKeys);
    setTrackExpanded(subject, true);
  }

  function toggleSubjectTrack(subject: TrackSubject, trackKey: string) {
    const allKeys = getAllSubjectTrackKeys(subject);
    const nextUpdater = (current: string[]) =>
      current.includes(trackKey)
        ? current.filter((item) => item !== trackKey)
        : [...current, trackKey];

    setSelectedMicrobiologyTracks((current) =>
      nextUpdater(current).filter((key): key is SubjectTrackKey<typeof MICROBIOLOGY_SUBJECT> =>
        allKeys.includes(key as never)
      )
    );
  }

  function isSubjectGroupFullySelected(subjects: typeof selectableSubjects) {
    return subjects.every((item) => {
      if (!isTrackSubject(item.subject)) return selectedSubjects.includes(item.subject);
      const selectedKeys = getSelectedTrackKeys(item.subject);
      return selectedKeys.length === getAllSubjectTrackKeys(item.subject).length;
    });
  }

  function toggleSubjectGroup(subjects: typeof selectableSubjects) {
    const isFullySelected = isSubjectGroupFullySelected(subjects);
    const groupSubjectNames = subjects.map((item) => item.subject);
    const regularSubjectNames = groupSubjectNames.filter((subject) => !isTrackSubject(subject));
    const hasMicrobiology = groupSubjectNames.includes(MICROBIOLOGY_SUBJECT);

    setSelectedSubjects((current) => {
      const withoutGroup = current.filter((subject) => !groupSubjectNames.includes(subject));
      return isFullySelected
        ? withoutGroup
        : Array.from(new Set([...withoutGroup, ...regularSubjectNames]));
    });

    if (hasMicrobiology) {
      setSelectedMicrobiologyTracks(
        isFullySelected ? [] : getAllSubjectTrackKeys(MICROBIOLOGY_SUBJECT)
      );
      setMicrobiologyExpanded(!isFullySelected);
    }
  }

  function selectAllSubjects() {
    setSelectedSubjects(
      selectableSubjects
        .map((item) => item.subject)
        .filter((subject) => subject !== MICROBIOLOGY_SUBJECT)
    );
    setSelectedMicrobiologyTracks(getAllSubjectTrackKeys(MICROBIOLOGY_SUBJECT));
    setMicrobiologyExpanded(true);
  }

  function handlePracticeYearRangeChange(nextRange: PracticeYearRange) {
    const normalized = normalizePracticeYearRange(nextRange);
    setPracticeYearRange(normalized);
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

  function renderSubjectGroup(
    title: string,
    subjects: typeof selectableSubjects
  ) {
    const groupFullySelected = isSubjectGroupFullySelected(subjects);

    return (
      <section className="quiz-setup-group">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="whitespace-nowrap font-serif text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => toggleSubjectGroup(subjects)}
            className={`min-h-9 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition sm:min-h-10 sm:text-sm ${
              groupFullySelected
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {groupFullySelected ? `取消${title}` : `全選${title}`}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 xl:grid-cols-3">
          {subjects.map((subject) => {
            const active = effectiveSelectedSubjects.includes(subject.subject);
            const trackedSubject = isTrackSubject(subject.subject) ? subject.subject : null;
            const selectedTrackKeys = trackedSubject ? getSelectedTrackKeys(trackedSubject) : [];
            const selectedTrackedQuestionCount = trackedSubject && selectedTrackKeys.length > 0
              ? subject.questions.filter(
                  (question) =>
                    question.sourceType !== "AI_GENERATED" &&
                    questionMatchesSubjectTracks(question, trackedSubject, selectedTrackKeys)
                ).length
              : null;
            const pastExamCount =
              selectedTrackedQuestionCount ??
              subject.questions.filter((question) => question.sourceType !== "AI_GENERATED").length;

            if (trackedSubject) {
              const tracks = getSubjectTracks(trackedSubject);
              const expanded = isTrackExpanded(trackedSubject);
              const selectedLabels = getSubjectTrackLabels(trackedSubject, selectedTrackKeys);

              return (
                <div
                  key={subject.subject}
                  className={`col-span-2 rounded-lg border p-3 text-left transition sm:p-4 xl:col-span-1 ${
                    active
                      ? "border-brand-400 bg-white shadow-card ring-1 ring-brand-200"
                      : "border-slate-200/80 bg-white/80 hover:bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSubject(subject.subject)}
                    className="w-full text-left"
                    aria-expanded={expanded}
                    aria-pressed={active}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-ink sm:text-lg">{subject.label}</h3>
                        <span className="mt-0.5 block text-xs font-medium tabular-nums text-slate-500">
                          {pastExamCount} 題
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          active ? "text-brand-700" : "text-slate-500"
                        }`}
                      >
                        {active ? "已選" : "全選"}
                      </span>
                    </div>
                    {active ? (
                      <p className="mt-2 text-xs font-semibold text-brand-700">
                        已選 {selectedLabels.length === tracks.length ? "全部" : selectedLabels.join("、")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">點科名全選，也可單選分類。</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTrackExpanded(trackedSubject, (current) => !current);
                    }}
                    className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                    aria-expanded={expanded}
                  >
                    {expanded ? "收合分類" : "選分類"}
                  </button>

                  {expanded ? (
                    <div className={`mt-4 grid gap-2 ${tracks.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      {tracks.map((track) => {
                        const trackActive = selectedTrackKeys.includes(track.key);
                        const trackCount = subject.questions.filter(
                          (question) =>
                            question.sourceType !== "AI_GENERATED" &&
                            questionMatchesSubjectTracks(question, trackedSubject, [track.key])
                        ).length;

                        return (
                          <button
                            key={track.key}
                            type="button"
                            onClick={() => toggleSubjectTrack(trackedSubject, track.key)}
                            className={`rounded-lg border px-3 py-3 text-center text-sm font-semibold transition ${
                              trackActive
                                ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                            }`}
                          >
                            <span className="block">{track.label}</span>
                            <span className={trackActive ? "text-white/80" : "text-slate-400"}>
                              {trackCount} 題
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <button
                key={subject.subject}
                type="button"
                onClick={() => toggleSubject(subject.subject)}
                aria-pressed={active}
                className={`rounded-lg border p-3 text-left transition sm:p-4 ${
                  active
                    ? "border-brand-400 bg-white shadow-card ring-1 ring-brand-200"
                    : "border-slate-200/80 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-h-12 flex-col justify-center gap-1 sm:min-h-14">
                  <h3 className="whitespace-nowrap text-sm font-semibold leading-snug text-ink sm:text-lg">
                    {subject.label}
                  </h3>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium tabular-nums text-slate-500">
                      {pastExamCount} 題
                    </span>
                    {active ? (
                      <span className="shrink-0 text-xs font-semibold text-brand-700">已選</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function handleStart() {
    if (
      !practiceHistoryReady ||
      (effectiveSelectedSubjects.length === 0 && !includeSeasonalLimited) ||
      availableQuestionCount === 0
    ) return;

    const hasMicrobiologyTrackFilter = selectedMicrobiologyTracks.length > 0;
    const selectedMicrobiologyLabels = getSubjectTrackLabels(MICROBIOLOGY_SUBJECT, selectedMicrobiologyTracks);
    const selectedSubjectTracks = hasMicrobiologyTrackFilter
      ? { [MICROBIOLOGY_SUBJECT]: selectedMicrobiologyTracks }
      : undefined;
    const seasonalQuestionIds = includeSeasonalLimited
      ? seasonalLimitedQuestions
          .filter((question) => !excludeAiGenerated || question.sourceType !== "AI_GENERATED")
          .map((question) => question.id)
      : undefined;
    const priorityQuestionIds =
      unattemptedAvailableQuestionIds.length > 0 && unattemptedAvailableQuestionIds.length <= 80
        ? unattemptedAvailableQuestionIds
        : undefined;

    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      questionCount: effectiveQuestionCount,
      stopAfterReview: practiceStopAfterReview,
      yearFrom: practiceYearRange.yearFrom,
      yearTo: practiceYearRange.yearTo,
      subjectFilter:
        effectiveSelectedSubjects.length === 1 && !includeSeasonalLimited ? effectiveSelectedSubjects[0] : "全部",
      subjectFilters: effectiveSelectedSubjects,
      subjectTracks: selectedSubjectTracks,
      excludeAiGenerated,
      excludePreviouslyAnswered: true,
      priorityQuestionIds,
      enableConfidenceCalibration: false,
      customQuestionIds: seasonalQuestionIds,
      strictCustomQuestionPool: false,
      customPoolLabel: hasMicrobiologyTrackFilter
        ? `開始測驗：${[
            ...effectiveSelectedSubjects.filter((subject) => subject !== MICROBIOLOGY_SUBJECT),
            selectedMicrobiologyLabels.length > 0
              ? `微生物免疫學（${selectedMicrobiologyLabels.join("、")}）`
              : null,
            includeSeasonalLimited ? "季節限定" : null
          ].filter(Boolean).join("、")}`
        : includeSeasonalLimited
          ? "季節限定"
          : undefined,
      chapter: undefined,
      section: undefined
    };

    saveQuizSettings(nextSettings);
    router.push(buildNewQuizHref(nextSettings));
  }

  return (
    <main id="main-content" className="shell workspace-page">
      <section className="workspace-section workspace-page-panel p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="workspace-page-kicker">開始測驗</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="workspace-page-title">先選抽哪些科</h1>
            </div>
            <p className="body-soft mt-2 max-w-2xl text-sm leading-6">
              選科目與年份後開始練習。
              {practiceStopAfterReview
                ? " 每題詳解後都可結束。"
                : ` 本輪 ${practiceQuestionCount} 題。`}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {renderSubjectGroup("醫學一", med1Subjects)}
          {renderSubjectGroup("醫學二", med2Subjects)}
          {seasonalAvailable ? (
            <section className="custom-paper-subsection border-amber-200 bg-[rgba(255,247,232,0.9)]">
              <div>
                <h2 className="text-2xl font-semibold text-ink">季節限定</h2>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIncludeSeasonalLimited((current) => !current)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
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
                  <p className="mt-3 text-sm text-slate-600">{seasonalLimitedPastExamCount} 題</p>
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <section
          aria-label="抽題設定"
          className="surface-card-muted mt-5 grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700">
              <details className="group relative">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-ink shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 [&::-webkit-details-marker]:hidden">
                  <span className="text-xs font-semibold text-slate-500">年份</span>
                  <span>{practiceYearRange.yearFrom}-{practiceYearRange.yearTo}</span>
                  <span className="text-xs text-slate-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
                </summary>
                <div className="absolute bottom-[calc(100%+0.55rem)] left-0 z-20 w-[min(19rem,calc(100vw-4rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="text-sm font-semibold text-ink">抽題年份</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-500" htmlFor="practice-year-from">
                      起始年份
                      <select
                        id="practice-year-from"
                        value={practiceYearRange.yearFrom}
                        onChange={(event) => {
                          const nextFrom = Number(event.target.value);
                          handlePracticeYearRangeChange({
                            yearFrom: nextFrom,
                            yearTo: Math.max(nextFrom, practiceYearRange.yearTo)
                          });
                        }}
                        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      >
                        {PRACTICE_YEAR_OPTIONS.map((year) => (
                          <option key={`start-from-${year}`} value={year}>{year}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-slate-500" htmlFor="practice-year-to">
                      結束年份
                      <select
                        id="practice-year-to"
                        value={practiceYearRange.yearTo}
                        onChange={(event) => {
                          const nextTo = Number(event.target.value);
                          handlePracticeYearRangeChange({
                            yearFrom: Math.min(practiceYearRange.yearFrom, nextTo),
                            yearTo: nextTo
                          });
                        }}
                        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      >
                        {PRACTICE_YEAR_OPTIONS.map((year) => (
                          <option key={`start-to-${year}`} value={year}>{year}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </details>
              {practiceHistoryReady ? (
                <span className="font-medium" aria-live="polite">
                  <span className="font-semibold tabular-nums text-ink">
                    {effectiveSelectedSubjects.length + (includeSeasonalLimited ? 1 : 0)}
                  </span>{" "}
                  個範圍・
                  <span className="font-semibold tabular-nums text-ink">{availableQuestionCount}</span>{" "}
                  題可練
                </span>
              ) : (
                <span className="font-semibold text-brand-800">正在整理作答紀錄</span>
              )}
            </div>
            {practiceHistoryReady && willFillWithSeenQuestions ? (
              <p className="text-xs font-semibold text-amber-700">
                {unattemptedAvailableQuestionCount === 0
                  ? "未做題已清空，接著會複習最久沒做的題。"
                  : `先出 ${unattemptedAvailableQuestionCount} 題未做，再補舊題。`}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 xl:flex">
            <button
              type="button"
              onClick={selectAllSubjects}
              className="secondary-pill whitespace-nowrap bg-white px-4 py-3"
            >
              全選科目
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!practiceHistoryReady || (effectiveSelectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0}
              className="primary-pill min-w-0 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {!practiceHistoryReady
                ? "整理紀錄中"
                : effectiveSelectedSubjects.length === 0 && !includeSeasonalLimited
                  ? "請先選科目"
                  : availableQuestionCount === 0
                    ? "此年份無題"
                    : practiceStopAfterReview
                      ? "開始練習"
                      : `開始 ${effectiveQuestionCount} 題`}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
