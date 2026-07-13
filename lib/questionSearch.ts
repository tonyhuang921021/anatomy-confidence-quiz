import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { compactSearchText, normalizeSearchText } from "./searchTextNormalization";
import type { Question } from "../types/quiz";

export type QuestionSearchSort =
  | "recent"
  | "oldest"
  | "accuracy_asc"
  | "accuracy_desc"
  | "chaos_desc";

export type QuestionSearchRanking = {
  questionId: string;
  totalAttempts: number;
  correctRate: number;
  chaosCount: number;
};

export type QuestionSearchIndexEntry = {
  question: Question;
  normalizedIdentity: string;
  normalizedStem: string;
  normalizedOptions: string;
  normalizedClassification: string;
  normalizedSecondary: string;
  compactAll: string;
};

function joinSearchTerms(values: Array<string | number | null | undefined>) {
  return values.filter((value) => value !== null && value !== undefined && String(value).trim()).join(" ");
}

export function buildQuestionSearchIndexEntry(question: Question): QuestionSearchIndexEntry {
  const examCode = question.examCode ? String(question.examCode) : "";
  const paperCode = question.paperCode ? String(question.paperCode) : "";
  const questionCode = question.id.match(/Q\d+$/)?.[0] ?? "";
  const identity = joinSearchTerms([
    question.id,
    question.sourceCitation,
    examCode,
    paperCode,
    examCode && paperCode ? `${examCode}-${paperCode}` : "",
    examCode && paperCode ? `${examCode}_${paperCode}` : "",
    examCode && paperCode ? `${examCode}${paperCode}` : "",
    questionCode
  ]);
  const stem = question.stem;
  const options = joinSearchTerms(Object.values(question.options));
  const classification = joinSearchTerms([
    question.subject,
    question.chapter,
    question.section,
    getQuestionPrimaryTag(question)
  ]);
  const secondary = joinSearchTerms([
    question.testedConcept,
    question.explanation,
    question.memoryTip,
    ...Object.values(question.optionAnalysis ?? {})
  ]);
  const primary = joinSearchTerms([identity, stem, options, classification]);
  const all = joinSearchTerms([primary, secondary]);

  return {
    question,
    normalizedIdentity: normalizeSearchText(identity),
    normalizedStem: normalizeSearchText(stem),
    normalizedOptions: normalizeSearchText(options),
    normalizedClassification: normalizeSearchText(classification),
    normalizedSecondary: normalizeSearchText(secondary),
    compactAll: compactSearchText(all)
  };
}

function getSearchScore(entry: QuestionSearchIndexEntry, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword).trim();
  if (!normalizedKeyword) return 0;

  const compactKeyword = compactSearchText(keyword);
  const tokens = normalizedKeyword.split(/\s+/).filter(Boolean);
  const tokensMatch = tokens.every((token) => {
    if (
      entry.normalizedIdentity.includes(token) ||
      entry.normalizedStem.includes(token) ||
      entry.normalizedOptions.includes(token) ||
      entry.normalizedClassification.includes(token) ||
      entry.normalizedSecondary.includes(token)
    ) {
      return true;
    }
    const compactToken = compactSearchText(token);
    return compactToken.length > 0 && entry.compactAll.includes(compactToken);
  });
  const compactPhraseMatches = compactKeyword.length > 0 && entry.compactAll.includes(compactKeyword);
  if (!tokensMatch && !compactPhraseMatches) return null;

  let score = 0;
  if (entry.normalizedIdentity === normalizedKeyword) score += 2400;
  else if (entry.normalizedIdentity.includes(normalizedKeyword)) score += 1200;
  if (entry.normalizedStem.includes(normalizedKeyword)) score += 900;
  if (entry.normalizedOptions.includes(normalizedKeyword)) score += 650;
  if (entry.normalizedClassification.includes(normalizedKeyword)) score += 550;
  if (entry.normalizedSecondary.includes(normalizedKeyword)) score += 120;
  if (compactKeyword && entry.compactAll.includes(compactKeyword)) score += 80;

  for (const token of tokens) {
    if (entry.normalizedStem.includes(token)) score += 90;
    else if (entry.normalizedOptions.includes(token)) score += 70;
    else if (entry.normalizedClassification.includes(token)) score += 60;
    else if (entry.normalizedIdentity.includes(token)) score += 50;
    else if (entry.normalizedSecondary.includes(token)) score += 10;
  }

  return score;
}

function compareQuestionDate(left: Question, right: Question, oldestFirst = false) {
  const missingYear = oldestFirst ? Infinity : -Infinity;
  const yearLeft = left.sourceYear ?? missingYear;
  const yearRight = right.sourceYear ?? missingYear;
  if (yearLeft !== yearRight) return oldestFirst ? yearLeft - yearRight : yearRight - yearLeft;

  const examComparison = (left.examCode ?? "").localeCompare(right.examCode ?? "");
  if (examComparison !== 0) return oldestFirst ? examComparison : -examComparison;
  const paperComparison = (left.paperCode ?? "").localeCompare(right.paperCode ?? "");
  if (paperComparison !== 0) return oldestFirst ? paperComparison : -paperComparison;

  const questionLeft = left.originalQuestionNumber ?? missingYear;
  const questionRight = right.originalQuestionNumber ?? missingYear;
  if (questionLeft !== questionRight) {
    return oldestFirst ? questionLeft - questionRight : questionRight - questionLeft;
  }
  return oldestFirst ? left.id.localeCompare(right.id) : right.id.localeCompare(left.id);
}

function compareByAccuracy(
  left: Question,
  right: Question,
  rankings: Record<string, QuestionSearchRanking>,
  ascending: boolean
) {
  const leftRanking = rankings[left.id];
  const rightRanking = rankings[right.id];
  const leftHasData = Boolean(leftRanking && leftRanking.totalAttempts > 0);
  const rightHasData = Boolean(rightRanking && rightRanking.totalAttempts > 0);
  if (leftHasData !== rightHasData) return leftHasData ? -1 : 1;
  if (!leftHasData || !rightHasData) return 0;
  if (leftRanking.correctRate !== rightRanking.correctRate) {
    return ascending
      ? leftRanking.correctRate - rightRanking.correctRate
      : rightRanking.correctRate - leftRanking.correctRate;
  }
  if (leftRanking.totalAttempts !== rightRanking.totalAttempts) {
    return rightRanking.totalAttempts - leftRanking.totalAttempts;
  }
  return 0;
}

function compareByChaos(
  left: Question,
  right: Question,
  rankings: Record<string, QuestionSearchRanking>
) {
  const leftCount = rankings[left.id]?.chaosCount ?? 0;
  const rightCount = rankings[right.id]?.chaosCount ?? 0;
  const leftHasData = leftCount > 0;
  const rightHasData = rightCount > 0;
  if (leftHasData !== rightHasData) return leftHasData ? -1 : 1;
  if (leftCount !== rightCount) return rightCount - leftCount;
  return 0;
}

export function filterAndSortQuestionSearch(input: {
  entries: QuestionSearchIndexEntry[];
  keyword: string;
  subject: string;
  year: string;
  sort: QuestionSearchSort;
  rankings?: Record<string, QuestionSearchRanking>;
}) {
  const rankings = input.rankings ?? {};
  const scored = input.entries
    .filter(({ question }) => {
      if (input.subject !== "全部" && question.subject !== input.subject) return false;
      return input.year === "全部" || String(question.sourceYear ?? "") === input.year;
    })
    .map((entry) => ({ entry, score: getSearchScore(entry, input.keyword) }))
    .filter(
      (item): item is { entry: QuestionSearchIndexEntry; score: number } =>
        item.score !== null
    );

  scored.sort((left, right) => {
    let selectedSortComparison = 0;
    if (input.sort === "oldest") {
      selectedSortComparison = compareQuestionDate(left.entry.question, right.entry.question, true);
    }
    if (input.sort === "accuracy_asc") {
      selectedSortComparison = compareByAccuracy(left.entry.question, right.entry.question, rankings, true);
    }
    if (input.sort === "accuracy_desc") {
      selectedSortComparison = compareByAccuracy(left.entry.question, right.entry.question, rankings, false);
    }
    if (input.sort === "chaos_desc") {
      selectedSortComparison = compareByChaos(left.entry.question, right.entry.question, rankings);
    }
    if (selectedSortComparison !== 0) return selectedSortComparison;
    if (input.keyword.trim() && left.score !== right.score) return right.score - left.score;
    if (input.sort === "oldest") return 0;
    return compareQuestionDate(left.entry.question, right.entry.question);
  });

  return scored.map(({ entry }) => entry.question);
}

export function isQuestionSearchStatsSort(sort: QuestionSearchSort) {
  return sort === "accuracy_asc" || sort === "accuracy_desc" || sort === "chaos_desc";
}
