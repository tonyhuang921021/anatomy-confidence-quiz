const fs=require('node:fs');const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
async function setup(){const db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create table public.ai_guard_budget(id boolean primary key,spent bigint default 0);
insert into public.ai_guard_budget values(true,0);
create table public.ai_guard_requests(id uuid primary key,actor_id uuid,question_id text,state text default 'active',result_committed boolean default false,call_limit int default 1,per_call_ceiling_microusd bigint default 56000,model text default 'gpt-6.1-terra');
create table public.ai_guard_calls(request_id uuid,seq int,state text default 'started',cost_microusd bigint,input_tokens bigint,output_tokens bigint,primary key(request_id,seq));
create table public.explanation_replacement_versions(request_id uuid primary key);
create table public.question_explanation_overrides(question_id text primary key,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz,reading_format text);
create function public.ai_guard_settle_call(p_id uuid,p_seq int,p_cost bigint,p_input bigint,p_output bigint) returns text language plpgsql as $$ begin update ai_guard_calls set state='settled',cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output where request_id=p_id and seq=p_seq and state='started';if not found then return 'held';end if;update ai_guard_budget set spent=spent+p_cost where id;return 'settled';end $$;
create function public.ai_guard_close(p_id uuid) returns text language plpgsql as $$ begin update ai_guard_requests set state='closed' where id=p_id;return 'closed';end $$;
create function public.ai_guard_commit(p_id uuid,p_actor uuid,p_text text,p_options jsonb,p_tip text) returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz) language plpgsql as $$ declare q text;begin select r.question_id into q from ai_guard_requests r where r.id=p_id and r.actor_id=p_actor;insert into question_explanation_overrides values(q,p_text,p_options,p_tip,'gpt-6.1-terra',clock_timestamp(),'full-v1') on conflict do nothing;update ai_guard_requests set result_committed=true where id=p_id;return query select 'inserted'::text,e.question_id,e.explanation,e.option_analysis,e.memory_tip,e.model,e.updated_at from question_explanation_overrides e where e.question_id=q;end $$;
create function public.figure_guard_commit_new_images(p_id uuid,p_actor uuid,p_text text,p_options jsonb,p_tip text,p_needs jsonb) returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz) language sql as $$ select * from ai_guard_commit(p_id,p_actor,p_text,p_options,p_tip) $$;
grant usage on schema public to service_role;grant select,insert,update on public.question_explanation_overrides to service_role;
`);await db.exec(fs.readFileSync('proposals/cloud-generation-journal.sql','utf8'));return db}
module.exports={setup};
