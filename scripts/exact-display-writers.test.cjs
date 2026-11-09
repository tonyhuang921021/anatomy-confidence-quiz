const test=require('node:test'),assert=require('node:assert/strict');const{createHash}=require('node:crypto');
const{setup,role}=require('./helpers/write-boundary-fixture.cjs');
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`,actor=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=x=>createHash('sha256').update(x).digest('hex');const val=async(db,q,args)=>(await db.query(q,args)).rows[0]?.v;
const rpc=(db,q,args)=>role(db,'service_role',()=>val(db,q,args));
async function stage(db,n,{replace=false,question='SITEWIDE-'+n,needs=true}={}){
 const text='## 完整詳解\n精確圖文詳解 '+n+'\n\n## 觸類旁通\n延伸概念 '+n;
 const base=replace?await rpc(db,'select explanation_replacement_status($1,$2,null) v',[actor(n),question]):null;
 assert.equal(await rpc(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,$6,$7) v',[id(n),actor(n),question,'a'.repeat(64),'b'.repeat(40),base?.baseVersion??null,replace?'replace':'generate']),'reserved');
 assert.equal(await rpc(db,'select ai_guard_start_call($1,1) v',[id(n)]),'started');
 const section='## 觸類旁通\n延伸概念 '+n;
 const plan={explanationHash:sha(text),revision:'d'.repeat(64),items:[{sectionHash:sha(section),sectionTitle:'觸類旁通',caption:'延伸概念示意圖',sectionAnchor:'related-concepts'}]};
 const response={model:'gpt-6.1-terra',responseId:'fixture-'+n,rawText:'Mock provider response '+n,usage:{inputTokens:1394,outputTokens:638},value:{explanation:text,optionAnalysis:{A:'A 說明',B:'B 說明',C:'C 說明',D:'D 說明'},memoryTip:'記憶提醒'},needs:needs?plan:null};
 const staged=await rpc(db,'select '+(replace?'explanation_sitewide_result_stage':'explanation_generation_stage')+'($1,$2,$3,$4) v',[id(n),actor(n),['A','B','C','D'],response]);
 assert.equal(staged,'saved');return {text,question,plan,response,section};
}
async function image(db,n,saved){
 const needs={...saved.plan,status:'approved',reviewMethod:'schema_query',items:saved.plan.items.map(x=>({...x,searchScope:'general-medical',medicalDomain:'anatomy',query:'sternoclavicular joint anatomy',proposedQuery:'sternoclavicular joint anatomy',catalogRevision:'schema-query-v1'}))};
 assert.equal(await rpc(db,'select figure_image_review($1,$2,$3,null,$4) v',[id(n),needs.revision,needs,'schema_query']),'approved');
 assert.equal((await rpc(db,'select to_jsonb(x) v from figure_image_claim_fresh($1,600,$2,$3,$4) x',[id(900+n),id(n),saved.question,sha(saved.text)])).attempts,1);
 const bytes=Buffer.from('89504e470d0a1a0a010203','hex'),candidate=id(100+n),operation=id(200+n);
 await role(db,'service_role',()=>db.query(`insert into explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title,section_anchor,section_heading,section_sha256)
 values($1,$2,$3,$4,'image/png',$5,'https://commons.wikimedia.org/wiki/File:Fixture.png','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','Fixture author',$6,$7,$8,$9)`,[candidate,saved.question,sha(saved.text),sha(bytes),bytes,needs.items[0].caption,needs.items[0].sectionAnchor,needs.items[0].sectionTitle,needs.items[0].sectionHash]));
 const binding={requestId:id(n),questionId:saved.question,textHash:sha(saved.text),sectionHash:sha(saved.section),imageHash:sha(bytes),questionHash:'e'.repeat(64),sourceHash:'f'.repeat(64),policy:'luna-final-figure-v1'};
 const reservation=await rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[operation,candidate,sha('operation'+n),binding,'gpt-6-luna','fixture-image']);
 assert.equal(reservation.status,'reserved');assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[operation,reservation.sendToken]),true);
 return{binding,candidate,operation,reservation};
}
const commitImage=(db,o,verdict='match')=>rpc(db,'select figure_model_commit($1,$2,$3,$4,$5,100) v',[o.operation,o.binding,verdict,'fixture-review',sha('fixture-review')]);
const recover=(db,n,q,replace=false)=>rpc(db,'select '+(replace?'explanation_sitewide_result_recover':'explanation_generation_recover')+'($1,$2,$3) v',[id(n),actor(n),q]);
test('actual production definitions and non-superuser split roles',async t=>{
 const db=await setup();try{
  let first;
  await t.test('first generation: exact journal, one settled call, saved text and concept image job, then closed',async()=>{
   first=await stage(db,1);const out=await recover(db,1,first.question);assert.equal(out.status,'completed');
   assert.equal(await val(db,'select explanation v from question_explanation_overrides where question_id=$1',[first.question]),first.text);
   assert.equal(await val(db,'select state v from figure_queue_jobs where request_id=$1',[id(1)]),'pending');
   assert.equal(await val(db,'select captured v from figure_image_limits'),1);
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),958192);
   assert.equal(await val(db,'select reserved_microusd::int v from ai_guard_budget'),0);
  });
  await t.test('repeat recovery uses saved result; no new call, text write, cost or queue slot',async()=>{
   assert.equal((await recover(db,1,first.question)).status,'completed');
   assert.equal(await val(db,'select count(*)::int v from ai_guard_calls'),1);
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),1);
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),958192);
   assert.equal(await val(db,'select captured v from figure_image_limits'),1);
  });
  await t.test('wrong actor and question cannot recover or enqueue; anonymous cannot call helpers',async()=>{
   assert.equal((await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(1),actor(999),first.question])).status,'denied');
   assert.equal((await rpc(db,'select explanation_generation_recover($1,$2,$3) v',[id(1),actor(1),'OTHER'])).status,'denied');
   assert.equal(await rpc(db,'select explanation_enqueue_exact_saved($1,$2,$3) v',[id(1),actor(999),first.plan]),false);
   for(const r of ['anon','authenticated','service_role'])assert.equal(await val(db,"select has_function_privilege($1,'public.explanation_first_write_exact(uuid,uuid)','execute') v",[r]),false);
  });
  let firstImage;
  await t.test('image plan review, lease, model reserve and sent all work with actual service/guard split',async()=>{firstImage=await image(db,1,first)});
  await t.test('display write failure rolls back model settlement and budget; same sent operation remains',async()=>{
   await db.exec("create function fixture_fail_publish() returns trigger language plpgsql as $$begin raise exception 'fixture display failure';end$$;create trigger fixture_fail_publish before update on explanation_figure_candidates for each row execute function fixture_fail_publish();");
   const before=await val(db,'select to_jsonb(b) v from ai_guard_budget b');
   await assert.rejects(commitImage(db,firstImage),/fixture display failure/);
   assert.deepEqual(await val(db,'select to_jsonb(b) v from ai_guard_budget b'),before);
   assert.equal(await val(db,'select state v from figure_model_private.operations where operation_id=$1',[firstImage.operation]),'sent');
   await db.exec('drop trigger fixture_fail_publish on explanation_figure_candidates');
  });
  await t.test('exact model publication atomically approves candidate, finishes job, settles budget once',async()=>{
   assert.equal((await commitImage(db,firstImage)).status,'committed');
   assert.equal(await val(db,'select status v from explanation_figure_candidates where id=$1',[firstImage.candidate]),'approved');
   assert.equal(await val(db,'select state v from figure_queue_jobs where request_id=$1',[id(1)]),'done');
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),959192);
   assert.equal(await val(db,'select reserved_microusd::int v from ai_guard_budget'),0);
  });
  await t.test('committed repeat is idempotent and conflicting replay cannot republish',async()=>{
   const before=await val(db,'select to_jsonb(c) v from explanation_figure_candidates c where id=$1',[firstImage.candidate]);
   assert.equal((await commitImage(db,firstImage)).status,'committed');
   assert.equal((await commitImage(db,firstImage,'mismatch')).status,'conflict');
   assert.deepEqual(await val(db,'select to_jsonb(c) v from explanation_figure_candidates c where id=$1',[firstImage.candidate]),before);
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),959192);
  });
  let second;
  await t.test('replacement recovery archives prior exact result and enqueues new concept version',async()=>{
   second=await stage(db,2,{replace:true,question:first.question});
   assert.equal((await recover(db,2,second.question,true)).status,'completed');
   assert.equal(await val(db,'select explanation v from question_explanation_overrides where question_id=$1',[second.question]),second.text);
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
   assert.equal(await val(db,'select state v from figure_queue_jobs where request_id=$1',[id(2)]),'pending');
   assert.equal((await recover(db,2,second.question,true)).status,'completed');
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
  });
  await t.test('superseded first result cannot enqueue again or overwrite replacement',async()=>{
   assert.equal(await rpc(db,'select explanation_enqueue_exact_saved($1,$2,$3) v',[id(1),actor(1),first.plan]),false);
   assert.equal(await val(db,'select explanation v from question_explanation_overrides where question_id=$1',[first.question]),second.text);
  });
  let secondImage;
  await t.test('second image unknown stays held; exact saved response can settle without another dispatch',async()=>{
   secondImage=await image(db,2,second);
   await rpc(db,'select figure_model_unknown($1) v',[secondImage.operation]);
   const again=await rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[secondImage.operation,secondImage.candidate,sha('operation2'),secondImage.binding,'gpt-6-luna','fixture-image']);
   assert.equal(again.status,'unknown');assert.equal(again.dispatch,false);
   assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[secondImage.operation,secondImage.reservation.sendToken]),false);
   assert.equal((await commitImage(db,secondImage,'mismatch')).status,'committed');
   assert.equal(await val(db,'select status v from explanation_figure_candidates where id=$1',[secondImage.candidate]),'rejected');
   assert.equal(await val(db,'select image_bytes v from explanation_figure_candidates where id=$1',[secondImage.candidate]),null);
  });
  await t.test('third saved explanation keeps text but cannot exceed the original two-image cap',async()=>{
   const third=await stage(db,3);assert.equal((await recover(db,3,third.question)).status,'completed');
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),2);
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
  });
  await t.test('guard and display roles never gain direct raw-table mutation across boundary',async()=>{
   for(const tab of ['question_explanation_overrides','figure_image_limits','figure_queue_config','explanation_figure_candidates'])for(const op of ['INSERT','UPDATE','DELETE'])assert.equal(await val(db,'select has_table_privilege($1,$2,$3) v',['ai_guard_owner','public.'+tab,op]),false);
   for(const tab of ['public.ai_guard_budget','public.ai_guard_requests','public.ai_guard_calls','public.explanation_format_commits','figure_model_private.operations'])for(const op of ['INSERT','UPDATE','DELETE'])assert.equal(await val(db,'select has_table_privilege($1,$2,$3) v',['app_writer',tab,op]),false);
   assert.equal(await val(db,"select has_table_privilege('service_role','explanation_private.generation_results','SELECT') v"),false);
  });
 }finally{await db.close()}
});
module.exports={stage,recover,rpc,id,actor,sha,val};
test('interrupted queue writes are repairable without another provider call',async t=>{
 const db=await setup();try{
  const first=await stage(db,11);
  await db.exec("create function fixture_fail_queue() returns trigger language plpgsql as $$begin raise exception 'fixture queue failure';end$$;create trigger fixture_fail_queue before insert on figure_queue_jobs for each row execute function fixture_fail_queue();");
  await t.test('failed queue insertion preserves exact paid first text and closes without slot consumption',async()=>{
   assert.equal((await recover(db,11,first.question)).status,'completed');
   assert.equal(await val(db,'select count(*)::int v from figure_queue_jobs'),0);
   assert.equal(await val(db,'select captured v from figure_image_limits'),0);
   assert.equal(await val(db,'select state v from ai_guard_requests where id=$1',[id(11)]),'closed');
  });
  await db.exec('drop trigger fixture_fail_queue on figure_queue_jobs');
  await t.test('completed first recovery repairs missing queue from immutable journal only',async()=>{
   assert.equal((await recover(db,11,first.question)).status,'completed');
   assert.equal(await val(db,'select captured v from figure_image_limits'),1);
   assert.equal(await val(db,'select count(*)::int v from ai_guard_calls'),1);
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),958192);
  });
  const second=await stage(db,12,{replace:true,question:first.question});
  await db.exec('create trigger fixture_fail_queue before insert on figure_queue_jobs for each row execute function fixture_fail_queue()');
  await t.test('failed replacement queue retains new exact text and backup',async()=>{
   assert.equal((await recover(db,12,second.question,true)).status,'completed');
   assert.equal(await val(db,'select captured v from figure_image_limits'),1);
   assert.equal(await val(db,'select explanation v from question_explanation_overrides where question_id=$1',[second.question]),second.text);
   assert.equal(await val(db,'select committed_at is not null v from explanation_replacement_versions where request_id=$1',[id(12)]),true);
  });
  await db.exec('drop trigger fixture_fail_queue on figure_queue_jobs');
  await t.test('completed replacement recovery repairs exact new image plan once',async()=>{
   assert.equal((await recover(db,12,second.question,true)).status,'completed');
   assert.equal((await recover(db,12,second.question,true)).status,'completed');
   assert.equal(await val(db,'select captured v from figure_image_limits'),2);
   assert.equal(await val(db,'select count(*)::int v from ai_guard_calls'),2);
   assert.equal(await val(db,'select spent_microusd::int v from ai_guard_budget'),1014192);
  });
  await t.test('the exact first write helper rejects an old transaction witness',async()=>{
   await assert.rejects(role(db,'ai_guard_owner',()=>val(db,'select explanation_first_write_exact($1,$2) v',[id(11),actor(11)])),/exact first-generation witness required/);
  });
 }finally{await db.close()}
});
test('missing evidence and newer versions cannot produce duplicate work',async t=>{
 const db=await setup();try{
  await t.test('unrecorded response remains held and cannot start the same call twice',async()=>{
   assert.equal(await rpc(db,'select explanation_sitewide_reserve($1,$2,$3,$4,$5,null,$6) v',[id(21),actor(21),'MISSING','a'.repeat(64),'b'.repeat(40),'generate']),'reserved');
   assert.equal(await rpc(db,'select ai_guard_start_call($1,1) v',[id(21)]),'started');
   assert.equal((await recover(db,21,'MISSING')).status,'held_no_result');
   assert.equal(await rpc(db,'select ai_guard_start_call($1,1) v',[id(21)]),'blocked');
   assert.equal(await val(db,'select reserved_microusd::int v from ai_guard_budget'),56000);
   assert.equal(await val(db,'select count(*)::int v from question_explanation_overrides'),0);
  });
 }finally{await db.close()}
});
