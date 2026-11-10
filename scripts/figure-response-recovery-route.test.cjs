const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {recoverStoredFigureReview}=require('../lib/finalFigureRuntime.cjs');
const operationId='70000000-0000-4000-8000-000000000001',actor='80000000-0000-4000-8000-000000000001',parent='90000000-0000-4000-8000-000000000001';
const code=ts.transpileModule(fs.readFileSync('app/api/owner/new-explanation-images/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({admin=true,admitted=true,enabled=true,windowOpen=true,capture=true,sitewide=true,pilot=[],operator=actor,evidence=true}={}){
 const calls=[];const env={NEW_EXPLANATION_FIGURES_ADMIN:'1',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-not-secret',NEXT_PUBLIC_ADMIN_EMAILS:'owner@example.invalid',FIGURE_LUNA_REVIEW_ENABLED:enabled?'1':'0',EXPLANATION_SITEWIDE_ENABLED:sitewide?'1':'0',NEW_EXPLANATION_IMAGES_OPERATOR_ID:operator};
 const db={auth:{getUser:async()=>({data:{user:{id:actor,email:admin?'owner@example.invalid':'other@example.invalid'}}})},rpc:async(name,args)=>{
  calls.push([name,args]);if(name==='explanation_sitewide_request_allowed')return {data:admitted};
  if(name==='figure_model_read_response')return {data:evidence?{state:'committed',candidateStatus:'approved',binding:{requestId:parent,questionId:'FIXTURE',textHash:'a'.repeat(64)},responseBytes:'private-payload',responseSha:'private-digest'}:null};
  throw Error('unexpected mutation '+name);
 }};
 const modules={
  '@supabase/supabase-js':{createClient:()=>db},'next/server':{NextResponse:{json:(body,init)=>({body,status:init.status})}},
  '@/lib/finalFigureRuntime.cjs':{recoverStoredFigureReview,createFinalFigureReviewer:()=>assert.fail('no new provider')},
  '@/lib/figureCaptureGate.cjs':{figureCaptureAllowed:async()=>capture},
  '@/lib/newExplanationFigures.cjs':{boundedImageTargets:()=>pilot,imageWindowOpen:()=>windowOpen},
 };
 const context={exports:{},require:name=>modules[name]||{},process:{env},Buffer,console:{warn:()=>{}},fetch:()=>assert.fail('no fetch')};vm.runInNewContext(code,context);
 return {calls,post:body=>context.exports.POST({text:async()=>JSON.stringify({action:'model_recover',operationId,accessToken:'fixture-token',...body})})};
}
test('actual recovery HTTP route allows only current admin and original admitted actor',async()=>{
 const denied=fixture({admin:false});assert.equal((await denied.post()).status,403);assert.equal(denied.calls.length,0);
 const wrong=fixture({admitted:false});assert.equal((await wrong.post()).body.status,'held');assert.deepEqual(wrong.calls.map(x=>x[0]),['figure_model_read_response','explanation_sitewide_request_allowed']);assert.deepEqual(JSON.parse(JSON.stringify(wrong.calls[1][1])),{p_id:parent,p_actor:actor});
});
test('completed saved outcome returns safe status only, never raw journal data',async()=>{const f=fixture();const r=await f.post();assert.equal(r.status,200);assert.equal(r.body.status,'already_reviewed');assert.doesNotMatch(JSON.stringify(r.body),/private|responseBytes|responseSha|binding/);assert.equal(f.calls.length,2)});
test('recovery respects existing capture window and model gates before reading',async()=>{for(const override of [{enabled:false},{windowOpen:false},{capture:false}]){const f=fixture(override);assert.equal((await f.post()).status,503);assert.equal(f.calls.length,0)}});
test('malformed operation and missing session cannot read evidence',async()=>{for(const body of [{operationId:'invalid'},{accessToken:null}]){const f=fixture();assert.ok([400,401].includes((await f.post(body)).status));assert.equal(f.calls.length,0)}});
test('pilot recovery requires exact operator, question and saved text binding',async()=>{for(const [options,status] of [[{operator:'other'},'held'],[{pilot:[{questionId:'OTHER',textHash:'a'.repeat(64)}]},'held'],[{pilot:[{questionId:'FIXTURE',textHash:'b'.repeat(64)}]},'held'],[{pilot:[{questionId:'FIXTURE',textHash:'a'.repeat(64)}]},'already_reviewed']]){const f=fixture({sitewide:false,...options});assert.equal((await f.post()).body.status,status);assert.deepEqual(f.calls.map(x=>x[0]),['figure_model_read_response'])}});
test('old unknown without journal remains held and invokes no write',async()=>{const f=fixture({evidence:false});assert.equal((await f.post()).body.status,'held');assert.deepEqual(f.calls.map(x=>x[0]),['figure_model_read_response'])});
