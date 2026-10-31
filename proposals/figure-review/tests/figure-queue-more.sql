\set ON_ERROR_STOP on
update public.figure_queue_config set max_rows=20,max_image_bytes=8;
do $$ declare h text:=encode(sha256(convert_to('saved one','UTF8')),'hex'); begin
 insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title)
 values('00000000-0000-4000-8000-000000000020','Q1',h,encode(sha256(decode('89504e470d0a1a0a','hex')),'hex'),'image/png',decode('89504e470d0a1a0a','hex'),'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
 begin
  insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title)
  values('00000000-0000-4000-8000-000000000021','Q1',h,encode(sha256(decode('89504e470d0a1a0a00','hex')),'hex'),'image/png',decode('89504e470d0a1a0a00','hex'),'https://commons.wikimedia.org/wiki/File:y','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
  raise exception 'capacity did not reject';
 exception when raise_exception then if sqlerrm <> 'figure byte capacity' then raise;end if;end;
 if has_table_privilege('anon','public.figure_queue_jobs','select') or has_function_privilege('authenticated','public.figure_queue_claim(uuid,integer)','execute') then raise exception 'public access';end if;
end $$;
select public.figure_guard_reserve('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000099','Q3','h','c');
begin;
select status from public.figure_guard_commit('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000099','saved three','{}','');
rollback;
do $$ begin if exists(select from public.question_explanation_overrides where question_id='Q3') or not exists(select from public.figure_queue_jobs where question_id='Q3' and state='reserved') then raise exception 'rollback lost atomicity';end if;end $$;
select status from public.figure_guard_commit('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000099','saved three','{}','');
select public.figure_guard_reserve('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000099','Q4','h','c');
select status from public.figure_guard_commit('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000099','saved four','{}','');
select 'PASS byte cap, role denial, transactional rollback' as result;
