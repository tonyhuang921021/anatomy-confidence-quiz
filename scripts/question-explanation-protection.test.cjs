const assert = require('node:assert/strict');
const test = require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function loader(globals = {}, mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.json')) { const exports = JSON.parse(source); cache.set(file, { exports }); return exports; }
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
        const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}/index.ts`].find((entry) => fs.existsSync(path.join(root, entry)) && fs.statSync(path.join(root, entry)).isFile());
        if (!resolved) throw new Error(`Unresolved module ${name}`);
        return load(resolved);
      }
      if (name === 'react/jsx-runtime') return require(name);
      throw new Error(`External module blocked: ${name}`);
    };
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(js, { module, exports: module.exports, require: localRequire,
      console: { info() {}, warn() {}, error() {} }, process: { env: {QUESTION_EXPLANATION_MODEL:'gpt-6-luna',OPENAI_MODEL:'gpt-5.4-mini'} },
      Buffer, fetch() { throw new Error('Network forbidden in offline tests'); }, ...globals }, { filename: file });
    return module.exports;
  }
  return load;
}


let sideEffects=0;
const forbidden=()=>{sideEffects++;throw new Error('Unexpected model/database operation');};
const load=loader({}, {
 'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},
 '@supabase/supabase-js':{createClient:forbidden},
 '@/lib/openai':{getOpenAIModel:x=>x||'gpt-5.4-mini',isOpenAIConfigured:()=>true,createOpenAIText:forbidden},
 '@/lib/aiAccountBan':{getActiveAIAccountBan:forbidden}
});
const route=load('app/api/question-explanation/route.ts');
const index=JSON.parse(fs.readFileSync(path.join(root,'data/reviewedExplanationIndex.json')));
const before=JSON.stringify(index);
async function post(body){return route.POST({json:async()=>body});}
test('all 1401 accepted IDs reject forced generation before external work',async()=>{
 assert.equal(Object.keys(index).length,1401);
 for(const id of Object.keys(index)){
  const result=await post({action:'generate',force:true,reviewed:false,question:{id,stem:'forged',answer:'A',source:'unreviewed'}});
  assert.equal(result.status,409,id);assert.equal(result.body.code,'reviewed_explanation_protected');
 }
 assert.equal(sideEffects,0);assert.equal(JSON.stringify(index),before);
});
test('single and mixed batch cache sync cannot overwrite accepted editions',async()=>{
 const id=Object.keys(index)[0];
 for(const body of [{action:'sync_override',override:{questionId:id,explanation:'replacement'}},
 {action:'sync_overrides',overrides:[{questionId:'ordinary',explanation:'ordinary'},{questionId:id,explanation:'replacement'}]},
 {question:{id:' '+id+' ',stem:'forged',answer:'A'},force:true}]){
  assert.equal((await post(body)).status,409);
 }
 assert.equal(sideEffects,0);
});
test('client reviewed label does not protect ordinary AI questions',async()=>{
 const result=await post({question:{id:'MOEX-099130-2101-Q100'},reviewed:true});
 assert.equal(result.status,400); // ordinary validation, not protected
});
test('read-only route resolves dedicated Luna override without generating',async()=>{
 const result=await route.GET();assert.equal(result.body.model,'gpt-6-luna');
 assert.equal(result.body.reviewedExplanationsProtected,true);assert.equal(sideEffects,0);
});
test('all four entry points hide regeneration and reviewed renderer wins over cached text',()=>{
 for(const file of ['app/quiz/QuizClient.tsx','app/search/page.tsx','app/results/ResultsClient.tsx','app/notes/subject/[subject]/page.tsx']){
  assert.match(fs.readFileSync(path.join(root,file),'utf8'),/!hasReviewedExplanation/);
 }
 assert.match(fs.readFileSync(path.join(root,'components/StructuredExplanationText.tsx'),'utf8'),/hasReviewedExplanation\(questionId\)\) return <ReviewedExplanation/);
});
test('accepted question bypasses stale local overrides without reading storage',()=>{
 const storage=load('lib/storage.ts');
 const question={id:Object.keys(index)[0],explanation:'accepted original',optionAnalysis:{A:'accepted'},memoryTip:'original'};
 assert.equal(storage.applyQuestionExplanationOverride(question),question);
});
