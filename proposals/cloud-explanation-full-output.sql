-- Prepared full-output policy. No reset of prior requests, spent balances or unknown reservations.
-- New requests only; legacy reserve calls remain unchanged during rollout.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE full_output_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
CREATE TEMP TABLE full_output_acl_before ON COMMIT DROP AS SELECT oid,proacl,proowner,prosecdef FROM pg_proc WHERE oid IN ('explanation_private.explanation_generation_recover(uuid, uuid, text)'::regprocedure,'explanation_private.explanation_sitewide_result_recover(uuid, uuid, text)'::regprocedure,'ai_guard_commit(uuid,uuid,text,jsonb,text)'::regprocedure,'ai_guard_commit_replacement(uuid,uuid,text,jsonb,text,jsonb)'::regprocedure,'explanation_first_write_exact(uuid,uuid)'::regprocedure,'figure_text_commit_write(uuid,uuid)'::regprocedure,'explanation_private.explanation_generation_stage(uuid,uuid,text[],jsonb)'::regprocedure,'explanation_private.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb)'::regprocedure,'public.ai_guard_settle_call(uuid, integer, bigint, bigint, bigint)'::regprocedure);
CREATE TEMP TABLE full_output_budget_before ON COMMIT DROP AS SELECT to_jsonb(b) snapshot FROM public.ai_guard_budget b WHERE id;
CREATE TEMP TABLE full_output_tables_before ON COMMIT DROP AS SELECT oid,relacl,relowner,relrowsecurity FROM pg_class WHERE oid IN ('public.ai_guard_requests'::regclass,'explanation_private.generation_results'::regclass);
DO $guard$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'unexpected installer';END IF;
 IF EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_guard_requests' AND column_name='output_policy') THEN RAISE EXCEPTION 'output policy already installed';END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean';END IF;
 IF md5(pg_get_functiondef('explanation_private.explanation_generation_recover(uuid, uuid, text)'::regprocedure))<>'47eec706a1bdb98660b47e6fd4111b28' THEN RAISE EXCEPTION 'function baseline changed: explanation_private.explanation_generation_recover';END IF;
 IF md5(pg_get_functiondef('explanation_private.explanation_sitewide_result_recover(uuid, uuid, text)'::regprocedure))<>'182beebdd584400e4947de0b803f746a' THEN RAISE EXCEPTION 'function baseline changed: explanation_private.explanation_sitewide_result_recover';END IF;
 IF md5(pg_get_functiondef('ai_guard_commit(uuid,uuid,text,jsonb,text)'::regprocedure))<>'f4e561872f1712eb339f3bbda3041eb7' THEN RAISE EXCEPTION 'function baseline changed: public.ai_guard_commit';END IF;
 IF md5(pg_get_functiondef('ai_guard_commit_replacement(uuid,uuid,text,jsonb,text,jsonb)'::regprocedure))<>'7de33674b677a05f2d6a58fc7015e123' THEN RAISE EXCEPTION 'function baseline changed: public.ai_guard_commit_replacement';END IF;
 IF md5(pg_get_functiondef('explanation_first_write_exact(uuid,uuid)'::regprocedure))<>'bf2f725f8fdadb1a9cb08384acd8b64c' THEN RAISE EXCEPTION 'function baseline changed: public.explanation_first_write_exact';END IF;
 IF md5(pg_get_functiondef('figure_text_commit_write(uuid,uuid)'::regprocedure))<>'c0797990a2d89fbcae87140aa3f1b907' THEN RAISE EXCEPTION 'function baseline changed: public.figure_text_commit_write';END IF;
 IF md5(pg_get_functiondef('explanation_private.explanation_generation_stage(uuid,uuid,text[],jsonb)'::regprocedure))<>'6d713e4aba79efbf3f0631bd9336d791' THEN RAISE EXCEPTION 'function baseline changed: explanation_private.explanation_generation_stage';END IF;
 IF md5(pg_get_functiondef('explanation_private.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb)'::regprocedure))<>'8688d6edb4df7f2551d08154e6c54a33' THEN RAISE EXCEPTION 'function baseline changed: explanation_private.explanation_sitewide_result_stage';END IF;
 IF md5(pg_get_functiondef('public.ai_guard_settle_call(uuid, integer, bigint, bigint, bigint)'::regprocedure))<>'e51a925c8da5e0c6e2e66203bdf5d001' THEN RAISE EXCEPTION 'function baseline changed: public.ai_guard_settle_call';END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
SET LOCAL ROLE ai_guard_owner;
SELECT id FROM public.ai_guard_budget WHERE id FOR UPDATE;
ALTER TABLE public.ai_guard_requests ADD COLUMN output_policy jsonb;
ALTER TABLE public.ai_guard_requests ADD CONSTRAINT ai_guard_output_policy_check CHECK(output_policy IS NULL OR (output_policy=jsonb_build_object('revision','terra-model-max-v1','model','gpt-6.1-terra','pricingRevision','2026-11-02-terra-standard','maxInputTokens',16000,'maxOutputTokens',128000,'inputRate',1000000,'outputRate',5000000,'serviceTier','default') AND model='gpt-6.1-terra' AND pricing_revision='2026-11-02-terra-standard' AND call_limit=1 AND envelope_microusd=656000 AND per_call_ceiling_microusd=656000));
ALTER TABLE explanation_private.generation_results DROP CONSTRAINT generation_results_response_check;
ALTER TABLE explanation_private.generation_results ADD CONSTRAINT generation_results_response_check CHECK(octet_length(response::text)<=67108864);
CREATE FUNCTION explanation_private.explanation_output_cost(p_id uuid,p_input bigint,p_output bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.ai_guard_requests%rowtype; amount numeric;
BEGIN
 SELECT * INTO r FROM public.ai_guard_requests WHERE id=p_id;
 IF NOT FOUND OR p_input IS NULL OR p_output IS NULL OR p_input<0 OR p_output<0 THEN RETURN NULL;END IF;
 IF r.output_policy IS NULL THEN RETURN r.per_call_ceiling_microusd;END IF;
 IF p_input>(r.output_policy->>'maxInputTokens')::bigint OR p_output>(r.output_policy->>'maxOutputTokens')::bigint THEN RETURN NULL;END IF;
 amount:=ceil((p_input::numeric*(r.output_policy->>'inputRate')::numeric+p_output::numeric*(r.output_policy->>'outputRate')::numeric)/1000000);
 IF amount<0 OR amount>r.per_call_ceiling_microusd THEN RETURN NULL;END IF;
 RETURN amount::bigint;
END $$;
REVOKE ALL ON FUNCTION explanation_private.explanation_output_cost(uuid,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.explanation_reserve_full_output(p_id uuid, p_actor uuid, p_question text, p_manifest_sha256 text, p_source_commit text, p_base_version text, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.ai_guard_budget%rowtype; v_review public.ai_guard_reviewed_state%rowtype; n timestamptz:=clock_timestamp();
begin
  select * into b from public.ai_guard_budget where id=true for update;
  if not found or b.model is distinct from 'gpt-6.1-terra' or b.pricing_revision is distinct from '2026-11-02-terra-standard' then return 'unavailable';end if;
  b.envelope_microusd:=656000;b.per_call_ceiling_microusd:=656000;
  if not found or not b.enabled or NOT public.explanation_sitewide_allowed(p_actor,p_question)
    or b.cap_microusd is null or b.envelope_microusd is null or b.max_calls is null
    or b.per_call_ceiling_microusd is null or b.per_call_ceiling_microusd::numeric*b.max_calls > b.envelope_microusd
    or b.max_parallel is null or b.max_actor_parallel is null or b.cooldown_seconds is null or b.hourly_limit is null or b.daily_limit is null
    or p_action is null or p_action not in ('generate','replace') or b.max_calls <> 1 or b.model is distinct from 'gpt-6.1-terra' or b.pricing_revision is null or p_id is null or p_actor is null
    or p_question is null or length(p_question) not between 1 and 200 then return 'unavailable'; end if;
  select * into v_review from public.ai_guard_reviewed_state where id=true;
  if not found or p_manifest_sha256 is distinct from v_review.manifest_sha256 or p_source_commit is distinct from v_review.source_commit then return 'review_snapshot_unavailable'; end if;
  if p_action='generate' and exists(select 1 from public.ai_guard_reviewed_questions where question_id=p_question and generation=v_review.generation) then return 'reviewed_protected';end if;
  if p_action='replace' and p_base_version is distinct from public.explanation_replacement_base(p_question)->>'version' then return 'replacement_version_changed'; end if;
  -- Duplicate ID never authorizes a second dispatch, even if retrying after uncertain RPC response.
  if exists(select 1 from public.ai_guard_requests where id=p_id) then return 'duplicate'; end if;
  if b.spent_microusd::numeric+b.reserved_microusd::numeric+b.envelope_microusd::numeric > b.cap_microusd then return 'budget'; end if;
  if exists(select 1 from public.ai_guard_requests where question_id=p_question and state='active') then return 'question_busy'; end if;
  if (select count(*) from public.ai_guard_requests where state='active') >= b.max_parallel then return 'busy'; end if;
  if (select count(*) from public.ai_guard_requests where state='active' and actor_id=p_actor) >= b.max_actor_parallel then return 'actor_busy'; end if;
  if exists(select 1 from public.ai_guard_requests where actor_id=p_actor and created_at > n-make_interval(secs=>b.cooldown_seconds)) then return 'cooldown'; end if;
  if (select count(*) from public.ai_guard_requests where actor_id=p_actor and created_at > n-interval '1 hour') >= b.hourly_limit
    or (select count(*) from public.ai_guard_requests where actor_id=p_actor and created_at > n-interval '24 hours') >= b.daily_limit then return 'rate'; end if;
  insert into explanation_private.sitewide_requests(request_id,actor_id,question_id,action) values(p_id,p_actor,p_question,p_action);
  insert into public.ai_guard_requests(id,actor_id,question_id,envelope_microusd,call_limit,per_call_ceiling_microusd,model,pricing_revision,reviewed_generation,output_policy)
    values(p_id,p_actor,p_question,b.envelope_microusd,b.max_calls,b.per_call_ceiling_microusd,b.model,b.pricing_revision,v_review.generation,jsonb_build_object('revision','terra-model-max-v1','model','gpt-6.1-terra','pricingRevision','2026-11-02-terra-standard','maxInputTokens',16000,'maxOutputTokens',128000,'inputRate',1000000,'outputRate',5000000,'serviceTier','default'));
  if p_action='replace' then
  insert into public.explanation_replacement_versions(request_id, actor_id, question_id, base_version, before_snapshot)
  values(p_id,p_actor,p_question,p_base_version,public.explanation_replacement_base(p_question));
  end if;
  update public.ai_guard_budget set reserved_microusd=reserved_microusd+b.envelope_microusd where id=true;
  return 'reserved';
end $function$
;
CREATE FUNCTION public.explanation_read_output_policy(p_id uuid,p_actor uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('model',r.model,'call_limit',r.call_limit,'per_call_ceiling_microusd',r.per_call_ceiling_microusd,'pricing_revision',r.pricing_revision,'output_policy',r.output_policy)
 FROM public.ai_guard_requests r WHERE r.id=p_id AND r.actor_id=p_actor AND r.state='active' AND NOT r.result_committed AND r.output_policy IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.explanation_reserve_full_output(uuid,uuid,text,text,text,text,text),public.explanation_read_output_policy(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.explanation_reserve_full_output(uuid,uuid,text,text,text,text,text),public.explanation_read_output_policy(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION explanation_private.explanation_generation_recover(p_id uuid, p_actor uuid, p_question text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; j explanation_private.generation_results%rowtype; c public.ai_guard_calls%rowtype;
 result jsonb; settled text; current_status jsonb; expected_cost bigint;
begin
 -- Match the existing table -> budget -> request order. No external transport.
 select * into r from public.ai_guard_requests where id=p_id;
 if not found then return jsonb_build_object('status','missing');end if;
 if p_actor is null or r.actor_id is distinct from p_actor or r.question_id is distinct from p_question
 or exists(select 1 from public.explanation_replacement_versions where request_id=p_id) then return jsonb_build_object('status','denied');end if;
 if r.state='closed' and not r.result_committed then return jsonb_build_object('status','not_written');end if;
 perform public.figure_text_commit_lock(p_id,p_actor);
 perform 1 from public.ai_guard_budget where id for update;
 select * into r from public.ai_guard_requests where id=p_id for update;
 current_status:=public.explanation_generation_status(p_id,p_actor,p_question);
 if current_status->>'status' in ('completed','not_written') then
  if current_status->>'status'='completed' then
   select * into j from explanation_private.generation_results where request_id=p_id and actor_id=p_actor;
   if found and j.response_sha=encode(sha256(convert_to(j.response::text,'UTF8')),'hex') and jsonb_typeof(j.response->'needs')='object' then
    begin perform public.explanation_enqueue_exact_saved(p_id,p_actor,j.response->'needs');exception when others then null;end;
   end if;
  end if;
  return current_status;
 end if;
 select * into j from explanation_private.generation_results where request_id=p_id and actor_id=p_actor;
 if not found then return jsonb_build_object('status','held_no_result');end if;
 if j.response_sha<>encode(sha256(convert_to(j.response::text,'UTF8')),'hex') then return jsonb_build_object('status','held_evidence_conflict');end if;
 if j.response->>'model' is distinct from r.model or coalesce(length(j.response->>'responseId'),0)=0
 or coalesce(j.response->'usage'->>'inputTokens','') !~ '^[0-9]+$'
 or coalesce(j.response->'usage'->>'outputTokens','') !~ '^[0-9]+$' then return jsonb_build_object('status','held_usage_unknown');end if;
 if (j.response->'usage'->>'inputTokens')::numeric>16000 or (j.response->'usage'->>'outputTokens')::numeric>coalesce((r.output_policy->>'maxOutputTokens')::integer,2400) then return jsonb_build_object('status','held_usage_unknown');end if;
 expected_cost:=explanation_private.explanation_output_cost(p_id,(j.response->'usage'->>'inputTokens')::bigint,(j.response->'usage'->>'outputTokens')::bigint);
 if expected_cost is null then return jsonb_build_object('status','held_usage_unknown');end if;
 select * into c from public.ai_guard_calls where request_id=p_id and seq=1;
 if c.state='started' then
  settled:=public.ai_guard_settle_call(p_id,1,expected_cost,(j.response->'usage'->>'inputTokens')::bigint,(j.response->'usage'->>'outputTokens')::bigint);
  if settled<>'settled' then raise exception 'result settlement unconfirmed';end if;
 elsif c.state is distinct from 'settled' or c.cost_microusd<>expected_cost
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
end $function$
;
CREATE OR REPLACE FUNCTION explanation_private.explanation_sitewide_result_recover(p_id uuid, p_actor uuid, p_question text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; j explanation_private.generation_results%rowtype; c public.ai_guard_calls%rowtype;
 result jsonb; settled text; current_status jsonb; expected_cost bigint;
begin
 -- Match the existing table -> budget -> request order. No external transport.
 select * into r from public.ai_guard_requests where id=p_id;
 if not found then return jsonb_build_object('status','missing');end if;
 if p_actor is null or r.actor_id is distinct from p_actor or r.question_id is distinct from p_question
 or not exists(select 1 from explanation_private.sitewide_requests where request_id=p_id and actor_id=p_actor and action='replace') then return jsonb_build_object('status','denied');end if;
 if r.state='closed' and not r.result_committed then return jsonb_build_object('status','not_written');end if;
 perform public.figure_text_commit_lock(p_id,p_actor);
 perform 1 from public.ai_guard_budget where id for update;
 select * into r from public.ai_guard_requests where id=p_id for update;
 current_status:=public.explanation_replacement_status(p_actor,p_question,p_id);
 if current_status->>'status' in ('completed','not_written') then
  if current_status->>'status'='completed' then
   select * into j from explanation_private.generation_results where request_id=p_id and actor_id=p_actor;
   if found and j.response_sha=encode(sha256(convert_to(j.response::text,'UTF8')),'hex') and jsonb_typeof(j.response->'needs')='object' then
    begin perform public.explanation_enqueue_exact_saved(p_id,p_actor,j.response->'needs');exception when others then null;end;
   end if;
  end if;
  return current_status;
 end if;
 select * into j from explanation_private.generation_results where request_id=p_id and actor_id=p_actor;
 if not found then return jsonb_build_object('status','held_no_result');end if;
 if j.response_sha<>encode(sha256(convert_to(j.response::text,'UTF8')),'hex') then return jsonb_build_object('status','held_evidence_conflict');end if;
 if j.response->>'model' is distinct from r.model or coalesce(length(j.response->>'responseId'),0)=0
 or coalesce(j.response->'usage'->>'inputTokens','') !~ '^[0-9]+$'
 or coalesce(j.response->'usage'->>'outputTokens','') !~ '^[0-9]+$' then return jsonb_build_object('status','held_usage_unknown');end if;
 if (j.response->'usage'->>'inputTokens')::numeric>16000 or (j.response->'usage'->>'outputTokens')::numeric>coalesce((r.output_policy->>'maxOutputTokens')::integer,2400) then return jsonb_build_object('status','held_usage_unknown');end if;
 expected_cost:=explanation_private.explanation_output_cost(p_id,(j.response->'usage'->>'inputTokens')::bigint,(j.response->'usage'->>'outputTokens')::bigint);
 if expected_cost is null then return jsonb_build_object('status','held_usage_unknown');end if;
 select * into c from public.ai_guard_calls where request_id=p_id and seq=1;
 if c.state='started' then
  settled:=public.ai_guard_settle_call(p_id,1,expected_cost,(j.response->'usage'->>'inputTokens')::bigint,(j.response->'usage'->>'outputTokens')::bigint);
  if settled<>'settled' then raise exception 'result settlement unconfirmed';end if;
 elsif c.state is distinct from 'settled' or c.cost_microusd<>expected_cost
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
 result:=public.ai_guard_commit_replacement(p_id,p_actor,j.response->'value'->>'explanation',j.response->'value'->'optionAnalysis',coalesce(j.response->'value'->>'memoryTip',''),nullif(j.response->'needs','null'::jsonb));
 if result->>'status'='replacement_version_changed' then
  if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
  return jsonb_build_object('status','not_written');
 end if;
 if result->>'status' is distinct from 'replaced' then return jsonb_build_object('status','held_commit');end if;
 if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
 return public.explanation_replacement_status(p_actor,p_question,p_id);
end $function$
;
CREATE OR REPLACE FUNCTION public.ai_guard_commit(p_id uuid, p_actor uuid, p_explanation text, p_option_analysis jsonb, p_memory_tip text)
 RETURNS TABLE(status text, question_id text, explanation text, option_analysis jsonb, memory_tip text, model text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype;
        winner public.question_explanation_overrides%rowtype; inserted boolean := false; write_result jsonb; n timestamptz:=clock_timestamp();
begin
 -- Serialize against legacy row writers BEFORE budget lock to avoid tuple→budget inversion.
 perform public.figure_text_commit_lock(p_id,p_actor);
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return query select 'unavailable'::text,null::text,null::text,null::jsonb,null::text,null::text,null::timestamptz; return; end if;
 select * into r from public.ai_guard_requests ar where ar.id=p_id for update;
 if not found or r.state <> 'active' or r.result_committed or p_actor is null or r.actor_id <> p_actor
    or not exists(select 1 from public.ai_guard_reviewed_state rs where rs.id=true and rs.generation=r.reviewed_generation)
    or exists(select 1 from public.ai_guard_reviewed_questions rq where rq.question_id=r.question_id and rq.generation=r.reviewed_generation)
    or p_explanation is null or length(trim(p_explanation))=0 or length(p_explanation)>(case when r.output_policy is null then 100000 else 16777216 end)
    or p_option_analysis is null or jsonb_typeof(p_option_analysis) <> 'object'
    or length(p_option_analysis::text)>(case when r.output_policy is null then 100000 else 16777216 end) or length(coalesce(p_memory_tip,''))>(case when r.output_policy is null then 100000 else 16777216 end)
    or not exists(select 1 from public.ai_guard_calls ac where ac.request_id=p_id and ac.state='settled')
    or exists(select 1 from public.ai_guard_calls ac where ac.request_id=p_id and ac.state='started') then
   return query select 'unavailable'::text,null::text,null::text,null::jsonb,null::text,null::text,null::timestamptz; return;
 end if;
 insert into public.explanation_format_commits(request_id,write_transaction,payload)
 values(p_id,txid_current(),jsonb_build_object('question_id',r.question_id,'explanation',p_explanation,'option_analysis',p_option_analysis,'memory_tip',p_memory_tip,'model',r.model,'updated_at',n,'reading_format','full-v1'));
 write_result:=public.explanation_first_write_exact(p_id,p_actor);
 inserted:=coalesce((write_result->>'inserted')::boolean,false);
 winner:=jsonb_populate_record(null::public.question_explanation_overrides,write_result->'value');
 update public.ai_guard_requests set result_committed=true where id=p_id;
 return query select case when inserted then 'inserted'::text else 'existing'::text end,
    winner.question_id,winner.explanation,winner.option_analysis,winner.memory_tip,winner.model,winner.updated_at;
end $function$
;
CREATE OR REPLACE FUNCTION public.ai_guard_commit_replacement(p_id uuid, p_actor uuid, p_explanation text, p_option_analysis jsonb, p_memory_tip text, p_needs jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype; v public.explanation_replacement_versions%rowtype;
 winner public.question_explanation_overrides%rowtype; n timestamptz:=clock_timestamp();
 lim public.figure_image_limits%rowtype; cfg public.figure_queue_config%rowtype; digest text; queued boolean:=false;
begin
 perform public.figure_text_commit_lock(p_id,p_actor);
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return jsonb_build_object('status','unavailable'); end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state<>'active' or r.result_committed or p_actor is null or r.actor_id<>p_actor
 or r.call_limit<>1 or not exists(select 1 from public.ai_guard_reviewed_state s where s.id=true and s.generation=r.reviewed_generation)
 or p_explanation is null or length(trim(p_explanation))=0 or length(p_explanation)>(case when r.output_policy is null then 100000 else 16777216 end)
 or p_option_analysis is null or jsonb_typeof(p_option_analysis)<>'object' or length(p_option_analysis::text)>(case when r.output_policy is null then 100000 else 16777216 end)
 or length(coalesce(p_memory_tip,''))>(case when r.output_policy is null then 100000 else 16777216 end)
 or not exists(select 1 from public.ai_guard_calls c where c.request_id=p_id and c.seq=1 and c.state='settled')
 or exists(select 1 from public.ai_guard_calls c where c.request_id=p_id and c.state<>'settled') then return jsonb_build_object('status','unavailable'); end if;
 select * into v from public.explanation_replacement_versions where request_id=p_id and actor_id=p_actor and question_id=r.question_id for update;
 if not found or v.after_snapshot is not null then return jsonb_build_object('status','unavailable'); end if;
 if v.base_version is distinct from public.explanation_replacement_base(r.question_id)->>'version' then return jsonb_build_object('status','replacement_version_changed'); end if;
 -- The existing write barrier accepts this exact payload only in this transaction,
 -- after it has a private backup and a settled guard request. No session bypass flag.
 update public.explanation_replacement_versions set write_transaction=txid_current(),after_snapshot=jsonb_build_object(
 'explanation',p_explanation,'option_analysis',p_option_analysis,'memory_tip',p_memory_tip,'model',r.model,
 'replacement_revision',p_id,'updated_at',n,'figure_status','awaiting_image','reading_format','full-v1') where request_id=p_id;
 select * into winner from public.figure_text_commit_write(p_id,p_actor);
 update public.explanation_replacement_versions set after_snapshot=to_jsonb(winner),committed_at=n where request_id=p_id;
 update public.ai_guard_requests set result_committed=true where id=p_id;
 -- The bounded writer owns display data, not guard accounting.
 begin
  queued:=public.explanation_enqueue_exact_saved(p_id,p_actor,p_needs);
 exception when others then queued:=false;
 end;
 return jsonb_build_object('status','replaced','value',to_jsonb(winner),'figureQueued',queued);
end $function$
;
RESET ROLE;
CREATE OR REPLACE FUNCTION public.explanation_first_write_exact(p_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.ai_guard_requests%rowtype; f public.explanation_format_commits%rowtype;
 e public.question_explanation_overrides%rowtype; inserted boolean; p jsonb;
begin
 select * into r from public.ai_guard_requests where id=p_id;
 select * into f from public.explanation_format_commits where request_id=p_id;
 if r.id is null or f.request_id is null or p_actor is null or r.actor_id is distinct from p_actor
 or r.state<>'active' or r.result_committed or r.action_kind<>'explanation' or r.call_limit<>1
 or f.write_transaction is distinct from txid_current()
 or not exists(select 1 from public.ai_guard_reviewed_state where id and generation=r.reviewed_generation)
 or exists(select 1 from public.ai_guard_reviewed_questions where question_id=r.question_id and generation=r.reviewed_generation)
 or not exists(select 1 from public.ai_guard_calls where request_id=p_id and seq=1 and state='settled')
 or exists(select 1 from public.ai_guard_calls where request_id=p_id and state<>'settled')
 then raise exception 'exact first-generation witness required';end if;
 p:=f.payload;
 if p->>'question_id' is distinct from r.question_id or p->>'model' is distinct from r.model
 or p->>'reading_format' is distinct from 'full-v1' or coalesce(length(trim(p->>'explanation')),0) not between 1 and (case when r.output_policy is null then 100000 else 16777216 end)
 or jsonb_typeof(p->'option_analysis') is distinct from 'object' or length((p->'option_analysis')::text)>(case when r.output_policy is null then 100000 else 16777216 end)
 or length(coalesce(p->>'memory_tip',''))>(case when r.output_policy is null then 100000 else 16777216 end) or p->>'updated_at' is null
 then raise exception 'invalid exact first-generation payload';end if;
 insert into public.question_explanation_overrides as eo(question_id,explanation,option_analysis,memory_tip,model,updated_at,reading_format)
 values(r.question_id,p->>'explanation',p->'option_analysis',p->>'memory_tip',r.model,(p->>'updated_at')::timestamptz,'full-v1')
 on conflict on constraint question_explanation_overrides_pkey do nothing returning eo.* into e;
 inserted:=found;
 if not inserted then select * into e from public.question_explanation_overrides where question_id=r.question_id;end if;
 if e.question_id is null then raise exception 'first-generation winner missing';end if;
 return jsonb_build_object('inserted',inserted,'value',to_jsonb(e));
end $function$
;
SET LOCAL ROLE ai_guard_owner;
RESET ROLE;
CREATE OR REPLACE FUNCTION public.figure_text_commit_write(p_id uuid, p_actor uuid)
 RETURNS question_explanation_overrides
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE r public.ai_guard_requests%rowtype;v public.explanation_replacement_versions%rowtype;
 p jsonb; shared jsonb; reviewed jsonb; current_base text;winner public.question_explanation_overrides%rowtype;
BEGIN
 SELECT * INTO r FROM public.ai_guard_requests WHERE id=p_id;
 SELECT * INTO v FROM public.explanation_replacement_versions WHERE request_id=p_id AND actor_id=p_actor;
 SELECT to_jsonb(e) INTO shared FROM public.question_explanation_overrides e WHERE question_id=r.question_id;
 SELECT jsonb_build_object('question_id',r.question_id,'generation',s.generation,'manifest_sha256',s.manifest_sha256,'source_commit',s.source_commit) INTO reviewed FROM public.ai_guard_reviewed_state s JOIN public.ai_guard_reviewed_questions q ON q.generation=s.generation AND q.question_id=r.question_id WHERE s.id;
 current_base:=encode(sha256(convert_to(jsonb_build_object('shared',shared,'reviewed_static_ref',reviewed)::text,'UTF8')),'hex');
 IF r.id IS NULL OR v.request_id IS NULL OR r.actor_id IS DISTINCT FROM p_actor OR r.state<>'active' OR r.result_committed
 OR v.write_transaction IS DISTINCT FROM txid_current() OR v.committed_at IS NOT NULL
 OR v.question_id<>r.question_id OR v.base_version IS DISTINCT FROM current_base
 OR NOT EXISTS(SELECT FROM public.ai_guard_calls WHERE request_id=p_id AND seq=1 AND state='settled')
 OR EXISTS(SELECT FROM public.ai_guard_calls WHERE request_id=p_id AND state<>'settled')
 OR NOT EXISTS(SELECT FROM public.ai_guard_reviewed_state WHERE id AND generation=r.reviewed_generation)
 THEN RAISE EXCEPTION 'exact replacement witness required';END IF;
 p:=v.after_snapshot;
 IF p->>'replacement_revision' IS DISTINCT FROM p_id::text OR p->>'model' IS DISTINCT FROM r.model
 OR p->>'reading_format' IS DISTINCT FROM 'full-v1' OR coalesce(length(p->>'explanation'),0) NOT BETWEEN 1 AND (case when r.output_policy is null then 100000 else 16777216 end)
 OR jsonb_typeof(p->'option_analysis') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid exact payload';END IF;
 INSERT INTO public.question_explanation_overrides AS eo(question_id,explanation,option_analysis,memory_tip,model,updated_at,replacement_revision,figure_status,reading_format)
 VALUES(r.question_id,p->>'explanation',p->'option_analysis',p->>'memory_tip',r.model,(p->>'updated_at')::timestamptz,p_id,p->>'figure_status','full-v1')
 ON CONFLICT(question_id) DO UPDATE SET explanation=excluded.explanation,option_analysis=excluded.option_analysis,memory_tip=excluded.memory_tip,
 model=excluded.model,updated_at=excluded.updated_at,replacement_revision=excluded.replacement_revision,figure_status=excluded.figure_status,reading_format=excluded.reading_format
 RETURNING eo.* INTO winner;
 RETURN winner;
END$function$
;
SET LOCAL ROLE ai_guard_owner;
CREATE OR REPLACE FUNCTION explanation_private.explanation_generation_stage(p_id uuid, p_actor uuid, p_options text[], p_response jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; old explanation_private.generation_results%rowtype;
begin
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or p_actor is null or r.actor_id is distinct from p_actor or r.state<>'active' or r.result_committed or r.call_limit<>1
 or exists(select 1 from public.explanation_replacement_versions where request_id=p_id)
 or not exists(select 1 from public.ai_guard_calls where request_id=p_id and seq=1 and state in ('started','settled'))
 or p_options is null or cardinality(p_options) not between 1 and 5
 or exists(select 1 from unnest(p_options) k where k is null or k !~ '^[A-E]$')
 or cardinality(p_options)<>(select count(distinct k) from unnest(p_options) k)
 or p_response is null or jsonb_typeof(p_response)<>'object' or octet_length(p_response::text)>(case when r.output_policy is null then 262144 else 67108864 end)
 or jsonb_typeof(p_response->'rawText') is distinct from 'string'
 or coalesce(length(p_response->>'rawText'),0)=0 then return 'invalid';end if;
 select * into old from explanation_private.generation_results where request_id=p_id;
 if found then return case when old.actor_id=p_actor and old.required_options=p_options and old.response=p_response then 'saved' else 'conflict' end;end if;
 insert into explanation_private.generation_results(request_id,actor_id,required_options,response,response_sha)
 values(p_id,p_actor,p_options,p_response,encode(sha256(convert_to(p_response::text,'UTF8')),'hex'));
 return 'saved';
end $function$
;
CREATE OR REPLACE FUNCTION explanation_private.explanation_sitewide_result_stage(p_id uuid, p_actor uuid, p_options text[], p_response jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; old explanation_private.generation_results%rowtype;
begin
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or p_actor is null or r.actor_id is distinct from p_actor or r.state<>'active' or r.result_committed or r.call_limit<>1
 or not exists(select 1 from explanation_private.sitewide_requests where request_id=p_id and actor_id=p_actor and action='replace')
 or not exists(select 1 from public.explanation_replacement_versions where request_id=p_id and actor_id=p_actor)
 or not exists(select 1 from public.ai_guard_calls where request_id=p_id and seq=1 and state in ('started','settled'))
 or p_options is null or cardinality(p_options) not between 1 and 5
 or exists(select 1 from unnest(p_options) k where k is null or k !~ '^[A-E]$')
 or cardinality(p_options)<>(select count(distinct k) from unnest(p_options) k)
 or p_response is null or jsonb_typeof(p_response)<>'object' or octet_length(p_response::text)>(case when r.output_policy is null then 262144 else 67108864 end)
 or jsonb_typeof(p_response->'rawText') is distinct from 'string'
 or coalesce(length(p_response->>'rawText'),0)=0 then return 'invalid';end if;
 select * into old from explanation_private.generation_results where request_id=p_id;
 if found then return case when old.actor_id=p_actor and old.required_options=p_options and old.response=p_response then 'saved' else 'conflict' end;end if;
 insert into explanation_private.generation_results(request_id,actor_id,required_options,response,response_sha)
 values(p_id,p_actor,p_options,p_response,encode(sha256(convert_to(p_response::text,'UTF8')),'hex'));
 return 'saved';
end $function$
;
CREATE OR REPLACE FUNCTION public.ai_guard_settle_call(p_id uuid, p_seq integer, p_cost bigint, p_input bigint, p_output bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.ai_guard_requests%rowtype; b public.ai_guard_budget%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or p_cost is null or p_cost < 0 or p_input is null or p_input<0 or p_output is null or p_output<0 then return 'unavailable'; end if;
 if r.output_policy is not null and (explanation_private.explanation_output_cost(p_id,p_input,p_output) is null or p_cost is distinct from explanation_private.explanation_output_cost(p_id,p_input,p_output)) then return 'usage_policy_mismatch';end if;
 update public.ai_guard_calls set state='settled',cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output,settled_at=clock_timestamp()
 where request_id=p_id and seq=p_seq and state='started';
 if not found then return 'duplicate_or_missing'; end if;
 if p_cost > r.per_call_ceiling_microusd or (select coalesce(sum(cost_microusd),0) from public.ai_guard_calls where request_id=p_id) > r.envelope_microusd then
   update public.ai_guard_budget set enabled=false,disabled_reason='usage_over_ceiling',disabled_at=clock_timestamp() where id=true; return 'overrun_disabled';
 end if;
 return 'settled';
end $function$
;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM full_output_budget_before) IS DISTINCT FROM (SELECT to_jsonb(b) FROM public.ai_guard_budget b WHERE id) THEN RAISE EXCEPTION 'budget changed during installation';END IF;
 IF EXISTS(SELECT FROM public.ai_guard_requests WHERE output_policy IS NOT NULL) THEN RAISE EXCEPTION 'old requests changed';END IF;
 IF EXISTS(SELECT FROM full_output_tables_before b JOIN pg_class c ON c.oid=b.oid WHERE (c.relacl,c.relowner,c.relrowsecurity) IS DISTINCT FROM (b.relacl,b.relowner,b.relrowsecurity)) THEN RAISE EXCEPTION 'table privileges changed';END IF;

 IF (SELECT snapshot FROM full_output_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'membership changed';END IF;
 IF EXISTS(SELECT FROM full_output_acl_before b JOIN pg_proc p ON p.oid=b.oid WHERE (p.proacl,p.proowner,p.prosecdef) IS DISTINCT FROM (b.proacl,b.proowner,b.prosecdef)) THEN RAISE EXCEPTION 'existing function privileges changed';END IF;
 IF has_schema_privilege('ai_guard_owner','public','CREATE') OR EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) THEN RAISE EXCEPTION 'temporary privilege retained';END IF;
END $verify$;
COMMIT;
