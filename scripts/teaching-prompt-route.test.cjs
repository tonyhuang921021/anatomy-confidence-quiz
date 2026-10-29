const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function compile(path, mockRequire, extra={}) {
  const source=fs.readFileSync(path,'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(output,{module,exports:module.exports,require:mockRequire,console,Date,JSON,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake'}},...extra},{filename:path});
  return module.exports;
}
const format=compile('lib/questionExplanationFormat.ts',()=>{throw Error('unexpected format import')});
function setup(responses) {
  let calls=[],writes=[];
  const chain={select(){return this},eq(){return this},gte(){return Promise.resolve({count:0,error:null})},maybeSingle(){return Promise.resolve({data:null,error:null})},insert(row){writes.push(['log',row]);return Promise.resolve({error:null})},upsert(row){writes.push(['override',row]);return Promise.resolve({error:null})}};
  const client={auth:{getUser:async()=>({data:{user:{email:'test@example.invalid'}},error:null})},from:()=>chain};
  const mocks={
    '@/lib/rocDate':{formatRocDate:()=>''},
    '@/lib/reviewedExplanations':{hasReviewedExplanation:id=>id==='reviewed'},
    'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
    '@supabase/supabase-js':{createClient:()=>client},
    '@/lib/openai':{isOpenAIConfigured:()=>true,getOpenAIModel:()=> 'gpt-6-luna',createOpenAIText:async(prompt,max,model)=>{calls.push({prompt,max,model});if(!responses.length)throw Error('unexpected model call');return {text:responses.shift(),model,usage:{inputTokens:1,outputTokens:1,totalTokens:2}}}},
    '@/lib/aiAccountBan':{getActiveAIAccountBan:async()=>null},
    '@/lib/questionExplanationFormat':format,
    '@/lib/supabase/recoveryMode':{isSupabaseRecoveryMode:()=>false},
    '@/lib/serverTimeout':{isServerTimeoutError:()=>false,withServerTimeout:p=>p}
  };
  const route=compile('app/api/question-explanation/route.ts',name=>{if(!(name in mocks))throw Error('unexpected import '+name);return mocks[name]});
  const request=body=>({json:async()=>body,headers:{get:()=>null}});
  return {route,request,calls,writes};
}
const question={id:'new',stem:'題幹',answer:'A',options:{A:'甲',B:'乙',C:'丙',D:'丁'}};
const full=JSON.stringify({explanation:'因為甲正確。',optionAnalysis:{A:'正確原因',B:'不對原因',C:'不對原因',D:'不對原因'},memoryTip:''});
test('短但完整的 JSON 只呼叫一次，仍使用原 Luna 與輸出上限',async()=>{const x=setup([full]);const r=await x.route.POST(x.request({accessToken:'fake',question}));assert.equal(r.status,200);assert.equal(r.body.explanation,'因為甲正確。');assert.deepEqual(Object.keys(r.body.optionAnalysis),['A','B','C','D']);assert.equal(x.calls.length,1);assert.equal(x.calls[0].max,2400);assert.equal(x.calls[0].model,'gpt-6-luna');assert.ok(x.calls[0].prompt.includes('不要在生成內容中自行編造題號'));assert.equal(x.writes.filter(w=>w[0]==='override').length,1)});
test('漏選項會重試後解析完整 JSON，並保持每次 token 上限',async()=>{const incomplete=JSON.stringify({explanation:'原因',optionAnalysis:{A:'正確原因'}});const x=setup([incomplete,full]);const r=await x.route.POST(x.request({accessToken:'fake',question}));assert.equal(r.status,200);assert.equal(x.calls.length,2);assert.ok(x.calls.every(c=>c.max===2400&&c.model==='gpt-6-luna'));assert.deepEqual(Object.keys(r.body.optionAnalysis),['A','B','C','D'])});
test('空回應不寫入；已審題生成和同步均在任何呼叫或寫入前阻擋',async()=>{const x=setup(['']);const bad=await x.route.POST(x.request({accessToken:'fake',question}));assert.equal(bad.status,500);assert.equal(x.writes.length,0);const y=setup([]);for(const body of [{question:{...question,id:'reviewed'}},{action:'sync_override',override:{questionId:'reviewed'}},{action:'sync_overrides',overrides:[{questionId:'reviewed'}]}]){const r=await y.route.POST(y.request(body));assert.equal(r.status,409)}assert.equal(y.calls.length,0);assert.equal(y.writes.length,0)});
