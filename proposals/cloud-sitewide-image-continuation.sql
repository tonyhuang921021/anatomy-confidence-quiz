-- Preserve service-only ACLs, configured-owner locking, exact parent actor/text, and all existing traffic/unknown limits.
CREATE OR REPLACE FUNCTION public.figure_continuation_open(p_id uuid, p_actor uuid, p_parent uuid, p_text_sha text, p_item jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE b figure_model_private.batch%rowtype;j public.figure_queue_jobs%rowtype;c figure_model_private.continuations%rowtype;txt text;q text;sitewide_parent boolean;e public.question_explanation_overrides%rowtype;
BEGIN
 SELECT * INTO b FROM figure_model_private.batch WHERE id;
 IF NOT FOUND OR NOT b.enabled OR NOT public.figure_continuation_batch_lock(b.actor_id) THEN RETURN jsonb_build_object('status','paused_or_actor');END IF;
 PERFORM 1 FROM public.figure_image_limits WHERE id AND enabled AND capture FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','capacity');END IF;
 PERFORM 1 FROM public.figure_queue_config WHERE id AND enabled AND capture_new FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','paused');END IF;
 SELECT * INTO j FROM public.figure_queue_jobs WHERE request_id=p_parent FOR SHARE;
 IF NOT FOUND OR j.state<>'done' OR j.explanation_sha256 IS DISTINCT FROM p_text_sha OR j.needs_state<>'approved' THEN RETURN jsonb_build_object('status','scope');END IF;
 sitewide_parent:=EXISTS(SELECT 1 FROM public.ai_guard_requests r WHERE r.id=j.request_id AND r.actor_id=p_actor AND r.question_id=j.question_id AND r.result_committed AND public.explanation_sitewide_request_allowed(r.id,r.actor_id));
 IF NOT sitewide_parent AND (p_actor IS DISTINCT FROM b.actor_id OR j.question_id<>ALL(b.targets)) THEN RETURN jsonb_build_object('status','scope');END IF;
 txt:=public.figure_model_locked_text(j.question_id,p_text_sha);q:=p_item->>'query';
 SELECT * INTO e FROM public.question_explanation_overrides WHERE question_id=j.question_id FOR SHARE;
 IF NOT ((e.replacement_revision IS NULL AND EXISTS(SELECT 1 FROM public.explanation_format_commits f WHERE f.request_id=p_parent
  AND f.payload=jsonb_build_object('question_id',e.question_id,'explanation',e.explanation,'option_analysis',e.option_analysis,
  'memory_tip',e.memory_tip,'model',e.model,'updated_at',e.updated_at,'reading_format',e.reading_format)))
  OR (e.replacement_revision=p_parent AND EXISTS(SELECT 1 FROM public.explanation_replacement_versions v WHERE v.request_id=p_parent
  AND v.actor_id=p_actor AND v.question_id=e.question_id AND v.committed_at IS NOT NULL AND v.restored_at IS NULL
  AND (v.after_snapshot-'figure_status')=(to_jsonb(e)-'figure_status')))) THEN RETURN jsonb_build_object('status','stale_revision');END IF;

 IF txt IS NULL OR q IS NULL OR q !~ '^[A-Za-z][A-Za-z0-9 -]{2,159}$' OR p_item IS NULL OR octet_length(p_item::text)>4096
 OR NOT EXISTS(SELECT FROM jsonb_array_elements(j.figure_needs->'items') x WHERE (x-'query'-'proposedQuery'-'catalogRevision')=(p_item-'query'-'proposedQuery'-'catalogRevision'))
 OR EXISTS(SELECT FROM jsonb_array_elements(j.figure_needs->'items') x WHERE lower(x->>'query')=lower(q))
 OR EXISTS(SELECT FROM figure_model_private.operations WHERE binding->>'requestId'=p_parent::text AND state IN ('reserved','sent','unknown')) THEN RETURN jsonb_build_object('status','stale_or_replay');END IF;
 SELECT * INTO c FROM figure_model_private.continuations WHERE id=p_id OR (parent_request=p_parent AND lower(query)=lower(q)) LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('status',CASE WHEN c.parent_request=p_parent AND c.actor_id=p_actor AND c.text_sha=p_text_sha AND lower(c.query)=lower(q) THEN 'existing' ELSE 'conflict' END,'id',c.id);END IF;
 IF (SELECT count(*) FROM figure_model_private.continuations WHERE parent_request=p_parent)>=2 THEN RETURN jsonb_build_object('status','continuation_limit');END IF;
 INSERT INTO figure_model_private.continuations(id,parent_request,actor_id,question_id,text_sha,query,item) VALUES(p_id,p_parent,p_actor,j.question_id,p_text_sha,q,p_item);
 -- Same captured text/parent: no new captured subject and no reset of counters.
 -- Each external search/download is independently charged to existing hard caps.
 RETURN jsonb_build_object('status','created','id',p_id);
END$function$
;
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
 SELECT * INTO s FROM figure_model_private.image_steps WHERE kind=p_kind AND key=p_key;
 IF FOUND THEN RETURN jsonb_build_object('status',s.state,'dispatch',false);END IF;
 IF p_kind='search' THEN
  IF p_key<>encode(sha256(convert_to(c.query,'UTF8')),'hex') OR lim.searches>=lim.max_searches THEN RETURN jsonb_build_object('status','limit');END IF;
  -- Existing unresolved cache keys are held globally; query must be new.
  IF EXISTS(SELECT FROM public.figure_image_cache WHERE key=encode(sha256(convert_to('["commons-cc-visual-v1","'||c.query||'"]','UTF8')),'hex')) THEN RETURN jsonb_build_object('status','prior_search');END IF;
  UPDATE public.figure_image_limits SET searches=searches+1 WHERE id;
 ELSE
  IF p_url IS NULL OR p_url !~ '^https://(upload|thumb)[.]wikimedia[.]org/[^?#]+$' OR p_key<>encode(sha256(convert_to(p_url,'UTF8')),'hex') OR lim.downloads>=lim.max_downloads OR lim.download_bytes+3145728>lim.max_download_bytes THEN RETURN jsonb_build_object('status','limit');END IF;
  IF NOT EXISTS(SELECT FROM figure_model_private.image_steps d,LATERAL jsonb_array_elements(d.payload) x WHERE d.continuation_id=p_id AND d.kind='search' AND d.state='completed' AND x->>'previewUrl'=p_url) THEN RETURN jsonb_build_object('status','source');END IF;
  -- All URLs from old searches are held, including Q003's uncertain download.
  IF EXISTS(SELECT FROM public.figure_image_cache d,LATERAL jsonb_array_elements(coalesce(d.items,'[]')) x WHERE split_part(x->>'previewUrl','?',1)=p_url) THEN RETURN jsonb_build_object('status','prior_download_hold');END IF;
  UPDATE public.figure_image_limits SET downloads=downloads+1,download_bytes=download_bytes+3145728 WHERE id;
 END IF;
 INSERT INTO figure_model_private.image_steps(continuation_id,kind,key) VALUES(p_id,p_kind,p_key);
 RETURN jsonb_build_object('status','sent','dispatch',true);
END$function$
;
