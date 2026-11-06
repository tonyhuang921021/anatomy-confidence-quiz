-- Scoped compatible model-profile extension. No new grants, no control/budget reset.
begin;
select 1 from undercover_runtime_v2.control where singleton for update;
do $$ begin
 if exists(select 1 from undercover_runtime_v2.steps where state in ('reserved','sent','unknown')) then raise exception 'MODEL_PROFILE_INSTALL_REQUIRES_NO_UNCERTAIN_STEPS'; end if;
end $$;
alter table undercover_runtime_v2.steps add column model text not null default 'gpt-6.1-terra';
alter table undercover_runtime_v2.steps add column pricing_revision text not null default 'terra-standard-conservative-20261106';
alter table undercover_runtime_v2.steps drop constraint steps_reservation_micro_check;
alter table undercover_runtime_v2.steps add constraint steps_profile_reservation_check check(
 (model='gpt-6.1-terra' and pricing_revision='terra-standard-conservative-20261106' and reservation_micro=48768) or
 (model='gpt-6-luna' and pricing_revision='luna-standard-conservative-20261106' and reservation_micro=4877));
create or replace function undercover_runtime_v2.reserve(p_id text,p_fingerprint text,p_model text,p_pricing text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare c undercover_runtime_v2.control%rowtype; j undercover_runtime_v2.steps%rowtype; lost bigint; amount bigint; cnt integer; required_micro bigint;
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
 if c.model is distinct from p_model or c.pricing_revision is distinct from p_pricing then return jsonb_build_object('fresh',false,'reason','profile_changed'); end if;
 required_micro=case when p_model='gpt-6.1-terra' and p_pricing='terra-standard-conservative-20261106' then 48768 when p_model='gpt-6-luna' and p_pricing='luna-standard-conservative-20261106' then 4877 else null end;
 if required_micro is null then return jsonb_build_object('fresh',false,'reason','guard'); end if;
 if not c.enabled or c.paused or c.valid_until is null or c.valid_until<=clock_timestamp() or c.model is distinct from p_model or c.pricing_revision is distinct from p_pricing
 or c.spent_micro+c.reserved_micro+required_micro>c.cap_micro then return jsonb_build_object('fresh',false,'reason','guard'); end if;
 if exists(select 1 from undercover_runtime_v2.steps where state in('reserved','sent')) then return jsonb_build_object('fresh',false,'reason','busy'); end if;
 insert into undercover_runtime_v2.steps(request_id,fingerprint,state,reservation_micro,lease_until,model,pricing_revision) values(p_id,p_fingerprint,'reserved',required_micro,clock_timestamp()+interval '20 seconds',p_model,p_pricing);
 update undercover_runtime_v2.control set calls_used=calls_used+1,reserved_micro=reserved_micro+required_micro where singleton;
 return jsonb_build_object('fresh',true,'reservationMicro',required_micro,'until',c.valid_until);
end$$;
create or replace function undercover_runtime_v2.settle(p_id text,p_outcome text,p_input integer,p_output integer,p_model text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j undercover_runtime_v2.steps%rowtype; amount bigint;
begin
 perform 1 from undercover_runtime_v2.control where singleton for update;
 select * into strict j from undercover_runtime_v2.steps where request_id=p_id for update;
 if j.state in('success','unknown') then return jsonb_build_object('state',j.state); end if;
 if p_outcome='success' and j.state='sent' and p_model=j.model and p_input between 0 and 16000 and p_output between 0 and 128 then
  -- Conservative accounting ceiling, not an invoice: 3 micro/input + 6 micro/output.
  amount=case when j.model='gpt-6-luna' then (p_input::bigint*3+p_output::bigint*6+9)/10 else p_input::bigint*3+p_output::bigint*6 end;
  update undercover_runtime_v2.steps set state='success',input_tokens=p_input,output_tokens=p_output,usage_ceiling_micro=amount where request_id=p_id;
  update undercover_runtime_v2.control set reserved_micro=reserved_micro-j.reservation_micro,spent_micro=spent_micro+amount where singleton;
  return jsonb_build_object('state','success','usageCeilingMicro',amount);
 end if;
 update undercover_runtime_v2.steps set state='unknown' where request_id=p_id;
 update undercover_runtime_v2.control set paused=true,unknown_micro=unknown_micro+j.reservation_micro,
  payload=jsonb_set(payload,'{aiPaused}','true'),revision=revision+1 where singleton;
 return jsonb_build_object('state','unknown');
end$$;
commit;
-- Control still selects Terra; activation is a separate guarded owner configuration.
