'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const q=require('../data/sources/moex_94_1_stage1_med2_questions.json').questions.find(q=>q.id==='MOEX-C217-094042-S5001-STAGE1-Q020');
const {hasUnresolvedPrimaryImage}=require('../lib/primaryImageDependency.cjs');
const {handleExplanation}=require('../lib/explanation-orchestrator.cjs');
const old=q=>Boolean(q.stemImage||(q.optionImages&&Object.values(q.optionImages).some(Boolean)));
const check=async(q,gate)=>{
 let reserved=0;
 const out=await handleExplanation({question:{id:q.id,stem:'untrusted client text'}},{
   auth:async()=>({id:'fixture'}),isReviewed:async()=>false,readShared:async()=>null,
   resolveTrusted:async()=>({...q,hasUncertainSource:false,hasUnresolvedImage:gate(q)}),
   reserve:async()=>{reserved++;return {ok:false,code:'isolated_reserve_reached'}},
   callProvider:async()=>{throw Error('must not dispatch')}
 });
 return [out.code,reserved];
};
test('verified 94-1 Q20 text reaches ordinary admission, not the former false 422',async()=>{
 assert.deepEqual(await check(q,old),['source_image_not_supported',0]);
 assert.deepEqual(await check(q,hasUnresolvedPrimaryImage),['isolated_reserve_reached',1]);
 const s=fs.readFileSync('app/api/question-explanation/route.ts','utf8');
 assert.match(s,/hasUnresolvedImage:hasUnresolvedPrimaryImage\(q\)/);
});
test('actual diagram, option image, and drift cannot use the exact-Q20 exception',async()=>{
 const diagram=require('../data/sources/moex_96_1_med2_questions.json').questions.find(q=>q.id==='MOEX-096040-2101-Q053');
 for(const v of [diagram,{...q,id:'nearby'},{...q,stem:'如圖，'+q.stem},{...q,options:{...q.options,B:'不同的選項'}},{...q,answer:'B'},{...q,acceptedAnswers:['A','B']},{...q,officialSource:{...q.officialSource,image:'/different.webp'}},{...q,optionImages:{A:'/needs-a-visual.webp'}}])assert.deepEqual(await check(v,hasUnresolvedPrimaryImage),['source_image_not_supported',0]);
});
test('a question with no source image behaves exactly as before',async()=>{
 const v={...q,id:'normal',stemImage:undefined,officialSource:undefined};
 assert.deepEqual(await check(v,hasUnresolvedPrimaryImage),await check(v,old));
});
