-- Candidate only. Requires approval before installation. No raw table or column grants.
-- Existing column-level grants are preserved; only exact display writes cross roles.
begin;
CREATE OR REPLACE FUNCTION public.figure_text_commit_lock(p_id uuid,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.ai_guard_requests r WHERE r.id=p_id AND r.actor_id=p_actor
 AND r.action_kind='explanation' AND r.call_limit=1 AND (r.state='active' OR (r.state='closed' AND r.result_committed)))
 THEN RAISE EXCEPTION 'exact text lock scope';END IF;
 LOCK TABLE public.question_explanation_overrides IN SHARE ROW EXCLUSIVE MODE;
END $$;
create function public.explanation_first_write_exact(p_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
 or p->>'reading_format' is distinct from 'full-v1' or coalesce(length(trim(p->>'explanation')),0) not between 1 and 100000
 or jsonb_typeof(p->'option_analysis') is distinct from 'object' or length((p->'option_analysis')::text)>100000
 or length(coalesce(p->>'memory_tip',''))>100000 or p->>'updated_at' is null
 then raise exception 'invalid exact first-generation payload';end if;
 insert into public.question_explanation_overrides as eo(question_id,explanation,option_analysis,memory_tip,model,updated_at,reading_format)
 values(r.question_id,p->>'explanation',p->'option_analysis',p->>'memory_tip',r.model,(p->>'updated_at')::timestamptz,'full-v1')
 on conflict on constraint question_explanation_overrides_pkey do nothing returning eo.* into e;
 inserted:=found;
 if not inserted then select * into e from public.question_explanation_overrides where question_id=r.question_id;end if;
 if e.question_id is null then raise exception 'first-generation winner missing';end if;
 return jsonb_build_object('inserted',inserted,'value',to_jsonb(e));
end $$;

create function public.explanation_enqueue_exact_saved(p_id uuid,p_actor uuid,p_needs jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_guard_requests%rowtype; e public.question_explanation_overrides%rowtype;
 lim public.figure_image_limits%rowtype; cfg public.figure_queue_config%rowtype; digest text;
begin
 -- Serialize with text writers before row/trigger budget locks, also for direct repair.
 -- Do not reopen a prior job or regenerate text when any evidence is uncertain.
 select * into r from public.ai_guard_requests where id=p_id;
 if r.id is null or p_actor is null or r.actor_id is distinct from p_actor or not r.result_committed
 or r.action_kind<>'explanation' or r.call_limit<>1 or r.state not in ('active','closed')
 or not exists(select 1 from public.ai_guard_calls where request_id=p_id and seq=1 and state='settled')
 or exists(select 1 from public.ai_guard_calls where request_id=p_id and state<>'settled') then return false;end if;
 perform public.figure_text_commit_lock(p_id,p_actor);
 select * into e from public.question_explanation_overrides where question_id=r.question_id for update;
 if not found then return false;end if;
 -- Both branches use immutable write evidence belonging to this exact operation.
 if not ((e.replacement_revision is null and exists(select 1 from public.explanation_format_commits f where f.request_id=p_id
  and f.payload=jsonb_build_object('question_id',e.question_id,'explanation',e.explanation,'option_analysis',e.option_analysis,
  'memory_tip',e.memory_tip,'model',e.model,'updated_at',e.updated_at,'reading_format',e.reading_format)))
  or (e.replacement_revision=p_id and exists(select 1 from public.explanation_replacement_versions v where v.request_id=p_id
  and v.actor_id=p_actor and v.question_id=e.question_id and v.committed_at is not null and v.restored_at is null
  and (v.after_snapshot-'figure_status')=(to_jsonb(e)-'figure_status')))) then return false;end if;
 digest:=encode(sha256(convert_to(e.explanation,'UTF8')),'hex');
 if exists(select 1 from public.figure_queue_jobs where request_id=p_id) then return false;end if;
 update public.question_explanation_overrides set figure_status='awaiting_image_plan' where question_id=e.question_id;
 select * into lim from public.figure_image_limits where id=true for update;
 select * into cfg from public.figure_queue_config where id=true for update;
 if not coalesce(lim.enabled and lim.capture and cfg.enabled and cfg.capture_new,false)
 or not exists(select 1 from public.ai_guard_budget where id and enabled)
 or lim.captured>=lim.max_new or (select count(*) from public.figure_queue_jobs)>=cfg.max_rows
 or jsonb_typeof(p_needs) is distinct from 'object' or octet_length(p_needs::text)>4096
 or p_needs->>'explanationHash' is distinct from digest or coalesce(p_needs->>'revision','') !~ '^[0-9a-f]{64}$'
 or jsonb_typeof(p_needs->'items') is distinct from 'array' or jsonb_array_length(p_needs->'items') not between 1 and 3 then return false;end if;
 insert into public.figure_queue_jobs(request_id,question_id,explanation_sha256,state,figure_needs,needs_state,image_status)
 values(p_id,e.question_id,digest,'pending',p_needs,'awaiting','awaiting_concept_review') on conflict do nothing;
 if not found then return false;end if;
 update public.figure_image_limits set captured=captured+1 where id=true;
 update public.question_explanation_overrides set figure_status='awaiting_concept_review' where question_id=e.question_id;
 return true;
end $$;
revoke all on function public.explanation_first_write_exact(uuid,uuid),public.explanation_enqueue_exact_saved(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.explanation_first_write_exact(uuid,uuid),public.explanation_enqueue_exact_saved(uuid,uuid,jsonb) to ai_guard_owner;
grant execute on function public.explanation_enqueue_exact_saved(uuid,uuid,jsonb) to service_role;
grant execute on function public.figure_guard_commit_new_images(uuid,uuid,text,jsonb,text,jsonb) to ai_guard_owner;
grant execute on function explanation_private.sitewide_image_binding(uuid,text,text) to postgres;
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
    or p_explanation is null or length(trim(p_explanation))=0 or length(p_explanation)>100000
    or p_option_analysis is null or jsonb_typeof(p_option_analysis) <> 'object'
    or length(p_option_analysis::text)>100000 or length(coalesce(p_memory_tip,''))>100000
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

CREATE OR REPLACE FUNCTION public.figure_guard_commit_new_images(p_id uuid, p_actor uuid, p_explanation text, p_option_analysis jsonb, p_memory_tip text, p_needs jsonb)
 RETURNS TABLE(status text, question_id text, explanation text, option_analysis jsonb, memory_tip text, model text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare saved record;
begin
 select * into saved from public.ai_guard_commit(p_id,p_actor,p_explanation,p_option_analysis,p_memory_tip);
 if saved.status='inserted' then
  begin
   perform public.explanation_enqueue_exact_saved(p_id,p_actor,p_needs);
  exception when others then null; -- Keep the paid text; its exact journal remains recoverable.
  end;
 end if;
 return query select saved.status,saved.question_id,saved.explanation,saved.option_analysis,saved.memory_tip,saved.model,saved.updated_at;
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
 -- The bounded writer owns display data, not guard accounting.
 begin
  queued:=public.explanation_enqueue_exact_saved(p_id,p_actor,p_needs);
 exception when others then queued:=false;
 end;
 return jsonb_build_object('status','replaced','value',to_jsonb(winner),'figureQueued',queued);
end $function$
;

CREATE OR REPLACE FUNCTION explanation_private.explanation_generation_recover(p_id uuid, p_actor uuid, p_question text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; j explanation_private.generation_results%rowtype; c public.ai_guard_calls%rowtype;
 result jsonb; settled text; current_status jsonb;
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
end $function$
;

CREATE OR REPLACE FUNCTION explanation_private.explanation_sitewide_result_recover(p_id uuid, p_actor uuid, p_question text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'explanation_private'
AS $function$
declare r public.ai_guard_requests%rowtype; j explanation_private.generation_results%rowtype; c public.ai_guard_calls%rowtype;
 result jsonb; settled text; current_status jsonb;
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
end $function$
;

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
 OR p->>'reading_format' IS DISTINCT FROM 'full-v1' OR coalesce(length(p->>'explanation'),0) NOT BETWEEN 1 AND 100000
 OR jsonb_typeof(p->'option_analysis') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid exact payload';END IF;
 INSERT INTO public.question_explanation_overrides AS eo(question_id,explanation,option_analysis,memory_tip,model,updated_at,replacement_revision,figure_status,reading_format)
 VALUES(r.question_id,p->>'explanation',p->'option_analysis',p->>'memory_tip',r.model,(p->>'updated_at')::timestamptz,p_id,p->>'figure_status','full-v1')
 ON CONFLICT(question_id) DO UPDATE SET explanation=excluded.explanation,option_analysis=excluded.option_analysis,memory_tip=excluded.memory_tip,
 model=excluded.model,updated_at=excluded.updated_at,replacement_revision=excluded.replacement_revision,figure_status=excluded.figure_status,reading_format=excluded.reading_format
 RETURNING eo.* INTO winner;
 RETURN winner;
END$function$
;

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
 IF NOT FOUND OR (NOT c.question_id=ANY(b.targets) AND NOT EXISTS(SELECT 1 FROM explanation_private.sitewide_requests s JOIN public.ai_guard_requests r ON r.id=s.request_id WHERE s.request_id=(p_binding->>'requestId')::uuid AND s.question_id=c.question_id AND r.question_id=c.question_id AND r.result_committed AND public.explanation_sitewide_request_allowed(r.id,r.actor_id) AND EXISTS(SELECT 1 FROM public.figure_queue_jobs admitted_job WHERE admitted_job.request_id=r.id AND admitted_job.question_id=c.question_id AND admitted_job.explanation_sha256=c.explanation_sha256))) THEN RETURN jsonb_build_object('status','scope'); END IF;
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
END $function$
;
commit;
