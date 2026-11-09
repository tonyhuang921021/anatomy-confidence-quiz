-- Candidate only: not installed. Preserve original pilot and closed jobs.
-- Add one service-only predicate for an immutable, settled sitewide identity.
begin;
create function explanation_private.sitewide_image_binding(p_id uuid,p_question text,p_text_sha text)
returns boolean language sql stable security definer set search_path=pg_catalog,public,explanation_private as $$
 select p_id is not null and p_question is not null and p_text_sha ~ '^[0-9a-f]{64}$' and exists(
  select 1 from explanation_private.sitewide_requests s
  join public.ai_guard_requests r on r.id=s.request_id and r.actor_id=s.actor_id and r.question_id=s.question_id
  join explanation_private.generation_results g on g.request_id=r.id and g.actor_id=r.actor_id
  where s.request_id=p_id and s.question_id=p_question and s.action in ('generate','replace')
  and r.result_committed and r.call_limit=1 and r.action_kind='explanation'
  and g.response_sha=encode(sha256(convert_to(g.response::text,'UTF8')),'hex')
  and g.response->>'model'=r.model
  and encode(sha256(convert_to(g.response->'value'->>'explanation','UTF8')),'hex')=p_text_sha
  and exists(select 1 from public.ai_guard_calls c where c.request_id=r.id and c.seq=1 and c.state='settled')
  and not exists(select 1 from public.ai_guard_calls c where c.request_id=r.id and c.state<>'settled')
 )
$$;
revoke all on function explanation_private.sitewide_image_binding(uuid,text,text) from public,anon,authenticated;
grant execute on function explanation_private.sitewide_image_binding(uuid,text,text) to service_role;
alter table public.figure_queue_jobs drop constraint figure_single_q020_batch;
alter table public.figure_queue_jobs add constraint figure_single_q020_batch check (
 ((state = 'done'::text) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q001'::text) AND (explanation_sha256 = 'f0466d93226044af9ea384b5c96665e8087ab0094c2d5446c9cfebd945cd6ca7'::text)) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q002'::text) AND (explanation_sha256 = '95cce750da4bad5a2b3ce3edbb9c48de4c3bfc1a364e38e97e4594a1cf8082a9'::text)) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q003'::text) AND (explanation_sha256 = 'c1829810209699bdf5ada7c6c6d1109d363ca6862e609b53e216510c73af4549'::text))) or explanation_private.sitewide_image_binding(request_id,question_id,explanation_sha256)
);
commit;

