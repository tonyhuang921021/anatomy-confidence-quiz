\set ON_ERROR_STOP on
update public.figure_queue_jobs set updated_at=clock_timestamp()-case when state='failed' then interval '2 days' else interval '1 day' end;
do $$ declare id uuid:='00000000-0000-4000-8000-000000000003';actor uuid:='00000000-0000-4000-8000-000000000099';begin
 if public.figure_guard_reserve(id,actor,'Q3','h','c')<>'reserved' then raise exception 'terminal did not reclaim';end if;
 if (select reclaimed_failed from public.figure_queue_config c where c.id=true)<>1 then raise exception 'failed counter';end if;
 if exists(select from public.figure_queue_jobs where question_id='Q1') then raise exception 'failed row remains';end if;
 if not exists(select from public.question_explanation_overrides where question_id='Q1' and explanation='saved one') then raise exception 'saved explanation lost';end if;
 if not exists(select from public.figure_queue_jobs where question_id='Q3' and state='reserved') then raise exception 'new reservation missing';end if;
end $$;
update public.figure_queue_config set max_image_bytes=9;
do $$ declare v_id uuid:='00000000-0000-4000-8000-000000000060';reviewer uuid:='00000000-0000-4000-8000-000000000099';h text:=encode(sha256(convert_to('saved one','UTF8')),'hex');im bytea:=decode('89504e470d0a1a0a','hex');ih text:=encode(sha256(im),'hex');status text;begin
 insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values(v_id,'Q1',h,ih,'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
 status:=public.review_explanation_figure(v_id,'rejected',reviewer,false,'saved one',h,ih,im);if status<>'rejected' then raise exception 'reject';end if;
 if not exists(select from public.explanation_figure_candidates c where c.id=v_id and c.image_bytes is null and c.image_sha256=ih and c.status='rejected' and c.source_url='https://commons.wikimedia.org/wiki/File:x') then raise exception 'reject audit or cleanup';end if;
 if exists(select from public.read_approved_explanation_figure(v_id)) then raise exception 'rejected image served';end if;
 im:=decode('89504e470d0a1a0a00','hex');
 insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values('00000000-0000-4000-8000-000000000061','Q1',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:y','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
end $$;
select 'PASS failed terminal reclaim, saved text retained, rejected bytes released with audit metadata' as result;
