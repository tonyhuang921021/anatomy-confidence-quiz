-- LOCAL PROPOSAL ONLY. Preserve old pilot behavior; new flow must be proven.
-- Creating the helper under ai_guard_owner requires a reviewed owner-install DDL
-- step; temporary SET capability (if needed) must be explicitly approved/revoked.
CREATE FUNCTION public.ai_guard_image_eligible(p_question text,p_text_sha text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT FROM public.ai_guard_requests r JOIN public.question_explanation_overrides o ON o.question_id=r.question_id WHERE r.question_id=p_question AND r.result_committed AND r.state='closed' AND r.action_kind='explanation' AND o.updated_at BETWEEN r.created_at AND r.closed_at AND encode(sha256(convert_to(o.explanation,'UTF8')),'hex')=p_text_sha)
 AND NOT EXISTS(SELECT FROM public.ai_guard_reviewed_questions q JOIN public.ai_guard_reviewed_state s ON s.id AND q.generation=s.generation WHERE q.question_id=p_question)
$$;
-- Owner must be ai_guard_owner, not postgres; no table SELECT grants to app roles.
ALTER FUNCTION public.ai_guard_image_eligible(text,text) OWNER TO ai_guard_owner;
REVOKE ALL ON FUNCTION public.ai_guard_image_eligible(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_guard_image_eligible(text,text) TO service_role;
CREATE TABLE public.figure_review_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,candidate_id uuid NOT NULL,question_id text NOT NULL,
 previous_status text NOT NULL CHECK(previous_status IN ('pending','approved')),decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 reviewer_id uuid NOT NULL,image_bytes bytea NOT NULL,image_sha256 text NOT NULL,explanation_sha256 text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.figure_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.figure_review_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.figure_review_events TO service_role;
GRANT USAGE ON SEQUENCE public.figure_review_events_id_seq TO service_role;
CREATE OR REPLACE FUNCTION public.review_explanation_figure(p_id uuid,p_decision text,p_reviewer uuid,p_visual_confirmed boolean,p_expected_explanation text,p_expected_explanation_sha text,p_expected_image_sha text,p_expected_image bytea)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.explanation_figure_candidates%rowtype; j public.figure_queue_jobs%rowtype; txt text; found_section boolean;
BEGIN
 IF p_reviewer IS NULL OR p_decision NOT IN ('approved','rejected') OR (p_decision='approved' AND p_visual_confirmed IS DISTINCT FROM true) THEN RETURN 'invalid'; END IF;
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
 IF c.question_id IN ('MOEX-100030-1101-Q003','MOEX-100030-1101-Q004','MOEX-099130-2101-Q100') AND p_decision<>'approved' THEN RETURN 'out_of_scope'; END IF;
 INSERT INTO public.figure_review_events(candidate_id,question_id,previous_status,decision,reviewer_id,image_bytes,image_sha256,explanation_sha256) VALUES(c.id,c.question_id,c.status,p_decision,p_reviewer,c.image_bytes,c.image_sha256,c.explanation_sha256);
 UPDATE public.explanation_figure_candidates SET status=p_decision,reviewer_id=p_reviewer,reviewed_at=clock_timestamp(),image_bytes=case when p_decision='rejected' then null else image_bytes end WHERE id=p_id;
 RETURN p_decision;
END $$;
-- Preserve original review function ACL and invoker mode. No public EXECUTE.
