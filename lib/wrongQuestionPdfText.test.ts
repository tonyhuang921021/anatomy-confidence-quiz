import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWrongQuestionPdfText, tokenizeWrongQuestionPdfText } from "./wrongQuestionPdfText";

const visible = (value: string, formatted = true) => tokenizeWrongQuestionPdfText(value, formatted)
  .map((token) => token.text + (token.subscript ?? "") + (token.superscript ?? "")).join("");

test("PDF NFC covers BMP and supplementary CJK compatibility characters without flattening units", () => {
  const input = "降 流 數 丽 café cafe\u0301 m² CO₂ ① ㎎ Ａ";
  assert.equal(normalizeWrongQuestionPdfText(input), "降 流 數 丽 café café m² CO₂ ① ㎎ Ａ");
  assert.equal(input, "降 流 數 丽 café cafe\u0301 m² CO₂ ① ㎎ Ａ");
  assert.equal(normalizeWrongQuestionPdfText("横肾蝲倂俣细内\ue2cc"), "横肾蝲倂俣细内\ue2cc", "no simplification, medical substitution or PUA guessing");
});

test("control cleanup retains line/word boundaries, tabs and explicit Chinese lines", () => {
  assert.equal(normalizeWrongQuestionPdfText("A\r\nB\rC\vD\fE\u0085F\u2028G\u2029H\tI\u0081J\u200bK"), "A\nB\nC\nD\nE\nF\nG\nH    I J K");
  assert.equal(normalizeWrongQuestionPdfText("\ufeffA\u00adB\u2060C\u200eD\u202aE\u202cF\u2066G\u2069"), "ABCDEFG");
  assert.equal(visible("第一行\n第二行\r第三行"), "第一行\n第二行\n第三行");
  assert.equal(visible("中文\t欄位"), "中文    欄位");
  assert.equal(normalizeWrongQuestionPdfText("\u200c\u200d\ufe0f"), "\u200c\u200d\ufe0f", "meaningful joiners/selectors are not silently discarded");
});

test("native and inferred scripts keep their base once and preserve super/sub placement", () => {
  const tokens = tokenizeWrongQuestionPdfText("O₂ CO2 HCO₃⁻ NH₄⁺ m² 10⁸ Kₘ Aᶜ Bˢ");
  assert.equal(tokens.map((token) => token.text + (token.subscript ?? "") + (token.superscript ?? "")).join(""), "O2 CO2 HCO3− NH4+ m2 108 Km Ac Bs");
  assert.deepEqual(tokens.filter((token) => token.subscript).map((token) => token.subscript), ["2", "2", "3", "4", "m"]);
  assert.deepEqual(tokens.filter((token) => token.superscript).map((token) => token.superscript), ["−", "+", "2", "8", "c", "s"]);
  assert.equal(visible("¹⁴C 10⁻⁶ Na⁺"), "14C 10−6 Na+");
  assert.equal(visible("H2O₂ PaCO2"), "H2O2 PaCO2");
  assert.deepEqual(tokenizeWrongQuestionPdfText("欄位 m²", false), [{ text: "欄位 m" }, { text: "", superscript: "2" }]);
});

test("unmapped PUA and unknown code points remain present for honest glyph rejection", () => {
  const input = "\uea86\ue2cc" + String.fromCodePoint(0x10ffff);
  assert.equal(visible(input), input);
});
