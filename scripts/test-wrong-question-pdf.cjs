// The coverage gate registers the same TypeScript loader for the focused tests.
require("./audit-wrong-question-pdf-fonts.cjs");
for (const name of ["wrongQuestionPdf", "wrongQuestionPdfDocument", "wrongQuestionPdfText", "wrongQuestionPdfSourceText", "wrongQuestionPdfApple", "questionTextFormat"]) {
  require("../lib/" + name + ".test.ts");
}
