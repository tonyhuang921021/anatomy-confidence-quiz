const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const payload=require('../data/sources/moex_97_1_med1_questions.json'),classification=require('../data/sources/moex_97_1_med1_classification.json'),bank=require('../data/med1QuestionBank.ts'),scoring=require('../lib/answerScoring.ts'),tags=require('../lib/analysisPrimaryTag.ts');
test('97 paper has 100 distinct reviewed source questions and genuine crop files',()=>{
 assert.equal(payload.questions.length,100);assert.equal(new Set(payload.questions.map(q=>q.id)).size,100);
 assert.deepEqual(payload.questions.map(q=>q.originalQuestionNumber),Array.from({length:100},(_,i)=>i+1));
 for(const q of payload.questions){assert.deepEqual(Object.keys(q.options),['A','B','C','D']);assert.ok(q.stem&&Object.values(q.options).every(Boolean));assert.doesNotMatch(q.stem+Object.values(q.options).join(''),/[\ue000-\uf8ff]/);const image=fs.readFileSync(path.join(root,'public',q.officialSource.image));assert.equal(image.toString('ascii',8,12),'WEBP');assert.ok(q.officialSource.width>0&&q.officialSource.height>0);}
});
test('all 400 scoring cases follow final official answer table',()=>{
 assert.equal(payload.sources.officialAnswerSymbols.length,100);
 for(const [i,q] of payload.questions.entries()){
  const symbol=payload.sources.officialAnswerSymbols[i],corrected=payload.sources.corrections[String(i+1)],expected=corrected??[symbol];
  assert.deepEqual(q.acceptedAnswers,expected,q.id);assert.equal(q.answerCreditType,corrected?(expected.length===4?'all_credit':'multiple_accepted'):'standard',q.id);
  for(const answer of 'ABCD')assert.equal(scoring.isQuestionAnswerCorrect(q,answer),expected.includes(answer),q.id+answer);
  if(q.answerCreditType==='all_credit')assert.equal(scoring.getQuestionAnswerLabel(q),'一律給分');
 }
});
test('paper, subject and chapter entry points include the candidates while two topic gaps stay unassigned',()=>{
 const qs=bank.getQuestionsForPastPaper('097050-1101','醫學（一）');assert.equal(qs.length,100);assert.equal(bank.getPastPaperOptions('醫學（一）').find(p=>p.key==='097050-1101')?.isComplete,true);
 assert.deepEqual(classification.pendingPrimaryTagQuestionIds,['MOEX-097050-1101-Q024','MOEX-097050-1101-Q096']);
 for(const q of qs){const [subject,tag]=classification.questions[q.id], [chapter,section]=classification.placements[q.id];assert.equal(q.subject,subject);assert.equal(q.chapter,chapter);assert.equal(q.section,section);assert.equal(tags.getQuestionPrimaryTag(q),tag);assert.ok(bank.med1OutlinesBySubject[subject].some(c=>c.chapter===chapter&&c.sections.includes(section)),q.id);assert.ok(bank.getQuestionBankBySubjectFilter(subject).some(x=>x.id===q.id));assert.equal(tags.isLegacyQuestionPrimaryTagPending(q.id),tag===null);}
});
