-- Server-only fixed recap snapshots. The JSON contains aggregate session rows only;
-- user identity remains in the owning column and is never included in exported images.
create table if not exists public.post_exam_recap_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_version text not null,
  cutoff_at timestamptz not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, snapshot_version)
);

alter table public.post_exam_recap_snapshots enable row level security;
alter table public.post_exam_recap_snapshots force row level security;

revoke all on table public.post_exam_recap_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.post_exam_recap_snapshots to service_role;

create table if not exists public.post_exam_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  public_alias text not null default '匿名考生' check (char_length(public_alias) between 1 and 20),
  disclose_scores boolean not null default true,
  med1_score smallint check (med1_score between 0 and 100),
  med2_score smallint check (med2_score between 0 and 100),
  share_scores boolean not null default true,
  study_reflection text not null default '' check (char_length(study_reflection) <= 2000),
  encouragement text not null default '' check (char_length(encouragement) <= 2000),
  client_meta jsonb not null default '{}'::jsonb check (jsonb_typeof(client_meta) = 'object'),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, user_id),
  check (disclose_scores or (med1_score is null and med2_score is null and not share_scores)),
  check (disclose_scores or not share_scores)
);

alter table public.post_exam_survey_responses enable row level security;
alter table public.post_exam_survey_responses force row level security;

revoke all on table public.post_exam_survey_responses from public, anon, authenticated;
grant select, insert, update, delete on table public.post_exam_survey_responses to service_role;

create index if not exists post_exam_survey_responses_user_updated_idx
  on public.post_exam_survey_responses (user_id, updated_at desc);

-- Return only the scalar fields needed for a user's completed full-length mock exams.
-- session_payload is inspected inside Postgres and is never sent to the browser.
create or replace function public.get_post_exam_simulation_rows(
  p_user_id uuid,
  p_cutoff timestamptz
)
returns table (
  session_id text,
  subject text,
  session_name text,
  paper_key text,
  score smallint,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
set statement_timeout = '2500ms'
as $$
  with normalized as (
    select
      id as session_id,
      subject,
      session_name,
      coalesce(
        nullif(session_payload #>> '{settings,selectedPaperKey}', ''),
        case
          when session_payload #>> '{questionOrder,0}' ~ '^AI-[A-Za-z0-9-]+-Q[0-9]+$'
            then regexp_replace(session_payload #>> '{questionOrder,0}', '-Q[0-9]+$', '')
          when session_payload #>> '{questionOrder,0}' ~ '^MOEX-.+-Q[0-9]+$'
            then regexp_replace(
              regexp_replace(session_payload #>> '{questionOrder,0}', '^MOEX-', ''),
              '-Q[0-9]+$',
              ''
            )
          else null
        end
      ) as paper_key,
      correct_count::smallint as score,
      completed_at
    from public.quiz_sessions
    where user_id = p_user_id
      and mode = 'simulation'
      and completed_at is not null
      and completed_at <= p_cutoff
      and (
        question_count = 100
        or coalesce(correct_count, 0) + coalesce(wrong_count, 0) = 100
      )
      and correct_count > 3
  )
  select
    session_id,
    subject,
    session_name,
    paper_key,
    score,
    completed_at
  from normalized
  where paper_key ~ '^[A-Za-z0-9-]{3,80}$'
  order by completed_at asc;
$$;

revoke all on function public.get_post_exam_simulation_rows(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_post_exam_simulation_rows(uuid, timestamptz)
  to service_role;
