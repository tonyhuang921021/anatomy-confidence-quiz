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

create table if not exists public.leaderboard_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,
  correct_rate numeric(5,2) not null default 0,
  total_sessions integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_profiles_total_attempts_idx
on public.leaderboard_profiles (total_attempts desc, correct_rate desc);

alter table public.leaderboard_profiles enable row level security;

create policy "Anyone can read leaderboard profiles"
on public.leaderboard_profiles
for select
using (true);

create policy "Users can insert their own leaderboard profile"
on public.leaderboard_profiles
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own leaderboard profile"
on public.leaderboard_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.site_visitors (
  visitor_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists site_visitors_last_seen_at_idx
on public.site_visitors (last_seen_at desc);

alter table public.site_visitors enable row level security;

drop policy if exists "Anyone can read site visitors" on public.site_visitors;
drop policy if exists "Anyone can insert site visitors" on public.site_visitors;
drop policy if exists "Anyone can update site visitors" on public.site_visitors;

create policy "Anyone can read site visitors"
on public.site_visitors
for select
using (true);

create policy "Anyone can insert site visitors"
on public.site_visitors
for insert
with check (true);

create policy "Anyone can update site visitors"
on public.site_visitors
for update
using (true)
with check (true);
