import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { normalizeSearchText } from "./searchTextNormalization";
import type { Question } from "@/types/quiz";

type RelatedQuestionCandidate = {
  question: Question;
  conceptKey: string;
  primaryTagKey: string;
  chapterKey: string;
  sectionKey: string;
};

export type RelatedQuestionIndex = {
  candidatesByPrimaryTag: Map<string, RelatedQuestionCandidate[]>;
  candidatesBySection: Map<string, RelatedQuestionCandidate[]>;
  candidatesBySubject: Map<string, RelatedQuestionCandidate[]>;
};

const relatedQuestionIndexCache = new WeakMap<Question[], RelatedQuestionIndex>();
const relatedQuestionTokenCache = new WeakMap<Question, Set<string>>();

const RELATED_QUESTION_STOP_TOKENS = new Set([
  "下列",
  "何者",
  "下述",
  "關於",
  "正確",
  "錯誤",
  "最可",
  "可能",
  "主要",
  "造成",
  "產生",
  "作用",
  "病人",
  "患者",
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "which",
  "following"
]);

function normalizeRelatedText(text?: string | null) {
  return normalizeSearchText(text).replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/gu, "$1");
}

function getConceptKey(question: Question) {
  return normalizeRelatedText(question.testedConcept);
}

function getChapterKey(question: Question) {
  return `${question.subject ?? ""}__${question.chapter ?? ""}`;
}

function getPrimaryTagKey(question: Question) {
  const primaryTag = getQuestionPrimaryTag(question);
  return primaryTag ? `${question.subject ?? ""}__${primaryTag}` : "";
}

function getSectionKey(question: Question) {
  return `${question.subject ?? ""}__${question.chapter ?? ""}__${question.section ?? ""}`;
}

function isPastExamQuestion(question: Question) {
  return question.sourceType === "MOEX_PAST_EXAM";
}

function addToken(tokens: Set<string>, token: string) {
  const normalized = normalizeRelatedText(token).replace(/^[-_]+|[-_]+$/g, "");
  if (normalized.length < 2 || RELATED_QUESTION_STOP_TOKENS.has(normalized)) return;
  tokens.add(normalized);
}

function addCjkNgrams(tokens: Set<string>, text: string) {
  for (const match of text.matchAll(/[\u4e00-\u9fff]+/gu)) {
    const phrase = match[0];
    const maxSize = Math.min(4, phrase.length);
    for (let size = 2; size <= maxSize; size += 1) {
      for (let index = 0; index <= phrase.length - size; index += 1) {
        addToken(tokens, phrase.slice(index, index + size));
      }
    }
  }
}

function buildQuestionSearchText(question: Question) {
  return [
    question.stem,
    question.options.A,
    question.options.B,
    question.options.C,
    question.options.D,
    question.options.E
  ]
    .filter(Boolean)
    .join(" ");
}

function buildQuestionTokens(question: Question) {
  const cached = relatedQuestionTokenCache.get(question);
  if (cached) return cached;

  const tokens = new Set<string>();
  const text = buildQuestionSearchText(question);
  const normalizedText = normalizeRelatedText(text);

  addCjkNgrams(tokens, normalizedText);
  for (const match of normalizedText.matchAll(/[a-z0-9][a-z0-9+_-]{1,}/gi)) {
    addToken(tokens, match[0]);
  }

  relatedQuestionTokenCache.set(question, tokens);
  return tokens;
}

function getTokenOverlapScore(currentTokens: Set<string>, candidateTokens: Set<string>) {
  if (currentTokens.size === 0 || candidateTokens.size === 0) return 0;

  let overlap = 0;
  let anchorScore = 0;
  for (const token of currentTokens) {
    if (!candidateTokens.has(token)) continue;
    overlap += 1;
    if (/^[a-z0-9]/i.test(token) && token.length >= 5) {
      anchorScore += 6;
    } else if (/^[\u4e00-\u9fff]+$/u.test(token) && token.length >= 4) {
      anchorScore += 2;
    }
  }

  if (overlap === 0) return 0;
  const denominator = Math.max(8, Math.min(currentTokens.size, candidateTokens.size));
  const broadOverlapScore = Math.round((overlap / denominator) * 35);
  return Math.min(35, Math.max(broadOverlapScore, anchorScore));
}

function getRelatedQuestionScore(currentQuestion: Question, currentTokens: Set<string>, candidate: RelatedQuestionCandidate) {
  const candidateQuestion = candidate.question;
  if (candidateQuestion.id === currentQuestion.id) return 0;
  if (candidateQuestion.subject !== currentQuestion.subject) return 0;

  const conceptKey = getConceptKey(currentQuestion);
  const sameConcept = Boolean(conceptKey && conceptKey === candidate.conceptKey);
  const currentPrimaryTagKey = getPrimaryTagKey(currentQuestion);
  const samePrimaryTag = Boolean(
    currentPrimaryTagKey && currentPrimaryTagKey === candidate.primaryTagKey
  );
  const sameChapter = getChapterKey(currentQuestion) === candidate.chapterKey;
  const sameSection = getSectionKey(currentQuestion) === candidate.sectionKey;
  const tokenScore = getTokenOverlapScore(currentTokens, buildQuestionTokens(candidateQuestion));
  const conceptHasTextSupport = samePrimaryTag || sameSection || sameChapter || tokenScore >= 16;

  if (samePrimaryTag && tokenScore < 6) return 0;
  if (!samePrimaryTag && !sameSection && tokenScore < 16) return 0;
  if (!samePrimaryTag && !sameSection && !sameChapter && tokenScore < 22) return 0;

  let score = tokenScore;
  if (samePrimaryTag) score += 18;
  else if (sameSection) score += 12;
  else if (sameChapter) score += 4;
  if (sameConcept && conceptHasTextSupport) score += 8;
  return score;
}

export function buildRelatedQuestionIndex(allQuestions: Question[]): RelatedQuestionIndex {
  const cached = relatedQuestionIndexCache.get(allQuestions);
  if (cached) return cached;

  const candidates = allQuestions
    .filter(isPastExamQuestion)
    .map((question) => ({
      question,
      conceptKey: getConceptKey(question),
      primaryTagKey: getPrimaryTagKey(question),
      chapterKey: getChapterKey(question),
      sectionKey: getSectionKey(question)
    }));
  const candidatesByPrimaryTag = new Map<string, RelatedQuestionCandidate[]>();
  const candidatesBySection = new Map<string, RelatedQuestionCandidate[]>();
  const candidatesBySubject = new Map<string, RelatedQuestionCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.primaryTagKey) {
      const primaryTagBucket = candidatesByPrimaryTag.get(candidate.primaryTagKey) ?? [];
      primaryTagBucket.push(candidate);
      candidatesByPrimaryTag.set(candidate.primaryTagKey, primaryTagBucket);
    }
    const sectionBucket = candidatesBySection.get(candidate.sectionKey) ?? [];
    sectionBucket.push(candidate);
    candidatesBySection.set(candidate.sectionKey, sectionBucket);

    const subjectBucket = candidatesBySubject.get(candidate.question.subject) ?? [];
    subjectBucket.push(candidate);
    candidatesBySubject.set(candidate.question.subject, subjectBucket);
  }

  const index = { candidatesByPrimaryTag, candidatesBySection, candidatesBySubject };
  relatedQuestionIndexCache.set(allQuestions, index);
  return index;
}

export function getRelatedQuestions(currentQuestion: Question, index: RelatedQuestionIndex, limit = 4) {
  const currentTokens = buildQuestionTokens(currentQuestion);
  const candidatePool = index.candidatesBySubject.get(currentQuestion.subject) ?? [];
  const ranked = candidatePool
    .filter((candidate) => candidate.question.subject === currentQuestion.subject)
    .map((candidate) => ({
      question: candidate.question,
      score: getRelatedQuestionScore(currentQuestion, currentTokens, candidate)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const rightYear = right.question.sourceYear ?? 0;
      const leftYear = left.question.sourceYear ?? 0;
      if (rightYear !== leftYear) return rightYear - leftYear;
      return left.question.id.localeCompare(right.question.id);
    });

  return ranked.slice(0, limit).map((item) => item.question);
}
