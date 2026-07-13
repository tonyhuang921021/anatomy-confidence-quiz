-- Prevent overlapping Vercel cron invocations from re-running the same rollup window.
create or replace function public.try_acquire_stats_rollup_lease(
  p_owner text,
  p_lease_seconds integer default 180
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acquired boolean := false;
  safe_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 180), 300));
begin
  if p_owner is null or length(trim(p_owner)) = 0 then
    return false;
  end if;

  insert into public.site_settings (setting_key, value, updated_at)
  values (
    'stats_rollup_lease',
    jsonb_build_object(
      'owner', p_owner,
      'expiresAt', (now() + make_interval(secs => safe_lease_seconds))::text
    ),
    now()
  )
  on conflict (setting_key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at
  where coalesce((public.site_settings.value ->> 'expiresAt')::timestamptz, to_timestamp(0)) <= now()
     or public.site_settings.value ->> 'owner' = p_owner
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_stats_rollup_lease(p_owner text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.site_settings
  set value = jsonb_build_object('releasedAt', now()::text),
      updated_at = now()
  where setting_key = 'stats_rollup_lease'
    and value ->> 'owner' = p_owner;

  return found;
end;
$$;

revoke all on function public.try_acquire_stats_rollup_lease(text, integer) from public, anon, authenticated;
revoke all on function public.release_stats_rollup_lease(text) from public, anon, authenticated;
grant execute on function public.try_acquire_stats_rollup_lease(text, integer) to service_role;
grant execute on function public.release_stats_rollup_lease(text) to service_role;
