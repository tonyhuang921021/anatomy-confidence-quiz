const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {questions} = require('../data/sources/yangming_1152_source_links.json');
test('115-2 has 196 attributed source links and four explicit missing questions', () => {
  assert.equal(questions.length, 200);
  assert.equal(new Set(questions.map(q => q.questionId)).size, 200);
  assert.deepEqual(questions.filter(q => q.pendingSource).map(q => q.questionId), [61, 62, 63, 64].map(n => `MOEX-115090-2301-Q0${n}`));
  for (const q of questions) {
    assert.match(q.bookUrl, /^https:\/\/sites\.google\.com\/view\/ymmedexam\/ans\/115-2/);
    assert.match(q.pdfUrl, /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/);
    assert.equal('body' in q || 'assets' in q, false);
    if (!q.pendingSource) assert.ok(q.author && q.reviewer && q.pageStart > 0 && q.pageEnd >= q.pageStart);
  }
  const pages = id => {
    const q = questions.find(q => q.questionId.endsWith(id));
    return [q.pageStart, q.pageEnd];
  };
  assert.deepEqual(pages('1301-Q001'), [4, 6]);
  assert.deepEqual(pages('2301-Q060'), [114, 115]);
  assert.deepEqual(pages('2301-Q061'), [null, null]);
  assert.deepEqual(pages('2301-Q065'), [116, 116]);
  assert.ok(!fs.existsSync('public/assets/yangming1152'));
});
