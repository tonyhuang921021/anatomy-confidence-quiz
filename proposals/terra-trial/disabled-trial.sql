-- Candidate only. Separate owner-only trial; never enables the global AI guard.
begin;
create table public.terra_five_trial_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 expires_at timestamptz, calls integer not null default 0 check(calls between 0 and 5),
 held_ceiling_microusd integer not null default 0 check(held_ceiling_microusd between 0 and 500000),
 stop_reason text
);
insert into public.terra_five_trial_config(id) values(true);
create table public.terra_five_trial_items (
 question_id text primary key check(question_id in ('MOEX-111020-1301-Q010','MOEX-C217-093030-S4001-STAGE1-Q019','MOEX-097140-1101-Q028','MOEX-097140-1101-Q004','MOEX-108100-1301-Q018')),
 attempt_id uuid not null unique, actor_id uuid not null,
 state text not null check(state in ('started','unknown','invalid_output','complete')),
 payload jsonb, usage jsonb, provider jsonb,
 created_at timestamptz not null default clock_timestamp(),finished_at timestamptz,
 check(payload is null or (jsonb_typeof(payload)='object' and octet_length(payload::text)<=80000)),
 check(usage is null or octet_length(usage::text)<=1024),check(provider is null or octet_length(provider::text)<=1024)
);
alter table public.terra_five_trial_config enable row level security;
alter table public.terra_five_trial_items enable row level security;
revoke all on public.terra_five_trial_config,public.terra_five_trial_items from public,anon,authenticated;
grant select,update on public.terra_five_trial_config to service_role;
grant select,insert,update on public.terra_five_trial_items to service_role;
create function public.terra_five_trial_begin(p_question text,p_attempt uuid,p_actor uuid) returns text
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cfg public.terra_five_trial_config%rowtype;
begin
 select * into cfg from public.terra_five_trial_config where id=true for update;
 if not found or not cfg.enabled or cfg.expires_at is null or cfg.expires_at<=clock_timestamp() or cfg.calls>=5 or cfg.held_ceiling_microusd+100000>500000 then return 'disabled';end if;
 if p_actor is null or p_attempt is null or p_question is null or p_question not in ('MOEX-111020-1301-Q010','MOEX-C217-093030-S4001-STAGE1-Q019','MOEX-097140-1101-Q028','MOEX-097140-1101-Q004','MOEX-108100-1301-Q018') then return 'invalid';end if;
 if exists(select 1 from public.terra_five_trial_items where question_id=p_question) then return 'already_attempted';end if;
 if exists(select 1 from public.question_explanation_overrides where question_id=p_question) then return 'existing_explanation';end if;
 -- One call at a time; no queue dispatch and no automatic retry of hung calls.
 if exists(select 1 from public.terra_five_trial_items where state='started') then return 'busy';end if;
 insert into public.terra_five_trial_items(question_id,attempt_id,actor_id,state) values(p_question,p_attempt,p_actor,'started');
 update public.terra_five_trial_config set calls=calls+1,held_ceiling_microusd=held_ceiling_microusd+100000,enabled=(calls+1<5),stop_reason=case when calls+1=5 then 'five_calls_started' else null end where id=true;
 return 'started';
end $$;
create function public.terra_five_trial_finish(p_question text,p_attempt uuid,p_actor uuid,p_status text,p_payload jsonb,p_usage jsonb,p_provider jsonb) returns text
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if p_status is null or p_status not in ('complete','invalid_output') or (p_status='complete' and (p_payload is null or p_payload->>'model' is distinct from 'gpt-6.1-terra' or length(coalesce(p_payload->>'explanation',''))=0)) then return 'invalid';end if;
 if jsonb_typeof(p_usage->'inputTokens') is distinct from 'number' or jsonb_typeof(p_usage->'outputTokens') is distinct from 'number' or (p_usage->>'inputTokens')::numeric not between 0 and 16000 or (p_usage->>'outputTokens')::numeric not between 0 and 2400 then return 'invalid_usage';end if;
 update public.terra_five_trial_items set state=p_status,payload=p_payload,usage=p_usage,provider=p_provider,finished_at=clock_timestamp() where question_id=p_question and attempt_id=p_attempt and actor_id=p_actor and state='started';
 if not found then return 'stale';end if;
 return p_status;
end $$;
create function public.terra_five_trial_unknown(p_question text,p_attempt uuid,p_actor uuid) returns text
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 update public.terra_five_trial_config set enabled=false,stop_reason='unknown_outcome' where id=true;
 update public.terra_five_trial_items set state='unknown' where question_id=p_question and attempt_id=p_attempt and actor_id=p_actor and state='started';
 return 'stopped';
end $$;
revoke all on function public.terra_five_trial_begin(text,uuid,uuid),public.terra_five_trial_finish(text,uuid,uuid,text,jsonb,jsonb,jsonb),public.terra_five_trial_unknown(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.terra_five_trial_begin(text,uuid,uuid),public.terra_five_trial_finish(text,uuid,uuid,text,jsonb,jsonb,jsonb),public.terra_five_trial_unknown(text,uuid,uuid) to service_role;
commit;
