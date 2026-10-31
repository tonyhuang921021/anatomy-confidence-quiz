create table public.test_guard_requests(id uuid primary key,actor uuid not null,question text not null,committed boolean default false);
create table public.question_explanation_overrides(question_id text primary key,explanation text not null);
create function public.ai_guard_reserve(p_id uuid,p_actor uuid,p_question text,p_manifest_sha256 text,p_source_commit text)
returns text language plpgsql as $$ begin
 if exists(select 1 from public.test_guard_requests where id=p_id) then return 'duplicate'; end if;
 insert into public.test_guard_requests(id,actor,question) values(p_id,p_actor,p_question); return 'reserved'; end $$;
create function public.ai_guard_commit(p_id uuid,p_actor uuid,p_explanation text,p_option_analysis jsonb,p_memory_tip text)
returns table(status text,question_id text,explanation text,option_analysis jsonb,memory_tip text,model text,updated_at timestamptz)
language plpgsql as $$ declare q text; inserted boolean; begin
 select question into q from public.test_guard_requests where id=p_id and actor=p_actor and not committed for update;
 if not found then return query select 'unavailable'::text,null::text,null::text,null::jsonb,null::text,null::text,null::timestamptz;return;end if;
 insert into public.question_explanation_overrides as o values(q,p_explanation) on conflict do nothing;inserted:=found;
 update public.test_guard_requests set committed=true where id=p_id;
 return query select case when inserted then 'inserted'::text else 'existing'::text end,q,o.explanation,p_option_analysis,p_memory_tip,'test-model'::text,clock_timestamp() from public.question_explanation_overrides o where o.question_id=q;
end $$;
create function public.ai_guard_cancel_if_cached(p_id uuid,p_actor uuid) returns text language plpgsql as $$ begin
 if exists(select 1 from public.test_guard_requests r join public.question_explanation_overrides o on o.question_id=r.question where r.id=p_id and r.actor=p_actor and not r.committed) then update public.test_guard_requests set committed=true where id=p_id;return 'cancelled';end if;return 'unavailable';end $$;
create function public.ai_guard_close(p_id uuid) returns text language plpgsql as $$ begin
 update public.test_guard_requests set committed=true where id=p_id and not committed;if found then return 'closed';end if;return 'unavailable';end $$;
