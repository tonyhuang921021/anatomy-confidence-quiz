alter table public.quiz_sessions
add column if not exists progress_payload jsonb not null default '{}'::jsonb;

create or replace function public.skip_noop_quiz_session_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_static_payload jsonb;
  new_static_payload jsonb;
begin
  -- A discarded active session is a tombstone. Older tabs must not revive it.
  if old.mode = 'discarded' then
    return null;
  end if;

  -- Older clients put volatile progress inside the large session payload. When
  -- the immutable question pool is unchanged, retain that payload and move only
  -- the small progress fields so a checkpoint does not rewrite the full JSONB.
  if old.completed_at is null
    and new.completed_at is null
    and new.session_payload is distinct from old.session_payload
  then
    old_static_payload := coalesce(old.session_payload, '{}'::jsonb)
      - 'currentQuestionIndex'
      - 'isReviewingAnswer'
      - 'optionEliminationMap'
      - 'simulationElapsedSeconds'
      - 'simulationTimerDurationSeconds'
      - 'attempts';
    new_static_payload := coalesce(new.session_payload, '{}'::jsonb)
      - 'currentQuestionIndex'
      - 'isReviewingAnswer'
      - 'optionEliminationMap'
      - 'simulationElapsedSeconds'
      - 'simulationTimerDurationSeconds'
      - 'attempts';

    if new_static_payload is not distinct from old_static_payload then
      new.progress_payload := jsonb_strip_nulls(jsonb_build_object(
        'currentQuestionIndex', new.session_payload -> 'currentQuestionIndex',
        'isReviewingAnswer', new.session_payload -> 'isReviewingAnswer',
        'optionEliminationMap', new.session_payload -> 'optionEliminationMap',
        'simulationElapsedSeconds', new.session_payload -> 'simulationElapsedSeconds',
        'simulationTimerDurationSeconds', new.session_payload -> 'simulationTimerDurationSeconds'
      ));
      new.session_payload := old.session_payload;
    end if;
  end if;

  if new.user_id is not distinct from old.user_id
    and new.subject is not distinct from old.subject
    and new.started_at is not distinct from old.started_at
    and new.completed_at is not distinct from old.completed_at
    and new.session_payload is not distinct from old.session_payload
    and new.progress_payload is not distinct from old.progress_payload
    and new.mode is not distinct from old.mode
    and new.session_name is not distinct from old.session_name
    and new.question_count is not distinct from old.question_count
    and new.correct_count is not distinct from old.correct_count
    and new.wrong_count is not distinct from old.wrong_count
    and new.average_confidence is not distinct from old.average_confidence
  then
    return null;
  end if;

  return new;
end;
$$;
