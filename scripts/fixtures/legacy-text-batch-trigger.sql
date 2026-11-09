CREATE OR REPLACE FUNCTION figure_model_private.text_batch_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'figure_model_private'
AS $function$
DECLARE b figure_model_private.batch%rowtype; BEGIN
 -- ai_guard_reserve already owns the shared budget row; explicit lock also
 -- covers trusted direct fixture inserts. Same budget -> batch order as Luna.
 PERFORM 1 FROM public.ai_guard_budget WHERE id FOR UPDATE;
 SELECT * INTO b FROM figure_model_private.batch WHERE id FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT b.enabled THEN RAISE EXCEPTION 'bounded_text_batch_paused'; END IF;
 IF NOT coalesce(((b.funding_mode='cash_authorized' AND b.cash_authorized AND b.funding_evidence_sha ~ '^[0-9a-f]{64}$') OR (b.funding_mode='verified_credit' AND b.no_cash AND b.credit_until>clock_timestamp())),false) OR NEW.actor_id<>b.actor_id OR NOT NEW.question_id=ANY(b.targets)
  OR NEW.action_kind<>'explanation' OR NEW.call_limit<>1 OR b.text_requests>=3
  OR NEW.envelope_microusd<=0 OR b.charged+NEW.envelope_microusd>b.cap THEN
  RAISE EXCEPTION 'bounded_text_batch_denied'; END IF;
 INSERT INTO figure_model_private.text_reservations VALUES(NEW.id,NEW.question_id,NEW.envelope_microusd,clock_timestamp());
 UPDATE figure_model_private.batch SET charged=charged+NEW.envelope_microusd,text_requests=text_requests+1 WHERE id;
 RETURN NEW;
END $function$
