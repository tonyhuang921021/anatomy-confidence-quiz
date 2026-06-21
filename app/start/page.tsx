"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import { getSeasonalLimitedQuestions } from "@/data/med1QuestionBank";
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
  saveQuizSettings,
  type PracticeQuestionCount,
  type PracticeYearRange
} from "@/lib/storage";
import {
  getPracticeQuestionCountPreference,
  getPracticeStopAfterReviewPreference,
  getPracticeYearRangePreference
} from "@/lib/accountPreferences";
import { MAX_PRACTICE_SOURCE_YEAR, MIN_PRACTICE_SOURCE_YEAR, normalizePracticeYearRange } from "@/lib/practiceYears";
import { buildNewQuizHref } from "@/lib/startSettingsUrl";
import type { Question, QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

export default function StartPage() {
  const router = useRouter();
  const { user } = useAuth();
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
  const excludeAiGenerated = true;
  const seasonalDeadline = new Date("2026-05-15T09:00:00+08:00");
  const seasonalAvailable = new Date() < seasonalDeadline;

  useEffect(() => {
    const accountRange = getPracticeYearRangePreference(user?.user_metadata, defaultPracticeYearRange);
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

  const effectiveSelectedSubjects = useMemo(() => {
    const baseSubjects = selectedSubjects.filter((subject) => subject !== MICROBIOLOGY_SUBJECT);

    return selectedMicrobiologyTracks.length > 0
      ? [...baseSubjects, MICROBIOLOGY_SUBJECT]
      : baseSubjects;
  }, [selectedMicrobiologyTracks.length, selectedSubjects]);

  const selectedSubjectQuestionPool = useMemo(() => {
    if (effectiveSelectedSubjects.length === 0) return [];

    return selectableSubjects
      .filter((item) => effectiveSelectedSubjects.includes(item.subject))
      .flatMap((item) => {
        if (item.subject === MICROBIOLOGY_SUBJECT && selectedMicrobiologyTracks.length > 0) {
          return item.questions.filter((question) =>
            questionMatchesSubjectTracks(question, MICROBIOLOGY_SUBJECT, selectedMicrobiologyTracks)
          );
        }

        return item.questions;
      });
  }, [effectiveSelectedSubjects, selectedMicrobiologyTracks]);

  const availableQuestionCount = useMemo(() => {
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
    ).size;
  }, [
    excludeAiGenerated,
    includeSeasonalLimited,
    practiceYearRange.yearFrom,
    practiceYearRange.yearTo,
    seasonalLimitedQuestions,
    selectedSubjectQuestionPool
  ]);
  const effectiveQuestionCount = practiceStopAfterReview
    ? availableQuestionCount
    : Math.min(practiceQuestionCount, availableQuestionCount);

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

  function selectAllSubjects() {
    setSelectedSubjects(
      selectableSubjects
        .map((item) => item.subject)
        .filter((subject) => subject !== MICROBIOLOGY_SUBJECT)
    );
    setSelectedMicrobiologyTracks(getAllSubjectTrackKeys(MICROBIOLOGY_SUBJECT));
    setMicrobiologyExpanded(true);
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
                  className={`rounded-[1.6rem] border p-4 text-left transition ${
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
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-ink sm:text-lg">{subject.label}</h3>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {pastExamCount} 題
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {active ? "已選" : "全選"}
                      </span>
                    </div>
                    {active ? (
                      <p className="mt-3 text-xs font-semibold text-brand-700">
                        已選 {selectedLabels.length === tracks.length ? "全部" : selectedLabels.join("、")}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">按科名全選，或展開後只選子分類。</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTrackExpanded(trackedSubject, (current) => !current);
                    }}
                    className="mt-3 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
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
                            className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition ${
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
                      {pastExamCount} 題
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
    if ((effectiveSelectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0) return;

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
              可以只勾一科，也可以混著抽。年份範圍只會影響抽題池。
              {practiceStopAfterReview
                ? " 目前是自由測驗模式，不預先限制題數；你每題看完詳解後都可以決定繼續做，或直接結束測驗。"
                : ` 目前會從題池裡抽 ${practiceQuestionCount} 題開始測驗。`}
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
                  <p className="mt-3 text-sm text-slate-600">{seasonalLimitedPastExamCount} 題</p>
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="surface-card-muted mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            已選 <span className="font-semibold text-ink">{effectiveSelectedSubjects.length + (includeSeasonalLimited ? 1 : 0)}</span> 個範圍・
            {practiceYearRange.yearFrom} 到 {practiceYearRange.yearTo} 年共{" "}
            <span className="font-semibold text-ink">{availableQuestionCount}</span> 題
            ・優先不重複已做題
            {practiceStopAfterReview ? "・自由測驗・每題詳解後可結束" : `・每次抽 ${practiceQuestionCount} 題`}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={selectAllSubjects}
              className="secondary-pill bg-white px-4 py-3"
            >
              全選
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={(effectiveSelectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0}
              className="primary-pill disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {practiceStopAfterReview ? "開始自由測驗" : `開始 ${effectiveQuestionCount} 題測驗`}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
