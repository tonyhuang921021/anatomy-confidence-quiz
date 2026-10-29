// Lightweight focused regression for Node >= 22.6 (native TypeScript stripping).
// On the project's Node 20, use the repository TypeScript test workflow instead.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { getPracticeYearOptions, normalizePracticeYearRange } from '../lib/practiceYears.ts';

test('options come from real pools and preserve existing range boundaries', () => {
  assert.deepEqual(getPracticeYearOptions([2008, 2026, 2008, undefined], {yearFrom:2009, yearTo:2026}), [2008,2009,2026]);
  assert.ok(!getPracticeYearOptions([2008, 2026], {yearFrom:2008, yearTo:2026}).includes(2001));
  assert.ok(getPracticeYearOptions([2001, 2008], {yearFrom:2008, yearTo:2026}).includes(2001));
});
test('ROC saved preferences normalize including 97 and 90', () => {
  assert.deepEqual(normalizePracticeYearRange({yearFrom:97,yearTo:97}), {yearFrom:2008,yearTo:2008});
  assert.deepEqual(normalizePracticeYearRange({yearFrom:115,yearTo:90}), {yearFrom:2001,yearTo:2026});
  assert.deepEqual(normalizePracticeYearRange({yearFrom:2008,yearTo:2026}), {yearFrom:2008,yearTo:2026});
});
test('progress selection uses actual filter implementation for 97 and 90', async () => {
  // Extract the unchanged exported implementation to avoid importing the entire app graph.
  const source = await readFile(new URL('../lib/progressPractice.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export function normalizeProgressPracticeYearRange(');
  const end = source.indexOf('export function resolveProgressPracticeQuestionCount(', start);
  assert.ok(start >= 0 && end > start);
  const dir = await mkdtemp(join(tmpdir(), 'practice-years-'));
  try {
    const file = join(dir, 'filter.ts');
    const imported = pathToFileURL(resolve('lib/practiceYears.ts')).href;
    await writeFile(file, `import { MIN_PRACTICE_SOURCE_YEAR, MAX_PRACTICE_SOURCE_YEAR, normalizePracticeYearRange } from ${JSON.stringify(imported)};\n` + source.slice(start,end));
    const {getProgressPracticeQuestionIds} = await import(pathToFileURL(file).href);
    const questions = [{id:'a',sourceYear:2001},{id:'b',sourceYear:2008},{id:'c',sourceYear:2009},{id:'u'}];
    const questionIds = questions.map(q => q.id);
    assert.deepEqual(getProgressPracticeQuestionIds({questions,questionIds,yearRange:{yearFrom:97,yearTo:97}}), ['b']);
    assert.deepEqual(getProgressPracticeQuestionIds({questions,questionIds,yearRange:{yearFrom:90,yearTo:90}}), ['a']);
    assert.deepEqual(getProgressPracticeQuestionIds({questions,questionIds,yearRange:{yearFrom:2008,yearTo:2026}}), ['b','c','u']);
    // Existing 2009–2026 full range includes unknown, not narrower ranges.
    const oldQuestions = [{id:'old',sourceYear:2009},{id:'recent',sourceYear:2025},{id:'unknown'}];
    const oldIds = oldQuestions.map(q => q.id);
    assert.deepEqual(getProgressPracticeQuestionIds({questions:oldQuestions,questionIds:oldIds,yearRange:{yearFrom:2009,yearTo:2026}}), ['old','recent','unknown']);
    assert.deepEqual(getProgressPracticeQuestionIds({questions:oldQuestions,questionIds:oldIds,yearRange:{yearFrom:2025,yearTo:2025}}), ['recent']);
    assert.deepEqual(getProgressPracticeQuestionIds({questions:oldQuestions,questionIds:oldIds,yearRange:{yearFrom:2008,yearTo:2008}}), []);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
