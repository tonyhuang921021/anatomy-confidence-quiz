const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const raw=require('../data/sources/moex_98_99_official_questions.json'),review=require('../data/sources/moex_98_99_classification_review.json'),taxonomy=require('../data/analysisPrimaryTagTaxonomy.json').primaryTags,bank=require('../data/med1QuestionBank.ts'),tags=require('../lib/analysisPrimaryTag.ts'),scoring=require('../lib/answerScoring.ts');
const placements=require('../data/sources/moex_98_99_learning_placement.json'),placementRules=require('../docs/moex-98-99/learning-placement-rules.json');
const ids=new Set(raw.questions.map(q=>q.id)),byId=new Map(bank.getCanonicalQuestionBank().map(q=>[q.id,q]));
const subjects=['解剖學','組織學','胚胎學','生理學','生物化學','微生物免疫學','寄生蟲學','公共衛生學','藥理學','病理學'];
const sortedIds=qs=>qs.filter(q=>ids.has(q.id)).map(q=>q.id).sort();
const withoutClassification=({subject,chapter,section,primaryTag,...q})=>q;
const ruleSubject=require('./moex-primary-subject').getMoexPrimarySubject;
test('review is pinned to unchanged official payload; all 800 subjects follow the existing rule and topic gaps stay explicit',()=>{
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/sources/moex_98_99_official_questions.json'))).digest('hex'),review.sourceFileSha256);
 assert.equal(Object.keys(review.questions).length,800);assert.deepEqual(review.pendingQuestionIds,[]);
 assert.deepEqual(new Set([...Object.keys(review.questions),...review.pendingQuestionIds]),ids);
 assert.equal(Object.values(review.questions).filter(([,tag])=>tag===null).length,0);
 for(const [id,[subject,tag]] of Object.entries(review.questions)){assert.ok(ids.has(id));assert.equal(subject,ruleSubject(id));assert.equal(byId.get(id).subject,ruleSubject(id));if(tag)assert.ok(taxonomy.some(t=>t.name===tag&&t.subject===subject),id);}
});
test('all 800 stems, options, source/cases/images, identities and every official credit rule are immutable',()=>{
 for(const q of raw.questions){const current=byId.get(q.id);assert.deepEqual(withoutClassification(current),withoutClassification(q),q.id);assert.deepEqual([current.chapter,current.section],placements.questions[q.id]);for(const a of 'ABCD')assert.equal(scoring.isQuestionAnswerCorrect(current,a),scoring.isQuestionAnswerCorrect(q,a),q.id+a);}
});
test('each reviewed ID enters exactly its scientific subject and modern aggregate, with or without unrelated overrides',()=>{
 const unrelated={UNRELATED:{questionId:'UNRELATED',subject:'解剖學',chapter:'test',section:'test',updatedAt:'2026-10-26'}};
 for(const overrides of [{},unrelated]){
  const all=[];
  for(const subject of subjects){const actual=sortedIds(bank.getQuestionBankBySubjectFilter(subject,overrides));const expected=Object.entries(review.questions).filter(([,v])=>v[0]===subject).map(([id])=>id).sort();assert.deepEqual(actual,expected,subject);all.push(...actual);}
  assert.equal(all.length,800);assert.equal(new Set(all).size,800);assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('全部',overrides)),[...ids].sort());
  const med1=new Set(subjects.slice(0,5)),expected1=raw.questions.filter(q=>med1.has(byId.get(q.id).subject)||review.pendingQuestionIds.includes(q.id));
  assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('醫學（一）',overrides)),sortedIds(expected1));
  assert.deepEqual(sortedIds(bank.getQuestionBankBySubjectFilter('醫學（二）',overrides)),sortedIds(raw.questions.filter(q=>!med1.has(byId.get(q.id).subject)&&!review.pendingQuestionIds.includes(q.id))));
 }
});
test('all eight original papers keep exact 100 IDs and old-system identity despite cross-subject reassignment',()=>{
 for(const p of raw.papers){const actual=bank.getQuestionsForPastPaper(p.key,p.subject);assert.equal(actual.length,100);assert.deepEqual(sortedIds(actual),raw.questions.filter(q=>`${q.examCode}-${q.paperCode}`===p.key).map(q=>q.id).sort());assert.ok(actual.every(q=>q.sourceCitation.includes(p.subject)));}
});
test('reviewed same-subject assignments remain authoritative over stale cloud overrides',()=>{
 for(const [id,[subject,primaryTag]] of Object.entries(review.questions)){
  const result=tags.applyClassificationOverrideWithPrimaryTagPriority(byId.get(id),{questionId:id,subject:'解剖學',chapter:'錯誤舊分類',section:'錯誤舊分類',updatedAt:'2026-10-26'});
  assert.equal(result.subject,subject);assert.equal(tags.getQuestionPrimaryTag(result),primaryTag);
  if(!primaryTag)assert.match(tags.getQuestionClassificationLabel(result),/細分類待核對/);
 }
 assert.equal(tags.isLegacyQuestionClassificationPending('MOEX-098140-1101-Q093'),false);
 assert.equal(byId.get('MOEX-098140-1101-Q093').subject,'公共衛生學');
 assert.equal(tags.isLegacyQuestionPrimaryTagPending('MOEX-098140-1101-Q093'),false);
 assert.equal(tags.getQuestionPrimaryTag(byId.get('MOEX-098140-1101-Q093')),'公共衛生學－職業衛生與職業醫學');
});
test('runtime rejects cross-subject model labels even when the topic sounds related',()=>{
 assert.deepEqual(tags.getLockedLegacyPrimaryTagAssignment('MOEX-098020-1101-Q047','藥理學','藥理學－抗細菌藥'),{subject:'微生物免疫學',primaryTag:null});
 assert.deepEqual(tags.getLockedLegacyPrimaryTagAssignment('MOEX-098020-1101-Q047','微生物免疫學','藥理學－抗細菌藥'),{subject:'微生物免疫學',primaryTag:null});
 assert.deepEqual(tags.getLockedLegacyPrimaryTagAssignment('MOEX-098020-1101-Q047','微生物免疫學','微生物免疫學－抗菌藥物'),{subject:'微生物免疫學',primaryTag:'微生物免疫學－抗菌藥物'});
});
test('historical 醫學一 reference uses original paper, not the new modern subject grouping',()=>{
 const resolve=require('../lib/questionLinkResolver.ts').resolveStudyNoteQuestionLinks;
 for(const [subject,id] of [['醫學（一）','MOEX-098020-1101-Q047'],['醫學（二）','MOEX-098020-2101-Q047']])assert.deepEqual(resolve([{questionId:'98-1-Q047',relationType:'related'}],bank.getCanonicalQuestionBank(),{subject}).map(q=>q.questionId),[id]);
});

const BASELINE_FILE_SHA256={
  "data/subjectRegistry.ts": "19f10c8b1b0dea79b6cf99d4430bc1eed9380c10b7e8ebe57ec45429342cdca8",
  "data/subjectOrder.ts": "21b71726553b51637e91f5972605b20bcf432bbbe27ee6c56d06f0f508370ee3",
  "data/analysisPrimaryTagRuntimeMap.json": "d6ac375618826f5e3ff43aa732c87da942c9043b3d5f1cd2a2f2358d081a95f5",
  "data/sources/moex_98_99_official_questions.json": "0d1a8d89869903b8d4ed93aa67d2cc6cb615c8707e2770ce08e9f3fc0631a17e",
  "scripts/moex-primary-subject.js": "3eb34d73ea2961b6d6d250cf15b44d5a4ef4458b0e07e38a301c6cd6d2ce0b98",
  "data/anatomyQuestions.ts": "c61f8a25c4f002f2ff8dd5f91ec222c3b002d59b383c92ec02a5bf99313f0d37"
};
test("original rule, subject names/order and existing source question files stay byte-identical to c13852b",()=>{for(const [p,hash] of Object.entries(BASELINE_FILE_SHA256))assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex"),hash,p);});


test('all original taxonomy definitions/IDs/names/order survive additive approved extensions byte-for-byte',()=>{
 const current=JSON.parse(fs.readFileSync(path.join(root,'data/analysisPrimaryTagTaxonomy.json'),'utf8'));
 const extension=require('../docs/moex-98-99/taxonomy-extensions.json');
 const original=structuredClone(current);delete original.contentRevision;
 const added=original.primaryTags.filter(t=>extension.newTagIds.includes(t.id));
 assert.equal(added.length,3);assert.deepEqual(added.map(t=>t.subject),['公共衛生學','微生物免疫學','生物化學']);
 original.primaryTags=original.primaryTags.filter(t=>!extension.newTagIds.includes(t.id));
 const extended=original.primaryTags.filter(t=>t.legacyNominalSubjectExtension);assert.equal(extended.length,15);
 assert.deepEqual(new Set(extended.map(t=>t.id)),new Set(extension.extendedExistingTagIds));
 for(const tag of extended){assert.match(tag.legacyNominalSubjectExtension.appliesWhen,/examCode < 106100/);delete tag.legacyNominalSubjectExtension;}
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(original,null,2)+'\n').digest('hex'),extension.baseTaxonomySha256);
 assert.equal(new Set(current.primaryTags.map(t=>t.id)).size,current.primaryTags.length);
});
test('all 6730 pre-existing canonical questions retain their baseline except two source-reviewed corrections',()=>{
 const old=bank.getCanonicalQuestionBank().filter(q=>!ids.has(q.id));assert.equal(old.length,placementRules.baselineOldCanonicalCount);
 const revisions=require('../docs/moex-98-99/canonical-reviewed-corrections.json');
 assert.deepEqual(revisions.map(({id,fields})=>({id,fields})),[
  {id:'MOEX-102030-1101-Q097',fields:['explanation','optionAnalysis','options','stemImage','testedConcept']},
  {id:'MOEX-106100-2301-Q044',fields:['stem']},
 ]);
 for(const revision of revisions){
  const matches=old.filter(q=>q.id===revision.id);assert.equal(matches.length,1,revision.id);
  const current=matches[0], fields=Object.fromEntries(revision.fields.filter(k=>Object.hasOwn(current,k)).map(k=>[k,current[k]]));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex'),revision.revisedSha256,revision.id+' reviewed fields');
 }
 const historic=old.map(q=>{const revision=revisions.find(r=>r.id===q.id);if(!revision)return q;const restored={...q};for(const key of revision.fields){if(Object.hasOwn(revision.original,key))restored[key]=revision.original[key];else delete restored[key]}return restored});
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(historic)).digest('hex'),placementRules.baselineOldCanonicalSha256);
});
test('all 800 learning placements are exposed through their locked subject outline without source placeholders',()=>{
 assert.deepEqual(new Set(Object.keys(placements.questions)),ids);assert.equal(placements.sourceFileSha256,review.sourceFileSha256);
 for(const [id,pair]of Object.entries(placements.questions)){
  const q=byId.get(id);assert.deepEqual([q.chapter,q.section],pair);assert.notEqual(q.chapter,'舊制官方原卷');
  const chapter=bank.med1OutlinesBySubject[q.subject].find(c=>c.chapter===q.chapter);assert.ok(chapter,id+' invisible chapter');assert.ok(chapter.sections.includes(q.section),id+' invisible section');
  assert.ok(bank.getQuestionBankBySubjectFilter(q.subject).filter(other=>other.chapter===q.chapter&&other.section===q.section).some(other=>other.id===id),id+' missing focused pool');
 }
 const outline=bank.med1OutlinesBySubject['解剖學'];
 placementRules.anatomyOriginalOutline.forEach((old,i)=>{assert.equal(outline[i].chapter,old.chapter);assert.deepEqual(outline[i].sections.slice(0,old.sections.length),old.sections);});
});
test('existing placement pairs have actual old-question witnesses and new pairs are explicitly justified',()=>{
 for(const [key,value]of Object.entries(placementRules.existingPairWitnesses)){
  const [subject,chapter,section]=key.split('|');if(value.existingQuestionId){const q=byId.get(value.existingQuestionId);assert.ok(q&&!ids.has(q.id));assert.deepEqual([q.subject,q.chapter,q.section],[subject,chapter,section]);}else assert.ok(value.newReason);
 }
 assert.equal(byId.get('MOEX-099130-1101-Q035').section,'肌肉組織');
 for(const id of ['MOEX-098020-2101-Q052','MOEX-098140-2101-Q057','MOEX-099130-2101-Q058','MOEX-099130-2101-Q059'])assert.equal(byId.get(id).section,'造血藥物');
});

test('real question-order builder selects every historical learning chapter without fallback or omissions',()=>{
 const {createQuestionOrder}=require('../lib/quizAnalysis.ts');const groups=new Map();
 for(const q of byId.values())if(ids.has(q.id)){const key=JSON.stringify([q.subject,q.chapter,q.section]);const entries=groups.get(key)||[];entries.push(q.id);groups.set(key,entries);}
 const reached=[];
 for(const [key,expected]of groups){const [subject,chapter,section]=JSON.parse(key);const actual=createQuestionOrder(bank.getQuestionBankBySubjectFilter(subject),[],{mode:'random',subjectFilter:subject,chapter,section,questionCount:expected.length,yearFrom:2009,yearTo:2010,excludeAiGenerated:true,excludePreviouslyAnswered:false});assert.deepEqual([...actual].sort(),[...expected].sort(),key);reached.push(...actual);}
 assert.equal(reached.length,800);assert.deepEqual(new Set(reached),ids);
});
