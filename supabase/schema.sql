create extension if not exists pgcrypto;

create table if not exists public.quiz_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default '解剖學',
  started_at timestamptz not null,
  completed_at timestamptz,
  session_payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.quiz_sessions
  add column if not exists mode text,
  add column if not exists session_name text,
  add column if not exists question_count integer not null default 0,
  add column if not exists correct_count integer not null default 0,
  add column if not exists wrong_count integer not null default 0,
  add column if not exists average_confidence numeric(5,2);

create index if not exists quiz_sessions_user_id_idx on public.quiz_sessions (user_id);
create index if not exists quiz_sessions_completed_at_idx on public.quiz_sessions (completed_at desc);
create index if not exists quiz_sessions_mode_completed_at_idx
on public.quiz_sessions (mode, completed_at desc);
create index if not exists quiz_sessions_user_id_completed_at_idx
on public.quiz_sessions (user_id, completed_at desc);
create index if not exists quiz_sessions_user_id_updated_at_idx
on public.quiz_sessions (user_id, updated_at desc);

grant select, insert, update, delete
  on public.quiz_sessions
  to authenticated;

grant select, insert, update, delete
  on public.quiz_sessions
  to service_role;

alter table public.quiz_sessions enable row level security;

drop policy if exists "Users can read their own quiz sessions" on public.quiz_sessions;
drop policy if exists "Users can insert their own quiz sessions" on public.quiz_sessions;
drop policy if exists "Users can update their own quiz sessions" on public.quiz_sessions;
drop policy if exists "Users can delete their own quiz sessions" on public.quiz_sessions;

create policy "Users can read their own quiz sessions"
on public.quiz_sessions
for select
using ((select auth.uid()) = user_id);

create policy "Users can insert their own quiz sessions"
on public.quiz_sessions
for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update their own quiz sessions"
on public.quiz_sessions
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own quiz sessions"
on public.quiz_sessions
for delete
using ((select auth.uid()) = user_id);

create table if not exists public.quiz_session_attempts (
  session_id text not null references public.quiz_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_order integer not null,
  question_id text not null,
  selected_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  confidence smallint,
  error_type text,
  answered_at timestamptz not null,
  source_mode text,
  subject_snapshot text,
  chapter_snapshot text,
  section_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, question_order)
);

create index if not exists quiz_session_attempts_user_id_idx
on public.quiz_session_attempts (user_id, answered_at desc);

create index if not exists quiz_session_attempts_session_id_idx
on public.quiz_session_attempts (session_id, question_order);

create index if not exists quiz_session_attempts_question_id_idx
on public.quiz_session_attempts (question_id);

create index if not exists quiz_session_attempts_user_id_question_id_answered_at_idx
on public.quiz_session_attempts (user_id, question_id, answered_at desc);

grant select, insert, update, delete
  on public.quiz_session_attempts
  to authenticated;

grant select, insert, update, delete
  on public.quiz_session_attempts
  to service_role;

alter table public.quiz_session_attempts enable row level security;

drop policy if exists "Users can read their own quiz session attempts" on public.quiz_session_attempts;
drop policy if exists "Users can insert their own quiz session attempts" on public.quiz_session_attempts;
drop policy if exists "Users can update their own quiz session attempts" on public.quiz_session_attempts;
drop policy if exists "Users can delete their own quiz session attempts" on public.quiz_session_attempts;

create policy "Users can read their own quiz session attempts"
on public.quiz_session_attempts
for select
using ((select auth.uid()) = user_id);

create policy "Users can insert their own quiz session attempts"
on public.quiz_session_attempts
for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update their own quiz session attempts"
on public.quiz_session_attempts
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own quiz session attempts"
on public.quiz_session_attempts
for delete
using ((select auth.uid()) = user_id);

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

drop policy if exists "Anyone can read leaderboard profiles" on public.leaderboard_profiles;
drop policy if exists "Users can insert their own leaderboard profile" on public.leaderboard_profiles;
drop policy if exists "Users can update their own leaderboard profile" on public.leaderboard_profiles;

create policy "Anyone can read leaderboard profiles"
on public.leaderboard_profiles
for select
using (true);

create policy "Users can insert their own leaderboard profile"
on public.leaderboard_profiles
for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update their own leaderboard profile"
on public.leaderboard_profiles
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.site_visitors (
  visitor_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists site_visitors_last_seen_at_idx
on public.site_visitors (last_seen_at desc);

create index if not exists site_visitors_user_id_idx
on public.site_visitors (user_id);

revoke all on public.site_visitors from anon;
revoke all on public.site_visitors from authenticated;

grant select, insert, update, delete
  on public.site_visitors
  to service_role;

alter table public.site_visitors enable row level security;

drop policy if exists "Anyone can read site visitors" on public.site_visitors;
drop policy if exists "Anyone can insert site visitors" on public.site_visitors;
drop policy if exists "Anyone can update site visitors" on public.site_visitors;
drop policy if exists "Service role can manage site visitors" on public.site_visitors;

create policy "Service role can manage site visitors"
on public.site_visitors
for all
to service_role
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

alter table public.question_attempt_logs
  add column if not exists visitor_id text;

create index if not exists question_attempt_logs_question_id_idx
on public.question_attempt_logs (question_id);

create index if not exists question_attempt_logs_answered_at_idx
on public.question_attempt_logs (answered_at desc);

create index if not exists question_attempt_logs_is_correct_answered_at_idx
on public.question_attempt_logs (is_correct, answered_at desc);

create index if not exists question_attempt_logs_visitor_id_idx
on public.question_attempt_logs (visitor_id);

create index if not exists question_attempt_logs_visitor_id_answered_at_idx
on public.question_attempt_logs (visitor_id, answered_at desc)
where visitor_id is not null;

revoke all on public.question_attempt_logs from anon;
revoke all on public.question_attempt_logs from authenticated;

grant select, insert, update, delete
  on public.question_attempt_logs
  to service_role;

alter table public.question_attempt_logs enable row level security;

drop policy if exists "Anyone can insert question attempt logs" on public.question_attempt_logs;
drop policy if exists "Anyone can update question attempt logs" on public.question_attempt_logs;
drop policy if exists "Service role can manage question attempt logs" on public.question_attempt_logs;

create policy "Service role can manage question attempt logs"
on public.question_attempt_logs
for all
to service_role
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

grant select
  on public.question_accuracy_stats
  to authenticated;

grant select, insert, update, delete
  on public.question_accuracy_stats
  to service_role;

alter table public.question_accuracy_stats enable row level security;

drop policy if exists "Anyone can read question accuracy stats" on public.question_accuracy_stats;
drop policy if exists "Anyone can insert question accuracy stats" on public.question_accuracy_stats;
drop policy if exists "Anyone can update question accuracy stats" on public.question_accuracy_stats;
drop policy if exists "Service role can manage question accuracy stats" on public.question_accuracy_stats;

create policy "Anyone can read question accuracy stats"
on public.question_accuracy_stats
for select
using (true);

create policy "Service role can manage question accuracy stats"
on public.question_accuracy_stats
for all
to service_role
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

grant select
  on public.question_explanation_overrides
  to authenticated;

grant select, insert, update, delete
  on public.question_explanation_overrides
  to service_role;

alter table public.question_explanation_overrides enable row level security;

drop policy if exists "Anyone can read question explanation overrides" on public.question_explanation_overrides;
drop policy if exists "Authenticated users can insert question explanation overrides" on public.question_explanation_overrides;
drop policy if exists "Authenticated users can update question explanation overrides" on public.question_explanation_overrides;
drop policy if exists "Service role can manage question explanation overrides" on public.question_explanation_overrides;

create policy "Anyone can read question explanation overrides"
on public.question_explanation_overrides
for select
using (true);

create policy "Service role can manage question explanation overrides"
on public.question_explanation_overrides
for all
to service_role
using (true)
with check (true);

create table if not exists public.custom_papers (
  paper_code text primary key,
  name text,
  question_ids jsonb not null default '[]'::jsonb,
  question_payload jsonb,
  subject_filters jsonb not null default '[]'::jsonb,
  difficulty text not null,
  is_public boolean not null default false,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_by_email text,
  created_by_label text,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists custom_papers_created_at_idx
on public.custom_papers (created_at desc);

create index if not exists custom_papers_is_public_created_at_idx
on public.custom_papers (is_public, created_at desc);

create index if not exists custom_papers_created_by_user_id_idx
on public.custom_papers (created_by_user_id);

grant select, insert, update, delete
  on public.custom_papers
  to service_role;

alter table public.custom_papers enable row level security;

alter table public.custom_papers
  add column if not exists question_payload jsonb;

drop policy if exists "Anyone can read custom papers" on public.custom_papers;
drop policy if exists "Service role can manage custom papers" on public.custom_papers;

create policy "Service role can manage custom papers"
on public.custom_papers
for all
to service_role
using (true)
with check (true);

create table if not exists public.custom_paper_attempts (
  session_id text primary key,
  paper_code text not null references public.custom_papers (paper_code) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  participant_label text not null,
  visitor_id text,
  correct_count integer not null default 0,
  total_count integer not null default 0,
  accuracy_rate numeric(5,1) not null default 0,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_paper_attempts_paper_code_completed_at_idx
on public.custom_paper_attempts (paper_code, completed_at desc);

create index if not exists custom_paper_attempts_user_id_idx
on public.custom_paper_attempts (user_id);

grant select, insert, update, delete
  on public.custom_paper_attempts
  to service_role;

alter table public.custom_paper_attempts enable row level security;

drop policy if exists "Anyone can read custom paper attempts" on public.custom_paper_attempts;
drop policy if exists "Service role can manage custom paper attempts" on public.custom_paper_attempts;

create policy "Service role can manage custom paper attempts"
on public.custom_paper_attempts
for all
to service_role
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
revoke all on public.question_attempt_devices from authenticated;

grant select, insert, update, delete
  on public.question_attempt_devices
  to service_role;

alter table public.question_attempt_devices enable row level security;

drop policy if exists "Anyone can insert question attempt devices" on public.question_attempt_devices;
drop policy if exists "Anyone can update question attempt devices" on public.question_attempt_devices;
drop policy if exists "Service role can manage question attempt devices" on public.question_attempt_devices;

create policy "Service role can manage question attempt devices"
on public.question_attempt_devices
for all
to service_role
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
revoke all on public.question_attempt_device_daily from authenticated;

grant select, insert, update, delete
  on public.question_attempt_device_daily
  to service_role;

alter table public.question_attempt_device_daily enable row level security;

drop policy if exists "Anyone can insert question attempt device daily" on public.question_attempt_device_daily;
drop policy if exists "Anyone can update question attempt device daily" on public.question_attempt_device_daily;
drop policy if exists "Service role can manage question attempt device daily" on public.question_attempt_device_daily;

create policy "Service role can manage question attempt device daily"
on public.question_attempt_device_daily
for all
to service_role
using (true)
with check (true);

create table if not exists public.owner_daily_stats (
  activity_date date primary key,
  attempts integer not null default 0,
  correct_attempts integer not null default 0,
  devices integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.owner_daily_stats
  add column if not exists correct_attempts integer not null default 0;

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
drop policy if exists "Service role can manage owner daily stats" on public.owner_daily_stats;

create policy "Service role can manage owner daily stats"
on public.owner_daily_stats
for all
to service_role
using (true)
with check (true);

create table if not exists public.site_settings (
  setting_key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists site_settings_updated_at_idx
on public.site_settings (updated_at desc);

revoke all on public.site_settings from anon;
revoke all on public.site_settings from authenticated;

grant select, insert, update, delete
  on public.site_settings
  to service_role;

alter table public.site_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
drop policy if exists "Anyone can insert site settings" on public.site_settings;
drop policy if exists "Anyone can update site settings" on public.site_settings;
drop policy if exists "Service role can manage site settings" on public.site_settings;

create policy "Service role can manage site settings"
on public.site_settings
for all
to service_role
using (true)
with check (true);

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

create index if not exists ai_explanation_usage_logs_used_at_idx
on public.ai_explanation_usage_logs (used_at desc);

create index if not exists ai_explanation_usage_logs_user_email_idx
on public.ai_explanation_usage_logs (user_email);

create index if not exists ai_explanation_usage_logs_visitor_id_idx
on public.ai_explanation_usage_logs (visitor_id);

revoke all on public.ai_explanation_usage_logs from anon;
revoke all on public.ai_explanation_usage_logs from authenticated;

grant select, insert, update, delete
  on public.ai_explanation_usage_logs
  to service_role;

alter table public.ai_explanation_usage_logs enable row level security;

drop policy if exists "Anyone can insert ai explanation usage logs" on public.ai_explanation_usage_logs;
drop policy if exists "Service role can manage ai explanation usage logs" on public.ai_explanation_usage_logs;

create policy "Service role can manage ai explanation usage logs"
on public.ai_explanation_usage_logs
for all
to service_role
using (true)
with check (true);

create table if not exists public.yangming_mode_activations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  visitor_id text,
  user_agent text,
  enabled_at timestamptz not null default now()
);

alter table public.yangming_mode_activations
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.yangming_mode_activations
  add column if not exists user_email text;

alter table public.yangming_mode_activations
  add column if not exists visitor_id text;

alter table public.yangming_mode_activations
  add column if not exists user_agent text;

alter table public.yangming_mode_activations
  add column if not exists enabled_at timestamptz not null default now();

create index if not exists yangming_mode_activations_enabled_at_idx
on public.yangming_mode_activations (enabled_at desc);

create index if not exists yangming_mode_activations_user_email_idx
on public.yangming_mode_activations (user_email);

create index if not exists yangming_mode_activations_visitor_id_idx
on public.yangming_mode_activations (visitor_id);

revoke all on public.yangming_mode_activations from anon;
revoke all on public.yangming_mode_activations from authenticated;

grant select, insert, update, delete
  on public.yangming_mode_activations
  to service_role;

alter table public.yangming_mode_activations enable row level security;

drop policy if exists "Anyone can read yangming mode activations" on public.yangming_mode_activations;
drop policy if exists "Anyone can insert yangming mode activations" on public.yangming_mode_activations;
drop policy if exists "Service role can manage yangming mode activations" on public.yangming_mode_activations;

create policy "Service role can manage yangming mode activations"
on public.yangming_mode_activations
for all
to service_role
using (true)
with check (true);

create table if not exists public.yangming_question_explanations (
  question_id text primary key,
  body text not null,
  author text,
  reviewer text,
  source_label text,
  source_file text,
  source_page_start integer,
  source_page_end integer,
  question_stem_snapshot text,
  answer_snapshot text,
  sections jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  match_status text,
  match_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.yangming_question_explanations
  add column if not exists body text;

alter table public.yangming_question_explanations
  add column if not exists author text;

alter table public.yangming_question_explanations
  add column if not exists reviewer text;

alter table public.yangming_question_explanations
  add column if not exists source_label text;

alter table public.yangming_question_explanations
  add column if not exists source_file text;

alter table public.yangming_question_explanations
  add column if not exists source_page_start integer;

alter table public.yangming_question_explanations
  add column if not exists source_page_end integer;

alter table public.yangming_question_explanations
  add column if not exists question_stem_snapshot text;

alter table public.yangming_question_explanations
  add column if not exists answer_snapshot text;

alter table public.yangming_question_explanations
  add column if not exists sections jsonb not null default '[]'::jsonb;

alter table public.yangming_question_explanations
  add column if not exists assets jsonb not null default '[]'::jsonb;

alter table public.yangming_question_explanations
  add column if not exists match_status text;

alter table public.yangming_question_explanations
  add column if not exists match_score numeric;

alter table public.yangming_question_explanations
  add column if not exists created_at timestamptz not null default now();

alter table public.yangming_question_explanations
  add column if not exists updated_at timestamptz not null default now();

create index if not exists yangming_question_explanations_updated_at_idx
on public.yangming_question_explanations (updated_at desc);

revoke all on public.yangming_question_explanations from anon;
revoke all on public.yangming_question_explanations from authenticated;

grant select, insert, update, delete
  on public.yangming_question_explanations
  to service_role;

alter table public.yangming_question_explanations enable row level security;

drop policy if exists "Anyone can read yangming question explanations" on public.yangming_question_explanations;
drop policy if exists "Anyone can insert yangming question explanations" on public.yangming_question_explanations;
drop policy if exists "Service role can manage yangming question explanations" on public.yangming_question_explanations;

create policy "Service role can manage yangming question explanations"
on public.yangming_question_explanations
for all
to service_role
using (true)
with check (true);

create table if not exists public.yangming_explanation_releases (
  version_id text primary key,
  label text,
  status text not null default 'candidate',
  is_active boolean not null default false,
  source_path text,
  storage_prefix text,
  rows_count integer not null default 0,
  assets_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint yangming_explanation_releases_status_check
    check (status in ('candidate', 'active', 'archived'))
);

alter table public.yangming_explanation_releases
  add column if not exists label text;

alter table public.yangming_explanation_releases
  add column if not exists status text not null default 'candidate';

alter table public.yangming_explanation_releases
  add column if not exists is_active boolean not null default false;

alter table public.yangming_explanation_releases
  add column if not exists source_path text;

alter table public.yangming_explanation_releases
  add column if not exists storage_prefix text;

alter table public.yangming_explanation_releases
  add column if not exists rows_count integer not null default 0;

alter table public.yangming_explanation_releases
  add column if not exists assets_count integer not null default 0;

alter table public.yangming_explanation_releases
  add column if not exists notes text;

alter table public.yangming_explanation_releases
  add column if not exists created_at timestamptz not null default now();

alter table public.yangming_explanation_releases
  add column if not exists updated_at timestamptz not null default now();

alter table public.yangming_explanation_releases
  add column if not exists activated_at timestamptz;

create unique index if not exists yangming_explanation_releases_one_active_idx
on public.yangming_explanation_releases (is_active)
where is_active;

revoke all on public.yangming_explanation_releases from anon;
revoke all on public.yangming_explanation_releases from authenticated;

grant select, insert, update, delete
  on public.yangming_explanation_releases
  to service_role;

alter table public.yangming_explanation_releases enable row level security;

drop policy if exists "Service role can manage yangming explanation releases" on public.yangming_explanation_releases;

create policy "Service role can manage yangming explanation releases"
on public.yangming_explanation_releases
for all
to service_role
using (true)
with check (true);

create table if not exists public.yangming_question_explanations_versioned (
  version_id text not null references public.yangming_explanation_releases (version_id) on delete cascade,
  question_id text not null,
  body text not null default '',
  author text,
  reviewer text,
  source_label text,
  source_file text,
  source_page_start integer,
  source_page_end integer,
  question_stem_snapshot text,
  answer_snapshot text,
  sections jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  match_status text,
  match_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, question_id)
);

alter table public.yangming_question_explanations_versioned
  add column if not exists version_id text;

alter table public.yangming_question_explanations_versioned
  add column if not exists question_id text;

alter table public.yangming_question_explanations_versioned
  add column if not exists body text not null default '';

alter table public.yangming_question_explanations_versioned
  add column if not exists author text;

alter table public.yangming_question_explanations_versioned
  add column if not exists reviewer text;

alter table public.yangming_question_explanations_versioned
  add column if not exists source_label text;

alter table public.yangming_question_explanations_versioned
  add column if not exists source_file text;

alter table public.yangming_question_explanations_versioned
  add column if not exists source_page_start integer;

alter table public.yangming_question_explanations_versioned
  add column if not exists source_page_end integer;

alter table public.yangming_question_explanations_versioned
  add column if not exists question_stem_snapshot text;

alter table public.yangming_question_explanations_versioned
  add column if not exists answer_snapshot text;

alter table public.yangming_question_explanations_versioned
  add column if not exists sections jsonb not null default '[]'::jsonb;

alter table public.yangming_question_explanations_versioned
  add column if not exists assets jsonb not null default '[]'::jsonb;

alter table public.yangming_question_explanations_versioned
  add column if not exists match_status text;

alter table public.yangming_question_explanations_versioned
  add column if not exists match_score numeric;

alter table public.yangming_question_explanations_versioned
  add column if not exists created_at timestamptz not null default now();

alter table public.yangming_question_explanations_versioned
  add column if not exists updated_at timestamptz not null default now();

create index if not exists yangming_question_explanations_versioned_question_id_idx
on public.yangming_question_explanations_versioned (question_id);

create index if not exists yangming_question_explanations_versioned_updated_at_idx
on public.yangming_question_explanations_versioned (updated_at desc);

revoke all on public.yangming_question_explanations_versioned from anon;
revoke all on public.yangming_question_explanations_versioned from authenticated;

grant select, insert, update, delete
  on public.yangming_question_explanations_versioned
  to service_role;

alter table public.yangming_question_explanations_versioned enable row level security;

drop policy if exists "Service role can manage versioned yangming question explanations" on public.yangming_question_explanations_versioned;

create policy "Service role can manage versioned yangming question explanations"
on public.yangming_question_explanations_versioned
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yangming-explanations',
  'yangming-explanations',
  true,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.yangming_explanation_reports (
  id bigint generated always as identity primary key,
  question_id text not null,
  reason text not null,
  report_type text not null default 'report',
  proposed_body text,
  previous_body text,
  previous_assets jsonb,
  kept_asset_indexes jsonb,
  applied_at timestamptz,
  user_id uuid references auth.users (id) on delete set null,
  reporter_email text,
  visitor_id text,
  source_label text,
  source_file text,
  created_at timestamptz not null default now()
);

alter table public.yangming_explanation_reports
  add column if not exists question_id text;

alter table public.yangming_explanation_reports
  add column if not exists reason text;

alter table public.yangming_explanation_reports
  add column if not exists report_type text not null default 'report';

alter table public.yangming_explanation_reports
  add column if not exists proposed_body text;

alter table public.yangming_explanation_reports
  add column if not exists previous_body text;

alter table public.yangming_explanation_reports
  add column if not exists previous_assets jsonb;

alter table public.yangming_explanation_reports
  add column if not exists kept_asset_indexes jsonb;

alter table public.yangming_explanation_reports
  add column if not exists applied_at timestamptz;

alter table public.yangming_explanation_reports
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.yangming_explanation_reports
  add column if not exists reporter_email text;

alter table public.yangming_explanation_reports
  add column if not exists visitor_id text;

alter table public.yangming_explanation_reports
  add column if not exists source_label text;

alter table public.yangming_explanation_reports
  add column if not exists source_file text;

alter table public.yangming_explanation_reports
  add column if not exists created_at timestamptz not null default now();

create index if not exists yangming_explanation_reports_created_at_idx
on public.yangming_explanation_reports (created_at desc);

create index if not exists yangming_explanation_reports_question_id_idx
on public.yangming_explanation_reports (question_id);

create index if not exists yangming_explanation_reports_user_id_created_at_idx
on public.yangming_explanation_reports (user_id, created_at desc);

revoke all on public.yangming_explanation_reports from anon;
revoke all on public.yangming_explanation_reports from authenticated;

grant select, insert, update, delete
  on public.yangming_explanation_reports
  to service_role;

alter table public.yangming_explanation_reports enable row level security;

drop policy if exists "Anyone can insert yangming explanation reports" on public.yangming_explanation_reports;
drop policy if exists "Service role can manage yangming explanation reports" on public.yangming_explanation_reports;

create policy "Service role can manage yangming explanation reports"
on public.yangming_explanation_reports
for all
to service_role
using (true)
with check (true);

create table if not exists public.feedback_messages (
  id bigint generated always as identity primary key,
  content text not null,
  parent_id bigint references public.feedback_messages (id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default true,
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now()
);

alter table public.feedback_messages
  add column if not exists parent_id bigint references public.feedback_messages (id) on delete cascade;

create index if not exists feedback_messages_created_at_idx
on public.feedback_messages (created_at desc);

create index if not exists feedback_messages_parent_id_created_at_idx
on public.feedback_messages (parent_id, created_at asc);

create index if not exists feedback_messages_user_id_created_at_idx
on public.feedback_messages (user_id, created_at desc);

create index if not exists feedback_messages_visitor_id_created_at_idx
on public.feedback_messages (visitor_id, created_at desc);

grant select
  on public.feedback_messages
  to anon;

grant select
  on public.feedback_messages
  to authenticated;

grant select, insert, update, delete
  on public.feedback_messages
  to service_role;

alter table public.feedback_messages enable row level security;

drop policy if exists "Anyone can read feedback messages" on public.feedback_messages;
drop policy if exists "Anyone can insert feedback messages" on public.feedback_messages;
drop policy if exists "Service role can manage feedback messages" on public.feedback_messages;

create policy "Anyone can read feedback messages"
on public.feedback_messages
for select
using (true);

create policy "Service role can manage feedback messages"
on public.feedback_messages
for all
to service_role
using (true)
with check (true);

create table if not exists public.feedback_message_votes (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.feedback_messages (id) on delete cascade,
  vote_value smallint not null check (vote_value in (-1, 1)),
  user_id uuid references auth.users (id) on delete cascade,
  visitor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_message_votes_actor_check check (user_id is not null or visitor_id is not null)
);

create unique index if not exists feedback_message_votes_user_unique_idx
on public.feedback_message_votes (message_id, user_id)
where user_id is not null;

create unique index if not exists feedback_message_votes_visitor_unique_idx
on public.feedback_message_votes (message_id, visitor_id)
where user_id is null and visitor_id is not null;

create index if not exists feedback_message_votes_message_id_idx
on public.feedback_message_votes (message_id);

grant select
  on public.feedback_message_votes
  to anon;

grant select
  on public.feedback_message_votes
  to authenticated;

grant select, insert, update, delete
  on public.feedback_message_votes
  to service_role;

alter table public.feedback_message_votes enable row level security;

drop policy if exists "Anyone can read feedback message votes" on public.feedback_message_votes;
drop policy if exists "Service role can manage feedback message votes" on public.feedback_message_votes;

create policy "Anyone can read feedback message votes"
on public.feedback_message_votes
for select
using (true);

create policy "Service role can manage feedback message votes"
on public.feedback_message_votes
for all
to service_role
using (true)
with check (true);

create table if not exists public.question_classification_reports (
  id bigint generated always as identity primary key,
  question_id text not null,
  current_subject text not null,
  current_chapter text,
  current_section text,
  suggested_subject text,
  suggested_chapter text,
  suggested_section text,
  reason text,
  model text,
  reporter_email text,
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists question_classification_reports_created_at_idx
on public.question_classification_reports (created_at desc);

create index if not exists question_classification_reports_question_id_idx
on public.question_classification_reports (question_id);

create index if not exists question_classification_reports_user_id_created_at_idx
on public.question_classification_reports (user_id, created_at desc);

create index if not exists question_classification_reports_visitor_id_created_at_idx
on public.question_classification_reports (visitor_id, created_at desc);

grant select, insert, update, delete
  on public.question_classification_reports
  to service_role;

alter table public.question_classification_reports enable row level security;

drop policy if exists "Anyone can insert classification reports" on public.question_classification_reports;
drop policy if exists "Service role can manage classification reports" on public.question_classification_reports;

create policy "Service role can manage classification reports"
on public.question_classification_reports
for all
to service_role
using (true)
with check (true);

alter table public.question_classification_reports
  add column if not exists applied_at timestamptz;

alter table public.question_classification_reports
  add column if not exists approved_by_email text;

create table if not exists public.question_issue_reports (
  id bigint generated always as identity primary key,
  question_id text not null,
  issue_type text not null default 'question_defect',
  current_subject text,
  current_chapter text,
  current_section text,
  question_stem text not null,
  question_options jsonb not null default '{}'::jsonb,
  answer text,
  accepted_answers text[] not null default '{}'::text[],
  explanation text,
  tested_concept text,
  reporter_email text,
  user_id uuid references auth.users (id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now(),
  review_status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by_email text,
  resolution_note text
);

alter table public.question_issue_reports
  add column if not exists review_status text not null default 'pending';

alter table public.question_issue_reports
  add column if not exists reviewed_at timestamptz;

alter table public.question_issue_reports
  add column if not exists reviewed_by_email text;

alter table public.question_issue_reports
  add column if not exists resolution_note text;

create index if not exists question_issue_reports_created_at_idx
on public.question_issue_reports (created_at desc);

create index if not exists question_issue_reports_question_id_idx
on public.question_issue_reports (question_id);

create index if not exists question_issue_reports_user_id_created_at_idx
on public.question_issue_reports (user_id, created_at desc);

create index if not exists question_issue_reports_review_status_created_at_idx
on public.question_issue_reports (review_status, created_at desc);

grant select, insert, update, delete
  on public.question_issue_reports
  to service_role;

alter table public.question_issue_reports enable row level security;

drop policy if exists "Service role can manage question issue reports" on public.question_issue_reports;

create policy "Service role can manage question issue reports"
on public.question_issue_reports
for all
to service_role
using (true)
with check (true);

create table if not exists public.pharmacology_review_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  drug_key text not null,
  drug_name text not null,
  category text not null,
  known_count integer not null default 0,
  unknown_count integer not null default 0,
  seen_count integer not null default 0,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, drug_key),
  constraint pharmacology_review_stats_known_count_check check (known_count >= 0),
  constraint pharmacology_review_stats_unknown_count_check check (unknown_count >= 0),
  constraint pharmacology_review_stats_seen_count_check check (seen_count >= 0)
);

create index if not exists pharmacology_review_stats_user_unknown_idx
on public.pharmacology_review_stats (user_id, unknown_count desc, updated_at desc);

grant select, insert, update, delete
  on public.pharmacology_review_stats
  to authenticated;

grant select, insert, update, delete
  on public.pharmacology_review_stats
  to service_role;

alter table public.pharmacology_review_stats enable row level security;

drop policy if exists "Users can read their own pharmacology review stats" on public.pharmacology_review_stats;
drop policy if exists "Users can insert their own pharmacology review stats" on public.pharmacology_review_stats;
drop policy if exists "Users can update their own pharmacology review stats" on public.pharmacology_review_stats;
drop policy if exists "Users can delete their own pharmacology review stats" on public.pharmacology_review_stats;
drop policy if exists "Service role can manage pharmacology review stats" on public.pharmacology_review_stats;

create policy "Users can read their own pharmacology review stats"
on public.pharmacology_review_stats
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own pharmacology review stats"
on public.pharmacology_review_stats
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own pharmacology review stats"
on public.pharmacology_review_stats
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own pharmacology review stats"
on public.pharmacology_review_stats
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Service role can manage pharmacology review stats"
on public.pharmacology_review_stats
for all
to service_role
using (true)
with check (true);

create table if not exists public.question_classification_overrides (
  question_id text primary key,
  subject text not null,
  chapter text not null,
  section text not null,
  source_report_id bigint references public.question_classification_reports (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists question_classification_overrides_updated_at_idx
on public.question_classification_overrides (updated_at desc);

create index if not exists question_classification_overrides_source_report_id_idx
on public.question_classification_overrides (source_report_id);

grant select
  on public.question_classification_overrides
  to anon;

grant select
  on public.question_classification_overrides
  to authenticated;

grant select, insert, update, delete
  on public.question_classification_overrides
  to service_role;

alter table public.question_classification_overrides enable row level security;

drop policy if exists "Anyone can read classification overrides" on public.question_classification_overrides;
drop policy if exists "Service role can manage classification overrides" on public.question_classification_overrides;

create policy "Anyone can read classification overrides"
on public.question_classification_overrides
for select
using (true);

create policy "Service role can manage classification overrides"
on public.question_classification_overrides
for all
to service_role
using (true)
with check (true);

create table if not exists public.peak_challenge_runs (
  session_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  participant_label text not null,
  score integer not null default 0,
  total_answered integer not null default 0,
  question_ids jsonb not null default '[]'::jsonb,
  source_breakdown jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists peak_challenge_runs_completed_at_idx
on public.peak_challenge_runs (completed_at desc);

create index if not exists peak_challenge_runs_user_email_idx
on public.peak_challenge_runs (user_email);

create index if not exists peak_challenge_runs_user_id_idx
on public.peak_challenge_runs (user_id);

grant select
  on public.peak_challenge_runs
  to anon;

grant select, insert, update, delete
  on public.peak_challenge_runs
  to service_role;

alter table public.peak_challenge_runs enable row level security;

drop policy if exists "Anyone can read peak challenge runs" on public.peak_challenge_runs;

create policy "Anyone can read peak challenge runs"
on public.peak_challenge_runs
for select
using (true);

create table if not exists public.peak_challenge_attempt_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  user_email text not null,
  visitor_id text,
  started_at timestamptz not null default now()
);

create index if not exists peak_challenge_attempt_logs_user_email_started_at_idx
on public.peak_challenge_attempt_logs (user_email, started_at desc);

create index if not exists peak_challenge_attempt_logs_user_id_idx
on public.peak_challenge_attempt_logs (user_id);

grant select, insert, update, delete
  on public.peak_challenge_attempt_logs
  to service_role;

alter table public.peak_challenge_attempt_logs enable row level security;

drop policy if exists "Service role can manage peak challenge attempt logs" on public.peak_challenge_attempt_logs;

create policy "Service role can manage peak challenge attempt logs"
on public.peak_challenge_attempt_logs
for all
to service_role
using (true)
with check (true);

create table if not exists public.shared_ai_questions (
  id text primary key,
  feature text not null,
  subject text not null,
  chapter text not null,
  section text not null,
  tested_concept text,
  question_payload jsonb not null,
  source_model text,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_ai_questions_feature_idx
on public.shared_ai_questions (feature, subject, chapter, section);

grant select, insert, update, delete
  on public.shared_ai_questions
  to service_role;

alter table public.shared_ai_questions enable row level security;

drop policy if exists "Service role can manage shared ai questions" on public.shared_ai_questions;

create policy "Service role can manage shared ai questions"
on public.shared_ai_questions
for all
to service_role
using (true)
with check (true);

create table if not exists public.ai_account_bans (
  user_email text primary key,
  banned_until timestamptz not null,
  reason text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_account_bans_banned_until_idx
on public.ai_account_bans (banned_until desc);

grant select, insert, update, delete
  on public.ai_account_bans
  to service_role;

alter table public.ai_account_bans enable row level security;

drop policy if exists "Service role can manage ai account bans" on public.ai_account_bans;

create policy "Service role can manage ai account bans"
on public.ai_account_bans
for all
to service_role
using (true)
with check (true);

create table if not exists public.study_note_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  subject text,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_note_collections
  add column if not exists subject text;

alter table public.study_note_collections
  add column if not exists display_order integer not null default 0;

alter table public.study_note_collections
  drop constraint if exists study_note_collections_user_id_name_key;

update public.study_note_collections collections
set subject = notes.subject
from (
  select collection_id, min(subject) as subject
  from public.study_notes
  where collection_id is not null
    and subject is not null
  group by collection_id
) notes
where collections.id = notes.collection_id
  and collections.subject is null;

create index if not exists study_note_collections_user_id_updated_at_idx
on public.study_note_collections (user_id, updated_at desc);

create unique index if not exists study_note_collections_user_id_subject_name_key
on public.study_note_collections (user_id, subject, name);

create index if not exists study_note_collections_user_id_subject_display_order_idx
on public.study_note_collections (user_id, subject, display_order, created_at);

grant select, insert, update, delete
  on public.study_note_collections
  to service_role;

alter table public.study_note_collections enable row level security;

drop policy if exists "Service role can manage study note collections" on public.study_note_collections;

create policy "Service role can manage study note collections"
on public.study_note_collections
for all
to service_role
using (true)
with check (true);

create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references public.study_note_collections (id) on delete set null,
  title text not null,
  raw_markdown text not null,
  summary text,
  subject text,
  chapter text,
  section text,
  source text not null default 'manual',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_notes
  add column if not exists display_order integer not null default 0;

create index if not exists study_notes_user_id_updated_at_idx
on public.study_notes (user_id, updated_at desc);

create index if not exists study_notes_user_id_subject_display_order_idx
on public.study_notes (user_id, subject, display_order, created_at);

create index if not exists study_notes_user_id_subject_idx
on public.study_notes (user_id, subject, updated_at desc);

create index if not exists study_notes_collection_id_idx
on public.study_notes (collection_id);

grant select, insert, update, delete
  on public.study_notes
  to service_role;

alter table public.study_notes enable row level security;

drop policy if exists "Service role can manage study notes" on public.study_notes;

create policy "Service role can manage study notes"
on public.study_notes
for all
to service_role
using (true)
with check (true);

create table if not exists public.study_note_tags (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.study_notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tag text not null,
  tag_type text not null default 'misc',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (note_id, tag_type, tag)
);

create index if not exists study_note_tags_user_id_tag_idx
on public.study_note_tags (user_id, tag_type, tag);

create index if not exists study_note_tags_note_id_idx
on public.study_note_tags (note_id);

grant select, insert, update, delete
  on public.study_note_tags
  to service_role;

alter table public.study_note_tags enable row level security;

drop policy if exists "Service role can manage study note tags" on public.study_note_tags;

create policy "Service role can manage study note tags"
on public.study_note_tags
for all
to service_role
using (true)
with check (true);

create table if not exists public.study_note_question_links (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.study_notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  relation_type text not null default 'related',
  confidence numeric(5,4),
  reason text,
  created_at timestamptz not null default now(),
  unique (note_id, question_id, relation_type)
);

create index if not exists study_note_question_links_user_id_question_id_idx
on public.study_note_question_links (user_id, question_id);

create index if not exists study_note_question_links_note_id_idx
on public.study_note_question_links (note_id);

grant select, insert, update, delete
  on public.study_note_question_links
  to service_role;

alter table public.study_note_question_links enable row level security;

drop policy if exists "Service role can manage study note question links" on public.study_note_question_links;

create policy "Service role can manage study note question links"
on public.study_note_question_links
for all
to service_role
using (true)
with check (true);

create table if not exists public.study_note_stars (
  note_id uuid not null references public.study_notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index if not exists study_note_stars_user_id_created_at_idx
on public.study_note_stars (user_id, created_at desc);

grant select, insert, update, delete
  on public.study_note_stars
  to service_role;

alter table public.study_note_stars enable row level security;

drop policy if exists "Service role can manage study note stars" on public.study_note_stars;

create policy "Service role can manage study note stars"
on public.study_note_stars
for all
to service_role
using (true)
with check (true);
