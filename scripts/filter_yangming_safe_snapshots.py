#!/usr/bin/env python3
"""Build a screenshot-only Yangming import file with unsafe page clips removed.

The visual import intentionally favors "no explanation" over a wrong explanation.
It keeps only question_snapshot assets generated from explicit source_page_regions,
then rejects clips that appear to start with another question or contain a large
amount of previous-question text before the current question starts.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
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
    output_dir = asset_root / "assets" / "source-page-regions" / source_slug
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
        if rect.is_empty:
            continue
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
        filename = f"{question_id}-q{question_no}-p{page_no:04d}-r{region_index:02d}.png"
        output_path = output_dir / filename
        if not output_path.exists():
            pixmap.save(output_path)
        assets.append(
            {
                "src": str(output_path.relative_to(asset_root)),
                "alt": f"{row.get('source_label') or ''} 第 {question_no} 題原頁截圖".strip(),
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
    if asset.get("kind") != "question_snapshot":
        return False, "not_snapshot", [], ""
    if asset.get("snapshotSource") != "source_page_regions":
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
    # A true cross-question contamination almost always shows up as Q(n+1)
    # after the current question. Do not reject unrelated numbered lists inside
    # explanations (for example "1. Carpal tunnel..." in question 8).
    next_question_candidates = [
        candidate
        for candidate in candidates
        if question_no
        and candidate["n"] == question_no + 1
    ]
    if next_question_candidates:
        return False, "next_question_start", next_question_candidates[:3], text

    if current_candidates:
        lines_before, chars_before, prefix_tail = prefix_stats(text, current_candidates[0]["char_index"])
        if chars_before >= 35 and lines_before >= 1:
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
                if isinstance(asset, dict) and asset.get("kind") == "question_snapshot"
            ]
            if not candidate_assets:
                candidate_assets = render_region_snapshot_assets(row, asset_root, source_dir, pdf_cache)
                if candidate_assets:
                    reasons["generated_region_snapshot"] += len(candidate_assets)

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
                clean_asset["kind"] = "question_snapshot"
                clean_asset["fallback"] = False
                clean_asset["snapshotSource"] = "source_page_regions"
                next_row["assets"].append(clean_asset)
                next_row["sections"].append(
                    {
                        "kind": "image",
                        "label": "完整原頁截圖",
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
    args = parser.parse_args()

    rows = json.loads(args.input_json.read_text(encoding="utf-8"))
    safe_rows, reasons, audit_rows = build_safe_rows(rows, args.asset_root, args.source_dir)
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
