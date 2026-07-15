-- Aggregate changed question accuracy inside Postgres instead of paging raw attempts through Vercel.
create or replace function public.refresh_question_accuracy_stats_for_questions(
  p_question_ids text[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_rows integer := 0;
begin
  if coalesce(cardinality(p_question_ids), 0) = 0 then
    return 0;
  end if;

  with requested as (
    select distinct nullif(btrim(question_id), '') as question_id
    from unnest(p_question_ids) as input(question_id)
    where nullif(btrim(question_id), '') is not null
  ),
  aggregated as (
    select
      requested.question_id,
      count(logs.question_id)::integer as total_attempts,
      count(logs.question_id) filter (where logs.is_correct is true)::integer as correct_attempts
    from requested
    left join public.question_attempt_logs as logs
      on logs.question_id = requested.question_id
    group by requested.question_id
  )
  insert into public.question_accuracy_stats (
    question_id,
    total_attempts,
    correct_attempts,
    correct_rate,
    updated_at
  )
  select
    question_id,
    total_attempts,
    correct_attempts,
    case
      when total_attempts = 0 then 0
      else round((correct_attempts::numeric / total_attempts::numeric) * 100, 1)
    end,
    now()
  from aggregated
  on conflict (question_id) do update
  set total_attempts = excluded.total_attempts,
      correct_attempts = excluded.correct_attempts,
      correct_rate = excluded.correct_rate,
      updated_at = excluded.updated_at
  where public.question_accuracy_stats.total_attempts is distinct from excluded.total_attempts
     or public.question_accuracy_stats.correct_attempts is distinct from excluded.correct_attempts
     or public.question_accuracy_stats.correct_rate is distinct from excluded.correct_rate;

  get diagnostics changed_rows = row_count;
  return changed_rows;
end;
$$;

revoke all on function public.refresh_question_accuracy_stats_for_questions(text[]) from public, anon, authenticated;
grant execute on function public.refresh_question_accuracy_stats_for_questions(text[]) to service_role;
