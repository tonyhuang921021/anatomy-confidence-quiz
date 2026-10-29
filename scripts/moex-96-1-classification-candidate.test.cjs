const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const review=require('../data/sources/moex_96_1_content_classification_candidate.json'),tags=require('../lib/analysisPrimaryTag.ts'),bank=require('../data/med1QuestionBank.ts'),taxonomy=require('../data/analysisPrimaryTagTaxonomy.json').primaryTags;
test('198 reviewed question-level assignments use existing subjects, tags and exact outline pairs',()=>{
 assert.equal(Object.keys(review.questions).length,198);assert.equal(new Set(Object.keys(review.questions)).size,198);assert.deepEqual(review.quarantined,['MOEX-096040-2101-Q007','MOEX-096040-2101-Q100']);
 for(const [id,[subject,tag,chapter,section]] of Object.entries(review.questions)){
  assert.match(id,/^MOEX-096040-(1101|2101)-Q\d{3}$/);assert.ok(taxonomy.some(t=>t.subject===subject&&t.name===tag),id);
  assert.ok(bank.med1OutlinesBySubject[subject]?.some(x=>x.chapter===chapter&&x.sections.includes(section)),`${id}: ${subject}/${chapter}/${section}`);
  const input={id,subject:'醫學（一）',chapter:'舊制官方原卷',section:'醫學（一）',stem:'unchanged',options:{A:'a',B:'b',C:'c',D:'d'},answer:'A'};
  const output=tags.applyAnalysisPrimaryTagClassification(input);assert.deepEqual([output.subject,output.primaryTag,output.chapter,output.section],[subject,tag,chapter,section],id);
  assert.equal(output.stem,input.stem);assert.deepEqual(output.options,input.options);assert.equal(output.answer,input.answer);
  assert.deepEqual(tags.applyClassificationOverrideWithPrimaryTagPriority(input,{subject:'解剖學',chapter:'stale',section:'stale'}),output);
 }
});
test('13 question-specific placements retain reviewed values; quarantined questions are not assigned',()=>{
 const ids=['MOEX-096040-1101-Q034',...[6,12,15,41,46,48,51,58,65,73,75,88].map(n=>`MOEX-096040-2101-Q${String(n).padStart(3,'0')}`)];assert.deepEqual(review.questionSpecificPlacementExceptions,ids);
 assert.deepEqual(review.questions[ids[0]],['組織學','組織學－皮膚與特殊感覺器官','組織學','器官組織學']);
 for(const id of review.quarantined){assert.equal(Object.hasOwn(review.questions,id),false);assert.equal(tags.getAnalysisPrimaryTagAssignment(id),null);assert.equal(tags.isLegacyQuestionClassificationPending(id),true);const q={id,subject:'醫學（二）',chapter:'舊制官方原卷',section:'醫學（二）'};assert.equal(tags.getQuestionPrimaryTag(q),null);assert.match(tags.getQuestionClassificationLabel(q),/細分類待核對/);assert.deepEqual(tags.applyClassificationOverrideWithPrimaryTagPriority(q,{subject:'病理學',chapter:'bad',section:'bad'}),q);}
});
