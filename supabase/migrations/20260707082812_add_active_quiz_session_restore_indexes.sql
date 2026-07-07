-- Speed up active/review session recovery without changing completed history visibility.
create index if not exists quiz_sessions_user_mode_active_updated_idx
on public.quiz_sessions (user_id, mode, updated_at desc, started_at desc)
where completed_at is null and question_count > 0;

create index if not exists quiz_sessions_user_active_updated_idx
on public.quiz_sessions (user_id, updated_at desc, started_at desc)
where completed_at is null and question_count > 0;
