create table if not exists public.review_question_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  question_id text not null,
  state text not null check (state in ('resolved', 'unresolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, question_id)
);

create index if not exists review_question_states_user_scope_updated_idx
  on public.review_question_states (user_id, scope, updated_at desc);

alter table public.review_question_states enable row level security;

drop policy if exists "review question states select own" on public.review_question_states;
drop policy if exists "review question states insert own" on public.review_question_states;
drop policy if exists "review question states update own" on public.review_question_states;
drop policy if exists "review question states delete own" on public.review_question_states;

create policy "review question states select own"
  on public.review_question_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "review question states insert own"
  on public.review_question_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "review question states update own"
  on public.review_question_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "review question states delete own"
  on public.review_question_states
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.review_question_states to authenticated;

alter function public.skip_noop_quiz_session_attempt_update()
  set search_path = public, pg_temp;

alter function public.skip_noop_quiz_session_update()
  set search_path = public, pg_temp;
