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
async function image(db,n,saved,source='https://commons.wikimedia.org/wiki/File:Fixture.png',{send=true,reserve=true}={}){
 const needs={...saved.plan,status:'approved',reviewMethod:'schema_query',items:saved.plan.items.map(x=>({...x,searchScope:'general-medical',medicalDomain:'anatomy',query:'sternoclavicular joint anatomy',proposedQuery:'sternoclavicular joint anatomy',catalogRevision:'schema-query-v1'}))};
 assert.equal(await rpc(db,'select figure_image_review($1,$2,$3,null,$4) v',[id(n),needs.revision,needs,'schema_query']),'approved');
 assert.equal((await rpc(db,'select to_jsonb(x) v from figure_image_claim_fresh($1,600,$2,$3,$4) x',[id(900+n),id(n),saved.question,sha(saved.text)])).attempts,1);
 const bytes=Buffer.from('89504e470d0a1a0a010203','hex'),candidate=id(100+n),operation=id(200+n);
 await role(db,'service_role',()=>db.query(`insert into explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title,section_anchor,section_heading,section_sha256)
 values($1,$2,$3,$4,'image/png',$5,$10,'https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','Fixture author',$6,$7,$8,$9)`,[candidate,saved.question,sha(saved.text),sha(bytes),bytes,needs.items[0].caption,needs.items[0].sectionAnchor,needs.items[0].sectionTitle,needs.items[0].sectionHash,source]));
 const binding={requestId:id(n),questionId:saved.question,textHash:sha(saved.text),sectionHash:sha(saved.section),imageHash:sha(bytes),questionHash:'e'.repeat(64),sourceHash:'f'.repeat(64),policy:'luna-final-figure-v1'};
 if(!reserve)return {binding,candidate,operation};
 const reservation=await rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[operation,candidate,sha('operation'+n),binding,'gpt-6-luna','fixture-image']);
 assert.equal(reservation.status,'reserved');if(send)assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[operation,reservation.sendToken]),true);
 return{binding,candidate,operation,reservation};
}
const commitImage=(db,o,verdict='match')=>rpc(db,'select figure_model_commit($1,$2,$3,$4,$5,100) v',[o.operation,o.binding,verdict,'fixture-review',sha('fixture-review')]);
const recover=(db,n,q,replace=false)=>rpc(db,'select '+(replace?'explanation_sitewide_result_recover':'explanation_generation_recover')+'($1,$2,$3) v',[id(n),actor(n),q]);

const fs=require('node:fs');
const signature='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)';
const reserve=(db,o,n=2)=>rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[o.operation,o.candidate,sha('operation'+n),o.binding,'gpt-6-luna','fixture-image']);
const read=(db,o)=>rpc(db,'select figure_model_read_response($1) v',[o.operation]);
const store=(db,o,bytes,status=200,binding=o.binding,digest=sha(bytes),decoder='figure-response-v1')=>rpc(db,'select figure_model_store_response($1,$2,$3,$4,$5,$6) v',[o.operation,binding,bytes,status,digest,decoder]);
const body=Buffer.from('{"fixture":"完整原始回應"}');
test('response journal is atomic, immutable, private, and cannot revive old unknown requests',async t=>{
 const db=await setup();try{
  // Old unknown is reserved before the new journal exists.
  const first=await stage(db,1);await recover(db,1,first.question);const old=await image(db,1,first);await rpc(db,'select figure_model_unknown($1) v',[old.operation]);
  await db.exec("alter role app_writer rename to fixture_installer;alter schema public owner to fixture_installer;grant ai_guard_owner to fixture_installer with admin true, inherit false, set false;grant service_role to fixture_installer with inherit false, set true;set session authorization fixture_installer;");
  const definition=await val(db,'select pg_get_functiondef($1::regprocedure) v',[signature]);
  const baseline=await val(db,'select md5(pg_get_functiondef($1::regprocedure)) v',[signature]);
  const source=fs.readFileSync('proposals/cloud-figure-response-journal.sql','utf8').replaceAll('postgres','fixture_installer').replace('fbef5447cc4dd2cc612af1d66461eb20',baseline);
  const acl=await val(db,'select proacl::text v from pg_proc where oid=$1::regprocedure',[signature]);
  const membership=()=>val(db,"select jsonb_agg(to_jsonb(m) order by grantor) v from pg_auth_members m where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole");
  const members=await membership();const originalBudget=await val(db,'select to_jsonb(x) v from ai_guard_budget x');
  await t.test('installation failure rolls back functions, table and temporary rights',async()=>{
   await assert.rejects(db.exec(source.replace('RESET ROLE;',"DO $fail$ BEGIN RAISE EXCEPTION 'installation injected';END $fail$;RESET ROLE;")),/installation injected/);await db.exec('rollback');
   assert.equal(await val(db,'select pg_get_functiondef($1::regprocedure) v',[signature]),definition);
   assert.equal(await val(db,"select to_regclass('figure_model_private.response_journal') v"),null);
   assert.deepEqual(await membership(),members);assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
  });
  await db.exec(source);
  await t.test('successful installation preserves old budget, original ACL and role membership',async()=>{
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),originalBudget);
   assert.deepEqual(await membership(),members);assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
   assert.equal(await val(db,'select proacl::text v from pg_proc where oid=$1::regprocedure',[signature]),acl);
   for(const who of ['anon','authenticated','service_role'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(await val(db,"select has_table_privilege($1,'figure_model_private.response_journal',$2) v",[who,permission]),false);
   for(const who of ['anon','authenticated'])for(const fn of ['public.figure_model_read_response(uuid)','public.figure_model_store_response(uuid,jsonb,bytea,integer,text,text)'])assert.equal(await val(db,'select has_function_privilege($1,$2,\'EXECUTE\') v',[who,fn]),false);
   assert.equal(await val(db,"select relrowsecurity v from pg_class where oid='figure_model_private.response_journal'::regclass"),true);
  });
  await t.test('old unknown cannot gain bytes, new operation or new charge',async()=>{
   assert.equal(await read(db,old),null);assert.equal((await store(db,old,body)).status,'missing');
   const again=await reserve(db,{...old,operation:id(999)},1);assert.equal(again.status,'unknown');assert.equal(again.dispatch,false);
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),originalBudget);
  });
  const second=await stage(db,2);await recover(db,2,second.question);const current=await image(db,2,second,undefined,{reserve:false});
  await t.test('journal insertion failure rolls back reservation and all budget changes',async()=>{
   await db.exec('reset session authorization');await db.exec("create function figure_model_private.fixture_fail() returns trigger language plpgsql as $$begin raise exception 'journal injected';end$$;create trigger fixture_fail before insert on figure_model_private.response_journal for each row execute function figure_model_private.fixture_fail();set session authorization fixture_installer;");
   const before=await val(db,'select to_jsonb(x) v from ai_guard_budget x');const batch=await val(db,'select to_jsonb(x) v from figure_model_private.batch x');
   await assert.rejects(reserve(db,current),/journal injected/);
   assert.equal(await val(db,'select count(*)::int v from figure_model_private.operations where operation_id=$1',[current.operation]),0);
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),before);assert.deepEqual(await val(db,'select to_jsonb(x) v from figure_model_private.batch x'),batch);
   await db.exec('reset session authorization;drop trigger fixture_fail on figure_model_private.response_journal;drop function figure_model_private.fixture_fail();set session authorization fixture_installer;');
  });
  const r=await reserve(db,current);assert.equal(r.status,'reserved');
  await t.test('policy snapshot is trusted and cannot be filled before sent',async()=>{
   const e=await read(db,current);assert.deepEqual(e.policy,{model:'gpt-6-luna',pricingRevision:'fixture-image',reserveMicroUsd:1000,maxInputTokens:16000,maxOutputTokens:512,inputRate:1,outputRate:1});assert.equal(e.canDispatch,false);assert.equal((await store(db,current,body)).status,'held');
   assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[current.operation,r.sendToken]),true);assert.equal((await read(db,current)).canDispatch,true);
  });
  await t.test('disable gate and candidate withdrawal stop dispatch, without removing evidence',async()=>{
   await db.exec('reset session authorization;update figure_model_private.batch set model_enabled=false;set session authorization fixture_installer;');assert.equal((await read(db,current)).canDispatch,false);
   await db.exec('reset session authorization;update figure_model_private.batch set model_enabled=true;update explanation_figure_candidates set status=\'rejected\',image_bytes=null,reviewer_id=\'80000000-0000-4000-8000-000000000002\',reviewed_at=clock_timestamp() where id=\''+current.candidate+'\';set session authorization fixture_installer;');assert.equal((await read(db,current)).canDispatch,false);
   await db.exec('reset session authorization;update explanation_figure_candidates set status=\'pending\',reviewer_id=null,reviewed_at=null,image_bytes=decode(\'89504e470d0a1a0a010203\',\'hex\') where id=\''+current.candidate+'\';set session authorization fixture_installer;');assert.equal((await read(db,current)).canDispatch,true);
  });
  await t.test('candidate bytes, source and paragraph changes stop the next provider request',async()=>{
   for(const [column,changed,original] of [['attribution','Changed source credit','Fixture author'],['section_title','Changed caption','延伸概念示意圖'],['image_bytes',Buffer.from('89504e470d0a1a0a090909','hex'),Buffer.from('89504e470d0a1a0a010203','hex')]]){
    await role(db,'service_role',()=>db.query(`update explanation_figure_candidates set ${column}=$1 where id=$2`,[changed,current.candidate]));
    assert.equal((await read(db,current)).canDispatch,false);
    await role(db,'service_role',()=>db.query(`update explanation_figure_candidates set ${column}=$1 where id=$2`,[original,current.candidate]));
    assert.equal((await read(db,current)).canDispatch,true);
   }
  });
  await t.test('wrong binding, hash, decoder, status and oversize bytes fail without storing',async()=>{
   assert.equal((await store(db,current,body,200,{...current.binding,textHash:'9'.repeat(64)})).status,'conflict');
   assert.equal((await store(db,current,body,200,current.binding,'0'.repeat(64))).status,'invalid');
   assert.equal((await store(db,current,body,200,current.binding,sha(body),'wrong')).status,'invalid');
   assert.equal((await store(db,current,body,99)).status,'invalid');assert.equal((await store(db,current,Buffer.alloc(65537))).status,'invalid');
   assert.equal((await read(db,current)).responseSha,null);
  });
  await t.test('unknown may save a complete already-received body, but cannot dispatch again',async()=>{
   await rpc(db,'select figure_model_unknown($1) v',[current.operation]);const before=await val(db,'select to_jsonb(x) v from ai_guard_budget x');
   assert.equal((await store(db,current,body)).saved,true);assert.equal((await store(db,current,body)).saved,true);
   const e=await read(db,current);assert.equal(e.state,'unknown');assert.equal(e.canDispatch,false);assert.equal(e.responseBytes,'\\x'+body.toString('hex'));assert.equal(e.responseSha,sha(body));
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),before);
   assert.equal((await store(db,current,Buffer.from('different'))).status,'conflict');assert.equal((await store(db,current,body,201)).status,'conflict');
  });
  await t.test('later pricing changes never reinterpret the saved snapshot',async()=>{
   await db.exec('reset session authorization;update figure_model_private.batch set input_rate=2,output_rate=3,max_input_tokens=17000;set session authorization fixture_installer;');
   const e=await read(db,current);assert.equal(e.policy.inputRate,1);assert.equal(e.policy.outputRate,1);assert.equal(e.policy.maxInputTokens,16000);
  });
  await t.test('atomic original commit settles exactly once and preserves rejected candidate status',async()=>{
   const result=await commitImage(db,current);assert.equal(result.committed,true);const before=await val(db,'select to_jsonb(x) v from ai_guard_budget x');
   assert.equal((await commitImage(db,current)).committed,true);assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),before);
   await role(db,'service_role',()=>db.query("update explanation_figure_candidates set status='rejected',image_bytes=null where id=$1",[current.candidate]));
   assert.equal((await read(db,current)).candidateStatus,'rejected');assert.equal((await commitImage(db,current)).candidateStatus,'rejected');
  });
  await t.test('installed baseline cannot be blindly installed twice',async()=>{await assert.rejects(db.exec(source),/reservation baseline changed/);await db.exec('rollback')});
 }finally{await db.close()}
});

test('count-period replacement must prevent generation of the old pending image',async()=>{
 const db=await setup();try{
  await db.exec("alter role app_writer rename to fixture_installer;alter schema public owner to fixture_installer;grant ai_guard_owner to fixture_installer with admin true, inherit false, set false;grant service_role to fixture_installer with inherit false, set true;set session authorization fixture_installer;");
  const baseline=await val(db,'select md5(pg_get_functiondef($1::regprocedure)) v',[signature]);
  const source=fs.readFileSync('proposals/cloud-figure-response-journal.sql','utf8').replaceAll('postgres','fixture_installer').replace('fbef5447cc4dd2cc612af1d66461eb20',baseline);
  await db.exec(source);
  const first=await stage(db,1);await recover(db,1,first.question);const current=await image(db,1,first);
  assert.equal((await read(db,current)).canDispatch,true);
  const replacement=await stage(db,2,{replace:true,question:first.question});await recover(db,2,first.question,true);
  const evidence=await read(db,current);
  assert.equal(evidence.state,'sent');assert.equal(evidence.candidateStatus,'pending');
  assert.equal(evidence.canDispatch,false);
 }finally{await db.close()}
});
