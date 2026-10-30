-- CANDIDATE: authorized installer obtains scoped inherited access for this transaction.
BEGIN;
GRANT ai_guard_owner TO CURRENT_USER WITH INHERIT TRUE, SET FALSE;
SELECT (SELECT count(*) FROM public.ai_guard_reviewed_questions) AS reviewed_count,
       (SELECT enabled FROM public.ai_guard_budget WHERE id=true) AS enabled,
       (SELECT cap_microusd FROM public.ai_guard_budget WHERE id=true) AS cap_microusd,
       (SELECT total_microusd FROM public.ai_guard_legacy_liability WHERE id=true) AS historical_liability_microusd,
       (SELECT count(*) FROM public.ai_guard_route_policy) AS route_policy_count;
REVOKE ai_guard_owner FROM CURRENT_USER;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname='ai_guard_owner' AND u.rolname=current_user AND (m.set_option OR m.inherit_option)) THEN RAISE EXCEPTION 'temporary management membership remains'; END IF; END $$;
COMMIT;
