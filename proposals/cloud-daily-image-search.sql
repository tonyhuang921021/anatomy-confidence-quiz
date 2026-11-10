-- Prepared installation: private Taiwan-day quota/notification ledger.
-- Counters, unknown cache locks, download limits and dollar budgets are retained.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE daily_search_acl_before ON COMMIT DROP AS SELECT oid,proacl,proowner,prosecdef FROM pg_proc WHERE oid IN ('public.figure_image_reserve(uuid,uuid,text,text)'::regprocedure,'public.figure_continuation_step(uuid,uuid,text,text,text)'::regprocedure);
CREATE TEMP TABLE daily_search_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
SELECT pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
SELECT id FROM public.figure_image_limits WHERE id FOR UPDATE;
DO $guard$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'unexpected installer';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.figure_image_reserve(uuid,uuid,text,text)'::regprocedure)<>'87f90e9519f328c737dd35d34261f91c'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.figure_continuation_step(uuid,uuid,text,text,text)'::regprocedure)<>'647c0085a85b5816ea3236001fa9f135' THEN RAISE EXCEPTION 'search reservation baseline changed';END IF;
 IF to_regclass('figure_model_private.search_days') IS NOT NULL THEN RAISE EXCEPTION 'daily search ledger already exists';END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean';END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
SET LOCAL ROLE ai_guard_owner;
CREATE TABLE figure_model_private.search_days (
 day date PRIMARY KEY,
 searches integer NOT NULL DEFAULT 0 CHECK(searches BETWEEN 0 AND 200),
 daily_limit integer NOT NULL DEFAULT 200 CHECK(daily_limit=200),
 -- Only the cutover day can contain a conservative legacy allocation.
 carried_searches integer NOT NULL DEFAULT 0 CHECK(carried_searches BETWEEN 0 AND searches),
 carry_basis text NOT NULL DEFAULT 'none' CHECK(carry_basis IN ('none','legacy_cumulative_upper_bound')),
 reached_at timestamptz,
 notification_claim_id uuid,
 notification_claimed_at timestamptz,
 notification_send_started_at timestamptz,
 notification_accepted_at timestamptz,
 notification_message_id text CHECK(length(notification_message_id) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((carried_searches=0 AND carry_basis='none') OR carry_basis='legacy_cumulative_upper_bound'),
 CHECK((searches<daily_limit AND reached_at IS NULL) OR (searches=daily_limit AND reached_at IS NOT NULL)),
 CHECK((notification_claim_id IS NULL AND notification_claimed_at IS NULL AND notification_send_started_at IS NULL)
  OR (notification_claim_id IS NOT NULL AND notification_claimed_at IS NOT NULL AND reached_at IS NOT NULL)),
 CHECK(notification_send_started_at IS NULL OR notification_claimed_at IS NOT NULL),
 CHECK((notification_accepted_at IS NULL AND notification_message_id IS NULL)
  OR (reached_at IS NOT NULL AND notification_send_started_at IS NOT NULL AND notification_accepted_at IS NOT NULL AND notification_message_id IS NOT NULL))
);
ALTER TABLE figure_model_private.search_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON figure_model_private.search_days FROM PUBLIC,anon,authenticated,service_role;
-- Legacy cache rows have no reservation timestamp and may have been overwritten.
-- Carry the entire existing cumulative count into the cutover day: safe upper
-- bound, explicitly labelled, never presented as an exact historical day count.
-- Future Taiwan days start at zero without deleting any row or unknown lock.
INSERT INTO figure_model_private.search_days(day,searches,carried_searches,carry_basis,reached_at)
 SELECT (clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date,searches,searches,
 CASE WHEN searches=0 THEN 'none' ELSE 'legacy_cumulative_upper_bound' END,
 CASE WHEN searches=200 THEN clock_timestamp() ELSE NULL END FROM public.figure_image_limits WHERE id;
CREATE FUNCTION public.figure_search_reserve_day()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,figure_model_private AS $function$
DECLARE d date;lim public.figure_image_limits%rowtype;n integer;
BEGIN
 -- The existing entry points lock this same singleton before source/lease and
 -- replay checks. This lock also serializes direct backend calls safely.
 SELECT * INTO lim FROM public.figure_image_limits WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT lim.enabled OR NOT lim.capture OR lim.max_searches<>200 THEN RETURN false;END IF;
 d:=(clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date;
 INSERT INTO figure_model_private.search_days(day) VALUES(d) ON CONFLICT(day) DO NOTHING;
 UPDATE figure_model_private.search_days SET searches=searches+1,
  reached_at=CASE WHEN searches+1=daily_limit THEN coalesce(reached_at,clock_timestamp()) ELSE reached_at END,
  updated_at=clock_timestamp()
 WHERE day=d AND searches<daily_limit RETURNING searches INTO n;
 RETURN FOUND;
END $function$;
CREATE FUNCTION public.figure_search_capacity()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,figure_model_private AS $function$
 WITH today AS (SELECT (clock_timestamp() AT TIME ZONE 'Asia/Taipei')::date AS day)
 SELECT jsonb_build_object('mode','taipei_daily_v1','day',t.day,'searchUsed',coalesce(d.searches,0),'searchLimit',200,
  'carriedSearches',coalesce(d.carried_searches,0),'carryBasis',coalesce(d.carry_basis,'none'),
  'searchAvailable',l.enabled AND l.capture AND l.max_searches=200 AND coalesce(d.searches,0)<200,
  'searchExhausted',coalesce(d.searches,0)>=200,
  'downloadUsed',l.downloads,'downloadLimit',l.max_downloads,'downloadExhausted',l.downloads>=l.max_downloads,
  'downloadBytesReserved',l.download_bytes,'downloadBytesLimit',l.max_download_bytes,'downloadBytesExhausted',l.download_bytes+3145728>l.max_download_bytes,
  'newJobUsed',l.captured,'newJobLimit',l.max_new,'newJobExhausted',l.captured>=l.max_new)
 FROM public.figure_image_limits l CROSS JOIN today t LEFT JOIN figure_model_private.search_days d ON d.day=t.day WHERE l.id
$function$;
REVOKE ALL ON FUNCTION public.figure_search_reserve_day(),public.figure_search_capacity() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.figure_search_reserve_day(),public.figure_search_capacity() TO service_role;
GRANT EXECUTE ON FUNCTION public.figure_search_reserve_day() TO postgres;
RESET ROLE;
-- No security mode, ownership or ACL changes to the original entry points.
DO $patch$ DECLARE definition text;old text;replacement text;signature text; BEGIN
 FOR signature,old,replacement IN SELECT * FROM (VALUES
  ('public.figure_image_reserve(uuid,uuid,text,text)','if lim.searches>=lim.max_searches then return false; end if;','if not public.figure_search_reserve_day() then return false; end if;'),
  ('public.figure_continuation_step(uuid,uuid,text,text,text)','  IF lim.searches>=lim.max_searches THEN RETURN jsonb_build_object(''status'',''limit'');END IF;',''),
  ('public.figure_continuation_step(uuid,uuid,text,text,text)','  UPDATE public.figure_image_limits SET searches=searches+1 WHERE id;','  IF NOT public.figure_search_reserve_day() THEN RETURN jsonb_build_object(''status'',''daily_search_limit'');END IF;
  UPDATE public.figure_image_limits SET searches=searches+1 WHERE id;')
 ) AS changes(signature,old,replacement) LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF (length(definition)-length(replace(definition,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'search patch anchor changed: %',signature;END IF;
  EXECUTE replace(definition,old,replacement);
 END LOOP;
END $patch$;
ALTER TABLE public.figure_image_limits DROP CONSTRAINT figure_image_limits_max_searches_check;
ALTER TABLE public.figure_image_limits ADD CONSTRAINT figure_image_limits_max_searches_check CHECK(max_searches BETWEEN 1 AND 200);
UPDATE public.figure_image_limits SET max_searches=200 WHERE id;
COMMENT ON COLUMN public.figure_image_limits.max_searches IS 'Taiwan natural-day search cap since daily-search-v1; searches remains the unchanged lifetime cumulative reservation counter.';
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM daily_search_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'membership changed';END IF;
 IF EXISTS(SELECT FROM daily_search_acl_before b JOIN pg_proc p ON p.oid=b.oid WHERE p.proacl IS DISTINCT FROM b.proacl OR p.proowner IS DISTINCT FROM b.proowner OR p.prosecdef IS DISTINCT FROM b.prosecdef) THEN RAISE EXCEPTION 'original function privileges changed';END IF;
 IF EXISTS(SELECT FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access not revoked';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated','service_role']) who CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) permission WHERE has_table_privilege(who,'figure_model_private.search_days',permission))
 OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) who CROSS JOIN unnest(ARRAY['public.figure_search_reserve_day()','public.figure_search_capacity()']) fn WHERE has_function_privilege(who,fn,'EXECUTE')) THEN RAISE EXCEPTION 'unexpected public access';END IF;
END $verify$;
COMMIT;
