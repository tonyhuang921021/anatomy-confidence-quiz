# 2026-10-20 completed-reader release

Scope: 200 completed questions from 112年第二次醫學（一） and 醫學（二）, mapped to the existing `MOEX-112100-1301-Q001…Q100` and `MOEX-112100-2301-Q001…Q100` IDs. Four author handoff SHA-256 values were verified before importing; versions and hashes are recorded in `data/reviewedExplanationProvenance.json`.

The importer preserves accepted medical prose, captions, source links and original raster bytes. Full readers retain original question media (including Q62 formula images). Short readers use the accepted opening paragraph. There are 191 image placements and 186 deduplicated raster assets. Images load only on demand, with lazy loading inside the detailed reader; the question index is small and payloads are fetched individually.

Ten question text discrepancies against the existing bank were reviewed: med1 Q30, 56, 62, 64, 65, 66, 75, 77, 79 and 85. These are OCR, symbol, subscript, punctuation or spacing differences. The original question bank and scoring were not changed. Answer comparisons passed, including med2 Q69's all-credit status. The author's med2 Q49 textbook-source gap remains documented rather than filled with invented evidence.

Six shared-reader entry points cover quiz, results, search, review notebook, study-note card and subject notes. Accepted IDs hide AI generation/replacement controls while retaining short/full switching, reporting, related content and human supplements. Other questions retain existing behavior. Existing stored explanations and human supplements are not deleted.

## Rights and attribution

The user explicitly confirmed a purely noncommercial site. Original CC BY, CC BY-SA, CC BY-NC-SA, public-domain and ASTMH notices remain attached to their figures. Eight OpenStax figure captions additionally include the required “Access for free at” book URL (med1 Q7, 15, 18, 19, 21, 26, 40, 41). These additions contain credit metadata only. For med1 Q14 and med2 Q9, 13, 22, the available article rights text identifies CC BY but does not establish a version; the site preserves that notice and source link without inventing a version. It does not apply a newer site-wide license retroactively to original images.

## Validation

- Four source hashes matched; 200 explicit IDs mapped; all final-answer comparisons passed.
- All 200 readers were opened in Chromium desktop and WebKit mobile: 8 batch tests passed, covering 400 reader renders and every image placement in both engines. Full images decoded and no horizontal document overflow was detected.
- Motion regression before reader integration: 97 passed, 5 skipped; quiz analysis 233 passed. Reduced motion, keyboard focus, route transitions and PWA fixture isolation are covered.
- Final production build, typecheck and lint passed (existing lint warnings remain). Site-shell regression: 55 passed, 3 device-specific skips. Reader controls: 4 passed after correcting a test-only search/debounce race; no application change was needed. Production verification is recorded separately after deployment.

## Deferred sources

113–115 older Library HTML readers were not imported: the documented authenticated Library download helper returned HTTP 403 before transfer. Ten distinct download attempts produced zero HTML files; the remaining 22 nonduplicate entries were not retried after that blocker. The site retains its prior content. The 114-second original-image gaps (med1 Q97–99, med2 Q98–100) were not filled by guesses. This release does not claim those older readers were updated.

The original user checkout and its uncommitted changes were not modified. Deployment uses the Git integration, not the local E2E build containing fake service configuration.
