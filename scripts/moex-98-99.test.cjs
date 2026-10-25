const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const baseline = process.env.MOEX_BASELINE_DIR || '/tmp/anatomy-complete-release-20261020';
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(parent?.filename.startsWith(baseline) ? baseline : root, request.slice(2));
  return resolve.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = function (module, file) {
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
  }}).outputText, file);
};
const payload = require('../data/sources/moex_98_99_official_questions.json');
const sources = require('../data/sources/moex_98_99_source_manifest.json').sources;
const links = require('../data/sources/yangming_98_99_source_links.json');
const scoring = require('../lib/answerScoring.ts');
const q = (key, number) => payload.questions.find(q => q.id === `MOEX-${key}-Q${String(number).padStart(3,'0')}`);

test('only four verified sessions, eight complete papers, 800 unique identities', () => {
  assert.equal(payload.papers.length, 8);
  assert.equal(payload.questions.length, 800);
  assert.equal(new Set(payload.questions.map(q=>q.id)).size, 800);
  assert.deepEqual([...new Set(payload.questions.map(q=>q.examCode))], ['098020','098140','099010','099130']);
  for (const paper of payload.papers) {
    const questions=payload.questions.filter(q=>`${q.examCode}-${q.paperCode}`===paper.key);
    assert.deepEqual(questions.map(q=>q.originalQuestionNumber), Array.from({length:paper.questionCount},(_,i)=>i+1));
    assert.equal(paper.durationMinutes,120);
    assert.equal(paper.pointsPerQuestion,1);
    for (const question of questions) {
      assert.equal(question.subject,paper.subject);
      assert.deepEqual(Object.keys(question.options), ['A','B','C','D']);
      assert.ok(question.stem && Object.values(question.options).every(Boolean));
      assert.ok(!/[\ue000-\uf8ff]/.test(question.stem+Object.values(question.options).join('')));
      assert.ok(!/情況：/.test(Object.values(question.options).join('')),'next case must not leak into previous options');
      assert.ok(fs.existsSync(path.join(root,'public',question.officialSource.image)));
    }
  }
});

test('all 51 # entries retain exact final credit rules, including four-option policies', () => {
  const corrected=payload.questions.filter(q=>q.answerCreditType!=='standard');
  assert.equal(corrected.length,51);
  assert.equal(corrected.filter(q=>q.answerCreditType==='all_credit').length,13);
  assert.deepEqual(q('098020-1101',2).acceptedAnswers,['A','B']);
  assert.deepEqual(q('098020-1101',77).acceptedAnswers,['B','C']);
  assert.deepEqual(q('098140-2101',16).acceptedAnswers,['A','B','D']);
  assert.equal(q('098140-2101',29).answerCreditType,'multiple_accepted');
  assert.equal(q('098140-2101',70).answerCreditType,'all_credit');
  assert.deepEqual(q('099010-1101',41).acceptedAnswers,['A']);
  for (const question of payload.questions) for (const answer of 'ABCD') {
    assert.equal(scoring.isQuestionAnswerCorrect(question,answer), question.acceptedAnswers.includes(answer),question.id+answer);
  }
  for (const paper of payload.papers) for (const [number,correction] of Object.entries(paper.corrections)) {
    assert.deepEqual(q(paper.key,Number(number)).acceptedAnswers,correction.acceptedAnswers);
    assert.equal(q(paper.key,Number(number)).answerCreditType,correction.answerCreditType);
  }
});

test('official files match provenance hashes; all 800 source images are small WebP assets', () => {
  const crypto=require('node:crypto');
  for (const source of sources.filter(s=>s.available)) {
    assert.equal(new URL(source.url).hostname,'wwwq.moex.gov.tw');
    const bytes=fs.readFileSync(path.join(root,source.localPath));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);
  }
  let total=0;
  for (const question of payload.questions) {
    const asset=fs.readFileSync(path.join(root,'public',question.officialSource.image));
    assert.equal(asset.toString('ascii',8,12),'WEBP');
    assert.ok(question.officialSource.width>0 && question.officialSource.height>0);
    assert.ok(asset.length<300000,question.id);
    total+=asset.length;
  }
  assert.ok(total<30*1024*1024);
});

test('14 linked questions retain source cases, including the independent case before 98-2 Q2', () => {
  assert.equal(payload.questions.filter(q=>q.sharedContext).length,14);
  assert.match(q('098140-1101',2).sharedContext.stem,/30 歲男性因車禍/);
  assert.doesNotMatch(q('098140-1101',2).sharedContext.stem,/闌尾/);
  assert.match(q('098020-2101',76).sharedContext.stem,/新生兒/);
  assert.equal(q('099130-1101',61).sharedContext.stem,q('099130-1101',60).stem);
});

test('Yangming uses source-only references with explicit page gaps; no mirrored text or assets', () => {
  assert.equal(links.questions.length,800);
  assert.equal(links.bookVerified,false);
  for (const item of links.questions) {
    assert.ok(q(item.questionId.split('-').slice(1,3).join('-'),item.questionNumber));
    assert.equal(item.page,null);
    assert.equal(item.status,'source_link_only_page_unverified');
    assert.equal(item.body,undefined);
    assert.equal(item.assets,undefined);
  }
  assert.equal(links.questions.filter(q=>q.erratum).length,1);
});

test('real runtime exposes the eight papers and preserves every existing question and paper', () => {
  const current=require('../data/med1QuestionBank.ts');
  const previous=require(path.join(baseline,'data/med1QuestionBank.ts'));
  const currentById=new Map(current.canonicalQuestionBank.map(q=>[q.id,q]));
  assert.equal(current.canonicalQuestionBank.length,previous.canonicalQuestionBank.length+800);
  for (const question of previous.canonicalQuestionBank) assert.deepEqual(currentById.get(question.id),question);
  const before=previous.getPastPaperOptions();
  const after=current.getPastPaperOptions();
  assert.deepEqual(after.filter(p=>p.sourceYear>=2011),before.map(p=>({...p,label:require("../lib/rocDate.ts").formatRocYear(p.sourceYear)+p.label.slice(String(p.sourceYear).length)})));
  assert.equal(after.length,before.length+8);
  for (const paper of payload.papers) {
    const option=after.find(p=>p.key===paper.key);
    assert.ok(option.isComplete);
    assert.equal(option.questionCount,paper.questionCount);
    assert.deepEqual(current.getQuestionsForPastPaper(paper.key,paper.subject),payload.questions.filter(q=>`${q.examCode}-${q.paperCode}`===paper.key));
  }
  const years=require('../lib/practiceYears.ts');
  assert.equal(years.toGregorianPracticeYear(98),2009);
  assert.equal(years.toGregorianPracticeYear(99),2010);
  assert.equal(years.PRACTICE_YEAR_OPTIONS[0],2009);
});


test('reviewed table questions keep original image without flattened numeric columns', () => {
  const first=q('098020-1101',86), second=q('098140-1101',95);
  assert.doesNotMatch(first.stem,/陰性|陽性44|篩檢 有 無/);
  assert.doesNotMatch(second.stem,/基線人數|70,00070|130,00026/);
  for (const question of [first,second]) assert.equal(question.stemImage,question.officialSource.image);
  assert.deepEqual(first.acceptedAnswers,['B']);
  assert.deepEqual(second.acceptedAnswers,['D']);
});
