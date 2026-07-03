create table if not exists public.pre_exam_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id text not null,
  visitor_id text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  answers jsonb not null default '[]'::jsonb,
  answer_summary jsonb not null default '{}'::jsonb,
  page_path text,
  user_agent text,
  client_meta jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

alter table public.pre_exam_survey_responses enable row level security;

revoke all on table public.pre_exam_survey_responses from anon;
revoke all on table public.pre_exam_survey_responses from authenticated;

create index if not exists pre_exam_survey_responses_survey_submitted_idx
  on public.pre_exam_survey_responses (survey_id, submitted_at desc);

create index if not exists pre_exam_survey_responses_user_idx
  on public.pre_exam_survey_responses (user_id)
  where user_id is not null;

create index if not exists pre_exam_survey_responses_visitor_idx
  on public.pre_exam_survey_responses (visitor_id)
  where visitor_id is not null;
