import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { compactSearchText, normalizeSearchText } from "./searchTextNormalization";
import type { Question, QuizSettings } from "../types/quiz";

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

function includesSearchTerm(value: string, term: string) {
  if (!value || !term) return false;
  if (!/^[a-z]{1,3}$/.test(term)) return value.includes(term);

  let startIndex = value.indexOf(term);
  while (startIndex >= 0) {
    const before = value[startIndex - 1] ?? "";
    const after = value[startIndex + term.length] ?? "";
    const hasLetterBefore = /[a-z]/.test(before);
    const hasLetterAfter = /[a-z]/.test(after);
    if (!hasLetterBefore && !hasLetterAfter) return true;
    startIndex = value.indexOf(term, startIndex + 1);
  }

  return false;
}

function includesSearchPhrase(value: string, keyword: string, tokens: string[]) {
  return tokens.length === 1
    ? includesSearchTerm(value, tokens[0])
    : value.includes(keyword);
}

function getSearchScore(entry: QuestionSearchIndexEntry, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword).trim();
  if (!normalizedKeyword) return 0;

  const compactKeyword = compactSearchText(keyword);
  const tokens = normalizedKeyword.split(/\s+/).filter(Boolean);
  const tokensMatch = tokens.every((token) => {
    if (
      includesSearchTerm(entry.normalizedIdentity, token) ||
      includesSearchTerm(entry.normalizedStem, token) ||
      includesSearchTerm(entry.normalizedOptions, token) ||
      includesSearchTerm(entry.normalizedClassification, token) ||
      includesSearchTerm(entry.normalizedSecondary, token)
    ) {
      return true;
    }
    const compactToken = compactSearchText(token);
    return !/^[a-z]{1,3}$/.test(token) && compactToken.length > 0 && entry.compactAll.includes(compactToken);
  });
  const compactPhraseMatches =
    tokens.every((token) => !/^[a-z]{1,3}$/.test(token)) &&
    compactKeyword.length > 0 &&
    entry.compactAll.includes(compactKeyword);
  if (!tokensMatch && !compactPhraseMatches) return null;

  let score = 0;
  if (entry.normalizedIdentity === normalizedKeyword) score += 2400;
  else if (includesSearchPhrase(entry.normalizedIdentity, normalizedKeyword, tokens)) score += 1200;
  if (includesSearchPhrase(entry.normalizedStem, normalizedKeyword, tokens)) score += 900;
  if (includesSearchPhrase(entry.normalizedOptions, normalizedKeyword, tokens)) score += 650;
  if (includesSearchPhrase(entry.normalizedClassification, normalizedKeyword, tokens)) score += 550;
  if (includesSearchPhrase(entry.normalizedSecondary, normalizedKeyword, tokens)) score += 120;
  if (compactPhraseMatches) score += 80;

  for (const token of tokens) {
    if (includesSearchTerm(entry.normalizedStem, token)) score += 90;
    else if (includesSearchTerm(entry.normalizedOptions, token)) score += 70;
    else if (includesSearchTerm(entry.normalizedClassification, token)) score += 60;
    else if (includesSearchTerm(entry.normalizedIdentity, token)) score += 50;
    else if (includesSearchTerm(entry.normalizedSecondary, token)) score += 10;
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

const QUESTION_SEARCH_SORT_LABELS: Record<QuestionSearchSort, string> = {
  recent: "近年優先",
  oldest: "早年優先",
  accuracy_asc: "答對率低到高",
  accuracy_desc: "答對率高到低",
  chaos_desc: "最多人放棄"
};

export function buildSearchFilterSummary(input: {
  keyword: string;
  subject: string;
  year: string;
  sort: QuestionSearchSort;
  browseAll?: boolean;
}) {
  const parts: string[] = [];
  const keyword = input.keyword.trim();
  if (keyword) parts.push(`「${keyword}」`);
  if (input.subject !== "全部") parts.push(input.subject);
  if (input.year !== "全部") parts.push(`${input.year} 年`);
  if (parts.length === 0 && input.browseAll) parts.push("全部題庫");
  parts.push(QUESTION_SEARCH_SORT_LABELS[input.sort]);
  return parts.join(" · ");
}

export function buildSearchPracticeSettings(questions: Question[]): QuizSettings | null {
  const uniqueQuestions = Array.from(
    new Map(questions.filter(Boolean).map((question) => [question.id, question] as const)).values()
  );
  if (uniqueQuestions.length === 0) return null;

  const subjectFilters = Array.from(
    new Set(uniqueQuestions.map((question) => question.subject))
  );
  const subjectFilter = subjectFilters.length === 1 ? subjectFilters[0] : "全部";
  const subjectLabel = subjectFilters.length === 1 ? subjectFilters[0] : "混合科目";

  return {
    mode: "search_practice",
    questionCount: uniqueQuestions.length,
    sessionName: `搜尋私人練習・${subjectLabel}（${uniqueQuestions.length} 題）`,
    customPoolLabel: "搜尋私人練習",
    subjectFilter,
    subjectFilters,
    excludeAiGenerated: true,
    excludePreviouslyAnswered: false,
    strictCustomQuestionPool: true,
    preserveCustomQuestionOrder: true,
    enableConfidenceCalibration: false,
    feedbackMode: "full",
    customQuestionIds: uniqueQuestions.map((question) => question.id)
  };
}
