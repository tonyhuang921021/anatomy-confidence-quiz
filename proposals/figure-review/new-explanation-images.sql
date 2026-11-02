-- LOCAL REVIEW CANDIDATE. Requires existing guard, queue, needs and PDM migrations.
-- All new switches default OFF. Never rewrites saved text.
begin;
alter table public.question_explanation_overrides add column figure_status text;
alter table public.figure_queue_jobs add column image_status text not null default 'awaiting_image', add column needs_review_method text;
alter table public.explanation_figure_candidates add column section_anchor text, add column section_heading text, add column section_sha256 text;
create table public.figure_image_limits (
 id boolean primary key default true check(id), enabled boolean not null default false,
 capture boolean not null default false, captured integer not null default 0 check(captured>=0),
 max_new integer not null default 5 check(max_new between 1 and 20),
 searches integer not null default 0 check(searches>=0), downloads integer not null default 0 check(downloads>=0),
 max_searches integer not null default 5 check(max_searches between 1 and 40),
 max_downloads integer not null default 15 check(max_downloads between 1 and 120),
 download_bytes bigint not null default 0 check(download_bytes>=0), max_download_bytes bigint not null default 47185920 check(max_download_bytes between 1 and 104857600)
);
insert into public.figure_image_limits(id) values(true);
create table public.figure_image_cache (
 key text primary key check(key ~ '^[0-9a-f]{64}$'), items jsonb,
 owner_request uuid, owner_lease uuid, expires_at timestamptz not null,
 check(items is null or (jsonb_typeof(items)='array' and jsonb_array_length(items)<=3 and octet_length(items::text)<=16384))
);
alter table public.figure_image_limits enable row level security;
alter table public.figure_image_cache enable row level security;
revoke all on public.figure_image_limits,public.figure_image_cache from public,anon,authenticated;
grant select,update on public.figure_image_limits to service_role;
grant select,insert,update on public.figure_image_cache to service_role;

create function public.figure_guard_commit_new_images(p_id uuid,p_actor uuid,p_explanation text,p_option_analysis jsonb,p_memory_tip text,p_needs jsonb)
returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz)
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved record; lim public.figure_image_limits%rowtype; cfg public.figure_queue_config%rowtype; digest text;
begin
 select * into saved from public.ai_guard_commit(p_id,p_actor,p_explanation,p_option_analysis,p_memory_tip);
 if saved.status='inserted' then
  update public.question_explanation_overrides o set figure_status='awaiting_image_plan' where o.question_id=saved.question_id;
  -- A failed image plan cannot roll back an already paid, valid explanation.
  begin
   select * into lim from public.figure_image_limits where id=true for update;
   select * into cfg from public.figure_queue_config where id=true for update;
   digest:=encode(sha256(convert_to(saved.explanation,'UTF8')),'hex');
   if lim.capture and lim.captured<lim.max_new and (select count(*) from public.figure_queue_jobs)<cfg.max_rows
    and jsonb_typeof(p_needs)='object' and octet_length(p_needs::text)<=4096
    and p_needs->>'explanationHash'=digest and p_needs->>'revision' ~ '^[0-9a-f]{64}$'
    and jsonb_typeof(p_needs->'items')='array' and jsonb_array_length(p_needs->'items') between 1 and 3 then
    insert into public.figure_queue_jobs(request_id,question_id,explanation_sha256,state,figure_needs,needs_state,image_status)
    values(p_id,saved.question_id,digest,'pending',p_needs,'awaiting','awaiting_concept_review') on conflict do nothing;
    if found then
     update public.figure_image_limits set captured=captured+1 where id=true;
     update public.question_explanation_overrides o set figure_status='awaiting_concept_review' where o.question_id=saved.question_id;
    end if;
   end if;
  exception when others then
   update public.question_explanation_overrides o set figure_status='awaiting_image' where o.question_id=saved.question_id;
  end;
 end if;
 return query select saved.status,saved.question_id,saved.explanation,saved.option_analysis,saved.memory_tip,saved.model,saved.updated_at;
end $$;

create function public.figure_image_review(p_id uuid,p_revision text,p_needs jsonb,p_reviewer uuid,p_method text default 'manual')
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.figure_queue_jobs%rowtype; txt text; item jsonb;
begin
 select * into job from public.figure_queue_jobs where request_id=p_id for update;
 if not found or p_method is null or p_method not in ('manual','trusted_catalog','schema_query') or (p_method='manual' and p_reviewer is null) or (p_method='trusted_catalog' and (p_reviewer is not null or p_needs->>'reviewMethod' is distinct from 'trusted_catalog')) or (p_method='schema_query' and (p_reviewer is not null or p_needs->>'reviewMethod' is distinct from 'schema_query')) or job.state<>'pending' or job.needs_state<>'awaiting' or job.figure_needs->>'revision' is distinct from p_revision then return 'stale'; end if;
 select explanation into txt from public.question_explanation_overrides where question_id=job.question_id for share;
 if not found or encode(sha256(convert_to(txt,'UTF8')),'hex')<>job.explanation_sha256 then return 'stale'; end if;
 if p_needs->>'status' is distinct from 'approved' or p_needs->>'revision' is distinct from p_revision or p_needs->>'explanationHash' is distinct from job.explanation_sha256 or jsonb_typeof(p_needs->'items') is distinct from 'array' or octet_length(p_needs::text)>4096 or jsonb_array_length(p_needs->'items')<>jsonb_array_length(job.figure_needs->'items') then return 'invalid'; end if;
 for item in select value from jsonb_array_elements(p_needs->'items') loop
  if p_method='schema_query' and (item->>'searchScope' is distinct from 'general-medical' or item->>'medicalDomain' not in ('anatomy','physiology','biochemistry','microbiology','pathology','pharmacology') or item->>'medicalDomain' is null or item->>'query' is distinct from item->>'proposedQuery' or item->>'query' is null or length(item->>'query') not between 2 and 90 or item->>'query' !~ '^[a-z][a-z -]+$' or item->>'query' ~ '\m(patient|name|john|jane|smith|doe|address|email|phone|record|hospital|clinic|case|password|token|secret|key|ignore|instruction|upload|download|send|search|find|my|his|her|our|your|mr|mrs|dr)\M') then return 'invalid'; end if;
  if not ((p_method='schema_query' and item->>'catalogRevision'='schema-query-v1') or (p_method='manual' and item->>'catalogRevision'='reviewed-query-v1' and length(item->>'query') between 2 and 100 and item->>'query' ~ '^[A-Za-z一-鿿 ()-]+$') or (item->>'conceptId'='carotid-sheath' and item->>'query'='carotid sheath anatomy' and item->>'catalogRevision'='carotid-sheath-v1') or (item->>'conceptId'='carotid-sinus' and item->>'query'='carotid sinus anatomy OpenStax' and item->>'catalogRevision'='carotid-sinus-v1') or (item->>'conceptId'='dural-venous-sinuses' and item->>'query'='dural venous sinuses OpenStax' and item->>'catalogRevision'='dural-venous-sinuses-v1')) or not exists(select 1 from jsonb_array_elements(job.figure_needs->'items') x where x->>'sectionAnchor'=item->>'sectionAnchor' and x->>'sectionHash'=item->>'sectionHash' and x->>'sectionTitle'=item->>'sectionTitle' and x->>'caption'=item->>'caption') then return 'invalid'; end if;
 end loop;
 update public.figure_queue_jobs set figure_needs=p_needs,needs_state='approved',needs_reviewer=p_reviewer,needs_review_method=p_method,needs_reviewed_at=clock_timestamp(),image_status='ready_to_search' where request_id=p_id;
 return 'approved';
end $$;

create function public.figure_image_active(p_id uuid,p_lease uuid) returns boolean language sql security invoker set search_path=pg_catalog,public as $$
 select exists(select 1 from public.figure_queue_jobs j,public.figure_image_limits l,public.figure_queue_config c,public.question_explanation_overrides o
 where l.id and c.id and l.enabled and c.enabled and j.request_id=p_id and j.lease_id=p_lease and j.state='leased' and j.lease_until>clock_timestamp() and j.needs_state='approved' and o.question_id=j.question_id and encode(sha256(convert_to(o.explanation,'UTF8')),'hex')=j.explanation_sha256)
$$;
create function public.figure_image_cache_get(p_key text) returns jsonb language sql security invoker set search_path=pg_catalog,public as $$
 select items from public.figure_image_cache where key=p_key and expires_at>clock_timestamp() and items is not null
$$;
create function public.figure_image_reserve(p_id uuid,p_lease uuid,p_key text,p_kind text) returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
declare lim public.figure_image_limits%rowtype; entry public.figure_image_cache%rowtype;
begin
 -- Same lock order for worker limits; never refund failed/unknown traffic.
 select * into lim from public.figure_image_limits where id=true for update;
 if not public.figure_image_active(p_id,p_lease) or p_key !~ '^[0-9a-f]{64}$' then return false; end if;
 if p_kind='search' then
  select * into entry from public.figure_image_cache where key=p_key for update;
  if found and entry.expires_at>clock_timestamp() then return false; end if;
  if lim.searches>=lim.max_searches then return false; end if;
  insert into public.figure_image_cache(key,owner_request,owner_lease,expires_at) values(p_key,p_id,p_lease,clock_timestamp()+interval '10 minutes')
   on conflict(key) do update set items=null,owner_request=p_id,owner_lease=p_lease,expires_at=excluded.expires_at;
  update public.figure_image_limits set searches=searches+1 where id=true;
 elsif p_kind='download' then
  if lim.downloads>=lim.max_downloads or lim.download_bytes+3145728>lim.max_download_bytes then return false; end if;
  update public.figure_image_limits set downloads=downloads+1,download_bytes=download_bytes+3145728 where id=true;
 else return false; end if;
 return true;
end $$;
create function public.figure_image_cache_put(p_id uuid,p_lease uuid,p_key text,p_items jsonb) returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not public.figure_image_active(p_id,p_lease) then return false; end if;
 update public.figure_image_cache set items=p_items,expires_at=clock_timestamp()+interval '24 hours' where key=p_key and owner_request=p_id and owner_lease=p_lease and expires_at>clock_timestamp();
 return found;
end $$;
create function public.figure_image_stage(p_request uuid,p_lease uuid,p_id uuid,p_question text,p_text_sha text,p_image_sha text,p_mime text,p_bytes bytea,p_source text,p_license_url text,p_license text,p_attribution text,p_section text,p_anchor text,p_section_title text,p_section_hash text)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result uuid;
begin
 if not public.figure_image_active(p_request,p_lease) or p_license='PDM 1.0' then raise exception 'inactive or manual PDM required'; end if;
 if not exists(select 1 from public.figure_queue_jobs j,jsonb_array_elements(j.figure_needs->'items') i where j.request_id=p_request and i->>'sectionAnchor'=p_anchor and i->>'sectionTitle'=p_section_title and i->>'sectionHash'=p_section_hash and i->>'caption'=p_section) then raise exception 'section mismatch'; end if;
 result:=public.figure_queue_stage(p_request,p_lease,p_id,p_question,p_text_sha,p_image_sha,p_mime,p_bytes,p_source,p_license_url,p_license,p_attribution,p_section);
 if exists(select 1 from public.explanation_figure_candidates where id=result and status='rejected') then raise exception 'previously rejected image'; end if;
 update public.explanation_figure_candidates set section_anchor=p_anchor,section_heading=p_section_title,section_sha256=p_section_hash where id=result and section_anchor is null;
 return result;
end $$;
create function public.figure_image_finish(p_id uuid,p_lease uuid,p_status text) returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result text;
begin
 if p_status not in ('stale','awaiting_concept_review','awaiting_budget','awaiting_image','pending_visual_review') then return 'invalid'; end if;
 result:=public.figure_queue_finish(p_id,p_lease,true);
 if result='done' then update public.figure_queue_jobs set image_status=p_status where request_id=p_id; end if;
 return result;
end $$;
-- Claim only reviewed new-flow jobs; exhausted leases stay inspectable.
create or replace function public.figure_queue_claim(p_lease uuid,p_seconds integer)
returns table(request_id uuid,question_id text,explanation_sha256 text,attempts integer)
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare jid uuid;
begin
 if p_lease is null or p_seconds not between 30 and 600 or not exists(select 1 from public.figure_queue_config c,public.figure_image_limits l where c.id and l.id and c.enabled and l.enabled) then return; end if;
 update public.figure_queue_jobs j set state='failed',image_status='awaiting_image',lease_id=null,lease_until=null where j.state='leased' and j.lease_until<clock_timestamp() and j.attempts>=3;
 select j.request_id into jid from public.figure_queue_jobs j where (j.state='pending' or (j.state='leased' and j.lease_until<clock_timestamp())) and j.attempts<3 and j.needs_state='approved' and j.figure_needs->>'status'='approved' order by j.created_at for update skip locked limit 1;
 if not found then return; end if;
 return query update public.figure_queue_jobs j set state='leased',attempts=j.attempts+1,lease_id=p_lease,lease_until=clock_timestamp()+make_interval(secs=>p_seconds),updated_at=clock_timestamp() where j.request_id=jid returning j.request_id,j.question_id,j.explanation_sha256,j.attempts;
end $$;
create function public.figure_image_retry(p_id uuid) returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.figure_queue_jobs%rowtype; txt text;
begin
 select * into job from public.figure_queue_jobs where request_id=p_id for update;
 if not found or job.state not in ('done','failed') or job.attempts>=3 or job.needs_state<>'approved' then return 'not_retryable'; end if;
 select explanation into txt from public.question_explanation_overrides where question_id=job.question_id for share;
 if not found or encode(sha256(convert_to(txt,'UTF8')),'hex')<>job.explanation_sha256 then return 'stale'; end if;
 update public.figure_queue_jobs set state='pending',image_status='ready_to_search' where request_id=p_id;
 return 'pending';
end $$;
create function public.figure_image_plan_saved(p_question text,p_needs jsonb) returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare txt text; digest text; lim public.figure_image_limits%rowtype; cfg public.figure_queue_config%rowtype;
begin
 select explanation into txt from public.question_explanation_overrides where question_id=p_question and figure_status is not null for share;
 if not found then return 'not_new_flow'; end if;
 digest:=encode(sha256(convert_to(txt,'UTF8')),'hex');
 if p_needs->>'explanationHash' is distinct from digest or p_needs->>'revision' !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_needs->'items') is distinct from 'array' or jsonb_array_length(p_needs->'items') not between 1 and 3 or octet_length(p_needs::text)>4096 then return 'invalid'; end if;
 select * into lim from public.figure_image_limits where id=true for update;
 select * into cfg from public.figure_queue_config where id=true for update;
 if not lim.capture or lim.captured>=lim.max_new or (select count(*) from public.figure_queue_jobs)>=cfg.max_rows then return 'capacity'; end if;
 insert into public.figure_queue_jobs(request_id,question_id,explanation_sha256,state,figure_needs,needs_state,image_status) values(gen_random_uuid(),p_question,digest,'pending',p_needs,'awaiting','awaiting_concept_review') on conflict do nothing;
 if not found then return 'existing'; end if;
 update public.figure_image_limits set captured=captured+1 where id=true;
 return 'awaiting';
end $$;
-- No scheduler or role expansion. Only service_role, same existing admin gate.
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'figure_image_%' or proname='figure_guard_commit_new_images') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
