import { MED1_SUBJECTS, MED2_SUBJECTS } from "../data/subjectOrder";
import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { normalizeWrongQuestionPdfText, tokenizeWrongQuestionPdfText } from "./wrongQuestionPdfText";
import { prepareWrongQuestionPdfQuestion } from "./wrongQuestionPdfSourceText";
import { isFullReviewYearRange, normalizeReviewYearRange, type ReviewYearRange } from "./reviewYearFilter";
import type { OptionKey, Question, QuizSession } from "../types/quiz";

export type WrongQuestionPdfScope = "current" | "history";
export type WrongQuestionPdfFilters = {
  subject: string;
  chapter: string;
  dateFrom: string;
  dateTo: string;
  recentCount?: number;
};
export type WrongQuestionPdfHistoryScope = {
  label: string;
  includesSession: (session: QuizSession) => boolean;
  yearRange?: ReviewYearRange;
  subjects?: readonly string[];
};

export function getWrongQuestionPdfYearLabel(range?: ReviewYearRange) {
  if (!range || isFullReviewYearRange(range)) return "全部考題年份";
  const { yearFrom, yearTo } = normalizeReviewYearRange(range);
  return yearFrom === yearTo ? `${yearFrom} 年考題` : `${yearFrom}–${yearTo} 年考題`;
}

export type WrongQuestionPdfItem = { question: Question; chapter: string; answeredAt: string };
export const EMPTY_PDF_FILTERS: WrongQuestionPdfFilters = {
  subject: "", chapter: "", dateFrom: "", dateTo: ""
};
const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];
const SUBJECT_ORDER = new Map([...MED1_SUBJECTS, ...MED2_SUBJECTS].map((subject, index) => [subject, index]));

function getPdfExamYear(question: Question) {
  const year = question.sourceYear;
  if (!year || !Number.isFinite(year) || year < 0) return 0;
  return year >= 1912 ? year : year + 1911;
}

function getPdfPaperKey(question: Question) {
  const sourceId = question.id.match(/^MOEX-([^-]+)-([^-]+)-Q\d+/);
  return [question.examCode || sourceId?.[1] || "", question.paperCode || sourceId?.[2] || ""].join("/");
}

function getPdfQuestionNumber(question: Question) {
  const number = question.originalQuestionNumber;
  return number !== undefined && Number.isInteger(number) && number > 0 ? number : Number.MAX_SAFE_INTEGER;
}

function comparePdfQuestions(left: Question, right: Question) {
  const subjectComparison =
    (SUBJECT_ORDER.get(left.subject) ?? Number.MAX_SAFE_INTEGER) - (SUBJECT_ORDER.get(right.subject) ?? Number.MAX_SAFE_INTEGER) ||
    left.subject.localeCompare(right.subject, "zh-Hant");
  if (subjectComparison) return subjectComparison;

  const examComparison = getPdfExamYear(right) - getPdfExamYear(left) ||
    (right.sourceRound ?? 0) - (left.sourceRound ?? 0);
  if (examComparison) return examComparison;

  const leftPaper = getPdfPaperKey(left);
  const rightPaper = getPdfPaperKey(right);
  const paperComparison = Number(leftPaper === "/") - Number(rightPaper === "/") ||
    leftPaper.localeCompare(rightPaper, "en", { numeric: true });
  return paperComparison || getPdfQuestionNumber(left) - getPdfQuestionNumber(right) ||
    left.id.localeCompare(right.id, "en", { numeric: true });
}

export function getPdfChapter(question: Question) {
  // Use the same verified classification that the results analysis displays.
  if (question.subject === "解剖學" && question.chapter && !([question.subject, "醫學（一）", "醫學（二）", "其他醫學一"] as string[]).includes(question.chapter)) return question.chapter;
  const tag = getQuestionPrimaryTag(question);
  const cleaned = tag?.replace(new RegExp(`^${question.subject}[－—：:/\\s]+`), "");
  return [cleaned, question.chapter, question.section].find((label) => label?.trim() && label.trim() !== question.subject)?.trim() || "未細分章節";
}

export function taiwanAnswerDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function collectWrongQuestionPdfItems(
  sessions: readonly QuizSession[],
  questions: readonly Question[],
  filters: WrongQuestionPdfFilters = EMPTY_PDF_FILTERS,
  historyScope?: WrongQuestionPdfHistoryScope
) {
  const sourceSessions = historyScope ? sessions.filter(historyScope.includesSession) : sessions;
  const yearRange = historyScope?.yearRange ? normalizeReviewYearRange(historyScope.yearRange) : undefined;
  const includeUnknownYears = !yearRange || isFullReviewYearRange(yearRange);
  const questionMap = new Map<string, Question>();
  for (const session of sourceSessions) {
    for (const question of [...(session.generatedQuestions ?? []), ...(session.settings?.customQuestionPayload ?? [])]) {
      questionMap.set(question.id, question);
    }
  }
  // Canonical question data and current classification take priority over older snapshots.
  for (const question of questions) questionMap.set(question.id, question);
  const recentCount = Number.isSafeInteger(filters.recentCount) && filters.recentCount! > 0 ? filters.recentCount : undefined;
  const selected = new Map<string, WrongQuestionPdfItem>();
  const missingQuestionIds = new Set<string>();
  const unknownDateQuestionIds = new Set<string>();
  for (const session of sourceSessions) {
    if (!session.completedAt) continue;
    for (const attempt of session.attempts) {
      if (attempt.isCorrect !== false || !OPTION_KEYS.includes(attempt.selectedAnswer)) continue;
      const day = taiwanAnswerDate(attempt.answeredAt);
      if (day && ((filters.dateFrom && day < filters.dateFrom) || (filters.dateTo && day > filters.dateTo))) continue;
      const question = questionMap.get(attempt.questionId);
      if (!question) {
        if ((filters.dateFrom || filters.dateTo || recentCount) && !day) {
          unknownDateQuestionIds.add(attempt.questionId);
          continue;
        }
        missingQuestionIds.add(attempt.questionId);
        continue;
      }
      if (historyScope?.subjects?.length && !historyScope.subjects.includes(question.subject)) continue;
      // Match the review page: AI and undated questions belong only to the full year range.
      const sourceYear = question.sourceType === "AI_GENERATED" || question.source === "ai-generated"
        ? 0 : getPdfExamYear(question);
      if (yearRange && (sourceYear
        ? sourceYear < yearRange.yearFrom || sourceYear > yearRange.yearTo
        : !includeUnknownYears)) continue;
      const chapter = getPdfChapter(question);
      if (filters.subject && question.subject !== filters.subject) continue;
      if (filters.chapter && chapter !== filters.chapter) continue;
      if ((filters.dateFrom || filters.dateTo || recentCount) && !day) {
        unknownDateQuestionIds.add(attempt.questionId);
        continue;
      }
      const previous = selected.get(question.id);
      if (!previous || (day && (!taiwanAnswerDate(previous.answeredAt) || Date.parse(attempt.answeredAt) > Date.parse(previous.answeredAt)))) {
        selected.set(question.id, { question, chapter, answeredAt: attempt.answeredAt });
      }
    }
  }
  for (const id of selected.keys()) unknownDateQuestionIds.delete(id);
  let items = [...selected.values()];
  if (recentCount) {
    items = items.sort((left, right) =>
      Date.parse(right.answeredAt) - Date.parse(left.answeredAt) || comparePdfQuestions(left.question, right.question)
    ).slice(0, recentCount);
  }
  items.sort((left, right) => comparePdfQuestions(left.question, right.question));
  return { items, missingQuestionCount: missingQuestionIds.size, unknownDateCount: unknownDateQuestionIds.size };
}

function escapeHtml(value: string) {
  return normalizeWrongQuestionPdfText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]!));
}

function formatText(value: string) {
  return tokenizeWrongQuestionPdfText(value).map((token) =>
    escapeHtml(token.text) +
    (token.subscript ? `<sub>${escapeHtml(token.subscript)}</sub>` : "") +
    (token.superscript ? `<sup>${escapeHtml(token.superscript)}</sup>` : "")
  ).join("");
}

function imageMarkup(src: string | undefined, label: string, baseUrl: string) {
  if (!src) return "";
  try {
    const url = new URL(src, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return `<p class="image-error">${escapeHtml(label)}無法載入</p>`;
    return `<img src="${escapeHtml(url.href)}" alt="${escapeHtml(label)}" loading="eager" decoding="sync">`;
  } catch {
    return `<p class="image-error">${escapeHtml(label)}無法載入</p>`;
  }
}

export function buildWrongQuestionPdfHtml({ items, spacingCm, scopeLabel, dateLabel, baseUrl }: {
  items: readonly WrongQuestionPdfItem[];
  spacingCm: number;
  scopeLabel: string;
  dateLabel: string;
  baseUrl: string;
}) {
  const spacing = [0, 2, 4, 6].includes(spacingCm) ? spacingCm : 2;
  let previousGroup = "";
  const body = items.map(({ question: originalQuestion, chapter }, index) => {
    const question = prepareWrongQuestionPdfQuestion(originalQuestion);
    const group = `${question.subject}｜${chapter}`;
    const heading = group === previousGroup ? "" : `<h2>${escapeHtml(group)}</h2>`;
    previousGroup = group;
    const source = question.sourceYear
      ? `${question.sourceYear >= 1912 ? question.sourceYear - 1911 : question.sourceYear} 年${question.sourceRound ? `第 ${question.sourceRound} 次` : ""}${question.originalQuestionNumber ? ` · 原第 ${question.originalQuestionNumber} 題` : ""}`
      : question.sourceType === "AI_GENERATED" ? "自訂練習題" : "練習題";
    return `${heading}<article class="question"><div class="source">${escapeHtml(source)}</div><div class="stem"><span class="number">${index + 1}.</span><div>${formatText(question.stem)}${imageMarkup(question.stemImage, `第 ${index + 1} 題附圖`, baseUrl)}</div></div><div class="options">${OPTION_KEYS.filter((key) => typeof question.options[key] === "string").map((key) => `<div class="option"><span>${key}.</span><div>${formatText(question.options[key]!)}${imageMarkup(question.optionImages?.[key], `第 ${index + 1} 題選項 ${key} 附圖`, baseUrl)}</div></div>`).join("")}</div>${spacing > 0 ? `<div class="note-space" style="height:${spacing}cm" aria-label="${spacing} 公分筆記空白"></div>` : ""}</article>`;
  }).join("");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>錯題練習單</title><style>
@page { size: A4 portrait; margin: 15mm 16mm; @bottom-center { content: counter(page) " / " counter(pages); font-family: serif; font-size: 8pt; color: #555; } }
* { box-sizing: border-box; }
html { color-scheme: light; }
body { margin: 0; color: #111; background: #e8e9e6; font-family: "Noto Serif CJK TC", "Noto Serif TC", "Songti TC", "PMingLiU", "STSong", serif; font-size: 11pt; line-height: 1.65; }
.paper { width: 210mm; min-height: 297mm; padding: 15mm 16mm; margin: 16px auto; background: white; }
h1 { margin: 0; text-align: center; font-size: 18pt; font-weight: 600; letter-spacing: .15em; }
.subtitle { text-align: center; margin: 2mm 0 5mm; font-size: 9pt; color: #555; }
.metadata { display: flex; justify-content: space-between; gap: 5mm; font-size: 10pt; border-bottom: 1px solid #222; padding-bottom: 3mm; margin-bottom: 5mm; }
h2 { margin: 6mm 0 3mm; padding: 1.5mm 0; font-size: 11pt; font-weight: 600; border-bottom: .3mm solid #aaa; break-after: avoid; page-break-after: avoid; }
.question { margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
.source { font-size: 8.5pt; color: #666; margin-bottom: 1mm; }
.stem, .option { display: flex; gap: 2mm; align-items: flex-start; }
.stem > div, .option > div { min-width: 0; flex: 1; white-space: pre-wrap; overflow-wrap: break-word; }
.number { min-width: 6mm; }
.options { margin: 2mm 0 0 8mm; }
.option { margin: .7mm 0; }
.option > span { min-width: 5mm; }
img { display: block; max-width: 100%; max-height: 85mm; object-fit: contain; object-position: left; margin: 2mm 0; }
.note-space { margin-top: 3mm; border-top: .2mm solid #ddd; }
sub, sup { line-height: 0; font-size: .75em; }
.empty { padding: 25mm 0; text-align: center; color: #777; }
.image-error { color: #a00; }
@media print {
  html, body { background: white; }
  .paper { width: auto; min-height: 0; padding: 0; margin: 0; }
  h1, h2, .source, .metadata { color: black; }
}
</style></head><body><main class="paper"><h1>錯題練習單</h1><p class="subtitle">國考刷題 · 自主練習</p><div class="metadata"><span>${escapeHtml(scopeLabel)} · 共 ${items.length} 題</span><span>${escapeHtml(dateLabel)}</span></div>${body || '<p class="empty">沒有符合條件的錯題</p>'}</main></body></html>`;
}
