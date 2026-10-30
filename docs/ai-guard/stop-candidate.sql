-- CANDIDATE: stop new guard dispatch without dropping accounting or protections.
-- Run only as the restricted owner. Stop and drain legacy workers separately.
-- The budget row serializes this operation with reserve/start/settle/close.
BEGIN;
DO $$
DECLARE b public.ai_guard_budget%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.ai_guard_budget WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'guard budget missing; dispatch remains unverified'; END IF;
 UPDATE public.ai_guard_budget SET enabled=false,
   disabled_at=coalesce(disabled_at,clock_timestamp()) WHERE id=true;
END $$;
SELECT CASE WHEN EXISTS(SELECT 1 FROM public.ai_guard_requests WHERE state='active')
                  OR EXISTS(SELECT 1 FROM public.ai_guard_calls WHERE state='started')
                  OR (SELECT reserved_microusd FROM public.ai_guard_budget WHERE id=true)<>0
            THEN 'disabled_drain_required' ELSE 'disabled_drained' END AS guard_status,
       (SELECT count(*) FROM public.ai_guard_requests WHERE state='active') AS active_requests,
       (SELECT count(*) FROM public.ai_guard_calls WHERE state='started') AS unresolved_calls,
       (SELECT reserved_microusd FROM public.ai_guard_budget WHERE id=true) AS reserved_microusd;
COMMIT;
-- Never drop tables, ledger, audit, RPCs or reviewed write barrier. Repeating is safe.
-- This cannot itself prove old workers stopped or provider charges reconciled.
