\set ON_ERROR_STOP on
set role service_role;
do $$ declare lease uuid:='40000000-0000-4000-8000-000000000001';row record;h text:=encode(sha256(convert_to('saved real guard','UTF8')),'hex');im bytea:=decode('89504e470d0a1a0a','hex');id uuid;begin
 select * into row from public.figure_queue_claim(lease,30);if row.question_id<>'REAL-Q1' then raise exception 'unexpected claimed job';end if;
 id:=public.figure_queue_stage(row.request_id,lease,'40000000-0000-4000-8000-000000000002','REAL-Q1',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
 if id is null then raise exception 'stage unavailable';end if;
 if public.figure_queue_finish(row.request_id,lease,true)<>'done' then raise exception 'finish unavailable';end if;
end $$;
reset role;
do $$ begin if not exists(select from public.explanation_figure_candidates where question_id='REAL-Q1' and status='pending') then raise exception 'candidate missing';end if;end $$;
select 'PASS service role claim and fenced stage using actual guard results' as result;
