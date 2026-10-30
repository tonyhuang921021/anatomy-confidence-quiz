-- CANDIDATE ONLY: controlled owner/operator transaction AFTER real first-batch QA,
-- provider reconciliation, authorized scope and independently verified old-writer drain.
-- Keeps generation disabled, preserves spend and external historical unknown.
-- psql -v verified_grant_microusd=... -v verified_at_utc=... -v verified_expiry_utc=...
--      -v batch_review_evidence_sha256=... ; evidence hash requires external verification.
\set ON_ERROR_STOP on
BEGIN;
-- Temporary management membership; inherits owner privileges without SET ROLE.
GRANT ai_guard_owner TO CURRENT_USER WITH INHERIT TRUE, SET FALSE;
SELECT set_config('ai_guard.promote_grant', :'verified_grant_microusd', true),
       set_config('ai_guard.promote_checked_at', :'verified_at_utc', true),
       set_config('ai_guard.promote_expiry', :'verified_expiry_utc', true),
       set_config('ai_guard.promote_review', :'batch_review_evidence_sha256', true);
DO $$
declare b public.ai_guard_budget%rowtype; grant_value bigint; checked_at timestamptz; expiry timestamptz; review_ref text; next_cap bigint;
begin
 select * into b from public.ai_guard_budget where id=true for update;
 if not found or b.enabled or b.disabled_reason is not null or b.budget_phase<>'first_batch'
  or b.reserved_microusd<>0 or exists(select 1 from public.ai_guard_requests where state='active')
  or exists(select 1 from public.ai_guard_calls where state='started') then raise exception 'not disabled and drained'; end if;
 if not exists(select 1 from public.ai_guard_legacy_liability where id=true and status='external_unknown' and total_microusd=7042458 and acceptance_evidence_sha256 ~ '^[0-9a-f]{64}$') then raise exception 'legacy reserve missing'; end if;
 grant_value:=current_setting('ai_guard.promote_grant')::bigint;
 checked_at:=current_setting('ai_guard.promote_checked_at')::timestamptz;
 expiry:=current_setting('ai_guard.promote_expiry')::timestamptz;
 review_ref:=current_setting('ai_guard.promote_review');
 if review_ref !~ '^[0-9a-f]{64}$' then raise exception 'batch review evidence missing'; end if;
 if b.spent_microusd<=0 or not exists (select 1 from public.ai_guard_requests r join public.ai_guard_calls c on c.request_id=r.id where r.action_kind='explanation' and r.state='closed' and r.result_committed and c.state='settled') then raise exception 'no settled committed explanation trial'; end if;
 if checked_at>clock_timestamp() or checked_at<clock_timestamp()-interval '15 minutes' or expiry<=clock_timestamp() then raise exception 'credit evidence stale, future, or expired'; end if;
 next_cap:=GREATEST(0,LEAST(31000000,grant_value)-7042458);
 if next_cap < b.spent_microusd+b.envelope_microusd then raise exception 'insufficient verified credit'; end if;
 update public.ai_guard_budget set budget_phase='ongoing',batch_review_evidence_sha256=review_ref,verified_grant_microusd=grant_value,
  verified_credit_expires_at=LEAST(expiry,checked_at+interval '15 minutes'),cap_microusd=next_cap where id=true;
 -- No enable, spend reset, liability change, or emergency-reason clearing here.
end $$;
-- Remove the grant issued by this transaction; creator's bootstrap ADMIN remains.
REVOKE ai_guard_owner FROM CURRENT_USER;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname='ai_guard_owner' AND u.rolname=current_user AND (m.set_option OR m.inherit_option)) THEN RAISE EXCEPTION 'temporary management membership remains'; END IF; END $$;
COMMIT;
