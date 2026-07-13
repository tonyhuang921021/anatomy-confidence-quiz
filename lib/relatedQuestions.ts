import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { normalizeSearchText } from "./searchTextNormalization";
import type { Question } from "@/types/quiz";

type RelatedQuestionCandidate = {
  question: Question;
  conceptKey: string;
  primaryTagKey: string;
  chapterKey: string;
  sectionKey: string;
  aiFallbackTokens: Set<string>;
  aiFallbackStemTokens: Set<string>;
  aiFallbackOptionTokens: Set<string>;
  aiFallbackCorrectOptionTokens: Set<string>;
};

export type RelatedQuestionIndex = {
  candidatesByPrimaryTag: Map<string, RelatedQuestionCandidate[]>;
  candidatesBySection: Map<string, RelatedQuestionCandidate[]>;
  candidatesBySubject: Map<string, RelatedQuestionCandidate[]>;
  aiTokenDocumentFrequencyBySubject: Map<string, Map<string, number>>;
};

const relatedQuestionIndexCache = new WeakMap<Question[], RelatedQuestionIndex>();
const relatedQuestionTokenCache = new WeakMap<Question, Set<string>>();
const aiFallbackCandidateTokenCache = new WeakMap<
  Question,
  {
    all: Set<string>;
    correctOptions: Set<string>;
    stem: Set<string>;
    options: Set<string>;
  }
>();

const AI_FALLBACK_MIN_SCORE = 14;
const AI_FALLBACK_MIN_RELATIVE_SCORE = 0.6;
const AI_FALLBACK_MAX_DOCUMENT_RATIO = 0.1;
const AI_FALLBACK_ANCHOR_MAX_DOCUMENT_RATIO = 0.05;
const AI_FALLBACK_RARE_LATIN_MAX_DOCUMENT_RATIO = 0.02;
const AI_FALLBACK_RARE_DIGIT_STEM_BONUS = 70;
const AI_FALLBACK_ANSWER_WEIGHT = 2;
const AI_FALLBACK_CONCEPT_WEIGHT = 1.15;
const AI_FALLBACK_STEM_WEIGHT = 0.55;

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

const AI_FALLBACK_STOP_LATIN_TOKENS = new Set([
  ...RELATED_QUESTION_STOP_TOKENS,
  "acid-fast",
  "bacteria",
  "bacterial",
  "bacterium",
  "cell",
  "cells",
  "disease",
  "diseases",
  "extracellular",
  "filamentous",
  "gram-negative",
  "gram-positive",
  "infection",
  "infections",
  "intracellular",
  "negative",
  "patient",
  "patients",
  "positive",
  "protein",
  "proteins",
  "receptor",
  "receptors",
  "syndrome"
]);

const AI_FALLBACK_STOP_CJK_FRAGMENTS = [
  "下列",
  "何者",
  "關於",
  "敘述",
  "正確",
  "錯誤",
  "最可能",
  "可能",
  "主要",
  "造成",
  "產生",
  "作用",
  "病人",
  "患者",
  "符合",
  "臨床",
  "直接",
  "較為",
  "最適當",
  "最不適當"
];

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

function buildQuestionOptionSearchText(question: Question) {
  return [
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

function isAiFallbackStopToken(token: string) {
  if (/^[a-z0-9]/i.test(token)) {
    return AI_FALLBACK_STOP_LATIN_TOKENS.has(token);
  }

  return AI_FALLBACK_STOP_CJK_FRAGMENTS.some((fragment) => token.includes(fragment));
}

function buildAiFallbackTokens(text?: string | null) {
  const tokens = new Set<string>();
  const normalizedText = normalizeRelatedText(text);

  for (const match of normalizedText.matchAll(/[\u4e00-\u9fff]+/gu)) {
    const phrase = match[0];
    const maxSize = Math.min(4, phrase.length);
    for (let size = 3; size <= maxSize; size += 1) {
      for (let index = 0; index <= phrase.length - size; index += 1) {
        const token = phrase.slice(index, index + size);
        if (!isAiFallbackStopToken(token)) tokens.add(token);
      }
    }
  }

  for (const match of normalizedText.matchAll(/[a-z0-9][a-z0-9+_-]{2,}/gi)) {
    const token = match[0].replace(/^[-_]+|[-_]+$/g, "");
    if (!isAiFallbackStopToken(token)) tokens.add(token);
  }

  return tokens;
}

function buildAiFallbackCandidateTokens(question: Question) {
  const cached = aiFallbackCandidateTokenCache.get(question);
  if (cached) return cached;

  const stem = buildAiFallbackTokens(question.stem);
  const options = buildAiFallbackTokens(buildQuestionOptionSearchText(question));
  const correctOptions = buildAiFallbackTokens(getCorrectOptionText(question));
  const tokens = {
    all: new Set([...stem, ...options]),
    correctOptions,
    stem,
    options
  };
  aiFallbackCandidateTokenCache.set(question, tokens);
  return tokens;
}

function getCorrectOptionText(question: Question) {
  const answerKeys = question.acceptedAnswers?.length
    ? question.acceptedAnswers
    : [question.answer];

  return answerKeys
    .map((answer) => question.options[answer])
    .filter((option): option is string => Boolean(option))
    .join(" ");
}

function isAiFallbackAnchor(token: string, documentRatio: number) {
  if (documentRatio > AI_FALLBACK_ANCHOR_MAX_DOCUMENT_RATIO) return false;
  if (/^[a-z0-9]/i.test(token)) {
    return token.length >= 4 || (token.length >= 3 && /\d/.test(token));
  }
  return /^[\u4e00-\u9fff]+$/u.test(token) && token.length >= 4;
}

function getAiFallbackTokenWeight(token: string) {
  if (/^[a-z0-9]/i.test(token)) {
    if (token.length >= 3 && /\d/.test(token)) return 2.2;
    return token.length >= 5 ? 1.7 : 1;
  }
  return token.length >= 4 ? 1.35 : 1;
}

function isRareLatinConceptToken(token: string, documentRatio: number) {
  if (!/^[a-z0-9]/i.test(token)) return false;
  if (documentRatio > AI_FALLBACK_RARE_LATIN_MAX_DOCUMENT_RATIO) return false;
  return token.length >= 6 || (token.length >= 3 && /\d/.test(token));
}

function getAiFallbackQuestionScore(
  currentQuestion: Question,
  candidate: RelatedQuestionCandidate,
  documentFrequency: Map<string, number>,
  subjectQuestionCount: number,
  answerTokens: Set<string>,
  conceptTokens: Set<string>,
  stemTokens: Set<string>
) {
  if (candidate.question.id === currentQuestion.id) return null;

  let score = 0;
  let answerAnchorCount = 0;
  let conceptAnchorCount = 0;
  let hasRareLatinConcept = false;
  let hasRareDigitStemConcept = false;
  let hasStemCoreAnchor = false;
  let hasStemContextAnchor = false;
  let hasRareCorrectOptionCoreAnchor = false;
  const correctOptionCoreAnchors = new Set<string>();
  const optionOnlyCoreAnchors = new Set<string>();
  const queryTokens = new Set([...answerTokens, ...conceptTokens, ...stemTokens]);

  for (const token of queryTokens) {
    if (!candidate.aiFallbackTokens.has(token)) continue;

    const frequency = documentFrequency.get(token) ?? subjectQuestionCount;
    const documentRatio = frequency / subjectQuestionCount;
    if (documentRatio > AI_FALLBACK_MAX_DOCUMENT_RATIO) continue;

    let fieldWeight = stemTokens.has(token) ? AI_FALLBACK_STEM_WEIGHT : 0;
    if (conceptTokens.has(token)) {
      fieldWeight = Math.max(fieldWeight, AI_FALLBACK_CONCEPT_WEIGHT);
    }
    if (answerTokens.has(token)) {
      fieldWeight = Math.max(fieldWeight, AI_FALLBACK_ANSWER_WEIGHT);
    }

    const inverseDocumentFrequency = Math.log2(
      (subjectQuestionCount + 1) / (frequency + 1)
    );
    const candidateFieldWeight = candidate.aiFallbackStemTokens.has(token)
      ? 1.25
      : candidate.aiFallbackCorrectOptionTokens.has(token)
        ? 1
        : 0.7;
    score +=
      inverseDocumentFrequency *
      getAiFallbackTokenWeight(token) *
      fieldWeight *
      candidateFieldWeight;

    if (!isAiFallbackAnchor(token, documentRatio)) continue;
    if (answerTokens.has(token)) answerAnchorCount += 1;
    if (conceptTokens.has(token)) {
      conceptAnchorCount += 1;
      if (isRareLatinConceptToken(token, documentRatio)) {
        hasRareLatinConcept = true;
        if (/\d/.test(token) && candidate.aiFallbackStemTokens.has(token)) {
          hasRareDigitStemConcept = true;
        }
      }
    }

    if (answerTokens.has(token) || conceptTokens.has(token)) {
      if (candidate.aiFallbackStemTokens.has(token)) {
        hasStemCoreAnchor = true;
      } else if (candidate.aiFallbackCorrectOptionTokens.has(token)) {
        correctOptionCoreAnchors.add(token);
        if (isRareLatinConceptToken(token, documentRatio)) {
          hasRareCorrectOptionCoreAnchor = true;
        }
      } else if (candidate.aiFallbackOptionTokens.has(token)) {
        optionOnlyCoreAnchors.add(token);
      }
    }
    if (stemTokens.has(token) && candidate.aiFallbackStemTokens.has(token)) {
      hasStemContextAnchor = true;
    }
  }

  if (hasRareDigitStemConcept) score += AI_FALLBACK_RARE_DIGIT_STEM_BONUS;

  const hasCoreEvidence =
    answerAnchorCount >= 1 || conceptAnchorCount >= 2 || hasRareLatinConcept;
  const hasCandidateTextEvidence =
    hasStemCoreAnchor ||
    correctOptionCoreAnchors.size >= 2 ||
    hasRareCorrectOptionCoreAnchor ||
    (optionOnlyCoreAnchors.size >= 2 && hasStemContextAnchor);
  if (!hasCoreEvidence || !hasCandidateTextEvidence || score < AI_FALLBACK_MIN_SCORE) {
    return null;
  }

  return score;
}

function getAiFallbackQuestions(
  currentQuestion: Question,
  index: RelatedQuestionIndex,
  excludedQuestionIds: Set<string>
) {
  const candidatePool = index.candidatesBySubject.get(currentQuestion.subject) ?? [];
  if (candidatePool.length === 0) return [];

  const documentFrequency =
    index.aiTokenDocumentFrequencyBySubject.get(currentQuestion.subject) ?? new Map();
  const answerTokens = buildAiFallbackTokens(getCorrectOptionText(currentQuestion));
  const conceptTokens = buildAiFallbackTokens(
    currentQuestion.testedConcept || currentQuestion.stem
  );
  const stemTokens = buildAiFallbackTokens(currentQuestion.stem);
  const ranked = candidatePool
    .filter((candidate) => !excludedQuestionIds.has(candidate.question.id))
    .map((candidate) => ({
      question: candidate.question,
      score: getAiFallbackQuestionScore(
        currentQuestion,
        candidate,
        documentFrequency,
        candidatePool.length,
        answerTokens,
        conceptTokens,
        stemTokens
      )
    }))
    .filter((item): item is { question: Question; score: number } => item.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const rightYear = right.question.sourceYear ?? 0;
      const leftYear = left.question.sourceYear ?? 0;
      if (rightYear !== leftYear) return rightYear - leftYear;
      return left.question.id.localeCompare(right.question.id);
    });

  const strongestScore = ranked[0]?.score;
  if (!strongestScore) return [];

  return ranked
    .filter((item) => item.score >= strongestScore * AI_FALLBACK_MIN_RELATIVE_SCORE)
    .map((item) => item.question);
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
    .map((question) => {
      const aiFallbackTokens = buildAiFallbackCandidateTokens(question);
      return {
        question,
        conceptKey: getConceptKey(question),
        primaryTagKey: getPrimaryTagKey(question),
        chapterKey: getChapterKey(question),
        sectionKey: getSectionKey(question),
        aiFallbackTokens: aiFallbackTokens.all,
        aiFallbackCorrectOptionTokens: aiFallbackTokens.correctOptions,
        aiFallbackStemTokens: aiFallbackTokens.stem,
        aiFallbackOptionTokens: aiFallbackTokens.options
      };
    });
  const candidatesByPrimaryTag = new Map<string, RelatedQuestionCandidate[]>();
  const candidatesBySection = new Map<string, RelatedQuestionCandidate[]>();
  const candidatesBySubject = new Map<string, RelatedQuestionCandidate[]>();
  const aiTokenDocumentFrequencyBySubject = new Map<string, Map<string, number>>();

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

    const documentFrequency =
      aiTokenDocumentFrequencyBySubject.get(candidate.question.subject) ?? new Map<string, number>();
    for (const token of candidate.aiFallbackTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
    aiTokenDocumentFrequencyBySubject.set(candidate.question.subject, documentFrequency);
  }

  const index = {
    candidatesByPrimaryTag,
    candidatesBySection,
    candidatesBySubject,
    aiTokenDocumentFrequencyBySubject
  };
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

  const strictMatches = ranked.slice(0, limit).map((item) => item.question);
  if (currentQuestion.sourceType !== "AI_GENERATED" || strictMatches.length >= limit) {
    return strictMatches;
  }

  const excludedQuestionIds = new Set(strictMatches.map((question) => question.id));
  const fallbackMatches = getAiFallbackQuestions(
    currentQuestion,
    index,
    excludedQuestionIds
  );

  return [...strictMatches, ...fallbackMatches].slice(0, limit);
}
