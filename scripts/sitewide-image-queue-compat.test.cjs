const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {setup}=require('./helpers/generation-journal-fixture.cjs');
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=x=>createHash('sha256').update(x).digest('hex');
const val=async(db,q,a)=>(await db.query(q,a)).rows[0]?.v;
test('captured production image queue constraint and bounded sitewide compatibility',async t=>{
 const db=await setup();try{
  await db.exec(fs.readFileSync('scripts/fixtures/sitewide-db-shape.sql','utf8'));
  await db.exec(fs.readFileSync('scripts/fixtures/sitewide-write-contract.sql','utf8'));
  await db.exec(fs.readFileSync('proposals/cloud-sitewide-admission.sql','utf8'));
  await db.exec("alter table ai_guard_requests add column action_kind text default 'explanation'; update figure_image_limits set max_new=2;");
  await db.exec(fs.readFileSync('scripts/fixtures/legacy-image-queue.sql','utf8'));
  const seed=async(n,action='generate')=>{
   const q='FULLSITE-'+n,text='## 完整詳解\nExact medical explanation '+n;
   await db.query('insert into ai_guard_requests(id,actor_id,question_id) values($1,$2,$3)',[id(n),actor,q]);
   await db.query('insert into explanation_private.sitewide_requests(request_id,actor_id,question_id,action) values($1,$2,$3,$4)',[id(n),actor,q,action]);
   const response=JSON.stringify({model:'gpt-6.1-terra',value:{explanation:text}});
   await db.query("insert into explanation_private.generation_results(request_id,actor_id,required_options,response,response_sha) values($1,$2,array['A'],$3::jsonb,encode(sha256(convert_to(($3::jsonb)::text,'UTF8')),'hex'))",[id(n),actor,response]);
   await db.query("insert into ai_guard_calls(request_id,seq,state) values($1,1,'settled')",[id(n)]);
   return {q,text};
  };
  const commit=async(n,{q,text})=>val(db,'select status v from figure_guard_commit_new_images($1,$2,$3,$4,$5,$6)',[id(n),actor,text,{A:'reason'},'',{explanationHash:sha(text),revision:'a'.repeat(64),items:[{sectionTitle:'完整詳解'}]}]);
  const first=await seed(1);
  await t.test('actual legacy constraint silently blocks a paid first-generation image plan',async()=>{
   assert.equal(await commit(1,first),'inserted');
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),0);
   assert.equal(await val(db,'select captured v from figure_image_limits'),0);
   assert.equal(await val(db,'select figure_status v from question_explanation_overrides where question_id=$1',[first.q]),'awaiting_image');
  });
  await db.exec(fs.readFileSync('proposals/cloud-sitewide-image-queue-compat.sql','utf8'));
  const second=await seed(2);
  await t.test('fresh exact settled first generation can enqueue and increments the original cap once',async()=>{
   assert.equal(await commit(2,second),'inserted');
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),1);
   assert.equal(await val(db,'select captured v from figure_image_limits'),1);
   assert.equal(await val(db,'select explanation_private.sitewide_image_binding($1,$2,$3) v',[id(2),second.q,sha(second.text)]),true);
  });
  await t.test('different request, question, text, uncommitted or unknown-call evidence is denied',async()=>{
   for(const args of [[id(88),second.q,sha(second.text)],[id(2),'OTHER',sha(second.text)],[id(2),second.q,'b'.repeat(64)],[id(2),second.q,null]])assert.equal(await val(db,'select explanation_private.sitewide_image_binding($1,$2,$3) v',args),false);
   await db.query('update ai_guard_requests set result_committed=false where id=$1',[id(2)]);
   assert.equal(await val(db,'select explanation_private.sitewide_image_binding($1,$2,$3) v',[id(2),second.q,sha(second.text)]),false);
   await db.query('update ai_guard_requests set result_committed=true where id=$1',[id(2)]);
   await db.query("update ai_guard_calls set state='unknown' where request_id=$1",[id(2)]);
   assert.equal(await val(db,'select explanation_private.sitewide_image_binding($1,$2,$3) v',[id(2),second.q,sha(second.text)]),false);
   await db.query("update ai_guard_calls set state='settled' where request_id=$1",[id(2)]);
  });
  const third=await seed(3,'replace');
  await t.test('replacement identity with immutable paid evidence can use the second image job only',async()=>{
   assert.equal(await commit(3,third),'inserted');
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
   const fourth=await seed(4);await commit(4,fourth);
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),2);
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
   assert.equal(await val(db,'select count(*)::int v from question_explanation_overrides'),4);
  });
  await t.test('old jobs retain immutable binding after newer text or admission pause',async()=>{
   await db.exec('update explanation_private.sitewide_policy set enabled=false');
   await db.query("update question_explanation_overrides set explanation='newer version' where question_id=$1",[second.q]);
   await db.query("update figure_queue_jobs set state='failed' where request_id=$1",[id(2)]);
   assert.equal(await val(db,'select state v from figure_queue_jobs where request_id=$1',[id(2)]),'failed');
   assert.equal(await val(db,'select explanation_sha256 v from figure_queue_jobs where request_id=$1',[id(2)]),sha(second.text));
  });
  await t.test('unadmitted image jobs cannot use full-site exception, existing completed history stays valid',async()=>{
   await assert.rejects(db.query("insert into figure_queue_jobs(request_id,question_id,explanation_sha256,state) values($1,'NO-ADMISSION',$2,'pending')",[id(89),'a'.repeat(64)]),/figure_single_q020_batch/);
   await db.query("insert into figure_queue_jobs(request_id,question_id,explanation_sha256,state) values($1,'OLD-HISTORY',$2,'done')",[id(90),'a'.repeat(64)]);
  });
  await t.test('predicate is service-only and does not grant direct access to private evidence',async()=>{
   for(const role of ['anon','authenticated'])assert.equal(await val(db,"select has_function_privilege($1,'explanation_private.sitewide_image_binding(uuid,text,text)','EXECUTE') v",[role]),false);
   assert.equal(await val(db,"select has_function_privilege('service_role','explanation_private.sitewide_image_binding(uuid,text,text)','EXECUTE') v"),true);
   assert.equal(await val(db,"select has_table_privilege('service_role','explanation_private.generation_results','SELECT') v"),false);
  });
 }finally{await db.close()}
});
