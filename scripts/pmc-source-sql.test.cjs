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
async function image(db,n,saved,source='https://commons.wikimedia.org/wiki/File:Fixture.png'){
 const needs={...saved.plan,status:'approved',reviewMethod:'schema_query',items:saved.plan.items.map(x=>({...x,searchScope:'general-medical',medicalDomain:'anatomy',query:'sternoclavicular joint anatomy',proposedQuery:'sternoclavicular joint anatomy',catalogRevision:'schema-query-v1'}))};
 assert.equal(await rpc(db,'select figure_image_review($1,$2,$3,null,$4) v',[id(n),needs.revision,needs,'schema_query']),'approved');
 assert.equal((await rpc(db,'select to_jsonb(x) v from figure_image_claim_fresh($1,600,$2,$3,$4) x',[id(900+n),id(n),saved.question,sha(saved.text)])).attempts,1);
 const bytes=Buffer.from('89504e470d0a1a0a010203','hex'),candidate=id(100+n),operation=id(200+n);
 await role(db,'service_role',()=>db.query(`insert into explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title,section_anchor,section_heading,section_sha256)
 values($1,$2,$3,$4,'image/png',$5,$10,'https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','Fixture author',$6,$7,$8,$9)`,[candidate,saved.question,sha(saved.text),sha(bytes),bytes,needs.items[0].caption,needs.items[0].sectionAnchor,needs.items[0].sectionTitle,needs.items[0].sectionHash,source]));
 const binding={requestId:id(n),questionId:saved.question,textHash:sha(saved.text),sectionHash:sha(saved.section),imageHash:sha(bytes),questionHash:'e'.repeat(64),sourceHash:'f'.repeat(64),policy:'luna-final-figure-v1'};
 const reservation=await rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[operation,candidate,sha('operation'+n),binding,'gpt-6-luna','fixture-image']);
 assert.equal(reservation.status,'reserved');assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[operation,reservation.sendToken]),true);
 return{binding,candidate,operation,reservation};
}
const commitImage=(db,o,verdict='match')=>rpc(db,'select figure_model_commit($1,$2,$3,$4,$5,100) v',[o.operation,o.binding,verdict,'fixture-review',sha('fixture-review')]);
const recover=(db,n,q,replace=false)=>rpc(db,'select '+(replace?'explanation_sitewide_result_recover':'explanation_generation_recover')+'($1,$2,$3) v',[id(n),actor(n),q]);

const fs=require('node:fs');
const proposed=()=>fs.readFileSync('proposals/cloud-pmc-figure-source.sql','utf8').replaceAll('postgres','fixture_installer');
const pmc='https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/#fig-1';
test('minimal source expansion preserves actual split-role save, review, budget and unknown semantics',async t=>{
 const db=await setup();try{
  await db.exec("alter role app_writer rename to fixture_installer;alter schema public owner to fixture_installer;grant ai_guard_owner to fixture_installer with admin true, inherit false, set false;grant service_role to fixture_installer with inherit false, set true;set session authorization fixture_installer;");
  const before=await val(db,'select to_jsonb(x) v from ai_guard_budget x');
  const acl=await val(db,"select proacl::text v from pg_proc where oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure");
  await t.test('an injected installation failure rolls back source and temporary access together',async()=>{
   const oldDefinition=await val(db,"select md5(pg_get_functiondef('public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure)) v");
   const oldMembers=await val(db,"select jsonb_agg(to_jsonb(m) order by grantor) v from pg_auth_members m where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole");
   const failing=proposed().replace('RESET ROLE;','DO $fail$ BEGIN RAISE EXCEPTION \'injected installation failure\'; END $fail$; RESET ROLE;');
   await assert.rejects(db.exec(failing),/injected installation failure/);await db.exec('rollback');
   assert.equal(await val(db,"select md5(pg_get_functiondef('public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure)) v"),oldDefinition);
   assert.deepEqual(await val(db,"select jsonb_agg(to_jsonb(m) order by grantor) v from pg_auth_members m where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole"),oldMembers);
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
  });
  await db.exec(proposed());
  await t.test('full install leaves no temporary SET/INHERIT/CREATE or changed execution rights',async()=>{
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),before);
   assert.equal(await val(db,"select proacl::text v from pg_proc where oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure"),acl);
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
   assert.equal(await val(db,"select exists(select 1 from pg_auth_members where roleid='ai_guard_owner'::regrole and member='fixture_installer'::regrole and (set_option or inherit_option)) v"),false);
   for(const role of ['anon','authenticated'])assert.equal(await val(db,"select has_function_privilege($1,'public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)','EXECUTE') v",[role]),false);
  });
  const first=await stage(db,1);await recover(db,1,first.question);
  const reviewed=await image(db,1,first,pmc);
  await t.test('exact PMC candidate passes actual model reservation and publishes only after committed review',async()=>{
   assert.equal(reviewed.reservation.status,'reserved');
   assert.equal(await val(db,'select status v from explanation_figure_candidates where id=$1',[reviewed.candidate]),'pending');
   assert.equal((await commitImage(db,reviewed,'partial_match')).status,'committed');
   assert.equal(await val(db,'select status v from explanation_figure_candidates where id=$1',[reviewed.candidate]),'approved');
   assert.equal(await val(db,'select source_url v from explanation_figure_candidates where id=$1',[reviewed.candidate]),pmc);
   assert.equal(await val(db,'select reserved_microusd::int v from ai_guard_budget'),0);
  });
  await t.test('unapproved hosts, query/space injection, missing anchors and PDM cannot enter PMC source path',async()=>{
   for(const url of ['https://pmc.ncbi.nlm.nih.gov.evil.test/articles/PMC123456/#fig-1','https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/','https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/?secret=x#fig-1','https://pmc.ncbi.nlm.nih.gov/articles/PMC123456/#fig 1'])await assert.rejects(db.query('update explanation_figure_candidates set source_url=$1 where id=$2',[url,reviewed.candidate]),/source_url_check/);
   await assert.rejects(db.query("update explanation_figure_candidates set license='PDM 1.0' where id=$1",[reviewed.candidate]),/source_url_check|pdm_evidence_check/);
  });
  const second=await stage(db,2);await recover(db,2,second.question);const uncertain=await image(db,2,second,pmc);
  await t.test('unknown model result cannot redispatch or refund under the new source',async()=>{
   await rpc(db,'select figure_model_unknown($1) v',[uncertain.operation]);
   const money=await val(db,'select to_jsonb(x) v from ai_guard_budget x');
   const again=await rpc(db,'select figure_model_reserve($1,$2,$3,$4,$5,$6,1000) v',[uncertain.operation,uncertain.candidate,sha('operation2'),uncertain.binding,'gpt-6-luna','fixture-image']);
   assert.equal(again.status,'unknown');assert.equal(again.dispatch,false);
   assert.deepEqual(await val(db,'select to_jsonb(x) v from ai_guard_budget x'),money);
   assert.equal(await rpc(db,'select figure_model_sent($1,$2) v',[uncertain.operation,uncertain.reservation.sendToken]),false);
  });
  await t.test('stale or already-installed baseline cannot be overwritten',async()=>{
   await assert.rejects(db.exec(proposed()),/reserve baseline changed/);await db.exec('rollback');
   assert.equal(await val(db,"select has_schema_privilege('ai_guard_owner','public','CREATE') v"),false);
  });
 }finally{await db.close()}
});
