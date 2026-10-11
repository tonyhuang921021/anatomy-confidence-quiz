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
      console: { info() {}, warn() {}, error() {} }, process: { env: {} },
      Buffer, fetch() { throw new Error('Network forbidden in offline tests'); }, ...globals }, { filename: file });
    return module.exports;
  }
  return load;
}

const load=loader();
const release=JSON.parse(fs.readFileSync(path.join(root,'data/sources/yangming_reviewed_release.json')));
const helper=load('lib/yangmingReviewedRelease.ts');
async function request(id, options={}) {
 const calls={reads:[],writes:0};
 const supabase={storage:{from:()=>({getPublicUrl:s=>({data:{publicUrl:'https://offline.invalid/'+s}})})},
 auth:{getUser:async()=>({data:{user:{id:'offline-user'}},error:null})},
 from(table){ const filters=[];const builder=new Proxy({},{get(_t,key){
  if(key==='maybeSingle')return async()=>{calls.reads.push({table,filters});return {data:{version_id:'test-active'},error:options.failRead?{message:'offline failure'}:null}};
  if(key==='then')return (resolve,reject)=>{
   calls.reads.push({table,filters});
   let data=table==='yangming_explanation_releases'?[{version_id:'test-active'}]:table.endsWith('_versioned')?(options.active??[]):(options.legacy??[]);
   return Promise.resolve({data,error:options.failRead?{message:'offline failure'}:null}).then(resolve,reject);
  };
  if(['insert','update','delete','upsert','rpc'].includes(key))return ()=>{calls.writes++;throw Error('Mutation forbidden')};
  return (...args)=>{filters.push([key,...args]);return builder};
 }});return builder;}
 };
 const route=loader({process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline-key'}}},{
  'next/server':{NextResponse:{json:(body,init)=>({status:init?.status??200,body})}},
  '@supabase/supabase-js':{createClient:()=>supabase},
  '@/lib/supabase/recoveryMode':{isSupabaseRecoveryMode:()=>false},
  '@/lib/serverTimeout':{withServerTimeout:async p=>p}
 })(options.report?'app/api/yangming-explanation-report/route.ts':'app/api/yangming-explanation/route.ts');
 const response=await route.POST({json:async()=>({questionId:id,accessToken:'offline-token',reason:'調整原稿',reportType:options.report?'correction':undefined}),headers:{get:()=>null}});
 return {response,calls};
}
test('all 672 bindings: 636 complete originals, 36 explicit fallback, 1087 immutable images',()=>{
 assert.equal(release.rows.length,672);assert.equal(new Set(release.rows.map(r=>r.questionId)).size,672);
 let images=0;
 for(const row of release.rows){const result=helper.findReviewedYangmingExplanation(row.questionId,'https://offline.invalid');
 assert.equal(result.content.reviewedOriginal,true);assert.equal(result.sourceQuestionId,row.sourceQuestionId);
 assert.equal(helper.findReviewedYangmingExplanation(row.sourceQuestionId,'https://offline.invalid').canonicalId,row.questionId);
 if(row.status==='pending_source'){assert.equal(result.content.pendingSource,true);assert.equal(result.content.assets.length,0);assert.ok(row.body.includes('原稿'));}
 else {assert.ok(result.content.assets.length>0);assert.equal(result.content.body,'');for(const a of result.content.assets){assert.ok(a.src.startsWith('https://offline.invalid/storage/v1/object/public/yangming-explanations/reviewed-releases/'));assert.equal(a.kind,'question_snapshot');images++;}}
 }
 assert.equal(release.rows.filter(r=>r.status==='replacement_ready').length,555);
 assert.equal(release.rows.filter(r=>r.status==='keep_existing').length,81);assert.equal(images,1087);
 assert.equal(helper.findReviewedYangmingExplanation('MOEX-999999-1301-Q001','https://offline.invalid'),null);
});
test('five protected human notes match original hashes; full-page cached text is never an author body',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/yangming-reviewed-release/source-identity-manifest.json')));
 for(const protectedRow of manifest.protectedBodies){const row=release.rows.find(r=>r.sourceQuestionId===protectedRow.question_id);
 assert.ok(row.humanNotes.some(n=>crypto.createHash('sha256').update(n.body).digest('hex')===protectedRow.body_sha256));}
 for(const row of release.rows.filter(r=>r.status!=='pending_source'))assert.equal(row.body,'');
});
test('actual route reads both current human layers and performs zero mutations',async()=>{
 const id='MOEX-105020-6301-Q072';
 const result=await request(id,{active:[{body:''}],legacy:[{body:'人工原文  保留\n換行',updated_at:'2026-10-11'}]});
 assert.equal(result.response.status,200);assert.equal(result.response.body.explanation.humanNotes[0].body,'人工原文  保留\n換行');
 assert.equal(result.calls.writes,0);assert.ok(result.calls.reads.some(r=>r.table==='yangming_question_explanations_versioned'));
 assert.ok(result.calls.reads.every(r=>r.table==='yangming_explanation_releases'||r.filters.some(([key])=>key==='in')));
 const cleared=await request(id);assert.equal(cleared.response.body.explanation.humanNotes.length,0,'a deliberate empty current note must not resurrect a snapshot');
 const degraded=await request(id,{failRead:true});assert.equal(degraded.response.body.explanation.humanNotesReadDegraded,true);assert.equal(degraded.response.body.explanation.humanNotes.length,1);
});
test('reviewed originals refuse in-place correction before any database update; ordinary report still has its existing path',async()=>{
 const result=await request('MOEX-106020-5301-Q036',{report:true});assert.equal(result.response.status,409);assert.equal(result.calls.writes,0);assert.equal(result.calls.reads.length,0);
});
test('community assets remain independently reviewable without reintroducing removed source candidates',()=>{
 const content=helper.findReviewedYangmingExplanation('MOEX-105020-6301-Q072','https://offline.invalid').content;
 const result=helper.mergeCurrentYangmingHumanContent(content,[{layer:'legacy',rows:[{body:'人工',match_status:'community_corrected',assets:['a']},{body:'人工',match_status:'source_not_verified',assets:['rejected']}]},{layer:'active',rows:[{body:'人工',match_status:'community_corrected',assets:['a']}]}],x=>x.map(src=>({src,kind:'question_snapshot'})));
 assert.equal(result.humanNotes.length,1);assert.equal(result.previousHumanAssets.length,1);assert.equal(result.previousHumanAssets[0].src,'a');assert.equal(result.assets.length,content.assets.length);
});
test('Q036 keeps D grading external to original and notes the printed A/body D discrepancy; 115-1 medical one is Chang Gung',()=>{
 const q=release.rows.find(r=>r.questionId==='MOEX-106020-5301-Q036');assert.ok(q.sourceNotes.some(n=>n.includes('D')&&n.includes('A')));assert.equal(q.sourceFile,'106-1醫學(一).pdf');
 assert.ok(release.rows.filter(r=>r.sourceFile==='115-1醫學一合併總檔.pdf'&&r.status!=='pending_source').every(r=>r.sourceLabel==='長庚117級原稿詳解'));
});
