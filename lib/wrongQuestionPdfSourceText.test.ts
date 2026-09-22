import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalQuestionBank } from "../data/med1QuestionBank";
import { prepareWrongQuestionPdfQuestion } from "./wrongQuestionPdfSourceText";
import { buildWrongQuestionPdfHtml, getPdfChapter } from "./wrongQuestionPdf";

const original = getCanonicalQuestionBank().find(question => question.id === "MOEX-101030-2101-Q029")!;
test("private-use repairs preserve the source-specific meaning and leave original data unchanged", () => {
  const snapshot = JSON.stringify(original);
  const prepared = prepareWrongQuestionPdfQuestion(original);
  assert.match(prepared.stem, /去氧尿苷/);
  assert.match(prepared.stem, /胸苷/);
  assert.doesNotMatch(prepared.stem, /\uEA86/);
  assert.equal(JSON.stringify(original), snapshot);
  assert.notEqual(prepared, original);
  assert.notEqual(prepared.options, original.options);
  assert.equal(prepared.answer, original.answer);
});
test("a different question or edited source is never guessed from private-use codes", () => {
  const differentQuestion = { ...original, id: "custom-pua-question" };
  const editedSource = { ...original, stem: original.stem + " edited" };
  assert.equal(prepareWrongQuestionPdfQuestion(differentQuestion), differentQuestion);
  assert.equal(prepareWrongQuestionPdfQuestion(editedSource), editedSource);
});
test("HTML preview shares source repairs, compatibility normalization and script formatting", () => {
  const snapshot = JSON.stringify(original);
  const html = buildWrongQuestionPdfHtml({
    items: [{ question: original, chapter: getPdfChapter(original), answeredAt: "" },
      { question: { ...original, id: "unicode-preview", stem: "降 CO₂ 10⁻³ <script>" }, chapter: "類別", answeredAt: "" }],
    spacingCm: 2, scopeLabel: "降", dateLabel: "日期", baseUrl: "https://example.invalid"
  });
  assert.match(html, /去氧尿苷/);
  assert.match(html, /胸苷/);
  assert.match(html, /降 CO<sub>2<\/sub>/);
  assert.match(html, /<sup>−3<\/sup>|<sup>-3<\/sup>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /\uEA86|降|類|<script>/);
  assert.equal(JSON.stringify(original), snapshot);
});
