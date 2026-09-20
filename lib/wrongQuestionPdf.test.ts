import assert from "node:assert/strict";
import test from "node:test";
import { buildWrongQuestionPdfHtml, collectWrongQuestionPdfItems, EMPTY_PDF_FILTERS, getPdfChapter, taiwanAnswerDate } from "./wrongQuestionPdf";
import type { Attempt, Question, QuizSession } from "../types/quiz";
const question: Question = { id: "pdf-fixture", subject: "解剖學", chapter: "腹部", section: "腹部", stem: "測試 <script>題目</script>", options: { A: "甲", B: "乙", C: "丙", D: "丁" }, answer: "A", explanation: "不可出現的詳解", testedConcept: "", stemImage: "/question-media/demo.png" };
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({ questionId: question.id, selectedAnswer: "B", correctAnswer: "A", isCorrect: false, confidence: 3, answeredAt: "2026-09-19T16:00:00.000Z", ...overrides });
const session = (attempts: Attempt[], overrides: Partial<QuizSession> = {}): QuizSession => ({ id: "private-session-id", subject: "解剖學", startedAt: "2026-09-19T15:00:00.000Z", completedAt: "2026-09-20T00:00:00.000Z", attempts, ...overrides });
test("collects ever-wrong questions once, excludes correct and unfinished attempts", () => {
  const result = collectWrongQuestionPdfItems([session([attempt(), attempt({ isCorrect: true }), attempt()]), session([attempt({ questionId: "correct-only", isCorrect: true, confidence: 1 })]), session([attempt({ questionId: "unfinished" })], { completedAt: undefined }), session([attempt({ selectedAnswer: "" as Attempt["selectedAnswer"] })])], [question]);
  assert.equal(result.items.length, 1);
  assert.equal(result.missingQuestionCount, 0);
});
test("date range is inclusive in Taiwan, filters by wrong attempt date, not session completion", () => {
  assert.equal(taiwanAnswerDate("2026-09-19T15:59:59Z"), "2026-09-19");
  assert.equal(taiwanAnswerDate("2026-09-19T16:00:00Z"), "2026-09-20");
  const filters = { ...EMPTY_PDF_FILTERS, dateFrom: "2026-09-20", dateTo: "2026-09-20" };
  assert.equal(collectWrongQuestionPdfItems([session([attempt()])], [question], filters).items.length, 1);
  assert.equal(collectWrongQuestionPdfItems([session([attempt({ answeredAt: "2026-09-20T16:00:00Z" })])], [question], filters).items.length, 0);
  assert.equal(collectWrongQuestionPdfItems([session([attempt({ answeredAt: "invalid" })])], [question], filters).unknownDateCount, 1);
});
test("uses stored custom payload, canonical precedence, and surfaces unavailable questions", () => {
  const custom = { ...question, id: "custom", subject: "生理學" as const };
  const result = collectWrongQuestionPdfItems([session([attempt(), attempt({ questionId: "custom" }), attempt({ questionId: "missing" })], { generatedQuestions: [custom, { ...question, stem: "outdated" }] })], [question]);
  assert.equal(result.items.length, 2);
  assert.equal(result.missingQuestionCount, 1);
  assert.equal(result.items.find((item) => item.question.id === question.id)?.question.stem, question.stem);
  assert.equal(collectWrongQuestionPdfItems([session([attempt()])], [question], { ...EMPTY_PDF_FILTERS, subject: "生理學" }).items.length, 0);
});
test("print markup escapes question content, retains assets and omits private records and answers", () => {
  const items = collectWrongQuestionPdfItems([session([attempt()])], [question]).items;
  const html = buildWrongQuestionPdfHtml({ items, spacingCm: 4, scopeLabel: "本次作答", dateLabel: "全部日期", baseUrl: "https://quiz.example" });
  assert.match(html, /size: A4 portrait/);
  assert.match(html, /height:4cm/);
  assert.match(html, /https:\/\/quiz.example\/question-media\/demo.png/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|不可出現的詳解|private-session-id|pdf-fixture|正確答案/);
});

test("chapter uses anatomy regions and verified topic labels for other subjects", () => {
  assert.equal(getPdfChapter(question), "腹部");
  const physiology = { ...question, id: "pdf-physiology", subject: "生理學" as const, chapter: "生理學", section: "腎臟", primaryTag: "生理學－腎臟" };
  assert.equal(getPdfChapter(physiology), "腎臟");
  const result = collectWrongQuestionPdfItems([session([attempt({ questionId: physiology.id })])], [physiology], { ...EMPTY_PDF_FILTERS, chapter: "腎臟" });
  assert.equal(result.items.length, 1);
  assert.equal(collectWrongQuestionPdfItems([session([attempt({ questionId: physiology.id })])], [physiology], { ...EMPTY_PDF_FILTERS, chapter: "腹部" }).items.length, 0);
});
test("untrusted media schemes are rejected and image-only options are preserved", () => {
  const unsafe = { ...question, stemImage: "javascript:alert(1)", optionImages: { B: "/option.png" } };
  const items = collectWrongQuestionPdfItems([session([attempt()])], [unsafe]).items;
  const html = buildWrongQuestionPdfHtml({ items, spacingCm: 0, scopeLabel: "本次作答", dateLabel: "全部日期", baseUrl: "https://quiz.example" });
  assert.match(html, /class="image-error"/);
  assert.doesNotMatch(html, /javascript:|class="note-space"/);
  assert.match(html, /https:\/\/quiz.example\/option.png/);
});

 test("generic subject labels do not masquerade as chapter classification", () => {
  const generic = { ...question, subject: "生理學" as const, chapter: "生理學", section: "生理學", primaryTag: "生理學" };
  assert.equal(getPdfChapter(generic), "未細分章節");
});
