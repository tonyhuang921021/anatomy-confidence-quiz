-- CANDIDATE, restricted owner only. External verification of drained workers,
-- provider cost, project/credit, price and deployment/source relationship is mandatory.
-- psql: -v expected_manifest=<64 lowercase hex> -v expected_source=<40 lowercase hex>
-- No automatic recovery of cost_overflow / usage_over_ceiling / pricing_error.
BEGIN;
SELECT set_config('ai_guard.expected_manifest', :'expected_manifest', true),
       set_config('ai_guard.expected_source', :'expected_source', true);
LOCK TABLE public.question_explanation_overrides IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE b public.ai_guard_budget%ROWTYPE; v public.ai_guard_reviewed_state%ROWTYPE;
        expected_manifest text:=current_setting('ai_guard.expected_manifest');
        expected_source text:=current_setting('ai_guard.expected_source');
BEGIN
 IF expected_manifest !~ '^[0-9a-f]{64}$' OR expected_source !~ '^[0-9a-f]{40}$' THEN
   RAISE EXCEPTION 'invalid expected snapshot'; END IF;
 SELECT * INTO b FROM public.ai_guard_budget WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'guard budget missing'; END IF;
 SELECT * INTO v FROM public.ai_guard_reviewed_state WHERE id=true;
 IF NOT FOUND OR v.manifest_sha256 IS DISTINCT FROM expected_manifest OR v.source_commit IS DISTINCT FROM expected_source THEN
   RAISE EXCEPTION 'snapshot mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.ai_guard_reviewed_questions WHERE generation<>v.generation) OR
    encode(sha256(convert_to(array_to_json(ARRAY(SELECT question_id FROM public.ai_guard_reviewed_questions ORDER BY question_id COLLATE "C"))::text,'UTF8')),'hex') IS DISTINCT FROM expected_manifest THEN
   RAISE EXCEPTION 'snapshot contents mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.question_explanation_overrides'::regclass
                 AND tgname='ai_guard_reviewed_write_barrier' AND NOT tgisinternal AND tgenabled='O' AND tgtype=31
                 AND tgfoid='public.ai_guard_reviewed_write_barrier()'::regprocedure) THEN
   RAISE EXCEPTION 'reviewed barrier missing'; END IF;
 IF b.disabled_reason IS NOT NULL THEN RAISE EXCEPTION 'emergency reason requires investigation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ai_guard_legacy_liability WHERE id=true AND status='external_unknown'
   AND total_microusd=7042458 AND original_unknown_microusd=124505 AND expanded_unknown_microusd=821733
   AND acceptance_evidence_sha256 ~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'legacy reserve or approval evidence missing'; END IF;
 IF b.verified_grant_microusd IS NULL OR b.cap_microusd IS NULL OR b.cap_microusd > (CASE WHEN b.budget_phase='first_batch' THEN LEAST(1000000,GREATEST(0,LEAST(31000000,b.verified_grant_microusd)-7042458)) ELSE GREATEST(0,LEAST(31000000,b.verified_grant_microusd)-7042458) END) THEN
   RAISE EXCEPTION 'legacy reserve cap violation'; END IF;

 IF b.reserved_microusd<>0 OR EXISTS(SELECT 1 FROM public.ai_guard_requests WHERE state='active')
    OR EXISTS(SELECT 1 FROM public.ai_guard_calls WHERE state='started') THEN
   RAISE EXCEPTION 'pending reservations or unresolved calls'; END IF;
 IF b.verified_credit_expires_at IS NULL OR b.verified_credit_expires_at<=clock_timestamp()
    OR b.cap_microusd IS NULL OR b.envelope_microusd IS NULL OR b.max_calls IS NULL
    OR b.per_call_ceiling_microusd IS NULL OR b.per_call_ceiling_microusd::numeric*b.max_calls>b.envelope_microusd
    OR b.max_parallel IS NULL OR b.max_actor_parallel IS NULL OR b.cooldown_seconds IS NULL
    OR b.hourly_limit IS NULL OR b.daily_limit IS NULL OR b.model IS NULL OR b.pricing_revision IS NULL
    OR b.spent_microusd::numeric+b.envelope_microusd::numeric>b.cap_microusd THEN
   RAISE EXCEPTION 'guard configuration insufficient'; END IF;
 UPDATE public.ai_guard_budget SET enabled=true,disabled_at=NULL WHERE id=true;
END $$;
COMMIT;
