'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),ts=require('typescript');
const target='4d44a0ba-a6fa-4175-8634-eee2dfbfc899',other='bf061307-b15c-46dc-94f7-fb55aa43f788';
const text='Original explanation never changes.',hash=createHash('sha256').update(text).digest('hex');
const bytes=Buffer.from('89504e470d0a1a0a','hex'),sha=createHash('sha256').update(bytes).digest('hex');
function fixture({figures=[target],flags={},forceBound=null}={}){
 const io={list:0,bytes:0,mutations:0},request=(questionId='Q002')=>({nextUrl:new URL('https://test.invalid/?questionId='+questionId)});
 const row=id=>({id,source_url:'https://commons.wikimedia.org/wiki/File:Exact.png',license_url:'https://creativecommons.org/licenses/by/4.0/',license:'CC BY 4.0',attribution:'Fixture',section_title:'Title',image_sha256:sha});
 const bound=id=>({...row(id),status:'approved',section_anchor:'section-1',section_heading:'Teach',explanation_sha256:hash});
 const opts={question_explanation_overrides:{data:{explanation:text,figure_status:'approved',replacement_revision:null}},figure_queue_jobs:{data:{state:'done',image_status:'approved',figure_needs:{items:[{sectionTitle:'Teach',sectionHash:'f'.repeat(64)}]}}},explanation_figure_candidates:{data:(forceBound??figures).map(bound)}};
 const chain=table=>({select(){return this},eq(){return this},maybeSingle(){return Promise.resolve(opts[table])},limit(){return Promise.resolve(opts[table])},update(){io.mutations++;throw Error('read only')}});
 const db={from:chain,rpc:async(name)=>{
   if(name==='list_approved_explanation_figures'){io.list++;return {data:figures.map(row)}}
   if(name==='read_approved_explanation_figure'){io.bytes++;return {data:[{image_mime:'image/png',image_bytes:bytes,image_sha256:sha}]}}
   throw Error(name);
 }};
 const load=(p,extra={})=>{
  const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  const dep=(n)=>{if(n in extra)return extra[n];if(n==='node:crypto')return require(n);throw Error('unexpected import '+n)};
  new Function('module','exports','require','process',js)(module,module.exports,dep,{env:{FIGURE_REVIEW_ENABLED:'1',NEW_EXPLANATION_FIGURES_RENDER:'1',NEXT_PUBLIC_SUPABASE_URL:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture',...flags}});
  return module.exports;
 };
 const security=load('lib/approvedFigureSecurity.ts',{'./figureSourceIdentity.cjs':{safeFigureSource:()=>true}});
 const common={'next/server':{NextResponse:Response},'@supabase/supabase-js':{createClient:()=>db},'@/lib/approvedFigureSecurity':security};
 const list=load('app/api/approved-figures/route.ts',{...common,'@/lib/explanationImageActivity':{imageActivityForJob:(_j,b)=>({phase:b?'complete':'stopped'})},'@/lib/publishedTrialFigures':{publishedTrialFigure:()=>null},'@/lib/userProvidedExplanationFigure.cjs':{userProvidedExplanationFigure:()=>null}}).GET;
 const blob=load('app/api/approved-figures/[id]/route.ts',{...common,'@/lib/figureReviewAdapter.cjs':{decodeBytea:x=>x}}).GET;
 return {io,request,list,blob};
}
test('identified asset removed from the learner response without a false in-progress message; explanation stays intact',async()=>{
 const f=fixture();const r=await f.list(f.request());assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const body=await r.json();assert.deepEqual(body,{figures:[],sectionFigures:[],explanationHash:hash,imageStatus:null,imageActivity:null,sections:[]});assert.equal(f.io.mutations,0);
});
test('direct immutable UUID and uppercase aliases return empty uncached 404 without any storage fetch',async()=>{
 const f=fixture();for(const id of [target,target.toUpperCase()]){const r=await f.blob(f.request(),{params:{id}});assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(await r.text(),'');}
 assert.equal(f.io.bytes,0);assert.equal(f.io.mutations,0);
});
test('other assets and other image modes retain existing metadata/status and bytes',async()=>{
 const f=fixture({figures:[target,other]});
 const r=await f.list(f.request());const body=await r.json();assert.equal(body.sectionFigures.length,1);assert.equal(body.sectionFigures[0].id,other);assert.equal(body.imageActivity.phase,'complete');assert.equal(body.imageStatus,'approved');
 const image=await f.blob(f.request(),{params:{id:other}});assert.equal(image.status,200);assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);assert.equal(f.io.bytes,1);assert.equal(f.io.mutations,0);
 const legacy=fixture({figures:[target,other],flags:{NEW_EXPLANATION_FIGURES_RENDER:'0'}});
 assert.deepEqual((await (await legacy.list(legacy.request())).json()).figures.map(x=>x.id),[other]);
});
test('normal no-figure reader reuses exactly the existing status computation',async()=>{
 const f=fixture({figures:[]});const body=await (await f.list(f.request())).json();assert.equal(body.explanationHash,hash);assert.equal(body.imageActivity.phase,'stopped');assert.equal(body.imageStatus,'approved');
});
