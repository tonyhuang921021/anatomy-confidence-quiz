import type { Question } from "@/types/quiz";
import { compactSearchText, normalizeSearchText } from "./searchTextNormalization";

const MEDICAL_SEARCH_FRAGMENTS = [
  "上肢",
  "下肢",
  "胸腔",
  "腹腔",
  "骨盆",
  "神經",
  "腎臟",
  "呼吸",
  "循環",
  "內分泌",
  "酸鹼",
  "免疫",
  "細菌",
  "病毒",
  "真菌",
  "寄生蟲",
  "藥理",
  "病理",
  "生化",
  "代謝"
] as const;

function addSearchTerm(target: Set<string>, rawTerm: string) {
  const term = normalizeSearchText(rawTerm);
  if (!term || term.length > 80) return;
  target.add(term);

  const strippedStudySuffix = term.replace(/學$/u, "").trim();
  if (strippedStudySuffix && strippedStudySuffix !== term) {
    target.add(strippedStudySuffix);
  }

  const compactTerm = compactSearchText(term);
  for (const fragment of MEDICAL_SEARCH_FRAGMENTS) {
    if (compactTerm.includes(compactSearchText(fragment))) {
      target.add(normalizeSearchText(fragment));
    }
  }
}

export function expandCustomPaperSearchTerms(terms: string[]) {
  const expanded = new Set<string>();

  for (const rawTerm of terms) {
    addSearchTerm(expanded, rawTerm);
    for (const item of rawTerm.split(/[／/、,，・·;；\n]+/u)) {
      addSearchTerm(expanded, item);
    }
  }

  return Array.from(expanded).slice(0, 24);
}

function fieldMatchScore(value: string | undefined, term: string, score: number) {
  if (!value) return 0;
  const normalizedValue = normalizeSearchText(value);
  if (normalizedValue.includes(term)) return score;

  const compactTerm = compactSearchText(term);
  if (compactTerm.length >= 2 && compactSearchText(normalizedValue).includes(compactTerm)) {
    return Math.max(1, score - 2);
  }

  return 0;
}

export function scoreCustomPaperSearchQuestion(question: Question, terms: string[]) {
  let score = 0;
  let strongMatches = 0;

  for (const term of terms.map(normalizeSearchText).filter(Boolean)) {
    const subjectScore = fieldMatchScore(question.subject, term, 12);
    const chapterScore = fieldMatchScore(question.chapter, term, 14);
    const sectionScore = fieldMatchScore(question.section, term, 14);
    const stemScore = fieldMatchScore(question.stem, term, 9);
    const optionScore = Math.max(
      0,
      ...Object.values(question.options ?? {}).map((option) => fieldMatchScore(option, term, 5))
    );

    const strongScore = subjectScore + chapterScore + sectionScore + stemScore + optionScore;
    if (strongScore > 0) strongMatches += 1;
    score += strongScore;

    // These fields are useful tie-breakers, but must never pull a question in alone.
    score += fieldMatchScore(question.testedConcept, term, 2);
    score += fieldMatchScore(question.explanation, term, 1);
  }

  return {
    score,
    strongMatches
  };
}

export function rankCustomPaperSearchCandidates(
  questions: Question[],
  terms: string[],
  limit = 80
) {
  return questions
    .map((question) => ({
      question,
      ...scoreCustomPaperSearchQuestion(question, terms)
    }))
    .filter((item) => item.strongMatches > 0 && item.score >= 5)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.strongMatches - left.strongMatches ||
        left.question.id.localeCompare(right.question.id)
    )
    .slice(0, limit);
}

export function orderCustomPaperSearchResults(
  candidates: Question[],
  relevantIds: string[]
) {
  const byId = new Map(candidates.map((question) => [question.id, question] as const));
  const selected: Question[] = [];
  const seen = new Set<string>();

  for (const id of relevantIds) {
    const question = byId.get(id);
    if (!question || seen.has(id)) continue;
    seen.add(id);
    selected.push(question);
  }

  return selected;
}
