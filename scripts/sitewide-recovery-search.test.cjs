const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildNeedsWithFallback,approveSchemaQueries,runOne,sha}=require('../lib/newExplanationFigures.cjs');
const text='## 正解與計算\n菊糖清除率是 84 mL/min。\n\n## 生理意義\n菊糖可自由濾過，不被再吸收或分泌。';
const question={id:'ANY-INULIN-QUESTION',subject:'生理學',stem:'菊糖（inulin）的清除率為何？'};
const plan=()=>approveSchemaQueries(buildNeedsWithFallback(text,[],question));
test('missing or broad inulin image hint preserves the specific substance and teaching purpose',()=>{
 for(const hints of [[],[{sectionTitle:'生理意義',conceptId:'glomerular-filtration',caption:'濾過屏障',searchTerm:'glomerular filtration',searchScope:'general-medical',medicalDomain:'physiology'}]]){
  const n=approveSchemaQueries(buildNeedsWithFallback(text,hints,question));assert.equal(n.items[0].sectionTitle,'生理意義');assert.equal(n.items[0].query,'inulin clearance diagram');assert.deepEqual(n.items[0].queryAlternatives,['inulin is freely filtered by the glomerulus']);assert.doesNotMatch(n.items[0].caption,/濃度變化|屏障/);
 }
 const concentration=approveSchemaQueries(buildNeedsWithFallback(text,[],{...question,stem:'菊糖在各腎小管的濃度如何變化？'}));assert.equal(concentration.items[0].query,'inulin tubular fluid concentration nephron');
});
function worker({failSearch=false,failCache=false,cacheAck=true,deny=false,primaryNonempty=false,invalid=false}={}){
 const needs=plan();if(invalid)needs.items[0].queryAlternatives=['patient smith'];const calls=[];
 const job={request_id:'new',question_id:question.id,explanation_sha256:sha(text),attempts:1};
 const store={claim:async()=>job,readText:async()=>text,readNeeds:async()=>needs,active:async()=>true,cacheGet:async()=>null,reserve:async(j,l,key,kind)=>{calls.push(['reserve',kind,key]);return !deny},cachePut:async(j,l,key,items)=>{calls.push(['cache',key]);if(failCache)throw Error('unknown cache acknowledgement');return cacheAck},finish:async(j,l,status)=>({status}),stage:async()=>assert.fail('no eligible image fixture')};
 return{calls,run:()=>runOne({store,enabled:true,search:async q=>{calls.push(['search',q]);if(failSearch)throw Error('unknown search outcome');return primaryNonempty?[{sourceUrl:'https://invalid.example/image'}]:[]},loadImage:async()=>assert.fail('no download')})};
}
test('only a confirmed empty search advances once to the saved alternative, with separate cap reservation',async()=>{const f=worker();assert.equal((await f.run()).status,'awaiting_image');assert.deepEqual(f.calls.filter(x=>x[0]==='search').map(x=>x[1]),['inulin clearance diagram','inulin is freely filtered by the glomerulus']);assert.equal(f.calls.filter(x=>x[0]==='reserve').length,2)});
test('uncertain search or cache acknowledgement never advances to another query',async()=>{for(const opts of [{failSearch:true},{failCache:true},{cacheAck:false},{cacheAck:null}]){const f=worker(opts);await f.run();assert.equal(f.calls.filter(x=>x[0]==='search').length,1)}});
test('budget denial and unsafe alternatives stop; confirmed ineligible results can advance',async()=>{for(const [opts,count] of [[{deny:true},0],[{invalid:true},0],[{primaryNonempty:true},2]]){const f=worker(opts);await f.run();assert.equal(f.calls.filter(x=>x[0]==='search').length,count)}});
test('schema alternatives cannot contain identifiers, URLs or personal-data terms',()=>{for(const q of ['patient smith','renal 123','https://example.com']){const n=plan();n.items[0].proposedAlternatives=[q];assert.equal(approveSchemaQueries(n),null)}});

const {reviewStagedFigure}=require('../lib/stagedFigureReview.cjs');
function stagedFixture({status=null,allowed=true,count=1,state='leased',attempts=1,revision=null,changed=false}={}){
 let reviewed=0;const calls=[],bytes=Buffer.from([137,80,78,71,13,10,26,10,1]),item=plan().items[0];
 const row={id:'candidate',question_id:question.id,explanation_sha256:sha(text),image_bytes:bytes,status:'pending',section_sha256:item.sectionHash,section_heading:item.sectionTitle,section_anchor:item.sectionAnchor,section_title:item.caption};
 const job={request_id:'exact-original-request',question_id:question.id,explanation_sha256:sha(text),figure_needs:{items:[item]},needs_state:'approved',state,attempts};
 const saved={question_id:question.id,explanation:text,option_analysis:{A:'correct'},memory_tip:'inulin',model:'fixture',updated_at:'2026-11-09T00:00:00+00:00',reading_format:'full-v1',replacement_revision:revision,figure_status:'awaiting_image'};
 
 const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='figure_model_candidate_status'?status:name.endsWith('_status')?{status:changed?'superseded':'completed',value:saved}:allowed}},from:table=>{const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:table==='explanation_figure_candidates'?row:saved}),limit:async()=>({data:Array.from({length:count},()=>job)})};return q}};
 return{calls,reviewed:()=>reviewed,run:()=>reviewStagedFigure({db,candidateId:'candidate',sitewide:true,actorId:'verified-actor',targets:[],reviewer:async a=>{reviewed++;assert.equal(a.job.request_id,'exact-original-request');assert.equal(a.stagedContinuation,true);return {status:'display'}}})};
}
test('sitewide staged review uses exact original request and authenticated actor without pilot IDs',async()=>{const f=stagedFixture();assert.equal((await f.run()).status,'display');assert.deepEqual(f.calls[1],['explanation_sitewide_request_allowed',{p_id:'exact-original-request',p_actor:'verified-actor'}]);assert.equal(f.reviewed(),1)});
test('unknown existing review, wrong actor, ambiguous job and attempted replay never call model',async()=>{for(const opts of [{status:{state:'unknown'}},{allowed:false},{count:2},{state:'done'},{attempts:2},{revision:'different-current-version'},{changed:true}]){const f=stagedFixture(opts);await f.run();assert.equal(f.reviewed(),0)}});
test('all note readers expose replacement and synchronize both replace and restore versions',()=>{for(const p of ['components/StudyNoteQuestionCard.tsx','app/notes/subject/[subject]/page.tsx']){const s=fs.readFileSync(p,'utf8');assert.match(s,/<ExplanationReplacementControls questionId=\{question.id\}/);assert.match(s,/explanation-version-changed/);assert.match(s,/questionId=\{question.id\}/)}const tabs=fs.readFileSync('components/QuestionExplanationTabs.tsx','utf8');assert.doesNotMatch(tabs,/moreActionsContent\?<button|moreActionsContent\?<div/)});

test('production cache adapter preserves false and null RPC acknowledgements',async()=>{const {createStore}=require('../lib/newExplanationFigures.cjs');for(const data of [false,null,true]){const store=createStore({rpc:async(name)=>{assert.equal(name,'figure_image_cache_put');return {data,error:null}}});assert.equal(await store.cachePut({request_id:'original'},'lease','key',[]),data)}});
