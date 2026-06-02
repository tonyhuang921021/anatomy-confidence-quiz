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

create index if not exists question_attempt_logs_visitor_id_idx
on public.question_attempt_logs (visitor_id);

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
drop policy if exists "Service role can manage owner daily stats" on public.owner_daily_stats;

create policy "Service role can manage owner daily stats"
on public.owner_daily_stats
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
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists study_note_collections_user_id_updated_at_idx
on public.study_note_collections (user_id, updated_at desc);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_notes_user_id_updated_at_idx
on public.study_notes (user_id, updated_at desc);

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
