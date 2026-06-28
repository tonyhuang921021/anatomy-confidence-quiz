create table if not exists public.saved_questions (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  source_context text check (source_context in ('search', 'quiz', 'results', 'review', 'saved')),
  correct_count integer not null default 0 check (correct_count >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  last_answered_at timestamptz,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists saved_questions_user_added_idx
on public.saved_questions (user_id, added_at desc);

create index if not exists saved_questions_user_updated_idx
on public.saved_questions (user_id, updated_at desc);

grant select, insert, update, delete
  on public.saved_questions
  to authenticated;

grant select, insert, update, delete
  on public.saved_questions
  to service_role;

alter table public.saved_questions enable row level security;

drop policy if exists "Users can read their own saved questions" on public.saved_questions;
drop policy if exists "Users can insert their own saved questions" on public.saved_questions;
drop policy if exists "Users can update their own saved questions" on public.saved_questions;
drop policy if exists "Users can delete their own saved questions" on public.saved_questions;
drop policy if exists "Service role can manage saved questions" on public.saved_questions;

create policy "Users can read their own saved questions"
on public.saved_questions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own saved questions"
on public.saved_questions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved questions"
on public.saved_questions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved questions"
on public.saved_questions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Service role can manage saved questions"
on public.saved_questions
for all
to service_role
using (true)
with check (true);
