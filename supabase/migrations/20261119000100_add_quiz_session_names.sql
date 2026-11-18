-- Candidate only: requires explicit production approval before applying.
-- Names do not touch quiz_sessions, answers, settings or completion receipts.
create table public.quiz_session_names (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.quiz_sessions(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.quiz_session_names enable row level security;
-- Only the authenticated server route writes after checking owner and completion.
revoke all on public.quiz_session_names from anon, authenticated;
grant select, insert, update, delete on public.quiz_session_names to service_role;
