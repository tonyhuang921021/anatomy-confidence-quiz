-- Keep public paper statistics separate from the write-heavy quiz history tables.
create table if not exists public.simulation_paper_scores (
  session_id text primary key,
  paper_key text not null check (paper_key ~ '^[A-Za-z0-9-]{3,80}$'),
  score smallint not null check (score between 0 and 100),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.simulation_paper_scores enable row level security;

revoke all on table public.simulation_paper_scores from anon, authenticated;
grant select, insert on table public.simulation_paper_scores to service_role;

create index if not exists simulation_paper_scores_paper_completed_idx
  on public.simulation_paper_scores (paper_key, completed_at desc)
  include (score);

-- One-time history backfill. The summary table contains no user id or answer data.
with completed_simulations as (
  select
    id as session_id,
    coalesce(
      nullif(session_payload #>> '{settings,selectedPaperKey}', ''),
      case
        when session_payload #>> '{questionOrder,0}' ~ '^AI-[A-Za-z0-9-]+-Q[0-9]+$'
          then regexp_replace(
            session_payload #>> '{questionOrder,0}',
            '-Q[0-9]+$',
            ''
          )
        when session_payload #>> '{questionOrder,0}' ~ '^MOEX-[A-Za-z0-9-]+-Q[0-9]+$'
          then regexp_replace(
            regexp_replace(
              session_payload #>> '{questionOrder,0}',
              '^MOEX-',
              ''
            ),
            '-Q[0-9]+$',
            ''
          )
        else null
      end
    ) as paper_key,
    correct_count::smallint as score,
    completed_at
  from public.quiz_sessions
  where mode = 'simulation'
    and completed_at is not null
    and correct_count + wrong_count = 100
    and correct_count > 3
)
insert into public.simulation_paper_scores (
  session_id,
  paper_key,
  score,
  completed_at
)
select
  session_id,
  paper_key,
  score,
  completed_at
from completed_simulations
where paper_key ~ '^[A-Za-z0-9-]{3,80}$'
on conflict (session_id) do nothing;

create or replace function public.get_simulation_paper_score_stats(
  p_paper_key text
)
returns table (
  sample_count bigint,
  average_score numeric,
  score_0_39 bigint,
  score_40_59 bigint,
  score_60_69 bigint,
  score_70_79 bigint,
  score_80_89 bigint,
  score_90_100 bigint
)
language sql
stable
set search_path = public, pg_temp
set statement_timeout = '1200ms'
as $$
  select
    count(*) as sample_count,
    round(avg(score), 1) as average_score,
    count(*) filter (where score between 0 and 39) as score_0_39,
    count(*) filter (where score between 40 and 59) as score_40_59,
    count(*) filter (where score between 60 and 69) as score_60_69,
    count(*) filter (where score between 70 and 79) as score_70_79,
    count(*) filter (where score between 80 and 89) as score_80_89,
    count(*) filter (where score between 90 and 100) as score_90_100
  from public.simulation_paper_scores
  where paper_key = p_paper_key;
$$;

revoke all on function public.get_simulation_paper_score_stats(text)
  from public, anon, authenticated;
grant execute on function public.get_simulation_paper_score_stats(text)
  to service_role;
