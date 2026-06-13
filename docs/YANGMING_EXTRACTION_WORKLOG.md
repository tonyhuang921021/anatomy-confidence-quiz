# Yangming Explanation Extraction Worklog

This file is the handoff note for the Yangming explanation pipeline. Read this before changing the importer again.

## Current Direction

- Prefer cropped original-layout screenshots of each Yangming explanation row/block over OCR text. OCR/body text can collapse line breaks, miss options, split sections, or lose paragraphs.
- The crop boundary is the Yangming explanation row/table boundary, not every old exam question number in the content. If an author puts related past questions inside `詳解` or `補充`, those related questions are part of the explanation and must be kept.
- Do not import full-page screenshots as the final target unless a block truly fills the page. The user-facing goal is "依題裁切截圖": preserve the original layout while excluding unrelated previous/next Yangming rows, covers, and stale fragments.
- Production-safe assets are now `question_snapshot` only.
- Do not import or serve legacy `image` or `table` assets as final explanation content. They caused partial tables, missing beginning paragraphs, and neighboring-question fragments to appear online.
- Do not serve or import old `page_snapshot`, `full_page`, or `fallback` assets as final explanation content. Those caused cover pages, neighboring questions, and broken full-page screenshots to appear online.
- If a production page shows a cover, blank image, or next-question leakage while the local safe batch looks correct, treat it as stale imported data or stale asset paths first, not as proof that v9 local extraction failed.

## Latest Local Batch

- Latest imported row-boundary batch directory: `/private/tmp/ym_boundary_full_v13`
- Source render directory: `/private/tmp/ym_full_region_patch_v13`
- Important command choices:
  - `--page-snapshot-mode none`
  - `--prefer-region-snapshots`
  - screenshot-only import with `YANGMING_ASSET_KIND_FILTER=question_snapshot`
- Local v13 data is screenshot-only:
  - `6000` rows
  - `5524` rows with at least one cropped screenshot
  - `9992` retained `question_snapshot` assets
  - `0` non-empty OCR bodies
  - `0` legacy `image` / `table` assets
- Coverage audit after v13 filtering:
  - `5441 / 6000` target questions have safe snapshots
  - `88` missing rows
  - `410` rows empty after safety filtering
  - largest remaining gaps: `112100-2301`, `101110-2101`, `102030-2101`, `101110-1101`, `102030-1101`
- `MOEX-112100-1301-Q034` sample behavior is the current intended rule:
  - keep pages 63-66 because they are one Yangming explanation block and include author-written related past questions in `補充`;
  - drop page 67 because it starts the next true Yangming row (`題號/科目/撰寫/校稿` for Q35).
- Production import completed for v13:
  - uploaded `9030 / 9030` missing asset files
  - upserted `6000 / 6000` explanation rows
  - verified production API returns `bodyLen 0` and only `question_snapshot` assets for `MOEX-112100-1301-Q034`, `MOEX-110101-1301-Q020`, `MOEX-112100-1301-Q036`, and `MOEX-110101-1301-Q070`.
- Known checked examples with local safe assets:
  - `MOEX-110101-1301-Q020`
  - `MOEX-112100-1301-Q034`
  - `MOEX-112100-1301-Q036`
  - `MOEX-110101-1301-Q070`

## Known Data Caveat

- `112-2醫學二.pdf` appears mixed/incomplete locally. It contains a page range for 112-2 medical two, then later pages switch metadata. Do not force-complete that paper from the wrong metadata. Ask for the correct complete PDF if full coverage is needed.

## Frontend/API Rules

- The frontend should render `question_snapshot` as the authoritative original-layout content and suppress OCR/body/legacy sections when snapshots exist.
- The API should reject old `image`, `table`, fallback, and full-page assets even if they remain in Supabase from older imports.
- Treat legacy asset metadata defensively: `kind` should be normalized to lowercase, and both boolean `fallback: true` and string `fallback: "true"` must be rejected.
- Production may still contain old `question_snapshot` rows under `assets/...snapshot...`; these can be blank, cover pages, or neighboring-question crops. Only allow `question_snapshot` if it comes from the newer safe batch path prefix `per_file/`.
- User-visible explanation locations should be consistent: quiz, results, wrong review, question search, and note-side linked questions.

## Screenshot-Only Import Command

Use this shape for production overwrite imports only after the crop batch is visually sampled. The single `question_snapshot` filter intentionally clears OCR body text, question/answer snapshots, and legacy sections in the DB row.

```bash
YANGMING_ASSET_ROOT=/private/tmp/<verified-cropped-batch> \
YANGMING_ASSET_KIND_FILTER=question_snapshot \
YANGMING_SCREENSHOT_ONLY=1 \
YANGMING_ASSET_CONCURRENCY=1 \
node scripts/import_yangming_explanations.js /private/tmp/<verified-cropped-batch>/yangming_visual_consolidated_rows_snapshot_first.json
```

## Next Safe Steps

1. Verify code-only changes with `git diff --check` and targeted script syntax checks.
2. Continue gap-filling against v13 coverage. Do not revert to OCR/table extraction to chase missing rows.
3. Before importing any future batch, sample reported IDs through the API response and confirm no `page_snapshot`, `full_page`, `table`, `image`, or `fallback` assets are returned.
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
- v13 screenshot-only import dry run passed with:
  - `YANGMING_DRY_RUN=1`
  - `YANGMING_ASSET_ROOT=/private/tmp/ym_boundary_full_v13`
  - `YANGMING_ASSET_KIND_FILTER=question_snapshot`
  - `YANGMING_SCREENSHOT_ONLY=1`
  - source `/private/tmp/ym_boundary_full_v13/yangming_visual_consolidated_rows_snapshot_first.json`
- Dry-run result: `6000` rows, `9992` unique local asset files, asset kinds `{"question_snapshot":9992}`.
- Production import result: `9030` uploaded assets, `6000` upserted rows.
