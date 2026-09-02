-- Regrade the eight questions changed by the official 115-2 appeal result.
-- Preserve every selected answer, confidence value, timestamp and session identity.

alter table public.question_attempt_logs
  add column if not exists selected_answer text;

alter table public.quiz_session_attempts
  add column if not exists answer_key_revision text,
  add column if not exists is_correct_before_revision boolean;

create temporary table answer_key_revision_115090 (
  question_id text primary key,
  accepted_answers text[] not null,
  all_credit boolean not null default false
) on commit drop;

insert into answer_key_revision_115090 (question_id, accepted_answers, all_credit)
values
  ('MOEX-115090-1301-Q063', array['B', 'D'], false),
  ('MOEX-115090-1301-Q066', array['A', 'B', 'C', 'D'], true),
  ('MOEX-115090-2301-Q014', array['A', 'B', 'C', 'D'], true),
  ('MOEX-115090-2301-Q025', array['A', 'B', 'C', 'D'], true),
  ('MOEX-115090-2301-Q055', array['A', 'B', 'C', 'D'], true),
  ('MOEX-115090-2301-Q068', array['A', 'B', 'C', 'D'], true),
  ('MOEX-115090-2301-Q095', array['A', 'D'], false),
  ('MOEX-115090-2301-Q098', array['A', 'B', 'C', 'D'], true);

create temporary table affected_sessions_115090 (
  session_id text primary key
) on commit drop;

insert into affected_sessions_115090 (session_id)
select distinct attempt.session_id
from public.quiz_session_attempts as attempt
join answer_key_revision_115090 as revision
  on revision.question_id = attempt.question_id
on conflict (session_id) do nothing;

insert into affected_sessions_115090 (session_id)
select distinct session.id
from public.quiz_sessions as session
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(session.session_payload -> 'attempts') = 'array'
      then session.session_payload -> 'attempts'
    else '[]'::jsonb
  end
) as payload_attempt(value)
join answer_key_revision_115090 as revision
  on revision.question_id = payload_attempt.value ->> 'questionId'
on conflict (session_id) do nothing;

update public.quiz_session_attempts as attempt
set is_correct_before_revision = case
      when attempt.answer_key_revision = 'moex-115090-appeal-v1'
        then attempt.is_correct_before_revision
      else attempt.is_correct
    end,
    answer_key_revision = 'moex-115090-appeal-v1',
    is_correct = revision.all_credit
      or upper(attempt.selected_answer) = any(revision.accepted_answers),
    error_type = case
      when revision.all_credit
        or upper(attempt.selected_answer) = any(revision.accepted_answers)
        then null
      else attempt.error_type
    end,
    updated_at = now()
from answer_key_revision_115090 as revision
where attempt.question_id = revision.question_id
  and (
    attempt.answer_key_revision is distinct from 'moex-115090-appeal-v1'
    or attempt.is_correct_before_revision is null
    or
    attempt.is_correct is distinct from (
      revision.all_credit
      or upper(attempt.selected_answer) = any(revision.accepted_answers)
    )
    or (
      (
        revision.all_credit
        or upper(attempt.selected_answer) = any(revision.accepted_answers)
      )
      and attempt.error_type is not null
    )
  );

with revised_payloads as (
  select
    session.id,
    jsonb_agg(
      case
        when revision.question_id is null then payload_attempt.value
        when revision.all_credit
          or upper(payload_attempt.value ->> 'selectedAnswer') = any(revision.accepted_answers)
          then (payload_attempt.value - 'errorType') || jsonb_build_object('isCorrect', true)
        else payload_attempt.value || jsonb_build_object('isCorrect', false)
      end
      order by payload_attempt.ordinality
    ) as attempts
  from public.quiz_sessions as session
  join affected_sessions_115090 as affected
    on affected.session_id = session.id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(session.session_payload -> 'attempts') = 'array'
        then session.session_payload -> 'attempts'
      else '[]'::jsonb
    end
  ) with ordinality as payload_attempt(value, ordinality)
  left join answer_key_revision_115090 as revision
    on revision.question_id = payload_attempt.value ->> 'questionId'
  group by session.id
)
update public.quiz_sessions as session
set session_payload = jsonb_set(
      session.session_payload,
      '{attempts}',
      revised_payloads.attempts,
      false
    )
from revised_payloads
where session.id = revised_payloads.id
  and session.session_payload -> 'attempts' is distinct from revised_payloads.attempts;

create temporary table affected_session_scores_115090 on commit drop as
select
  attempt.session_id,
  count(*)::integer as total_count,
  count(*) filter (where attempt.is_correct)::integer as correct_count
from public.quiz_session_attempts as attempt
join affected_sessions_115090 as affected
  on affected.session_id = attempt.session_id
group by attempt.session_id;

update public.quiz_sessions as session
set session_payload = jsonb_set(
      session.session_payload,
      '{scoreRevisions}',
      (
        case
          when jsonb_typeof(session.session_payload -> 'scoreRevisions') = 'array'
            then session.session_payload -> 'scoreRevisions'
          else '[]'::jsonb
        end
      ) || jsonb_build_array(
        jsonb_build_object(
          'revisionId', 'moex-115090-appeal-v1',
          'previousCorrectCount', session.correct_count,
          'regradedCorrectCount', scores.correct_count,
          'totalCount', scores.total_count,
          'appliedAt', '2026-09-02'
        )
      ),
      true
    )
from affected_session_scores_115090 as scores
where session.id = scores.session_id
  and session.correct_count is distinct from scores.correct_count
  and not exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(session.session_payload -> 'scoreRevisions') = 'array'
          then session.session_payload -> 'scoreRevisions'
        else '[]'::jsonb
      end
    ) as revision(value)
    where revision.value ->> 'revisionId' = 'moex-115090-appeal-v1'
  );

update public.quiz_sessions as session
set correct_count = scores.correct_count,
    wrong_count = scores.total_count - scores.correct_count
from affected_session_scores_115090 as scores
where session.id = scores.session_id
  and (
    session.correct_count is distinct from scores.correct_count
    or session.wrong_count is distinct from scores.total_count - scores.correct_count
  );

update public.leaderboard_session_rollups as rollup
set attempts = scores.total_count,
    correct_attempts = scores.correct_count,
    counted_at = now()
from affected_session_scores_115090 as scores
where rollup.session_id = scores.session_id
  and (
    rollup.attempts is distinct from scores.total_count
    or rollup.correct_attempts is distinct from scores.correct_count
  );

with affected_users as (
  select distinct session.user_id
  from public.quiz_sessions as session
  join affected_sessions_115090 as affected
    on affected.session_id = session.id
),
totals as (
  select
    rollup.user_id,
    coalesce(sum(rollup.attempts), 0)::integer as total_attempts,
    coalesce(sum(rollup.correct_attempts), 0)::integer as correct_attempts,
    count(*)::integer as total_sessions
  from public.leaderboard_session_rollups as rollup
  join affected_users as affected
    on affected.user_id = rollup.user_id
  group by rollup.user_id
)
update public.leaderboard_profiles as profile
set total_attempts = totals.total_attempts,
    correct_attempts = totals.correct_attempts,
    correct_rate = case
      when totals.total_attempts = 0 then 0
      else round((totals.correct_attempts::numeric / totals.total_attempts::numeric) * 100, 2)
    end,
    total_sessions = totals.total_sessions,
    updated_at = now()
from totals
where profile.user_id = totals.user_id
  and (
    profile.total_attempts is distinct from totals.total_attempts
    or profile.correct_attempts is distinct from totals.correct_attempts
    or profile.total_sessions is distinct from totals.total_sessions
  );

update public.simulation_paper_scores as paper_score
set score = round(
      (scores.correct_count::numeric / nullif(scores.total_count, 0)) * 100
    )::smallint
from affected_session_scores_115090 as scores
where paper_score.session_id = scores.session_id
  and scores.total_count > 0
  and paper_score.score is distinct from round(
    (scores.correct_count::numeric / scores.total_count::numeric) * 100
  )::smallint;

update public.custom_paper_attempts as paper_attempt
set correct_count = scores.correct_count,
    total_count = scores.total_count,
    accuracy_rate = case
      when scores.total_count = 0 then 0
      else round((scores.correct_count::numeric / scores.total_count::numeric) * 100, 1)
    end
from affected_session_scores_115090 as scores
where (
    paper_attempt.session_id = scores.session_id
    or paper_attempt.session_id = regexp_replace(scores.session_id, '^user-[^:]+:', '')
  )
  and (
    paper_attempt.correct_count is distinct from scores.correct_count
    or paper_attempt.total_count is distinct from scores.total_count
    or paper_attempt.accuracy_rate is distinct from case
      when scores.total_count = 0 then 0
      else round((scores.correct_count::numeric / scores.total_count::numeric) * 100, 1)
    end
  );

with latest_attempts as (
  select distinct on (
    regexp_replace(attempt.session_id, '^user-[^:]+:', ''),
    attempt.question_id
  )
    regexp_replace(attempt.session_id, '^user-[^:]+:', '') as session_id,
    attempt.question_id,
    attempt.selected_answer,
    attempt.is_correct
  from public.quiz_session_attempts as attempt
  join answer_key_revision_115090 as revision
    on revision.question_id = attempt.question_id
  order by
    regexp_replace(attempt.session_id, '^user-[^:]+:', ''),
    attempt.question_id,
    attempt.question_order desc
)
update public.question_attempt_logs as log
set selected_answer = latest_attempts.selected_answer,
    is_correct = latest_attempts.is_correct
from latest_attempts
where log.session_id = latest_attempts.session_id
  and log.question_id = latest_attempts.question_id
  and (
    log.selected_answer is distinct from latest_attempts.selected_answer
    or log.is_correct is distinct from latest_attempts.is_correct
  );

update public.question_attempt_logs as log
set is_correct = true
from answer_key_revision_115090 as revision
where log.question_id = revision.question_id
  and revision.all_credit
  and log.is_correct is distinct from true;

update public.question_attempt_logs as log
set is_correct = upper(log.selected_answer) = any(revision.accepted_answers)
from answer_key_revision_115090 as revision
where log.question_id = revision.question_id
  and not revision.all_credit
  and log.selected_answer is not null
  and log.is_correct is distinct from
    (upper(log.selected_answer) = any(revision.accepted_answers));

select public.refresh_question_accuracy_stats_for_questions(
  array(select question_id from answer_key_revision_115090 order by question_id)
);

with affected_dates as (
  select distinct (log.answered_at at time zone 'Asia/Taipei')::date as activity_date
  from public.question_attempt_logs as log
  join answer_key_revision_115090 as revision
    on revision.question_id = log.question_id
),
daily as (
  select
    (log.answered_at at time zone 'Asia/Taipei')::date as activity_date,
    count(*)::integer as attempts,
    count(*) filter (where log.is_correct)::integer as correct_attempts
  from public.question_attempt_logs as log
  join affected_dates as affected
    on affected.activity_date = (log.answered_at at time zone 'Asia/Taipei')::date
  group by (log.answered_at at time zone 'Asia/Taipei')::date
)
update public.owner_daily_stats as owner_stats
set attempts = daily.attempts,
    correct_attempts = daily.correct_attempts,
    updated_at = now()
from daily
where owner_stats.activity_date = daily.activity_date
  and (
    owner_stats.attempts is distinct from daily.attempts
    or owner_stats.correct_attempts is distinct from daily.correct_attempts
  );
