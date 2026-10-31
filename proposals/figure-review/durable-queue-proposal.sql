-- ISOLATED CANDIDATE ONLY. Do not execute on production.
-- Both wrappers MUST replace the route's corresponding RPCs together.
begin;
create table public.figure_queue_config (
 id boolean primary key default true check(id), enabled boolean not null default false,
 capture_new boolean not null default false,
 max_rows integer not null check(max_rows between 1 and 10000),
 reclaimed_done bigint not null default 0 check(reclaimed_done>=0),
 reclaimed_failed bigint not null default 0 check(reclaimed_failed>=0),
 reclaimed_cancelled bigint not null default 0 check(reclaimed_cancelled>=0),
 max_image_bytes bigint not null default 104857600 check(max_image_bytes between 1 and 1073741824)
);
insert into public.figure_queue_config(id,enabled,max_rows) values(true,false,1000);
create table public.figure_queue_jobs (
 request_id uuid primary key, question_id text not null,
 explanation_sha256 text check(explanation_sha256 ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('reserved','pending','leased','done','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 lease_id uuid, lease_until timestamptz, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((state='leased')=(lease_id is not null and lease_until is not null)),
 check(state in ('reserved','cancelled') or explanation_sha256 is not null)
);
create unique index figure_queue_dedupe on public.figure_queue_jobs(question_id,explanation_sha256) where explanation_sha256 is not null;
create index figure_queue_claim on public.figure_queue_jobs(state,lease_until,created_at);
alter table public.figure_queue_config enable row level security;
alter table public.figure_queue_jobs enable row level security;
revoke all on public.figure_queue_config,public.figure_queue_jobs from public,anon,authenticated;
grant select,update on public.figure_queue_config to service_role;
grant select,insert,update,delete on public.figure_queue_jobs to service_role;

-- Enforce a database-wide hard byte ceiling and three candidates per saved
-- version, including concurrent writers. Existing duplicate is left to the
-- unique index so a retried worker can recognise it idempotently.
create function public.figure_candidate_capacity_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cfg public.figure_queue_config%rowtype; current_text text;
begin
 if new.status<>'pending' or new.reviewer_id is not null or new.reviewed_at is not null or encode(sha256(new.image_bytes),'hex')<>new.image_sha256 then raise exception 'invalid unreviewed image'; end if;
 select explanation into current_text from public.question_explanation_overrides where question_id=new.question_id for share;
 if not found or encode(sha256(convert_to(current_text,'UTF8')),'hex')<>new.explanation_sha256 then raise exception 'stale explanation'; end if;
 select * into cfg from public.figure_queue_config where id=true for update;
 if not found or not cfg.enabled then raise exception 'figure queue paused'; end if;
 if exists(select 1 from public.explanation_figure_candidates c where c.question_id=new.question_id and c.explanation_sha256=new.explanation_sha256 and c.image_sha256=new.image_sha256) then return new; end if;
 if (select count(*) from public.explanation_figure_candidates c where c.question_id=new.question_id and c.explanation_sha256=new.explanation_sha256 and c.status<>'rejected')>=3 then raise exception 'figure per-question capacity'; end if;
 if (select coalesce(sum(octet_length(c.image_bytes)),0) from public.explanation_figure_candidates c)+octet_length(new.image_bytes)>cfg.max_image_bytes then raise exception 'figure byte capacity'; end if;
 return new;
end $$;
revoke all on function public.figure_candidate_capacity_guard() from public,anon,authenticated;
create trigger figure_candidate_capacity before insert on public.explanation_figure_candidates for each row execute function public.figure_candidate_capacity_guard();

-- Original budget reservation is rolled back if queue capacity is exhausted.
-- Lock order is always budget then queue, compatible with the existing guard.
create function public.figure_guard_reserve(p_id uuid,p_actor uuid,p_question text,p_manifest_sha256 text,p_source_commit text)
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result text; cfg public.figure_queue_config%rowtype; reclaimed text; reclaimed_count integer:=0;
begin
 result:=public.ai_guard_reserve(p_id,p_actor,p_question,p_manifest_sha256,p_source_commit);
 if result <> 'reserved' then return result; end if;
 select * into cfg from public.figure_queue_config where id=true for update;
 if not found then raise exception 'figure queue configuration unavailable'; end if;
 if cfg.capture_new then
  while (select count(*) from public.figure_queue_jobs) >= cfg.max_rows loop
   -- Only terminal bookkeeping is reclaimable. Pending, reserved and leased
   -- work is never discarded; counters preserve aggregate terminal outcomes.
   if reclaimed_count>=100 then raise exception using errcode='P0001',message='figure_queue_capacity'; end if;
   reclaimed:=null;
   with oldest as (select j.request_id from public.figure_queue_jobs j where j.state in ('done','failed','cancelled') order by j.updated_at,j.request_id for update skip locked limit 1)
   delete from public.figure_queue_jobs j using oldest o where j.request_id=o.request_id returning j.state into reclaimed;
   if reclaimed is null then raise exception using errcode='P0001',message='figure_queue_capacity'; end if;
   update public.figure_queue_config set reclaimed_done=reclaimed_done+(reclaimed='done')::int,
    reclaimed_failed=reclaimed_failed+(reclaimed='failed')::int,
    reclaimed_cancelled=reclaimed_cancelled+(reclaimed='cancelled')::int where id=true;
   reclaimed_count:=reclaimed_count+1;
  end loop;
  insert into public.figure_queue_jobs(request_id,question_id,state) values(p_id,p_question,'reserved');
 end if;
 return result;
exception when raise_exception then
 if sqlerrm='figure_queue_capacity' then return 'figure_queue_capacity'; end if; raise;
end $$;

create function public.figure_guard_cancel_if_cached(p_id uuid,p_actor uuid)
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result text;
begin
 result:=public.ai_guard_cancel_if_cached(p_id,p_actor);
 if result='cancelled' then update public.figure_queue_jobs set state='cancelled',updated_at=clock_timestamp() where request_id=p_id and state='reserved'; end if;
 return result;
end $$;

create function public.figure_guard_close(p_id uuid)
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result text;
begin
 result:=public.ai_guard_close(p_id);
 if result='closed' then update public.figure_queue_jobs set state='cancelled',updated_at=clock_timestamp() where request_id=p_id and state='reserved'; end if;
 return result;
end $$;

-- Saved result and enqueue commit or roll back together. No model call occurs here.
create function public.figure_guard_commit(p_id uuid,p_actor uuid,p_explanation text,p_option_analysis jsonb,p_memory_tip text)
returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz)
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare saved record; job public.figure_queue_jobs%rowtype; digest text; active boolean;
begin
 select * into saved from public.ai_guard_commit(p_id,p_actor,p_explanation,p_option_analysis,p_memory_tip);
 select * into job from public.figure_queue_jobs j where j.request_id=p_id for update;
 if not found then
  select capture_new into active from public.figure_queue_config where id=true for share;
  if active is distinct from false then raise exception 'figure queue reservation missing'; end if;
  return query select saved.status,saved.question_id,saved.explanation,saved.option_analysis,saved.memory_tip,saved.model,saved.updated_at;
  return;
 end if;
 if found then
  if job.state <> 'reserved' or job.question_id is distinct from saved.question_id then raise exception 'figure queue reservation mismatch'; end if;
  if saved.status='inserted' then
   digest:=encode(sha256(convert_to(saved.explanation,'UTF8')),'hex');
   if exists(select 1 from public.figure_queue_jobs j where j.question_id=saved.question_id and j.explanation_sha256=digest) then
    update public.figure_queue_jobs set state='cancelled',updated_at=clock_timestamp() where request_id=p_id;
   else
    update public.figure_queue_jobs set state='pending',explanation_sha256=digest,updated_at=clock_timestamp() where request_id=p_id;
   end if;
  elsif saved.status='existing' then
   update public.figure_queue_jobs set state='cancelled',updated_at=clock_timestamp() where request_id=p_id;
  else raise exception 'guard commit unavailable'; end if;
 end if;
 return query select saved.status,saved.question_id,saved.explanation,saved.option_analysis,saved.memory_tip,saved.model,saved.updated_at;
end $$;

create function public.figure_queue_claim(p_lease uuid,p_seconds integer)
returns table(request_id uuid,question_id text,explanation_sha256 text,attempts integer)
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare jid uuid; active boolean;
begin
 if p_lease is null or p_seconds is null or p_seconds not between 30 and 600 then return; end if;
 select enabled into active from public.figure_queue_config where id=true for share;
 if active is distinct from true then return; end if;
 -- A worker may die during its last permitted attempt. Preserve the failed
 -- job for operator inspection instead of leaving an expired lease forever.
 update public.figure_queue_jobs j set state='failed',lease_id=null,lease_until=null,updated_at=clock_timestamp()
 where j.state='leased' and j.lease_until<clock_timestamp() and j.attempts>=3;
 select j.request_id into jid from public.figure_queue_jobs j
 where (j.state='pending' or (j.state='leased' and j.lease_until < clock_timestamp())) and j.attempts < 3
 order by j.created_at,j.request_id for update skip locked limit 1;
 if not found then return; end if;
 return query update public.figure_queue_jobs j set state='leased',attempts=j.attempts+1,lease_id=p_lease,
  lease_until=clock_timestamp()+make_interval(secs=>p_seconds),updated_at=clock_timestamp()
 where j.request_id=jid returning j.request_id,j.question_id,j.explanation_sha256,j.attempts;
end $$;

create function public.figure_queue_finish(p_id uuid,p_lease uuid,p_success boolean)
returns text language plpgsql security invoker set search_path=pg_catalog,public as $$
declare answer text;
begin
 if p_success is null then return 'invalid'; end if;
 update public.figure_queue_jobs j set state=case when p_success then 'done' when j.attempts>=3 then 'failed' else 'pending' end,
  lease_id=null,lease_until=null,updated_at=clock_timestamp()
 where j.request_id=p_id and j.state='leased' and j.lease_id=p_lease and j.lease_until>clock_timestamp()
 returning j.state into answer;
 return coalesce(answer,'stale');
end $$;

-- A worker must still own an unexpired lease while staging. The same job row
-- lock fences another claimant until staging commits; a late worker rolls back.
create function public.figure_queue_stage(p_request uuid,p_lease uuid,p_id uuid,p_question text,p_text_sha text,p_image_sha text,p_mime text,p_bytes bytea,p_source text,p_license_url text,p_license text,p_attribution text,p_section text)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.figure_queue_jobs%rowtype; image_id uuid;
begin
 select * into job from public.figure_queue_jobs where request_id=p_request for update;
 if not found or job.state<>'leased' or job.lease_id is distinct from p_lease or job.lease_until<=clock_timestamp() or job.question_id is distinct from p_question or job.explanation_sha256 is distinct from p_text_sha then raise exception 'stale figure lease'; end if;
 insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title)
 values(p_id,p_question,p_text_sha,p_image_sha,p_mime,p_bytes,p_source,p_license_url,p_license,p_attribution,p_section)
 on conflict (question_id,explanation_sha256,image_sha256) do nothing returning id into image_id;
 if image_id is null then select id into image_id from public.explanation_figure_candidates where question_id=p_question and explanation_sha256=p_text_sha and image_sha256=p_image_sha; end if;
 if image_id is null or job.lease_until<=clock_timestamp() then raise exception 'stale figure lease'; end if;
 return image_id;
end $$;

-- Explicit operator action only: terminal bookkeeping older than 30 days.
-- Never removes reserved, active, failed, image or explanation records.
create function public.figure_queue_prune(p_days integer,p_limit integer)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare removed integer;
begin
 if p_days is null or p_limit is null or p_days not between 30 and 3650 or p_limit not between 1 and 100 then return 0; end if;
 with chosen as (select j.request_id from public.figure_queue_jobs j where j.state in ('done','cancelled') and j.updated_at < clock_timestamp()-make_interval(days=>p_days) order by j.updated_at for update skip locked limit p_limit)
 delete from public.figure_queue_jobs j using chosen c where j.request_id=c.request_id;
 get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.figure_guard_reserve(uuid,uuid,text,text,text), public.figure_guard_commit(uuid,uuid,text,jsonb,text), public.figure_guard_cancel_if_cached(uuid,uuid), public.figure_guard_close(uuid), public.figure_queue_claim(uuid,integer), public.figure_queue_finish(uuid,uuid,boolean), public.figure_queue_prune(integer,integer), public.figure_queue_stage(uuid,uuid,uuid,text,text,text,text,bytea,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.figure_guard_reserve(uuid,uuid,text,text,text), public.figure_guard_commit(uuid,uuid,text,jsonb,text), public.figure_guard_cancel_if_cached(uuid,uuid), public.figure_guard_close(uuid), public.figure_queue_claim(uuid,integer), public.figure_queue_finish(uuid,uuid,boolean), public.figure_queue_prune(integer,integer), public.figure_queue_stage(uuid,uuid,uuid,text,text,text,text,bytea,text,text,text,text,text) to service_role;
commit;
