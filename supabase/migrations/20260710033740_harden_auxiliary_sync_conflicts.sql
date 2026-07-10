create or replace function public.skip_noop_saved_question_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;

  new.source_context := coalesce(old.source_context, new.source_context);
  new.correct_count := greatest(old.correct_count, new.correct_count);
  new.attempts := greatest(old.attempts, new.attempts);
  new.added_at := least(old.added_at, new.added_at);
  new.last_answered_at := case
    when old.last_answered_at is null then new.last_answered_at
    when new.last_answered_at is null then old.last_answered_at
    else greatest(old.last_answered_at, new.last_answered_at)
  end;

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

create or replace function public.skip_noop_review_question_state_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;

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
