-- Narrow administrative notification state machine. No raw table grants.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE daily_notice_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
DO $guard$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'unexpected installer';END IF;
 IF to_regclass('figure_model_private.search_days') IS NULL OR to_regprocedure('public.figure_search_notification(text,date,uuid,text)') IS NOT NULL THEN RAISE EXCEPTION 'unexpected notification baseline';END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean';END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
SET LOCAL ROLE ai_guard_owner;
ALTER TABLE figure_model_private.search_days ADD CONSTRAINT search_days_unique_notice_claim UNIQUE(notification_claim_id);
CREATE FUNCTION public.figure_search_notification(p_action text,p_day date DEFAULT NULL,p_claim uuid DEFAULT NULL,p_message_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,figure_model_private AS $function$
DECLARE notice figure_model_private.search_days%rowtype;target_day date;
BEGIN
 IF p_action IS NULL OR p_action NOT IN ('claim','start','ack') OR p_claim IS NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF p_action='claim' THEN
  IF p_day IS NOT NULL OR p_message_id IS NOT NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
  -- Stable monitor operation ID reconciles an uncertain claim acknowledgment.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_claim::text,72841));
  SELECT * INTO notice FROM figure_model_private.search_days WHERE notification_claim_id=p_claim;
  IF FOUND THEN RETURN jsonb_build_object('status','existing','notice',to_jsonb(notice));END IF;
  SELECT day INTO target_day FROM figure_model_private.search_days
   WHERE reached_at IS NOT NULL AND notification_claim_id IS NULL ORDER BY day FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','idle');END IF;
  UPDATE figure_model_private.search_days SET notification_claim_id=p_claim,notification_claimed_at=clock_timestamp()
   WHERE day=target_day AND notification_claim_id IS NULL RETURNING * INTO notice;
  RETURN jsonb_build_object('status','claimed','notice',to_jsonb(notice));
 END IF;
 IF p_day IS NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
 SELECT * INTO notice FROM figure_model_private.search_days WHERE day=p_day AND notification_claim_id=p_claim FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing');END IF;
 IF p_action='start' THEN
  IF p_message_id IS NOT NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
  IF notice.notification_send_started_at IS NOT NULL THEN RETURN jsonb_build_object('status','held');END IF;
  UPDATE figure_model_private.search_days SET notification_send_started_at=clock_timestamp() WHERE day=p_day;
  RETURN jsonb_build_object('status','started','day',p_day);
 END IF;
 IF p_message_id IS NULL OR length(p_message_id) NOT BETWEEN 1 AND 200 OR notice.notification_send_started_at IS NULL THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF notice.notification_accepted_at IS NOT NULL THEN
  RETURN jsonb_build_object('status',CASE WHEN notice.notification_message_id=p_message_id THEN 'accepted' ELSE 'conflict' END);
 END IF;
 UPDATE figure_model_private.search_days SET notification_accepted_at=clock_timestamp(),notification_message_id=p_message_id WHERE day=p_day;
 RETURN jsonb_build_object('status','accepted','day',p_day);
END $function$;
REVOKE ALL ON FUNCTION public.figure_search_notification(text,date,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
-- Only the existing database administration connector may manage alert receipts.
GRANT EXECUTE ON FUNCTION public.figure_search_notification(text,date,uuid,text) TO postgres;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM daily_notice_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'membership changed';END IF;
 IF has_schema_privilege('ai_guard_owner','public','CREATE') OR EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) THEN RAISE EXCEPTION 'temporary access not revoked';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) who WHERE has_function_privilege(who,'public.figure_search_notification(text,date,uuid,text)','EXECUTE'))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) who CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) permission WHERE has_table_privilege(who,'figure_model_private.search_days',permission)) THEN RAISE EXCEPTION 'unexpected public access';END IF;
END $verify$;
COMMIT;
