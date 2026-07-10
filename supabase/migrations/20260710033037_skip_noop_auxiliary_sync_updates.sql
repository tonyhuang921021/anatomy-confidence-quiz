create or replace function public.skip_noop_saved_question_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not distinct from old.user_id
    and new.question_id is not distinct from old.question_id
    and new.source_context is not distinct from old.source_context
    and new.correct_count is not distinct from old.correct_count
    and new.attempts is not distinct from old.attempts
    and new.last_answered_at is not distinct from old.last_answered_at
    and new.added_at is not distinct from old.added_at
  then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_skip_noop_saved_question_update on public.saved_questions;
create trigger trg_skip_noop_saved_question_update
before update on public.saved_questions
for each row
execute function public.skip_noop_saved_question_update();

create or replace function public.skip_noop_review_question_state_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not distinct from old.user_id
    and new.scope is not distinct from old.scope
    and new.question_id is not distinct from old.question_id
    and new.state is not distinct from old.state
  then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_skip_noop_review_question_state_update on public.review_question_states;
create trigger trg_skip_noop_review_question_state_update
before update on public.review_question_states
for each row
execute function public.skip_noop_review_question_state_update();
