const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {setup,role}=require('./helpers/write-boundary-fixture.cjs');
const {buildNeeds,approveSchemaQueries}=require('../lib/newExplanationFigures.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex'),id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const val=async(db,q,p)=>(await db.query(q,p)).rows[0]?.v;
// Fixture admin observation only, not an application grant.
const inspect=async(db,q,p)=>{await db.exec('reset session authorization');try{return await val(db,q,p)}finally{await db.exec('set session authorization fixture_installer')}};
const call=(db,q,p)=>role(db,'service_role',()=>val(db,q,p));
test('Taiwan daily image search reservation preserves history, unknowns, independent caps and private access',async t=>{
 const db=await setup();try{
  await db.exec(`create table figure_model_private.continuations(id uuid primary key,parent_request uuid not null,actor_id uuid not null,question_id text not null,text_sha text not null,query text not null,item jsonb not null,created_at timestamptz not null default clock_timestamp());
  create table public.figure_image_cache(key text primary key,items jsonb,owner_request uuid,owner_lease uuid,expires_at timestamptz);alter table public.figure_image_cache owner to app_writer;
  grant select,insert,update on figure_image_cache to service_role;
  create table figure_model_private.image_steps(continuation_id uuid not null,kind text not null,key text not null,state text not null default 'sent',payload jsonb,image_bytes bytea,image_mime text,created_at timestamptz not null default clock_timestamp(),primary key(kind,key));
  alter table figure_model_private.continuations owner to app_writer;alter table figure_model_private.image_steps owner to app_writer;
  create function public.figure_continuation_batch_lock(p_actor uuid) returns boolean language plpgsql security definer set search_path=pg_catalog,figure_model_private as $$begin perform 1 from figure_model_private.batch where id and enabled and actor_id=p_actor for update;return found;end$$;
  alter function public.figure_continuation_batch_lock(uuid) owner to ai_guard_owner;revoke all on function public.figure_continuation_batch_lock(uuid) from public;grant execute on function public.figure_continuation_batch_lock(uuid) to app_writer;
  create function public.figure_image_active(uuid,uuid) returns boolean language sql as $$select coalesce(current_setting('fixture.active',true),'true')::boolean$$;
  create function public.fixture_clock() returns timestamptz language sql as $$select current_setting('fixture.now')::timestamptz$$;
  select set_config('fixture.now','2026-11-10T15:59:59Z',false);
  `);
  const functions=JSON.parse(fs.readFileSync('scripts/fixtures/daily-search-baseline-functions.json'));
  for(const f of functions)await db.exec(f.definition+`;alter function public.${f.signature} owner to app_writer;revoke all on function public.${f.signature} from public,anon,authenticated;grant execute on function public.${f.signature} to service_role;`);
  const actor=id(2),request=id(1),question='DAILY-SEARCH-FIXTURE',text='## 生理意義\n菊糖可自由濾過，不被再吸收或分泌。';
  const plan=buildNeeds(text,[{sectionTitle:'生理意義',conceptId:'inulin-clearance',caption:'菊糖清除率',searchTerm:'inulin clearance',searchScope:'general-medical',medicalDomain:'physiology'}]);
  assert.equal(await call(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,null,$6) v',[request,actor,question,'a'.repeat(64),'b'.repeat(40),'generate']),'reserved');
  assert.equal(await call(db,'select ai_guard_start_call($1,1) v',[request]),'started');
  const response={model:'gpt-6.1-terra',responseId:'fixture-daily-search',rawText:'Mock result',usage:{inputTokens:500,outputTokens:500},value:{explanation:text,optionAnalysis:{A:'正確',B:'錯誤'},memoryTip:'菊糖清除率'},needs:plan};
  assert.equal(await call(db,'select explanation_generation_stage($1,$2,$3,$4) v',[request,actor,['A','B'],response]),'saved');
  assert.equal((await call(db,'select explanation_generation_recover($1,$2,$3) v',[request,actor,question])).status,'completed');
  const approved=approveSchemaQueries(plan);
  assert.equal(await call(db,'select figure_image_review($1,$2,$3,null,$4) v',[request,plan.revision,approved,'schema_query']),'approved');
  await db.query("update public.figure_queue_jobs set state='done',attempts=1,image_status='awaiting_budget' where request_id=$1",[request]);
  await db.exec('update figure_image_limits set searches=100,downloads=1,download_bytes=3145728;');
  // Preserve an actual old unknown reservation; migration must not clear it.
  const oldKey=sha('old unknown');await db.query('insert into figure_image_cache(key,items,expires_at) values($1,null,clock_timestamp()+interval \'1 year\')',[oldKey]);
  await db.exec("alter role app_writer rename to fixture_installer;alter schema public owner to fixture_installer;grant ai_guard_owner to fixture_installer with admin true,inherit false,set false;grant service_role to fixture_installer with inherit false,set true;set session authorization fixture_installer;");
  let source=fs.readFileSync('proposals/cloud-daily-image-search.sql','utf8').replaceAll('postgres','fixture_installer').replaceAll('clock_timestamp()','public.fixture_clock()');
  const members=await val(db,"select jsonb_agg(to_jsonb(m) order by grantor) v from pg_auth_members m where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole");
  const before=await val(db,'select to_jsonb(l) v from figure_image_limits l'),budget=await val(db,'select to_jsonb(l) v from ai_guard_budget l');
  await t.test('installation rollback restores functions, quota and all temporary rights',async()=>{
   await assert.rejects(db.exec(source.replace('RESET ROLE;',"DO $fail$ BEGIN RAISE EXCEPTION 'injected install';END $fail$;RESET ROLE;")),/injected install/);await db.exec('rollback');
   assert.equal(await val(db,"select to_regclass('figure_model_private.search_days') v"),null);assert.deepEqual(await val(db,'select to_jsonb(l) v from figure_image_limits l'),before);
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
  });
  await db.exec(source);
  await db.exec(fs.readFileSync('proposals/cloud-daily-image-search-notification.sql','utf8').replaceAll('postgres','fixture_installer'));
  const capacity=()=>call(db,'select figure_search_capacity() v');
  const fresh=(n,key=sha('fresh '+n))=>call(db,'select figure_image_reserve($1,$2,$3,$4) v',[request,id(1000),key,'search']);
  const continuation=async(n)=>{
   const query='inulin figure '+String.fromCharCode(97+n%26)+String.fromCharCode(97+Math.floor(n/26));
   await db.query('insert into figure_model_private.continuations values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())',[id(100+n),request,actor,question,sha(text),query,approved.items[0]]);
   return {id:id(100+n),query,run:()=>call(db,'select figure_continuation_step($1,$2,$3,$4,null) v',[id(100+n),actor,'search',sha(query)])};
  };
  await t.test('cutover uses disclosed conservative legacy count, not a reset or invented exact daily count',async()=>{
   const c=await capacity();assert.equal(c.searchUsed,100);assert.equal(c.searchLimit,200);assert.equal(c.carriedSearches,100);assert.equal(c.carryBasis,'legacy_cumulative_upper_bound');assert.equal(c.day,'2026-11-10');
   assert.deepEqual(await val(db,'select to_jsonb(l) v from figure_image_limits l'),{...before,max_searches:200});assert.deepEqual(await val(db,'select to_jsonb(l) v from ai_guard_budget l'),budget);
   assert.equal(await val(db,'select items v from figure_image_cache where key=$1',[oldKey]),null);
  });
  await t.test('wrong lease/key and unknown cache never dispatch or consume a day reservation',async()=>{
   await db.exec("select set_config('fixture.active','false',false)");assert.equal(await fresh(1),false);await db.exec("select set_config('fixture.active','true',false)");
   assert.equal(await fresh(1,'invalid'),false);assert.equal(await fresh(1,oldKey),false);assert.equal((await capacity()).searchUsed,100);
  });
  await t.test('ordinary and continuation entry points share the same atomic day counter and cumulative count',async()=>{
   assert.equal(await fresh(1),true);const c=await continuation(1);assert.equal((await c.run()).dispatch,true);assert.notEqual((await c.run()).dispatch,true);
   assert.equal((await capacity()).searchUsed,102);assert.equal(await val(db,'select searches v from figure_image_limits'),102);
   await db.query("update figure_model_private.image_steps set state='unknown' where continuation_id=$1",[c.id]);assert.notEqual((await c.run()).dispatch,true);assert.equal((await capacity()).searchUsed,102);
  });
  await t.test('downstream insertion failure rolls back both day and lifetime reservations',async()=>{
   await db.exec('reset session authorization;create function fixture_fail_cache() returns trigger language plpgsql as $$begin raise exception \'cache injection\';end$$;create trigger fixture_fail before insert on figure_image_cache for each row execute function fixture_fail_cache();set session authorization fixture_installer;');
   await assert.rejects(fresh(2),/cache injection/);assert.equal((await capacity()).searchUsed,102);assert.equal(await val(db,'select searches v from figure_image_limits'),102);
   await db.exec('reset session authorization;drop trigger fixture_fail on figure_image_cache;drop function fixture_fail_cache();set session authorization fixture_installer;');
  });
  await t.test('200th request creates one durable alert and all further requests stop atomically',async()=>{
   for(let n=2;n<100;n++)assert.equal(await fresh(n),true);
   assert.equal((await capacity()).searchUsed,200);assert.equal((await capacity()).searchAvailable,false);
   const event=await inspect(db,"select to_jsonb(d) v from figure_model_private.search_days d where day='2026-11-10'");assert.ok(event.reached_at);assert.equal(event.notification_accepted_at,null);
   for(let n=100;n<110;n++)assert.equal(await fresh(n),false);
   const c=await continuation(2);assert.equal((await c.run()).status,'daily_search_limit');assert.equal(await val(db,'select count(*)::int v from figure_model_private.image_steps where continuation_id=$1',[c.id]),0);
   assert.deepEqual(await inspect(db,"select to_jsonb(d) v from figure_model_private.search_days d where day='2026-11-10'"),event);
   assert.equal(await val(db,'select searches v from figure_image_limits'),200);
  });
  await t.test('Taiwan midnight opens a new row, preserves prior alert and never replays old unknown',async()=>{
   await db.exec("select set_config('fixture.now','2026-11-10T16:00:00Z',false)");assert.equal((await capacity()).day,'2026-11-11');assert.equal((await capacity()).searchUsed,0);assert.equal((await capacity()).searchAvailable,true);
   assert.equal(await fresh(110,oldKey),false);assert.equal(await fresh(110),true);assert.equal((await capacity()).searchUsed,1);assert.equal(await val(db,'select searches v from figure_image_limits'),201);
   assert.equal(await inspect(db,"select searches v from figure_model_private.search_days where day='2026-11-10'"),200);assert.equal(await inspect(db,'select count(*)::int v from figure_model_private.search_days'),2);
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs where state=\'done\''),1);
  });
  await t.test('notification RPC claims older days once, reconciles stable IDs and never replays uncertain sends',async()=>{
   const notify=(action,day=null,claim=id(888),message=null)=>val(db,'select figure_search_notification($1,$2,$3,$4) v',[action,day,claim,message]);
   const got=await notify('claim'),row=got.notice;assert.equal(got.status,'claimed');assert.equal(row.day,'2026-11-10');assert.equal(row.notification_claim_id,id(888));
   assert.equal((await notify('claim')).status,'existing');assert.equal((await notify('claim',null,id(889))).status,'idle');
   assert.equal((await notify('ack',row.day,id(888),'too-early')).status,'invalid');
   assert.equal((await notify('start',row.day)).status,'started');assert.equal((await notify('start',row.day)).status,'held');
   assert.equal((await notify('claim',null,id(889))).status,'idle'); // Unknown send is never reclaimed.
   assert.equal((await notify('ack',row.day,id(889),'wrong-claim')).status,'missing');
   assert.equal((await notify('ack',row.day,id(888),'accepted-fixture')).status,'accepted');
   assert.equal((await notify('ack',row.day,id(888),'accepted-fixture')).status,'accepted');
   assert.equal((await notify('ack',row.day,id(888),'different-message')).status,'conflict');
   assert.equal((await notify('start',row.day)).status,'held');
   for(const who of ['anon','authenticated','service_role'])assert.equal(await val(db,"select has_function_privilege($1,'public.figure_search_notification(text,date,uuid,text)','EXECUTE') v",[who]),false);
  });
  await t.test('download limits and budget stay independent; no user or service access to private ledger',async()=>{
   assert.deepEqual(await val(db,'select to_jsonb(l) v from ai_guard_budget l'),budget);
   assert.equal((await capacity()).downloadUsed,1);assert.equal((await capacity()).downloadBytesReserved,3145728);
   for(const who of ['anon','authenticated','service_role'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(await val(db,"select has_table_privilege($1,'figure_model_private.search_days',$2) v",[who,permission]),false);
   for(const who of ['anon','authenticated'])for(const fn of ['figure_search_reserve_day()','figure_search_capacity()'])assert.equal(await val(db,"select has_function_privilege($1,$2,'EXECUTE') v",[who,'public.'+fn]),false);
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
   assert.deepEqual(await val(db,"select jsonb_agg(to_jsonb(m) order by grantor) v from pg_auth_members m where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole"),members);
  });
 }finally{await db.close()}
});
