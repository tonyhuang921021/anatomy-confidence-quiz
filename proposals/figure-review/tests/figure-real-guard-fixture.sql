create table public.question_explanation_overrides (question_id text primary key,explanation text not null,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz);
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
