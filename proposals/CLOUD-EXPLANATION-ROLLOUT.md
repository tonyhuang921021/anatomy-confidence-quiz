# Cloud explanation candidate

Base: production Git commit `6b2e5e8c10be745b69a3d97b0f865842cb8f121a`, recovered directly from GitHub after verifying Vercel production alias. This candidate contains no unpushed desktop changes. It has not been deployed, and no production SQL or paid model call was made while preparing it.

## Implemented

- Stable first-generation operation IDs, saved in the browser before dispatch. Returned model response is immutably checkpointed before settlement/publication, including responses with unknown usage. Recovery cannot dispatch a new model call.
- Separate generation and versioned replacement recovery. Incomplete responses remain evidence and do not publish; newer shared winners are preserved. Existing replacement backups and exact-base witness remain authoritative.
- General authenticated admission through the existing server-side authentication and ban checks, one call per operation, one global/actor concurrent request, and existing hourly/daily limits. No fixed three-question or single-operator allowlist in the new admission path.
- Existing integrated teaching prompt remains the primary content pipeline. Fourteen previously reviewed source snapshots are pinned to full stems/options/scoring; uncertain source records cannot seed generation or context, and shared unrelated entities cannot erase subtype qualifier conflicts.
- Paragraph/explanation/image hashes and medical/source/license review remain unchanged. The existing five-minute authenticated rollup cron consumes only fresh sitewide image jobs. Invalid search plans receive immutable payload-hash holds without resetting attempts; they cannot starve later valid plans.

## Security boundary proposed, not installed

The SQL files create an unexposed `explanation_private` schema, four private tables (immutable result journal, admission policy, admitted operation identities, held image-plan revisions), and eleven narrow RPC implementations with service-only public wrappers. New implementations are SECURITY DEFINER because existing guard/backup tables intentionally grant no raw service-role access. No existing guard table receives new SELECT/INSERT/UPDATE rights. Raw journal tables have no runtime direct read/write grants. Anonymous and authenticated browser roles have no execute or table access.

Three existing guarded functions are narrowly extended: `ai_guard_start_call`, `figure_model_reserve`, `ai_guard_commit_replacement`. Their public/anonymous/authenticated execution is explicitly revoked; service_role remains the only runtime caller. Existing settled-call, reviewed-generation, current version, image-byte/hash and transaction-witness checks are retained.

The policy is created disabled. Before applying, compare all captured source hashes, schemas and ACLs with current production, including `ai_guard_commit_replacement`. If anything changed, stop and reconcile. Apply reviewed schema changes transactionally, then run role/ACL and no-provider smoke checks before enabling admission. Do not import credentials or create new keys.

## Funding and bounded activation

Observed shared guard: cap 2,000,000 microUSD; spent 902,192; reserved 0. Remaining was 1,097,808 microUSD. Keep the existing balance/cap; do not interpret this as a new extra $2. Text ceiling is 56,000 microUSD and image review ceiling 2,064 microUSD. Both reserve against the same guard. Existing image sub-cap: 168,000, charged 62,192; model calls 3 of 9. A one-time test cannot promise indefinite sitewide service.

Observed image queue capture is off, model review is off. Image counters are near their separate caps: captured 15/16, searches 18/21, downloads 21/26, reserved bytes 66,060,288/81,788,928. These must not be silently reset or described as unlimited. Any new finite image-work allowance and enablement must be explicitly included in activation approval. Existing total image storage cap is 104,857,600 bytes.

Proposed environment activation after approval: `EXPLANATION_SITEWIDE_ENABLED=1`, `EXPLANATION_GENERATION_JOURNAL_ENABLED=1`, existing capture/worker/review switches as needed. The sitewide branch supersedes the old three-ID batch filter only for new admitted jobs. Disable new admission to stop spending; keep recovery RPCs installed so completed paid results remain recoverable. Never reset or replay unknown/dispatched operations.

## Validation

Use Node 22. `npm ci --ignore-scripts`, `npm run test:explanation-cloud`, `npm run typecheck`, and `NODE_OPTIONS=--max-old-space-size=4096 npm run build`. Local PostgreSQL tests use PGlite with observed table shapes and captured exact replacement helper definitions; the budget settlement/close fixtures are controlled test doubles, not a clone of production.

The targeted suite tests local client idempotency, private role boundaries, full-scope admission, exact response recovery, budget/duplicate refusal, image-plan starvation, and final top-three teaching context. It makes zero provider calls. The first 2-GiB build hit a local Node heap limit; the 4-GiB build succeeds. Existing repository tests with obsolete queue/client mocks were found during inspection and are not represented as passing this candidate.

## Remaining release checks

- Approval of the exact persistent capability/schema/RPC changes and the finite image allowance; no installation or enabling has occurred.
- Production-compatible role/schema smoke tests after installation, then one authenticated real first-generation and one explicit replacement within the existing shared budget. Preserve output if any response or commit becomes unknown.
- Actual browser/visual acceptance and current production-alias verification after an approved deployment.
- Source-image questions that still require the unpublished desktop image-input implementation remain safely unsupported by this baseline. This candidate does not pretend those unmerged changes are present.
