\set ON_ERROR_STOP on
update public.figure_queue_config set enabled=true,max_image_bytes=128;
do $$ declare lease uuid:='10000000-0000-4000-8000-000000000041';wrong uuid:='10000000-0000-4000-8000-000000000042';j record;first uuid;second uuid;h text:=encode(sha256(convert_to('saved while worker paused','UTF8')),'hex');im bytea:=decode('89504e470d0a1a0a','hex');begin
 select * into j from public.figure_queue_claim(lease,30);
 if j.question_id<>'Q7' then raise exception 'wrong job %',j.question_id;end if;
 begin
  perform public.figure_queue_stage(j.request_id,wrong,'00000000-0000-4000-8000-000000000051','Q7',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
  raise exception 'wrong lease accepted';
 exception when raise_exception then if sqlerrm<>'stale figure lease' then raise;end if;end;
 first:=public.figure_queue_stage(j.request_id,lease,'00000000-0000-4000-8000-000000000051','Q7',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
 second:=public.figure_queue_stage(j.request_id,lease,'00000000-0000-4000-8000-000000000052','Q7',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
 if first<>second then raise exception 'duplicate image inserted';end if;
 update public.figure_queue_jobs set lease_until=clock_timestamp()-interval '1 second' where request_id=j.request_id;
 begin
  perform public.figure_queue_stage(j.request_id,lease,'00000000-0000-4000-8000-000000000053','Q7',h,encode(sha256(im),'hex'),'image/png',im,'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
  raise exception 'expired lease accepted';
 exception when raise_exception then if sqlerrm<>'stale figure lease' then raise;end if;end;
end $$;
select 'PASS fenced stage rejects wrong/expired lease and deduplicates retried image' as result;
