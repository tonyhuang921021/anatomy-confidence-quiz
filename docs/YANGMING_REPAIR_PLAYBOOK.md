# Yangming Explanation Repair Playbook

This file is the shared checklist for automated and manual Yangming explanation repair. Read it before changing Yangming explanation rows, assets, report statuses, or Storage objects.

## Core Principle

Prefer correct screenshots and original Yangming page crops over generated text. If the original explanation cannot be verified, do not invent certainty. Leave the item for manual review or add a clearly marked temporary text fallback only when it prevents the user from seeing an empty explanation.

## First Triage

Classify the failure layer before making changes:

- DB row missing: no `yangming_question_explanations` or versioned row exists for the question.
- Assets empty: row exists but `assets` is empty or malformed.
- API filters asset: DB has assets, but `/api/yangming-explanation` removes them because the crop appears to contain another question number or bad content.
- Storage object missing: DB points to an object that no longer exists or cannot be read.
- Frontend render failure: API data is valid, but the UI hides, clips, or rejects it.
- Report status issue: the question has been corrected by a user or older backend run but the report status is misleading.

Do not jump straight to regenerating or overwriting text.

## Evidence Checks Per Question

Before marking a report fixed, inspect:

- The current row in `yangming_question_explanations` and, if active, `yangming_question_explanations_versioned`.
- The `body`, `assets`, source page metadata, and any `updated_by` / correction metadata.
- The referenced Storage objects in `yangming-explanations`.
- Existing reports for the same `question_id`, including repeated reports and user corrections.
- The actual question stem, option text, answer, and relevant keywords in the local question bank.

Use `/api/yangming-explanation` after changes to verify what the frontend will actually receive.

## Report Type Rules

For "圖片被切掉", "少下一頁", "表格被截斷":

- Prefer adding the missing crop or next-page asset.
- Preserve existing useful image assets.
- Do not replace a good screenshot-only explanation with OCR text just because text is easier to generate.

For "詳解對錯題", "貼錯題", "圖片不對":

- Compare question number, stem keywords, options, answer, and visible text inside the image.
- A crop that includes a nearby question header is suspicious but not automatically wrong.
- A crop that only contains a related question number is not enough evidence to use it.
- If the API filtered a correct asset due to detected question numbers, fix the asset/crop metadata or boundary problem rather than deleting useful data blindly.

For user correction reports:

- Do not label user-provided corrections as backend-fixed or official.
- Keep the status clear: user correction, backend verified, or needs backend review.
- Only set backend-fixed/applied metadata after independently verifying the corrected content.

## Cropping Rules

- Determine crop boundaries from real Yangming table row headers, such as the row containing metadata like question number, subject, writer, or reviewer.
- Do not treat question numbers inside the explanation body, prompt, related-question notes, or author comments as row boundaries.
- If an explanation spans multiple pages, keep multiple assets in order.
- Do not keep only the first visually clean page if the next page contains the rest of the explanation.
- Avoid crops that include only a previous or next question header without the target explanation.

## Self-Cropping Workflow

Do not conclude "no Yangming explanation" after checking only current DB rows,
active-version assets, or `per_file/` paths. If the report points to a known
Yangming source file, regenerate the crop from the local source PDF first.

Default local source directory:

```bash
/Users/huangguanlun/Downloads/陽明詳解
```

For single-question repairs:

1. Locate the source PDF from the report's `source_file`, local question ID, or
   nearby active/legacy rows. Common merged sources include
   `醫師國考詳解101-104(書籤版).pdf` and `醫師國考詳解096-100(書籤版).pdf`.
2. Search the PDF visually/textually by stable stem keywords, not only by TOC.
   Some PDF bookmarks have invalid page numbers such as `-1`.
3. On the located page, choose the Yangming table whose extracted text contains
   the target stem keyword and target 題號. When a page has multiple tables,
   never crop the whole page by default.
4. Render the detected table bbox to PNG at 2x scale, then visually inspect the
   result before upload.
5. Upload manual crops under the active version prefix, for example:
   `versions/<activeVersion>/manual/user-provided/YYYYMMDD/<questionId>-yangming.png`.
   Do not use a bare `manual/...` path: the API filters `question_snapshot`
   assets unless the path is under a trusted `per_file/` or `versions/` prefix.
6. Upsert the active `yangming_question_explanations_versioned` row with:
   `body=''`, `kind='question_snapshot'`, one image section per asset, and a
   `match_status` that states the source, such as
   `manual_pdf_crop_YYYYMMDD` or `manual_user_provided_screenshot_YYYYMMDD`.
7. Only mark the report applied after `/api/yangming-explanation` returns the
   expected asset for the exact `questionId`.

Minimal PyMuPDF proof-of-work pattern:

```python
from pathlib import Path
import fitz

pdf = Path("/Users/huangguanlun/Downloads/陽明詳解/醫師國考詳解101-104(書籤版).pdf")
doc = fitz.open(pdf)
target = {"question_id": "MOEX-101110-2101-Q046", "page": 202, "keyword": "puromycin"}
page = doc[target["page"] - 1]

for table in page.find_tables().tables:
    text = " ".join(str(cell) for row in table.extract() for cell in row if cell)
    if target["keyword"] in text and "題號" in text:
        rect = fitz.Rect(*table.bbox)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
        pix.save(f"/private/tmp/{target['question_id']}-yangming.png")
        break
```

After upload, API validation is mandatory. A DB row with `assets.length > 0`
is not enough; the route can still filter the asset.

## Text Fallback Rules

Use text fallback only when:

- No trustworthy image source is available.
- The current frontend would otherwise show no usable explanation.
- The fallback is clearly based on available Yangming text or verified source context.

When adding text fallback:

- Keep or mark existing image assets instead of deleting them.
- Mark that images are still pending if needed.
- Avoid "修正版內容太短" failures by keeping a meaningful explanation body.

## Verification Before Marking Fixed

A Yangming report is fixed only when all relevant checks pass:

- The DB row has usable `body` or `assets`.
- All referenced Storage URLs are readable.
- `/api/yangming-explanation` returns the expected content for the exact `questionId`.
- The frontend can render the explanation without hiding it or showing a short-content error.
- The report status accurately describes the source of the fix.

If any point is uncertain, do not set `applied_at` or mark as backend-fixed. Put the question in manual review with a short reason.

## Daily Summary Requirements

When an automated run finishes, summarize:

- Count of reports inspected.
- Count fixed and verified.
- Count left for manual review.
- Question IDs fixed.
- Question IDs still pending.
- Failure type learned for each pending or fixed case: truncated crop, wrong question, API filter, missing Storage object, missing DB row, frontend render bug, or source data missing.
- Build/test result.
- Commit hash and whether `main` was pushed.

The goal is not only to repair today's reports, but also to avoid repeating the same bad repair pattern tomorrow.
