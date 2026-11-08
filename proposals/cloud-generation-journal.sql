-- Candidate only. Not installed. Baseline: production 6b2e5e8c.
-- Private immutable response evidence, not a new credential, provider or quota.
-- Install only after approval of this exact persistent capability and ACL.
begin;
create schema if not exists explanation_private;
revoke all on schema explanation_private from public, anon, authenticated;
grant usage on schema explanation_private to service_role;
create table explanation_private.generation_results (
 request_id uuid primary key references public.ai_guard_requests(id),
 actor_id uuid not null,
 required_options text[] not null,
 response jsonb not null check (octet_length(response::text)<=262144),
 response_sha text not null check (response_sha ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table explanation_private.generation_results enable row level security;
revoke all on explanation_private.generation_results from public, anon, authenticated, service_role;

create function explanation_private.explanation_generation_status(p_id uuid,p_actor uuid,p_question text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,explanation_private as $$
declare r public.ai_guard_requests%rowtype; e public.question_explanation_overrides%rowtype;
begin
 select * into r from public.ai_guard_requests where id=p_id;
 if not found then return jsonb_build_object('status','missing');end if;
 if p_actor is null or r.actor_id is distinct from p_actor or r.question_id is distinct from p_question
 or exists(select 1 from public.explanation_replacement_versions where request_id=p_id) then return jsonb_build_object('status','denied');end if;
 if r.result_committed then
  select * into e from public.question_explanation_overrides where question_id=p_question;
  if found then return jsonb_build_object('status','completed','value',jsonb_build_object('question_id',e.question_id,'explanation',e.explanation,'option_analysis',e.option_analysis,'memory_tip',e.memory_tip,'model',e.model,'updated_at',e.updated_at,'reading_format',e.reading_format));end if;
 end if;
 return jsonb_build_object('status',case when r.state='closed' and not r.result_committed then 'not_written' else 'pending' end);
end $$;
create or replace function public.explanation_generation_status(p_id uuid,p_actor uuid,p_question text) returns jsonb
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_generation_status(p_id,p_actor,p_question)
$$;

create function explanation_private.explanation_generation_stage(p_id uuid,p_actor uuid,p_options text[],p_response jsonb)
returns text language plpgsql security definer set search_path=pg_catalog,public,explanation_private as $$
declare r public.ai_guard_requests%rowtype; old explanation_private.generation_results%rowtype;
begin
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or p_actor is null or r.actor_id is distinct from p_actor or r.state<>'active' or r.result_committed or r.call_limit<>1
 or exists(select 1 from public.explanation_replacement_versions where request_id=p_id)
 or not exists(select 1 from public.ai_guard_calls where request_id=p_id and seq=1 and state in ('started','settled'))
 or p_options is null or cardinality(p_options) not between 1 and 5
 or exists(select 1 from unnest(p_options) k where k is null or k !~ '^[A-E]$')
 or cardinality(p_options)<>(select count(distinct k) from unnest(p_options) k)
 or p_response is null or jsonb_typeof(p_response)<>'object' or octet_length(p_response::text)>262144
 or jsonb_typeof(p_response->'rawText') is distinct from 'string'
 or coalesce(length(p_response->>'rawText'),0)=0 then return 'invalid';end if;
 select * into old from explanation_private.generation_results where request_id=p_id;
 if found then return case when old.actor_id=p_actor and old.required_options=p_options and old.response=p_response then 'saved' else 'conflict' end;end if;
 insert into explanation_private.generation_results(request_id,actor_id,required_options,response,response_sha)
 values(p_id,p_actor,p_options,p_response,encode(sha256(convert_to(p_response::text,'UTF8')),'hex'));
 return 'saved';
end $$;
create or replace function public.explanation_generation_stage(p_id uuid,p_actor uuid,p_options text[],p_response jsonb) returns text
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_generation_stage(p_id,p_actor,p_options,p_response)
$$;

create function explanation_private.explanation_generation_recover(p_id uuid,p_actor uuid,p_question text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,explanation_private as $$
declare r public.ai_guard_requests%rowtype; j explanation_private.generation_results%rowtype; c public.ai_guard_calls%rowtype;
 result jsonb; settled text; current_status jsonb;
begin
 -- Match the existing table -> budget -> request order. No external transport.
 lock table public.question_explanation_overrides in share row exclusive mode;
 perform 1 from public.ai_guard_budget where id for update;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found then return jsonb_build_object('status','missing');end if;
 if p_actor is null or r.actor_id is distinct from p_actor or r.question_id is distinct from p_question
 or exists(select 1 from public.explanation_replacement_versions where request_id=p_id) then return jsonb_build_object('status','denied');end if;
 current_status:=public.explanation_generation_status(p_id,p_actor,p_question);
 if current_status->>'status' in ('completed','not_written') then return current_status;end if;
 select * into j from explanation_private.generation_results where request_id=p_id and actor_id=p_actor;
 if not found then return jsonb_build_object('status','held_no_result');end if;
 if j.response_sha<>encode(sha256(convert_to(j.response::text,'UTF8')),'hex') then return jsonb_build_object('status','held_evidence_conflict');end if;
 if j.response->>'model' is distinct from r.model or coalesce(length(j.response->>'responseId'),0)=0
 or coalesce(j.response->'usage'->>'inputTokens','') !~ '^[0-9]+$'
 or coalesce(j.response->'usage'->>'outputTokens','') !~ '^[0-9]+$' then return jsonb_build_object('status','held_usage_unknown');end if;
 if (j.response->'usage'->>'inputTokens')::numeric>16000 or (j.response->'usage'->>'outputTokens')::numeric>2400 then return jsonb_build_object('status','held_usage_unknown');end if;
 select * into c from public.ai_guard_calls where request_id=p_id and seq=1;
 if c.state='started' then
  settled:=public.ai_guard_settle_call(p_id,1,r.per_call_ceiling_microusd,(j.response->'usage'->>'inputTokens')::bigint,(j.response->'usage'->>'outputTokens')::bigint);
  if settled<>'settled' then raise exception 'result settlement unconfirmed';end if;
 elsif c.state is distinct from 'settled' or c.cost_microusd<>r.per_call_ceiling_microusd
 or c.input_tokens<>(j.response->'usage'->>'inputTokens')::bigint or c.output_tokens<>(j.response->'usage'->>'outputTokens')::bigint then return jsonb_build_object('status','held_usage_conflict');end if;
 -- Save incomplete/invalid exact responses as evidence, but never publish them.
 if jsonb_typeof(j.response->'value') is distinct from 'object'
 or jsonb_typeof(j.response->'value'->'explanation') is distinct from 'string'
 or coalesce(length(trim(j.response->'value'->>'explanation')),0)=0
 or jsonb_typeof(j.response->'value'->'optionAnalysis') is distinct from 'object'
 or exists(select 1 from unnest(j.required_options) k where jsonb_typeof(j.response->'value'->'optionAnalysis'->k) is distinct from 'string' or coalesce(length(trim(j.response->'value'->'optionAnalysis'->>k)),0)=0) then
  if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
  return jsonb_build_object('status','not_written');
 end if;
 if jsonb_typeof(j.response->'needs')='object' then
  select to_jsonb(x) into result from public.figure_guard_commit_new_images(p_id,p_actor,j.response->'value'->>'explanation',j.response->'value'->'optionAnalysis',coalesce(j.response->'value'->>'memoryTip',''),j.response->'needs') x;
 else
  select to_jsonb(x) into result from public.ai_guard_commit(p_id,p_actor,j.response->'value'->>'explanation',j.response->'value'->'optionAnalysis',coalesce(j.response->'value'->>'memoryTip','')) x;
 end if;
 if coalesce(result->>'status','') not in ('inserted','existing') then return jsonb_build_object('status','held_commit');end if;
 if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
 return public.explanation_generation_status(p_id,p_actor,p_question);
end $$;
create or replace function public.explanation_generation_recover(p_id uuid,p_actor uuid,p_question text) returns jsonb
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_generation_recover(p_id,p_actor,p_question)
$$;

revoke all on function public.explanation_generation_status(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.explanation_generation_stage(uuid,uuid,text[],jsonb) from public,anon,authenticated;
revoke all on function public.explanation_generation_recover(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.explanation_generation_status(uuid,uuid,text) to service_role;
grant execute on function public.explanation_generation_stage(uuid,uuid,text[],jsonb) to service_role;
grant execute on function public.explanation_generation_recover(uuid,uuid,text) to service_role;
revoke all on function explanation_private.explanation_generation_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function explanation_private.explanation_generation_status(uuid,uuid,text) to service_role;
revoke all on function explanation_private.explanation_generation_stage(uuid,uuid,text[],jsonb) from public,anon,authenticated;
grant execute on function explanation_private.explanation_generation_stage(uuid,uuid,text[],jsonb) to service_role;
revoke all on function explanation_private.explanation_generation_recover(uuid,uuid,text) from public,anon,authenticated;
grant execute on function explanation_private.explanation_generation_recover(uuid,uuid,text) to service_role;
commit;
