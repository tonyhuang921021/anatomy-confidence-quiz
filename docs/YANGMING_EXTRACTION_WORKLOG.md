# Yangming Explanation Extraction Worklog

This file is the handoff note for the Yangming explanation pipeline. Read this before changing the importer again.

## Current Direction

- Prefer original-layout assets over OCR text. OCR/body text can collapse line breaks, miss options, split sections, or lose paragraphs.
- Safe assets should be `image`, `table`, or `question_snapshot`.
- Do not serve or import old `page_snapshot`, `full_page`, or `fallback` assets as final explanation content. Those caused cover pages, neighboring questions, and broken full-page screenshots to appear online.
- If a production page shows a cover, blank image, or next-question leakage while the local safe batch looks correct, treat it as stale imported data or stale asset paths first, not as proof that v9 local extraction failed.

## Latest Local Batch

- Batch directory: `/private/tmp/ym_full_retrim_v9`
- Important command choice: `--page-snapshot-mode none`
- Safe rows JSON keeps only safe `image` and `table` assets after filtering.
- Local safe asset audit found no missing files in the v9 batch.
- Known checked examples with local safe assets:
  - `MOEX-110101-1301-Q020`
  - `MOEX-112100-1301-Q034`
  - `MOEX-112100-1301-Q036`
  - `MOEX-110101-1301-Q070`

## Known Data Caveat

- `112-2醫學二.pdf` appears mixed/incomplete locally. It contains a page range for 112-2 medical two, then later pages switch metadata. Do not force-complete that paper from the wrong metadata. Ask for the correct complete PDF if full coverage is needed.

## Frontend/API Rules

- The frontend should render `image`, `table`, and `question_snapshot` as authoritative original-layout assets, before OCR-derived text.
- The API should reject old fallback/full-page assets even if they remain in Supabase from older imports.
- Treat legacy asset metadata defensively: `kind` should be normalized to lowercase, and both boolean `fallback: true` and string `fallback: "true"` must be rejected.
- Production still contains old `question_snapshot` rows under `assets/...snapshot...`; these can be blank, cover pages, or neighboring-question crops. Only allow `question_snapshot` if it comes from the newer safe batch path prefix `per_file/`. The current v9 dry-run imports only `image` and `table`.
- User-visible explanation locations should be consistent: quiz, results, wrong review, question search, and note-side linked questions.

## Next Safe Steps

1. Verify code-only changes with `git diff --check` and targeted script syntax checks.
2. Avoid importing v9 into production until the DB/import path is explicitly checked.
3. Before importing, sample reported IDs through the API response and confirm no `page_snapshot`, `full_page`, or `fallback` assets are returned.
4. If build/typecheck hangs, record that as a verification blocker instead of claiming a pass.

## Verification Notes

- `git diff --check` passed after the current display/API changes.
- Python syntax check passed for:
  - `scripts/batch_yangming_visual_assets.py`
  - `scripts/filter_yangming_safe_snapshots.py`
  - `scripts/preview_yangming_explanations.py`
- `npm run lint` currently opens the interactive Next.js ESLint setup prompt because the project has no configured Next lint setup. Do not treat that as a code failure.
- Full `npm run build` and `npm run typecheck` have recently produced no useful output for several minutes in this workspace. `CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build` also stalled at `next build` with no progress. Treat this as a tooling/runtime verification blocker until investigated.
- `npm run build -- --no-lint` also stalled after 90 seconds with no output, so the current blocker is not only the Next lint prompt.
- A targeted `npx tsc` call against only the Yangming panel and API route also stalled after 30 seconds with no diagnostics. Use local diff checks plus runtime sampling until the TypeScript tooling hang is understood.
- Import dry run passed with:
  - `YANGMING_DRY_RUN=1`
  - `YANGMING_ASSET_ROOT=/private/tmp/ym_full_retrim_v9`
  - `YANGMING_ASSET_KIND_FILTER=image,table`
  - source `/private/tmp/ym_full_retrim_v9/yangming_visual_consolidated_rows_safe.json`
- Dry-run result: `6000` rows, `9839` unique local asset files, asset kinds `{"table":4472,"image":5664}`.
