# Bounded Terra run authorization

A single operator-approved run separates the actual billing observation from its
operational authorization. `credit_observed_at` records when official billing
was read; `credit_grant_expires_at` records the actual grant expiry;
`run_authorized_until` records the explicitly approved operating deadline.
`verified_credit_expires_at` remains the effective cutoff consumed by existing
reserve/start RPCs, constrained to both the authorized deadline and grant expiry.
It no longer represents a rolling observation-age deadline for this run.

The private budget table remains owner-only with RLS. No RPC signatures, EXECUTE
grants, client-readable policies, credentials or permanent memberships change.
Installation uses temporary inherited owner membership without SET ROLE and
revokes it in the same transaction, followed by an independent residue check.

This run ends no later than 2026-11-03T16:25:32Z. The literal USD2 ledger cap
includes historical debits; spent/reserved are never reset. Each Terra Standard
call reserves USD0.056 atomically; concurrency remains one. Unknown outcomes
retain their reservation and stop dispatch. Other paid routes remain disabled.
The original image limits remain unchanged. There is no automatic renewal.

Rollback stops new dispatch by setting enabled=false through the authorized
management transaction; retain evidence columns and accounting history. Do not
delete generated text, image review events or outstanding reservations. A code
rollback does not authorize resetting the budget or extending the deadline.
