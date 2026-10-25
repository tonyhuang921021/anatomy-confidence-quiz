const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const raw=require('../data/sources/moex_98_99_official_questions.json'),review=require('../data/sources/moex_98_99_classification_review.json'),taxonomy=require('../data/analysisPrimaryTagTaxonomy.json').primaryTags,bank=require('../data/med1QuestionBank.ts'),tags=require('../lib/analysisPrimaryTag.ts'),scoring=require('../lib/answerScoring.ts');
const ids=new Set(raw.questions.map(q=>q.id)),byId=new Map(bank.getCanonicalQuestionBank().map(q=>[q.id,q]));
const subjects=['解剖學','組織學','胚胎學','生理學','生物化學','微生物免疫學','寄生蟲學','公共衛生學','藥理學','病理學'];
const sortedIds=qs=>qs.filter(q=>ids.has(q.id)).map(q=>q.id).sort();
const withoutClassification=({subject,chapter,section,primaryTag,...q})=>q;
test('review is pinned to unchanged official payload; exactly 799 reviewed subjects, 796 existing tags and one pending',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/sources/moex_98_99_official_questions.json'))).digest('hex'),review.sourceFileSha256);
 assert.equal(Object.keys(review.questions).length,799);assert.deepEqual(review.pendingQuestionIds,['MOEX-098140-1101-Q093']);
 assert.deepEqual(new Set([...Object.keys(review.questions),...review.pendingQuestionIds]),ids);
 assert.equal(Object.values(review.questions).filter(([,tag])=>tag===null).length,3);
 for(const [id,[subject,tag]] of Object.entries(review.questions)){assert.ok(ids.has(id));assert.ok(subjects.includes(subject));if(tag)assert.ok(taxonomy.some(t=>t.name===tag&&t.subject===subject),id);}
});
test('all 800 stems, options, source/cases/images, identities and every official credit rule are immutable',()=>{
 for(const q of raw.questions){const current=byId.get(q.id);assert.deepEqual(withoutClassification(current),withoutClassification(q),q.id);for(const a of 'ABCD')assert.equal(scoring.isQuestionAnswerCorrect(current,a),scoring.isQuestionAnswerCorrect(q,a),q.id+a);}
});
test('each reviewed ID enters exactly its scientific subject and modern aggregate, with or without unrelated overrides',()=>{
 const unrelated={UNRELATED:{questionId:'UNRELATED',subject:'解剖學',chapter:'test',section:'test',updatedAt:'2026-10-26'}};
 for(const overrides of [{},unrelated]){
  const all=[];
  for(const subject of subjects){const actual=sortedIds(bank.getQuestionBankBySubjectFilter(subject,overrides));const expected=Object.entries(review.questions).filter(([,v])=>v[0]===subject).map(([id])=>id).sort();assert.deepEqual(actual,expected,subject);all.push(...actual);}
  assert.equal(all.length,799);assert.equal(new Set(all).size,799);assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('全部',overrides)),[...ids].sort());
  const med1=new Set(subjects.slice(0,5)),expected1=raw.questions.filter(q=>med1.has(byId.get(q.id).subject)||review.pendingQuestionIds.includes(q.id));
  assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('醫學（一）',overrides)),sortedIds(expected1));
  assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('醫學（二）',overrides)),sortedIds(raw.questions.filter(q=>!med1.has(byId.get(q.id).subject)&&!review.pendingQuestionIds.includes(q.id))));
 }
});
test('all eight original papers keep exact 100 IDs and old-system identity despite cross-subject reassignment',()=>{
 for(const p of raw.papers){const actual=bank.getQuestionsForPastPaper(p.key,p.subject);assert.equal(actual.length,100);assert.deepEqual(sortedIds(actual),raw.questions.filter(q=>`${q.examCode}-${q.paperCode}`===p.key).map(q=>q.id).sort());assert.ok(actual.every(q=>q.sourceCitation.includes(p.subject)));}
});
test('reviewed gaps remain explicitly untagged; stale cloud overrides cannot replace reviewed subjects',()=>{
 for(const [id,[subject,primaryTag]] of Object.entries(review.questions)){
  const result=tags.applyClassificationOverrideWithPrimaryTagPriority(byId.get(id),{questionId:id,subject:'解剖學',chapter:'錯誤舊分類',section:'錯誤舊分類',updatedAt:'2026-10-26'});
  assert.equal(result.subject,subject);assert.equal(tags.getQuestionPrimaryTag(result),primaryTag);
  if(!primaryTag)assert.match(tags.getQuestionClassificationLabel(result),/細分類待核對/);
 }
 assert.ok(tags.isLegacyQuestionClassificationPending('MOEX-098140-1101-Q093'));
});
test('historical 醫學一 reference uses original paper, not the new modern subject grouping',()=>{
 const resolve=require('../lib/questionLinkResolver.ts').resolveStudyNoteQuestionLinks;
 for(const [subject,id] of [['醫學（一）','MOEX-098020-1101-Q047'],['醫學（二）','MOEX-098020-2101-Q047']])assert.deepEqual(resolve([{questionId:'98-1-Q047',relationType:'related'}],bank.getCanonicalQuestionBank(),{subject}).map(q=>q.questionId),[id]);
});
