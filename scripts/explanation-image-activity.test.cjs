const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
const m=new Module('image-activity');m._compile(ts.transpileModule(fs.readFileSync('lib/explanationImageActivity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,'image-activity');
const {imageActivityForJob:activity,imageActivityCopy:copy}=m.exports;
const now=Date.parse('2026-11-09T14:17:35Z'),job={state:'leased',lease_until:new Date(now+600000).toISOString(),updated_at:new Date(now-1000).toISOString(),image_status:'searching'};
test('only live exact-job lease displays still searching; text is already complete',()=>{const state=activity(job,false,now);assert.equal(state.phase,'searching');assert.equal(copy(state,now,now).label,'詳解已完成，還在找圖');assert.equal(copy(state,now,now).active,true)});
test('finished empty or unknown Q098 outcome never says searching',()=>{const state=activity({...job,state:'done'},false,now);assert.equal(state.phase,'stopped');assert.equal(copy(state,now,now).active,false);assert.doesNotMatch(copy(state,now,now).label,/還在找圖/)});
test('queued, expired, missing and failed jobs never animate search',()=>{for(const row of [null,{...job,state:'pending'},{...job,state:'failed'},{...job,lease_until:new Date(now-1).toISOString()},{...job,updated_at:new Date(now-120001).toISOString()}])assert.notEqual(copy(activity(row,false,now),now,now)?.active,true)});
test('stale network snapshot stops animation after bounded freshness even without another response',()=>{const state=activity(job,false,now);assert.equal(copy(state,now,now+15001).active,false);assert.equal(copy({...state,ttlMs:Infinity},now,now).active,false)});
test('review uses its own wording and displayed images finish the indicator',()=>{assert.equal(copy(activity({...job,image_status:'pending_visual_review'},false,now),now,now).active,false);assert.equal(copy(activity(job,true,now),now,now),null)});
test('API only reads exact text version; UI only consumes status and does not dispatch searches',()=>{const api=fs.readFileSync('app/api/approved-figures/route.ts','utf8'),ui=fs.readFileSync('components/SectionExplanationFigures.tsx','utf8');assert.match(api,/eq\('explanation_sha256',hash\)/);assert.match(api,/imageActivity:imageActivityForJob\(jobs.data,figures.some/);assert.match(ui,/data.explanationHash!==hash/);assert.match(ui,/<ExplanationProgressCat\//);assert.match(ui,/imageActivityCopy\(/);assert.doesNotMatch(ui,/method:\s*['"]POST|processSavedImages|continueFigure/)});

test('unconfirmed stage or model result with a leftover lease is not active, nor is a legacy awaiting-image lease',()=>{for(const image_status of ['pending_visual_review','awaiting_image','approved'])assert.equal(copy(activity({...job,image_status},false,now),now,now).active,false)});

test('confirmed terminal quota stop is explicit and never animates or claims no search result',()=>{
 const state=activity({...job,state:'done',image_status:'awaiting_budget'},false,now,{mode:'taipei_daily_v1',searchExhausted:true});
 assert.equal(state.phase,'budget_blocked');assert.equal(state.ttlMs,0);const message=copy(state,now,now);
 assert.equal(message.active,false);assert.match(message.label,/今日找圖額度已達上限/);assert.match(message.caption,/台灣時間每日 00:00/);
 assert.doesNotMatch(message.caption,/自動恢復|沒有找到|還在找/);
});
test('an actually displayed image takes priority over a stale quota status',()=>{
 assert.equal(activity({...job,state:'done',image_status:'awaiting_budget'},true,now).phase,'complete');
 assert.equal(copy(activity({...job,state:'done',image_status:'awaiting_budget'},true,now),now,now),null);
 assert.equal(activity({...job,state:'pending',image_status:'awaiting_budget'},false,now).phase,'queued');
});

test('ambiguous old awaiting-budget value alone or read failure never claims quota was exhausted',()=>{
 const row={...job,state:'done',image_status:'awaiting_budget'};
 for(const evidence of [null,{}, {mode:'legacy',searchExhausted:true},{mode:'taipei_daily_v1',searchExhausted:false}]){
  const state=activity(row,false,now,evidence);assert.equal(state.phase,'stopped');assert.doesNotMatch(copy(state,now,now).label,/上限/);
 }
});
test('download limits are distinct from the Taiwan daily search cap and successful images win',()=>{
 const row={...job,state:'done',image_status:'awaiting_budget'};
 for(const key of ['downloadExhausted','downloadBytesExhausted']){
  const capacity={mode:'taipei_daily_v1',[key]:true};assert.match(copy(activity(row,false,now,capacity),now,now).label,/圖片下載額度/);
  assert.equal(activity(row,true,now,capacity).phase,'complete');
 }
});
