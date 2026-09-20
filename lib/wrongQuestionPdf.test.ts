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

function sortedFixtureIds(questions: Question[]) {
  return collectWrongQuestionPdfItems(
    [session(questions.map((item) => attempt({ questionId: item.id })))],
    questions
  ).items.map((item) => item.question.id);
}

test("PDF uses the site's full subject order even when inputs and question years disagree", () => {
  const subjects: Question["subject"][] = [
    "解剖學", "組織學", "胚胎學", "生理學", "生物化學",
    "微生物免疫學", "寄生蟲學", "公共衛生學", "藥理學", "病理學"
  ];
  const fixtures = subjects.map((subject, index) => ({
    ...question, id: `subject-${index}`, subject, sourceYear: 2010 + index, originalQuestionNumber: 20 - index
  }));
  const scrambled = [9, 4, 2, 7, 0, 6, 3, 8, 1, 5].map((index) => fixtures[index]);
  const unknown = { ...question, id: "unknown-subject", subject: "細胞生物學" as const, sourceYear: 2026, originalQuestionNumber: 1 };
  assert.deepEqual(sortedFixtureIds([unknown, ...scrambled]), [...fixtures.map((item) => item.id), unknown.id]);
});

test("original question numbers stay ascending across alternating chapters in one paper", () => {
  const fixtures = [
    { ...question, id: "number-12", chapter: "上肢", originalQuestionNumber: 12 },
    { ...question, id: "number-2", chapter: "胸腔", originalQuestionNumber: 2 },
    { ...question, id: "number-8", chapter: "上肢", originalQuestionNumber: 8 },
    { ...question, id: "number-20", chapter: "胸腔", originalQuestionNumber: 20 }
  ].map((item) => ({ ...item, sourceYear: 2026, sourceRound: 1 as const, examCode: "115030", paperCode: "1101" }));
  assert.deepEqual(sortedFixtureIds(fixtures), ["number-2", "number-8", "number-12", "number-20"]);
  const collected = collectWrongQuestionPdfItems([session(fixtures.map((item) => attempt({ questionId: item.id })))], fixtures);
  assert.deepEqual(collected.items.map((item) => item.chapter), ["胸腔", "上肢", "上肢", "胸腔"]);
});

test("newer years and rounds precede older papers, independent of chapter and low question numbers", () => {
  const fixtures: Question[] = [
    { ...question, id: "older-round2", sourceYear: 2025, sourceRound: 2, originalQuestionNumber: 1 },
    { ...question, id: "new-round1", sourceYear: 2026, sourceRound: 1, originalQuestionNumber: 1 },
    { ...question, id: "new-round2-number20", sourceYear: 2026, sourceRound: 2, originalQuestionNumber: 20 },
    { ...question, id: "older-round1", sourceYear: 2025, sourceRound: 1, originalQuestionNumber: 1 },
    { ...question, id: "new-round2-number3", sourceYear: 115, sourceRound: 2, originalQuestionNumber: 3 }
  ];
  assert.deepEqual(sortedFixtureIds(fixtures), [
    "new-round2-number3", "new-round2-number20", "new-round1", "older-round2", "older-round1"
  ]);
});

test("same-year papers remain contiguous and missing numbers sort after numbered questions in their paper", () => {
  const source: Partial<Question> = { sourceYear: 2026, sourceRound: 1, examCode: "115030" };
  const fixtures: Question[] = [
    { ...question, ...source, id: "paper2-first", paperCode: "1301", originalQuestionNumber: 1 },
    { ...question, ...source, id: "paper1-missing-b", paperCode: "1101" },
    { ...question, ...source, id: "paper1-last", paperCode: "1101", originalQuestionNumber: 99 },
    { ...question, ...source, id: "paper1-missing-a", paperCode: "1101" },
    { ...question, ...source, id: "MOEX-115030-1101-Q002", paperCode: undefined, examCode: undefined, originalQuestionNumber: 2 }
  ];
  const expected = ["MOEX-115030-1101-Q002", "paper1-last", "paper1-missing-a", "paper1-missing-b", "paper2-first"];
  assert.deepEqual(sortedFixtureIds(fixtures), expected);
  assert.deepEqual(sortedFixtureIds([...fixtures].reverse()), expected);
});

test("duplicate or invalid numbers and missing source metadata have stable ID fallbacks", () => {
  const fixtures: Question[] = [
    { ...question, id: "fixture-10", originalQuestionNumber: 3 },
    { ...question, id: "fixture-2", originalQuestionNumber: 3 },
    { ...question, id: "missing-10", originalQuestionNumber: Number.NaN },
    { ...question, id: "missing-2", originalQuestionNumber: 0 },
    { ...question, id: "missing-3" },
    { ...question, id: "dated", sourceYear: 2026 }
  ];
  const expected = ["dated", "fixture-2", "fixture-10", "missing-2", "missing-3", "missing-10"];
  assert.deepEqual(sortedFixtureIds(fixtures), expected);
  assert.deepEqual(sortedFixtureIds([...fixtures].reverse()), expected);
});
