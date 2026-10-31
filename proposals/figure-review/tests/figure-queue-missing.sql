\set ON_ERROR_STOP on
select public.ai_guard_reserve('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000099','Q6','h','c');
do $$ begin
 begin
  perform * from public.figure_guard_commit('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000099','must roll back','{}','');
  raise exception 'missing slot accepted';
 exception when raise_exception then if sqlerrm<>'figure queue reservation missing' then raise;end if;end;
 if exists(select from public.question_explanation_overrides where question_id='Q6') or exists(select from public.test_guard_requests where question='Q6' and committed) then raise exception 'partial commit';end if;
end $$;
update public.figure_queue_jobs set state='leased',attempts=3,lease_id='10000000-0000-4000-8000-000000000030',lease_until=clock_timestamp()-interval '1 second' where question_id='Q3';
select * from public.figure_queue_claim('10000000-0000-4000-8000-000000000031',30);
do $$ begin if not exists(select from public.figure_queue_jobs where question_id='Q3' and state='failed' and lease_id is null) then raise exception 'last crash not failed';end if;end $$;
select 'PASS missing slot rollback and third-attempt crash failure' as result;
