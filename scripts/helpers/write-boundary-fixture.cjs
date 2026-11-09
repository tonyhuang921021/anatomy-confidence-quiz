const fs=require('node:fs');const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const tables=[...JSON.parse(fs.readFileSync('scripts/fixtures/write-boundary-schema.json')),...JSON.parse(fs.readFileSync('scripts/fixtures/write-boundary-private-schema.json'))];
const functions=JSON.parse(fs.readFileSync('scripts/fixtures/write-boundary-functions.json'));
const ident=x=>'"'+x.replaceAll('"','""')+'"';
const owner=x=>x==='postgres'?'app_writer':x;
async function setup({patched=true}={}){
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role ai_guard_owner;create role app_writer;create schema explanation_private authorization ai_guard_owner;create schema figure_model_private authorization ai_guard_owner;grant usage on schema public,explanation_private,figure_model_private to app_writer,ai_guard_owner,service_role;set check_function_bodies=false;`);
 for(const t of tables){
  const name=`${t.schema}.${t.table}`;
  const columns=t.columns.map(c=>ident(c.name)+' '+c.type+(t.table==='events'&&c.name==='id'?' generated always as identity':c.default?' default '+c.default:'')+(c.notnull?' not null':''));
  await db.exec(`create table ${name}(${columns.join(',')});alter table ${name} owner to ${owner(t.owner)};`);
  if(t.owner==='ai_guard_owner')await db.exec(`grant select on ${name} to app_writer;`);
  else await db.exec(`grant select on ${name} to ai_guard_owner;grant select,insert,update on ${name} to service_role;`);
 }
 await db.exec(`grant insert on public.figure_queue_jobs to ai_guard_owner;
 grant insert(question_id,explanation,option_analysis,memory_tip,model,updated_at) on public.question_explanation_overrides to ai_guard_owner;
 grant update(captured) on public.figure_image_limits to ai_guard_owner;
 grant update(id) on public.figure_queue_config to ai_guard_owner;
 grant update(state,image_status,lease_id,lease_until,updated_at) on public.figure_queue_jobs to ai_guard_owner;
 grant update(status,machine_review_id,reviewed_at,image_bytes) on public.explanation_figure_candidates to ai_guard_owner;
 create table figure_model_private.text_plans(request_id uuid,actor_id uuid,question_id text,base_version text,text_sha text);
 create table figure_model_private.text_reservations(request_id uuid,question_id text,envelope bigint,created_at timestamptz);
 alter table figure_model_private.text_plans owner to ai_guard_owner;alter table figure_model_private.text_reservations owner to ai_guard_owner;
 create function public.figure_continuation_bound(jsonb,uuid) returns boolean language sql as $$select false$$;
 `);
 for(const f of functions){
  await db.exec(f.definition+`;alter function ${f.signature} owner to ${owner(f.owner)};revoke all on function ${f.signature} from public,anon,authenticated,service_role,ai_guard_owner,app_writer;`);
  for(const [key,role]of[['anon','anon'],['authenticated','authenticated'],['guard','ai_guard_owner'],['service','service_role'],['writer','app_writer']])if(f[key])await db.exec(`grant execute on function ${f.signature} to ${role};`);
 }
 for(const t of tables)for(const c of t.constraints)await db.exec(`alter table ${t.schema}.${t.table} add constraint ${ident(c.name)} ${c.definition};`);
 await db.exec(`
 alter table explanation_private.sitewide_requests add constraint sitewide_requests_request_id_fkey foreign key(request_id) references public.ai_guard_requests(id) deferrable initially deferred;
 create trigger ai_guard_reviewed_write_barrier before insert or update or delete on public.question_explanation_overrides for each row execute function public.ai_guard_reviewed_write_barrier();
 create trigger explanation_reading_format_fence before insert or update or delete on public.question_explanation_overrides for each row execute function public.explanation_reading_format_fence();
 create trigger figure_text_batch_guard before insert on public.ai_guard_requests for each row execute function figure_model_private.text_batch_guard();
 set check_function_bodies=true;
 insert into public.ai_guard_budget(id,enabled,cap_microusd,spent_microusd,reserved_microusd,envelope_microusd,max_calls,per_call_ceiling_microusd,max_parallel,max_actor_parallel,cooldown_seconds,hourly_limit,daily_limit,model,pricing_revision,credit_observed_at,credit_grant_expires_at,run_authorized_until)
 values(true,true,2000000,902192,0,56000,1,56000,1,1,1,10,30,'gpt-6.1-terra','fixture-text','2026-11-01','2026-11-03','2026-11-02');
 insert into public.ai_guard_reviewed_state(id,generation,manifest_sha256,source_commit) values(true,1,repeat('a',64),repeat('b',40));
 insert into public.figure_queue_config(id,enabled,capture_new,max_rows) values(true,true,true,1000);
 insert into public.figure_image_limits(id,enabled,capture,max_new) values(true,true,true,2);
 insert into explanation_private.sitewide_policy(id,enabled,funding_evidence_sha) values(true,true,repeat('c',64));
 insert into figure_model_private.batch(id,enabled,model_enabled,actor_id,targets,cap,max_model_calls,model,pricing_revision,reserve_cost,max_output_tokens,max_input_tokens,input_rate,output_rate,funding_mode,cash_authorized,funding_evidence_sha,no_cash)
 values(true,true,true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['PILOT'],168000,9,'gpt-6-luna','fixture-image',1000,512,16000,1,1,'cash_authorized',true,repeat('c',64),false);
 `);
 if(patched){
  await db.exec(fs.readFileSync('proposals/cloud-exact-display-writers.sql','utf8').replace('to postgres;','to app_writer;'));
  for(const sig of ['explanation_first_write_exact(uuid,uuid)','explanation_enqueue_exact_saved(uuid,uuid,jsonb)'])await db.exec(`alter function public.${sig} owner to app_writer;`);
 }
 return db;
 }catch(e){await db.close();throw e}
}
async function role(db,who,fn){await db.exec('set role '+who);try{return await fn()}finally{await db.exec('reset role')}}
module.exports={setup,role};
