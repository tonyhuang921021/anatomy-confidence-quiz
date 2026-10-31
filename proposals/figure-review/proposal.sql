-- PROPOSAL ONLY: never execute in production without explicit approval.
-- Deliberately not a Supabase migration; create the migration with the project CLI after review.
begin;
create table public.explanation_figure_candidates (
 id uuid primary key,
 question_id text not null check (char_length(question_id) between 1 and 200),
 explanation_sha256 text not null check (explanation_sha256 ~ '^[0-9a-f]{64}$'),
 image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
 image_mime text not null check (image_mime in ('image/png','image/jpeg','image/webp')),
 image_bytes bytea check (image_bytes is null or octet_length(image_bytes) between 1 and 3145728),
 source_url text not null check (source_url like 'https://commons.wikimedia.org/%'),
 license_url text not null check (license_url like 'https://creativecommons.org/%'),
 license text not null check (license in ('CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC0')),
 attribution text not null check (char_length(attribution) between 1 and 500),
 section_title text not null check (char_length(section_title) between 1 and 80),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewer_id uuid,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check ((status='pending' and reviewer_id is null and reviewed_at is null) or (status<>'pending' and reviewer_id is not null and reviewed_at is not null)),
 check ((status='rejected' and image_bytes is null) or (status<>'rejected' and image_bytes is not null)),
 unique (question_id,explanation_sha256,image_sha256)
);
create index explanation_figure_candidates_review_idx on public.explanation_figure_candidates(status,created_at);
alter table public.explanation_figure_candidates enable row level security;
revoke all on public.explanation_figure_candidates from public, anon, authenticated;
grant select,insert,update on public.explanation_figure_candidates to service_role;
-- Invoker-rights function; application must verify the admin via auth.getUser
-- and compare image/hash bytes before invoking. The explanation row is locked
-- so approval cannot race a concurrent change to the saved text.
create function public.review_explanation_figure(
 p_id uuid,p_decision text,p_reviewer uuid,p_visual_confirmed boolean,
 p_expected_explanation text,p_expected_explanation_sha text,p_expected_image_sha text,p_expected_image bytea
) returns text language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_question text; v_text text; v_status text;
begin
 if p_decision not in ('approved','rejected') or p_reviewer is null or (p_decision='approved' and p_visual_confirmed is distinct from true) then return 'invalid'; end if;
 select question_id into v_question from public.explanation_figure_candidates where id=p_id and status='pending';
 if not found then return 'not_pending'; end if;
 select explanation into v_text from public.question_explanation_overrides where question_id=v_question for update;
 if not found or v_text is distinct from p_expected_explanation then return 'stale'; end if;
 update public.explanation_figure_candidates set status=p_decision,reviewer_id=p_reviewer,reviewed_at=now(),image_bytes=case when p_decision='rejected' then null else image_bytes end
 where id=p_id and status='pending' and explanation_sha256=p_expected_explanation_sha and image_sha256=p_expected_image_sha and image_bytes=p_expected_image
 returning status into v_status;
 return coalesce(v_status,'conflict');
end; $$;
revoke all on function public.review_explanation_figure(uuid,text,uuid,boolean,text,text,text,bytea) from public,anon,authenticated;
grant execute on function public.review_explanation_figure(uuid,text,uuid,boolean,text,text,text,bytea) to service_role;
-- Public-facing servers call these with service_role only. Re-evaluate the
-- original text and image hash on every read; pending/rejected are never returned.
create function public.list_approved_explanation_figures(p_question text)
returns table(id uuid,source_url text,license_url text,license text,attribution text,section_title text)
language sql stable security invoker set search_path = pg_catalog, public as $$
 select c.id,c.source_url,c.license_url,c.license,c.attribution,c.section_title
 from public.explanation_figure_candidates c join public.question_explanation_overrides q on q.question_id=c.question_id
 where c.status='approved' and c.question_id=p_question
 and encode(sha256(convert_to(q.explanation,'UTF8')),'hex')=c.explanation_sha256
 and encode(sha256(c.image_bytes),'hex')=c.image_sha256
 order by c.reviewed_at,c.id limit 3;
$$;
create function public.read_approved_explanation_figure(p_id uuid)
returns table(image_mime text,image_bytes bytea,image_sha256 text)
language sql stable security invoker set search_path = pg_catalog, public as $$
 select c.image_mime,c.image_bytes,c.image_sha256
 from public.explanation_figure_candidates c join public.question_explanation_overrides q on q.question_id=c.question_id
 where c.id=p_id and c.status='approved'
 and encode(sha256(convert_to(q.explanation,'UTF8')),'hex')=c.explanation_sha256
 and encode(sha256(c.image_bytes),'hex')=c.image_sha256;
$$;
revoke all on function public.list_approved_explanation_figures(text) from public,anon,authenticated;
revoke all on function public.read_approved_explanation_figure(uuid) from public,anon,authenticated;
grant execute on function public.list_approved_explanation_figures(text) to service_role;
grant execute on function public.read_approved_explanation_figure(uuid) to service_role;
commit;
