-- Prepared only. Install requires approval for the exact function/constraint change.
-- A completed uncertain suitability verdict is not an unknown transport outcome.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE verdict_function_acl_before ON COMMIT DROP AS SELECT proacl,proowner,prosecdef FROM pg_proc WHERE oid='public.figure_model_commit(uuid,jsonb,text,text,text,bigint)'::regprocedure;
CREATE TEMP TABLE verdict_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
SELECT pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
DO $guard$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'unexpected installer'; END IF;
 IF md5(pg_get_functiondef('public.figure_model_commit(uuid,jsonb,text,text,text,bigint)'::regprocedure)) <> 'ff048f3277e905c645519744cef5f88e' THEN RAISE EXCEPTION 'commit baseline changed'; END IF;
 IF (SELECT md5(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='figure_model_private.operations'::regclass AND conname='operations_verdict_check') IS DISTINCT FROM '07c1bdfca3e1820b87f1dd19a7f931bf' THEN RAISE EXCEPTION 'verdict constraint baseline changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean'; END IF;
 IF (SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.figure_model_commit(uuid,jsonb,text,text,text,bigint)'::regprocedure) <> 'ai_guard_owner'
 OR (SELECT relowner::regrole::text FROM pg_class WHERE oid='figure_model_private.operations'::regclass) <> 'ai_guard_owner' THEN RAISE EXCEPTION 'unexpected owner'; END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
SET LOCAL ROLE ai_guard_owner;
ALTER TABLE figure_model_private.operations DROP CONSTRAINT operations_verdict_check;
ALTER TABLE figure_model_private.operations ADD CONSTRAINT operations_verdict_check CHECK (verdict IN ('match','partial_match','uncertain','mismatch'));
DO $install$ DECLARE definition text; old_clause text := 'p_verdict NOT IN (''match'',''partial_match'',''mismatch'')'; BEGIN
 definition := pg_get_functiondef('public.figure_model_commit(uuid,jsonb,text,text,text,bigint)'::regprocedure);
 IF (length(definition)-length(replace(definition,old_clause,'')))/length(old_clause) <> 1 THEN RAISE EXCEPTION 'commit predicate changed'; END IF;
 EXECUTE replace(definition,old_clause,'p_verdict NOT IN (''match'',''partial_match'',''uncertain'',''mismatch'')');
END $install$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM verdict_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'existing membership changed'; END IF;
 IF EXISTS(SELECT 1 FROM verdict_function_acl_before b CROSS JOIN pg_proc p WHERE p.oid='public.figure_model_commit(uuid,jsonb,text,text,text,bigint)'::regprocedure AND (p.proacl IS DISTINCT FROM b.proacl OR p.proowner IS DISTINCT FROM b.proowner OR p.prosecdef IS DISTINCT FROM b.prosecdef)) THEN RAISE EXCEPTION 'function privileges changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access not revoked'; END IF;
 IF has_function_privilege('anon','public.figure_model_commit(uuid,jsonb,text,text,text,bigint)','EXECUTE') OR has_function_privilege('authenticated','public.figure_model_commit(uuid,jsonb,text,text,text,bigint)','EXECUTE') THEN RAISE EXCEPTION 'unexpected public execution'; END IF;
END $verify$;
COMMIT;
