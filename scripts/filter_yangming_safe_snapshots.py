#!/usr/bin/env python3
"""Build a screenshot-only Yangming import file with unsafe page clips removed.

The visual import intentionally favors "no explanation" over a wrong explanation.
It keeps only question_snapshot assets generated from explicit source_page_regions.
Cropping is based on Yangming explanation row/table boundaries, not on every
old exam question number that appears in the text. Some authors include related
past questions inside a "補充" section; those are part of the explanation and
must be preserved.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF


STRONG_QUESTION_WORDS = re.compile(
    r"(下列|何者|何項|何種|為何|哪些|關於|敘述|正確|錯誤|不適當|最|是否|何組|何處|何者為|何者不是)"
)
QUESTION_WORDS = re.compile(
    r"(下列|何者|何項|何種|為何|哪|哪些|關於|敘述|正確|錯誤|不適當|最|是否|容易|可以|應為|何組|何處|何者為|何者不是|可能|診斷|治療|受傷|感染|活性|產生|造成)"
)
OPTION_PATTERN = re.compile(r"(\([A-D]\)|（[A-D]）)")
QUESTION_LINE_PATTERN = re.compile(r"^\s*(?:題\s*號\s*)?0*(\d{1,3})(?:\s*[.．、]|[\s　]+)(.*)")
EXPLICIT_QUESTION_NO_PATTERN = re.compile(r"題\s*號\s*[:：]?\s*0*(\d{1,3})(?=\s|　|科|$)")


def normalize_pdf_text(text: str) -> str:
    """Normalize compatibility CJK glyphs from older PDF text extraction."""
    return unicodedata.normalize("NFKC", text or "")


def source_pdf(row: dict[str, Any], source_dir: Path) -> Path:
    source_name = str(row.get("source_file") or "").split(" :: ", 1)[0]
    return source_dir / source_name


def extract_clip_text(
    row: dict[str, Any],
    asset: dict[str, Any],
    source_dir: Path,
    pdf_cache: dict[Path, fitz.Document],
) -> str:
    pdf_path = source_pdf(row, source_dir)
    if not pdf_path.exists():
        return ""
    doc = pdf_cache.get(pdf_path)
    if doc is None:
        doc = fitz.open(pdf_path)
        pdf_cache[pdf_path] = doc
    try:
        page = doc[int(asset.get("page")) - 1]
        x0, y0, x1, y1 = [float(value) for value in asset.get("bbox")]
    except Exception:
        return ""
    rect = fitz.Rect(
        max(page.rect.x0, x0),
        max(page.rect.y0, y0),
        min(page.rect.x1, x1),
        min(page.rect.y1, y1),
    )
    if rect.is_empty:
        return ""
    return page.get_text("text", clip=rect) or ""


def slug_for_source(row: dict[str, Any]) -> str:
    source_name = str(row.get("source_file") or "unknown.pdf").split(" :: ", 1)[0]
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", Path(source_name).stem).strip("-") or "source"


def question_start_pattern(question_no: int) -> re.Pattern[str]:
    """Match old free-form question starts and newer table-style headers."""
    return re.compile(
        rf"(?:題\s*號\s*[:：]?\s*0*{question_no}(?=\s|　|科|$))|"
        rf"(?:(?:^|\n|\r)|[（(][^）)]{{1,12}}[）)]\s*)"
        rf"0*{question_no}\s*[.．、]?\s*"
        r"(?=(?:下列|有關|關於|何者|何項|何種|哪|一名|一位|某|左|右|孕婦|病人|男性|女性|"
        r"[\u4e00-\u9fff]{1,24}|[A-Za-z][A-Za-z\s(),-]{0,60}))"
    )


def find_question_start_top(page: fitz.Page, rect: fitz.Rect, question_no: int | None) -> float | None:
    if not question_no:
        return None

    pattern = question_start_pattern(question_no)
    question_words = re.compile(
        r"(下列|有關|關於|何者|何項|何種|為何|哪|哪些|敘述|正確|錯誤|不適當|最|是否|"
        r"容易|可以|應為|何組|何處|可能|診斷|治療|受傷|感染|活性|產生|造成)"
    )
    option_pattern = re.compile(r"(\([A-D]\)|（[A-D]）)")

    def looks_like_question_line(line_text: str, window_text: str) -> bool:
        normalized_line = normalize_pdf_text(line_text).strip()
        normalized_window = normalize_pdf_text(window_text)
        if pattern.search(normalized_line):
            return True
        match = re.search(rf"(?:^|[（(][^）)]{{1,12}}[）)]\s*)0*{question_no}\s*[.．、]?\s*(.+)", normalized_line)
        if not match:
            return False
        rest = match.group(1).strip()
        if not rest or rest.startswith(("答案", "出處", "參考", "補充", "詳解", "簡解", "KEY")):
            return False
        if question_words.search(normalized_window) or option_pattern.search(normalized_window):
            return True
        return len(re.sub(r"\s+", "", rest)) >= 12

    line_items: list[tuple[float, str]] = []
    try:
        page_dict = page.get_text("dict", clip=rect)
    except TypeError:
        page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            try:
                y0 = float(line.get("bbox", [0, 0, 0, 0])[1])
            except (TypeError, ValueError):
                continue
            if y0 < rect.y0 or y0 > rect.y1:
                continue
            text = "".join(str(span.get("text") or "") for span in line.get("spans", []))
            if text.strip():
                line_items.append((y0, text))

    hits: list[float] = []
    for index, (y0, text) in enumerate(line_items):
        window_text = " ".join(line for _y, line in line_items[index : index + 6])
        if looks_like_question_line(text, window_text):
            hits.append(y0)
    return min(hits) if hits else None


def page_line_items(page: fitz.Page, rect: fitz.Rect) -> list[tuple[float, float, str]]:
    """Return text lines inside a clip as (y0, y1, text)."""
    line_items: list[tuple[float, float, str]] = []
    try:
        page_dict = page.get_text("dict", clip=rect)
    except TypeError:
        page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            bbox = line.get("bbox", [0, 0, 0, 0])
            try:
                y0 = float(bbox[1])
                y1 = float(bbox[3])
            except (TypeError, ValueError):
                continue
            if y1 < rect.y0 or y0 > rect.y1:
                continue
            text = "".join(str(span.get("text") or "") for span in line.get("spans", []))
            if text.strip():
                line_items.append((y0, y1, text))
    return sorted(line_items, key=lambda item: (item[0], item[2]))


def find_yangming_row_header_top(
    page: fitz.Page,
    rect: fitz.Rect,
    question_no: int | None = None,
    *,
    after_y: float | None = None,
    exclude_question_no: int | None = None,
) -> float | None:
    """Find the top of a real Yangming explanation row header.

    A related exam question inside an author's explanation often looks like
    "醫學（一）109-2-34" or "34."; that is not a row boundary. A real Yangming
    row header has the table metadata cells, usually including 題號 / 科目 /
    撰寫 / 校稿 near the same y-window.
    """
    items = page_line_items(page, rect)
    hits: list[float] = []
    for index, (y0, _y1, text) in enumerate(items):
        if after_y is not None and y0 <= after_y:
            continue
        normalized_line = normalize_pdf_text(text)
        if "題號" not in normalized_line:
            continue
        window_items = items[index : index + 16]
        window_text = normalize_pdf_text(" ".join(item[2] for item in window_items))
        if not all(marker in window_text for marker in ("科目", "撰寫", "校稿")):
            continue
        numbers = [int(value) for value in re.findall(r"(?<!\d)0*(\d{1,3})(?!\d)", window_text) if 1 <= int(value) <= 120]
        if question_no is not None and question_no not in numbers:
            continue
        if exclude_question_no is not None and exclude_question_no in numbers:
            continue
        hits.append(y0)
    return min(hits) if hits else None


def trim_region_to_question(row: dict[str, Any], page: fitz.Page, rect: fitz.Rect) -> fitz.Rect:
    question_no = row_question_no(row)
    if not question_no:
        return rect

    row_header_top = find_yangming_row_header_top(page, rect, question_no)
    question_top = find_question_start_top(page, rect, question_no)
    current_top = row_header_top or question_top
    if current_top is not None and current_top > rect.y0 + 12:
        if row_header_top is not None:
            rect = fitz.Rect(rect.x0, max(rect.y0, row_header_top - 3), rect.x1, rect.y1)
        else:
            prefix_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, max(rect.y0, current_top - 1))
            try:
                prefix_text = normalize_pdf_text(page.get_text("text", clip=prefix_rect) or "")
            except TypeError:
                prefix_text = ""
            compact_prefix = re.sub(r"\s+", "", prefix_text)
            has_yangming_header = all(marker in prefix_text for marker in ("題號", "科目")) and (
                "撰寫" in prefix_text or "校稿" in prefix_text
            )
            if not has_yangming_header and (len(compact_prefix) >= 24 or "國立陽明" in prefix_text):
                rect = fitz.Rect(rect.x0, max(rect.y0, current_top - 3), rect.x1, rect.y1)

    # Do not cut merely because the author included another old exam question
    # in 補充/詳解. Only a new Yangming metadata header means we have left this
    # explanation row.
    next_top = find_yangming_row_header_top(
        page,
        rect,
        after_y=rect.y0 + 12,
        exclude_question_no=question_no,
    )
    if next_top is not None and next_top > rect.y0 + 12:
        rect = fitz.Rect(rect.x0, rect.y0, rect.x1, max(rect.y0, next_top - 3))

    return rect


def render_region_snapshot_assets(
    row: dict[str, Any],
    asset_root: Path,
    source_dir: Path,
    pdf_cache: dict[Path, fitz.Document],
) -> list[dict[str, Any]]:
    regions = row.get("source_page_regions")
    if not isinstance(regions, list) or not regions:
        return []
    pdf_path = source_pdf(row, source_dir)
    if not pdf_path.exists():
        return []
    doc = pdf_cache.get(pdf_path)
    if doc is None:
        doc = fitz.open(pdf_path)
        pdf_cache[pdf_path] = doc

    question_id = str(row.get("question_id") or "unknown-question")
    question_no = row_question_no(row) or row.get("question_no") or "unknown"
    source_slug = slug_for_source(row)
    assets: list[dict[str, Any]] = []
    # Keep generated source-region screenshots under per_file/ so the API's
    # existing stale-snapshot guard can distinguish them from old bad imports.
    output_dir = asset_root / "per_file" / source_slug / "source-page-regions"
    output_dir.mkdir(parents=True, exist_ok=True)

    for region_index, region in enumerate(regions):
        if not isinstance(region, dict):
            continue
        try:
            page_no = int(region.get("page"))
            page = doc[page_no - 1]
            x0, y0, x1, y1 = [float(value) for value in region.get("bbox")]
        except Exception:
            continue
        rect = fitz.Rect(
            max(page.rect.x0, x0),
            max(page.rect.y0, y0),
            min(page.rect.x1, x1),
            min(page.rect.y1, y1),
        )
        # Source page regions are sometimes anchored at the question stem, which
        # cuts off the Yangming metadata row (題號/科目/撰寫/校稿). Expand upward a
        # little before trimming so row-aware cropping can keep the whole block.
        if rect.y0 > page.rect.y0:
            rect = fitz.Rect(rect.x0, max(page.rect.y0, rect.y0 - 90), rect.x1, rect.y1)
        rect = trim_region_to_question(row, page, rect)
        if rect.is_empty:
            continue
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
        filename = f"{question_id}-q{question_no}-p{page_no:04d}-r{region_index:02d}.png"
        output_path = output_dir / filename
        if output_path.exists():
            output_path.unlink()
        pixmap.save(output_path)
        assets.append(
            {
                "src": str(output_path.relative_to(asset_root)),
                "alt": f"{row.get('source_label') or ''} 第 {question_no} 題裁切截圖".strip(),
                "width": pixmap.width,
                "height": pixmap.height,
                "page": page_no,
                "bbox": [rect.x0, rect.y0, rect.x1, rect.y1],
                "kind": "question_snapshot",
                "snapshotSource": "source_page_regions",
                "fallback": False,
            }
        )
    return assets


def candidate_question_numbers(text: str) -> list[dict[str, Any]]:
    text = normalize_pdf_text(text)
    lines = [line.strip() for line in text.splitlines()]
    candidates: list[dict[str, Any]] = []
    cursor = 0
    for line_index, line in enumerate(lines):
        position = text.find(line, cursor) if line else cursor
        if position < 0:
            position = cursor
        cursor = position + len(line)
        if not line:
            continue
        match = QUESTION_LINE_PATTERN.match(line)
        if not match:
            continue
        question_no = int(match.group(1))
        rest = match.group(2).strip()
        if question_no < 1 or question_no > 120:
            continue
        if len(rest) < 10 and rest.endswith(("：", ":")):
            continue

        window = " ".join(lines[line_index : line_index + 6])[:1000]
        if question_no <= 9:
            looks_like_question = bool(
                STRONG_QUESTION_WORDS.search(line) or "？" in line or "?" in line
            )
        else:
            looks_like_question = bool(OPTION_PATTERN.search(window) or QUESTION_WORDS.search(window))
            if (
                not looks_like_question
                and len(rest) >= 24
                and any(mark in rest for mark in "，,。?？（）()")
            ):
                looks_like_question = True

        if looks_like_question:
            candidates.append(
                {
                    "n": question_no,
                    "line": line[:160],
                    "line_index": line_index,
                    "char_index": position,
                }
            )
    return candidates


def prefix_stats(text: str, char_index: int) -> tuple[int, int, list[str]]:
    cleaned_lines: list[str] = []
    for raw_line in text[: max(0, char_index)].splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"\d{1,3}", line):
            continue
        cleaned_lines.append(line)
    compact = re.sub(r"\s+", "", "\n".join(cleaned_lines))
    return len(cleaned_lines), len(compact), cleaned_lines[-3:]


def row_question_no(row: dict[str, Any]) -> int | None:
    raw_value = row.get("matched_question_no") or row.get("extracted_question_no") or row.get("question_no")
    try:
        return int(raw_value)
    except Exception:
        return None


def row_extracted_question_no(row: dict[str, Any]) -> int | None:
    try:
        return int(row.get("extracted_question_no"))
    except Exception:
        return None


def row_matched_question_no(row: dict[str, Any]) -> int | None:
    try:
        return int(row.get("matched_question_no") or row.get("question_no"))
    except Exception:
        return None


def explicit_question_numbers(text: str) -> list[dict[str, Any]]:
    """Find table-style headers such as "題號 59 科目 ...".

    These headers are stronger evidence than fuzzy question text matching. If a
    clip explicitly says it is another question, we should reject it even if the
    surrounding stem looked similar.
    """
    text = normalize_pdf_text(text)
    candidates: list[dict[str, Any]] = []
    for match in EXPLICIT_QUESTION_NO_PATTERN.finditer(text):
        question_no = int(match.group(1))
        if question_no < 1 or question_no > 100:
            continue
        line_start = text.rfind("\n", 0, match.start()) + 1
        line_end = text.find("\n", match.end())
        if line_end < 0:
            line_end = min(len(text), match.end() + 140)
        candidates.append(
            {
                "n": question_no,
                "line": text[line_start:line_end].strip()[:160],
                "char_index": match.start(),
            }
        )
    return candidates


def is_safe_snapshot(
    row: dict[str, Any],
    asset: dict[str, Any],
    asset_root: Path,
    source_dir: Path,
    pdf_cache: dict[Path, fitz.Document],
) -> tuple[bool, str, list[dict[str, Any]], str]:
    question_no = row_question_no(row)
    asset_kind = str(asset.get("kind") or "")
    if asset_kind in {"page_snapshot", "full_page"} or asset.get("fallback"):
        return False, "fallback_full_page", [], ""
    if asset_kind not in {"question_snapshot", "image", "table"}:
        return False, "unsupported_asset_kind", [], ""
    if asset_kind == "question_snapshot" and asset.get("snapshotSource") not in {"source_page_regions", "bounded_page_headers", None, ""}:
        return False, "fallback_full_page", [], ""
    src = asset.get("src")
    if not isinstance(src, str) or not src:
        return False, "missing_src", [], ""
    if not (asset_root / src).exists():
        return False, "missing_file", [], ""

    text = extract_clip_text(row, asset, source_dir, pdf_cache)
    explicit_candidates = explicit_question_numbers(text)
    wrong_explicit_candidates = [
        candidate for candidate in explicit_candidates if question_no and candidate["n"] != question_no
    ]
    if wrong_explicit_candidates:
        return False, "wrong_question_number_in_snapshot", wrong_explicit_candidates[:3], text

    candidates = candidate_question_numbers(text)
    current_candidates = [candidate for candidate in candidates if question_no and candidate["n"] == question_no]
    first_current_index = current_candidates[0]["char_index"] if current_candidates else None
    # Related old exam questions inside an author's 補充 section are valid
    # explanation content. Only reject if the clip visibly reaches another
    # Yangming metadata row header, not merely because a different question
    # number appears in the prose.
    if asset_kind == "question_snapshot":
        pdf_path = source_pdf(row, source_dir)
        try:
            doc = pdf_cache.get(pdf_path)
            if doc is None and pdf_path.exists():
                doc = fitz.open(pdf_path)
                pdf_cache[pdf_path] = doc
            if doc is not None:
                page = doc[int(asset.get("page")) - 1]
                x0, y0, x1, y1 = [float(value) for value in asset.get("bbox")]
                clip_rect = fitz.Rect(
                    max(page.rect.x0, x0),
                    max(page.rect.y0, y0),
                    min(page.rect.x1, x1),
                    min(page.rect.y1, y1),
                )
                next_row_top = find_yangming_row_header_top(
                    page,
                    clip_rect,
                    after_y=clip_rect.y0 + 12,
                    exclude_question_no=question_no,
                )
                if next_row_top is not None:
                    return (
                        False,
                        "next_yangming_row_header",
                        [{"n": "other", "line": "題號/科目/撰寫/校稿", "y": next_row_top}],
                        text,
                    )
        except Exception:
            pass

    if current_candidates:
        lines_before, chars_before, prefix_tail = prefix_stats(text, current_candidates[0]["char_index"])
        # Old PDFs often put the previous explanation's final words and the
        # next question header on the same line. A short prefix is less harmful
        # than dropping the whole explanation; still reject large prefixes that
        # look like a real previous-question block or cover spillover.
        if chars_before >= 180 and lines_before >= 3:
            return (
                False,
                "current_question_starts_late",
                [
                    {
                        **current_candidates[0],
                        "lines_before": lines_before,
                        "chars_before": chars_before,
                        "prefix_tail": prefix_tail,
                    }
                ],
                text,
            )
    else:
        previous_question_candidates = [
            candidate
            for candidate in candidates
            if question_no
            and candidate["n"] == question_no - 1
            and candidate.get("line_index", 999) <= 3
        ]
        if previous_question_candidates:
            return False, "previous_question_start_without_current", previous_question_candidates[:3], text

    return True, "kept", candidates[:3], text


def compact_excerpt(text: str, limit: int = 220) -> str:
    return re.sub(r"\s+", " ", text).strip()[:limit]


def build_audit_entry(
    row: dict[str, Any],
    asset: dict[str, Any],
    asset_index: int,
    is_safe: bool,
    reason: str,
    detail: list[dict[str, Any]],
    text: str,
) -> dict[str, Any]:
    question_no = row_question_no(row)
    candidate_numbers = [candidate.get("n") for candidate in detail if isinstance(candidate, dict)]
    return {
        "question_id": row.get("question_id"),
        "question_no": question_no,
        "source_file": str(row.get("source_file") or ""),
        "source_label": str(row.get("source_label") or ""),
        "asset_index": asset_index,
        "src": asset.get("src"),
        "page": asset.get("page"),
        "bbox": asset.get("bbox"),
        "kept": is_safe,
        "reason": reason,
        "candidate_question_numbers": candidate_numbers,
        "detail": detail,
        "excerpt": compact_excerpt(text),
    }


def build_safe_rows(
    rows: list[dict[str, Any]],
    asset_root: Path,
    source_dir: Path,
    render_missing_snapshots: bool = False,
    prefer_region_snapshots: bool = False,
) -> tuple[list[dict[str, Any]], Counter[str], list[dict[str, Any]]]:
    pdf_cache: dict[Path, fitz.Document] = {}
    reasons: Counter[str] = Counter()
    audit_rows: list[dict[str, Any]] = []
    safe_rows: list[dict[str, Any]] = []
    try:
        for row in rows:
            next_row = copy.deepcopy(row)
            extracted_no = row_extracted_question_no(row)
            matched_no = row_matched_question_no(row)
            if extracted_no and matched_no and extracted_no != matched_no:
                reasons["question_number_mismatch"] += 1
                next_row["assets"] = []
                next_row["sections"] = []
                next_row["body"] = ""
                next_row["match_status"] = "question_number_mismatch"
                next_row["match_score"] = 0
                next_row["safety_rejection"] = {
                    "reason": "question_number_mismatch",
                    "extracted_question_no": extracted_no,
                    "matched_question_no": matched_no,
                }
                audit_rows.append(
                    {
                        "question_id": row.get("question_id"),
                        "question_no": matched_no,
                        "source_file": str(row.get("source_file") or ""),
                        "source_label": str(row.get("source_label") or ""),
                        "asset_index": "",
                        "src": "",
                        "page": "",
                        "bbox": "",
                        "kept": False,
                        "reason": "question_number_mismatch",
                        "candidate_question_numbers": [extracted_no],
                        "detail": [next_row["safety_rejection"]],
                        "excerpt": "",
                    }
                )
                safe_rows.append(next_row)
                continue

            candidate_assets = [
                asset
                for asset in (row.get("assets") or [])
                if isinstance(asset, dict) and asset.get("kind") in {"question_snapshot", "image", "table"}
            ]
            generated_assets: list[dict[str, Any]] = []
            if prefer_region_snapshots or (not candidate_assets and render_missing_snapshots):
                generated_assets = render_region_snapshot_assets(row, asset_root, source_dir, pdf_cache)
                if generated_assets:
                    reasons["generated_region_snapshot"] += len(generated_assets)
            if prefer_region_snapshots and generated_assets:
                candidate_assets = generated_assets
            elif not candidate_assets and generated_assets:
                candidate_assets = generated_assets

            kept_assets: list[dict[str, Any]] = []
            for asset_index, asset in enumerate(candidate_assets):
                if not isinstance(asset, dict):
                    reasons["invalid_asset"] += 1
                    audit_rows.append({
                        "question_id": row.get("question_id"),
                        "question_no": row_question_no(row),
                        "source_file": str(row.get("source_file") or ""),
                        "asset_index": asset_index,
                        "kept": False,
                        "reason": "invalid_asset",
                    })
                    continue
                is_safe, reason, detail, text = is_safe_snapshot(row, asset, asset_root, source_dir, pdf_cache)
                reasons[reason] += 1
                audit_rows.append(build_audit_entry(row, asset, asset_index, is_safe, reason, detail, text))
                if is_safe:
                    kept_assets.append(asset)

            next_row["assets"] = []
            next_row["sections"] = []
            next_row["body"] = ""
            for index, asset in enumerate(kept_assets):
                clean_asset = {key: value for key, value in asset.items() if key != "rows"}
                clean_asset["fallback"] = False
                if clean_asset.get("kind") == "question_snapshot":
                    clean_asset["snapshotSource"] = clean_asset.get("snapshotSource") or "source_page_regions"
                next_row["assets"].append(clean_asset)
                label = "原始版面裁切"
                if clean_asset.get("kind") == "table":
                    label = "原始表格截圖"
                elif clean_asset.get("kind") == "image":
                    label = "原始圖片"
                next_row["sections"].append(
                    {
                        "kind": "image",
                        "label": label,
                        "assetIndex": index,
                        "page": clean_asset.get("page"),
                        "fallback": False,
                    }
                )
            safe_rows.append(next_row)
    finally:
        for doc in pdf_cache.values():
            doc.close()
    return safe_rows, reasons, audit_rows


def write_audit_csv(path: Path, audit_rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "question_id",
        "question_no",
        "source_file",
        "source_label",
        "asset_index",
        "page",
        "kept",
        "reason",
        "candidate_question_numbers",
        "src",
        "excerpt",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in audit_rows:
            writer.writerow({
                **{field: row.get(field, "") for field in fields},
                "candidate_question_numbers": " ".join(str(value) for value in row.get("candidate_question_numbers") or []),
            })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_json", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--asset-root", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--audit-json", type=Path)
    parser.add_argument("--audit-csv", type=Path)
    parser.add_argument(
        "--render-missing-region-snapshots",
        action="store_true",
        help="Generate source-page-region snapshots for rows without existing visual assets. Disabled by default for full-batch safety audits.",
    )
    parser.add_argument(
        "--prefer-region-snapshots",
        action="store_true",
        help="Regenerate and prefer full source-page-region screenshots for every row. This is the screenshot-first production mode.",
    )
    args = parser.parse_args()

    rows = json.loads(args.input_json.read_text(encoding="utf-8"))
    safe_rows, reasons, audit_rows = build_safe_rows(
        rows,
        args.asset_root,
        args.source_dir,
        render_missing_snapshots=args.render_missing_region_snapshots,
        prefer_region_snapshots=args.prefer_region_snapshots,
    )
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(safe_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.audit_json:
        args.audit_json.parent.mkdir(parents=True, exist_ok=True)
        args.audit_json.write_text(json.dumps(audit_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.audit_csv:
        write_audit_csv(args.audit_csv, audit_rows)

    print(
        json.dumps(
            {
                "rows": len(safe_rows),
                "rows_with_assets": sum(1 for row in safe_rows if row.get("assets")),
                "assets": sum(len(row.get("assets") or []) for row in safe_rows),
                "reasons": dict(reasons),
                "output": str(args.output_json),
                "audit_json": str(args.audit_json) if args.audit_json else None,
                "audit_csv": str(args.audit_csv) if args.audit_csv else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
