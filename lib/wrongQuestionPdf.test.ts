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
test("preview markup escapes question content, retains assets and omits private records and answers", () => {
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


test("recent limit takes distinct latest wrong attempts after filters, then restores subject and question order", () => {
  const fixtures: Question[] = [
    { ...question, id: "anatomy-2", originalQuestionNumber: 2 },
    { ...question, id: "anatomy-1", originalQuestionNumber: 1 },
    { ...question, id: "physiology", subject: "生理學" },
    { ...question, id: "oldest" }
  ];
  const attempts = [
    attempt({ questionId: "anatomy-2", answeredAt: "2026-09-20T04:00:00Z" }),
    attempt({ questionId: "anatomy-1", answeredAt: "2026-09-20T01:00:00Z" }),
    attempt({ questionId: "physiology", answeredAt: "2026-09-20T03:00:00Z" }),
    attempt({ questionId: "oldest", answeredAt: "2026-09-19T01:00:00Z" }),
    attempt({ questionId: "oldest", answeredAt: "2026-09-20T05:00:00Z", isCorrect: true }),
    attempt({ questionId: "anatomy-1", answeredAt: "2026-09-20T02:00:00Z" })
  ];
  const collect = (filters: Partial<typeof EMPTY_PDF_FILTERS>) => collectWrongQuestionPdfItems([session(attempts)], fixtures, { ...EMPTY_PDF_FILTERS, ...filters }).items;
  assert.deepEqual(collect({ recentCount: 2 }).map((item) => item.question.id), ["anatomy-2", "physiology"]);
  assert.deepEqual(collect({ recentCount: 3 }).map((item) => item.question.id), ["anatomy-1", "anatomy-2", "physiology"]);
  assert.deepEqual(collect({ subject: "解剖學", chapter: "腹部", recentCount: 2, dateFrom: "2026-09-20", dateTo: "2026-09-20" }).map((item) => item.question.id), ["anatomy-1", "anatomy-2"]);
  assert.equal(collect({ recentCount: 50 }).length, 4);
  assert.equal(collect({ recentCount: 3 })[0].answeredAt, "2026-09-20T02:00:00Z");
});

test("recent filter ties are deterministic, excludes unknown dates and accepts later valid dates", () => {
  const fixtures = [question, { ...question, id: "unknown" }, { ...question, id: "same-time" }];
  const attempts = [attempt({ answeredAt: "invalid" }), attempt(), attempt({ questionId: "unknown", answeredAt: "invalid" }), attempt({ questionId: "same-time" })];
  const filters = { ...EMPTY_PDF_FILTERS, recentCount: 1 };
  const first = collectWrongQuestionPdfItems([session(attempts)], fixtures, filters);
  const reversed = collectWrongQuestionPdfItems([session([...attempts].reverse())], fixtures, filters);
  assert.deepEqual(first.items, reversed.items);
  assert.equal(first.unknownDateCount, 1);
  assert.equal(first.items[0].answeredAt, attempt().answeredAt);
  const unlimited = collectWrongQuestionPdfItems([session(attempts)], fixtures);
  assert.equal(unlimited.items.find((item) => item.question.id === question.id)?.answeredAt, attempt().answeredAt);
  assert.equal(unlimited.items.length, 3);
  assert.equal(collectWrongQuestionPdfItems([session(attempts)], fixtures, { ...filters, recentCount: 5 }).items.length, 2);
});

test("history scope isolates source attempts and snapshots before collecting ever-wrong questions", () => {
  const modes = ["random", "simulation", "custom_paper"] as const;
  const fixtures = modes.map((mode) => ({ ...question, id: mode, stem: `${mode} 題目` }));
  const histories = modes.map((mode, index) => session([
    attempt({ questionId: mode }),
    attempt({ questionId: mode, isCorrect: true, answeredAt: "2026-09-21T01:00:00Z" })
  ], { settings: { mode } as QuizSession["settings"], generatedQuestions: [fixtures[index]] }));
  for (const mode of modes) {
    const collected = collectWrongQuestionPdfItems(histories, [], EMPTY_PDF_FILTERS, {
      label: mode,
      includesSession: (entry) => entry.settings?.mode === mode
    });
    assert.deepEqual(collected.items.map((item) => item.question.id), [mode]);
    assert.equal(collected.items[0].question.stem, `${mode} 題目`);
  }
  const conflictingSnapshot = session([], {
    settings: { mode: "custom_paper" } as QuizSession["settings"],
    generatedQuestions: [{ ...fixtures[1], stem: "其他來源的快照" }]
  });
  assert.equal(collectWrongQuestionPdfItems([...histories, conflictingSnapshot], [], EMPTY_PDF_FILTERS, {
    label: "模考歷次錯題", includesSession: (entry) => entry.settings?.mode === "simulation"
  }).items[0].question.stem, "simulation 題目");
});

test("history scope accepts the page's source and completion predicate without including other review pools", () => {
  const source = session([attempt()], { settings: { mode: "simulation" } as QuizSession["settings"] });
  const completion = session([attempt({ questionId: "review-wrong" })], { settings: { mode: "review", customPoolLabel: "模擬考錯題庫" } as QuizSession["settings"] });
  const other = session([attempt({ questionId: "other-source" })], { settings: { mode: "review", customPoolLabel: "自訂卷錯題庫" } as QuizSession["settings"] });
  const result = collectWrongQuestionPdfItems([source, completion, other], [question, { ...question, id: "review-wrong" }], EMPTY_PDF_FILTERS, {
    label: "模考歷次錯題",
    includesSession: (entry) => entry.settings?.mode === "simulation" || (entry.settings?.mode === "review" && entry.settings?.customPoolLabel === "模擬考錯題庫")
  });
  assert.deepEqual(result.items.map((item) => item.question.id), [question.id, "review-wrong"]);
  assert.equal(result.missingQuestionCount, 0, "excluded sources do not leak missing-question warnings");
});

test("PDF source years match review years, including ROC years and unknown or AI years", () => {
  const fixtures: Question[] = [
    { ...question, id: "old", sourceYear: 2025 },
    { ...question, id: "new", sourceYear: 2026 },
    { ...question, id: "roc", sourceYear: 115 },
    { ...question, id: "undated" },
    { ...question, id: "ai", sourceYear: 2026, sourceType: "AI_GENERATED" }
  ];
  const histories = [session(fixtures.map(({ id }) => attempt({ questionId: id })))];
  const baseScope = { label: "自訂卷歷次錯題", includesSession: () => true };
  const narrow = collectWrongQuestionPdfItems(histories, fixtures, EMPTY_PDF_FILTERS, {
    ...baseScope, yearRange: { yearFrom: 2026, yearTo: 2026 }
  });
  assert.deepEqual(narrow.items.map(({ question }) => question.id).sort(), ["new", "roc"]);
  const full = collectWrongQuestionPdfItems(histories, fixtures, EMPTY_PDF_FILTERS, {
    ...baseScope, yearRange: { yearFrom: 2011, yearTo: 2026 }
  });
  assert.equal(full.items.length, 5, "imported and AI questions remain available with the default full range");
});

test("page subjects and years bound extra filters before date, distinct recent limit and print sorting", () => {
  const fixtures: Question[] = [
    { ...question, id: "anatomy", sourceYear: 2026 },
    { ...question, id: "physiology", subject: "生理學", sourceYear: 2026 },
    { ...question, id: "pharmacology", subject: "藥理學", sourceYear: 2026 },
    { ...question, id: "old-anatomy", sourceYear: 2025 },
    { ...question, id: "outside-unknown-date", subject: "藥理學", sourceYear: 2026 }
  ];
  const attempts = [
    attempt({ questionId: "anatomy", answeredAt: "2026-09-20T01:00:00Z" }),
    attempt({ questionId: "anatomy", answeredAt: "2026-09-20T01:30:00Z" }),
    attempt({ questionId: "physiology", answeredAt: "2026-09-20T02:00:00Z" }),
    attempt({ questionId: "pharmacology", answeredAt: "2026-09-20T03:00:00Z" }),
    attempt({ questionId: "old-anatomy", answeredAt: "2026-09-20T04:00:00Z" }),
    attempt({ questionId: "outside-unknown-date", answeredAt: "invalid" })
  ];
  const historyScope = { label: "散題歷次錯題", includesSession: () => true, yearRange: { yearFrom: 2026, yearTo: 2026 }, subjects: ["解剖學", "生理學"] };
  const filters = { ...EMPTY_PDF_FILTERS, dateFrom: "2026-09-20", dateTo: "2026-09-20", recentCount: 2 };
  const original = JSON.stringify({ fixtures, attempts });
  const result = collectWrongQuestionPdfItems([session(attempts)], fixtures, filters, historyScope);
  assert.deepEqual(result.items.map(({ question }) => question.id), ["anatomy", "physiology"]);
  assert.equal(result.unknownDateCount, 0);
  assert.equal(collectWrongQuestionPdfItems([session(attempts)], fixtures, { ...filters, subject: "藥理學" }, historyScope).items.length, 0);
  assert.deepEqual(collectWrongQuestionPdfItems([session(attempts)], fixtures, { ...filters, recentCount: 1 }, historyScope).items.map(({ question }) => question.id), ["physiology"]);
  assert.equal(JSON.stringify({ fixtures, attempts }), original, "collection never mutates questions or answer records");
});

test("empty subject selection means all page subjects, while a selected subject with no year matches stays empty", () => {
  const fixtures: Question[] = [{ ...question, sourceYear: 2026 }, { ...question, id: "old", subject: "生理學", sourceYear: 2025 }];
  const histories = [session(fixtures.map(({ id }) => attempt({ questionId: id })))];
  const historyScope = { label: "散題歷次錯題", includesSession: () => true, yearRange: { yearFrom: 2026, yearTo: 2026 }, subjects: [] as string[] };
  assert.equal(collectWrongQuestionPdfItems(histories, fixtures, EMPTY_PDF_FILTERS, historyScope).items.length, 1);
  assert.equal(collectWrongQuestionPdfItems(histories, fixtures, EMPTY_PDF_FILTERS, { ...historyScope, subjects: ["生理學"] }).items.length, 0);
  assert.equal(collectWrongQuestionPdfItems(histories, fixtures).items.length, 2, "existing callers without a history scope remain compatible");
});
