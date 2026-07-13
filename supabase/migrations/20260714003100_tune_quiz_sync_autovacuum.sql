-- Keep planner statistics and dead-row cleanup current for the write-heavy quiz tables.
alter table public.quiz_session_attempts set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);

alter table public.quiz_sessions set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);

alter table public.question_attempt_logs set (
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);

alter table public.pharmacology_review_stats set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);
