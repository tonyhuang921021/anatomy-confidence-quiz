const test=require('node:test'),assert=require('node:assert/strict');
const {lunaTransport}=require('../lib/finalFigureRuntime.cjs');
const {reviewFinalFigure,recoverFinalFigure}=require('../lib/finalFigureSuitability.cjs');
const {createFinalFigureRepository}=require('../lib/finalFigureRepository.cjs');
const {policySnapshot,sha,diagnostic,decodeLunaResponse}=require('../lib/figureModelEvidence.cjs');
const text='## Cell signalling\nLigand activates the receptor.',bytes=Buffer.from('89504e470d0a1a0a01','hex');
const policy={enabled:true,fundingMode:'cash_authorized',cashAuthorized:true,fundingEvidenceSha:'a'.repeat(64),model:'gpt-6-luna',pricingRevision:'fixture',reserveMicroUsd:100,maxInputTokens:16000,maxOutputTokens:512,inputRate:1,outputRate:1};
const base={job:{request_id:'50000000-0000-4000-8000-000000000001',question_id:'Q1',explanation_sha256:sha(text)},row:{question_id:'Q1',image_bytes:bytes,image_sha256:sha(bytes),image_mime:'image/png',explanation_sha256:sha(text),source_url:'https://commons.wikimedia.org/wiki/File:Fixture.png',license_url:'https://creativecommons.org/licenses/by/4.0/',license:'CC BY 4.0',attribution:'Fixture author',section_title:'Receptor signalling'},item:{sectionTitle:'Cell signalling',sectionHash:sha(text),caption:'Receptor signalling'},text,policy,readQuestion:async()=>({id:'Q1',stem:'Which receptor?',options:{A:'RTK',B:'GPCR'},answer:'A'})};
function rawResponse(overrides={}){return Buffer.from(JSON.stringify({id:'resp_fixture',model:policy.model,status:'completed',usage:{input_tokens:100,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({verdict:'partial_match',labelLanguage:'en'})}]}],...overrides}))}
function fixture(options={}){
 let operation=null,modelCalls=0,countCalls=0,commits=0,stores=0,prepares=0,allow=true;const logs=[];
 const db={rpc:async(name,a)=>{
  if(name==='figure_model_reserve'){if(operation)return {data:{status:operation.state,operationId:operation.operationId}};operation={operationId:a.p_operation,key:a.p_key,candidateId:a.p_candidate,state:'reserved',candidateStatus:'pending',binding:a.p_binding,decoderRevision:'figure-response-v1',policy:policySnapshot(policy),responseSha:null,httpStatus:null,responseBytes:null};return {data:{status:'reserved',operationId:a.p_operation,sendToken:'fixture'}}}
  if(name==='figure_model_sent'){operation.state='sent';return {data:true}}
  if(name==='figure_model_read_response'){prepares++;return {data:options.prepareFails?null:{...operation,canDispatch:allow}}}
  if(name==='figure_model_store_response'){stores++;if(options.storeAck==='before')return {error:'connection error'};Object.assign(operation,{responseSha:a.p_sha,httpStatus:a.p_http_status,responseBytes:a.p_bytes});if(options.storeAck==='after')return {error:'ACK lost'};return {data:{saved:true,responseSha:a.p_sha}}}
  if(name==='figure_model_commit'){commits++;if(options.commitAck==='before'&&commits===1)return {error:'connection error'};operation.state=options.stale?'stale':'committed';operation.candidateStatus=options.stale?'pending':a.p_verdict==='mismatch'?'rejected':'approved';if(options.commitAck==='after'&&commits===1)return {error:'ACK lost'};return {data:{committed:!options.stale,status:operation.state,verdict:a.p_verdict}}}
  if(name==='figure_model_unknown'){if(['sent','reserved'].includes(operation.state))operation.state='unknown';return {data:true}}
  if(name==='figure_model_status')return {data:{status:operation.state,candidateStatus:operation.candidateStatus}};
  throw Error('unexpected RPC '+name);
 }};
 const fetcher=async(url)=>{
  if(url.endsWith('input_tokens')){countCalls++;if(options.pauseAfterCount)allow=false;if(options.countError)throw options.countError;return new Response(options.countBody??JSON.stringify({object:'response.input_tokens',input_tokens:100}),{status:options.countStatus??200})}
  modelCalls++;if(options.requestError)throw options.requestError;
  if(options.bodyError)return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([123]));c.error(options.bodyError)}}),{status:200});
  return new Response(options.raw??rawResponse(),{status:options.status??200});
 };
 const run=()=>reviewFinalFigure({...base,log:(...x)=>logs.push(x),repository:createFinalFigureRepository(db,'candidate'),provider:(input,hooks)=>lunaTransport(input,{env:{OPENAI_API_KEY:'not-a-real-key'},policy,fetcher,...hooks})});
 const recover=(authorize=async()=>true)=>recoverFinalFigure({operationId:operation.operationId,repository:createFinalFigureRepository(db,'candidate'),authorize,log:(...x)=>logs.push(x)});
 return {run,recover,logs,state:()=>operation,counts:()=>({modelCalls,countCalls,commits,stores,prepares})};
}
test('complete raw response is stored before publication and immutable policy is used',async()=>{const f=fixture();assert.equal((await f.run()).status,'display');assert.equal(f.counts().stores,1);assert.equal(f.counts().commits,1);assert.equal(f.state().responseBytes,'\\x'+rawResponse().toString('hex'));assert.equal((await f.run()).status,'already_reviewed');assert.equal(f.counts().modelCalls,1)});
test('prepare failure stops before any provider contact',async()=>{const f=fixture({prepareFails:true});assert.equal((await f.run()).status,'unknown');assert.equal(f.counts().countCalls,0);assert.equal(f.counts().modelCalls,0);assert.equal(f.logs[0][1].phase,'journal_prepare')});
test('pause during input counting stops before generation',async()=>{const f=fixture({pauseAfterCount:true});assert.equal((await f.run()).status,'unknown');assert.equal(f.counts().countCalls,1);assert.equal(f.counts().modelCalls,0);assert.equal(f.logs[0][1].phase,'journal_prepare');assert.equal(f.logs[0][1].code,'journal_unconfirmed')});
for(const [name,options,phase,code] of [
 ['count HTTP',{countStatus:429},'count_request','http_failed'],
 ['count timeout',{countError:Object.assign(new Error('secret token and URL'),{name:'TimeoutError'})},'count_request','timeout'],
 ['count malformed',{countBody:'{'},'count_parse','invalid_json'],
 ['count bound',{countBody:JSON.stringify({object:'response.input_tokens',input_tokens:99999})},'count_validate','input_bound'],
 ['response transport',{requestError:new Error('https://secret.example/token')},'response_request','network_failed'],
 ['response partial body',{bodyError:new Error('sensitive body')},'response_body','body_failed'],
 ['response too large',{raw:Buffer.alloc(65537)},'response_body','body_bound'],
 ['response HTTP',{status:503},'response_request','http_failed'],
 ['response JSON',{raw:Buffer.from('{')},'response_parse','invalid_json'],
 ['response UTF8',{raw:Buffer.from([0xff,0xfe])},'response_parse','invalid_json'],
 ['incomplete',{raw:rawResponse({status:'incomplete'})},'response_validate','incomplete_response'],
 ['wrong model',{raw:rawResponse({model:'wrong'})},'response_validate','model_mismatch'],
 ['missing usage',{raw:rawResponse({usage:null})},'response_validate','usage_invalid'],
 ['usage bound',{raw:rawResponse({usage:{input_tokens:999999,output_tokens:1}})},'response_validate','usage_bound'],
 ['invalid verdict',{raw:rawResponse({output:[{type:'message',content:[{type:'output_text',text:'no'}]}]})},'decision_parse','invalid_decision'],
 ['refusal',{raw:rawResponse({output:[{type:'message',content:[{type:'refusal',refusal:'cannot'}]}]})},'response_validate','incomplete_response'],
 ['mixed refusal',{raw:rawResponse({output:[{type:'message',content:[{type:'refusal',refusal:'cannot'},{type:'output_text',text:JSON.stringify({verdict:'match',labelLanguage:'en'})}]}]})},'response_validate','incomplete_response'],
 ['inconsistent completed error',{raw:rawResponse({error:{code:'fixture'}})},'response_validate','incomplete_response'],
 ['usage total mismatch',{raw:rawResponse({usage:{input_tokens:10,output_tokens:5,total_tokens:12}})},'response_validate','usage_invalid'],
])test(name+' is classified without raw secrets and never re-sent',async()=>{const f=fixture(options);assert.equal((await f.run()).status,'unknown');assert.equal(f.logs[0][1].phase,phase);assert.equal(f.logs[0][1].code,code);const calls=f.counts();assert.equal((await f.run()).status,'held');assert.deepEqual([f.counts().countCalls,f.counts().modelCalls],[calls.countCalls,calls.modelCalls]);assert.equal(f.counts().commits,0);assert.doesNotMatch(JSON.stringify(f.logs),/secret|sensitive|Fixture|not-a-real-key|https:/);if(f.state().responseBytes){assert.equal((await f.recover()).status,'held');assert.equal(f.counts().modelCalls,calls.modelCalls)}});
test('lost store ACK before commit has no result to recover',async()=>{const f=fixture({storeAck:'before'});assert.equal((await f.run()).status,'unknown');assert.equal((await f.recover()).status,'held');assert.equal(f.counts().modelCalls,1);assert.equal(f.counts().commits,0)});
test('lost store ACK after commit can recover bytes without provider replay',async()=>{const f=fixture({storeAck:'after'});assert.equal((await f.run()).status,'unknown');assert.equal((await f.recover()).status,'display');assert.equal(f.counts().modelCalls,1);assert.equal(f.counts().stores,1)});
test('lost publication ACK before commit recovers once using saved response',async()=>{const f=fixture({commitAck:'before'});assert.equal((await f.run()).status,'unknown');assert.equal((await f.recover()).status,'display');assert.equal((await f.recover()).status,'already_reviewed');assert.equal(f.counts().commits,2);assert.equal(f.counts().modelCalls,1)});
test('lost publication ACK after commit does not republish or settle again',async()=>{const f=fixture({commitAck:'after'});assert.equal((await f.run()).status,'unknown');assert.equal((await f.recover()).status,'already_reviewed');assert.equal(f.counts().commits,1);assert.equal(f.counts().modelCalls,1)});
test('withdrawn and stale results stay withdrawn/stale on recovery',async()=>{const f=fixture({commitAck:'after'});await f.run();f.state().candidateStatus='rejected';assert.equal((await f.recover()).status,'withdrawn');assert.equal(f.counts().commits,1);const g=fixture({stale:true});await g.run();assert.equal((await g.recover()).status,'stale');assert.equal(g.counts().commits,1)});
test('recovery authorization, decoder and byte hash failures never commit',async()=>{for(const [authorized,mutate] of [[false,()=>{}],[true,e=>e.decoderRevision='future'],[true,e=>e.responseSha='0'.repeat(64)]]){const f=fixture({storeAck:'after'});await f.run();mutate(f.state());assert.equal((await f.recover(async()=>authorized)).status,'held');assert.equal(f.counts().commits,0)}});
test('untrusted exception strings are never emitted',()=>{assert.deepEqual(Object.keys(diagnostic(new Error('password token https://private'), 'commit')).sort(),['code','elapsedMs','phase']);assert.throws(()=>decodeLunaResponse(Buffer.from('{}'),200,policy));});
