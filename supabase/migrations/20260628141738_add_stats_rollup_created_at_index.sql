create index if not exists question_attempt_logs_created_at_idx
on public.question_attempt_logs (created_at desc);
