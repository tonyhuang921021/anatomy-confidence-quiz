-- Bounded PMC continuation. Existing backend-only functions and ACLs only.
-- No new grants, roles, tables, budget change or replay of unknown requests.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TEMP TABLE continuation_acl_before ON COMMIT DROP AS
 SELECT oid,proowner,proacl,prosecdef FROM pg_proc WHERE oid IN
 ('public.figure_continuation_step(uuid,uuid,text,text,text)'::regprocedure,
  'public.figure_continuation_record(uuid,uuid,text,text,jsonb,bytea,text)'::regprocedure,
  'public.figure_continuation_stage(uuid,uuid,text,jsonb)'::regprocedure);
DO $baseline$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='figure_continuation_record') IS DISTINCT FROM '72f641b6cd35067c833ed29552b9347e' THEN RAISE EXCEPTION 'continuation baseline changed';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='figure_continuation_stage') IS DISTINCT FROM 'aa1648271511f5550dfa8e3321af7632' THEN RAISE EXCEPTION 'continuation baseline changed';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='figure_continuation_step') IS DISTINCT FROM '8b3339040f97f31a1f43f214e291ff49' THEN RAISE EXCEPTION 'continuation baseline changed';END IF;
END $baseline$;
CREATE OR REPLACE FUNCTION public.figure_continuation_step(p_id uuid, p_actor uuid, p_kind text, p_key text, p_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE c figure_model_private.continuations%rowtype;s figure_model_private.image_steps%rowtype;lim public.figure_image_limits%rowtype;b figure_model_private.batch%rowtype;e public.question_explanation_overrides%rowtype;
BEGIN
 SELECT * INTO b FROM figure_model_private.batch WHERE id;
 IF NOT FOUND OR NOT b.enabled THEN RETURN jsonb_build_object('status','paused');END IF;
 PERFORM 1 WHERE public.figure_continuation_batch_lock(b.actor_id);
 IF NOT FOUND THEN RETURN jsonb_build_object('status','paused');END IF;
 SELECT * INTO lim FROM public.figure_image_limits WHERE id FOR UPDATE;
 PERFORM 1 FROM public.figure_queue_config WHERE id AND enabled AND capture_new FOR SHARE;
 IF NOT FOUND OR NOT lim.enabled OR NOT lim.capture THEN RETURN jsonb_build_object('status','paused');END IF;
 SELECT * INTO c FROM figure_model_private.continuations WHERE id=p_id AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND OR public.figure_model_locked_text(c.question_id,c.text_sha) IS NULL THEN RETURN jsonb_build_object('status','stale');END IF;
 IF NOT (p_actor=b.actor_id AND c.question_id=ANY(b.targets)) AND NOT EXISTS(SELECT 1 FROM public.ai_guard_requests r JOIN public.figure_queue_jobs j ON j.request_id=r.id WHERE r.id=c.parent_request AND r.actor_id=p_actor AND r.question_id=c.question_id AND r.result_committed AND j.state='done' AND j.needs_state='approved' AND j.question_id=c.question_id AND j.explanation_sha256=c.text_sha AND public.explanation_sitewide_request_allowed(r.id,r.actor_id)) THEN RETURN jsonb_build_object('status','scope');END IF;
 IF EXISTS(SELECT 1 FROM figure_model_private.operations WHERE binding->>'requestId'=c.parent_request::text AND state IN ('reserved','sent','unknown')) THEN RETURN jsonb_build_object('status','held');END IF;

 SELECT * INTO e FROM public.question_explanation_overrides WHERE question_id=c.question_id FOR SHARE;
 IF NOT ((e.replacement_revision IS NULL AND EXISTS(SELECT 1 FROM public.explanation_format_commits f WHERE f.request_id=c.parent_request
  AND f.payload=jsonb_build_object('question_id',e.question_id,'explanation',e.explanation,'option_analysis',e.option_analysis,
  'memory_tip',e.memory_tip,'model',e.model,'updated_at',e.updated_at,'reading_format',e.reading_format)))
  OR (e.replacement_revision=c.parent_request AND EXISTS(SELECT 1 FROM public.explanation_replacement_versions v WHERE v.request_id=c.parent_request
  AND v.actor_id=p_actor AND v.question_id=e.question_id AND v.committed_at IS NOT NULL AND v.restored_at IS NULL
  AND (v.after_snapshot-'figure_status')=(to_jsonb(e)-'figure_status')))) THEN RETURN jsonb_build_object('status','stale_revision');END IF;
 IF p_kind NOT IN ('search','download') OR p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF EXISTS(SELECT FROM figure_model_private.image_steps WHERE continuation_id=p_id AND state<>'completed') THEN RETURN jsonb_build_object('status','held');END IF;
 SELECT * INTO s FROM figure_model_private.image_steps WHERE kind=p_kind AND key=p_key;
 IF FOUND THEN RETURN jsonb_build_object('status',s.state,'dispatch',false);END IF;
 IF p_kind='search' THEN
  IF lim.searches>=lim.max_searches THEN RETURN jsonb_build_object('status','limit');END IF;
  IF p_url IS NULL THEN
   IF p_key<>encode(sha256(convert_to(c.query,'UTF8')),'hex') THEN RETURN jsonb_build_object('status','invalid');END IF;
  ELSE
   IF c.query !~ '^[a-z][a-z -]{1,89}$' OR cardinality(string_to_array(c.query,' '))>8 OR length(p_url)>250
    OR p_key<>encode(sha256(convert_to(p_url,'UTF8')),'hex') THEN RETURN jsonb_build_object('status','invalid');END IF;
   -- Every metadata identity is bound to its completed predecessor in THIS
   -- continuation. No arbitrary URL, PMCID, version or revised digest enters.
   IF NOT coalesce((
    (p_url='pmc-figure-v1:search:'||c.query AND EXISTS(SELECT FROM figure_model_private.image_steps d WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND d.key=encode(sha256(convert_to(c.query,'UTF8')),'hex')))
    OR (p_url ~ '^pmc-figure-v1:versions:PMC[0-9]+$' AND EXISTS(SELECT FROM figure_model_private.image_steps d,LATERAL jsonb_array_elements(d.payload->0->'value') x WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND d.key=encode(sha256(convert_to('pmc-figure-v1:search:'||c.query,'UTF8')),'hex') AND d.payload->0->>'kind'='search' AND d.payload->0->>'identity'=c.query AND p_url='pmc-figure-v1:versions:'||(x->>'pmcid')))
    OR (p_url ~ '^pmc-figure-v1:manifest:PMC[0-9]+[.][1-9][0-9]*$' AND EXISTS(SELECT FROM figure_model_private.image_steps d,LATERAL jsonb_array_elements_text(d.payload->0->'value') x WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND d.payload->0->>'kind'='versions' AND d.key=encode(sha256(convert_to('pmc-figure-v1:versions:'||(d.payload->0->>'identity'),'UTF8')),'hex') AND x ~ ('^'||(d.payload->0->>'identity')||'[.][1-9][0-9]*$') AND p_url='pmc-figure-v1:manifest:'||x))
    OR (p_url ~ '^pmc-figure-v1:jats:PMC[0-9]+[.][1-9][0-9]*:[a-f0-9]{64}:[a-f0-9]{32}$' AND EXISTS(SELECT FROM figure_model_private.image_steps d WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND d.payload->0->>'kind'='manifest' AND d.key=encode(sha256(convert_to('pmc-figure-v1:manifest:'||(d.payload->0->>'identity'),'UTF8')),'hex') AND d.payload->0->'value'->>'version'=d.payload->0->>'identity' AND p_url='pmc-figure-v1:jats:'||(d.payload->0->>'identity')||':'||(d.payload->0->'value'->>'manifestHash')||':'||(d.payload->0->'value'->'xml'->>'md5')))
   ),false) THEN RETURN jsonb_build_object('status','source');END IF;
   -- A prior fresh-worker metadata reservation (complete or unknown) is not
   -- permission to make that HTTP again in the continuation workflow.
   IF EXISTS(SELECT FROM public.figure_image_cache WHERE key=p_key) THEN RETURN jsonb_build_object('status','prior_search');END IF;
  END IF;
  -- Existing unresolved cache keys are held globally; query must be new.
  IF p_url IS NULL AND EXISTS(SELECT FROM public.figure_image_cache WHERE key=encode(sha256(convert_to('["commons-cc-visual-v1","'||c.query||'"]','UTF8')),'hex')) THEN RETURN jsonb_build_object('status','prior_search');END IF;
  UPDATE public.figure_image_limits SET searches=searches+1 WHERE id;
 ELSE
  IF p_url IS NULL OR NOT (p_url ~ '^https://(upload|thumb)[.]wikimedia[.]org/[^?#]+$' OR (p_url ~ '^https://pmc-oa-opendata[.]s3[.]amazonaws[.]com/PMC[0-9]+[.][1-9][0-9]*/[A-Za-z0-9][A-Za-z0-9_.-]{0,180}[.](jpg|jpeg|png|webp)[?]md5=[a-f0-9]{32}$' AND position('..' in p_url)=0)) OR p_key<>encode(sha256(convert_to(p_url,'UTF8')),'hex') OR lim.downloads>=lim.max_downloads OR lim.download_bytes+3145728>lim.max_download_bytes THEN RETURN jsonb_build_object('status','limit');END IF;
  IF NOT EXISTS(SELECT FROM figure_model_private.image_steps d,LATERAL jsonb_array_elements(CASE WHEN d.payload->0->>'kind'='jats' THEN d.payload->0->'value'->'candidates' ELSE d.payload END) x WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND x->>'previewUrl'=p_url) THEN RETURN jsonb_build_object('status','source');END IF;
  -- All URLs from old searches are held, including Q003's uncertain download.
  IF EXISTS(SELECT FROM public.figure_image_cache d,LATERAL jsonb_array_elements(CASE WHEN d.items->0->>'kind'='jats' THEN d.items->0->'value'->'candidates' ELSE coalesce(d.items,'[]') END) x WHERE split_part(x->>'previewUrl','?',1)=split_part(p_url,'?',1))
   OR EXISTS(SELECT FROM figure_model_private.image_steps d,LATERAL jsonb_array_elements(CASE WHEN d.payload->0->>'kind'='jats' THEN d.payload->0->'value'->'candidates' ELSE coalesce(d.payload,'[]') END) x WHERE d.continuation_id<>p_id AND d.kind='search' AND split_part(x->>'previewUrl','?',1)=split_part(p_url,'?',1)) THEN RETURN jsonb_build_object('status','prior_download_hold');END IF;
  UPDATE public.figure_image_limits SET downloads=downloads+1,download_bytes=download_bytes+3145728 WHERE id;
 END IF;
 INSERT INTO figure_model_private.image_steps(continuation_id,kind,key) VALUES(p_id,p_kind,p_key);
 RETURN jsonb_build_object('status','sent','dispatch',true);
END$function$
;
CREATE OR REPLACE FUNCTION public.figure_continuation_record(p_id uuid, p_actor uuid, p_kind text, p_key text, p_payload jsonb, p_bytes bytea, p_mime text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE c figure_model_private.continuations%rowtype;s figure_model_private.image_steps%rowtype;BEGIN
 SELECT * INTO c FROM figure_model_private.continuations WHERE id=p_id AND actor_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','scope');END IF;
 SELECT * INTO s FROM figure_model_private.image_steps WHERE continuation_id=p_id AND kind=p_kind AND key=p_key FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing');END IF;
 IF s.state='completed' THEN RETURN jsonb_build_object('status',CASE WHEN s.payload IS NOT DISTINCT FROM p_payload AND s.image_bytes IS NOT DISTINCT FROM p_bytes AND s.image_mime IS NOT DISTINCT FROM p_mime THEN 'completed' ELSE 'conflict' END);END IF;
 -- NULL evidence means unknown; never makes the step dispatchable again.
 IF p_payload IS NULL AND p_bytes IS NULL THEN UPDATE figure_model_private.image_steps SET state='unknown' WHERE continuation_id=p_id AND kind=p_kind AND key=p_key;RETURN jsonb_build_object('status','unknown');END IF;
 IF p_kind='search' AND p_payload->0 ? 'kind' AND NOT coalesce((
  jsonb_array_length(p_payload)=1 AND p_payload->0->>'kind' IN ('search','versions','manifest','jats')
  AND p_key=encode(sha256(convert_to('pmc-figure-v1:'||(p_payload->0->>'kind')||':'||(p_payload->0->>'identity'),'UTF8')),'hex')
  AND length(p_payload->0->>'identity') BETWEEN 1 AND 230
  AND CASE p_payload->0->>'kind'
   WHEN 'search' THEN jsonb_typeof(p_payload->0->'value')='array' AND jsonb_array_length(p_payload->0->'value')<=2
   WHEN 'versions' THEN jsonb_typeof(p_payload->0->'value')='array' AND jsonb_array_length(p_payload->0->'value')<=1
   WHEN 'manifest' THEN jsonb_typeof(p_payload->0->'value') IN ('object','null')
   WHEN 'jats' THEN jsonb_typeof(p_payload->0->'value')='object' AND jsonb_typeof(p_payload->0->'value'->'candidates')='array' AND jsonb_array_length(p_payload->0->'value'->'candidates')<=3
   ELSE false END
 ),false) THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF p_payload IS NOT NULL AND octet_length(p_payload::text)>12288 THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF p_bytes IS NOT NULL AND octet_length(p_bytes)>3145728 THEN RETURN jsonb_build_object('status','invalid');END IF;
 IF (p_kind='search' AND (p_bytes IS NOT NULL OR jsonb_typeof(p_payload)<>'array' OR jsonb_array_length(p_payload)>3))
 OR (p_kind='download' AND (p_bytes IS NULL OR p_payload IS NOT NULL OR p_mime IS NULL OR p_mime NOT IN ('image/png','image/jpeg','image/webp'))) THEN RETURN jsonb_build_object('status','invalid');END IF;
 UPDATE figure_model_private.image_steps SET state='completed',payload=p_payload,image_bytes=p_bytes,image_mime=p_mime WHERE continuation_id=p_id AND kind=p_kind AND key=p_key;
 RETURN jsonb_build_object('status','completed');
END$function$
;
CREATE OR REPLACE FUNCTION public.figure_continuation_stage(p_id uuid, p_actor uuid, p_download_key text, p_source jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE c figure_model_private.continuations%rowtype;d figure_model_private.image_steps%rowtype;txt text;cid uuid;ih text;e public.question_explanation_overrides%rowtype;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
 SELECT * INTO c FROM figure_model_private.continuations WHERE id=p_id AND actor_id=p_actor FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.question_explanation_overrides WHERE question_id=c.question_id FOR SHARE;
 IF NOT ((e.replacement_revision IS NULL AND EXISTS(SELECT 1 FROM public.explanation_format_commits f WHERE f.request_id=c.parent_request
  AND f.payload=jsonb_build_object('question_id',e.question_id,'explanation',e.explanation,'option_analysis',e.option_analysis,
  'memory_tip',e.memory_tip,'model',e.model,'updated_at',e.updated_at,'reading_format',e.reading_format)))
  OR (e.replacement_revision=c.parent_request AND EXISTS(SELECT 1 FROM public.explanation_replacement_versions v WHERE v.request_id=c.parent_request
  AND v.actor_id=p_actor AND v.question_id=e.question_id AND v.committed_at IS NOT NULL AND v.restored_at IS NULL
  AND (v.after_snapshot-'figure_status')=(to_jsonb(e)-'figure_status')))) THEN RETURN NULL;END IF;
 txt:=public.figure_model_locked_text(c.question_id,c.text_sha);
 SELECT * INTO d FROM figure_model_private.image_steps WHERE continuation_id=c.id AND kind='download' AND key=p_download_key AND state='completed' FOR SHARE;
 IF NOT FOUND OR txt IS NULL OR jsonb_typeof(p_source) IS DISTINCT FROM 'object' OR coalesce(p_source->>'sourceUrl','')='' OR coalesce(p_source->>'license','') NOT IN ('CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC0') OR NOT public.ai_guard_image_eligible(c.question_id,c.text_sha)
 OR encode(sha256(convert_to(p_source->>'previewUrl','UTF8')),'hex') IS DISTINCT FROM p_download_key
 OR NOT EXISTS(SELECT FROM figure_model_private.image_steps s,LATERAL jsonb_array_elements(CASE WHEN s.payload->0->>'kind'='jats' THEN s.payload->0->'value'->'candidates' ELSE s.payload END) x WHERE s.continuation_id=c.id AND s.kind='search' AND s.state='completed' AND x=p_source)
 OR NOT EXISTS(SELECT FROM regexp_split_to_table(txt,E'(?m)(?=^#{2,3}[ \t]+)') section WHERE encode(sha256(convert_to(btrim(section,E' \t\r\n'),'UTF8')),'hex')=c.item->>'sectionHash')
 OR NOT (
  (p_source->>'sourceUrl' ~ '^https://commons[.]wikimedia[.]org/wiki/File:[^?# ]+$' AND p_source->>'previewUrl' ~ '^https://(upload|thumb)[.]wikimedia[.]org/[^?#]+$')
  OR (p_source->>'sourceUrl' ~ '^https://pmc[.]ncbi[.]nlm[.]nih[.]gov/articles/PMC[0-9]+/#[A-Za-z_][A-Za-z0-9_.-]{0,127}$'
   AND p_source->>'previewUrl' ~ '^https://pmc-oa-opendata[.]s3[.]amazonaws[.]com/PMC[0-9]+[.][1-9][0-9]*/[A-Za-z0-9][A-Za-z0-9_.-]{0,180}[.](jpg|jpeg|png|webp)[?]md5=[a-f0-9]{32}$'
   AND position('..' in (p_source->>'previewUrl'))=0
   AND md5(d.image_bytes)=split_part(p_source->>'previewUrl','?md5=',2)
   AND EXISTS(SELECT FROM figure_model_private.image_steps m,figure_model_private.image_steps j,LATERAL jsonb_array_elements(m.payload->0->'value'->'media') media
    WHERE m.continuation_id=c.id AND m.kind='search' AND m.state='completed' AND m.payload->0->>'kind'='manifest'
    AND m.key=encode(sha256(convert_to('pmc-figure-v1:manifest:'||(m.payload->0->>'identity'),'UTF8')),'hex')
    AND m.payload->0->'value'->>'version'=split_part(p_source->>'previewUrl','/',4)
    AND m.payload->0->>'identity'=m.payload->0->'value'->>'version'
    AND p_source->>'sourceUrl' LIKE 'https://pmc.ncbi.nlm.nih.gov/articles/'||(m.payload->0->'value'->>'pmcid')||'/#%'
    AND media->>'url'=p_source->>'previewUrl' AND media->>'md5'=md5(d.image_bytes)
    AND j.continuation_id=c.id AND j.kind='search' AND j.state='completed' AND j.payload->0->>'kind'='jats'
    AND j.payload->0->>'identity'=(m.payload->0->>'identity')||':'||(m.payload->0->'value'->>'manifestHash')||':'||(m.payload->0->'value'->'xml'->>'md5')
    AND j.key=encode(sha256(convert_to('pmc-figure-v1:jats:'||(j.payload->0->>'identity'),'UTF8')),'hex')
    AND j.payload->0->'value'->>'jatsSha256' ~ '^[a-f0-9]{64}$'
    AND EXISTS(SELECT FROM jsonb_array_elements(j.payload->0->'value'->'candidates') candidate WHERE candidate=p_source)
    AND (CASE WHEN p_source->>'license'='CC0' THEN 'CC0' WHEN p_source->>'license' LIKE 'CC BY-SA %' THEN 'CC BY-SA' WHEN p_source->>'license' LIKE 'CC BY %' THEN 'CC BY' END)=m.payload->0->'value'->>'licenseCode'
    AND position((m.payload->0->>'identity') in (p_source->>'attribution'))>0
    AND position((m.payload->0->'value'->>'manifestHash') in (p_source->>'attribution'))>0
    AND position((j.payload->0->'value'->>'jatsSha256') in (p_source->>'attribution'))>0
    AND position((media->>'md5') in (p_source->>'attribution'))>0
   )
  )
 )
 OR p_source->>'licenseUrl' IS DISTINCT FROM (CASE p_source->>'license' WHEN 'CC BY 4.0' THEN 'https://creativecommons.org/licenses/by/4.0/' WHEN 'CC BY-SA 4.0' THEN 'https://creativecommons.org/licenses/by-sa/4.0/' WHEN 'CC BY 3.0' THEN 'https://creativecommons.org/licenses/by/3.0/' WHEN 'CC BY-SA 3.0' THEN 'https://creativecommons.org/licenses/by-sa/3.0/' WHEN 'CC0' THEN 'https://creativecommons.org/publicdomain/zero/1.0/' ELSE NULL END)
 OR coalesce(length(p_source->>'attribution'),0) NOT BETWEEN 1 AND 500
 OR NOT ((d.image_mime='image/png' AND substring(d.image_bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) OR (d.image_mime='image/jpeg' AND substring(d.image_bytes from 1 for 3)=decode('ffd8ff','hex')) OR (d.image_mime='image/webp' AND substring(d.image_bytes from 1 for 4)=convert_to('RIFF','UTF8') AND substring(d.image_bytes from 9 for 4)=convert_to('WEBP','UTF8'))) THEN RETURN NULL;END IF;
 ih:=encode(sha256(d.image_bytes),'hex');
 SELECT id INTO cid FROM public.explanation_figure_candidates WHERE question_id=c.question_id AND explanation_sha256=c.text_sha AND image_sha256=ih;
 IF FOUND THEN RETURN cid;END IF;
 cid:=gen_random_uuid();
 INSERT INTO public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_bytes,image_mime,source_url,license_url,license,attribution,section_title,section_heading,section_anchor,section_sha256,status)
 VALUES(cid,c.question_id,c.text_sha,ih,d.image_bytes,d.image_mime,p_source->>'sourceUrl',p_source->>'licenseUrl',p_source->>'license',p_source->>'attribution',c.item->>'caption',c.item->>'sectionTitle',c.item->>'sectionAnchor',c.item->>'sectionHash','pending');
 RETURN cid;
END$function$
;
DO $verify$ BEGIN
 IF EXISTS(SELECT FROM continuation_acl_before b JOIN pg_proc p USING(oid) WHERE p.proowner IS DISTINCT FROM b.proowner OR p.proacl IS DISTINCT FROM b.proacl OR p.prosecdef IS DISTINCT FROM b.prosecdef) THEN RAISE EXCEPTION 'function privileges changed';END IF;
 IF EXISTS(SELECT FROM continuation_acl_before WHERE has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE')) THEN RAISE EXCEPTION 'unexpected public access';END IF;
END $verify$;
COMMIT;
