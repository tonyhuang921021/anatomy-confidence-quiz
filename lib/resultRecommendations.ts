import { formatRocYear } from "./rocDate";
import { getOfficialPaperKey } from "./officialPaperIdentity";
import { MED1_SUBJECTS, MED2_SUBJECTS } from "../data/subjectOrder";
import {
  applyClassificationOverrideWithPrimaryTagPriority,
  getAnalysisPrimaryTagAssignment,
  getQuestionPrimaryTag,
  primaryTagIncludesSubject
} from "./analysisPrimaryTag";
import { normalizePracticeYearRange, toGregorianPracticeYear } from "./practiceYears";
import { isTrackSubject, questionMatchesSubjectTracks } from "./questionTrackFilters";
import {
  calculateCompletionStats,
  calculateSectionStats,
  generateAIPrompt,
  getLowCompletionSections,
  getTopWeakSections,
  getUnstableCompletedSections
} from "./quizAnalysis";
import type { Question, QuestionClassificationOverride, QuizSession } from "../types/quiz";

const SUBJECT_ORDER = new Map<string, number>([...MED1_SUBJECTS, ...MED2_SUBJECTS].map((subject, index) => [subject, index]));

function compareSubjects(left: string, right: string) {
  return (SUBJECT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) - (SUBJECT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right, "zh-Hant");
}

function compareTopics(left: { chapter: string; section: string }, right: { chapter: string; section: string }) {
  return compareSubjects(left.chapter, right.chapter) || left.section.localeCompare(right.section, "zh-Hant");
}

export function getResultQuestionTopic(question: Question) {
  const assignment = getAnalysisPrimaryTagAssignment(question.id);
  // A confirmed subject without a confirmed topic must not resurrect a legacy section.
  const label = assignment ? assignment.primaryTag?.trim() : getQuestionPrimaryTag(question)?.trim();
  return label || question.subject;
}

export function formatResultRecommendationLabel(item: { chapter: string; section: string }) {
  if (item.chapter === item.section) return `${item.chapter}（科目整體，尚未細分）`;
  return primaryTagIncludesSubject(item.section, item.chapter)
    ? item.section
    : `${item.chapter}／${item.section}`;
}

function toAnalysisQuestion(question: Question): Question {
  return { ...question, chapter: question.subject, section: getResultQuestionTopic(question) };
}

export function buildResultRecommendations({ session, questions, questionBank, completedSessions, classificationOverrides = {} }: {
  session: QuizSession | null;
  questions: Question[];
  questionBank: Question[];
  completedSessions: QuizSession[];
  classificationOverrides?: Record<string, QuestionClassificationOverride>;
}) {
  const confidenceEnabled = session?.settings?.mode !== "simulation" || session.settings.enableConfidenceCalibration !== false;
  const classify = (question: Question) => applyClassificationOverrideWithPrimaryTagPriority(question, classificationOverrides[question.id]);
  const attempts = (session?.attempts ?? []).filter((attempt) =>
    ["A", "B", "C", "D", "E"].includes(attempt.selectedAnswer) && typeof attempt.isCorrect === "boolean"
  );
  const attemptedIds = new Set(attempts.map((attempt) => attempt.questionId));
  const currentQuestions = questions.filter((question) => attemptedIds.has(question.id)).map(classify);
  const subjects = new Set(currentQuestions.map((question) => question.subject));
  const currentQuestionMap = new Map(currentQuestions.map((question) => [question.id, question]));
  const classifiedBank = Array.from(new Map(questionBank.map((question) => {
    const classified = currentQuestionMap.get(question.id) ?? classify(question);
    return [classified.id, classified] as const;
  })).values());
  const settings = session?.settings;
  let progressQuestions = classifiedBank.filter((question) =>
    subjects.has(question.subject) && question.sourceType !== "AI_GENERATED" && question.source !== "ai-generated"
  );
  const constraints: string[] = [];
  const applyKnownConstraint = (label: string, predicate: (question: Question) => boolean) => {
    // Stale settings or changed classification cannot silently drop this session's actual subjects.
    if (currentQuestions.length === 0 || !currentQuestions.every(predicate)) return;
    progressQuestions = progressQuestions.filter(predicate);
    constraints.push(label);
  };
  const customIds = settings?.customQuestionIds ?? [];
  if (customIds.length > 0 && (settings?.strictCustomQuestionPool || settings?.mode === "custom_paper")) {
    const customIdSet = new Set(customIds);
    applyKnownConstraint("指定題庫", (question) => customIdSet.has(question.id));
  } else {
    const paperKey = settings?.selectedPaperKey;
    if (paperKey && !paperKey.startsWith("AI-")) {
      applyKnownConstraint("所選考卷", (question) =>
        `${question.sourceYear}-${question.sourceRound}-${question.paperCode}` === paperKey ||
        getOfficialPaperKey(question) === paperKey
      );
    }
    if (Number.isFinite(settings?.yearFrom) && Number.isFinite(settings?.yearTo)) {
      const range = normalizePracticeYearRange({ yearFrom: settings!.yearFrom!, yearTo: settings!.yearTo! });
      applyKnownConstraint(`${formatRocYear(range.yearFrom)}–${formatRocYear(range.yearTo)}`, (question) =>
        typeof question.sourceYear === "number" && toGregorianPracticeYear(question.sourceYear) >= range.yearFrom && toGregorianPracticeYear(question.sourceYear) <= range.yearTo
      );
    }
    if (settings?.chapter) applyKnownConstraint("所選章節", (question) => question.chapter === settings.chapter);
    if (settings?.section) applyKnownConstraint("所選分類", (question) => question.section === settings.section || getResultQuestionTopic(question) === settings.section);
    for (const [subject, tracks] of Object.entries(settings?.subjectTracks ?? {})) {
      if (!isTrackSubject(subject) || !tracks?.length) continue;
      applyKnownConstraint("所選科目分類", (question) => question.subject !== subject || questionMatchesSubjectTracks(question, subject, tracks));
    }
  }
  const history = Array.from(new Map(
    [...completedSessions, ...(session?.completedAt ? [session] : [])]
      .filter((item) => Boolean(item.completedAt))
      .map((item) => [item.id, item] as const)
  ).values());
  const analysisQuestions = currentQuestions.map(toAnalysisQuestion);
  const analysisBank = classifiedBank.map(toAnalysisQuestion);
  const analysisProgressQuestions = progressQuestions.map(toAnalysisQuestion);
  const sectionStats = calculateSectionStats(attempts, analysisQuestions, { confidenceEnabled }).sort(
    (left, right) => right.priorityScore - left.priorityScore || right.wrong - left.wrong || compareTopics(left, right)
  );
  const completionStats = calculateCompletionStats(analysisProgressQuestions, history);
  completionStats.sections.sort(compareTopics);
  completionStats.chapters.sort((left, right) => compareSubjects(left.chapter, right.chapter));
  for (const chapter of completionStats.chapters) chapter.sections.sort(compareTopics);
  const subjectLabel = Array.from(subjects).sort(compareSubjects).join("、") || "未辨識科目";
  const scopeLabel = constraints.length > 0
    ? `${subjectLabel}｜${Array.from(new Set(constraints)).join("、")}既有題庫`
    : `${subjectLabel}完整既有題庫`;
  const promptTexts = {
    concise: session ? generateAIPrompt(attempts, analysisQuestions, history, analysisQuestions, { detailLevel: "concise", completionStats, sectionStats, completionScopeLabel: scopeLabel, confidenceEnabled }) : "",
    detailed: session ? generateAIPrompt(attempts, analysisQuestions, history, analysisQuestions, { detailLevel: "detailed", completionStats, sectionStats, completionScopeLabel: scopeLabel, confidenceEnabled }) : ""
  };
  return {
    sectionStats,
    topWeakSections: getTopWeakSections(sectionStats, 3),
    completionStats,
    lowCompletion: getLowCompletionSections(completionStats.sections, 5),
    unstableSections: getUnstableCompletedSections(completionStats.sections, 5),
    promptTexts,
    scopeLabel,
    questionBank: analysisBank,
    completedSessions: history
  };
}
