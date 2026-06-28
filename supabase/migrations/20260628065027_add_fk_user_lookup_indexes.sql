create index if not exists feedback_message_votes_user_id_idx
on public.feedback_message_votes (user_id);

create index if not exists question_supplement_card_votes_user_id_idx
on public.question_supplement_card_votes (user_id);

create index if not exists question_supplement_reactions_user_id_idx
on public.question_supplement_reactions (user_id);

create index if not exists resource_share_likes_user_id_idx
on public.resource_share_likes (user_id);
