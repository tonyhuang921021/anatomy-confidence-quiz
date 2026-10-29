const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const bank=require('../data/med1QuestionBank.ts'),scoring=require('../lib/answerScoring.ts'),tags=require('../lib/analysisPrimaryTag.ts');
for(const med of [1,2]){
 const audited=require(`./fixtures/moex-97-2-med${med}-scoring-audit.json`).audit;
 const payload=require(`../data/sources/moex_97_2_med${med}_questions.json`),classification=require(`../data/sources/moex_97_2_med${med}_classification.json`);
 test(`97-2 醫${med}: source, four options, scoring all 400 choices`,()=>{
  assert.equal(payload.questions.length,100);assert.equal(new Set(payload.questions.map(q=>q.id)).size,100);
  for(const [i,q] of payload.questions.entries()){
   assert.equal(q.originalQuestionNumber,i+1);assert.deepEqual(Object.keys(q.options),['A','B','C','D']);assert.ok(q.stem&&Object.values(q.options).every(Boolean));assert.doesNotMatch(q.stem+Object.values(q.options).join(''),/[\ue000-\uf8ff]/);
   const bytes=fs.readFileSync(path.join(root,'public',q.officialSource.image));assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(q.officialSource.width>0&&q.officialSource.height>0);
   const expected=payload.sources.corrections[String(i+1)]??[payload.sources.officialAnswerSymbols[i]];assert.deepEqual(q.acceptedAnswers,expected,q.id);assert.equal(audited[i].id,q.id);assert.deepEqual(q.acceptedAnswers,audited[i].accepted,q.id);assert.equal(q.answerCreditType,audited[i].type,q.id);
   for(const answer of 'ABCD')assert.equal(scoring.isQuestionAnswerCorrect(q,answer),expected.includes(answer),q.id+answer);
   if(q.answerCreditType==='all_credit')assert.equal(scoring.getQuestionAnswerLabel(q),'一律給分');
  }
 });
 test(`97-2 醫${med}: paper, subject, chapter and taxonomy gaps`,()=>{
  const paper=`097140-${med}101`,name=`醫學（${med===1?'一':'二'}）`,questions=bank.getQuestionsForPastPaper(paper,name);assert.equal(questions.length,100);assert.equal(bank.getPastPaperOptions(name).find(p=>p.key===paper)?.isComplete,true);
  for(const q of questions){const [subject,tag]=classification.questions[q.id], [chapter,section]=classification.placements[q.id];assert.equal(q.subject,subject);assert.equal(q.chapter,chapter);assert.equal(q.section,section);assert.equal(tags.getQuestionPrimaryTag(q),tag);assert.ok(bank.med1OutlinesBySubject[subject].some(c=>c.chapter===chapter&&(!section||c.sections.includes(section))),q.id);assert.ok(bank.getQuestionBankBySubjectFilter(subject).some(x=>x.id===q.id));assert.equal(tags.isLegacyQuestionPrimaryTagPending(q.id),tag===null);}
 });
 if(med===2)test('Q23 accepts A–D without being all-credit, and figures remain visible',()=>{const q=payload.questions[22];assert.equal(q.answerCreditType,'multiple_accepted');assert.deepEqual(q.acceptedAnswers,['A','B','C','D']);assert.notEqual(scoring.getQuestionAnswerLabel(q),'一律給分');assert.equal(scoring.isQuestionAnswerCorrect(q,''),false);assert.deepEqual(payload.questions.filter(x=>x.stemImage).map(x=>x.originalQuestionNumber),[82,88,93]);});
}
