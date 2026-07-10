import primaryTagDisplayMapJson from "@/data/analysisPrimaryTagDisplayMap.json";
import type { Question } from "@/types/quiz";

const primaryTagDisplayMap = primaryTagDisplayMapJson as Record<string, string | null>;

export function getQuestionPrimaryTag(
  question: Pick<Question, "id" | "section" | "primaryTag">
) {
  const confirmedOverride = question.primaryTag?.trim();
  if (confirmedOverride) return confirmedOverride;

  const assignedTag = primaryTagDisplayMap[question.id]?.trim();
  if (assignedTag) return assignedTag;

  if (Object.prototype.hasOwnProperty.call(primaryTagDisplayMap, question.id)) {
    return question.section.trim() || null;
  }

  return null;
}

export function hasAnalysisPrimaryTagAssignment(questionId: string) {
  return Object.prototype.hasOwnProperty.call(primaryTagDisplayMap, questionId);
}

export function primaryTagIncludesSubject(primaryTag: string, subject: string) {
  const compactTag = primaryTag.replace(/\s+/g, "");
  const compactSubject = subject.replace(/\s+/g, "");
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
  if (!primaryTag) return `${question.subject} / ${question.chapter} / ${question.section}`;
  return primaryTagIncludesSubject(primaryTag, question.subject)
    ? primaryTag
    : `${question.subject} / ${primaryTag}`;
}
