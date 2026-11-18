const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const release = require('../data/sources/yangming_1152_release.json');
const existing = require('../data/sources/yangming_reviewed_release.json');
const official = require('../data/sources/moex_115090_official_questions.json');

test('115-2 binds 196 distinct official questions without replacing existing originals', () => {
  const ids = new Set([...official.med1Questions, ...official.med2Questions].map(q => q.id));
  const oldIds = new Set(existing.rows.map(row => row.questionId));
  assert.equal(release.rows.length, 196);
  assert.equal(new Set(release.rows.map(row => row.questionId)).size, 196);
  assert.equal(release.rows.filter(row => row.questionId.includes('-1301-')).length, 100);
  assert.equal(release.rows.filter(row => row.questionId.includes('-2301-')).length, 96);
  for (const row of release.rows) {
    assert.ok(ids.has(row.questionId), row.questionId);
    assert.ok(!oldIds.has(row.questionId), row.questionId);
    assert.equal(row.body, '', 'original images must not become inferred author text');
    assert.ok(row.assets.length > 0);
    assert.ok(row.author, row.questionId + ' author');
    assert.ok(row.reviewer, row.questionId + ' reviewer');
  }
  for (const n of [61,62,63,64]) assert.ok(!release.rows.some(row => row.questionId === `MOEX-115090-2301-Q${String(n).padStart(3,'0')}`));
});
test('all original image assets exist, match release hashes and have bounded source pages', () => {
  const manifest = require('../docs/yangming-1152-release/asset-manifest.json');
  const hashes = new Map(manifest.assets.map(asset => [asset.src, asset.sha256]));
  let count = 0;
  for (const row of release.rows) for (const asset of row.assets) {
    assert.ok(asset.src.startsWith('/assets/yangming1152/'));
    assert.equal(asset.kind, 'question_snapshot');
    assert.ok(asset.page >= row.sourcePageStart && asset.page <= row.sourcePageEnd);
    assert.ok(asset.width > 0 && asset.height > 0);
    const bytes = fs.readFileSync(path.join(root, 'public', asset.src));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hashes.get(asset.src));
    count++;
  }
  assert.equal(count, manifest.assets.length);
});
