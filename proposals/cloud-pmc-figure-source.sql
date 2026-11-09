-- Prepared source expansion. DO NOT execute before installation approval.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE pmc_function_acl_before ON COMMIT DROP AS SELECT proacl,proowner,prosecdef FROM pg_proc WHERE oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure;
CREATE TEMP TABLE pmc_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
SELECT pg_advisory_xact_lock(hashtext('explanation-figure-source-install-v1'));
DO $guard$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'unexpected installer'; END IF;
 IF md5(pg_get_functiondef('public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure)) <> 'ed415392dd51d6e2b319ac5590149052' THEN RAISE EXCEPTION 'reserve baseline changed'; END IF;
 IF (SELECT md5(pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='public.explanation_figure_candidates'::regclass AND conname='explanation_figure_candidates_source_url_check') IS DISTINCT FROM '851a9d35de3068496d8cc4a247e23205' THEN RAISE EXCEPTION 'constraint baseline changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean'; END IF;
 IF (SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure) <> 'ai_guard_owner' THEN RAISE EXCEPTION 'unexpected owner'; END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
ALTER TABLE public.explanation_figure_candidates DROP CONSTRAINT explanation_figure_candidates_source_url_check;
ALTER TABLE public.explanation_figure_candidates ADD CONSTRAINT explanation_figure_candidates_source_url_check CHECK (
 source_url LIKE 'https://commons.wikimedia.org/%'
 OR (source_url ~ '^https://pmc[.]ncbi[.]nlm[.]nih[.]gov/articles/PMC[0-9]+/#[A-Za-z_][A-Za-z0-9_.-]{0,127}$'
     AND license IN ('CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC0'))
);
SET LOCAL ROLE ai_guard_owner;
CREATE OR REPLACE FUNCTION public.figure_model_reserve(p_operation uuid, p_candidate uuid, p_key text, p_binding jsonb, p_model text, p_pricing text, p_cost bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE b figure_model_private.batch%rowtype; a public.ai_guard_budget%rowtype;c public.explanation_figure_candidates%rowtype;
 j public.figure_queue_jobs%rowtype;o figure_model_private.operations%rowtype;txt text;token uuid;
BEGIN
 SELECT * INTO a FROM public.ai_guard_budget WHERE id FOR UPDATE;
 SELECT * INTO b FROM figure_model_private.batch WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT b.enabled OR NOT b.model_enabled OR NOT coalesce(((b.funding_mode='cash_authorized' AND b.cash_authorized AND b.funding_evidence_sha ~ '^[0-9a-f]{64}$') OR (b.funding_mode='verified_credit' AND b.no_cash AND b.credit_until>clock_timestamp() AND a.verified_credit_expires_at>clock_timestamp())),false)
  OR a.enabled IS DISTINCT FROM true
  OR p_model IS DISTINCT FROM b.model OR p_pricing IS DISTINCT FROM b.pricing_revision OR p_cost IS DISTINCT FROM b.reserve_cost
  OR p_binding IS NULL OR jsonb_typeof(p_binding)<>'object' OR p_operation IS NULL OR p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 SELECT * INTO o FROM figure_model_private.operations WHERE operation_id=p_operation OR candidate_id=p_candidate OR key=p_key LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('status',o.state,'dispatch',false,'operationId',o.operation_id); END IF;
 IF b.model_calls>=b.max_model_calls OR b.charged+p_cost>b.cap OR a.cap_microusd IS NULL OR a.spent_microusd+a.reserved_microusd+p_cost>a.cap_microusd THEN RETURN jsonb_build_object('status','budget'); END IF;
 IF NOT EXISTS(SELECT FROM public.figure_queue_config q,public.figure_image_limits l WHERE q.id AND l.id AND q.enabled AND q.capture_new AND l.enabled AND l.capture) THEN RETURN jsonb_build_object('status','paused'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
 SELECT * INTO c FROM public.explanation_figure_candidates WHERE id=p_candidate AND status='pending' FOR UPDATE;
 IF NOT FOUND OR (NOT c.question_id=ANY(b.targets) AND NOT EXISTS(SELECT 1 FROM explanation_private.sitewide_requests s JOIN public.ai_guard_requests r ON r.id=s.request_id WHERE s.request_id=(p_binding->>'requestId')::uuid AND s.question_id=c.question_id AND r.question_id=c.question_id AND r.result_committed AND public.explanation_sitewide_request_allowed(r.id,r.actor_id) AND EXISTS(SELECT 1 FROM public.figure_queue_jobs admitted_job WHERE admitted_job.request_id=r.id AND admitted_job.question_id=c.question_id AND admitted_job.explanation_sha256=c.explanation_sha256))) THEN RETURN jsonb_build_object('status','scope'); END IF;
 txt:=public.figure_model_locked_text(c.question_id,c.explanation_sha256);
 SELECT * INTO j FROM public.figure_queue_jobs WHERE request_id=(p_binding->>'requestId')::uuid FOR SHARE;
 IF NOT FOUND OR j.question_id<>c.question_id OR j.explanation_sha256<>c.explanation_sha256 OR j.needs_state<>'approved'
  OR NOT ((j.state='leased' AND j.attempts=1 AND (coalesce(p_binding->>'continuation','')='staged-image-v1' OR j.lease_until>clock_timestamp())) OR (j.state='done' AND public.figure_continuation_bound(p_binding,p_candidate)))
  OR (p_binding->>'policy') IS DISTINCT FROM 'luna-final-figure-v1' OR (p_binding->>'questionId') IS DISTINCT FROM c.question_id
  OR (p_binding->>'textHash') IS DISTINCT FROM c.explanation_sha256 OR (p_binding->>'sectionHash') IS DISTINCT FROM c.section_sha256
  OR (p_binding->>'imageHash') IS DISTINCT FROM c.image_sha256 OR coalesce(p_binding->>'questionHash','') !~ '^[0-9a-f]{64}$'
  OR coalesce(p_binding->>'sourceHash','') !~ '^[0-9a-f]{64}$'
  OR NOT (c.source_url ~ '^https://commons[.]wikimedia[.]org/wiki/File:[^[:space:]]+$' OR c.source_url ~ '^https://pmc[.]ncbi[.]nlm[.]nih[.]gov/articles/PMC[0-9]+/#[A-Za-z_][A-Za-z0-9_.-]{0,127}$')
  OR c.license_url IS DISTINCT FROM (CASE c.license WHEN 'CC BY 4.0' THEN 'https://creativecommons.org/licenses/by/4.0/' WHEN 'CC BY-SA 4.0' THEN 'https://creativecommons.org/licenses/by-sa/4.0/' WHEN 'CC BY 3.0' THEN 'https://creativecommons.org/licenses/by/3.0/' WHEN 'CC BY-SA 3.0' THEN 'https://creativecommons.org/licenses/by-sa/3.0/' WHEN 'CC0' THEN 'https://creativecommons.org/publicdomain/zero/1.0/' ELSE NULL END)
  OR c.license NOT IN ('CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC0')
  OR NOT ((c.image_mime='image/png' AND substring(c.image_bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) OR (c.image_mime='image/jpeg' AND substring(c.image_bytes from 1 for 3)=decode('ffd8ff','hex')) OR (c.image_mime='image/webp' AND substring(c.image_bytes from 1 for 4)=convert_to('RIFF','UTF8') AND substring(c.image_bytes from 9 for 4)=convert_to('WEBP','UTF8')))
  OR txt IS NULL OR encode(sha256(convert_to(txt,'UTF8')),'hex')<>c.explanation_sha256
  OR encode(sha256(c.image_bytes),'hex')<>c.image_sha256 OR NOT public.ai_guard_image_eligible(c.question_id,c.explanation_sha256)
  OR NOT EXISTS(SELECT FROM jsonb_array_elements(j.figure_needs->'items') i WHERE i->>'sectionHash'=c.section_sha256 AND i->>'sectionTitle'=c.section_heading AND i->>'caption'=c.section_title AND i->>'sectionAnchor'=c.section_anchor)
  OR NOT EXISTS(SELECT FROM regexp_split_to_table(txt,E'(?m)(?=^#{2,3}[ \t]+)') section WHERE encode(sha256(convert_to(btrim(section,E' \t\r\n'),'UTF8')),'hex')=c.section_sha256)
 THEN RETURN jsonb_build_object('status','stale'); END IF;
 token:=gen_random_uuid();
 INSERT INTO figure_model_private.operations(operation_id,key,candidate_id,binding,state,model,pricing_revision,reserved_cost,max_output_tokens,send_token,image_bytes,source_evidence)
 VALUES(p_operation,p_key,p_candidate,p_binding,'reserved',p_model,p_pricing,p_cost,b.max_output_tokens,token,c.image_bytes,
 jsonb_build_object('source',c.source_url,'licenseUrl',c.license_url,'license',c.license,'attribution',c.attribution,'mime',c.image_mime));
 UPDATE figure_model_private.batch SET charged=charged+p_cost,model_calls=model_calls+1 WHERE id;
 UPDATE public.ai_guard_budget SET reserved_microusd=reserved_microusd+p_cost WHERE id;
 INSERT INTO figure_model_private.events(operation_id,event) VALUES(p_operation,'reserved');
 RETURN jsonb_build_object('status','reserved','dispatch',false,'sendToken',token,'operationId',p_operation,'maxOutputTokens',b.max_output_tokens);
END $function$
;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM pmc_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'existing membership changed'; END IF;
 IF EXISTS(SELECT 1 FROM pmc_function_acl_before b CROSS JOIN pg_proc p WHERE p.oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure AND (p.proacl IS DISTINCT FROM b.proacl OR p.proowner IS DISTINCT FROM b.proowner OR p.prosecdef IS DISTINCT FROM b.prosecdef)) THEN RAISE EXCEPTION 'function privileges changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access not revoked'; END IF;
 IF has_function_privilege('anon','public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)','EXECUTE') OR has_function_privilege('authenticated','public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)','EXECUTE') THEN RAISE EXCEPTION 'unexpected public execution'; END IF;
END $verify$;
COMMIT;
