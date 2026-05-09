create table if not exists public.quiz_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default '解剖學',
  started_at timestamptz not null,
  completed_at timestamptz,
  session_payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists quiz_sessions_user_id_idx on public.quiz_sessions (user_id);
create index if not exists quiz_sessions_completed_at_idx on public.quiz_sessions (completed_at desc);

alter table public.quiz_sessions enable row level security;

create policy "Users can read their own quiz sessions"
on public.quiz_sessions
for select
using (auth.uid() = user_id);

create policy "Users can insert their own quiz sessions"
on public.quiz_sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own quiz sessions"
on public.quiz_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own quiz sessions"
on public.quiz_sessions
for delete
using (auth.uid() = user_id);
