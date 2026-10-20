# 2026-10-20 completed-reader release

Scope: 1,400 completed questions: 112年第二次 and both sessions of 113–115年, 醫學（一） and 醫學（二）. The original 200 questions use four hash-pinned author handoffs; the additional 1,200 use 35 original Library HTML files. All 18 transport package SHA-256 values and ZIP CRCs were verified; the large split ZIP was reconstructed and hash-checked. Every original HTML matches its recorded hash. Explicit source anchors map to the existing canonical exam/paper/question tuple, including five existing supplement IDs. No question IDs were renamed. Versions and hashes are recorded in `data/reviewedExplanationProvenance.json`.

The importers preserve accepted medical prose, captions, source links and original image bytes. Marked source question text/options and navigation controls are removed; necessary original diagrams and formula images remain. Source-authored short/detail panels are used when present; otherwise the accepted opening paragraph supplies the short view. There are 969 detailed image placements and 849 deduplicated assets. Four original SVG placements are checked for active/external references; embedded raster references remain intact. Images load lazily, reserve their intrinsic aspect ratio, fit compact desktop/mobile height limits, and retain an original-image link. Loading/error labels stay within the reserved frame. Adjacent comparison figures share a responsive grid. Explicit short/detail toggles preserve the control’s viewport position.

Ten question text discrepancies against the existing bank were reviewed: med1 Q30, 56, 62, 64, 65, 66, 75, 77, 79 and 85. These are OCR, symbol, subscript, punctuation or spacing differences. The original question bank and scoring were not changed. Answer comparisons passed, including med2 Q69's all-credit status. The author's med2 Q49 textbook-source gap remains documented rather than filled with invented evidence.

Ten shared-reader entry points cover quiz, results, search, review notebook, study-note card, subject notes, saved questions, individual notes, related questions and pharmacology exam questions. Accepted IDs hide AI generation/replacement controls while retaining short/full switching, reporting, related content and human supplements. Other questions retain existing behavior. Existing stored explanations and human supplements are not deleted.

## Rights and attribution

The user explicitly confirmed a purely noncommercial site. Original CC BY, CC BY-SA, CC BY-NC-SA, public-domain and ASTMH notices remain attached to their figures. Eight OpenStax figure captions additionally include the required “Access for free at” book URL (med1 Q7, 15, 18, 19, 21, 26, 40, 41). These additions contain credit metadata only. For med1 Q14 and med2 Q9, 13, 22, the available article rights text identifies CC BY but does not establish a version; the site preserves that notice and source link without inventing a version. It does not apply a newer site-wide license retroactively to original images.

## Prior 200-question release validation (historical)

- Four source hashes matched; 200 explicit IDs mapped; all final-answer comparisons passed.
- All 200 readers were opened in Chromium desktop and WebKit mobile: 8 batch tests passed, covering 400 reader renders and every image placement in both engines. Full images decoded and no horizontal document overflow was detected.
- Motion regression before reader integration: 97 passed, 5 skipped; quiz analysis 233 passed. Reduced motion, keyboard focus, route transitions and PWA fixture isolation are covered.
- Final production build, typecheck and lint passed (existing lint warnings remain). Site-shell regression: 55 passed, 3 device-specific skips. Reader controls: 4 passed after correcting a test-only search/debounce race; no application change was needed. Production verification is recorded separately after deployment.

## Recovered source provenance

The earlier source-transfer blocker is resolved. The additional 1,200 accepted explanations are included together; four redundant compilation files were not imported as separate questions. Cached source files have no version xattrs: their index-declared editions are recorded separately from verified current Library versions. No unknown version is represented as independently verified. Special source anchors (115-first med1 Q95/Q98 and med2 Q69) were resolved against their actual original content and canonical question identities. All 1,200 source stems and answer-credit rules passed the import identity checks. The 114-first med1 Q77 official all-credit notice agrees with the existing `answerCreditType`; its legacy `answer: A` field is not the scoring rule. Neither scoring nor stored history was changed.

Rebuild in order: export the canonical bank with `scripts/export-canonical-question-bank.cjs`, run `scripts/import-reviewed-readers.py` with the 112 author handoff, then run `scripts/import-legacy-readers.py` with the materialized source root containing the verified inventory and originals. The source imports are local tooling; no Library download credentials or temporary responses belong in this repository.

The original user checkout and its uncommitted changes were not modified. Deployment uses the Git integration, not the local E2E build containing fake service configuration.

## Complete-release validation

- Release working copy: isolated `/tmp/anatomy-complete-release-20261020`, base `a34f127f111cd4354c1719039f917d525f1ddb7f`. All 2,086 preserved transfer entries recovered; copied data/public bytes match their SHA-256 manifest. The original user checkout remains untouched.
- Clean install from the existing lockfile. A preserved partial dependency directory was moved outside the source tree after TypeScript included it through its broad source glob and exhausted its heap. Typecheck subsequently passed; no compiler limits or validation rules were relaxed. The final local production-style build succeeded.
- Quiz analysis: 234 tests passed. Lint passed with the same 38 existing warnings. `git diff --check` passed.
- Every actual local HTTP response was checked against the release bytes: 1,400 JSON readers and 849 original assets, 2,249/2,249 matched, zero retries.
- Focused results: 30 cases passed. Two sticky-note assertions used a locator that depended on the button's pre-click label; the visible page already contained the expected all-credit label. The selector was corrected to the stable sticky container, without changing application behavior or weakening the assertion.
- Notes now use a shared answer-label formatter for all-credit and multiple accepted answers in embedded cards, subject question drawers, and individual-note sticky cards. Existing scoring and persisted attempt fields are unchanged.
- Result regression seeds historical attempts once only, then compares the complete stored record before/after interaction and reload. Coverage includes 112–115, all five supplement IDs and the existing `missing-2024-2-113090-1301-q053` ID; no IDs are renamed.
- Natural guest-flow rehearsal passed in desktop Chromium and mobile WebKit: search four representative questions, read current explanations and images, select a private practice, submit answers, view results and reload with identical completed history. No API mocks or injected quiz/history records were used by this checker; the rehearsal used the isolated local server. The same checker will run against production after deployment.

The full 46-case browser scope is complete across the main run and bounded remainder runs: 38 cases completed successfully before interruption, then both affected desktop batches and all six remaining mobile batches passed. This covers all 1,400 readers in both engines (2,800 reader renders), all images including source-authored disclosures, all four notes checks, and ten motion/navigation journeys. The two image failures were second lazy images inside closed source-authored details, confirmed in traces; opening those details through their summaries resolved the checks. Original SVG/WebP bytes and application rendering were unchanged. The main interrupted log alone is not represented as a successful full run. Logs: `release-complete-browser.log`, `release-desktop-remainder.log` (2 passed), `release-mobile-remainder.log` (6 passed).

Final typecheck and staged diff checks passed. Production results are recorded in the release handoff after deployment. Local E2E builds use fake service configuration and are not deployment artifacts.
