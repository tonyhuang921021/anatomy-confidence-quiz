// Run from the repository root: node scripts/audit-wrong-question-pdf-fonts.cjs
// Read-only coverage gate: all canonical export text must exist in the complete fallback font.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const Module = require("node:module");
const root = path.resolve(__dirname, "..");
const ts = require("typescript");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }
).outputText, filename);
const bank = require("../data/med1QuestionBank.ts").getCanonicalQuestionBank();
const { prepareWrongQuestionPdfQuestion } = require("../lib/wrongQuestionPdfSourceText.ts");
const { tokenizeWrongQuestionPdfText } = require("../lib/wrongQuestionPdfText.ts");
const { getPdfChapter } = require("../lib/wrongQuestionPdf.ts");
const evidence = require("../docs/pdf-source-glyph-repairs.json");
const fontkit = require("@pdf-lib/fontkit");
const primary = new Set(fontkit.create(fs.readFileSync(path.join(root, "public/fonts/pdf/NotoSerifTC-Regular.otf"))).characterSet);
const fallback = new Set(fontkit.create(fs.readFileSync(path.join(root, "public/fonts/pdf/NotoSerifCJKtc-Regular.otf"))).characterSet);
const bankSnapshot = JSON.stringify(bank);
let verifiedSourceFields = 0;
for (const patch of evidence.patches) {
  const original = bank.find(q => q.id === patch.question_id);
  assert.ok(original, "Source repair question disappeared: " + patch.question_id);
  const read = q => patch.field === "stem" ? q.stem : q.options[patch.field];
  assert.equal(read(original), patch.old_text, "Source changed; recheck the original PDF before updating repair");
  assert.equal(read(prepareWrongQuestionPdfQuestion(original)), patch.new_text);
  verifiedSourceFields++;
}
const missing = [], needsFallback = [];
for (const original of bank) {
  const question = prepareWrongQuestionPdfQuestion(original);
  const fields = [
    ["heading", question.subject + " | " + getPdfChapter(question), false],
    ["stem", question.stem, true],
    ...Object.entries(question.options).map(([key, value]) => [key, value, true])
  ];
  let usesFallback = false;
  for (const [field, value, formatted] of fields) {
    if (typeof value !== "string") continue;
    for (const token of tokenizeWrongQuestionPdfText(value, formatted)) {
      for (const character of token.text + (token.subscript || "") + (token.superscript || "")) {
        if (character === "\n") continue;
        const code = character.codePointAt(0);
        if (!primary.has(code)) usesFallback = true;
        if (!fallback.has(code)) missing.push({ id: question.id, field, character, code: "U+" + code.toString(16).toUpperCase() });
      }
    }
  }
  if (usesFallback) needsFallback.push(question.id);
}
assert.equal(JSON.stringify(bank), bankSnapshot, "PDF preparation mutated the canonical question bank");
const report = {
  questionCount: bank.length, verifiedSourceFields,
  fallbackQuestionCount: needsFallback.length, fallbackQuestionIds: needsFallback,
  missingGlyphCount: missing.length, missing,
  canonicalBankUnchanged: true
};
console.log(JSON.stringify(report, null, 2));
assert.equal(missing.length, 0, "PDF export has unsupported canonical question glyphs");
