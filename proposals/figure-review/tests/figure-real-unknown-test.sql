\set ON_ERROR_STOP on
update public.figure_queue_config set max_rows=5;
set role service_role;
do $$ declare id uuid:='30000000-0000-4000-8000-000000000003';actor uuid:='30000000-0000-4000-8000-000000000097';begin
 if public.figure_guard_reserve(id,actor,'REAL-UNKNOWN',repeat('a',64),repeat('b',40))<>'reserved' then raise exception 'reserve';end if;
 if public.ai_guard_start_call(id,1)<>'started' then raise exception 'start';end if;
 if public.figure_guard_close(id)<>'unresolved' then raise exception 'unknown released';end if;
 if not exists(select from public.figure_queue_jobs where request_id=id and state='reserved') then raise exception 'queue reservation lost';end if;
end $$;
reset role;
do $$ begin if (select reserved_microusd from public.ai_guard_budget where id=true)<>100 then raise exception 'unknown budget released';end if;end $$;
select 'PASS unknown call remains held in original budget and figure queue' as result;
