-- Prepared only. Exact installation requires approval: one private table,
-- two backend-only RPCs, and one existing reservation function change.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE figure_response_acl_before ON COMMIT DROP AS SELECT proacl,proowner,prosecdef FROM pg_proc WHERE oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure;
CREATE TEMP TABLE figure_response_members_before ON COMMIT DROP AS SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) snapshot FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole;
SELECT pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
DO $guard$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres' THEN RAISE EXCEPTION 'unexpected installer'; END IF;
 IF md5(pg_get_functiondef('public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure)) <> 'fbef5447cc4dd2cc612af1d66461eb20' THEN RAISE EXCEPTION 'reservation baseline changed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access is not clean'; END IF;
 IF (SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure) <> 'ai_guard_owner'
 OR (SELECT relowner::regrole::text FROM pg_class WHERE oid='figure_model_private.operations'::regclass) <> 'ai_guard_owner' THEN RAISE EXCEPTION 'unexpected owner'; END IF;
 IF to_regclass('figure_model_private.response_journal') IS NOT NULL THEN RAISE EXCEPTION 'journal already exists'; END IF;
END $guard$;
GRANT ai_guard_owner TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY CURRENT_USER;
GRANT CREATE ON SCHEMA public TO ai_guard_owner;
SET LOCAL ROLE ai_guard_owner;
CREATE TABLE figure_model_private.response_journal (
 operation_id uuid PRIMARY KEY REFERENCES figure_model_private.operations(operation_id),
 -- The original operation owns the candidate binding; no new public-table REFERENCES grant.
 candidate_id uuid NOT NULL,
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'),
 policy jsonb NOT NULL CHECK(jsonb_typeof(policy)='object'),
 decoder_revision text NOT NULL CHECK(decoder_revision='figure-response-v1'),
 response_bytes bytea CHECK(octet_length(response_bytes)<=65536),
 response_sha text CHECK(response_sha ~ '^[0-9a-f]{64}$'),
 http_status integer CHECK(http_status BETWEEN 100 AND 599),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 received_at timestamptz,
 CHECK ((response_bytes IS NULL AND response_sha IS NULL AND http_status IS NULL AND received_at IS NULL)
 OR (response_bytes IS NOT NULL AND response_sha IS NOT NULL AND http_status IS NOT NULL AND received_at IS NOT NULL
 AND encode(sha256(response_bytes),'hex')=response_sha))
);
ALTER TABLE figure_model_private.response_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON figure_model_private.response_journal FROM PUBLIC,anon,authenticated,service_role;
DO $install$ DECLARE definition text; anchor text := ' UPDATE figure_model_private.batch SET charged=charged+p_cost,model_calls=model_calls+1 WHERE id;'; addition text := $insert$
 INSERT INTO figure_model_private.response_journal(operation_id,candidate_id,binding,policy,decoder_revision)
 VALUES(p_operation,p_candidate,p_binding,jsonb_build_object('model',b.model,'pricingRevision',b.pricing_revision,
  'reserveMicroUsd',b.reserve_cost,'maxInputTokens',b.max_input_tokens,'maxOutputTokens',b.max_output_tokens,
  'inputRate',b.input_rate,'outputRate',b.output_rate),'figure-response-v1');
$insert$; BEGIN
 definition:=pg_get_functiondef('public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'reservation insertion point changed'; END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $install$;
CREATE FUNCTION public.figure_model_store_response(p_operation uuid,p_binding jsonb,p_bytes bytea,p_http_status integer,p_sha text,p_decoder text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,figure_model_private AS $function$
DECLARE o figure_model_private.operations%rowtype;j figure_model_private.response_journal%rowtype;
BEGIN
 IF p_operation IS NULL OR p_binding IS NULL OR p_bytes IS NULL OR octet_length(p_bytes)>65536 OR p_http_status IS NULL OR p_http_status NOT BETWEEN 100 AND 599
 OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$' OR encode(sha256(p_bytes),'hex')<>p_sha OR p_decoder IS DISTINCT FROM 'figure-response-v1' THEN RETURN jsonb_build_object('status','invalid');END IF;
 SELECT * INTO o FROM figure_model_private.operations WHERE operation_id=p_operation FOR SHARE;
 IF NOT FOUND OR o.binding IS DISTINCT FROM p_binding THEN RETURN jsonb_build_object('status','conflict');END IF;
 SELECT * INTO j FROM figure_model_private.response_journal WHERE operation_id=p_operation FOR UPDATE;
 -- No retroactive journal creation for an old unknown operation.
 IF NOT FOUND OR j.binding IS DISTINCT FROM o.binding OR j.candidate_id IS DISTINCT FROM o.candidate_id OR j.decoder_revision IS DISTINCT FROM p_decoder THEN RETURN jsonb_build_object('status','missing');END IF;
 IF j.response_bytes IS NOT NULL THEN
  IF j.response_bytes IS DISTINCT FROM p_bytes OR j.response_sha IS DISTINCT FROM p_sha OR j.http_status IS DISTINCT FROM p_http_status THEN RETURN jsonb_build_object('status','conflict');END IF;
  RETURN jsonb_build_object('saved',true,'responseSha',j.response_sha);
 END IF;
 IF o.state NOT IN ('sent','unknown') THEN RETURN jsonb_build_object('status','held');END IF;
 UPDATE figure_model_private.response_journal SET response_bytes=p_bytes,response_sha=p_sha,http_status=p_http_status,received_at=clock_timestamp() WHERE operation_id=p_operation;
 RETURN jsonb_build_object('saved',true,'responseSha',p_sha);
END $function$;
CREATE FUNCTION public.figure_model_read_response(p_operation uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,figure_model_private AS $function$
 SELECT jsonb_build_object('operationId',o.operation_id,'key',o.key,'candidateId',o.candidate_id,'binding',o.binding,'state',o.state,
  'candidateStatus',c.status,'canDispatch',o.state='sent' AND c.status='pending' AND j.response_bytes IS NULL
  AND c.explanation_sha256=o.binding->>'textHash' AND c.section_sha256=o.binding->>'sectionHash' AND c.image_sha256=o.binding->>'imageHash'
  AND c.image_bytes=o.image_bytes AND encode(sha256(c.image_bytes),'hex')=c.image_sha256
  AND public.figure_model_locked_text(c.question_id,c.explanation_sha256) IS NOT NULL
  AND public.ai_guard_image_eligible(c.question_id,c.explanation_sha256)
  AND jsonb_build_object('source',c.source_url,'licenseUrl',c.license_url,'license',c.license,'attribution',c.attribution,'mime',c.image_mime)=o.source_evidence
  AND EXISTS(SELECT FROM public.figure_queue_jobs qj WHERE qj.request_id=(o.binding->>'requestId')::uuid
    AND qj.question_id=c.question_id AND qj.explanation_sha256=c.explanation_sha256 AND qj.needs_state='approved'
    AND EXISTS(SELECT FROM jsonb_array_elements(qj.figure_needs->'items') i WHERE i->>'sectionHash'=c.section_sha256
     AND i->>'sectionTitle'=c.section_heading AND i->>'caption'=c.section_title AND i->>'sectionAnchor'=c.section_anchor))
  AND EXISTS(SELECT FROM figure_model_private.batch b JOIN public.ai_guard_budget a ON a.id=b.id WHERE b.id AND b.enabled AND b.model_enabled AND a.enabled
   AND j.policy=jsonb_build_object('model',b.model,'pricingRevision',b.pricing_revision,'reserveMicroUsd',b.reserve_cost,'maxInputTokens',b.max_input_tokens,'maxOutputTokens',b.max_output_tokens,'inputRate',b.input_rate,'outputRate',b.output_rate)
   AND coalesce(((b.funding_mode='cash_authorized' AND b.cash_authorized AND b.funding_evidence_sha ~ '^[0-9a-f]{64}$') OR (b.funding_mode='verified_credit' AND b.no_cash AND b.credit_until>clock_timestamp() AND a.verified_credit_expires_at>clock_timestamp())),false))
  AND EXISTS(SELECT FROM public.figure_queue_config q,public.figure_image_limits l WHERE q.id AND l.id AND q.enabled AND q.capture_new AND l.enabled AND l.capture),'policy',j.policy,'decoderRevision',j.decoder_revision,'responseSha',j.response_sha,
  'httpStatus',j.http_status,'responseBytes',CASE WHEN j.response_bytes IS NULL THEN NULL ELSE '\x'||encode(j.response_bytes,'hex') END)
 FROM figure_model_private.operations o JOIN figure_model_private.response_journal j ON j.operation_id=o.operation_id
 JOIN public.explanation_figure_candidates c ON c.id=o.candidate_id
 WHERE o.operation_id=p_operation AND o.binding=j.binding AND o.candidate_id=j.candidate_id
 AND j.policy->>'model'=o.model AND j.policy->>'pricingRevision'=o.pricing_revision
 AND (j.policy->>'reserveMicroUsd')::bigint=o.reserved_cost AND (j.policy->>'maxOutputTokens')::integer=o.max_output_tokens
$function$;
REVOKE ALL ON FUNCTION public.figure_model_store_response(uuid,jsonb,bytea,integer,text,text),public.figure_model_read_response(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.figure_model_store_response(uuid,jsonb,bytea,integer,text,text),public.figure_model_read_response(uuid) TO service_role;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ai_guard_owner;
REVOKE ai_guard_owner FROM postgres GRANTED BY CURRENT_USER;
DO $verify$ BEGIN
 IF (SELECT snapshot FROM figure_response_members_before) IS DISTINCT FROM (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY grantor),'[]'::jsonb) FROM pg_auth_members m WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole) THEN RAISE EXCEPTION 'existing membership changed';END IF;
 IF EXISTS(SELECT 1 FROM figure_response_acl_before b CROSS JOIN pg_proc p WHERE p.oid='public.figure_model_reserve(uuid,uuid,text,jsonb,text,text,bigint)'::regprocedure AND (p.proacl IS DISTINCT FROM b.proacl OR p.proowner IS DISTINCT FROM b.proowner OR p.prosecdef IS DISTINCT FROM b.prosecdef)) THEN RAISE EXCEPTION 'reservation privileges changed';END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='ai_guard_owner'::regrole AND member='postgres'::regrole AND (inherit_option OR set_option)) OR has_schema_privilege('ai_guard_owner','public','CREATE') THEN RAISE EXCEPTION 'temporary access not revoked';END IF;
 IF has_table_privilege('anon','figure_model_private.response_journal','SELECT') OR has_table_privilege('authenticated','figure_model_private.response_journal','SELECT') OR has_table_privilege('service_role','figure_model_private.response_journal','SELECT')
 OR has_function_privilege('anon','public.figure_model_store_response(uuid,jsonb,bytea,integer,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.figure_model_store_response(uuid,jsonb,bytea,integer,text,text)','EXECUTE')
 OR has_function_privilege('anon','public.figure_model_read_response(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.figure_model_read_response(uuid)','EXECUTE') THEN RAISE EXCEPTION 'unexpected public access';END IF;
END $verify$;
COMMIT;
