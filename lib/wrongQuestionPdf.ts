import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import { tokenizeQuestionText } from "./questionTextFormat";
import type { OptionKey, Question, QuizSession } from "../types/quiz";

export type WrongQuestionPdfScope = "current" | "history";
export type WrongQuestionPdfFilters = {
  subject: string;
  chapter: string;
  dateFrom: string;
  dateTo: string;
};
export type WrongQuestionPdfItem = { question: Question; chapter: string; answeredAt: string };
export const EMPTY_PDF_FILTERS: WrongQuestionPdfFilters = {
  subject: "", chapter: "", dateFrom: "", dateTo: ""
};
const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];

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
  filters: WrongQuestionPdfFilters = EMPTY_PDF_FILTERS
) {
  const questionMap = new Map<string, Question>();
  for (const session of sessions) {
    for (const question of [...(session.generatedQuestions ?? []), ...(session.settings?.customQuestionPayload ?? [])]) {
      questionMap.set(question.id, question);
    }
  }
  // Canonical question data and current classification take priority over older snapshots.
  for (const question of questions) questionMap.set(question.id, question);
  const selected = new Map<string, WrongQuestionPdfItem>();
  const missingQuestionIds = new Set<string>();
  const unknownDateQuestionIds = new Set<string>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    for (const attempt of session.attempts) {
      if (attempt.isCorrect !== false || !OPTION_KEYS.includes(attempt.selectedAnswer)) continue;
      const day = taiwanAnswerDate(attempt.answeredAt);
      if ((filters.dateFrom || filters.dateTo) && !day) {
        unknownDateQuestionIds.add(attempt.questionId);
        continue;
      }
      if ((filters.dateFrom && day < filters.dateFrom) || (filters.dateTo && day > filters.dateTo)) continue;
      const question = questionMap.get(attempt.questionId);
      if (!question) {
        missingQuestionIds.add(attempt.questionId);
        continue;
      }
      const chapter = getPdfChapter(question);
      if (filters.subject && question.subject !== filters.subject) continue;
      if (filters.chapter && chapter !== filters.chapter) continue;
      const previous = selected.get(question.id);
      if (!previous || Date.parse(attempt.answeredAt) > Date.parse(previous.answeredAt)) {
        selected.set(question.id, { question, chapter, answeredAt: attempt.answeredAt });
      }
    }
  }
  const items = [...selected.values()].sort((left, right) =>
    left.question.subject.localeCompare(right.question.subject, "zh-Hant") ||
    left.chapter.localeCompare(right.chapter, "zh-Hant") ||
    (right.question.sourceYear ?? 0) - (left.question.sourceYear ?? 0) ||
    (right.question.sourceRound ?? 0) - (left.question.sourceRound ?? 0) ||
    (left.question.originalQuestionNumber ?? 0) - (right.question.originalQuestionNumber ?? 0) ||
    left.question.id.localeCompare(right.question.id)
  );
  return { items, missingQuestionCount: missingQuestionIds.size, unknownDateCount: unknownDateQuestionIds.size };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]!));
}

function formatText(value: string) {
  return tokenizeQuestionText(value).map((token) =>
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
  const body = items.map(({ question, chapter }, index) => {
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
.print-toolbar { font: 14px/1.5 system-ui,sans-serif; display: none; padding: 12px 20px; background: white; border-bottom: 1px solid #ddd; }
.print-toolbar button { padding: 8px 16px; margin-right: 12px; font: inherit; cursor: pointer; }
.image-error { color: #a00; }
@media print {
  html, body { background: white; }
  .paper { width: auto; min-height: 0; padding: 0; margin: 0; }
  .print-toolbar { display: none !important; }
  h1, h2, .source, .metadata { color: black; }
}
</style></head><body><div class="print-toolbar"><button type="button" id="print-button" disabled>列印／另存 PDF</button><span id="print-status">正在準備題目圖片…</span></div><main class="paper"><h1>錯題練習單</h1><p class="subtitle">國考刷題 · 自主練習</p><div class="metadata"><span>${escapeHtml(scopeLabel)} · 共 ${items.length} 題</span><span>${escapeHtml(dateLabel)}</span></div>${body || '<p class="empty">沒有符合條件的錯題</p>'}</main></body></html>`;
}
