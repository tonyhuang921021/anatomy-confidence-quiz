-- ISOLATED CANDIDATE ONLY. No production installation. No key or enabling config.
-- Private definer routines are intentional server-only gates; public wrappers are
-- invokers with explicit service_role-only EXECUTE. No direct table grants.
begin;
create schema undercover_runtime_v2;
revoke all on schema undercover_runtime_v2 from public,anon,authenticated,service_role;
create table undercover_runtime_v2.control(
 singleton boolean primary key default true check(singleton), revision bigint not null default 0,
 payload jsonb not null default '{"schema":1,"creates":{},"aiReserved":0,"aiUnknown":0,"aiPaused":false}',
 enabled boolean not null default false, paused boolean not null default false,
 model text not null default 'gpt-6.1-terra', pricing_revision text not null default 'terra-standard-conservative-20261106',
 cap_micro bigint not null default 0 check(cap_micro>=0), spent_micro bigint not null default 0 check(spent_micro>=0),
 reserved_micro bigint not null default 0 check(reserved_micro>=0), unknown_micro bigint not null default 0 check(unknown_micro>=0 and unknown_micro<=reserved_micro),
 calls_used integer not null default 0 check(calls_used>=0),
 valid_until timestamptz, check(spent_micro+reserved_micro<=cap_micro)
);
insert into undercover_runtime_v2.control(singleton) values(true);
create table undercover_runtime_v2.rooms(
 code text primary key check(code ~ '^[A-Z2-9]{6}$'), version bigint not null default 1,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=210000),
 updated_at timestamptz not null default clock_timestamp()
);
create table undercover_runtime_v2.steps(
 request_id text primary key check(length(request_id) between 10 and 200), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 state text not null check(state in('reserved','sent','success','unknown')),
 reservation_micro bigint not null check(reservation_micro=48768), usage_ceiling_micro bigint,
 input_tokens integer, output_tokens integer, created_at timestamptz not null default clock_timestamp(), lease_until timestamptz not null
);
alter table undercover_runtime_v2.control enable row level security;
alter table undercover_runtime_v2.rooms enable row level security;
alter table undercover_runtime_v2.steps enable row level security;
revoke all on all tables in schema undercover_runtime_v2 from public,anon,authenticated,service_role;

create function undercover_runtime_v2.snapshot() returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('revision',c.revision,'versions',coalesce((select jsonb_object_agg(code,version) from undercover_runtime_v2.rooms),'{}'),
 'payload',c.payload||jsonb_build_object('rooms',coalesce((select jsonb_object_agg(code,payload) from undercover_runtime_v2.rooms),'{}')))
 from undercover_runtime_v2.control c where singleton
$$;
create function undercover_runtime_v2.commit(p_expected bigint,p_versions jsonb,p_changes jsonb,p_meta jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare c undercover_runtime_v2.control%rowtype; current_versions jsonb; item record; n integer;
begin
 select * into strict c from undercover_runtime_v2.control where singleton for update;
 select coalesce(jsonb_object_agg(code,version),'{}') into current_versions from undercover_runtime_v2.rooms;
 if c.revision<>p_expected or current_versions is distinct from p_versions then return jsonb_build_object('applied',false); end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or jsonb_typeof(p_meta) is distinct from 'object'
 or not(p_meta ?& array['schema','creates','aiReserved','aiUnknown','aiPaused']) or p_meta ? 'rooms'
 or p_meta->>'schema' is distinct from '1' or jsonb_typeof(p_meta->'creates') is distinct from 'object'
 or jsonb_typeof(p_meta->'aiReserved') is distinct from 'number' or jsonb_typeof(p_meta->'aiUnknown') is distinct from 'number'
 or coalesce(p_meta->>'aiReserved','') !~ '^[0-9]+$' or coalesce(p_meta->>'aiUnknown','') !~ '^[0-9]+$'
 or jsonb_typeof(p_meta->'aiPaused') is distinct from 'boolean' or octet_length(p_meta::text)>65536 then raise exception 'STATE_INVALID'; end if;
 if (p_meta->>'aiReserved')::bigint<(c.payload->>'aiReserved')::bigint
 or (p_meta->>'aiUnknown')::bigint<(c.payload->>'aiUnknown')::bigint or (p_meta->>'aiUnknown')::bigint>(p_meta->>'aiReserved')::bigint
 or ((c.payload->>'aiPaused')::boolean and not(p_meta->>'aiPaused')::boolean) then raise exception 'GUARD_CANNOT_RESET'; end if;
 for item in select key,value from jsonb_each(p_changes) loop
  if item.key !~ '^[A-Z2-9]{6}$' then raise exception 'ROOM_CODE_INVALID'; end if;
  if item.value='null'::jsonb then delete from undercover_runtime_v2.rooms where code=item.key;
  else
   if jsonb_typeof(item.value) is distinct from 'object' or item.value->>'protocol' is distinct from '3' or item.value->>'code' is distinct from item.key then raise exception 'ROOM_INVALID'; end if;
   insert into undercover_runtime_v2.rooms(code,payload) values(item.key,item.value)
   on conflict(code) do update set payload=excluded.payload,version=undercover_runtime_v2.rooms.version+1,updated_at=clock_timestamp();
  end if;
 end loop;
 select count(*) into n from undercover_runtime_v2.rooms;
 if n>2 then raise exception 'PREVIEW_ROOM_CAP'; end if;
 update undercover_runtime_v2.control set payload=p_meta,revision=revision+1 where singleton;
 return jsonb_build_object('applied',true);
end$$;
create function undercover_runtime_v2.budget_status() returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('enabled',enabled,'paused',paused,'model',model,'pricingRevision',pricing_revision,'capMicro',cap_micro,
 'spentCeilingMicro',spent_micro,'reservedMicro',reserved_micro,'unknownMicro',unknown_micro,'callsUsed',calls_used,'until',valid_until)
 from undercover_runtime_v2.control where singleton
$$;
create function undercover_runtime_v2.reserve(p_id text,p_fingerprint text,p_model text,p_pricing text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare c undercover_runtime_v2.control%rowtype; j undercover_runtime_v2.steps%rowtype; lost bigint; amount bigint; cnt integer;
begin
 select * into strict c from undercover_runtime_v2.control where singleton for update;
 -- A stale lease is uncertain, not permission to dispatch the same step again.
 select count(*),coalesce(sum(reservation_micro),0) into cnt,amount from undercover_runtime_v2.steps where state in('reserved','sent') and lease_until<clock_timestamp();
 if cnt>0 then
  update undercover_runtime_v2.steps set state='unknown' where state in('reserved','sent') and lease_until<clock_timestamp();
  update undercover_runtime_v2.control set paused=true,unknown_micro=unknown_micro+amount,
   payload=jsonb_set(payload,'{aiPaused}','true'),revision=revision+1 where singleton;
  return jsonb_build_object('fresh',false,'reason','unknown');
 end if;
 select * into j from undercover_runtime_v2.steps where request_id=p_id;
 if found then
  if j.fingerprint<>p_fingerprint then raise exception 'STEP_CONFLICT'; end if;
  return jsonb_build_object('fresh',false,'state',j.state);
 end if;
 if not c.enabled or c.paused or c.valid_until is null or c.valid_until<=clock_timestamp() or c.model is distinct from p_model or c.pricing_revision is distinct from p_pricing
 or c.spent_micro+c.reserved_micro+48768>c.cap_micro then return jsonb_build_object('fresh',false,'reason','guard'); end if;
 if exists(select 1 from undercover_runtime_v2.steps where state in('reserved','sent')) then return jsonb_build_object('fresh',false,'reason','busy'); end if;
 insert into undercover_runtime_v2.steps(request_id,fingerprint,state,reservation_micro,lease_until) values(p_id,p_fingerprint,'reserved',48768,clock_timestamp()+interval '20 seconds');
 update undercover_runtime_v2.control set calls_used=calls_used+1,reserved_micro=reserved_micro+48768 where singleton;
 return jsonb_build_object('fresh',true,'reservationMicro',48768,'until',c.valid_until);
end$$;
create function undercover_runtime_v2.mark_sent(p_id text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c undercover_runtime_v2.control%rowtype; changed boolean;
begin
 select * into strict c from undercover_runtime_v2.control where singleton for update;
 if not c.enabled or c.paused or c.valid_until is null or c.valid_until<=clock_timestamp() then return jsonb_build_object('sent',false); end if;
 update undercover_runtime_v2.steps set state='sent' where request_id=p_id and state='reserved' and lease_until>clock_timestamp();
 changed=found;return jsonb_build_object('sent',changed,'until',c.valid_until);
end$$;
create function undercover_runtime_v2.settle(p_id text,p_outcome text,p_input integer,p_output integer,p_model text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j undercover_runtime_v2.steps%rowtype; amount bigint;
begin
 perform 1 from undercover_runtime_v2.control where singleton for update;
 select * into strict j from undercover_runtime_v2.steps where request_id=p_id for update;
 if j.state in('success','unknown') then return jsonb_build_object('state',j.state); end if;
 if p_outcome='success' and j.state='sent' and p_model='gpt-6.1-terra' and p_input between 0 and 16000 and p_output between 0 and 128 then
  -- Conservative accounting ceiling, not an invoice: 3 micro/input + 6 micro/output.
  amount=p_input::bigint*3+p_output::bigint*6;
  update undercover_runtime_v2.steps set state='success',input_tokens=p_input,output_tokens=p_output,usage_ceiling_micro=amount where request_id=p_id;
  update undercover_runtime_v2.control set reserved_micro=reserved_micro-j.reservation_micro,spent_micro=spent_micro+amount where singleton;
  return jsonb_build_object('state','success','usageCeilingMicro',amount);
 end if;
 update undercover_runtime_v2.steps set state='unknown' where request_id=p_id;
 update undercover_runtime_v2.control set paused=true,unknown_micro=unknown_micro+j.reservation_micro,
  payload=jsonb_set(payload,'{aiPaused}','true'),revision=revision+1 where singleton;
 return jsonb_build_object('state','unknown');
end$$;
-- Thin invoker wrappers; no private tables or functions are public API grants.
create function public.undercover_v2_snapshot() returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.snapshot()$$;
create function public.undercover_v2_commit(p_expected bigint,p_versions jsonb,p_changes jsonb,p_meta jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.commit(p_expected,p_versions,p_changes,p_meta)$$;
create function public.undercover_v2_budget_status() returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.budget_status()$$;
create function public.undercover_v2_reserve(p_id text,p_fingerprint text,p_model text,p_pricing text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.reserve(p_id,p_fingerprint,p_model,p_pricing)$$;
create function public.undercover_v2_mark_sent(p_id text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.mark_sent(p_id)$$;
create function public.undercover_v2_settle(p_id text,p_outcome text,p_input integer,p_output integer,p_model text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.settle(p_id,p_outcome,p_input,p_output,p_model)$$;
revoke all on all functions in schema undercover_runtime_v2 from public,anon,authenticated,service_role;
grant usage on schema undercover_runtime_v2 to service_role;
grant execute on all functions in schema undercover_runtime_v2 to service_role;
revoke all on function public.undercover_v2_snapshot(),public.undercover_v2_commit(bigint,jsonb,jsonb,jsonb),public.undercover_v2_budget_status(),public.undercover_v2_reserve(text,text,text,text),public.undercover_v2_mark_sent(text),public.undercover_v2_settle(text,text,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.undercover_v2_snapshot(),public.undercover_v2_commit(bigint,jsonb,jsonb,jsonb),public.undercover_v2_budget_status(),public.undercover_v2_reserve(text,text,text,text),public.undercover_v2_mark_sent(text),public.undercover_v2_settle(text,text,integer,integer,text) to service_role;
commit;
-- Owner-only approved configuration is intentionally NOT included. Defaults cap=0,
-- enabled=false. No independent call-count cap; calls_used is observational. No API key is stored in SQL. Never auto-enable.
