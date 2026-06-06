"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { enabledSubjects, MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import { getSeasonalLimitedQuestions } from "@/data/med1QuestionBank";
import { DEFAULT_QUIZ_SETTINGS } from "@/lib/quizAnalysis";
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
import type { Question, QuizSettings, SubjectName } from "@/types/quiz";

const selectableSubjects = enabledSubjects.filter(
  (item) =>
    item.subject !== "醫學（一）" &&
    item.subject !== "醫學（二）" &&
    (MED1_SUBJECTS.includes(item.subject) || MED2_SUBJECTS.includes(item.subject))
);

const MICROBIOLOGY_SUBJECT: SubjectName = "微生物免疫學";
const MICROBIOLOGY_TRACKS = [
  { key: "virus", label: "病毒" },
  { key: "bacteria", label: "細菌" },
  { key: "immunity", label: "免疫" }
] as const;
type MicrobiologyTrackKey = (typeof MICROBIOLOGY_TRACKS)[number]["key"];

const MICROBIOLOGY_TRACK_KEYWORDS: Record<MicrobiologyTrackKey, string[]> = {
  virus: [
    "病毒",
    "virus",
    "viral",
    "viridae",
    "virinae",
    "phage",
    "rna virus",
    "dna virus",
    "hiv",
    "hbv",
    "hcv",
    "hav",
    "hev",
    "cmv",
    "ebv",
    "hsv",
    "vzv",
    "hpv",
    "influenza",
    "adenovirus",
    "enterovirus",
    "rotavirus",
    "rubella",
    "measles",
    "mumps",
    "rabies",
    "poliovirus",
    "coronavirus",
    "hepatitis",
    "retrovirus",
    "herpes",
    "poxvirus",
    "parvovirus",
    "togavirus",
    "flavivirus",
    "picornavirus",
    "orthomyxovirus",
    "paramyxovirus",
    "papillomavirus"
  ],
  bacteria: [
    "微生物",
    "microbiology",
    "microbe",
    "microbial",
    "細菌",
    "bacteria",
    "bacterial",
    "bacillus",
    "coccus",
    "菌",
    "桿菌",
    "球菌",
    "螺旋菌",
    "分枝桿菌",
    "抗酸菌",
    "革蘭",
    "gram",
    "staphylococcus",
    "streptococcus",
    "neisseria",
    "escherichia",
    "salmonella",
    "shigella",
    "vibrio",
    "clostridium",
    "bacillus",
    "corynebacterium",
    "listeria",
    "mycobacterium",
    "treponema",
    "borrelia",
    "leptospira",
    "chlamydia",
    "rickettsia",
    "mycoplasma",
    "pseudomonas",
    "klebsiella",
    "proteus",
    "bacteroides",
    "actinomyces",
    "nocardia",
    "真菌",
    "黴菌",
    "fung",
    "mycos",
    "candida",
    "cryptococcus",
    "aspergillus",
    "histoplasma",
    "coccidioides",
    "pneumocystis",
    "dermatophyte",
    "yeast",
    "mold",
    "抗菌",
    "滅菌",
    "消毒",
    "培養",
    "染色",
    "毒素"
  ],
  immunity: [
    "免疫",
    "immun",
    "antibody",
    "antigen",
    "mhc",
    "hla",
    "t cell",
    "b cell",
    "t細胞",
    "b細胞",
    "抗體",
    "抗原",
    "補體",
    "complement",
    "cytokine",
    "介白素",
    "interleukin",
    "巨噬",
    "macrophage",
    "樹突",
    "dendritic",
    "nk cell",
    "ige",
    "igg",
    "iga",
    "igm",
    "igd",
    "hypersensitivity",
    "過敏",
    "疫苗",
    "vaccine",
    "先天免疫",
    "後天免疫",
    "adaptive",
    "innate",
    "發炎",
    "inflammation",
    "移植",
    "transplant",
    "autoimmune",
    "自體免疫"
  ]
};

function normalizeMicrobiologySearchText(value: string) {
  return value.toLocaleLowerCase("en-US");
}

function getMicrobiologySearchText(question: Question) {
  return normalizeMicrobiologySearchText(
    [
      question.chapter,
      question.section,
      question.testedConcept,
      question.stem,
      question.options.A,
      question.options.B,
      question.options.C,
      question.options.D,
      question.options.E,
      question.explanation,
      question.memoryTip,
      question.clinicalLink
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getMicrobiologyTrackKeys(question: Question): MicrobiologyTrackKey[] {
  const text = getMicrobiologySearchText(question);
  const exactSectionMatches = MICROBIOLOGY_TRACKS.filter((track) => {
    if (track.key === "virus") return question.section.includes("病毒");
    if (track.key === "bacteria") {
      return (
        question.section.includes("細菌") ||
        question.section.includes("真菌") ||
        question.section.includes("微生物")
      );
    }
    return question.section.includes("免疫");
  }).map((track) => track.key);

  if (exactSectionMatches.length > 0) return exactSectionMatches;

  return MICROBIOLOGY_TRACKS
    .filter((track) =>
      MICROBIOLOGY_TRACK_KEYWORDS[track.key].some((keyword) =>
        text.includes(keyword.toLocaleLowerCase("en-US"))
      )
    )
    .map((track) => track.key);
}

function questionMatchesMicrobiologyTracks(
  question: Question,
  selectedTrackKeys: MicrobiologyTrackKey[]
) {
  if (selectedTrackKeys.length === 0) return true;
  if (selectedTrackKeys.length === MICROBIOLOGY_TRACKS.length) return true;
  const questionTrackKeys = getMicrobiologyTrackKeys(question);
  return selectedTrackKeys.some((trackKey) => questionTrackKeys.includes(trackKey));
}

export default function StartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const med1Subjects = selectableSubjects.filter((item) => MED1_SUBJECTS.includes(item.subject));
  const med2Subjects = selectableSubjects.filter((item) => MED2_SUBJECTS.includes(item.subject));
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectName[]>([]);
  const [microbiologyExpanded, setMicrobiologyExpanded] = useState(false);
  const [selectedMicrobiologyTracks, setSelectedMicrobiologyTracks] = useState<MicrobiologyTrackKey[]>([]);
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
      yearFrom: availableYears[0] ?? 100,
      yearTo: availableYears[availableYears.length - 1] ?? 115
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
    setPracticeYearRange(nextRange);
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
    setSelectedSubjects((current) => {
      const hasMicrobiology = current.includes(MICROBIOLOGY_SUBJECT);

      if (selectedMicrobiologyTracks.length > 0) {
        return hasMicrobiology ? current : [...current, MICROBIOLOGY_SUBJECT];
      }

      return hasMicrobiology
        ? current.filter((subject) => subject !== MICROBIOLOGY_SUBJECT)
        : current;
    });
  }, [selectedMicrobiologyTracks]);

  const selectedSubjectQuestionPool = useMemo(() => {
    if (selectedSubjects.length === 0) return [];

    return selectableSubjects
      .filter((item) => selectedSubjects.includes(item.subject))
      .flatMap((item) => {
        if (
          item.subject === MICROBIOLOGY_SUBJECT &&
          selectedMicrobiologyTracks.length > 0
        ) {
          return item.questions.filter((question) =>
            questionMatchesMicrobiologyTracks(question, selectedMicrobiologyTracks)
          );
        }

        return item.questions;
      });
  }, [selectedMicrobiologyTracks, selectedSubjects]);

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
      setMicrobiologyExpanded((current) => !current);
      return;
    }

    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject]
    );
  }

  function toggleMicrobiologyTrack(trackKey: MicrobiologyTrackKey) {
    setSelectedMicrobiologyTracks((current) =>
      current.includes(trackKey)
        ? current.filter((item) => item !== trackKey)
        : [...current, trackKey]
    );
  }

  function selectAllSubjects() {
    setSelectedSubjects(selectableSubjects.map((item) => item.subject));
    setSelectedMicrobiologyTracks(MICROBIOLOGY_TRACKS.map((track) => track.key));
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
            const active = selectedSubjects.includes(subject.subject);
            const isMicrobiology = subject.subject === MICROBIOLOGY_SUBJECT;
            const selectedMicrobiologyQuestionCount = isMicrobiology && selectedMicrobiologyTracks.length > 0
              ? subject.questions.filter(
                  (question) =>
                    question.sourceType !== "AI_GENERATED" &&
                    questionMatchesMicrobiologyTracks(question, selectedMicrobiologyTracks)
                ).length
              : null;
            const pastExamCount =
              selectedMicrobiologyQuestionCount ??
              subject.questions.filter((question) => question.sourceType !== "AI_GENERATED").length;

            if (isMicrobiology) {
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
                    aria-expanded={microbiologyExpanded}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-ink sm:text-lg">{subject.label}</h3>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {pastExamCount} 題
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {microbiologyExpanded ? "收合" : "選分類"}
                      </span>
                    </div>
                    {active ? (
                      <p className="mt-3 text-xs font-semibold text-brand-700">
                        已選 {MICROBIOLOGY_TRACKS
                          .filter((track) => selectedMicrobiologyTracks.includes(track.key))
                          .map((track) => track.label)
                          .join("、")}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">點開後選病毒、細菌或免疫。</p>
                    )}
                  </button>

                  {microbiologyExpanded ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {MICROBIOLOGY_TRACKS.map((track) => {
                        const trackActive = selectedMicrobiologyTracks.includes(track.key);
                        const trackCount = subject.questions.filter(
                          (question) =>
                            question.sourceType !== "AI_GENERATED" &&
                            questionMatchesMicrobiologyTracks(question, [track.key])
                        ).length;

                        return (
                          <button
                            key={track.key}
                            type="button"
                            onClick={() => toggleMicrobiologyTrack(track.key)}
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
    if ((selectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0) return;

    const shouldUseExactStartPool = selectedMicrobiologyTracks.length > 0;
    const exactStartQuestionIds = shouldUseExactStartPool
      ? Array.from(
          new Set(
            [
              ...selectedSubjectQuestionPool,
              ...(includeSeasonalLimited
                ? seasonalLimitedQuestions.filter(
                    (question) => !excludeAiGenerated || question.sourceType !== "AI_GENERATED"
                  )
                : [])
            ].map((question) => question.id)
          )
        )
      : undefined;
    const selectedMicrobiologyLabels = MICROBIOLOGY_TRACKS
      .filter((track) => selectedMicrobiologyTracks.includes(track.key))
      .map((track) => track.label);

    const nextSettings: QuizSettings = {
      ...DEFAULT_QUIZ_SETTINGS,
      mode: "random",
      questionCount: effectiveQuestionCount,
      stopAfterReview: practiceStopAfterReview,
      yearFrom: practiceYearRange.yearFrom,
      yearTo: practiceYearRange.yearTo,
      subjectFilter:
        selectedSubjects.length === 1 && !includeSeasonalLimited ? selectedSubjects[0] : "全部",
      subjectFilters: selectedSubjects,
      excludeAiGenerated,
      customQuestionIds: exactStartQuestionIds ?? (includeSeasonalLimited
        ? seasonalLimitedQuestions
            .filter((question) => !excludeAiGenerated || question.sourceType !== "AI_GENERATED")
            .map((question) => question.id)
        : undefined),
      strictCustomQuestionPool: shouldUseExactStartPool,
      customPoolLabel: shouldUseExactStartPool
        ? `開始測驗：${[
            ...selectedSubjects.filter((subject) => subject !== MICROBIOLOGY_SUBJECT),
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
            已選 <span className="font-semibold text-ink">{selectedSubjects.length + (includeSeasonalLimited ? 1 : 0)}</span> 個範圍・
            {practiceYearRange.yearFrom} 到 {practiceYearRange.yearTo} 年共{" "}
            <span className="font-semibold text-ink">{availableQuestionCount}</span> 題
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
              disabled={(selectedSubjects.length === 0 && !includeSeasonalLimited) || availableQuestionCount === 0}
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
