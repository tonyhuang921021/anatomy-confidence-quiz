import primaryTagRuntimeMapJson from "../data/analysisPrimaryTagRuntimeMap.json";
import legacyClassificationJson from "../data/sources/moex_98_99_classification_review.json";
import legacy97ClassificationJson from "../data/sources/moex_97_1_med1_classification.json";
import legacy97Med2ClassificationJson from "../data/sources/moex_97_1_med2_classification.json";
import legacyLearningPlacementJson from "../data/sources/moex_98_99_learning_placement.json";
import { getMoexPrimarySubject } from "../scripts/moex-primary-subject";
import type { Question, QuestionClassificationOverride, SubjectName } from "../types/quiz";

type RuntimePrimaryTagAssignment = {
  primaryTag: string | null;
  subject: SubjectName;
};

type RuntimePrimaryTagTuple = [
  primaryTag: string | null,
  subjectCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
];

type RuntimePrimaryTagMap = {
  classifiedAt: string;
  questions: Record<string, RuntimePrimaryTagTuple>;
};

// The generator and its contract test guarantee the fixed three-item tuple shape.
const runtimePrimaryTagMap = primaryTagRuntimeMapJson as unknown as RuntimePrimaryTagMap;
const runtimeAssignments = runtimePrimaryTagMap.questions;
// The source-bound contract test validates every subject, tag and tuple length.
const legacyAssignments = { ...legacyClassificationJson.questions, ...legacy97ClassificationJson.questions, ...legacy97Med2ClassificationJson.questions } as unknown as Record<string, [SubjectName, string | null]>;
const legacyPendingIds = new Set<string>(legacyClassificationJson.pendingQuestionIds);
const legacyPendingPrimaryTagIds = new Set<string>([...legacyClassificationJson.pendingPrimaryTagQuestionIds, ...legacy97ClassificationJson.pendingPrimaryTagQuestionIds, ...legacy97Med2ClassificationJson.pendingPrimaryTagQuestionIds]);
// The generator and contract tests validate the two-string tuple for all 800 IDs.
const legacyLearningPlacements = { ...legacyLearningPlacementJson.questions, ...legacy97ClassificationJson.placements, ...legacy97Med2ClassificationJson.placements } as unknown as Record<string, [string, string]>;
const MICROBIOLOGY_TAG_PREFIXES = ["細菌學", "病毒學", "真菌學", "免疫學", "微生物免疫學"];
const SUBJECT_BY_CODE = [
  "解剖學",
  "組織學",
  "胚胎學",
  "生理學",
  "生物化學",
  "微生物免疫學",
  "寄生蟲學",
  "公共衛生學",
  "藥理學",
  "病理學"
] as const satisfies readonly SubjectName[];

export const ANALYSIS_PRIMARY_TAG_CLASSIFIED_AT = runtimePrimaryTagMap.classifiedAt;

export function getAnalysisPrimaryTagAssignment(questionId: string) {
  const legacy = legacyAssignments[questionId];
  if (legacy) return getLockedLegacyPrimaryTagAssignment(questionId, legacy[0], legacy[1]);
  const assignment = runtimeAssignments[questionId];
  if (!assignment) return null;

  return {
    primaryTag: assignment[0],
    subject: SUBJECT_BY_CODE[assignment[1]]
  } satisfies RuntimePrimaryTagAssignment;
}

/** Nominal exam subject is fixed by the existing year/paper/question-number rule. */
export function getLockedLegacyPrimaryTagAssignment(questionId: string, candidateSubject: SubjectName, primaryTag: string | null) {
  const subject = getMoexPrimarySubject(questionId);
  return {
    subject,
    primaryTag: candidateSubject === subject && primaryTag && primaryTagIncludesSubject(primaryTag, subject)
      ? primaryTag : null
  } satisfies RuntimePrimaryTagAssignment;
}

export function getQuestionPrimaryTag(
  question: Pick<Question, "id" | "section" | "primaryTag">
) {
  const assignment = getAnalysisPrimaryTagAssignment(question.id);
  if (assignment) {
    // A reviewed broad subject does not imply an invented topic for a taxonomy gap.
    if (Object.prototype.hasOwnProperty.call(legacyAssignments, question.id)) return assignment.primaryTag;
    return (
      assignment.primaryTag?.trim() ||
      formatClassificationOverridePrimaryTag(assignment.subject, question.section)
    );
  }

  return question.primaryTag?.trim() || question.section.trim() || null;
}

export function hasAnalysisPrimaryTagAssignment(questionId: string) {
  return Object.prototype.hasOwnProperty.call(runtimeAssignments, questionId) ||
    Object.prototype.hasOwnProperty.call(legacyAssignments, questionId);
}

export function isLegacyQuestionClassificationPending(questionId: string) {
  return legacyPendingIds.has(questionId);
}

export function isLegacyQuestionPrimaryTagPending(questionId: string) {
  return legacyPendingPrimaryTagIds.has(questionId);
}

export function applyAnalysisPrimaryTagClassification(question: Question): Question {
  const assignment = getAnalysisPrimaryTagAssignment(question.id);
  if (!assignment) return question;

  return {
    ...question,
    subject: assignment.subject,
    ...(legacyLearningPlacements[question.id] ? {
      chapter: legacyLearningPlacements[question.id][0],
      section: legacyLearningPlacements[question.id][1]
    } : {}),
    primaryTag: assignment.primaryTag ?? undefined
  };
}

export function applyClassificationOverrideWithPrimaryTagPriority(
  question: Question,
  override?: QuestionClassificationOverride | null
): Question {
  const classifiedQuestion = applyAnalysisPrimaryTagClassification(question);
  if (!override || hasAnalysisPrimaryTagAssignment(question.id)) return classifiedQuestion;

  return {
    ...classifiedQuestion,
    subject: override.subject,
    chapter: override.chapter,
    section: override.section,
    primaryTag: formatClassificationOverridePrimaryTag(override.subject, override.section)
  };
}

function formatClassificationOverridePrimaryTag(subject: SubjectName, section: string) {
  const normalizedSection = section.trim();
  if (!normalizedSection) return subject;
  if (primaryTagIncludesSubject(normalizedSection, subject)) return normalizedSection;
  return `${subject}－${normalizedSection}`;
}

export function primaryTagIncludesSubject(primaryTag: string, subject: string) {
  const compactTag = primaryTag.replace(/\s+/g, "");
  const compactSubject = subject.replace(/\s+/g, "");
  if (
    compactSubject === "微生物免疫學" &&
    MICROBIOLOGY_TAG_PREFIXES.some((prefix) => compactTag.startsWith(prefix))
  ) {
    return true;
  }
  return compactTag.startsWith(compactSubject);
}

export function shouldDisplaySubjectBesidePrimaryTag(
  question: Pick<Question, "id" | "subject" | "section" | "primaryTag">
) {
  const primaryTag = getQuestionPrimaryTag(question);
  return !primaryTag || !primaryTagIncludesSubject(primaryTag, question.subject);
}

export function getQuestionClassificationLabel(
  question: Pick<Question, "id" | "subject" | "chapter" | "section" | "primaryTag">
) {
  const primaryTag = getQuestionPrimaryTag(question);
  if (!primaryTag && Object.prototype.hasOwnProperty.call(legacyAssignments, question.id)) {
    return `${question.subject}（細分類待核對）`;
  }
  if (!primaryTag) return `${question.subject} / ${question.chapter} / ${question.section}`;
  return primaryTagIncludesSubject(primaryTag, question.subject)
    ? primaryTag
    : `${question.subject} / ${primaryTag}`;
}
