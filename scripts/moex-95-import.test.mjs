import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isQuestionAnswerCorrect } from '../lib/answerScoring.ts';
const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
const audit = read('data/sources/moex_95_source_audit.json').questions;
const classification = read('data/sources/moex_95_content_classification_candidate.json');
const sources = [1,2].flatMap(r => [1,2].map(p => read(`data/sources/moex_95_${r}_med${p}_questions.json`)));
const rows = sources.flatMap(s => s.questions);
const digest = x => createHash('sha256').update(x).digest('hex');
test('four official papers retain 100 distinct questions and reviewed sources', () => {
  assert.deepEqual(sources.map(s=>s.questions.length),[100,100,100,100]);
  assert.equal(new Set(rows.map(q=>q.id)).size,400);
  assert.equal(audit.length,400);
  assert.equal(Object.keys(classification.questions).length,394);
  assert.equal(classification.quarantined.length,6);
  for (const [i,q] of rows.entries()) {
    const a=audit[i]; assert.equal(q.id,a.id); assert.equal(q.officialExam.categoryCode,'101'); assert.equal(q.officialExam.trackCode,'HIGHGENERAL');
    assert.equal(digest(q.stem),a.stemSha256); assert.deepEqual(q.options,a.options);
    assert.equal(q.answer,a.score.answer); assert.deepEqual(q.acceptedAnswers,a.score.acceptedAnswers); assert.equal(q.answerCreditType,a.score.answerCreditType);
    assert.equal(digest(readFileSync(new URL(`../public${q.officialSource.image}`,import.meta.url))),a.imageSha256);
    assert.ok(classification.questions[q.id] || classification.quarantined.includes(q.id));
    for (const answer of ['A','B','C','D']) assert.equal(isQuestionAnswerCorrect(q,answer),a.score.answerCreditType==='all_credit'||a.score.acceptedAnswers.includes(answer),q.id+' '+answer);
  }
  assert.equal(audit.filter(a=>a.structuredTable).length,2);
  const partial=classification.questions['MOEX-C101-095030-S1001-HIGHGENERAL-Q007']; assert.ok(partial[0]&&partial[1]); assert.equal(partial[2],null); assert.equal(partial[3],null);
});
