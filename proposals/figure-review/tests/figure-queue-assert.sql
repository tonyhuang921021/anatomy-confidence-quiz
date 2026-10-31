\set ON_ERROR_STOP on
update public.figure_queue_config set enabled=true,capture_new=true,max_rows=2;
do $$ declare a uuid:='00000000-0000-4000-8000-000000000001';b uuid:='00000000-0000-4000-8000-000000000002';c uuid:='00000000-0000-4000-8000-000000000003';actor uuid:='00000000-0000-4000-8000-000000000099';s text;begin
 if public.figure_guard_reserve(a,actor,'Q1','hash','commit')<>'reserved' then raise exception 'reserve';end if;
 if public.figure_guard_reserve(b,actor,'Q2','hash','commit')<>'reserved' then raise exception 'reserve2';end if;
 if public.figure_guard_reserve(c,actor,'Q3','hash','commit')<>'figure_queue_capacity' then raise exception 'capacity';end if;
 if exists(select from public.test_guard_requests where id=c) then raise exception 'capacity did not roll back budget reservation';end if;
 select status into s from public.figure_guard_commit(a,actor,'saved one','{}','');if s<>'inserted' then raise exception 'commit';end if;
 if not exists(select from public.figure_queue_jobs where request_id=a and state='pending' and explanation_sha256=encode(sha256(convert_to('saved one','UTF8')),'hex')) then raise exception 'atomic enqueue';end if;
 insert into public.question_explanation_overrides values('Q2','existing');
 select status into s from public.figure_guard_commit(b,actor,'new text','{}','');if s<>'existing' then raise exception 'existing';end if;
 if not exists(select from public.figure_queue_jobs where request_id=b and state='cancelled') then raise exception 'cached search';end if;
end $$;
do $$ declare lease uuid:='10000000-0000-4000-8000-000000000001';lease2 uuid:='10000000-0000-4000-8000-000000000002';j record;begin
 update public.figure_queue_config set enabled=false;
 if exists(select from public.figure_queue_claim(lease,30)) then raise exception 'paused';end if;
 update public.figure_queue_config set enabled=true;
 select * into j from public.figure_queue_claim(lease,30);if j.attempts<>1 then raise exception 'claim';end if;
 if exists(select from public.figure_queue_claim(lease2,30)) then raise exception 'double claim';end if;
 update public.figure_queue_jobs set lease_until=clock_timestamp()-interval '1 second' where request_id=j.request_id;
 if public.figure_queue_finish(j.request_id,lease,true)<>'stale' then raise exception 'expired lease';end if;
 select * into j from public.figure_queue_claim(lease2,30);if j.attempts<>2 then raise exception 'recovery';end if;
 if public.figure_queue_finish(j.request_id,lease2,false)<>'pending' then raise exception 'retry';end if;
 select * into j from public.figure_queue_claim(lease,30);if j.attempts<>3 then raise exception 'attempt3';end if;
 if public.figure_queue_finish(j.request_id,lease,false)<>'failed' then raise exception 'bounded';end if;
 if exists(select from public.figure_queue_claim(lease2,30)) then raise exception 'attempt overflow';end if;
end $$;
select 'PASS atomic capacity rollback, commit, cache, pause, lease recovery, retry cap' as result;
