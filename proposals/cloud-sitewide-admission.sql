-- Candidate only, not installed. Enablement requires exact ACL/capability approval.
-- Requires cloud-generation-journal.sql. No balance, past request or unknown reset.
begin;
create table explanation_private.sitewide_policy (
 id boolean primary key default true check(id), enabled boolean not null default false,
 cap_ceiling_microusd bigint not null default 2000000 check(cap_ceiling_microusd between 1 and 2000000),
 funding_evidence_sha text check(funding_evidence_sha ~ '^[a-f0-9]{64}$')
);
insert into explanation_private.sitewide_policy(id) values(true);
create table explanation_private.sitewide_requests (
 request_id uuid primary key references public.ai_guard_requests(id), actor_id uuid not null,
 question_id text not null, action text not null check(action in ('generate','replace')),
 created_at timestamptz not null default clock_timestamp()
);
alter table explanation_private.sitewide_policy enable row level security;
alter table explanation_private.sitewide_requests enable row level security;
revoke all on explanation_private.sitewide_policy,explanation_private.sitewide_requests from public,anon,authenticated,service_role;
create function explanation_private.explanation_sitewide_allowed(p_actor uuid,p_question text) returns boolean language sql security definer set search_path=pg_catalog,public,explanation_private as $$
 select p_actor is not null and length(p_question) between 1 and 200 and exists(select 1 from explanation_private.sitewide_policy s join public.ai_guard_budget b on b.id=s.id where s.id and s.enabled and to_regprocedure('public.explanation_generation_stage(uuid,uuid,text[],jsonb)') is not null and to_regprocedure('public.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb)') is not null and to_regprocedure('public.explanation_sitewide_result_recover(uuid,uuid,text)') is not null and s.funding_evidence_sha ~ '^[a-f0-9]{64}$' and b.enabled and b.cap_microusd<=s.cap_ceiling_microusd and b.spent_microusd+b.reserved_microusd<=b.cap_microusd)
$$;
create or replace function public.explanation_sitewide_allowed(p_actor uuid,p_question text) returns boolean
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_allowed(p_actor,p_question)
$$;
create function explanation_private.explanation_sitewide_request_allowed(p_id uuid,p_actor uuid) returns boolean language sql security definer set search_path=pg_catalog,public,explanation_private as $$
 select exists(select 1 from explanation_private.sitewide_requests s where s.request_id=p_id and s.actor_id=p_actor and public.explanation_sitewide_allowed(p_actor,s.question_id))
$$;
create or replace function public.explanation_sitewide_request_allowed(p_id uuid,p_actor uuid) returns boolean
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_request_allowed(p_id,p_actor)
$$;

CREATE OR REPLACE FUNCTION explanation_private.explanation_sitewide_reserve(p_id uuid, p_actor uuid, p_question text, p_manifest_sha256 text, p_source_commit text, p_base_version text, p_action text)
 RETURNS text
 LANGUAGE plpgsql
 security definer
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare b public.ai_guard_budget%rowtype; v_review public.ai_guard_reviewed_state%rowtype; n timestamptz:=clock_timestamp();
begin
  select * into b from public.ai_guard_budget where id=true for update;
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
  insert into public.ai_guard_requests(id,actor_id,question_id,envelope_microusd,call_limit,per_call_ceiling_microusd,model,pricing_revision,reviewed_generation)
    values(p_id,p_actor,p_question,b.envelope_microusd,b.max_calls,b.per_call_ceiling_microusd,b.model,b.pricing_revision,v_review.generation);
  insert into explanation_private.sitewide_requests(request_id,actor_id,question_id,action) values(p_id,p_actor,p_question,p_action);
  if p_action='replace' then
  insert into public.explanation_replacement_versions(request_id, actor_id, question_id, base_version, before_snapshot)
  values(p_id,p_actor,p_question,p_base_version,public.explanation_replacement_base(p_question));
  end if;
  update public.ai_guard_budget set reserved_microusd=reserved_microusd+b.envelope_microusd where id=true;
  return 'reserved';
end $function$;
create or replace function public.explanation_sitewide_reserve(p_id uuid, p_actor uuid, p_question text, p_manifest_sha256 text, p_source_commit text, p_base_version text, p_action text) returns text
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_reserve(p_id,p_actor,p_question,p_manifest_sha256,p_source_commit,p_base_version,p_action)
$$;
CREATE OR REPLACE FUNCTION public.ai_guard_start_call(p_id uuid, p_seq integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.ai_guard_requests%rowtype; b public.ai_guard_budget%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or not b.enabled then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or r.result_committed or p_seq is null or p_seq < 1 or p_seq > r.call_limit then return 'unavailable'; end if;
 if (b.verified_credit_expires_at is null or b.verified_credit_expires_at<=clock_timestamp()) AND NOT public.explanation_sitewide_request_allowed(r.id,r.actor_id) AND NOT EXISTS(SELECT FROM figure_model_private.text_plans p JOIN figure_model_private.text_reservations t ON t.request_id=p.request_id WHERE p.request_id=r.id AND public.figure_text_cash_allowed(p.request_id,p.actor_id,p.question_id,p.base_version)) then return 'unavailable';end if;
 if b.cap_microusd is null or b.spent_microusd::numeric+b.reserved_microusd::numeric > b.cap_microusd or b.model is distinct from r.model or b.pricing_revision is distinct from r.pricing_revision then return 'unavailable'; end if;
 if exists(select 1 from public.ai_guard_calls where request_id=p_id and (state='started' or seq=p_seq)) then return 'blocked'; end if;
 if p_seq <> (select count(*)+1 from public.ai_guard_calls where request_id=p_id) then return 'blocked'; end if;
 if (select coalesce(sum(cost_microusd),0) from public.ai_guard_calls where request_id=p_id)+r.per_call_ceiling_microusd > r.envelope_microusd then return 'budget'; end if;
 insert into public.ai_guard_calls(request_id,seq,state) values(p_id,p_seq,'started'); return 'started';
end $function$;
CREATE OR REPLACE FUNCTION public.figure_model_reserve(p_operation uuid, p_candidate uuid, p_key text, p_binding jsonb, p_model text, p_pricing text, p_cost bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE b figure_model_private.batch%rowtype; a public.ai_guard_budget%rowtype;c public.explanation_figure_candidates%rowtype;
 j public.figure_queue_jobs%rowtype;o figure_model_private.operations%rowtype;txt text;token uuid;
BEGIN
 SELECT * INTO a FROM public.ai_guard_budget WHERE id FOR UPDATE;
 SELECT * INTO b FROM figure_model_private.batch WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT b.enabled OR NOT b.model_enabled OR NOT coalesce(((b.funding_mode='cash_authorized' AND b.cash_authorized AND b.funding_evidence_sha ~ '^[0-9a-f]{64}$') OR (b.funding_mode='verified_credit' AND b.no_cash AND b.credit_until>clock_timestamp() AND a.verified_credit_expires_at>clock_timestamp())),false)
  OR a.enabled IS DISTINCT FROM true
  OR p_model IS DISTINCT FROM b.model OR p_pricing IS DISTINCT FROM b.pricing_revision OR p_cost IS DISTINCT FROM b.reserve_cost
  OR p_binding IS NULL OR jsonb_typeof(p_binding)<>'object' OR p_operation IS NULL OR p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 SELECT * INTO o FROM figure_model_private.operations WHERE operation_id=p_operation OR candidate_id=p_candidate OR key=p_key LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('status',o.state,'dispatch',false,'operationId',o.operation_id); END IF;
 IF b.model_calls>=b.max_model_calls OR b.charged+p_cost>b.cap OR a.cap_microusd IS NULL OR a.spent_microusd+a.reserved_microusd+p_cost>a.cap_microusd THEN RETURN jsonb_build_object('status','budget'); END IF;
 IF NOT EXISTS(SELECT FROM public.figure_queue_config q,public.figure_image_limits l WHERE q.id AND l.id AND q.enabled AND q.capture_new AND l.enabled AND l.capture) THEN RETURN jsonb_build_object('status','paused'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
 SELECT * INTO c FROM public.explanation_figure_candidates WHERE id=p_candidate AND status='pending' FOR UPDATE;
 IF NOT FOUND OR (NOT c.question_id=ANY(b.targets) AND NOT EXISTS(SELECT 1 FROM explanation_private.sitewide_requests s JOIN public.ai_guard_requests r ON r.id=s.request_id WHERE s.request_id=(p_binding->>'requestId')::uuid AND s.question_id=c.question_id AND r.question_id=c.question_id AND r.result_committed AND public.explanation_sitewide_request_allowed(r.id,r.actor_id) AND EXISTS(SELECT 1 FROM public.figure_queue_jobs j WHERE j.request_id=r.id AND j.question_id=c.question_id AND j.explanation_sha256=c.explanation_sha256))) THEN RETURN jsonb_build_object('status','scope'); END IF;
 txt:=public.figure_model_locked_text(c.question_id,c.explanation_sha256);
 SELECT * INTO j FROM public.figure_queue_jobs WHERE request_id=(p_binding->>'requestId')::uuid FOR SHARE;
 IF NOT FOUND OR j.question_id<>c.question_id OR j.explanation_sha256<>c.explanation_sha256 OR j.needs_state<>'approved'
  OR NOT ((j.state='leased' AND j.attempts=1 AND (coalesce(p_binding->>'continuation','')='staged-image-v1' OR j.lease_until>clock_timestamp())) OR (j.state='done' AND public.figure_continuation_bound(p_binding,p_candidate)))
  OR (p_binding->>'policy') IS DISTINCT FROM 'luna-final-figure-v1' OR (p_binding->>'questionId') IS DISTINCT FROM c.question_id
  OR (p_binding->>'textHash') IS DISTINCT FROM c.explanation_sha256 OR (p_binding->>'sectionHash') IS DISTINCT FROM c.section_sha256
  OR (p_binding->>'imageHash') IS DISTINCT FROM c.image_sha256 OR coalesce(p_binding->>'questionHash','') !~ '^[0-9a-f]{64}$'
  OR coalesce(p_binding->>'sourceHash','') !~ '^[0-9a-f]{64}$'
  OR c.source_url !~ '^https://commons[.]wikimedia[.]org/wiki/File:[^[:space:]]+$'
  OR c.license_url IS DISTINCT FROM (CASE c.license WHEN 'CC BY 4.0' THEN 'https://creativecommons.org/licenses/by/4.0/' WHEN 'CC BY-SA 4.0' THEN 'https://creativecommons.org/licenses/by-sa/4.0/' WHEN 'CC BY 3.0' THEN 'https://creativecommons.org/licenses/by/3.0/' WHEN 'CC BY-SA 3.0' THEN 'https://creativecommons.org/licenses/by-sa/3.0/' WHEN 'CC0' THEN 'https://creativecommons.org/publicdomain/zero/1.0/' ELSE NULL END)
  OR c.license NOT IN ('CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC0')
  OR NOT ((c.image_mime='image/png' AND substring(c.image_bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) OR (c.image_mime='image/jpeg' AND substring(c.image_bytes from 1 for 3)=decode('ffd8ff','hex')) OR (c.image_mime='image/webp' AND substring(c.image_bytes from 1 for 4)=convert_to('RIFF','UTF8') AND substring(c.image_bytes from 9 for 4)=convert_to('WEBP','UTF8')))
  OR txt IS NULL OR encode(sha256(convert_to(txt,'UTF8')),'hex')<>c.explanation_sha256
  OR encode(sha256(c.image_bytes),'hex')<>c.image_sha256 OR NOT public.ai_guard_image_eligible(c.question_id,c.explanation_sha256)
  OR NOT EXISTS(SELECT FROM jsonb_array_elements(j.figure_needs->'items') i WHERE i->>'sectionHash'=c.section_sha256 AND i->>'sectionTitle'=c.section_heading AND i->>'caption'=c.section_title AND i->>'sectionAnchor'=c.section_anchor)
  OR NOT EXISTS(SELECT FROM regexp_split_to_table(txt,E'(?m)(?=^#{2,3}[ \t]+)') section WHERE encode(sha256(convert_to(btrim(section,E' \t\r\n'),'UTF8')),'hex')=c.section_sha256)
 THEN RETURN jsonb_build_object('status','stale'); END IF;
 token:=gen_random_uuid();
 INSERT INTO figure_model_private.operations(operation_id,key,candidate_id,binding,state,model,pricing_revision,reserved_cost,max_output_tokens,send_token,image_bytes,source_evidence)
 VALUES(p_operation,p_key,p_candidate,p_binding,'reserved',p_model,p_pricing,p_cost,b.max_output_tokens,token,c.image_bytes,
 jsonb_build_object('source',c.source_url,'licenseUrl',c.license_url,'license',c.license,'attribution',c.attribution,'mime',c.image_mime));
 UPDATE figure_model_private.batch SET charged=charged+p_cost,model_calls=model_calls+1 WHERE id;
 UPDATE public.ai_guard_budget SET reserved_microusd=reserved_microusd+p_cost WHERE id;
 INSERT INTO figure_model_private.events(operation_id,event) VALUES(p_operation,'reserved');
 RETURN jsonb_build_object('status','reserved','dispatch',false,'sendToken',token,'operationId',p_operation,'maxOutputTokens',b.max_output_tokens);
END $function$;

revoke all on function public.explanation_sitewide_allowed(uuid,text),public.explanation_sitewide_request_allowed(uuid,uuid),public.explanation_sitewide_reserve(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.explanation_sitewide_allowed(uuid,text),public.explanation_sitewide_request_allowed(uuid,uuid),public.explanation_sitewide_reserve(uuid,uuid,text,text,text,text,text) to service_role;
-- Existing function ACLs are preserved by CREATE OR REPLACE. Verify again before enabling.
create function explanation_private.explanation_sitewide_result_stage(p_id uuid,p_actor uuid,p_options text[],p_response jsonb)
returns text language plpgsql security definer set search_path=pg_catalog,public,explanation_private as $$
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
 or p_response is null or jsonb_typeof(p_response)<>'object' or octet_length(p_response::text)>262144
 or jsonb_typeof(p_response->'rawText') is distinct from 'string'
 or coalesce(length(p_response->>'rawText'),0)=0 then return 'invalid';end if;
 select * into old from explanation_private.generation_results where request_id=p_id;
 if found then return case when old.actor_id=p_actor and old.required_options=p_options and old.response=p_response then 'saved' else 'conflict' end;end if;
 insert into explanation_private.generation_results(request_id,actor_id,required_options,response,response_sha)
 values(p_id,p_actor,p_options,p_response,encode(sha256(convert_to(p_response::text,'UTF8')),'hex'));
 return 'saved';
end $$;
create or replace function public.explanation_sitewide_result_stage(p_id uuid,p_actor uuid,p_options text[],p_response jsonb) returns text
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_result_stage(p_id,p_actor,p_options,p_response)
$$;

create function explanation_private.explanation_sitewide_result_recover(p_id uuid,p_actor uuid,p_question text)
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
 or not exists(select 1 from explanation_private.sitewide_requests where request_id=p_id and actor_id=p_actor and action='replace') then return jsonb_build_object('status','denied');end if;
 current_status:=public.explanation_replacement_status(p_actor,p_question,p_id);
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
 result:=public.ai_guard_commit_replacement(p_id,p_actor,j.response->'value'->>'explanation',j.response->'value'->'optionAnalysis',coalesce(j.response->'value'->>'memoryTip',''),nullif(j.response->'needs','null'::jsonb));
 if result->>'status'='replacement_version_changed' then
  if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
  return jsonb_build_object('status','not_written');
 end if;
 if result->>'status' is distinct from 'replaced' then return jsonb_build_object('status','held_commit');end if;
 if public.ai_guard_close(p_id)<>'closed' then raise exception 'result close unconfirmed';end if;
 return public.explanation_replacement_status(p_actor,p_question,p_id);
end $$;
create or replace function public.explanation_sitewide_result_recover(p_id uuid,p_actor uuid,p_question text) returns jsonb
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_result_recover(p_id,p_actor,p_question)
$$;


create function explanation_private.explanation_sitewide_next_image() returns uuid language sql security definer set search_path=pg_catalog,public,explanation_private as $$
 select j.request_id from public.figure_queue_jobs j join explanation_private.sitewide_requests s on s.request_id=j.request_id join public.ai_guard_requests r on r.id=s.request_id
 where j.state='pending' and j.attempts=0 and j.needs_state='approved' and r.result_committed and public.explanation_sitewide_request_allowed(r.id,r.actor_id)
 order by j.created_at limit 1
$$;
create or replace function public.explanation_sitewide_next_image() returns uuid
language sql security invoker set search_path=pg_catalog,explanation_private as $$
 select explanation_private.explanation_sitewide_next_image()
$$;
revoke all on function public.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb),public.explanation_sitewide_result_recover(uuid,uuid,text),public.explanation_sitewide_next_image() from public,anon,authenticated;
grant execute on function public.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb),public.explanation_sitewide_result_recover(uuid,uuid,text),public.explanation_sitewide_next_image() to service_role;

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
 or p_explanation is null or length(trim(p_explanation))=0 or length(p_explanation)>100000
 or p_option_analysis is null or jsonb_typeof(p_option_analysis)<>'object' or length(p_option_analysis::text)>100000
 or length(coalesce(p_memory_tip,''))>100000
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
 -- Text/archive are already valid. A queue failure never loses paid text.
 begin
  select * into lim from public.figure_image_limits where id=true for update;
  select * into cfg from public.figure_queue_config where id=true for update;
  digest:=encode(sha256(convert_to(winner.explanation,'UTF8')),'hex');
  if b.enabled and (b.verified_credit_expires_at>clock_timestamp() or public.explanation_sitewide_request_allowed(p_id,p_actor)) and lim.capture and cfg.capture_new
   and lim.captured<lim.max_new and (select count(*) from public.figure_queue_jobs)<cfg.max_rows
   and jsonb_typeof(p_needs)='object' and octet_length(p_needs::text)<=4096
   and p_needs->>'explanationHash'=digest and p_needs->>'revision' ~ '^[0-9a-f]{64}$'
   and jsonb_typeof(p_needs->'items')='array' and jsonb_array_length(p_needs->'items') between 1 and 3 then
   insert into public.figure_queue_jobs(request_id,question_id,explanation_sha256,state,figure_needs,needs_state,image_status)
   values(p_id,winner.question_id,digest,'pending',p_needs,'awaiting','awaiting_concept_review') on conflict do nothing;
   if found then
    update public.figure_image_limits set captured=captured+1 where id=true;
    queued:=true;
   end if;
  end if;
 exception when others then queued:=false;
 end;
 return jsonb_build_object('status','replaced','value',to_jsonb(winner),'figureQueued',queued);
end $function$;
revoke all on function explanation_private.explanation_sitewide_allowed(uuid,text) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_allowed(uuid,text) to service_role;
revoke all on function explanation_private.explanation_sitewide_request_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_request_allowed(uuid,uuid) to service_role;
revoke all on function explanation_private.explanation_sitewide_reserve(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_reserve(uuid,uuid,text,text,text,text,text) to service_role;
revoke all on function explanation_private.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_result_stage(uuid,uuid,text[],jsonb) to service_role;
revoke all on function explanation_private.explanation_sitewide_result_recover(uuid,uuid,text) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_result_recover(uuid,uuid,text) to service_role;
revoke all on function explanation_private.explanation_sitewide_next_image() from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_next_image() to service_role;
revoke all on function public.ai_guard_start_call(uuid,integer) from public,anon,authenticated;
grant execute on function public.ai_guard_start_call(uuid,integer) to service_role;
revoke all on function public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint) from public,anon,authenticated;
grant execute on function public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint) to service_role;
revoke all on function public.ai_guard_commit_replacement(uuid,uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_guard_commit_replacement(uuid,uuid,text,jsonb,text,jsonb) to service_role;

create table explanation_private.sitewide_image_plan_holds (
 request_id uuid not null references public.ai_guard_requests(id), revision text not null check(revision ~ '^[a-f0-9]{64}$'),
 reason text not null check(reason='invalid_schema_query'), created_at timestamptz not null default clock_timestamp(), primary key(request_id,revision)
);
alter table explanation_private.sitewide_image_plan_holds enable row level security;
revoke all on explanation_private.sitewide_image_plan_holds from public,anon,authenticated,service_role;
create function explanation_private.explanation_sitewide_image_plans() returns jsonb language sql security definer set search_path=pg_catalog,public,explanation_private as $$
 select coalesce(jsonb_agg(x.payload),'[]'::jsonb) from (
  select jsonb_build_object('request_id',j.request_id,'state',j.state,'attempts',j.attempts,'needs_state',j.needs_state,'figure_needs',j.figure_needs) as payload
  from public.figure_queue_jobs j join explanation_private.sitewide_requests s on s.request_id=j.request_id join public.ai_guard_requests r on r.id=s.request_id
  where j.state='pending' and j.attempts=0 and j.needs_state='awaiting' and r.result_committed and public.explanation_sitewide_request_allowed(r.id,r.actor_id)
  and not exists(select 1 from explanation_private.sitewide_image_plan_holds h where h.request_id=j.request_id and h.revision=encode(sha256(convert_to(coalesce(j.figure_needs,'null'::jsonb)::text,'UTF8')),'hex'))
  order by j.created_at limit 20
 ) x
$$;
create function public.explanation_sitewide_image_plans() returns jsonb language sql security invoker set search_path=pg_catalog,explanation_private as $$ select explanation_private.explanation_sitewide_image_plans() $$;
create function explanation_private.explanation_sitewide_hold_plan(p_id uuid,p_needs jsonb) returns text language plpgsql security definer set search_path=pg_catalog,public,explanation_private as $$
begin
 if octet_length(coalesce(p_needs,'null'::jsonb)::text)>4096 then return 'invalid';end if;
 perform 1 from public.figure_queue_jobs j join explanation_private.sitewide_requests s on s.request_id=j.request_id join public.ai_guard_requests r on r.id=s.request_id
 where j.request_id=p_id and j.state='pending' and j.attempts=0 and j.needs_state='awaiting' and j.figure_needs is not distinct from p_needs and r.result_committed and public.explanation_sitewide_request_allowed(r.id,r.actor_id) for update of j;
 if not found then return 'stale';end if;
 insert into explanation_private.sitewide_image_plan_holds(request_id,revision,reason) values(p_id,encode(sha256(convert_to(coalesce(p_needs,'null'::jsonb)::text,'UTF8')),'hex'),'invalid_schema_query') on conflict do nothing;
 return 'held';
end $$;
create function public.explanation_sitewide_hold_plan(p_id uuid,p_needs jsonb) returns text language sql security invoker set search_path=pg_catalog,explanation_private as $$ select explanation_private.explanation_sitewide_hold_plan(p_id,p_needs) $$;
revoke all on function explanation_private.explanation_sitewide_image_plans(),explanation_private.explanation_sitewide_hold_plan(uuid,jsonb),public.explanation_sitewide_image_plans(),public.explanation_sitewide_hold_plan(uuid,jsonb) from public,anon,authenticated;
grant execute on function explanation_private.explanation_sitewide_image_plans(),explanation_private.explanation_sitewide_hold_plan(uuid,jsonb),public.explanation_sitewide_image_plans(),public.explanation_sitewide_hold_plan(uuid,jsonb) to service_role;

commit;
