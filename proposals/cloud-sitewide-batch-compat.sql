-- Preserve the legacy pilot. Only already admitted private identities use the sitewide path.
-- Shared budget, concurrency, rate and version checks precede identity creation.
begin;
alter table explanation_private.sitewide_requests alter constraint sitewide_requests_request_id_fkey deferrable initially deferred;
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
  insert into explanation_private.sitewide_requests(request_id,actor_id,question_id,action) values(p_id,p_actor,p_question,p_action);
  insert into public.ai_guard_requests(id,actor_id,question_id,envelope_microusd,call_limit,per_call_ceiling_microusd,model,pricing_revision,reviewed_generation)
    values(p_id,p_actor,p_question,b.envelope_microusd,b.max_calls,b.per_call_ceiling_microusd,b.model,b.pricing_revision,v_review.generation);
  if p_action='replace' then
  insert into public.explanation_replacement_versions(request_id, actor_id, question_id, base_version, before_snapshot)
  values(p_id,p_actor,p_question,p_base_version,public.explanation_replacement_base(p_question));
  end if;
  update public.ai_guard_budget set reserved_microusd=reserved_microusd+b.envelope_microusd where id=true;
  return 'reserved';
end $function$;
CREATE OR REPLACE FUNCTION figure_model_private.text_batch_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE b figure_model_private.batch%rowtype; BEGIN
 -- ai_guard_reserve already owns the shared budget row; explicit lock also
 -- covers trusted direct fixture inserts. Same budget -> batch order as Luna.
 PERFORM 1 FROM public.ai_guard_budget WHERE id FOR UPDATE;
 IF TG_OP='INSERT' AND NEW.action_kind='explanation' AND NEW.call_limit=1 AND EXISTS(
  SELECT 1 FROM explanation_private.sitewide_requests s WHERE s.request_id=NEW.id
  AND s.actor_id=NEW.actor_id AND s.question_id=NEW.question_id AND s.action IN ('generate','replace')
  AND public.explanation_sitewide_allowed(s.actor_id,s.question_id)
 ) THEN RETURN NEW; END IF;
 SELECT * INTO b FROM figure_model_private.batch WHERE id FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT b.enabled THEN RAISE EXCEPTION 'bounded_text_batch_paused'; END IF;
 IF NOT coalesce(((b.funding_mode='cash_authorized' AND b.cash_authorized AND b.funding_evidence_sha ~ '^[0-9a-f]{64}$') OR (b.funding_mode='verified_credit' AND b.no_cash AND b.credit_until>clock_timestamp())),false) OR NEW.actor_id<>b.actor_id OR NOT NEW.question_id=ANY(b.targets)
  OR NEW.action_kind<>'explanation' OR NEW.call_limit<>1 OR b.text_requests>=3
  OR NEW.envelope_microusd<=0 OR b.charged+NEW.envelope_microusd>b.cap THEN
  RAISE EXCEPTION 'bounded_text_batch_denied'; END IF;
 INSERT INTO figure_model_private.text_reservations VALUES(NEW.id,NEW.question_id,NEW.envelope_microusd,clock_timestamp());
 UPDATE figure_model_private.batch SET charged=charged+NEW.envelope_microusd,text_requests=text_requests+1 WHERE id;
 RETURN NEW;
END $function$;

commit;
