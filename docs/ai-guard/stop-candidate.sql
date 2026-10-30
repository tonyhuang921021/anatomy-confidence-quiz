-- CANDIDATE: stop new guard dispatch without dropping accounting or protections.
-- Run as authorized installer with temporary inherited owner privilege. Stop and drain legacy workers separately.
-- The budget row serializes this operation with reserve/start/settle/close.
BEGIN;
GRANT ai_guard_owner TO CURRENT_USER WITH INHERIT TRUE, SET FALSE;
DO $$
DECLARE b public.ai_guard_budget%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.ai_guard_budget WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'guard budget missing; dispatch remains unverified'; END IF;
 UPDATE public.ai_guard_budget SET enabled=false,
   disabled_at=coalesce(disabled_at,clock_timestamp()) WHERE id=true;
END $$;
SELECT CASE WHEN EXISTS(SELECT 1 FROM public.ai_guard_requests WHERE state='active')
                  OR EXISTS(SELECT 1 FROM public.ai_guard_calls WHERE state='started')
                  OR (SELECT reserved_microusd FROM public.ai_guard_budget WHERE id=true)<>0
            THEN 'disabled_drain_required' ELSE 'disabled_drained' END AS guard_status,
       (SELECT count(*) FROM public.ai_guard_requests WHERE state='active') AS active_requests,
       (SELECT count(*) FROM public.ai_guard_calls WHERE state='started') AS unresolved_calls,
       (SELECT reserved_microusd FROM public.ai_guard_budget WHERE id=true) AS reserved_microusd;
REVOKE ai_guard_owner FROM CURRENT_USER;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname='ai_guard_owner' AND u.rolname=current_user AND (m.set_option OR m.inherit_option)) THEN RAISE EXCEPTION 'temporary management membership remains'; END IF; END $$;
COMMIT;
-- Never drop tables, ledger, audit, RPCs or reviewed write barrier. Repeating is safe.
-- This cannot itself prove old workers stopped or provider charges reconciled.
