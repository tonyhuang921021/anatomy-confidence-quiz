\set ON_ERROR_STOP on
insert into public.ai_guard_budget(id,enabled,verified_credit_expires_at,cap_microusd,envelope_microusd,max_calls,per_call_ceiling_microusd,max_parallel,max_actor_parallel,cooldown_seconds,hourly_limit,daily_limit,model,pricing_revision)
values(true,true,clock_timestamp()+interval '1 hour',10000,100,1,100,5,5,1,100,100,'test-model','test');
insert into public.ai_guard_reviewed_state(id,generation,manifest_sha256,source_commit) values(true,1,repeat('a',64),repeat('b',40));
update public.figure_queue_config set enabled=true,capture_new=true,max_rows=1;
grant select,update on public.question_explanation_overrides to service_role;
set role service_role;
do $$ declare a uuid:='30000000-0000-4000-8000-000000000001'; b uuid:='30000000-0000-4000-8000-000000000002';actor uuid:='30000000-0000-4000-8000-000000000099';s text;begin
 if public.figure_guard_reserve(a,actor,'REAL-Q1',repeat('a',64),repeat('b',40))<>'reserved' then raise exception 'real reserve';end if;
 if public.figure_guard_reserve(b,'30000000-0000-4000-8000-000000000098','REAL-Q2',repeat('a',64),repeat('b',40))<>'figure_queue_capacity' then raise exception 'real capacity';end if;
 if public.ai_guard_start_call(a,1)<>'started' then raise exception 'real start';end if;
 if public.ai_guard_settle_call(a,1,70,10,10)<>'settled' then raise exception 'real settle';end if;
 select status into s from public.figure_guard_commit(a,actor,'saved real guard','{}','');if s<>'inserted' then raise exception 'real commit';end if;
 if not exists(select 1 from public.figure_queue_jobs where request_id=a and state='pending') then raise exception 'real queue';end if;
 if public.figure_guard_close(a)<>'closed' then raise exception 'real close';end if;
end $$;
reset role;
do $$ begin
 if exists(select from public.ai_guard_requests where id='30000000-0000-4000-8000-000000000002') then raise exception 'budget slot leaked';end if;
 if (select spent_microusd from public.ai_guard_budget where id=true)<>70 or (select reserved_microusd from public.ai_guard_budget where id=true)<>0 then raise exception 'budget altered';end if;
 if not exists(select from public.question_explanation_overrides where question_id='REAL-Q1' and explanation='saved real guard') then raise exception 'saved text missing';end if;
 if has_function_privilege('anon','public.figure_guard_commit(uuid,uuid,text,jsonb,text)','execute') then raise exception 'anon permitted';end if;
end $$;
select 'PASS actual guard reserve/start/settle/commit/close with transactional queue and capacity rollback' as result;
