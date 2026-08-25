create table if not exists public.feedback_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint_hash text not null unique,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 2048),
  constraint feedback_push_subscriptions_endpoint_hash_check
    check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  constraint feedback_push_subscriptions_p256dh_check
    check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  constraint feedback_push_subscriptions_auth_check
    check (auth ~ '^[A-Za-z0-9_-]{16,64}$')
);

create index if not exists feedback_push_subscriptions_user_updated_idx
on public.feedback_push_subscriptions (user_id, updated_at desc);

revoke all privileges
on table public.feedback_push_subscriptions
from public, anon, authenticated;

grant select, insert, update, delete
on table public.feedback_push_subscriptions
to service_role;

alter table public.feedback_push_subscriptions enable row level security;

drop policy if exists "Service role can manage feedback push subscriptions"
on public.feedback_push_subscriptions;

create policy "Service role can manage feedback push subscriptions"
on public.feedback_push_subscriptions
for all
to service_role
using (true)
with check (true);

revoke all privileges
on sequence public.feedback_push_subscriptions_id_seq
from public, anon, authenticated;

grant usage, select
on sequence public.feedback_push_subscriptions_id_seq
to service_role;
