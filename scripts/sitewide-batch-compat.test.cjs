const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup}=require('./helpers/generation-journal-fixture.cjs');
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const value=async(db,sql,args)=>(await db.query(sql,args)).rows[0]?.v;
const reserve=(db,n,q='SITEWIDE-'+n,action='generate')=>value(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,null,$6) v',[id(n),actor,q,'manifest','source',action]);
test('production legacy text trigger and deferred identity compatibility',async t=>{
 const db=await setup();try{
  await db.exec(fs.readFileSync('scripts/fixtures/sitewide-db-shape.sql','utf8'));
  await db.exec(fs.readFileSync('scripts/fixtures/sitewide-write-contract.sql','utf8'));
  await db.exec(fs.readFileSync('proposals/cloud-sitewide-admission.sql','utf8'));
  await db.exec(`alter table ai_guard_requests add column action_kind text default 'explanation';
   alter table figure_model_private.batch add column actor_id uuid,add column text_requests int default 0;
   alter table figure_model_private.text_reservations add column question_id text,add column envelope bigint,add column created_at timestamptz;
   insert into figure_model_private.batch(id,enabled,actor_id,funding_mode,cash_authorized,funding_evidence_sha,no_cash,charged,cap,targets)
   values(true,false,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cash_authorized',true,repeat('a',64),false,0,168000,array['PILOT']);
   update explanation_private.sitewide_policy set enabled=true,funding_evidence_sha=repeat('a',64);`);
  await db.exec(fs.readFileSync('scripts/fixtures/legacy-text-batch-trigger.sql','utf8'));
  await db.exec('create trigger figure_text_batch_guard before insert on ai_guard_requests for each row execute function figure_model_private.text_batch_guard()');
  await t.test('captured production trigger reproduces the pre-fix failure',async()=>{
   await assert.rejects(reserve(db,1),/bounded_text_batch_paused/);
   assert.equal(await value(db,'select count(*)::int v from ai_guard_requests'),0);
  });
  await db.exec(fs.readFileSync('proposals/cloud-sitewide-batch-compat.sql','utf8'));
  await t.test('exact sitewide admission works when legacy pilot is paused without touching its ledger',async()=>{
   await db.exec('set role service_role');try{assert.equal(await reserve(db,1),'reserved')}finally{await db.exec('reset role')}
   assert.equal(await value(db,'select reserved_microusd v from ai_guard_budget'),56000);
   assert.equal(await value(db,'select count(*)::int v from figure_model_private.text_reservations'),0);
   assert.equal(await value(db,'select charged::int v from figure_model_private.batch'),0);
   assert.equal(await value(db,'select count(*)::int v from ai_guard_calls'),0);
  });
  await t.test('duplicates, question busy and invalid actions create no extra identity',async()=>{
   assert.equal(await reserve(db,1),'duplicate');assert.equal(await reserve(db,2,'SITEWIDE-1'),'question_busy');
   assert.equal(await reserve(db,3,'NEW','custom_search'),'unavailable');
   assert.equal(await value(db,'select count(*)::int v from explanation_private.sitewide_requests'),1);
  });
  await t.test('new admitted request still starts exactly once',async()=>{
   assert.equal(await value(db,'select ai_guard_start_call($1,1) v',[id(1)]),'started');
   assert.equal(await value(db,'select ai_guard_start_call($1,1) v',[id(1)]),'blocked');
   await db.query("update ai_guard_requests set state='closed' where id=$1",[id(1)]);
   await db.exec('update ai_guard_budget set reserved_microusd=0');
  });
  await t.test('unmatched actor, question, action kind and call count cannot use the trigger exemption',async()=>{
   for(const [n,column,replacement] of [[10,'actor_id',"'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"],[11,'question_id',"'OTHER'"],[12,'action_kind',"'custom_search'"],[13,'call_limit','2']]){
    await db.exec('begin');try{
     await db.query("insert into explanation_private.sitewide_requests(request_id,actor_id,question_id,action) values($1,$2,'EXACT','generate')",[id(n),actor]);
     const cols={id:`'${id(n)}'`,actor_id:`'${actor}'`,question_id:"'EXACT'",action_kind:"'explanation'",call_limit:'1'};cols[column]=replacement;
     await assert.rejects(db.exec(`insert into ai_guard_requests(${Object.keys(cols).join(',')}) values(${Object.values(cols).join(',')})`),/bounded_text_batch_paused/);
    }finally{await db.exec('rollback')}
   }
  });
  await t.test('orphan identity cannot commit and browser/service roles cannot write the identity table',async()=>{
   await db.exec('begin');await db.query("insert into explanation_private.sitewide_requests values($1,$2,'ORPHAN','generate',clock_timestamp())",[id(20),actor]);
   await assert.rejects(db.exec('commit'),/foreign key/);await db.exec('rollback');
   for(const role of ['anon','authenticated','service_role'])assert.equal(await value(db,"select has_table_privilege($1,'explanation_private.sitewide_requests','INSERT') v",[role]),false);
  });
  await t.test('failure after both identities are inserted rolls back every request and budget change',async()=>{
   await db.exec("create function fail_acceptance_budget() returns trigger language plpgsql as $$ begin raise exception 'injected budget failure';end $$;create trigger fail_acceptance_budget before update on ai_guard_budget for each row execute function fail_acceptance_budget()");
   await assert.rejects(reserve(db,21),/injected budget failure/);
   assert.equal(await value(db,'select count(*)::int v from explanation_private.sitewide_requests where request_id=$1',[id(21)]),0);
   assert.equal(await value(db,'select count(*)::int v from ai_guard_requests where id=$1',[id(21)]),0);
   await db.exec('drop trigger fail_acceptance_budget on ai_guard_budget');
  });
  await t.test('existing legacy pilot retains its own original funding and scope rules',async()=>{
   await db.exec('update figure_model_private.batch set enabled=true');
   await assert.rejects(db.query("insert into ai_guard_requests(id,actor_id,question_id,envelope_microusd) values($1,$2,'PILOT',56000)",[id(22),actor]),/bounded_text_batch_denied/);
   await db.query("insert into ai_guard_requests(id,actor_id,question_id,envelope_microusd) values($1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PILOT',56000)",[id(23)]);
   assert.equal(await value(db,'select count(*)::int v from figure_model_private.text_reservations'),1);
   assert.equal(await value(db,'select charged::int v from figure_model_private.batch'),56000);
  });
 }finally{await db.close()}
});
