create or replace function public.skip_noop_quiz_session_attempt_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
    and new.answer_key_revision is not distinct from old.answer_key_revision
    and new.is_correct_before_revision is not distinct from old.is_correct_before_revision
  then
    return null;
  end if;

  return new;
end;
$$;

update public.quiz_session_attempts
set is_correct_before_revision = is_correct,
    answer_key_revision = 'moex-115090-appeal-v1'
where question_id in (
    'MOEX-115090-1301-Q063',
    'MOEX-115090-1301-Q066',
    'MOEX-115090-2301-Q014',
    'MOEX-115090-2301-Q025',
    'MOEX-115090-2301-Q055',
    'MOEX-115090-2301-Q068',
    'MOEX-115090-2301-Q095',
    'MOEX-115090-2301-Q098'
  )
  and answer_key_revision is distinct from 'moex-115090-appeal-v1';
