// Candidate HTTP handler tests. All dependencies are stubs, no network or real data.
const fs=require('fs'),vm=require('vm'),ts=require(process.cwd()+'/node_modules/typescript'),assert=require('node:assert/strict');
const env={NEXT_PUBLIC_SUPABASE_URL:'https://mock.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENAI_API_KEY:'synthetic',NEXT_PUBLIC_ADMIN_EMAILS:'owner@example.invalid',AI_SHARED_PRICING_REVISION:'v1',AI_SHARED_INPUT_MICROUSD_PER_MILLION:'1',AI_SHARED_OUTPUT_MICROUSD_PER_MILLION:'1'};
const q={id:'q1',subject:'解剖學',chapter:'c',section:'s',stem:'test',sourceType:'MOEX_PAST_EXAM',sourceYear:2020,options:{A:'a',B:'b'}};
let kind='',events=[],seq=0,deny=false,missingUsage=false;
const user={id:'00000000-0000-0000-0000-000000000011',email:'owner@example.invalid',created_at:'2020-01-01T00:00:00Z'};
const db={auth:{getUser:async()=>({data:{user},error:null})},from(name){const c={select(){return c},eq(){return c},gte(){return c},in(){return c},order(){return c},limit(){return c},insert(){return c},update(){return c},single(){return Promise.resolve({data:{id:1},error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})},then(a,b){return Promise.resolve({data:[],error:null,count:0}).then(a,b)}};return c;},rpc:async (name,args)=>{events.push(name);if(name==='ai_guard_reserve_route'){kind=args.p_kind;seq=0;return {data:deny?'budget':'reserved'}};if(name==='ai_guard_read_reservation')return {data:[{model:'mock-model',pricing_revision:'v1',call_limit:kind==='custom_search'?2:1,per_call_ceiling_microusd:1}]};if(name==='ai_guard_start_route')return {data:'started'};if(name==='ai_guard_settle_call')return {data:'settled'};if(name==='ai_guard_close')return {data:'closed'};if(name==='ai_guard_mark_unknown')return {data:'disabled_held'};throw Error(name)}};
const openai={getOpenAIModel:()=> 'mock-model',isOpenAIConfigured:()=>true,createOpenAIText:async()=>{events.push('provider');seq++;let text=kind==='classification'?JSON.stringify({subject:'解剖學',primaryTag:'tag',chapter:'c'}):kind==='custom_search'?seq===1?JSON.stringify({title:'t',searchTerms:['x'],relatedConcepts:[]}):JSON.stringify({relevantIds:['q1'],reason:'r'}):'{}';return {model:'mock-model',text,usageKnown:!missingUsage,usage:{inputTokens:2,outputTokens:2,totalTokens:4}}}};
class NextResponse {static json(body,opts={}){return {status:opts.status??200,body}}}
const mods={
 'next/server':{NextResponse},'@supabase/supabase-js':{createClient:()=>db},'@/lib/openai':openai,
 '@/lib/aiAccountBan':{getActiveAIAccountBan:async()=>null},'@/lib/supabase/recoveryMode':{isSupabaseRecoveryMode:()=>false,getRecoveryTimestamp:()=>null},
 '@/lib/questionClassificationAutoApply':{AUTO_CLASSIFICATION_APPROVER:'test',autoApplyQuestionClassification:async()=>({appliedAt:'now',approvedByEmail:'test'})},
 '@/data/analysisPrimaryTagTaxonomy.json':{primaryTags:[{name:'tag',subject:'解剖學'}]},
 '@/lib/rocDate':{formatRocDate:()=>''},'@/lib/answerKeyRevisions':{regradeSessionForCurrentAnswerKey:x=>x},
 '@/lib/customPaperSearch':{expandCustomPaperSearchTerms:x=>x,rankCustomPaperSearchCandidates:()=>[{question:q}],orderCustomPaperSearchResults:arr=>arr},
 '@/lib/practiceYears':{MIN_PRACTICE_SOURCE_YEAR:1990,MAX_PRACTICE_SOURCE_YEAR:2026,normalizePracticeYearRange:x=>x},
 '@/data/bundledCustomPapers':{bundledCustomPaperSeeds:[]},'@/data/med1QuestionBank':{getCanonicalQuestionBank:()=>[q]},
 '@/data/subjectRegistry':{MED1_SUBJECTS:['解剖學'],MED2_SUBJECTS:[]},
 '@/lib/questionManagement':{buildNeuroCandidateQuestions:()=>[q],buildNeuroSuggestionPrompt:()=> 'neuro',getNeuroAnatomyQuestionBank:()=>[q],parseNeuroSuggestionResponse:()=>({questionId:'q1',tags:[],relations:[]})}
};
function load(path){const src=fs.readFileSync(path,'utf8'),code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require:n=>{if(n in mods)return mods[n];return require(n)},process:{env},Buffer,console,setTimeout,clearTimeout,URL,Date,Promise});return m.exports}
mods['@/lib/sharedPaidGuard']=load(process.cwd()+'/lib/sharedPaidGuard.ts');
const req=body=>({json:async()=>body});
(async()=>{
 const classification=load(process.cwd()+'/app/api/question-classification-report/route.ts');events=[];let r=await classification.POST(req({accessToken:'synthetic',question:q}));assert.equal(r.status,200,JSON.stringify(r));assert.equal(events.filter(x=>x==='provider').length,1);assert.ok(events.includes('ai_guard_close'));console.log('PASS classification POST -> real shared helper -> mocked RPC/provider');
 const owner=load(process.cwd()+'/app/api/owner/question-management/route.ts');events=[];r=await owner.POST(req({accessToken:'synthetic',action:'generate_neuro_suggestions',questionId:'q1'}));assert.equal(r.status,200,JSON.stringify(r));assert.equal(events.filter(x=>x==='provider').length,1);console.log('PASS owner POST -> real shared helper -> mocked RPC/provider');
 const custom=load(process.cwd()+'/app/api/custom-papers/route.ts');events=[];r=await custom.POST(req({accessToken:'synthetic',action:'preview_ai_search',query:'x',selectedSubjects:['解剖學'],yearFrom:2019,yearTo:2021}));assert.equal(r.status,200,JSON.stringify(r));assert.equal(events.filter(x=>x==='provider').length,2);assert.ok(events.includes('ai_guard_close'));console.log('PASS custom-search POST -> real shared helper -> mocked RPC/provider');
 deny=true;events=[];r=await classification.POST(req({accessToken:'synthetic',question:q}));assert.notEqual(r.status,200);assert.equal(events.includes('provider'),false);deny=false;console.log('PASS budget denial prevents classification provider');
 missingUsage=true;events=[];r=await owner.POST(req({accessToken:'synthetic',action:'generate_neuro_suggestions',questionId:'q1'}));assert.notEqual(r.status,200);assert.ok(events.includes('ai_guard_mark_unknown'));assert.ok(!events.includes('ai_guard_close'));missingUsage=false;console.log('PASS unknown usage disables and retains reservation');
 events=[];r=await classification.POST(req({question:q}));assert.equal(r.status,401);assert.equal(events.length,0);console.log('PASS unauthenticated classification does not reach guard');
 events=[];r=await owner.POST(req({accessToken:'synthetic',action:'inspect_question',questionId:'q1'}));assert.equal(r.status,200,JSON.stringify(r));assert.equal(events.length,0);console.log('PASS non-generating owner read avoids guard and provider');
})().catch(e=>{console.error(e);process.exitCode=1});
