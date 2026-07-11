create or replace function public.skip_noop_quiz_session_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- A discarded active session is a tombstone. Older tabs must not revive it.
  if old.mode = 'discarded' then
    return null;
  end if;

  if new.user_id is not distinct from old.user_id
    and new.subject is not distinct from old.subject
    and new.started_at is not distinct from old.started_at
    and new.completed_at is not distinct from old.completed_at
    and new.session_payload is not distinct from old.session_payload
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
