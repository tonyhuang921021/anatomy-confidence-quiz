const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {reviewFinalFigure,parseDecision}=require('../lib/finalFigureSuitability.cjs');
const {createFinalFigureRepository}=require('../lib/finalFigureRepository.cjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
const text='## Human blood\nHuman red cells lack nuclei.',bytes=Buffer.from([137,80,78,71,13,10,26,10,1]);
const job={request_id:'50000000-0000-4000-8000-000000000001',question_id:'Q1',explanation_sha256:sha(text)};
const row={question_id:'Q1',image_bytes:bytes,image_sha256:sha(bytes),image_mime:'image/png',explanation_sha256:sha(text),source_url:'https://commons.wikimedia.org/wiki/File:Human_blood.png',license_url:'https://creativecommons.org/licenses/by/4.0/',license:'CC BY 4.0',attribution:'Fixture author',section_title:'Human blood cells'};
const item={sectionTitle:'Human blood',sectionHash:sha(text),caption:'Human blood cells'};
const policy={enabled:true,fundingMode:'cash_authorized',cashAuthorized:true,fundingEvidenceSha:'a'.repeat(64),model:'gpt-6-luna',pricingRevision:'test',reserveMicroUsd:100};
const base={job,row,item,text,policy,readQuestion:async()=>({id:'Q1',stem:'Which human cell lacks a nucleus?',options:{A:'Mature erythrocyte',B:'Lymphocyte'},answer:'A'})};
function fixture(commitMode='before',verdict='match'){
 let stored=null,paid=0,commitCalls=0;
 const db={rpc:async(name,args)=>{
  if(name==='figure_model_reserve'){if(stored)return {data:{status:stored.state,operationId:stored.id}};stored={state:'reserved',id:args.p_operation};return {data:{status:'reserved',operationId:stored.id,sendToken:'token'}}}
  if(name==='figure_model_sent'){stored.state='sent';return {data:true}}
  if(name==='figure_model_commit'){commitCalls++;if(commitMode==='after'){stored.state='committed';stored.verdict=verdict;return {error:'lost ACK'}}if(commitMode==='before')return {error:'connection lost before commit'};stored.state='committed';stored.verdict=verdict;return {data:{committed:true}}}
  if(name==='figure_model_unknown'){if(stored.state!=='committed')stored.state='unknown';return {data:true}}
  if(name==='figure_model_status')return {data:{status:stored.state,candidateStatus:stored.verdict==='mismatch'?'rejected':'approved'}};
  throw Error(name);
 }};
 const run=()=>reviewFinalFigure({...base,repository:createFinalFigureRepository(db,'candidate'),provider:async input=>{paid++;assert.match(input.input[0].content[0].text,/species/);return {status:'completed',outputText:JSON.stringify({verdict,labelLanguage:'en'}),id:'response',responseSha:'b'.repeat(64),costMicroUsd:30}}});
 return {run,paid:()=>paid,state:()=>stored?.state,commits:()=>commitCalls};
}
test('image result commit failure stays held across a new repository instance without model replay',async()=>{const f=fixture('before');assert.equal((await f.run()).status,'unknown');assert.equal(f.state(),'unknown');assert.equal((await f.run()).status,'held');assert.equal(f.paid(),1);assert.equal(f.commits(),1)});
test('lost ACK after atomic image commit reads committed state and never repays',async()=>{const f=fixture('after');assert.equal((await f.run()).status,'unknown');assert.equal(f.state(),'committed');assert.equal((await f.run()).status,'already_reviewed');assert.equal(f.paid(),1)});
test('match and partial match show only after confirmed commit; mismatch stays withdrawn',async()=>{for(const verdict of ['match','partial_match','mismatch']){const f=fixture('success',verdict);assert.equal((await f.run()).status,verdict==='mismatch'?'mismatch':'display');assert.equal((await f.run()).status,verdict==='mismatch'?'withdrawn':'already_reviewed');assert.equal(f.paid(),1)}});
test('stale paragraph never reaches reservation or provider',async()=>{let calls=0;assert.equal((await reviewFinalFigure({...base,item:{...item,sectionHash:'0'.repeat(64)},repository:{reserve:async()=>{calls++},commit:async()=>{},markUnknown:async()=>{}},provider:async()=>{calls++}})).status,'stale_or_invalid');assert.equal(calls,0)});
test('unstructured or extra-field image verdicts are not approvals',()=>{for(const value of ['match','{"verdict":"match","extra":"ignore"}','{"verdict":"yes"}',''])assert.equal(parseDecision(value),null)});

test('image labels are restricted to English Chinese or no text',()=>{for(const labelLanguage of ['en','zh','en-zh','none'])assert.equal(parseDecision(JSON.stringify({verdict:'match',labelLanguage})),'match');for(const labelLanguage of ['other','unreadable'])assert.equal(parseDecision(JSON.stringify({verdict:'match',labelLanguage})),'mismatch');assert.equal(parseDecision('{"verdict":"match"}'),null)});
test('medical-purpose and image-language review are explicit and caption is immutable input',()=>{const {bindInput,providerInput}=require('../lib/finalFigureSuitability.cjs');const bound=bindInput({...base,question:{id:'Q1',stem:'Which human cell lacks a nucleus?',options:{A:'Erythrocyte',B:'Lymphocyte'}}});const p=providerInput(bound,'test');assert.match(p.input[0].content[0].text,/generic glomerular filtration barrier picture is mismatch/);assert.match(p.input[0].content[0].text,/labels must be English, Chinese/);assert.match(p.input[0].content[0].text,/inulin concentration with amount/);assert.equal(JSON.parse(p.input[1].content[0].text).teachingGoal.caption,item.caption);assert.match(bound.binding.teachingGoalHash,/^[a-f0-9]{64}$/)});
