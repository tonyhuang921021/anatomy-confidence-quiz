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

create index if not exists question_attempt_logs_answered_at_idx
on public.question_attempt_logs (answered_at desc);

create index if not exists question_attempt_logs_visitor_id_idx
on public.question_attempt_logs (visitor_id);

revoke all on public.question_attempt_logs from anon;

grant insert, update
  on public.question_attempt_logs
  to anon;

grant select, insert, update, delete
  on public.question_attempt_logs
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_logs
  to service_role;

alter table public.question_attempt_logs enable row level security;

drop policy if exists "Anyone can insert question attempt logs" on public.question_attempt_logs;
drop policy if exists "Anyone can update question attempt logs" on public.question_attempt_logs;

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

create table if not exists public.question_explanation_overrides (
  question_id text primary key,
  explanation text not null,
  option_analysis jsonb not null default '{}'::jsonb,
  memory_tip text,
  model text,
  updated_at timestamptz not null default now()
);

create index if not exists question_explanation_overrides_updated_at_idx
on public.question_explanation_overrides (updated_at desc);

grant select
  on public.question_explanation_overrides
  to anon;

grant select, insert, update, delete
  on public.question_explanation_overrides
  to authenticated;

grant select, insert, update, delete
  on public.question_explanation_overrides
  to service_role;

alter table public.question_explanation_overrides enable row level security;

drop policy if exists "Anyone can read question explanation overrides" on public.question_explanation_overrides;
drop policy if exists "Authenticated users can insert question explanation overrides" on public.question_explanation_overrides;
drop policy if exists "Authenticated users can update question explanation overrides" on public.question_explanation_overrides;

create policy "Anyone can read question explanation overrides"
on public.question_explanation_overrides
for select
using (true);

create policy "Authenticated users can insert question explanation overrides"
on public.question_explanation_overrides
for insert
to authenticated
with check (true);

create policy "Authenticated users can update question explanation overrides"
on public.question_explanation_overrides
for update
to authenticated
using (true)
with check (true);

create table if not exists public.question_attempt_devices (
  visitor_id text primary key,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

create index if not exists question_attempt_devices_last_attempt_at_idx
on public.question_attempt_devices (last_attempt_at desc);

revoke all on public.question_attempt_devices from anon;

grant insert, update
  on public.question_attempt_devices
  to anon;

grant select, insert, update, delete
  on public.question_attempt_devices
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_devices
  to service_role;

alter table public.question_attempt_devices enable row level security;

drop policy if exists "Anyone can insert question attempt devices" on public.question_attempt_devices;
drop policy if exists "Anyone can update question attempt devices" on public.question_attempt_devices;

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

create index if not exists question_attempt_device_daily_visitor_id_idx
on public.question_attempt_device_daily (visitor_id);

revoke all on public.question_attempt_device_daily from anon;

grant insert, update
  on public.question_attempt_device_daily
  to anon;

grant select, insert, update, delete
  on public.question_attempt_device_daily
  to authenticated;

grant select, insert, update, delete
  on public.question_attempt_device_daily
  to service_role;

alter table public.question_attempt_device_daily enable row level security;

drop policy if exists "Anyone can insert question attempt device daily" on public.question_attempt_device_daily;
drop policy if exists "Anyone can update question attempt device daily" on public.question_attempt_device_daily;

create policy "Anyone can insert question attempt device daily"
on public.question_attempt_device_daily
for insert
with check (true);

create policy "Anyone can update question attempt device daily"
on public.question_attempt_device_daily
for update
using (true)
with check (true);

create table if not exists public.owner_daily_stats (
  activity_date date primary key,
  attempts integer not null default 0,
  devices integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists owner_daily_stats_updated_at_idx
on public.owner_daily_stats (updated_at desc);

revoke all on public.owner_daily_stats from anon;
revoke all on public.owner_daily_stats from authenticated;

grant select, insert, update, delete
  on public.owner_daily_stats
  to service_role;

alter table public.owner_daily_stats enable row level security;

drop policy if exists "Anyone can read owner daily stats" on public.owner_daily_stats;
drop policy if exists "Anyone can insert owner daily stats" on public.owner_daily_stats;
drop policy if exists "Anyone can update owner daily stats" on public.owner_daily_stats;

create table if not exists public.ai_explanation_usage_logs (
  id bigint generated always as identity primary key,
  rate_key text not null,
  visitor_id text,
  user_email text,
  question_id text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  used_at timestamptz not null default now()
);

alter table public.ai_explanation_usage_logs
  add column if not exists input_tokens integer not null default 0;

alter table public.ai_explanation_usage_logs
  add column if not exists output_tokens integer not null default 0;

alter table public.ai_explanation_usage_logs
  add column if not exists total_tokens integer not null default 0;

create index if not exists ai_explanation_usage_logs_rate_key_used_at_idx
on public.ai_explanation_usage_logs (rate_key, used_at desc);

create index if not exists ai_explanation_usage_logs_user_email_idx
on public.ai_explanation_usage_logs (user_email);

create index if not exists ai_explanation_usage_logs_visitor_id_idx
on public.ai_explanation_usage_logs (visitor_id);

revoke all on public.ai_explanation_usage_logs from anon;

grant insert, update, delete
  on public.ai_explanation_usage_logs
  to authenticated;

grant select, insert, update, delete
  on public.ai_explanation_usage_logs
  to service_role;

alter table public.ai_explanation_usage_logs enable row level security;

drop policy if exists "Anyone can insert ai explanation usage logs" on public.ai_explanation_usage_logs;

create policy "Anyone can insert ai explanation usage logs"
on public.ai_explanation_usage_logs
for insert
to authenticated
with check (true);

create table if not exists public.feedback_messages (
  id bigint generated always as identity primary key,
  content text not null,
  display_name text,
  is_anonymous boolean not null default true,
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_created_at_idx
on public.feedback_messages (created_at desc);

create index if not exists feedback_messages_user_id_created_at_idx
on public.feedback_messages (user_id, created_at desc);

create index if not exists feedback_messages_visitor_id_created_at_idx
on public.feedback_messages (visitor_id, created_at desc);

grant select, insert
  on public.feedback_messages
  to anon;

grant select, insert, update, delete
  on public.feedback_messages
  to authenticated;

grant select, insert, update, delete
  on public.feedback_messages
  to service_role;

alter table public.feedback_messages enable row level security;

drop policy if exists "Anyone can read feedback messages" on public.feedback_messages;
drop policy if exists "Anyone can insert feedback messages" on public.feedback_messages;

create policy "Anyone can read feedback messages"
on public.feedback_messages
for select
using (true);

create policy "Anyone can insert feedback messages"
on public.feedback_messages
for insert
with check (true);
