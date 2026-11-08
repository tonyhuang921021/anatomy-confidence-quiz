CREATE OR REPLACE FUNCTION public.figure_text_commit_lock(p_id uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
 IF NOT EXISTS(SELECT FROM public.ai_guard_requests r JOIN public.explanation_replacement_versions v ON v.request_id=r.id
 WHERE r.id=p_id AND r.actor_id=p_actor AND v.actor_id=p_actor AND (r.state='active' OR (r.result_committed AND v.committed_at IS NOT NULL))) THEN
 RAISE EXCEPTION 'replacement lock scope';END IF;
 LOCK TABLE public.question_explanation_overrides IN SHARE ROW EXCLUSIVE MODE;
END$function$;

CREATE OR REPLACE FUNCTION public.figure_text_commit_write(p_id uuid, p_actor uuid)
 RETURNS question_explanation_overrides
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE r public.ai_guard_requests%rowtype;v public.explanation_replacement_versions%rowtype;
 p jsonb; shared jsonb; reviewed jsonb; current_base text;winner public.question_explanation_overrides%rowtype;
BEGIN
 SELECT * INTO r FROM public.ai_guard_requests WHERE id=p_id FOR UPDATE;
 SELECT * INTO v FROM public.explanation_replacement_versions WHERE request_id=p_id AND actor_id=p_actor FOR UPDATE;
 SELECT to_jsonb(e) INTO shared FROM public.question_explanation_overrides e WHERE question_id=r.question_id;
 SELECT jsonb_build_object('question_id',r.question_id,'generation',s.generation,'manifest_sha256',s.manifest_sha256,'source_commit',s.source_commit) INTO reviewed FROM public.ai_guard_reviewed_state s JOIN public.ai_guard_reviewed_questions q ON q.generation=s.generation AND q.question_id=r.question_id WHERE s.id;
 current_base:=encode(sha256(convert_to(jsonb_build_object('shared',shared,'reviewed_static_ref',reviewed)::text,'UTF8')),'hex');
 IF r.id IS NULL OR v.request_id IS NULL OR r.actor_id IS DISTINCT FROM p_actor OR r.state<>'active' OR r.result_committed
 OR v.write_transaction IS DISTINCT FROM txid_current() OR v.committed_at IS NOT NULL
 OR v.question_id<>r.question_id OR v.base_version IS DISTINCT FROM current_base
 OR NOT EXISTS(SELECT FROM public.ai_guard_calls WHERE request_id=p_id AND seq=1 AND state='settled')
 OR EXISTS(SELECT FROM public.ai_guard_calls WHERE request_id=p_id AND state<>'settled')
 OR NOT EXISTS(SELECT FROM public.ai_guard_reviewed_state WHERE id AND generation=r.reviewed_generation)
 THEN RAISE EXCEPTION 'exact replacement witness required';END IF;
 p:=v.after_snapshot;
 IF p->>'replacement_revision' IS DISTINCT FROM p_id::text OR p->>'model' IS DISTINCT FROM r.model
 OR p->>'reading_format' IS DISTINCT FROM 'full-v1' OR coalesce(length(p->>'explanation'),0) NOT BETWEEN 1 AND 100000
 OR jsonb_typeof(p->'option_analysis') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid exact payload';END IF;
 INSERT INTO public.question_explanation_overrides AS eo(question_id,explanation,option_analysis,memory_tip,model,updated_at,replacement_revision,figure_status,reading_format)
 VALUES(r.question_id,p->>'explanation',p->'option_analysis',p->>'memory_tip',r.model,(p->>'updated_at')::timestamptz,p_id,p->>'figure_status','full-v1')
 ON CONFLICT(question_id) DO UPDATE SET explanation=excluded.explanation,option_analysis=excluded.option_analysis,memory_tip=excluded.memory_tip,
 model=excluded.model,updated_at=excluded.updated_at,replacement_revision=excluded.replacement_revision,figure_status=excluded.figure_status,reading_format=excluded.reading_format
 RETURNING eo.* INTO winner;
 RETURN winner;
END$function$;
