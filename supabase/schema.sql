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

grant select, insert, update, delete
  on public.quiz_sessions
  to authenticated;

grant select, insert, update, delete
  on public.quiz_sessions
  to service_role;

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

grant select
  on public.leaderboard_profiles
  to anon;

grant select, insert, update, delete
  on public.leaderboard_profiles
  to authenticated;

grant select, insert, update, delete
  on public.leaderboard_profiles
  to service_role;

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

grant select, insert, update
  on public.site_visitors
  to anon;

grant select, insert, update, delete
  on public.site_visitors
  to authenticated;

grant select, insert, update, delete
  on public.site_visitors
  to service_role;

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

create table if not exists public.question_attempt_logs (
  session_id text not null,
  question_id text not null,
  is_correct boolean not null,
  answered_at timestamptz not null,
  source_mode text,
  created_at timestamptz not null default now(),
  primary key (session_id, question_id)
);

create index if not exists question_attempt_logs_question_id_idx
on public.question_attempt_logs (question_id);

grant select, insert, update
  on public.question_attempt_logs
  to anon;

grant select, insert, update, delete
  on public.question_attempt_logs
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_logs
  to service_role;

alter table public.question_attempt_logs enable row level security;

drop policy if exists "Anyone can read question attempt logs" on public.question_attempt_logs;
drop policy if exists "Anyone can insert question attempt logs" on public.question_attempt_logs;
drop policy if exists "Anyone can update question attempt logs" on public.question_attempt_logs;

create policy "Anyone can read question attempt logs"
on public.question_attempt_logs
for select
using (true);

create policy "Anyone can insert question attempt logs"
on public.question_attempt_logs
for insert
with check (true);

create policy "Anyone can update question attempt logs"
on public.question_attempt_logs
for update
using (true)
with check (true);

create table if not exists public.question_accuracy_stats (
  question_id text primary key,
  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,
  correct_rate numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists question_accuracy_stats_correct_rate_idx
on public.question_accuracy_stats (correct_rate desc, total_attempts desc);

grant select
  on public.question_accuracy_stats
  to anon;

grant select, insert, update, delete
  on public.question_accuracy_stats
  to authenticated;

grant select, insert, update, delete
  on public.question_accuracy_stats
  to service_role;

alter table public.question_accuracy_stats enable row level security;

drop policy if exists "Anyone can read question accuracy stats" on public.question_accuracy_stats;
drop policy if exists "Anyone can insert question accuracy stats" on public.question_accuracy_stats;
drop policy if exists "Anyone can update question accuracy stats" on public.question_accuracy_stats;

create policy "Anyone can read question accuracy stats"
on public.question_accuracy_stats
for select
using (true);

create policy "Anyone can insert question accuracy stats"
on public.question_accuracy_stats
for insert
with check (true);

create policy "Anyone can update question accuracy stats"
on public.question_accuracy_stats
for update
using (true)
with check (true);

create table if not exists public.question_attempt_devices (
  visitor_id text primary key,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

create index if not exists question_attempt_devices_last_attempt_at_idx
on public.question_attempt_devices (last_attempt_at desc);

grant select, insert, update
  on public.question_attempt_devices
  to anon;

grant select, insert, update, delete
  on public.question_attempt_devices
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_devices
  to service_role;

alter table public.question_attempt_devices enable row level security;

drop policy if exists "Anyone can read question attempt devices" on public.question_attempt_devices;
drop policy if exists "Anyone can insert question attempt devices" on public.question_attempt_devices;
drop policy if exists "Anyone can update question attempt devices" on public.question_attempt_devices;

create policy "Anyone can read question attempt devices"
on public.question_attempt_devices
for select
using (true);

create policy "Anyone can insert question attempt devices"
on public.question_attempt_devices
for insert
with check (true);

create policy "Anyone can update question attempt devices"
on public.question_attempt_devices
for update
using (true)
with check (true);

create table if not exists public.question_attempt_device_daily (
  visitor_id text not null,
  activity_date date not null,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  primary key (visitor_id, activity_date)
);

create index if not exists question_attempt_device_daily_activity_date_idx
on public.question_attempt_device_daily (activity_date desc);

grant select, insert, update
  on public.question_attempt_device_daily
  to anon;

grant select, insert, update, delete
  on public.question_attempt_device_daily
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_device_daily
  to service_role;

alter table public.question_attempt_device_daily enable row level security;

drop policy if exists "Anyone can read question attempt device daily" on public.question_attempt_device_daily;
drop policy if exists "Anyone can insert question attempt device daily" on public.question_attempt_device_daily;
drop policy if exists "Anyone can update question attempt device daily" on public.question_attempt_device_daily;

create policy "Anyone can read question attempt device daily"
on public.question_attempt_device_daily
for select
using (true);

create policy "Anyone can insert question attempt device daily"
on public.question_attempt_device_daily
for insert
with check (true);

create policy "Anyone can update question attempt device daily"
on public.question_attempt_device_daily
for update
using (true)
with check (true);
