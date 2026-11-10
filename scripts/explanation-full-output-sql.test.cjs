const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {setup,role}=require('./helpers/write-boundary-fixture.cjs');
const val=async(db,q,args)=>(await db.query(q,args)).rows[0]?.v;
const id=n=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`, actor=id(900);
const rpc=(db,q,args)=>role(db,'service_role',()=>val(db,q,args));
const reserve=(db,n,replace=false)=>rpc(db,'select explanation_reserve_full_output($1,$2,$3,$4,$5,$6,$7) v',[id(n),actor,'FULL-'+n,'a'.repeat(64),'b'.repeat(40),null,replace?'replace':'generate']);
async function install(db){
 // Bring only the synthetic fixture's old US$2 schema up to the already-installed production US$5 cap.
 for(const table of ['public.ai_guard_budget','explanation_private.sitewide_policy']){
  const rows=(await db.query("select conname,pg_get_constraintdef(oid) def from pg_constraint where conrelid=$1::regclass and contype='c'",[table])).rows;
  for(const row of rows)if(row.def.includes('2000000'))await db.exec(`alter table ${table} drop constraint ${row.conname};alter table ${table} add constraint ${row.conname} ${row.def.replaceAll('2000000','5000000')}`);
 }

 await db.exec("update ai_guard_budget set cap_microusd=5000000,spent_microusd=1000000,reserved_microusd=2064,pricing_revision='2026-11-02-terra-standard',cooldown_seconds=1;update explanation_private.sitewide_policy set cap_ceiling_microusd=5000000;");
 await db.exec("alter role app_writer rename to fixture_installer;alter schema public owner to fixture_installer;grant ai_guard_owner to fixture_installer with admin true, inherit false, set false;grant service_role to fixture_installer with inherit false,set true;");
 let sql=fs.readFileSync('proposals/cloud-explanation-full-output.sql','utf8').replaceAll('postgres','fixture_installer');
 for(const m of [...sql.matchAll(/md5\(pg_get_functiondef\('([^']+)'::regprocedure\)\)<>('[a-f0-9]{32}')/g)])sql=sql.replace(m[0],m[0].replace(m[2],"'"+await val(db,'select md5(pg_get_functiondef($1::regprocedure)) v',[m[1]])+"'"));
 await db.exec('set session authorization fixture_installer');await db.exec(sql);await db.exec('reset session authorization');return sql;
}
const payload=(text='完整詳解',output=4000)=>({model:'gpt-6.1-terra',responseId:'fixture-response',rawText:JSON.stringify({explanation:text}),usage:{inputTokens:1234,outputTokens:output},value:{explanation:text,optionAnalysis:{A:'A reason',B:'B reason'},memoryTip:''},needs:null});
test('full-output reservation, exact usage settlement, preservation and private boundaries',async t=>{
 const db=await setup();try{
  const sql=await install(db);
  await t.test('installation preserves old spent/reserved/global cap/legacy envelope and revokes temporary privilege',async()=>{
   assert.deepEqual(await val(db,"select jsonb_build_array(cap_microusd,spent_microusd,reserved_microusd,envelope_microusd) v from ai_guard_budget where id"),[5000000,1000000,2064,56000]);
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
   for(const who of ['anon','authenticated'])for(const f of ['explanation_reserve_full_output(uuid,uuid,text,text,text,text,text)','explanation_read_output_policy(uuid,uuid)'])assert.equal(await val(db,'select has_function_privilege($1,$2,\'execute\') v',[who,f]),false);
   assert.equal(await val(db,"select has_function_privilege('service_role','explanation_private.explanation_output_cost(uuid,bigint,bigint)','execute') v"),false);
  });
  await t.test('new request reserves 656000 atomically and reads only its actor-owned policy',async()=>{
   assert.equal(await reserve(db,1),'reserved');assert.equal(await val(db,'select reserved_microusd v from ai_guard_budget'),658064);
   const p=await rpc(db,'select explanation_read_output_policy($1,$2) v',[id(1),actor]);assert.equal(p.output_policy.maxOutputTokens,128000);assert.equal(p.per_call_ceiling_microusd,656000);
   assert.equal(await rpc(db,'select explanation_read_output_policy($1,$2) v',[id(1),id(999)]),null);
   assert.equal(await reserve(db,1),'duplicate');assert.equal(await val(db,'select reserved_microusd v from ai_guard_budget'),658064);
  });
  await t.test('unknown preserves full reservation, never enables another call',async()=>{
   assert.equal(await rpc(db,'select ai_guard_start_call($1,1) v',[id(1)]),'started');assert.equal(await rpc(db,'select ai_guard_start_call($1,1) v',[id(1)]),'blocked');
   assert.equal(await rpc(db,'select ai_guard_close($1) v',[id(1)]),'unresolved');assert.equal(await val(db,'select reserved_microusd v from ai_guard_budget'),658064);
  });
  await t.test('usage policy rejects bogus zero cost, overflow and missing usage before settlement',async()=>{
   for(const [cost,input,output] of [[0,1234,4000],[21234,1234,128001],[21234,16001,4000],[21234,null,4000]])assert.notEqual(await rpc(db,'select ai_guard_settle_call($1,1,$2,$3,$4) v',[id(1),cost,input,output]),'settled');
   assert.equal(await val(db,'select state v from ai_guard_calls where request_id=$1',[id(1)]),'started');
  });
  await t.test('new response over old 2400 bound saves and settles exact standard cost once',async()=>{
   const p=payload();assert.equal(await rpc(db,'select explanation_generation_stage($1,$2,$3,$4) v',[id(1),actor,['A','B'],p]),'saved');
   const r=await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(1),actor,'FULL-1']);assert.equal(r.status,'completed');assert.equal(r.value.explanation,p.value.explanation);
   assert.deepEqual(await val(db,'select jsonb_build_array(spent_microusd,reserved_microusd) v from ai_guard_budget'),[1021234,2064]);
   assert.equal((await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(1),actor,'FULL-1'])).status,'completed');
   assert.deepEqual(await val(db,'select jsonb_build_array(spent_microusd,reserved_microusd) v from ai_guard_budget'),[1021234,2064]);
  });
  await t.test('snapshot cannot be replaced with untrusted rates or a cheaper envelope',async()=>{
   await assert.rejects(db.query("update ai_guard_requests set output_policy=jsonb_set(output_policy,'{outputRate}','1') where id=$1",[id(1)]),/check/);
   await assert.rejects(db.query('update ai_guard_requests set envelope_microusd=56000 where id=$1',[id(1)]),/check/);
  });
  await t.test('remaining shared budget admits no request whose worst case would exceed cap',async()=>{
   await db.exec('update ai_guard_budget set spent_microusd=4350000');assert.equal(await reserve(db,2),'budget');assert.equal(await val(db,'select count(*)::int v from ai_guard_requests where id=$1',[id(2)]),0);
   await db.exec('update ai_guard_budget set spent_microusd=1021234');
  });
  await t.test('large saved response and exact first writer are no longer capped at 100000 characters',async()=>{
   await db.query("update ai_guard_requests set created_at=clock_timestamp()-interval '5 seconds'");assert.equal(await reserve(db,2),'reserved');await rpc(db,'select ai_guard_start_call($1,1) v',[id(2)]);
   const p=payload('甲'.repeat(110000),120000);assert.equal(await rpc(db,'select explanation_generation_stage($1,$2,$3,$4) v',[id(2),actor,['A','B'],p]),'saved');
   const r=await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(2),actor,'FULL-2']);assert.equal(r.status,'completed');assert.equal(r.value.explanation.length,110000);
  });
  await t.test('legacy requests retain old ceiling policy and do not receive backfilled snapshots',async()=>{
   await db.query("update ai_guard_requests set created_at=clock_timestamp()-interval '5 seconds'");
   assert.equal(await rpc(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,null,\'generate\') v',[id(3),actor,'LEGACY','a'.repeat(64),'b'.repeat(40)]),'reserved');
   assert.equal(await rpc(db,'select explanation_read_output_policy($1,$2) v',[id(3),actor]),null);await rpc(db,'select ai_guard_start_call($1,1) v',[id(3)]);
   assert.equal(await rpc(db,'select explanation_generation_stage($1,$2,$3,$4) v',[id(3),actor,['A','B'],payload('legacy',2000)]),'saved');
   const before=await val(db,'select spent_microusd v from ai_guard_budget');assert.equal((await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(3),actor,'LEGACY'])).status,'completed');assert.equal(await val(db,'select spent_microusd v from ai_guard_budget'),before+56000);
  });
  await t.test('replacement full-output saves long text and retains original snapshot',async()=>{
   await db.query("update ai_guard_requests set created_at=clock_timestamp()-interval '5 seconds'");
   const base=await rpc(db,"select explanation_replacement_status($1,'FULL-1',null) v",[actor]);
   assert.equal(await rpc(db,'select explanation_reserve_full_output($1,$2,$3,$4,$5,$6,\'replace\') v',[id(4),actor,'FULL-1','a'.repeat(64),'b'.repeat(40),base.baseVersion]),'reserved');
   await rpc(db,'select ai_guard_start_call($1,1) v',[id(4)]);const p=payload('新'.repeat(110000),120000);
   assert.equal(await rpc(db,'select explanation_sitewide_result_stage($1,$2,$3,$4) v',[id(4),actor,['A','B'],p]),'saved');
   const result=await rpc(db,'select explanation_sitewide_result_recover($1,$2,$3) v',[id(4),actor,'FULL-1']);assert.equal(result.status,'completed');assert.equal(result.value.explanation.length,110000);
   assert.ok(await val(db,'select before_snapshot is not null v from explanation_replacement_versions where request_id=$1',[id(4)]));
  });
  await t.test('incomplete or invalid usage evidence remains held and immutable',async()=>{
   await db.query("update ai_guard_requests set created_at=clock_timestamp()-interval '5 seconds'");assert.equal(await reserve(db,5),'reserved');await rpc(db,'select ai_guard_start_call($1,1) v',[id(5)]);
   const p={...payload(),usage:null};assert.equal(await rpc(db,'select explanation_generation_stage($1,$2,$3,$4) v',[id(5),actor,['A','B'],p]),'saved');
   assert.equal((await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(5),actor,'FULL-5'])).status,'held_usage_unknown');
   assert.equal(await rpc(db,'select explanation_generation_stage($1,$2,$3,$4) v',[id(5),actor,['A','B'],payload()]),'conflict');
   assert.equal(await val(db,'select reserved_microusd v from ai_guard_budget'),658064);
  });
  await t.test('installation cannot replay',async()=>{await db.exec('set session authorization fixture_installer');await assert.rejects(db.exec(sql),/output policy already installed/);await db.exec('rollback;reset session authorization');});
 }finally{await db.close()}
});
