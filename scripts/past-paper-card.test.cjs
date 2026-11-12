const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");

const code = ts.transpileModule(fs.readFileSync("components/PastPaperCard.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const context = { exports: {}, require };
vm.runInNewContext(code, context);
const { PastPaperCard } = context.exports;
const props = {
  selected: true,
  onSelect: () => {},
  trackLabel: "醫師國考",
  title: "第 2 次・醫學（一）",
  questionCount: 100,
  lastAttemptSummary: "上次已答題正確率 100%",
  resume: { href: "/quiz?resume=1&sessionId=original-session", answeredCount: 0, totalCount: 100 }
};

test("selection border encloses both the paper and the resume footer", () => {
  const tree = PastPaperCard(props);
  const [button, footer] = tree.props.children;
  assert.match(tree.props.className, /border-brand-600/);
  assert.match(tree.props.className, /bg-brand-50/);
  assert.equal(button.type, "button");
  assert.equal(footer.type, "div");
  assert.doesNotMatch(button.props.className, /(?:^| )ring-1(?: |$)|border-brand-600/);
  assert.match(footer.props.className, /border-t/);
  assert.match(footer.props.className, /py-3/);
});

test("resume is a separate keyboard-accessible link with a 44px target and wrapping space", () => {
  const [, footer] = PastPaperCard(props).props.children;
  const link = footer.props.children[1];
  assert.equal(link.type, "a");
  assert.equal(link.props.href, props.resume.href);
  assert.equal(link.props["aria-label"], "繼續作答：第 2 次・醫學（一）");
  assert.match(link.props.className, /min-h-11/);
  assert.match(link.props.className, /focus-visible:ring-2/);
  assert.match(footer.props.className, /flex-wrap/);
});

test("zero answers remain resumable and current progress is distinct from the last score", () => {
  const html = renderToStaticMarkup(PastPaperCard(props));
  assert.match(html, /上次已答題正確率 100%/);
  assert.match(html, /本次已答 0 \/ 100 題/);
  assert.match(html, /sessionId=original-session/);
});

test("existing progress and total are rendered without changing stored values", () => {
  const resume = Object.freeze({ ...props.resume, answeredCount: 37, totalCount: 80 });
  const html = renderToStaticMarkup(PastPaperCard({ ...props, resume }));
  assert.match(html, /本次已答 37 \/ 80 題/);
  assert.equal(resume.href, props.resume.href);
});

test("a paper without an active session has no resume action or empty footer", () => {
  const tree = PastPaperCard({ ...props, resume: undefined, selected: false });
  assert.equal(tree.props.children[1], null);
  assert.match(tree.props.className, /border-slate-200 bg-white/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /繼續作答|進行中/);
});

test("selecting a paper calls only the existing select action", () => {
  let selected = 0;
  const tree = PastPaperCard({ ...props, onSelect: () => selected++ });
  const button = tree.props.children[0];
  assert.equal(button.props["aria-pressed"], true);
  button.props.onClick();
  assert.equal(selected, 1);
  assert.equal(tree.props.children[1].props.onClick, undefined);
});

test("the setup keeps the original saved session link and progress source", () => {
  const setup = fs.readFileSync("components/QuizSetupPanel.tsx", "utf8");
  assert.match(setup, /currentPaperKey === paper.key && currentSession \? currentSession.attempts.length : null/);
  assert.match(setup, /sessionId=\$\{encodeURIComponent\(currentSession.id\)\}/);
  assert.match(setup, /answeredCount: progress/);
  assert.doesNotMatch(setup, /saveCurrentSession\(/);
});
