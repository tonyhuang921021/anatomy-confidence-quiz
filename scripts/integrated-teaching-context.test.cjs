const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;Module._resolveFilename=function(n,p,...r){if(n.startsWith('@/'))n=path.join(process.cwd(),n.slice(2));return resolve.call(this,n,p,...r)};
require.extensions['.ts']=function(m,f){m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,f)};
const {findTrustedRelatedQuestions:find}=require('../lib/trustedRelatedContext.ts');
const {appendTeachingContext,validPublicTeaching,safeTeachingDraft,teachingSourceLeakIndex,INTEGRATED_TEACHING_RULE,PRIVATE_SOURCE_RULE}=require('../lib/teachingContext.ts');
const q=(id,stem,answer,options,extra={})=>({id,stem,answer,options,subject:'生物化學',chapter:'酵素',section:'酵素',sourceType:'MOEX_PAST_EXAM',...extra});
const current=q('MOEX-098020-2101-Q034','競爭型抑制劑（competitive inhibitor）對酵素動力學參數的影響？','C',{A:'Vmax 降低',B:'Km降低',C:'Vmax／Km降低',D:'Km不變'});
const graph=q('MOEX-097140-2101-Q028','酵素雙倒數圖（double-reciprocal plot）有 competitive inhibitor 時何項改變？','B',{A:'1/V 截距',B:'1/[S] 截距',C:'Vmax',D:'平衡常數'});
const parameter=q('MOEX-102030-2101-Q026','競爭型抑制劑（competitive inhibitor）的酵素動力學變化？','A',{A:'Km上升',B:'kcat下降',C:'Vmax下降',D:'其他'});
const distant=q('different','酵素 inhibitor 有何結構特徵？','A',{A:'膜蛋白',B:'Km'});
test('generic text evidence finds same mechanism variants outside old concept dictionary',()=>assert.deepEqual(find(current,[current,graph,parameter,distant],new Set()).map(x=>x.id).sort(),[parameter.id,graph.id].sort()));
test('matching labels or only distractors never authorize context, and cross-subject excluded',()=>{const distractor=q('d','受體的作用？','A',{A:'其他',B:'competitive inhibitor'});assert.equal(find(current,[distant,distractor,{...graph,id:'cross',subject:'病理學'}],new Set()).length,0)});
test('unknown concept needs no hardcoded topic entry',()=>{const a=q('x','晶狀體 zonular fibers 機轉？','A',{A:'懸韌帶',B:'其他'}),b=q('y','zonular fibers 在晶狀體調節的作用？','A',{A:'懸韌帶',B:'其他'});assert.equal(find(a,[b],new Set()).length,1)});
test('no reliable match stays empty; at most three and duplicate text removed',()=>{assert.deepEqual(find(current,[distant],new Set()),[]);const rows=[graph,{...graph,id:'dup'},parameter];assert.equal(find(current,rows,new Set()).length,2);assert.ok(find(current,rows,new Set(),1).length<=1)});
test('conflicting canonical content/answers, invalid keys, unreviewed OCR and all-credit rejected',()=>{const bad={...graph,id:'conflict',answer:'A'};assert.equal(find(current,[graph,bad],new Set()).length,0);for(const bad of [{...graph,answer:'E'},{...graph,answerCreditType:'all_credit'},{...graph,needsHumanReview:true},{...graph,answerConfidence:'low'},{...graph,officialSource:{transcriptionNotice:'無法辨識，待核'}}])assert.equal(find(current,[bad],new Set()).length,0);assert.equal(find(current,[graph],new Set([graph.id])).length,0)});
test('answer-specific anchor excludes mere neighboring pathway names',()=>{const enzyme=q('e','citric acid cycle 哪個被 malonate 抑制？','A',{A:'succinate dehydrogenase',B:'其他'}),good=q('g','citric acid cycle 哪個在內膜？','A',{A:'succinate dehydrogenase',B:'其他'}),bad=q('b','citric acid cycle 如何進入？','A',{A:'pyruvate dehydrogenase',B:'succinate dehydrogenase'});assert.deepEqual(find(enzyme,[good,bad],new Set()).map(x=>x.id),['g'])});
test('context includes actual source stem/scoring/options, excludes source IDs/years/old explanations and caps bytes',()=>{const context=appendTeachingContext('BASE',[{...graph,year:97,sourceLabel:'97年考題',explanation:'UNTRUSTED OLD EXPLANATION'},graph,parameter]);assert.ok(context.includes(graph.stem));assert.ok(context.includes('acceptedOptions'));assert.ok(context.includes('1/[S] 截距'));assert.ok(!context.includes(graph.id));assert.ok(!context.includes('97年'));assert.ok(!context.includes('UNTRUSTED'));assert.equal(context.split('內部唯讀背景').length-1,2);assert.ok(Buffer.byteLength(appendTeachingContext('x'.repeat(15990),[graph]))<=16000);assert.equal(appendTeachingContext('BASE',[]),'BASE')});
test('source leakage cannot become a saved public explanation, options or memory tip',()=>{for(const bad of ['類似題也考過','相似題','相關題','相近的試題','相關考題','內部背景','其他考題','題庫','MOEX-098020-2101-Q034','Q034','民國98年','2026年','第34題'])for(const field of ['explanation','memoryTip','optionAnalysis']){const x={explanation:'本題主線',memoryTip:'',optionAnalysis:{A:'原因'}};x[field]=field==='optionAnalysis'?{A:bad}:bad;assert.equal(validPublicTeaching(x),false,bad)}});
test('stream progressively exposes clean teaching, never full source-label/ID/year tokens across any chunk boundary',()=>{for(const bad of ['類似題','相似題','相關題','MOEX-098020-2101-Q034','2026年','民國98年','第34題']){const text='先說明本題機轉。'+bad+'不要顯示';for(let n=1;n<=text.length;n++){const draft=safeTeachingDraft(text.slice(0,n));assert.equal(teachingSourceLeakIndex(draft),-1,draft)}}const good='本題正解是 C。增加受質濃度可克服競爭抑制。';assert.equal(safeTeachingDraft(good),good);assert.equal(validPublicTeaching({explanation:good,optionAnalysis:{A:'說明'},memoryTip:'Coenzyme Q10'}),true)});
test('real route uses integrated prompt, validated public output and independent durable image continuation without retries',()=>{const s=fs.readFileSync('app/api/question-explanation/route.ts','utf8');for(const t of ['INTEGRATED_TEACHING_RULE','PRIVATE_SOURCE_RULE','appendTeachingContext(canonicalPrompt,related)','safeTeachingDraft(explanationPrefix(raw))','validPublicTeaching(parsed)?parsed:null','maxCalls:1','waitUntil(processSavedImages','Text is already durably saved'])assert.ok(s.includes(t),t);assert.ok(INTEGRATED_TEACHING_RULE.includes('因果、比較或推導'));assert.ok(PRIVATE_SOURCE_RULE.includes('年份'))});

test('broad anatomical vocabulary does not replace specific nerve evidence',()=>{const a=q('neck','何者不包在頸動脈鞘（carotid sheath）內？','B',{A:'頸總動脈',B:'舌咽神經（glossopharyngeal nerve）',C:'迷走神經'}, {subject:'解剖學'}),b=q('cavernous','何者與 internal carotid artery 進入海綿竇？','B',{A:'optic nerve',B:'abducens nerve',C:'trigeminal nerve'},{subject:'解剖學'});assert.deepEqual(find(a,[b],new Set()),[])});
test('negated source answers remain scoring data rather than asserted facts',()=>assert.ok(INTEGRATED_TEACHING_RULE.includes('採計選項本身不是正確知識')));

test('grammatical CJK fragments cannot stand in for a specific biochemical answer',()=>{const a=q('urea','下列有關尿素循環（urea cycle）的敘述何者錯誤？','B',{A:'肝臟',B:'尿素循環的產物之一為草醯乙酸（oxaloacetate）'}),b=q('cps','胺甲醯磷酸與尿素循環（urea cycle）的作用？','A',{A:'活化酵素，增進尿素循環的效率',B:'其他'});assert.deepEqual(find(a,[b],new Set()),[])});

test('known source-label failure settles one mock call, saves nothing and never retries',async()=>{const {handleExplanation}=require('../lib/explanation-orchestrator.cjs');let calls=0,settled=0,writes=0,closed=0;const leaked={explanation:'類似題也出現相同概念',optionAnalysis:{A:'甲',B:'乙',C:'丙',D:'丁'}};const deps={isReviewed:async()=>false,auth:async()=>({id:'u'}),resolveTrusted:async()=>current,readShared:async()=>null,prepare:async()=>true,reserve:async()=>({ok:true,leaseId:'fixture',fence:'fixture',maxCalls:1,model:'gpt-6.1-terra',mode:'default'}),start:async()=>true,callProvider:async()=>{calls++;return {usage:{inputTokens:1,outputTokens:1},value:validPublicTeaching(leaked)?leaked:null}},settle:async()=>{settled++;return true},insertIfAbsentFenced:async()=>{writes++},close:async()=>{closed++}};const r=await handleExplanation({question:{id:current.id}},deps);assert.equal(r.status,502);assert.equal(calls,1);assert.equal(settled,1);assert.equal(writes,0);assert.equal(closed,1)});

test('reviewed real-corpus drug, virus and astrocyte variants recover missed background without lowering generic thresholds',()=>{
 const {getCanonicalQuestionBank}=require('../data/med1QuestionBank.ts');
 const corpus=getCanonicalQuestionBank(),byId=new Map(corpus.map(q=>[q.id,q]));
 const groups=[['MOEX-100030-2101-Q059',['MOEX-109020-2301-Q026']],['MOEX-105100-5301-Q055',['MOEX-113020-2301-Q015','MOEX-097050-1101-Q054']],['MOEX-100030-2101-Q076',['MOEX-C101-095140-S2001-HIGHGENERAL-Q099']]];
 for(const [id,targets] of groups){
  const source=byId.get(id);assert.ok(source,id);assert.equal(require('../lib/reviewedRelatedLinks.ts').CURATED[id],undefined,'private teaching context must not add public recommendation links');
  const candidates=targets.map(x=>{const q=byId.get(x);assert.ok(q,x);return q});
  assert.deepEqual(find(source,candidates,new Set()).map(x=>x.id),targets);
  for(const target of candidates){
   assert.equal(find(source,[{...target,answer:'E',acceptedAnswers:['E']}],new Set()).length,0);
   assert.equal(find(source,[{...target,needsHumanReview:true}],new Set()).length,0);
   assert.equal(find(source,[target],new Set([target.id])).length,0);
   assert.equal(find({...source,answer:'E',acceptedAnswers:['E']},[target],new Set()).length,0);
  }
 }
 const source=byId.get(groups[2][0]),target=byId.get(groups[2][1][0]);
 const prompt=appendTeachingContext('BASE',[target]);
 assert.ok(prompt.includes('何者無關'));assert.ok(prompt.includes('Alzheimer’s disease'));
 assert.ok(!prompt.includes(target.id));assert.ok(!prompt.includes('095140'));
 assert.equal(find(source,[{...target,stem:'阿茲海默症一般介紹'}],new Set()).length,0);
});
