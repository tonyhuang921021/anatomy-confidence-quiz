const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {setup,role}=require('./helpers/write-boundary-fixture.cjs');
const {buildNeeds,approveSchemaQueries}=require('../lib/newExplanationFigures.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex'),id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const val=async(db,q,p)=>(await db.query(q,p)).rows[0]?.v;
const call=(db,q,p)=>role(db,'service_role',()=>val(db,q,p));
test('sitewide continuation uses non-superuser writer, preserves exact actor and one-dispatch limits',async t=>{
 const db=await setup();try{
  await db.exec(`create table figure_model_private.continuations(id uuid primary key,parent_request uuid not null,actor_id uuid not null,question_id text not null,text_sha text not null,query text not null,item jsonb not null,created_at timestamptz not null default clock_timestamp());
  create table public.figure_image_cache(key text primary key,items jsonb);alter table public.figure_image_cache owner to app_writer;
  create table figure_model_private.image_steps(continuation_id uuid not null,kind text not null,key text not null,state text not null default 'sent',payload jsonb,image_bytes bytea,image_mime text,created_at timestamptz not null default clock_timestamp(),primary key(kind,key));
  alter table figure_model_private.continuations owner to app_writer;alter table figure_model_private.image_steps owner to app_writer;
  create function public.figure_continuation_batch_lock(p_actor uuid) returns boolean language plpgsql security definer set search_path=pg_catalog,figure_model_private as $$begin perform 1 from figure_model_private.batch where id and enabled and actor_id=p_actor for update;return found;end$$;
  alter function public.figure_continuation_batch_lock(uuid) owner to ai_guard_owner;revoke all on function public.figure_continuation_batch_lock(uuid) from public;grant execute on function public.figure_continuation_batch_lock(uuid) to app_writer;
  `);
  await db.exec(fs.readFileSync('proposals/cloud-sitewide-image-continuation.sql','utf8'));
  for(const signature of ['figure_continuation_open(uuid,uuid,uuid,text,jsonb)','figure_continuation_step(uuid,uuid,text,text,text)'])await db.exec(`alter function public.${signature} owner to app_writer;revoke all on function public.${signature} from public,anon,authenticated;grant execute on function public.${signature} to service_role;`);
  const actor=id(2),request=id(1),question='OUTSIDE-PILOT-INULIN',text='## 生理意義\n菊糖可自由濾過，不被再吸收或分泌。';
  const plan=buildNeeds(text,[{sectionTitle:'生理意義',conceptId:'inulin-clearance',caption:'菊糖清除率',searchTerm:'inulin clearance',searchScope:'general-medical',medicalDomain:'physiology'}]);
  assert.equal(await call(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,null,$6) v',[request,actor,question,'a'.repeat(64),'b'.repeat(40),'generate']),'reserved');
  assert.equal(await call(db,'select ai_guard_start_call($1,1) v',[request]),'started');
  const response={model:'gpt-6.1-terra',responseId:'fixture-continuation',rawText:'Mock result',usage:{inputTokens:500,outputTokens:500},value:{explanation:text,optionAnalysis:{A:'正確',B:'錯誤'},memoryTip:'菊糖清除率'},needs:plan};
  assert.equal(await call(db,'select explanation_generation_stage($1,$2,$3,$4) v',[request,actor,['A','B'],response]),'saved');
  assert.equal((await call(db,'select explanation_generation_recover($1,$2,$3) v',[request,actor,question])).status,'completed');
  const approved=approveSchemaQueries(plan);
  assert.equal(await call(db,'select figure_image_review($1,$2,$3,null,$4) v',[request,plan.revision,approved,'schema_query']),'approved');
  await db.query("update public.figure_queue_jobs set state='done',attempts=1,image_status='awaiting_image' where request_id=$1",[request]);
  const item=query=>({...approved.items[0],query,proposedQuery:query,catalogRevision:'reviewed-query-v1'});
  const open=(n,query,who=actor,hash=sha(text),extra={})=>call(db,'select figure_continuation_open($1,$2,$3,$4,$5) v',[id(n),who,request,hash,{...item(query),...extra}]);
  const step=(n,query,who=actor)=>call(db,'select figure_continuation_step($1,$2,$3,$4,null) v',[id(n),who,'search',sha(query)]);
  const budget=await val(db,'select to_jsonb(b) v from ai_guard_budget b');
  await t.test('wrong actor, changed text, changed caption and original query fail closed',async()=>{
   assert.equal((await open(10,'inulin diagram',id(3))).status,'scope');assert.equal((await open(10,'inulin diagram',actor,'0'.repeat(64))).status,'scope');assert.equal((await open(10,'inulin diagram',actor,sha(text),{caption:'different'})).status,'stale_or_replay');assert.equal((await open(10,'inulin clearance')).status,'stale_or_replay');assert.equal(await val(db,'select count(*)::int v from figure_model_private.continuations'),0);
  });
  await t.test('a completed sitewide parent outside old actor and targets can open once',async()=>{assert.equal((await open(10,'inulin clearance diagram')).status,'created');assert.equal((await open(10,'inulin clearance diagram')).status,'existing');assert.equal(await val(db,'select count(*)::int v from figure_model_private.continuations'),1)});
  await t.test('only the original actor can dispatch, one count and no repeat for sent/unknown',async()=>{
   assert.equal((await step(10,'inulin clearance diagram',id(3))).status,'stale');const before=await val(db,'select searches v from figure_image_limits');assert.equal((await step(10,'inulin clearance diagram')).dispatch,true);assert.equal((await step(10,'inulin clearance diagram')).dispatch,false);assert.equal(await val(db,'select searches v from figure_image_limits'),before+1);await db.exec("update figure_model_private.image_steps set state='unknown'");assert.equal((await step(10,'inulin clearance diagram')).dispatch,false);assert.equal(await val(db,'select searches v from figure_image_limits'),before+1);
  });
  await t.test('at most two new continuation identities are allowed per parent',async()=>{assert.equal((await open(11,'inulin renal handling')).status,'created');assert.equal((await open(12,'inulin nephron figure')).status,'continuation_limit')});
  await t.test('prior search cache and unproven download never dispatch',async()=>{
   const before=await val(db,'select searches v from figure_image_limits');
   await db.query('insert into figure_image_cache(key,items) values($1,null)',[sha('["commons-cc-visual-v1","inulin renal handling"]')]);
   assert.equal((await step(11,'inulin renal handling')).status,'prior_search');assert.equal(await val(db,'select searches v from figure_image_limits'),before);
   const url='https://upload.wikimedia.org/new.png';const r=await call(db,'select figure_continuation_step($1,$2,$3,$4,$5) v',[id(11),actor,'download',sha(url),url]);assert.equal(r.status,'source');
  });
  await t.test('identical explanation under a newer revision or different saved metadata cannot continue',async()=>{
   const original=await val(db,'select to_jsonb(e) v from question_explanation_overrides e where question_id=$1',[question]);
   // Simulate a concurrent legitimate later replacement without invoking any model.
   await db.exec('alter table question_explanation_overrides disable trigger user');
   try{
    await db.query('update question_explanation_overrides set replacement_revision=$1 where question_id=$2',[id(99),question]);
    assert.equal((await open(12,'inulin nephron figure')).status,'stale_revision');
    assert.equal((await step(11,'inulin renal handling')).status,'stale_revision');
    await db.query('update question_explanation_overrides set replacement_revision=null,memory_tip=$1 where question_id=$2',['changed metadata',question]);
    assert.equal((await open(12,'inulin nephron figure')).status,'stale_revision');
    await db.query('update question_explanation_overrides set memory_tip=$1 where question_id=$2',[original.memory_tip,question]);
   }finally{await db.exec('alter table question_explanation_overrides enable trigger user')}
  });
  await t.test('search cap and paused capture prevent dispatch without counter reset',async()=>{
   await db.exec('update figure_image_limits set max_searches=searches');assert.equal((await step(11,'inulin renal handling')).status,'limit');await db.exec('update figure_queue_config set capture_new=false');assert.equal((await step(11,'inulin renal handling')).status,'paused');await db.exec('update figure_queue_config set capture_new=true');
  });
  await t.test('general users cannot call these service-only helpers and no new raw grants exist',async()=>{
   for(const r of ['anon','authenticated'])assert.equal(await val(db,"select has_function_privilege($1,'public.figure_continuation_open(uuid,uuid,uuid,text,jsonb)','EXECUTE') v",[r]),false);
   assert.equal(await val(db,"select has_table_privilege('app_writer','figure_model_private.batch','UPDATE') v"),false);
   assert.deepEqual(await val(db,'select to_jsonb(b) v from ai_guard_budget b'),budget);
  });
 }finally{await db.close()}
});
