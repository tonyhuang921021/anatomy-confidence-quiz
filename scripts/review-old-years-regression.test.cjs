const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(process.cwd(), request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  } }).outputText, filename);
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  } }).outputText, filename);

const years = require('../lib/practiceYears.ts');
const review = require('../lib/reviewYearFilter.ts');
const { formatRocYear } = require('../lib/rocDate.ts');
const { getCanonicalQuestionBank } = require('../data/med1QuestionBank.ts');
const { getReviewQuestionItems } = require('../lib/quizAnalysis.ts');
const { getProgressPracticeQuestionIds } = require('../lib/progressPractice.ts');
const { ReviewYearRangeFilter } = require('../components/ReviewYearRangeFilter.tsx');
const bank = getCanonicalQuestionBank();
const targetYears = [90, 91, 92, 94, 98, 115];
const questions = targetYears.map(year => {
  const question = bank.find(q => q.sourceYear === year + 1911 && q.sourceType !== 'AI_GENERATED');
  assert.ok(question, `Actual source question exists for ROC ${year}`);
  return question;
});
const sessions = questions.map((q, i) => ({
  id: `year-regression-${i}`, subject: q.subject,
  startedAt: '2026-10-30T08:00:00Z', completedAt: '2026-10-30T08:01:00Z',
  settings: { mode: 'random', questionCount: 1, subjectFilter: q.subject },
  questionOrder: [q.id], attempts: [{ questionId: q.id, selectedAnswer: q.answer === 'A' ? 'B' : 'A',
    correctAnswer: q.answer, isCorrect: false, confidence: 4, answeredAt: '2026-10-30T08:00:30Z' }]
}));

test('all selectable years from ROC90 to115 have actual official questions, without empty years', () => {
  assert.equal(years.MIN_PRACTICE_SOURCE_YEAR, 2001);
  assert.equal(years.MAX_PRACTICE_SOURCE_YEAR, 2026);
  assert.deepEqual(years.PRACTICE_YEAR_OPTIONS, Array.from({ length: 26 }, (_, i) => 2001 + i));
  for (const y of years.PRACTICE_YEAR_OPTIONS) assert.ok(bank.some(q => q.sourceYear === y && q.sourceType !== 'AI_GENERATED'), String(y));
});

test('wrong questions in 90/91/92/94/98/115 remain in full review after history serialization and reload', () => {
  const original = JSON.stringify(sessions);
  const before = getReviewQuestionItems(questions, sessions, Number.MAX_SAFE_INTEGER);
  const reloaded = getReviewQuestionItems(questions, JSON.parse(original), Number.MAX_SAFE_INTEGER);
  assert.equal(before.length, 6); assert.equal(reloaded.length, 6);
  const ids = items => review.filterReviewItemsByYear(items, review.DEFAULT_REVIEW_YEAR_RANGE).map(x => x.question.id).sort();
  assert.deepEqual(ids(before), questions.map(q=>q.id).sort());
  assert.deepEqual(ids(reloaded), ids(before));
  assert.equal(JSON.stringify(sessions), original, 'Filtering never rewrites or deletes progress');
});

for (const [index, rocYear] of targetYears.entries()) {
  test(`ROC${rocYear} and Gregorian ${rocYear+1911} select the same wrong question and practice range`, () => {
    const items = getReviewQuestionItems(questions, JSON.parse(JSON.stringify(sessions)), Number.MAX_SAFE_INTEGER);
    const rocRange = { yearFrom: rocYear, yearTo: rocYear };
    const gregorianRange = { yearFrom: rocYear + 1911, yearTo: rocYear + 1911 };
    assert.deepEqual(review.normalizeReviewYearRange(rocRange), gregorianRange);
    for (const range of [rocRange, gregorianRange]) {
      assert.deepEqual(review.filterReviewItemsByYear(items, range).map(x => x.question.id), [questions[index].id]);
      assert.deepEqual(getProgressPracticeQuestionIds({questions, questionIds: questions.map(q=>q.id), yearRange:range}), [questions[index].id]);
    }
    const rocItem = { ...items[index], question: { ...questions[index], sourceYear: rocYear } };
    assert.equal(review.getReviewItemSourceYear(rocItem), rocYear + 1911);
    assert.equal(formatRocYear(rocYear + 1911), `民國 ${rocYear} 年`);
  });
}

test('existing narrow preferences stay unchanged and can reset to a truly full range', () => {
  const preference = { yearFrom: 2009, yearTo: 2026 };
  const saved = JSON.stringify(preference);
  assert.deepEqual(review.normalizeReviewYearRange(preference), preference);
  assert.equal(review.isFullReviewYearRange(preference), false);
  assert.equal(review.isFullReviewYearRange(review.DEFAULT_REVIEW_YEAR_RANGE), true);
  assert.equal(JSON.stringify(preference), saved);
  const items = getReviewQuestionItems(questions, sessions, Number.MAX_SAFE_INTEGER);
  assert.equal(review.filterReviewItemsByYear(items, preference).length, 2);
  assert.equal(review.filterReviewItemsByYear(items, review.DEFAULT_REVIEW_YEAR_RANGE).length, 6);
});

test('reversed and out-of-bank boundaries normalize without introducing pre90 or post115 options', () => {
  assert.deepEqual(review.normalizeReviewYearRange({yearFrom:115,yearTo:90}), {yearFrom:2001,yearTo:2026});
  assert.deepEqual(review.normalizeReviewYearRange({yearFrom:2000,yearTo:2027}), {yearFrom:2001,yearTo:2026});
  assert.equal(years.PRACTICE_YEAR_OPTIONS.includes(2000), false);
  assert.equal(years.PRACTICE_YEAR_OPTIONS.includes(2027), false);
});

test('actual review control exposes old years and the full-range button resets a narrow preference', () => {
  let selected;
  const props = {idPrefix:'unit-review',value:{yearFrom:2009,yearTo:2026},onChange:value=>{selected=value},filteredCount:2,totalCount:6,poolLabel:'測試'};
  const tree = ReviewYearRangeFilter(props), elements=[];
  function walk(node) {
    if(!React.isValidElement(node)) return;
    elements.push(node); React.Children.forEach(node.props.children,walk);
  }
  walk(tree);
  const selects=elements.filter(x=>x.type==='select'); assert.equal(selects.length,2);
  for(const select of selects) {
    const options=React.Children.toArray(select.props.children);
    assert.deepEqual(options.map(x=>x.props.value),years.PRACTICE_YEAR_OPTIONS);
    assert.equal(options[0].props.children,'民國 90 年');
    assert.equal(options.at(-1).props.children,'民國 115 年');
  }
  const reset=elements.find(x=>x.type==='button'&&x.props.children==='全部年份');
  assert.ok(reset); assert.equal(reset.props.disabled,false); reset.props.onClick();
  assert.deepEqual(selected,{yearFrom:2001,yearTo:2026});
});

// Keep existing behavior checks in the same executable test entry point.
require('../lib/reviewYearFilter.test.ts');
require('../lib/progressPractice.test.ts');
