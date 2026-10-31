\set ON_ERROR_STOP on
update public.figure_queue_config set enabled=false,capture_new=true;
do $$ declare id uuid:='00000000-0000-4000-8000-000000000007';actor uuid:='00000000-0000-4000-8000-000000000099';s text;begin
 if public.figure_guard_reserve(id,actor,'Q7','h','c')<>'reserved' then raise exception 'pause reservation';end if;
 select status into s from public.figure_guard_commit(id,actor,'saved while worker paused','{}','');if s<>'inserted' then raise exception 'pause commit';end if;
 if not exists(select from public.figure_queue_jobs where request_id=id and state='pending') then raise exception 'pause lost job';end if;
 if exists(select from public.figure_queue_claim('10000000-0000-4000-8000-000000000040',30)) then raise exception 'paused claim';end if;
end $$;
update public.figure_queue_jobs set updated_at=clock_timestamp()-interval '31 days' where question_id in ('Q1','Q2');
do $$ begin
 if public.figure_queue_prune(29,100)<>0 then raise exception 'short retention';end if;
 if public.figure_queue_prune(30,null)<>0 or public.figure_queue_prune(null,100)<>0 then raise exception 'null retention';end if;
 if public.figure_queue_prune(30,100)<>1 then raise exception 'terminal prune';end if;
 if not exists(select from public.figure_queue_jobs where question_id='Q1' and state='failed') then raise exception 'failed job pruned';end if;
 if not exists(select from public.figure_queue_jobs where question_id='Q7' and state='pending') then raise exception 'pending pruned';end if;
end $$;
select 'PASS paused worker preserves newly committed job; retention preserves failed and pending' as result;
