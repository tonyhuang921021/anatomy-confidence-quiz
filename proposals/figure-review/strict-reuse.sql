-- No new roles, grants, RPC signature or SECURITY DEFINER scope.
BEGIN;
ALTER TABLE public.figure_review_events ADD COLUMN reused_from_candidate_id uuid REFERENCES public.explanation_figure_candidates(id);
CREATE OR REPLACE FUNCTION public.review_explanation_figure(p_id uuid, p_decision text, p_reviewer uuid, p_visual_confirmed boolean, p_expected_explanation text, p_expected_explanation_sha text, p_expected_image_sha text, p_expected_image bytea)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE c public.explanation_figure_candidates%rowtype; j public.figure_queue_jobs%rowtype; txt text; found_section boolean; reuse_source uuid; reused_copy public.explanation_figure_candidates%rowtype;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('explanation-figure-review-v1'));
 IF p_reviewer IS NULL OR p_decision NOT IN ('approved','rejected','reuse') OR (p_decision IN ('approved','reuse') AND p_visual_confirmed IS DISTINCT FROM true) THEN RETURN 'invalid'; END IF;
 SELECT * INTO c FROM public.explanation_figure_candidates WHERE id=p_id AND (status='pending' OR (status='approved' AND p_decision='rejected')) FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_pending'; END IF;
 SELECT explanation INTO txt FROM public.question_explanation_overrides WHERE question_id=c.question_id FOR UPDATE;
 IF NOT FOUND OR txt IS DISTINCT FROM p_expected_explanation OR encode(sha256(convert_to(txt,'UTF8')),'hex') IS DISTINCT FROM p_expected_explanation_sha OR c.explanation_sha256 IS DISTINCT FROM p_expected_explanation_sha OR c.image_sha256 IS DISTINCT FROM p_expected_image_sha OR c.image_bytes IS DISTINCT FROM p_expected_image OR encode(sha256(p_expected_image),'hex') IS DISTINCT FROM p_expected_image_sha THEN RETURN 'stale'; END IF;
 IF c.question_id NOT IN ('MOEX-100030-1101-Q003','MOEX-100030-1101-Q004','MOEX-099130-2101-Q100') THEN
  SELECT * INTO j FROM public.figure_queue_jobs WHERE question_id=c.question_id AND explanation_sha256=c.explanation_sha256 FOR SHARE;
  IF NOT FOUND OR j.needs_state<>'approved' OR j.figure_needs->>'status' IS DISTINCT FROM 'approved' OR j.figure_needs->>'explanationHash' IS DISTINCT FROM c.explanation_sha256 OR NOT public.ai_guard_image_eligible(c.question_id,c.explanation_sha256) THEN RETURN 'out_of_scope'; END IF;
  IF NOT EXISTS(SELECT FROM jsonb_array_elements(j.figure_needs->'items') i WHERE i->>'sectionAnchor'=c.section_anchor AND i->>'sectionHash'=c.section_sha256 AND i->>'sectionTitle'=c.section_heading AND i->>'caption'=c.section_title) THEN RETURN 'invalid_binding'; END IF;
  SELECT EXISTS(SELECT FROM regexp_split_to_table(txt,E'(?m)(?=^##[ \t]+)') section WHERE encode(sha256(convert_to(btrim(section,E' \t\r\n'),'UTF8')),'hex')=c.section_sha256) INTO found_section;
  IF NOT found_section THEN RETURN 'stale_section'; END IF;
 END IF;
 IF p_decision='reuse' THEN
  -- Same immutable paragraph, image bytes and provenance; concept names alone
  -- are never authorization. Public-domain pilot evidence is not generalized.
  IF c.license='PDM 1.0' OR c.section_sha256 IS NULL OR c.section_heading IS NULL
    OR c.question_id IN ('MOEX-100030-1101-Q003','MOEX-100030-1101-Q004','MOEX-099130-2101-Q100')
    THEN RETURN 'reuse_not_exact'; END IF;
  SELECT s.id INTO reuse_source FROM public.explanation_figure_candidates s
    JOIN public.question_explanation_overrides o ON o.question_id=s.question_id
    WHERE s.id<>c.id AND s.status='approved'
     AND s.image_sha256=c.image_sha256 AND s.image_bytes=c.image_bytes AND s.image_mime=c.image_mime
     AND s.section_sha256=c.section_sha256 AND s.section_heading=c.section_heading AND s.section_title=c.section_title
     AND s.source_url=c.source_url AND s.license=c.license AND s.license_url=c.license_url AND s.attribution=c.attribution
     AND encode(sha256(s.image_bytes),'hex')=s.image_sha256
     AND encode(sha256(convert_to(o.explanation,'UTF8')),'hex')=s.explanation_sha256
    ORDER BY s.reviewed_at DESC,s.id LIMIT 1 FOR SHARE OF s,o;
  IF reuse_source IS NULL THEN RETURN 'reuse_not_exact'; END IF;
  p_decision:='approved';p_visual_confirmed:=true;
 END IF;
 IF c.question_id IN ('MOEX-100030-1101-Q003','MOEX-100030-1101-Q004','MOEX-099130-2101-Q100') AND p_decision<>'approved' THEN RETURN 'out_of_scope'; END IF;
 IF p_decision='rejected' AND c.status='approved' THEN
  -- Withdrawal of a reused source withdraws dependent approvals too.
  FOR reused_copy IN
   WITH RECURSIVE descendants(id) AS (
    SELECT e.candidate_id FROM public.figure_review_events e WHERE e.decision='approved' AND e.reused_from_candidate_id=c.id
    UNION
    SELECT e.candidate_id FROM public.figure_review_events e JOIN descendants d ON e.reused_from_candidate_id=d.id WHERE e.decision='approved'
   )
   SELECT child.* FROM public.explanation_figure_candidates child WHERE child.id IN (SELECT id FROM descendants) AND child.status='approved' ORDER BY child.id FOR UPDATE
  LOOP
   INSERT INTO public.figure_review_events(candidate_id,question_id,previous_status,decision,reviewer_id,image_bytes,image_sha256,explanation_sha256,reused_from_candidate_id)
    VALUES(reused_copy.id,reused_copy.question_id,'approved','rejected',p_reviewer,reused_copy.image_bytes,reused_copy.image_sha256,reused_copy.explanation_sha256,c.id);
   UPDATE public.explanation_figure_candidates SET status='rejected',reviewer_id=p_reviewer,reviewed_at=clock_timestamp(),image_bytes=NULL WHERE id=reused_copy.id;
  END LOOP;
 END IF;
 INSERT INTO public.figure_review_events(candidate_id,question_id,previous_status,decision,reviewer_id,image_bytes,image_sha256,explanation_sha256,reused_from_candidate_id) VALUES(c.id,c.question_id,c.status,p_decision,p_reviewer,c.image_bytes,c.image_sha256,c.explanation_sha256,reuse_source);
 UPDATE public.explanation_figure_candidates SET status=p_decision,reviewer_id=p_reviewer,reviewed_at=clock_timestamp(),image_bytes=case when p_decision='rejected' then null else image_bytes end WHERE id=p_id;
 RETURN p_decision;
END $function$;

COMMIT;

