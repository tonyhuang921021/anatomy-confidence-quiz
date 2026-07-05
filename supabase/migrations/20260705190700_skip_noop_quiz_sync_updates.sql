create or replace function public.skip_noop_quiz_session_attempt_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not distinct from old.user_id
    and new.question_id is not distinct from old.question_id
    and new.selected_answer is not distinct from old.selected_answer
    and new.correct_answer is not distinct from old.correct_answer
    and new.is_correct is not distinct from old.is_correct
    and new.confidence is not distinct from old.confidence
    and new.error_type is not distinct from old.error_type
    and new.answered_at is not distinct from old.answered_at
    and new.source_mode is not distinct from old.source_mode
    and new.subject_snapshot is not distinct from old.subject_snapshot
    and new.chapter_snapshot is not distinct from old.chapter_snapshot
    and new.section_snapshot is not distinct from old.section_snapshot
  then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_skip_noop_quiz_session_attempt_update on public.quiz_session_attempts;
create trigger trg_skip_noop_quiz_session_attempt_update
before update on public.quiz_session_attempts
for each row
execute function public.skip_noop_quiz_session_attempt_update();

create or replace function public.skip_noop_quiz_session_update()
returns trigger
language plpgsql
as $$
begin
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

drop trigger if exists trg_skip_noop_quiz_session_update on public.quiz_sessions;
create trigger trg_skip_noop_quiz_session_update
before update on public.quiz_sessions
for each row
execute function public.skip_noop_quiz_session_update();
