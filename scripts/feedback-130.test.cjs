const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,p,...rest){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,...rest)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const bank=require('../data/med1QuestionBank.ts');
test('report1106 excludes mismatched original images without replacing teaching text',()=>{
 const {findReviewedYangmingExplanation}=require('../lib/yangmingReviewedRelease.ts');
 const row=findReviewedYangmingExplanation('MOEX-101110-1101-Q007','https://example.invalid');
 assert.equal(row.content.pendingSource,true);assert.deepEqual(row.content.assets,[]);
 const q=bank.getCanonicalQuestionBank().find(q=>q.id==='MOEX-101110-1101-Q007');
 assert.equal(q.answer,'C');assert.match(q.explanation,/腰薦神經幹/);
});
test('report130 corrected text reaches canonical and medicine II pools without changing official scoring',()=>{
 const id='MOEX-106100-2301-Q044';
 for(const pool of [bank.getCanonicalQuestionBank(),bank.medStage2Questions]){
  const rows=pool.filter(q=>q.id===id);assert.equal(rows.length,1);
  const q=rows[0];assert.equal(q.stem,'我國法令規定所稱之「日時量平均容許暴露濃度」係指工作多少小時之平均容許暴露濃度？');
  assert.equal(q.answer,'C');assert.deepEqual(q.options,{A:'最高15分鐘',B:'每日4小時',C:'每日8小時',D:'每週40小時'});
 }
});

test('report133 restores actual options and original table while retaining accepted A/B scoring',()=>{
 const q=bank.getCanonicalQuestionBank().find(q=>q.id==='MOEX-102030-1101-Q097');
 assert.deepEqual(q.options,{A:'胎次愈高可能是人工受孕結果',B:'重男輕女的現象還是存在',C:'男嬰比女嬰存活高',D:'幾年下來都一樣表示是自然反應'});
 const {isQuestionAnswerCorrect}=require('../lib/answerScoring.ts');
 for(const a of ['A','B']) assert.equal(isQuestionAnswerCorrect(q,a),true);
 for(const a of ['C','D']) assert.equal(isQuestionAnswerCorrect(q,a),false);
 assert.deepEqual(q.acceptedAnswers,['A','B']);assert.equal(q.answerCreditType,'multiple_accepted');
 assert.equal(q.stemImage,'/question-media/MOEX-102030-1101-Q097.png');assert.ok(fs.statSync(path.join(root,'public',q.stemImage)).size>1000);
});
