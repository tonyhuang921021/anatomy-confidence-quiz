-- GENERATED CLOUD CANDIDATE ONLY; never executed against a database.
-- psql entrypoint: ON_ERROR_STOP + single transaction; disconnect on error rolls back.
-- Does NOT seed/enable budget, install reviewed snapshot, or resume dispatch.
-- Original split files retained for review. Do not execute both forms.
\set ON_ERROR_STOP on
BEGIN;
-- SOURCE: reservation-candidate.sql (outer transaction wrapper removed)
-- REVIEW CANDIDATE ONLY: not a migration filename, not executed.
-- Never enable until verified credit, account scope, price ceilings and integration are reviewed.
create table public.ai_guard_budget (
  id boolean primary key default true check (id), enabled boolean not null default false,
  disabled_reason text check (disabled_reason in ('cost_overflow','usage_over_ceiling','pricing_error','provider_unknown')), disabled_at timestamptz,
  verified_credit_expires_at timestamptz,
  cap_microusd bigint check (cap_microusd > 0),
  spent_microusd bigint not null default 0 check (spent_microusd >= 0),
  reserved_microusd bigint not null default 0 check (reserved_microusd >= 0),
  envelope_microusd bigint check (envelope_microusd > 0),
  max_calls integer check (max_calls between 1 and 5),
  per_call_ceiling_microusd bigint check (per_call_ceiling_microusd > 0),
  max_parallel integer check (max_parallel > 0),
  max_actor_parallel integer check (max_actor_parallel > 0),
  cooldown_seconds integer check (cooldown_seconds > 0),
  hourly_limit integer check (hourly_limit > 0), daily_limit integer check (daily_limit > 0),
  model text, pricing_revision text
);
-- No seed: absent configuration denies all reservations.
create table public.ai_guard_requests (
  id uuid primary key, actor_id uuid not null, question_id text not null check (length(question_id) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  envelope_microusd bigint not null check(envelope_microusd > 0),
  call_limit integer not null check(call_limit between 1 and 5),
  per_call_ceiling_microusd bigint not null check(per_call_ceiling_microusd > 0),
  model text not null, pricing_revision text not null,
  reviewed_generation bigint not null,
  result_committed boolean not null default false,
  state text not null default 'active' check(state in ('active','closed')),
  closed_at timestamptz
);
create unique index ai_guard_one_active_question on public.ai_guard_requests(question_id) where state='active';
create index ai_guard_actor_time on public.ai_guard_requests(actor_id,created_at desc);
create table public.ai_guard_calls (
  request_id uuid not null references public.ai_guard_requests(id),
  seq integer not null check(seq > 0),
  state text not null check(state in ('started','settled')),
  cost_microusd bigint check(cost_microusd >= 0),
  input_tokens bigint check(input_tokens >= 0), output_tokens bigint check(output_tokens >= 0),
  started_at timestamptz not null default clock_timestamp(), settled_at timestamptz,
  primary key(request_id,seq),
  check ((state='started' and cost_microusd is null) or (state='settled' and cost_microusd is not null))
);
-- Trusted installed snapshot: absent = unavailable. Source/hash authenticity verified out of band.
create table public.ai_guard_reviewed_state (
  id boolean primary key default true check(id), generation bigint not null check(generation>0),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  source_commit text not null check(source_commit ~ '^[0-9a-f]{40}$'),
  installed_at timestamptz not null default clock_timestamp()
);
create table public.ai_guard_reviewed_questions (
  question_id text primary key check(length(question_id) between 1 and 200), generation bigint not null
);
-- Durable reconciliation events: evidence hashes/references only, never question contents or provider key.
create table public.ai_guard_reconcile_audit (
  ticket uuid primary key, request_id uuid not null references public.ai_guard_requests(id), seq integer not null,
  operator_id uuid not null,
  resolution text not null check(resolution in ('provider_billed','proven_not_dispatched')),
  evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  worker_stopped_at timestamptz not null, attested_cost_microusd bigint not null check(attested_cost_microusd>=0),
  attested_input_tokens bigint, attested_output_tokens bigint,
  attested_at timestamptz not null default clock_timestamp(), unique(request_id,seq)
);
-- Owner-provisioned allowlist, empty by default. auth.uid() must match active row.
-- Operator UUID represents authenticated account; provisioning/revocation is out-of-band, owner-only.
create table public.ai_guard_reconcile_operators (
 operator_id uuid primary key, enabled boolean not null default false
);
alter table public.ai_guard_reconcile_operators enable row level security;
revoke all on public.ai_guard_reconcile_operators from public,anon,authenticated,service_role;
alter table public.ai_guard_reviewed_state enable row level security;
alter table public.ai_guard_reviewed_questions enable row level security;
alter table public.ai_guard_reconcile_audit enable row level security;
revoke all on public.ai_guard_reviewed_state,public.ai_guard_reviewed_questions,public.ai_guard_reconcile_audit from public,anon,authenticated,service_role;
alter table public.ai_guard_budget enable row level security;
alter table public.ai_guard_requests enable row level security;
alter table public.ai_guard_calls enable row level security;
revoke all on public.ai_guard_budget,public.ai_guard_requests,public.ai_guard_calls from public,anon,authenticated,service_role;
-- SECURITY DEFINER: trusted locked-down owner; exact execution grants below. Actor is server-verified auth.users.id.
create function public.ai_guard_reserve(p_id uuid,p_actor uuid,p_question text,p_manifest_sha256 text,p_source_commit text)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; v_review public.ai_guard_reviewed_state%rowtype; n timestamptz:=clock_timestamp();
begin
  select * into b from public.ai_guard_budget where id=true for update;
  if not found or not b.enabled or b.verified_credit_expires_at is null or b.verified_credit_expires_at <= n
    or b.cap_microusd is null or b.envelope_microusd is null or b.max_calls is null
    or b.per_call_ceiling_microusd is null or b.per_call_ceiling_microusd::numeric*b.max_calls > b.envelope_microusd
    or b.max_parallel is null or b.max_actor_parallel is null or b.cooldown_seconds is null or b.hourly_limit is null or b.daily_limit is null
    or b.model is null or b.pricing_revision is null or p_id is null or p_actor is null
    or p_question is null or length(p_question) not between 1 and 200 then return 'unavailable'; end if;
  select * into v_review from public.ai_guard_reviewed_state where id=true;
  if not found or p_manifest_sha256 is distinct from v_review.manifest_sha256 or p_source_commit is distinct from v_review.source_commit then return 'review_snapshot_unavailable'; end if;
  if exists(select 1 from public.ai_guard_reviewed_questions where question_id=p_question and generation=v_review.generation) then return 'reviewed_protected'; end if;
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
  update public.ai_guard_budget set reserved_microusd=reserved_microusd+b.envelope_microusd where id=true;
  return 'reserved';
end $$;
-- Narrow read: trusted server only, actor must already be verified with auth.getUser.
create function public.ai_guard_read_reservation(p_id uuid,p_actor uuid)
returns table(model text,call_limit integer,per_call_ceiling_microusd bigint,pricing_revision text)
language sql security definer set search_path=pg_catalog,public as $$
 select r.model,r.call_limit,r.per_call_ceiling_microusd,r.pricing_revision
 from public.ai_guard_requests r where r.id=p_id and r.actor_id=p_actor and r.state='active' and not r.result_committed
$$;
revoke all on function public.ai_guard_read_reservation(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_read_reservation(uuid,uuid) to service_role;
-- Persist started BEFORE each outbound call. Duplicate seq is denied; an unknown call remains started and holds its whole envelope.
create function public.ai_guard_start_call(p_id uuid,p_seq integer)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare r public.ai_guard_requests%rowtype; b public.ai_guard_budget%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or not b.enabled or b.verified_credit_expires_at is null or b.verified_credit_expires_at <= clock_timestamp() then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or r.result_committed or p_seq is null or p_seq < 1 or p_seq > r.call_limit then return 'unavailable'; end if;
 if b.cap_microusd is null or b.spent_microusd::numeric+b.reserved_microusd::numeric > b.cap_microusd or b.model is distinct from r.model or b.pricing_revision is distinct from r.pricing_revision then return 'unavailable'; end if;
 if exists(select 1 from public.ai_guard_calls where request_id=p_id and (state='started' or seq=p_seq)) then return 'blocked'; end if;
 if p_seq <> (select count(*)+1 from public.ai_guard_calls where request_id=p_id) then return 'blocked'; end if;
 if (select coalesce(sum(cost_microusd),0) from public.ai_guard_calls where request_id=p_id)+r.per_call_ceiling_microusd > r.envelope_microusd then return 'budget'; end if;
 insert into public.ai_guard_calls(request_id,seq,state) values(p_id,p_seq,'started'); return 'started';
end $$;
-- Cost must be conservative actual charge from verified price revision and usage; unknown => do not settle.
create function public.ai_guard_settle_call(p_id uuid,p_seq integer,p_cost bigint,p_input bigint,p_output bigint)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare r public.ai_guard_requests%rowtype; b public.ai_guard_budget%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or p_cost is null or p_cost < 0 or p_input is null or p_input<0 or p_output is null or p_output<0 then return 'unavailable'; end if;
 update public.ai_guard_calls set state='settled',cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output,settled_at=clock_timestamp()
 where request_id=p_id and seq=p_seq and state='started';
 if not found then return 'duplicate_or_missing'; end if;
 if p_cost > r.per_call_ceiling_microusd or (select coalesce(sum(cost_microusd),0) from public.ai_guard_calls where request_id=p_id) > r.envelope_microusd then
   update public.ai_guard_budget set enabled=false,disabled_reason='usage_over_ceiling',disabled_at=clock_timestamp() where id=true; return 'overrun_disabled';
 end if;
 return 'settled';
end $$;
-- All started calls must be settled; no timeout/lease release. Even error paths need confirmed usage or manual reconciliation.
create function public.ai_guard_close(p_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype; actual numeric;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state<>'active' then return 'unavailable'; end if;
 if exists(select 1 from public.ai_guard_calls where request_id=p_id and state='started') then return 'unresolved'; end if;
 if not exists(select 1 from public.ai_guard_calls where request_id=p_id) then return 'unstarted_requires_reconciliation'; end if;
 select coalesce(sum(cost_microusd),0) into actual from public.ai_guard_calls where request_id=p_id;
 -- Overflow or accounting inconsistency fails transaction and retains lock+reservation.
 if b.reserved_microusd<r.envelope_microusd then return 'unavailable'; end if;
 if actual > 9223372036854775807::numeric-b.spent_microusd then
   update public.ai_guard_budget set enabled=false,disabled_reason='cost_overflow',disabled_at=clock_timestamp() where id=true;
   return 'overflow_disabled';
 end if;
 update public.ai_guard_budget set reserved_microusd=reserved_microusd-r.envelope_microusd,
   spent_microusd=spent_microusd+actual::bigint, enabled=enabled and actual<=r.envelope_microusd,
   disabled_reason=case when actual>r.envelope_microusd then 'usage_over_ceiling' else disabled_reason end,
   disabled_at=case when actual>r.envelope_microusd then clock_timestamp() else disabled_at end where id=true;
 update public.ai_guard_requests set state='closed',closed_at=clock_timestamp() where id=p_id;
 return case when actual>r.envelope_microusd then 'overrun_disabled' else 'closed' end;
end $$;
-- Cache-winner cancellation, only pre-dispatch. Trusted server MUST verify p_actor.
-- Every provider dispatch MUST first be fenced through start_call for this to be safe.
create function public.ai_guard_cancel_if_cached(p_id uuid,p_actor uuid)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype;
begin
 lock table public.question_explanation_overrides in share row exclusive mode;
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state<>'active' or r.result_committed or p_actor is null or r.actor_id<>p_actor
   or exists(select 1 from public.ai_guard_calls where request_id=p_id)
   or not exists(select 1 from public.question_explanation_overrides where question_id=r.question_id)
   or b.reserved_microusd<r.envelope_microusd then return 'unavailable'; end if;
 update public.ai_guard_budget set reserved_microusd=reserved_microusd-r.envelope_microusd where id=true;
 update public.ai_guard_requests set state='closed',closed_at=clock_timestamp() where id=p_id;
 return 'cancelled';
end $$;
revoke all on function public.ai_guard_cancel_if_cached(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_cancel_if_cached(uuid,uuid) to service_role;
-- Emergency global stop; fixed non-identifying reason only. Does NOT settle or release reservations.
-- If this RPC fails/has an uncertain result, all app entrypoints must remain stopped independently.
create function public.ai_guard_disable(p_reason text)
returns text language plpgsql security definer set search_path = pg_catalog,public as $$
begin
 if p_reason is null or p_reason not in ('cost_overflow','usage_over_ceiling','pricing_error','provider_unknown') then return 'invalid_reason'; end if;
 update public.ai_guard_budget set enabled=false, disabled_reason=p_reason, disabled_at=clock_timestamp() where id=true;
 if not found then return 'unavailable'; end if;
 return 'disabled';
end $$;
-- Unknown provider outcome: one transaction stops future paid dispatch globally.
-- The started call and every reservation remain intact; never infer non-billing.
create function public.ai_guard_mark_unknown(p_id uuid,p_seq integer)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or not exists(
   select 1 from public.ai_guard_calls where request_id=p_id and seq=p_seq and state='started'
 ) then return 'unavailable'; end if;
 update public.ai_guard_budget set enabled=false,
   disabled_reason=coalesce(disabled_reason,'provider_unknown'),
   disabled_at=coalesce(disabled_at,clock_timestamp()) where id=true;
 return 'disabled_held';
end $$;
revoke all on function public.ai_guard_mark_unknown(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_mark_unknown(uuid,integer) to service_role;
-- If this RPC times out, the caller must NOT settle/close or continue locally.
-- Independent operational stop remains required until the DB stop is confirmed.
-- Result commit fence: service-only, p_actor is server-verified UUID, never a client claim.
-- No UPDATE: concurrent existing row wins; note legacy non-fenced writers must also be disabled/converted.
create function public.ai_guard_commit(p_id uuid,p_actor uuid,p_explanation text,p_option_analysis jsonb,p_memory_tip text)
returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz)
language plpgsql security definer set search_path = pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype;
        winner public.question_explanation_overrides%rowtype; inserted boolean := false;
begin
 -- Serialize against legacy row writers BEFORE budget lock to avoid tuple→budget inversion.
 lock table public.question_explanation_overrides in share row exclusive mode;
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
 insert into public.question_explanation_overrides as eo(question_id,explanation,option_analysis,memory_tip,model,updated_at)
 values(r.question_id,p_explanation,p_option_analysis,p_memory_tip,r.model,clock_timestamp())
 on conflict on constraint question_explanation_overrides_pkey do nothing returning eo.* into winner;
 inserted := found;
 if not inserted then
   select eo.* into winner from public.question_explanation_overrides eo where eo.question_id=r.question_id;
   if not found then return query select 'unavailable'::text,null::text,null::text,null::jsonb,null::text,null::text,null::timestamptz; return; end if;
 end if;
 update public.ai_guard_requests set result_committed=true where id=p_id;
 return query select case when inserted then 'inserted'::text else 'existing'::text end,
    winner.question_id,winner.explanation,winner.option_analysis,winner.memory_tip,winner.model,winner.updated_at;
end $$;
-- Shared transaction barrier on ALL override writes, including legacy service-role sync.
-- Reviewed IDs only; existing unreviewed edit flow remains. Legacy writers must be drained.
create function public.ai_guard_reviewed_write_barrier()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; v_gen bigint; old_id text; new_id text;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then raise exception 'review snapshot unavailable'; end if;
 select generation into v_gen from public.ai_guard_reviewed_state where id=true;
 if not found then raise exception 'review snapshot unavailable'; end if;
 if tg_op in ('UPDATE','DELETE') then old_id:=old.question_id; end if;
 if tg_op in ('UPDATE','INSERT') then new_id:=new.question_id; end if;
 if exists(select 1 from public.ai_guard_reviewed_questions where generation=v_gen and question_id in (old_id,new_id)) then
   raise exception 'reviewed explanation protected';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.ai_guard_reviewed_write_barrier() from public,anon,authenticated;
grant execute on function public.ai_guard_reviewed_write_barrier() to service_role;
-- Trigger is deliberately NOT created here: installation creates it atomically after the snapshot.
-- Only after a trusted deploy pipeline has independently verified that p_ids exactly
-- match the source_commit's reviewed manifest hash. SQL cannot attest that fact.
-- Drain ALL workers and old writers before calling; global model dispatch remains disabled.
create function public.ai_guard_install_reviewed_snapshot(p_sha text,p_commit text,p_ids text[])
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; next_generation bigint;
begin
 -- Writers acquire table RowExclusive before trigger budget lock. Match order to avoid inversion.
 lock table public.question_explanation_overrides in share row exclusive mode;
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or b.enabled or p_sha is null or p_sha !~ '^[0-9a-f]{64}$' or p_commit is null or p_commit !~ '^[0-9a-f]{40}$'
   or p_ids is null or array_ndims(p_ids)<>1 or cardinality(p_ids)=0 or cardinality(p_ids)>100000
   or encode(sha256(convert_to(array_to_json(p_ids)::text,'UTF8')),'hex') is distinct from p_sha
   or exists(select 1 from unnest(p_ids) x where x is null or length(x) not between 1 and 200 or x !~ '^[A-Za-z0-9:_-]+$')
   or p_ids is distinct from (select array_agg(x order by x collate "C") from unnest(p_ids) x)
   or (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids)
   or exists(select 1 from public.ai_guard_requests where state='active') then raise exception 'snapshot installation preconditions failed'; end if;
 select generation+1 into next_generation from public.ai_guard_reviewed_state where id=true;
 if not found then next_generation:=1; end if;
 delete from public.ai_guard_reviewed_questions;
 insert into public.ai_guard_reviewed_questions(question_id,generation) select x,next_generation from unnest(p_ids) x;
 insert into public.ai_guard_reviewed_state(id,generation,manifest_sha256,source_commit,installed_at)
 values(true,next_generation,p_sha,p_commit,clock_timestamp())
 on conflict(id) do update set generation=excluded.generation,manifest_sha256=excluded.manifest_sha256,source_commit=excluded.source_commit,installed_at=excluded.installed_at;
 -- CREATE TRIGGER and snapshot commit/rollback together; no period with a trigger and no snapshot.
 -- Owner-only installer requires table ownership; never call from untrusted app credentials.
 if exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.question_explanation_overrides'::regclass and t.tgname='ai_guard_reviewed_write_barrier' and not t.tgisinternal) then
   if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.question_explanation_overrides'::regclass and t.tgname='ai_guard_reviewed_write_barrier' and not t.tgisinternal and t.tgenabled='O' and t.tgtype=31 and t.tgfoid='public.ai_guard_reviewed_write_barrier()'::regprocedure) then
     raise exception 'unexpected reviewed trigger configuration';
   end if;
 else
   execute 'create trigger ai_guard_reviewed_write_barrier before insert or update or delete on public.question_explanation_overrides for each row execute function public.ai_guard_reviewed_write_barrier()';
 end if;
 return 'installed';
end $$;
-- Reconciliation requires disabled dispatch plus independently verified worker stop and
-- provider bill or provable non-dispatch. This SQL checks attestations, not their truth.
-- evidence_sha256 points to a protected external audit record; it must cover call+ticket.
create function public.ai_guard_reconcile(p_ticket uuid,p_request uuid,p_seq integer,p_operator uuid,
 p_resolution text,p_evidence_sha256 text,p_worker_stopped_at timestamptz,p_cost bigint,p_input bigint,p_output bigint)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype; c public.ai_guard_calls%rowtype; a public.ai_guard_reconcile_audit%rowtype; actual numeric;
begin
 if auth.uid() is null or p_operator is distinct from auth.uid() or not exists(select 1 from public.ai_guard_reconcile_operators ao where ao.operator_id=auth.uid() and ao.enabled) then raise exception 'reconciliation unauthorized'; end if;
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into a from public.ai_guard_reconcile_audit where ticket=p_ticket;
 if found then
  if a.request_id is distinct from p_request or a.seq is distinct from p_seq or a.operator_id is distinct from p_operator
    or a.resolution is distinct from p_resolution or a.evidence_sha256 is distinct from p_evidence_sha256
    or a.worker_stopped_at is distinct from p_worker_stopped_at or a.attested_cost_microusd is distinct from p_cost
    or a.attested_input_tokens is distinct from p_input or a.attested_output_tokens is distinct from p_output then return 'ticket_conflict'; end if;
  if exists(select 1 from public.ai_guard_requests where id=p_request and state='closed') then return 'already_reconciled'; end if;
  return 'already_recorded';
 end if;
 if b.enabled then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_request for update;
 if not found or r.state <> 'active' then return 'unavailable'; end if;
 select * into c from public.ai_guard_calls where request_id=p_request and seq=p_seq for update;
 if not found or c.state <> 'started' or p_ticket is null or p_operator is null
   or p_resolution is null or p_resolution not in ('provider_billed','proven_not_dispatched')
   or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$'
   or p_worker_stopped_at is null or p_worker_stopped_at<c.started_at or p_worker_stopped_at>clock_timestamp()
   or p_cost is null or p_cost<0 or (p_input is not null and p_input<0) or (p_output is not null and p_output<0)
   or (p_resolution='proven_not_dispatched' and (p_cost<>0 or p_input is distinct from 0 or p_output is distinct from 0))
   or exists(select 1 from public.ai_guard_reconcile_audit where ticket=p_ticket or (request_id=p_request and seq=p_seq)) then return 'unavailable'; end if;
 -- Compute the final charge and verify all numeric/accounting bounds BEFORE any writes.
 select coalesce(sum(cost_microusd),0)::numeric+p_cost into actual from public.ai_guard_calls where request_id=p_request and state='settled';
 if b.reserved_microusd<r.envelope_microusd then raise exception 'reservation accounting inconsistent'; end if;
 if actual>9223372036854775807::numeric-b.spent_microusd then raise exception 'cost overflow: global dispatch remains disabled'; end if;
 insert into public.ai_guard_reconcile_audit(ticket,request_id,seq,operator_id,resolution,evidence_sha256,worker_stopped_at,attested_cost_microusd,attested_input_tokens,attested_output_tokens)
 values(p_ticket,p_request,p_seq,p_operator,p_resolution,p_evidence_sha256,p_worker_stopped_at,p_cost,p_input,p_output);
 update public.ai_guard_calls set state='settled',cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output,settled_at=clock_timestamp()
 where request_id=p_request and seq=p_seq;
 if exists(select 1 from public.ai_guard_calls where request_id=p_request and state='started') then return 'recorded_still_held'; end if;
 update public.ai_guard_budget set reserved_microusd=reserved_microusd-r.envelope_microusd,
 spent_microusd=spent_microusd+actual::bigint,enabled=false,
 disabled_reason=case when actual>r.envelope_microusd then 'usage_over_ceiling' else disabled_reason end,
 disabled_at=case when actual>r.envelope_microusd then clock_timestamp() else disabled_at end where id=true;
 update public.ai_guard_requests set state='closed',closed_at=clock_timestamp() where id=p_request;
 return 'reconciled_closed';
end $$;
-- Orphan reserve before any start: only after independently proven no dispatch and worker stopped.
create function public.ai_guard_reconcile_unstarted(p_ticket uuid,p_request uuid,p_operator uuid,p_evidence_sha256 text,p_worker_stopped_at timestamptz)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype; a public.ai_guard_reconcile_audit%rowtype;
begin
 if auth.uid() is null or p_operator is distinct from auth.uid() or not exists(select 1 from public.ai_guard_reconcile_operators ao where ao.operator_id=auth.uid() and ao.enabled) then raise exception 'reconciliation unauthorized'; end if;
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into a from public.ai_guard_reconcile_audit where ticket=p_ticket;
 if found then
  if a.request_id is distinct from p_request or a.seq<>0 or a.operator_id is distinct from p_operator
    or a.resolution<>'proven_not_dispatched' or a.evidence_sha256 is distinct from p_evidence_sha256
    or a.worker_stopped_at is distinct from p_worker_stopped_at or a.attested_cost_microusd<>0 then return 'ticket_conflict'; end if;
  if exists(select 1 from public.ai_guard_requests where id=p_request and state='closed') then return 'already_reconciled'; end if;
  return 'already_recorded';
 end if;
 if b.enabled then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_request for update;
 if not found or r.state<>'active' or p_ticket is null or p_operator is null
   or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[0-9a-f]{64}$'
   or p_worker_stopped_at is null or p_worker_stopped_at<r.created_at or p_worker_stopped_at>clock_timestamp()
   or exists(select 1 from public.ai_guard_calls where request_id=p_request)
   or exists(select 1 from public.ai_guard_reconcile_audit where ticket=p_ticket or (request_id=p_request and seq=0))
   or b.reserved_microusd<r.envelope_microusd then return 'unavailable'; end if;
 insert into public.ai_guard_reconcile_audit(ticket,request_id,seq,operator_id,resolution,evidence_sha256,worker_stopped_at,attested_cost_microusd)
 values(p_ticket,p_request,0,p_operator,'proven_not_dispatched',p_evidence_sha256,p_worker_stopped_at,0);
 update public.ai_guard_budget set reserved_microusd=reserved_microusd-r.envelope_microusd where id=true;
 update public.ai_guard_requests set state='closed',closed_at=clock_timestamp() where id=p_request;
 return 'reconciled_closed';
end $$;
revoke all on function public.ai_guard_reconcile_unstarted(uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_reconcile_unstarted(uuid,uuid,uuid,text,timestamptz) to authenticated;
revoke all on function public.ai_guard_install_reviewed_snapshot(text,text,text[]) from public,anon,authenticated,service_role;
revoke all on function public.ai_guard_reconcile(uuid,uuid,integer,uuid,text,text,timestamptz,bigint,bigint,bigint) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_reconcile(uuid,uuid,integer,uuid,text,text,timestamptz,bigint,bigint,bigint) to authenticated;
revoke all on function public.ai_guard_reserve(uuid,uuid,text,text,text), public.ai_guard_start_call(uuid,integer), public.ai_guard_settle_call(uuid,integer,bigint,bigint,bigint), public.ai_guard_close(uuid), public.ai_guard_commit(uuid,uuid,text,jsonb,text), public.ai_guard_disable(text) from public,anon,authenticated;
grant execute on function public.ai_guard_reserve(uuid,uuid,text,text,text), public.ai_guard_start_call(uuid,integer), public.ai_guard_settle_call(uuid,integer,bigint,bigint,bigint), public.ai_guard_close(uuid), public.ai_guard_commit(uuid,uuid,text,jsonb,text), public.ai_guard_disable(text) to service_role;

-- Shared route policy and settled-response uncertainty, included inside this transaction.
-- REVIEW ONLY; requires guard v2, locked-down owner and exact installer/grant audit.
-- Empty policy table fails closed; prices and models must be verified before enabling.
create table public.ai_guard_route_policy (
  kind text primary key check (kind in ('custom_search','classification','owner_neuro')),
  enabled boolean not null default false,
  model text not null check (length(model) between 1 and 100),
  pricing_revision text not null check (length(pricing_revision) between 1 and 100),
  call_limit integer not null check (call_limit between 1 and 2),
  per_call_ceiling_microusd bigint not null check (per_call_ceiling_microusd>0),
  envelope_microusd bigint not null check (envelope_microusd>0),
  check (per_call_ceiling_microusd::numeric * call_limit <= envelope_microusd)
);
alter table public.ai_guard_route_policy enable row level security;
revoke all on public.ai_guard_route_policy from public,anon,authenticated,service_role;
alter table public.ai_guard_requests add column action_kind text not null default 'explanation'
  check (action_kind in ('explanation','custom_search','classification','owner_neuro'));
-- Action identity is computed server-side from normalized request and verified actor;
-- service_role is trusted only after real auth.getUser and route-specific authorization.
create function public.ai_guard_reserve_route(p_id uuid,p_actor uuid,p_kind text,p_action_hash text)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; p public.ai_guard_route_policy%rowtype;
        n timestamptz := clock_timestamp(); action_key text;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or not b.enabled or b.verified_credit_expires_at is null or b.verified_credit_expires_at<=n
    or b.cap_microusd is null or b.max_parallel is null or b.max_actor_parallel is null
    or b.cooldown_seconds is null or b.hourly_limit is null or b.daily_limit is null
    or p_id is null or p_actor is null or p_kind not in ('custom_search','classification','owner_neuro')
    or p_action_hash is null or p_action_hash !~ '^[0-9a-f]{64}$' then return 'unavailable'; end if;
 select * into p from public.ai_guard_route_policy where kind=p_kind;
 if not found or not p.enabled then return 'unavailable'; end if;
 action_key := p_kind || ':' || p_actor::text || ':' || p_action_hash;
 if exists(select 1 from public.ai_guard_requests where id=p_id) then return 'duplicate'; end if;
 if b.spent_microusd::numeric+b.reserved_microusd::numeric+p.envelope_microusd > b.cap_microusd then return 'budget'; end if;
 if exists(select 1 from public.ai_guard_requests where question_id=action_key and state='active') then return 'action_busy'; end if;
 if (select count(*) from public.ai_guard_requests where state='active')>=b.max_parallel then return 'busy'; end if;
 if (select count(*) from public.ai_guard_requests where state='active' and actor_id=p_actor)>=b.max_actor_parallel then return 'actor_busy'; end if;
 if exists(select 1 from public.ai_guard_requests where actor_id=p_actor and created_at>n-make_interval(secs=>b.cooldown_seconds)) then return 'cooldown'; end if;
 if (select count(*) from public.ai_guard_requests where actor_id=p_actor and created_at>n-interval '1 hour')>=b.hourly_limit
 or (select count(*) from public.ai_guard_requests where actor_id=p_actor and created_at>n-interval '24 hours')>=b.daily_limit then return 'rate'; end if;
 insert into public.ai_guard_requests(id,actor_id,question_id,action_kind,envelope_microusd,call_limit,per_call_ceiling_microusd,model,pricing_revision,reviewed_generation)
 values(p_id,p_actor,action_key,p_kind,p.envelope_microusd,p.call_limit,p.per_call_ceiling_microusd,p.model,p.pricing_revision,0);
 update public.ai_guard_budget set reserved_microusd=reserved_microusd+p.envelope_microusd where id=true;
 return 'reserved';
end $$;
create function public.ai_guard_start_route(p_id uuid,p_seq integer)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype; p public.ai_guard_route_policy%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or not b.enabled or b.verified_credit_expires_at is null or b.verified_credit_expires_at<=clock_timestamp() then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state<>'active' or r.result_committed or r.action_kind='explanation' or p_seq is null or p_seq<1 or p_seq>r.call_limit then return 'unavailable'; end if;
 select * into p from public.ai_guard_route_policy where kind=r.action_kind;
 if not found or not p.enabled or p.model is distinct from r.model or p.pricing_revision is distinct from r.pricing_revision
    or p.envelope_microusd<>r.envelope_microusd or p.call_limit<>r.call_limit or p.per_call_ceiling_microusd<>r.per_call_ceiling_microusd
    or b.cap_microusd is null or b.spent_microusd::numeric+b.reserved_microusd::numeric>b.cap_microusd then return 'unavailable'; end if;
 if exists(select 1 from public.ai_guard_calls where request_id=p_id and (state='started' or seq=p_seq))
 or p_seq<>(select count(*)+1 from public.ai_guard_calls where request_id=p_id) then return 'blocked'; end if;
 if (select coalesce(sum(cost_microusd),0) from public.ai_guard_calls where request_id=p_id)+r.per_call_ceiling_microusd>r.envelope_microusd then return 'budget'; end if;
 insert into public.ai_guard_calls(request_id,seq,state) values(p_id,p_seq,'started'); return 'started';
end $$;
revoke all on function public.ai_guard_reserve_route(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.ai_guard_start_route(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_reserve_route(uuid,uuid,text,text) to service_role;
grant execute on function public.ai_guard_start_route(uuid,integer) to service_role;

-- Isolated test candidate only. Existing service-role grant/owner must be retained and rechecked.
-- Also stop when settlement committed but its RPC response was lost; retain reservation.
create or replace function public.ai_guard_mark_unknown(p_id uuid,p_seq integer)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; r public.ai_guard_requests%rowtype;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return 'unavailable'; end if;
 select * into r from public.ai_guard_requests where id=p_id for update;
 if not found or r.state <> 'active' or not exists(
   select 1 from public.ai_guard_calls where request_id=p_id and seq=p_seq and state in ('started','settled')
 ) then return 'unavailable'; end if;
 update public.ai_guard_budget set enabled=false,
   disabled_reason=coalesce(disabled_reason,'provider_unknown'),
   disabled_at=coalesce(disabled_at,clock_timestamp()) where id=true;
 return 'disabled_held';
end $$;

-- Candidate only: actor must be verified by server; no changes to existing rows.
create function public.ai_guard_sync_batch(p_actor uuid,p_rows jsonb)
returns table(status text,inserted integer,unchanged integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_guard_budget%rowtype; v_generation bigint; item jsonb; q text; seen text[]:=ARRAY[]::text[]; oldrow public.question_explanation_overrides%rowtype; n int:=0; same int:=0;
begin
 if p_actor is null or p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>50 then return query select 'invalid'::text,0,0; return; end if;
 lock table public.question_explanation_overrides in share row exclusive mode;
 select * into b from public.ai_guard_budget where id=true for update;
 if not found then return query select 'snapshot_unavailable'::text,0,0; return; end if;
 select generation into v_generation from public.ai_guard_reviewed_state where id=true;
 if not found then return query select 'snapshot_unavailable'::text,0,0; return; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  q:=item->>'question_id';
  if jsonb_typeof(item)<>'object' or q is null or length(q) not between 1 and 200 or q<>btrim(q)
    or q ~ '[[:cntrl:]]' or q=any(seen)
    or jsonb_typeof(item->'explanation') is distinct from 'string' or length(btrim(item->>'explanation'))=0 or octet_length(item->>'explanation')>32000
    or jsonb_typeof(item->'option_analysis') is distinct from 'object' or octet_length((item->'option_analysis')::text)>32000
    or jsonb_typeof(item->'memory_tip') is distinct from 'string' or octet_length(item->>'memory_tip')>4000
    or jsonb_typeof(item->'model') is distinct from 'string' or length(item->>'model')>100 then return query select 'invalid'::text,0,0; return; end if;
  seen:=array_append(seen,q);
  if exists(select 1 from public.ai_guard_reviewed_questions where generation=v_generation and question_id=q) then return query select 'reviewed_protected'::text,0,0; return; end if;
  select * into oldrow from public.question_explanation_overrides where question_id=q;
  if found then
   if oldrow.explanation is distinct from item->>'explanation' or coalesce(oldrow.option_analysis,'{}'::jsonb) is distinct from item->'option_analysis'
    or coalesce(oldrow.memory_tip,'') is distinct from item->>'memory_tip' or coalesce(oldrow.model,'') is distinct from item->>'model' then
     return query select 'existing_conflict'::text,0,0; return;
   end if;
   same:=same+1;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(p_rows) loop
  insert into public.question_explanation_overrides(question_id,explanation,option_analysis,memory_tip,model,updated_at)
  values(item->>'question_id',item->>'explanation',item->'option_analysis',item->>'memory_tip',item->>'model',clock_timestamp())
  on conflict(question_id) do nothing;
  if found then n:=n+1; end if;
 end loop;
 return query select 'ok'::text,n,same;
end $$;
revoke all on function public.ai_guard_sync_batch(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ai_guard_sync_batch(uuid,jsonb) to service_role;

-- Candidate: historical pilot liability is distinct from runtime requests/calls.
alter table public.ai_guard_budget add column verified_grant_microusd bigint check (verified_grant_microusd >= 0);
alter table public.ai_guard_budget add column budget_phase text not null default 'first_batch' check(budget_phase in ('first_batch','ongoing'));
alter table public.ai_guard_budget add column batch_review_evidence_sha256 text check(batch_review_evidence_sha256 is null or batch_review_evidence_sha256 ~ '^[0-9a-f]{64}$');
create table public.ai_guard_legacy_liability (
 id boolean primary key default true check(id),
 status text not null check(status='external_unknown'),
 question_id text not null check(question_id='MOEX-107100-1301-Q066'),
 prior_total_microusd bigint not null check(prior_total_microusd=6345230),
 original_unknown_microusd bigint not null check(original_unknown_microusd=124505),
 expanded_unknown_microusd bigint not null check(expanded_unknown_microusd=821733),
 total_microusd bigint not null check(total_microusd=prior_total_microusd-original_unknown_microusd+expanded_unknown_microusd),
 original_ledger_sha256 text not null check(original_ledger_sha256='ffaf137f97ceb71b7c138d3298f0a92cfce34de74f4db52dd098d0d3944c9e1c'),
 prior_snapshot_sha256 text not null check(prior_snapshot_sha256='54f8c051d9b4a5baa10a6ad56ce5104b30ad2fc5d13b714ade3c1bee2d4d50e1'),
 acceptance_evidence_sha256 text not null check(acceptance_evidence_sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.ai_guard_legacy_liability enable row level security;
revoke all on public.ai_guard_legacy_liability from public,anon,authenticated,service_role;

-- SOURCE: owner-install-candidate.sql (outer transaction wrapper removed)
-- CANDIDATE ONLY. Requires specific production role/grant approval.
-- Apply after reservation-candidate.sql while all new generation is stopped.
-- Must be part of the same reviewed installation transaction in production.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_guard_owner') THEN
  RAISE EXCEPTION 'ai_guard_owner exists: inspect ownership and membership before installation';
 END IF;
 CREATE ROLE ai_guard_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
END $$;
-- Check inherited/PUBLIC schema CREATE before any temporary direct grant.
-- A failure rolls the entire candidate transaction back, including the new role.
DO $$
BEGIN
 IF has_schema_privilege('ai_guard_owner','public','CREATE') THEN
  RAISE EXCEPTION 'unsafe effective schema CREATE: inspect PUBLIC grants; separate approval required for narrowly scoped schema privilege adjustment';
 END IF;
END $$;
-- No app, authenticated, service_role or login account receives membership.
GRANT USAGE, CREATE ON SCHEMA public TO ai_guard_owner;
GRANT USAGE ON SCHEMA auth TO ai_guard_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO ai_guard_owner;
DO $$
DECLARE n text; sig text;
BEGIN
 FOREACH n IN ARRAY ARRAY['ai_guard_budget','ai_guard_requests','ai_guard_calls','ai_guard_reviewed_state','ai_guard_reviewed_questions','ai_guard_reconcile_audit','ai_guard_reconcile_operators','ai_guard_route_policy','ai_guard_legacy_liability'] LOOP
  EXECUTE format('ALTER TABLE public.%I OWNER TO ai_guard_owner',n);
 END LOOP;
 FOREACH sig IN ARRAY ARRAY[
  'public.ai_guard_sync_batch(uuid,jsonb)',
  'public.ai_guard_reserve_route(uuid,uuid,text,text)',
  'public.ai_guard_start_route(uuid,integer)',
  'public.ai_guard_reserve(uuid,uuid,text,text,text)',
  'public.ai_guard_read_reservation(uuid,uuid)',
  'public.ai_guard_start_call(uuid,integer)',
  'public.ai_guard_settle_call(uuid,integer,bigint,bigint,bigint)',
  'public.ai_guard_close(uuid)',
  'public.ai_guard_cancel_if_cached(uuid,uuid)',
  'public.ai_guard_disable(text)',
  'public.ai_guard_mark_unknown(uuid,integer)',
  'public.ai_guard_commit(uuid,uuid,text,jsonb,text)',
  'public.ai_guard_reviewed_write_barrier()',
  'public.ai_guard_install_reviewed_snapshot(text,text,text[])',
  'public.ai_guard_reconcile(uuid,uuid,integer,uuid,text,text,timestamptz,bigint,bigint,bigint)',
  'public.ai_guard_reconcile_unstarted(uuid,uuid,uuid,text,timestamptz)'
 ] LOOP
  IF to_regprocedure(sig) IS NULL THEN RAISE EXCEPTION 'missing exact guard function: %',sig; END IF;
  EXECUTE format('ALTER FUNCTION %s OWNER TO ai_guard_owner',to_regprocedure(sig));
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
DO $$
BEGIN
 IF has_schema_privilege('ai_guard_owner','public','CREATE') THEN
  RAISE EXCEPTION 'owner retains effective schema CREATE; candidate installation aborted';
 END IF;
END $$;
-- Only runtime operations required by commit/cache lookup. Never grant UPDATE,
-- DELETE, TRUNCATE or table ownership of existing explanations to this role.
GRANT SELECT, MAINTAIN ON public.question_explanation_overrides TO ai_guard_owner;
-- PostgreSQL 17 MAINTAIN is the narrowest non-DML table privilege that permits
-- SHARE ROW EXCLUSIVE locks used by the existing commit/cache fences.
-- No exposed function issues VACUUM/CLUSTER/REINDEX or arbitrary SQL.
GRANT INSERT(question_id,explanation,option_analysis,memory_tip,model,updated_at)
 ON public.question_explanation_overrides TO ai_guard_owner;
CREATE POLICY ai_guard_owner_read_overrides ON public.question_explanation_overrides
 FOR SELECT TO ai_guard_owner USING (true);
CREATE POLICY ai_guard_owner_insert_overrides ON public.question_explanation_overrides
 FOR INSERT TO ai_guard_owner WITH CHECK (true);
-- NOLOGIN and absent membership make these policies reachable only through
-- reviewed SECURITY DEFINER functions. Existing reviewed-write trigger remains.
-- Snapshot installation remains SECURITY INVOKER and has no app EXECUTE grant;
-- the approved migration operator installs the trigger under existing privileges.

COMMIT;
