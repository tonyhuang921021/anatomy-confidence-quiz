"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { FreePracticeSetup } from "@/components/FreePracticeSetup";
import { useQuestionOrderMode } from "@/components/QuestionOrderModeControl";
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
  loadKeyboardQuestionNavigation,
  loadPracticeFastAnswerMode,
  loadPracticeStopAfterReview,
  loadPracticeYearRange,
  loadCompletedHistorySessionsForUser,
  loadCurrentSessionForUser,
  savePracticeQuestionCount,
  saveKeyboardQuestionNavigation,
  savePracticeFastAnswerMode,
  savePracticeStopAfterReview,
  savePracticeYearRange,
  saveQuizSettings,
  type PracticeQuestionCount,
  type PracticeYearRange
} from "@/lib/storage";
import {
  getKeyboardQuestionNavigationPreference,
  getPracticeFastAnswerModePreference,
  getPracticeQuestionCountPreference,
  getPracticeStopAfterReviewPreference,
  getPracticeYearRangePreference,
  hasKeyboardQuestionNavigationPreference,
  hasPracticeFastAnswerModePreference,
  hasPracticeQuestionCountPreference,
  hasPracticeStopAfterReviewPreference,
  type AccountPreferencePatch
} from "@/lib/accountPreferences";
import {
  MAX_PRACTICE_SOURCE_YEAR,
  MIN_PRACTICE_SOURCE_YEAR,
  normalizePracticeYearRange
} from "@/lib/practiceYears";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QuestionClassificationOverride, QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

export default function StartPage() {
  const router = useRouter();
  const { user, syncVersion } = useAuth();
  const { mode: orderMode, setMode: setOrderMode, prioritizeUnseen } = useQuestionOrderMode("unseen");
  const cloudHistoryHydrating = useCloudHistoryHydration();
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
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
  const [practiceFastAnswerMode, setPracticeFastAnswerMode] = useState(false);
  const [keyboardQuestionNavigation, setKeyboardQuestionNavigation] = useState(false);
  const [setupStep, setSetupStep] = useState<"subjects" | "settings">("subjects");
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
    const normalizedRange = normalizePracticeYearRange(nextRange);
    setPracticeYearRange(normalizedRange);
    savePracticeYearRange(normalizedRange);
    if (user && !accountRange) {
      syncFreePracticePreferences({
        practice_year_from: normalizedRange.yearFrom,
        practice_year_to: normalizedRange.yearTo
      });
    }
  }, [defaultPracticeYearRange, user?.id, user?.user_metadata]);

  useEffect(() => {
    const nextCount = user && hasPracticeQuestionCountPreference(user.user_metadata)
      ? getPracticeQuestionCountPreference(user?.user_metadata, 10)
      : loadPracticeQuestionCount(10);
    const nextStopAfterReview = user && hasPracticeStopAfterReviewPreference(user.user_metadata)
      ? getPracticeStopAfterReviewPreference(user?.user_metadata, false)
      : loadPracticeStopAfterReview(false);
    const nextFastAnswerMode = user && hasPracticeFastAnswerModePreference(user.user_metadata)
      ? getPracticeFastAnswerModePreference(user.user_metadata, false)
      : loadPracticeFastAnswerMode(false);
    const nextKeyboardQuestionNavigation = user && hasKeyboardQuestionNavigationPreference(user.user_metadata)
      ? getKeyboardQuestionNavigationPreference(user.user_metadata, false)
      : loadKeyboardQuestionNavigation(false);
    setPracticeQuestionCount(nextCount);
    setPracticeStopAfterReview(nextStopAfterReview);
    setPracticeFastAnswerMode(nextFastAnswerMode);
    setKeyboardQuestionNavigation(nextKeyboardQuestionNavigation);
    savePracticeQuestionCount(nextCount);
    savePracticeStopAfterReview(nextStopAfterReview);
    savePracticeFastAnswerMode(nextFastAnswerMode);
    saveKeyboardQuestionNavigation(nextKeyboardQuestionNavigation);
    if (user) {
      const missingPatch: AccountPreferencePatch = {};
      if (!hasPracticeQuestionCountPreference(user.user_metadata)) {
        missingPatch.practice_question_count = nextCount;
      }
      if (!hasPracticeStopAfterReviewPreference(user.user_metadata)) {
        missingPatch.practice_stop_after_review = nextStopAfterReview;
      }
      if (!hasPracticeFastAnswerModePreference(user.user_metadata)) {
        missingPatch.practice_fast_answer_mode = nextFastAnswerMode;
      }
      if (!hasKeyboardQuestionNavigationPreference(user.user_metadata)) {
        missingPatch.keyboard_question_navigation = nextKeyboardQuestionNavigation;
      }
      if (Object.keys(missingPatch).length > 0) {
        syncFreePracticePreferences(missingPatch);
      }
    }
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

  const selectedRangeCount = effectiveSelectedSubjects.length + (includeSeasonalLimited ? 1 : 0);
  const selectedRangeLabel = useMemo(() => {
    const labels = effectiveSelectedSubjects.map(
      (subject) => {
        const subjectLabel = selectableSubjects.find((item) => item.subject === subject)?.label ?? subject;
        if (subject !== MICROBIOLOGY_SUBJECT) return subjectLabel;
        const trackLabels = getSubjectTrackLabels(MICROBIOLOGY_SUBJECT, selectedMicrobiologyTracks);
        const allTrackCount = getAllSubjectTrackKeys(MICROBIOLOGY_SUBJECT).length;
        return trackLabels.length > 0 && trackLabels.length < allTrackCount
          ? `${subjectLabel}（${trackLabels.join("、")}）`
          : subjectLabel;
      }
    );
    if (includeSeasonalLimited) labels.push("季節限定生殖範圍");
    if (labels.length <= 3) return labels.join("、");
    return `${labels.slice(0, 2).join("、")}等 ${labels.length} 個範圍`;
  }, [effectiveSelectedSubjects, includeSeasonalLimited, selectedMicrobiologyTracks]);

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

  function moveToStep(nextStep: "subjects" | "settings") {
    setSetupStep(nextStep);
    window.scrollTo({ top: 0, behavior: "auto" });
    window.setTimeout(() => stepHeadingRef.current?.focus({ preventScroll: true }), 0);
  }

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
    syncFreePracticePreferences({
      practice_year_from: normalized.yearFrom,
      practice_year_to: normalized.yearTo
    });
  }

  function syncFreePracticePreferences(patch: AccountPreferencePatch) {
    if (!user) return;
    void getSupabaseBrowserClient().auth.updateUser({
      data: patch
    }).then(({ error }) => {
      if (error) console.error("Free practice preference sync skipped:", error);
    }).catch((error) => {
      console.error("Free practice preference sync skipped:", error);
    });
  }

  function handlePracticeQuestionCountChange(nextCount: PracticeQuestionCount) {
    setPracticeQuestionCount(nextCount);
    savePracticeQuestionCount(nextCount);
    syncFreePracticePreferences({ practice_question_count: nextCount });
  }

  function handlePracticeStopAfterReviewChange(enabled: boolean) {
    setPracticeStopAfterReview(enabled);
    savePracticeStopAfterReview(enabled);
    syncFreePracticePreferences({ practice_stop_after_review: enabled });
  }

  function handlePracticeFastAnswerModeChange(enabled: boolean) {
    setPracticeFastAnswerMode(enabled);
    savePracticeFastAnswerMode(enabled);
    syncFreePracticePreferences({ practice_fast_answer_mode: enabled });
  }

  function handleKeyboardQuestionNavigationChange(enabled: boolean) {
    setKeyboardQuestionNavigation(enabled);
    saveKeyboardQuestionNavigation(enabled);
    syncFreePracticePreferences({ keyboard_question_navigation: enabled });
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
            aria-pressed={groupFullySelected}
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
                    aria-label={`全選${subject.label}`}
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
                    aria-label={`${subject.label}${expanded ? "收合分類" : "選分類"}`}
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
                            aria-pressed={trackActive}
                            aria-label={`${subject.label}：${track.label}`}
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
                className={`min-w-0 rounded-lg border p-3 text-left transition sm:p-4 ${
                  active
                    ? "border-brand-400 bg-white shadow-card ring-1 ring-brand-200"
                    : "border-slate-200/80 bg-white/80 hover:bg-white"
                }`}
              >
                <div className="flex min-h-12 flex-col justify-center gap-1 sm:min-h-14">
                  <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-ink sm:text-lg">
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
    const priorityQuestionIds = prioritizeUnseen &&
      unattemptedAvailableQuestionIds.length > 0 &&
      unattemptedAvailableQuestionIds.length <= 80
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
      questionOrderMode: orderMode,
      priorityQuestionIds,
      enableFastAnswerMode: practiceFastAnswerMode,
      enableKeyboardNavigation: keyboardQuestionNavigation,
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
        {setupStep === "settings" ? (
          <button
            type="button"
            onClick={() => moveToStep("subjects")}
            className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回選科
          </button>
        ) : null}

        <div className="min-w-0">
          <p className="workspace-page-kicker">
            開始測驗・{setupStep === "subjects" ? "選範圍" : "確認"}
          </p>
          <h1
            ref={stepHeadingRef}
            tabIndex={-1}
            className="workspace-page-title focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {setupStep === "subjects" ? "這次想練什麼？" : "準備開始"}
          </h1>
          <p className="body-soft mt-2 max-w-2xl text-sm leading-6">
            {setupStep === "subjects"
              ? "可選一科、多科或直接全選；選好後可直接開始，也能再調整做題設定。"
              : "沿用上次設定可直接開始，需要調整時再展開自由做題設定。"}
          </p>
        </div>

        {setupStep === "subjects" ? (
          <>
            <section aria-label="已選範圍" className="start-selection-bar mt-5">
              <div className="min-w-0" aria-live="polite">
                <p className="text-xs font-semibold text-slate-500">已選範圍</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {selectedRangeCount > 0 ? selectedRangeLabel : "尚未選擇"}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-[auto_auto] gap-2">
                <button
                  type="button"
                  onClick={selectAllSubjects}
                  className="secondary-pill whitespace-nowrap bg-white px-3 py-2 text-sm"
                >
                  全選
                </button>
                <button
                  type="button"
                  onClick={() => moveToStep("settings")}
                  disabled={selectedRangeCount === 0}
                  className="primary-pill inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  下一步
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </section>

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
                      aria-pressed={includeSeasonalLimited}
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
          </>
        ) : (
          <div className="mt-6 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white px-4 py-3" aria-label="本次練習範圍">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">本次範圍</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{selectedRangeLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => moveToStep("subjects")}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  更改
                </button>
              </div>
            </section>

            {!practiceHistoryReady ? (
              <div className="workspace-empty-state" aria-live="polite">
                正在整理作答紀錄，完成後就能開始。
              </div>
            ) : (
              <FreePracticeSetup
                idPrefix="general-practice"
                label={selectedRangeLabel || "一般練習"}
                availableQuestionCount={availableQuestionCount}
                questionCount={practiceQuestionCount}
                yearRange={practiceYearRange}
                orderMode={orderMode}
                stopAfterReview={practiceStopAfterReview}
                fastAnswerMode={practiceFastAnswerMode}
                keyboardNavigationEnabled={keyboardQuestionNavigation}
                onQuestionCountChange={handlePracticeQuestionCountChange}
                onYearRangeChange={handlePracticeYearRangeChange}
                onOrderModeChange={setOrderMode}
                onStopAfterReviewChange={handlePracticeStopAfterReviewChange}
                onFastAnswerModeChange={handlePracticeFastAnswerModeChange}
                onKeyboardNavigationChange={handleKeyboardQuestionNavigationChange}
                onStart={handleStart}
              />
            )}

            {practiceHistoryReady && willFillWithSeenQuestions ? (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800" aria-live="polite">
                {unattemptedAvailableQuestionCount === 0
                  ? "這個範圍的未做題已清空，接著會複習最久沒做的題。"
                  : `會先出 ${unattemptedAvailableQuestionCount} 題未做，再補較久沒做的題。`}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
