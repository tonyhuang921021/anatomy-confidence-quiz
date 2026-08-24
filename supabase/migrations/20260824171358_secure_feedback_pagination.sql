create index if not exists feedback_messages_root_id_desc_idx
on public.feedback_messages (id desc)
where parent_id is null;

create index if not exists feedback_messages_parent_id_id_idx
on public.feedback_messages (parent_id, id)
where parent_id is not null;

update public.feedback_messages
set display_name = null
where is_anonymous = true
  and display_name is not null;

alter table public.feedback_messages
drop constraint if exists feedback_messages_anonymous_display_name_check;

alter table public.feedback_messages
add constraint feedback_messages_anonymous_display_name_check
check (not is_anonymous or display_name is null);

revoke all privileges
on table public.feedback_messages, public.feedback_message_votes
from public, anon, authenticated;

drop policy if exists "Anyone can read feedback messages"
on public.feedback_messages;

drop policy if exists "Anyone can insert feedback messages"
on public.feedback_messages;

drop policy if exists "Anyone can read feedback message votes"
on public.feedback_message_votes;

drop policy if exists "Anyone can insert feedback message votes"
on public.feedback_message_votes;

revoke all privileges
on sequence public.feedback_messages_id_seq, public.feedback_message_votes_id_seq
from public, anon, authenticated;

grant select, insert, update, delete
on table public.feedback_messages, public.feedback_message_votes
to service_role;

grant usage, select
on sequence public.feedback_messages_id_seq, public.feedback_message_votes_id_seq
to service_role;
