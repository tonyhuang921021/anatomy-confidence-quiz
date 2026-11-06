-- Persist a validated model completion atomically with its existing money settlement.
-- No budget/window reset, no provider retries, no direct service table grants.
begin;
select 1 from undercover_runtime_v2.control where singleton for update;
do $$begin if exists(select 1 from undercover_runtime_v2.steps where state in('reserved','sent','unknown')) then raise exception 'DELIVERY_INSTALL_REQUIRES_SETTLED_MONEY'; end if; end$$;
alter table undercover_runtime_v2.steps add column confirmed_result jsonb check(confirmed_result is null or (jsonb_typeof(confirmed_result)='object' and octet_length(confirmed_result::text)<=1024));
create function undercover_runtime_v2.settle_result(p_id text,p_outcome text,p_input integer,p_output integer,p_model text,p_result jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j undercover_runtime_v2.steps%rowtype; result jsonb; n integer;
begin
 if p_outcome is distinct from 'success' or jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>1024 then raise exception 'RESULT_INVALID'; end if;
 select count(*) into n from jsonb_object_keys(p_result);
 if n<>1 or not ((jsonb_typeof(p_result->'text')='string' and length(p_result->>'text') between 1 and 200) or (jsonb_typeof(p_result->'target')='string' and length(p_result->>'target') between 1 and 64)) then raise exception 'RESULT_INVALID'; end if;
 perform 1 from undercover_runtime_v2.control where singleton for update;
 select * into strict j from undercover_runtime_v2.steps where request_id=p_id for update;
 if j.state in('success','unknown') then return jsonb_build_object('state',j.state); end if;
 result=undercover_runtime_v2.settle(p_id,p_outcome,p_input,p_output,p_model);
 if result->>'state'='success' then update undercover_runtime_v2.steps set confirmed_result=p_result where request_id=p_id and confirmed_result is null; end if;
 return result;
end$$;
create function public.undercover_v2_settle_result(p_id text,p_outcome text,p_input integer,p_output integer,p_model text,p_result jsonb) returns jsonb
language sql security invoker set search_path=pg_catalog as $$select undercover_runtime_v2.settle_result(p_id,p_outcome,p_input,p_output,p_model,p_result)$$;
revoke all on function undercover_runtime_v2.settle_result(text,text,integer,integer,text,jsonb),public.undercover_v2_settle_result(text,text,integer,integer,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function undercover_runtime_v2.settle_result(text,text,integer,integer,text,jsonb),public.undercover_v2_settle_result(text,text,integer,integer,text,jsonb) to service_role;
create or replace function undercover_runtime_v2.snapshot() returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('revision',c.revision,'versions',coalesce((select jsonb_object_agg(code,version) from undercover_runtime_v2.rooms),'{}'),
 'payload',c.payload||jsonb_build_object('rooms',coalesce((select jsonb_object_agg(code,payload) from undercover_runtime_v2.rooms),'{}')),
 'confirmedResults',coalesce((select jsonb_object_agg(s.request_id,s.confirmed_result) from undercover_runtime_v2.steps s where s.state='success' and s.confirmed_result is not null and exists(select 1 from undercover_runtime_v2.rooms r where r.payload->'jobs'->s.request_id->>'status'='running')),'{}'))
 from undercover_runtime_v2.control c where singleton
$$;
-- Owner-only append-only record for separately approved, evidence-based reconciliation.
-- Installing this table does NOT clear any pause or change any historical job/ledger.
create table undercover_runtime_v2.delivery_reconciliations(
 request_id text primary key references undercover_runtime_v2.steps(request_id),
 original_job jsonb not null, ledger_state text not null check(ledger_state='success'),
 disposition text not null check(disposition='confirmed_paid_output_not_preserved'),
 reason text not null check(length(reason) between 1 and 500),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table undercover_runtime_v2.delivery_reconciliations enable row level security;
revoke all on undercover_runtime_v2.delivery_reconciliations from public,anon,authenticated,service_role;
create function undercover_runtime_v2.prevent_delivery_audit_mutation() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'DELIVERY_AUDIT_APPEND_ONLY'; end$$;
revoke all on function undercover_runtime_v2.prevent_delivery_audit_mutation() from public,anon,authenticated,service_role;
create trigger delivery_audit_append_only before update or delete on undercover_runtime_v2.delivery_reconciliations for each row execute function undercover_runtime_v2.prevent_delivery_audit_mutation();
commit;
