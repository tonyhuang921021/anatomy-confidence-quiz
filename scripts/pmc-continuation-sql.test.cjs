const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {setup,role}=require('./helpers/write-boundary-fixture.cjs');
const {buildNeeds,approveSchemaQueries}=require('../lib/newExplanationFigures.cjs');
const sha=s=>createHash('sha256').update(s).digest('hex'),id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const val=async(db,q,p)=>(await db.query(q,p)).rows[0]?.v;
const call=(db,q,p)=>role(db,'service_role',()=>val(db,q,p));
test('PMC continuation source DAG and staging use unchanged non-superuser roles',async t=>{
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
  const patch=fs.readFileSync('proposals/cloud-pmc-continuation.sql','utf8');
  const definitions=patch.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$function\$[\s\S]*?\$function\$\n/g);
  assert.equal(definitions.length,3);
  for(const definition of definitions)await db.exec(definition);
  for(const signature of ['figure_continuation_step(uuid,uuid,text,text,text)','figure_continuation_record(uuid,uuid,text,text,jsonb,bytea,text)','figure_continuation_stage(uuid,uuid,text,jsonb)'])await db.exec(`alter function public.${signature} owner to app_writer;revoke all on function public.${signature} from public,anon,authenticated;grant execute on function public.${signature} to service_role;`);
  await db.exec("update figure_image_limits set max_searches=40");
  await db.exec(fs.readFileSync('proposals/cloud-pmc-figure-source.sql','utf8').match(/ALTER TABLE public.explanation_figure_candidates DROP CONSTRAINT[\s\S]*?;\nALTER TABLE public.explanation_figure_candidates ADD CONSTRAINT[\s\S]*?;/)[0]);
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
  assert.equal((await open(10,'inulin renal handling')).status,'created');
  const query='inulin renal handling',cid=id(10),png=Buffer.from([137,80,78,71,13,10,26,10,1]);
  const md5=createHash('md5').update(png).digest('hex'),version='PMC123.1',pmcid='PMC123',mh='c'.repeat(64),jh='d'.repeat(64),xm='e'.repeat(32);
  const url=`https://pmc-oa-opendata.s3.amazonaws.com/${version}/f1.png?md5=${md5}`;
  const source={sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC123/#F1',previewUrl:url,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:`Author ${version} ${mh} ${jh} ${md5}`};
  const meta=(kind,identity)=>`pmc-figure-v1:${kind}:${identity}`;
  const reserve=(kind,key,uri=null,who=actor)=>call(db,'select figure_continuation_step($1,$2,$3,$4,$5) v',[cid,who,kind,key,uri]);
  const record=(kind,key,payload=null,bytes=null,mime=null)=>call(db,'select figure_continuation_record($1,$2,$3,$4,$5,$6,$7) v',[cid,actor,kind,key,payload,bytes,mime]);
  const save=async(kind,identity,value)=>{const key=meta(kind,identity);assert.equal((await reserve('search',sha(key),key)).dispatch,true);assert.equal((await record('search',sha(key),[{kind,identity,value}])).status,'completed');};
  const stage=(s=source)=>call(db,'select figure_continuation_stage($1,$2,$3,$4) v',[cid,actor,sha(url),s]);
  await t.test('PMC cannot start before completed Commons and arbitrary identities cannot reserve',async()=>{
   assert.equal((await reserve('search',sha(meta('search',query)),meta('search',query))).status,'source');
   assert.equal((await reserve('search',sha('arbitrary'),'arbitrary')).status,'source');
   assert.equal((await reserve('search',sha(query))).dispatch,true);assert.equal((await record('search',sha(query),[])).status,'completed');
  });
  await t.test('each metadata HTTP counts once and requires exact prior query/article/version/digests',async()=>{
   const before=await val(db,'select searches v from figure_image_limits');
   await save('search',query,[{pmcid}]);
   assert.equal((await reserve('search',sha(meta('versions','PMC999')),meta('versions','PMC999'))).status,'source');
   await save('versions',pmcid,[version]);
   assert.equal((await reserve('search',sha(meta('manifest','PMC123.2')),meta('manifest','PMC123.2'))).status,'source');
   await save('manifest',version,{pmcid,version,licenseCode:'CC BY',manifestHash:mh,retrievedOn:'2026-11-09',xml:{md5:xm},media:[{url,md5,filename:'f1.png'}]});
   const identity=`${version}:${mh}:${xm}`;
   assert.equal((await reserve('search',sha(meta('jats',identity.replace(mh,'f'.repeat(64)))),meta('jats',identity.replace(mh,'f'.repeat(64))))).status,'source');
   await save('jats',identity,{jatsSha256:jh,candidates:[source]});
   assert.equal((await reserve('search',sha(meta('jats',identity)),meta('jats',identity))).dispatch,false);
   assert.equal(await val(db,'select searches v from figure_image_limits'),before+4);
  });
  await t.test('wrong actor and unsupported media URL do not download',async()=>{
   assert.equal((await reserve('download',sha(url),url,id(99))).status,'stale');
   const other=url.replace('f1.png','f2.png');assert.equal((await reserve('download',sha(other),other)).status,'source');
   assert.equal((await reserve('download',sha(url+'&x=1'),url+'&x=1')).status,'limit');
  });
  await t.test('stage accepts only exact cached PMC source and downloaded byte MD5',async()=>{
   const old={...source,previewUrl:url.replace(md5,'f'.repeat(32))};
   await db.query('insert into figure_image_cache(key,items) values($1,$2)',[sha('old-pmc-result'),[{kind:'jats',identity:'old',value:{candidates:[old]}}]]);
   assert.equal((await reserve('download',sha(url),url)).status,'prior_download_hold');
   await db.query('delete from figure_image_cache where key=$1',[sha('old-pmc-result')]);
   assert.equal((await reserve('download',sha(url),url)).dispatch,true);
   assert.equal((await record('download',sha(url),null,Buffer.concat([png,Buffer.from([0])]),'image/png')).status,'completed');
   assert.equal(await stage(),null);
   // Isolated fixture repair only, never modifies production unknown/result bytes.
   await db.query("update figure_model_private.image_steps set image_bytes=$1 where kind='download' and key=$2",[png,sha(url)]);
   assert.equal(await stage({...source,attribution:'changed'}),null);
   assert.equal(await stage({...source,license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'}),null);
   assert.equal(await stage({...source,sourceUrl:'https://pmc.ncbi.nlm.nih.gov/articles/PMC999/#F1'}),null);
   assert.equal(await stage({...source,sourceUrl:null}),null);
   const result=await stage();assert.match(result,/^[a-f0-9-]{36}$/);assert.equal(await stage(),result);
   assert.equal(await val(db,'select count(*)::int v from explanation_figure_candidates'),1);
  });
  await t.test('payloads bounded and unknown cannot be escaped through another provider',async()=>{
   assert.equal((await record('search',sha(query),[{padding:'x'.repeat(13000)}])).status,'conflict');
   assert.equal((await open(11,'inulin concentration graph')).status,'created');
   const other=id(11),q='inulin concentration graph';
   assert.equal((await call(db,'select figure_continuation_step($1,$2,$3,$4,null) v',[other,actor,'search',sha(q)])).dispatch,true);
   assert.equal((await call(db,'select figure_continuation_record($1,$2,$3,$4,$5,null,null) v',[other,actor,'search',sha(q),[{padding:'x'.repeat(13000)}]])).status,'invalid');
   assert.equal((await call(db,'select figure_continuation_record($1,$2,$3,$4,$5,null,null) v',[other,actor,'search',sha(q),[{kind:'versions',identity:'PMC999',value:null}]])).status,'invalid');
   assert.equal((await call(db,'select figure_continuation_record($1,$2,$3,$4,null,null,null) v',[other,actor,'search',sha(q)])).status,'unknown');
   assert.equal((await call(db,'select figure_continuation_step($1,$2,$3,$4,$5) v',[other,actor,'search',sha(meta('search',q)),meta('search',q)])).status,'held');
   assert.equal((await open(12,'inulin figure renal')).status,'continuation_limit');
  });
  await t.test('newer same-text revision cannot stage cached old candidate',async()=>{
   await db.exec('alter table question_explanation_overrides disable trigger user');
   try{await db.query('update question_explanation_overrides set replacement_revision=$1 where question_id=$2',[id(99),question]);assert.equal(await stage(),null);await db.query('update question_explanation_overrides set replacement_revision=null where question_id=$1',[question]);}finally{await db.exec('alter table question_explanation_overrides enable trigger user')}
  });
  await t.test('no budget reset or public execute privileges',async()=>{
   assert.deepEqual(await val(db,'select to_jsonb(b) v from ai_guard_budget b'),budget);
   for(const r of ['anon','authenticated'])for(const fn of ['figure_continuation_step(uuid,uuid,text,text,text)','figure_continuation_record(uuid,uuid,text,text,jsonb,bytea,text)','figure_continuation_stage(uuid,uuid,text,jsonb)'])assert.equal(await val(db,'select has_function_privilege($1,$2,\'EXECUTE\') v',[r,'public.'+fn]),false);
  });
 }finally{await db.close()}
});
