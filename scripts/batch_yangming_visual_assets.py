#!/usr/bin/env python3
"""Batch visual extraction for Yangming explanation PDFs.

Runs preview_yangming_explanations.py one PDF at a time with visual assets
enabled, then combines the per-file rows into a global visual report.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_SCRIPT = ROOT / "scripts" / "preview_yangming_explanations.py"
DEFAULT_SOURCE_DIR = Path("/Users/huangguanlun/Downloads/陽明詳解")
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "yangming_import_preview" / "visual_full"
DEFAULT_BASE_ROWS = ROOT / "reports" / "yangming_import_preview" / "yangming_consolidated_rows.json"


def load_preview_module():
    spec = importlib.util.spec_from_file_location("yangming_preview", PREVIEW_SCRIPT)
    if not spec or not spec.loader:
        raise RuntimeError("Unable to load preview_yangming_explanations.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def count_assets(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "rows": len(rows),
        "rows_with_assets": 0,
        "assets": 0,
        "image_assets": 0,
        "table_assets": 0,
        "empty_asset_src": 0,
    }
    for row in rows:
        assets = row.get("assets") if isinstance(row.get("assets"), list) else []
        if assets:
            counts["rows_with_assets"] += 1
        counts["assets"] += len(assets)
        for asset in assets:
            if not isinstance(asset, dict):
                continue
            if not asset.get("src"):
                counts["empty_asset_src"] += 1
            if asset.get("kind") == "table":
                counts["table_assets"] += 1
            else:
                counts["image_assets"] += 1
    return counts


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def prefix_asset_paths(rows: list[dict[str, Any]], prefix: str) -> None:
    for row in rows:
        assets = row.get("assets")
        if not isinstance(assets, list):
            continue
        for asset in assets:
            if not isinstance(asset, dict):
                continue
            src = asset.get("src")
            if isinstance(src, str) and src and not src.startswith(prefix):
                asset["src"] = f"{prefix}{src}"


def load_json_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Expected a JSON array at {path}")
    return [row for row in payload if isinstance(row, dict)]


def merge_base_rows(
    consolidated_rows: list[dict[str, Any]],
    base_rows: list[dict[str, Any]],
    allowed_source_files: set[str] | None = None,
) -> int:
    """Recover questions found by text/stem parsing but missed by visual parsing.

    The website should never lose a Yangming explanation just because the
    visual/table extractor failed to identify a row. These recovered rows still
    get original page snapshots attached later, and the row keeps an audit flag
    so we know the text was only used as a locator.
    """
    existing_ids = {
        str(row.get("question_id") or "")
        for row in consolidated_rows
        if row.get("question_id")
    }
    added = 0
    for base_row in base_rows:
        source_file = str(base_row.get("source_file") or "").split(" :: ", 1)[0]
        if allowed_source_files is not None and source_file not in allowed_source_files:
            continue
        question_id = str(base_row.get("question_id") or "")
        if not question_id or question_id in existing_ids:
            continue
        recovered = dict(base_row)
        recovered["assets"] = []
        recovered["sections"] = [
            section
            for section in recovered.get("sections", [])
            if isinstance(section, dict) and section.get("kind") != "image"
        ]
        recovered["match_strategy"] = f"snapshot_text_locator:{recovered.get('match_strategy') or 'unknown'}"
        recovered["visual_fallback"] = True
        recovered["snapshot_audit"] = {
            "locator": "base_text_consolidated_rows",
            "reason": "visual_extractor_missed_question",
            "source_file": recovered.get("source_file"),
            "source_page_start": recovered.get("source_page_start"),
            "source_page_end": recovered.get("source_page_end"),
            "matched_question_no": recovered.get("matched_question_no"),
        }
        consolidated_rows.append(recovered)
        existing_ids.add(question_id)
        added += 1

    consolidated_rows.sort(
        key=lambda row: (
            str(row.get("exam_code") or ""),
            str(row.get("paper_code") or ""),
            int(row.get("matched_question_no") or row.get("extracted_question_no") or 0),
        )
    )
    return added


def build_reports_for_rows(
    rows: list[dict[str, Any]],
    source_metas: dict[tuple[str, str], Any],
    paper_questions: dict[tuple[str, str], list[Any]],
) -> list[dict[str, Any]]:
    by_question_id = {
        str(row.get("question_id") or ""): row
        for row in rows
        if row.get("question_id")
    }
    reports: list[dict[str, Any]] = []
    for key, meta in sorted(source_metas.items()):
        expected_questions = paper_questions.get(key, [])
        matched_nos: set[int] = set()
        low_nos: set[int] = set()
        for question in expected_questions:
            row = by_question_id.get(question.question_id)
            if not row:
                continue
            if row.get("match_status") == "low_confidence":
                low_nos.add(question.question_no)
            else:
                matched_nos.add(question.question_no)
        safe_missing = [q.question_no for q in expected_questions if q.question_no not in matched_nos]
        uncovered = [q.question_no for q in expected_questions if q.question_no not in matched_nos and q.question_no not in low_nos]
        reports.append({
            "expected_paper": f"{meta.exam_code}-{meta.paper_code}",
            "roc_year": meta.roc_year,
            "round_no": meta.round_no,
            "group": meta.group,
            "expected_questions": len(expected_questions),
            "matched_question_count": len(matched_nos),
            "low_confidence_question_count": len(low_nos),
            "safe_missing_question_count": len(safe_missing),
            "safe_missing_question_nos": " ".join(str(qno) for qno in safe_missing),
            "uncovered_question_count": len(uncovered),
            "uncovered_question_nos": " ".join(str(qno) for qno in uncovered),
        })
    return reports


def row_question_no(row: dict[str, Any]) -> int:
    try:
        return int(row.get("matched_question_no") or row.get("extracted_question_no") or row.get("question_no") or 0)
    except (TypeError, ValueError):
        return 0


def recover_uncovered_rows_from_neighbors(
    rows: list[dict[str, Any]],
    source_metas: dict[tuple[str, str], Any],
    paper_questions: dict[tuple[str, str], list[Any]],
) -> int:
    """Create visual-only placeholders for questions no extractor can read.

    This is intentionally conservative: the row is marked for review and uses a
    neighboring page span, so the site can show the original PDF evidence instead
    of pretending there is no Yangming explanation.
    """
    by_question_id = {
        str(row.get("question_id") or ""): row
        for row in rows
        if row.get("question_id")
    }
    rows_by_paper: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        key = (str(row.get("exam_code") or ""), str(row.get("paper_code") or ""))
        if key[0] and key[1]:
            rows_by_paper.setdefault(key, []).append(row)

    added = 0
    for key, meta in source_metas.items():
        paper_rows = sorted(
            [row for row in rows_by_paper.get(key, []) if row_question_no(row) > 0],
            key=row_question_no,
        )
        if not paper_rows:
            continue
        expected_questions = paper_questions.get(key, [])
        for question in expected_questions:
            if question.question_id in by_question_id:
                continue
            previous_row = next((row for row in reversed(paper_rows) if row_question_no(row) < question.question_no), None)
            next_row = next((row for row in paper_rows if row_question_no(row) > question.question_no), None)
            anchor_row = previous_row or next_row
            if not anchor_row:
                continue
            source_file = str(anchor_row.get("source_file") or "").split(" :: ", 1)[0]
            try:
                previous_end = int(previous_row.get("source_page_end") or previous_row.get("source_page_start") or 0) if previous_row else 0
                next_start = int(next_row.get("source_page_start") or next_row.get("source_page_end") or 0) if next_row else 0
            except (TypeError, ValueError):
                previous_end = 0
                next_start = 0

            if previous_end and next_start:
                start_page = min(previous_end, next_start)
                end_page = max(previous_end, next_start)
            elif previous_end:
                start_page = previous_end
                end_page = previous_end
            elif next_start:
                start_page = max(1, next_start)
                end_page = next_start
            else:
                continue

            recovered = {
                "question_id": question.question_id,
                "match_status": "low_confidence",
                "match_strategy": "visual_only_neighbor_span",
                "match_score": 0,
                "base_match_score": 0,
                "extracted_question_no": question.question_no,
                "matched_question_no": question.question_no,
                "source_file": source_file,
                "source_label": f"{meta.roc_year} 年第 {meta.round_no} 次 {meta.group}",
                "exam_code": meta.exam_code,
                "paper_code": meta.paper_code,
                "question_no": question.question_no,
                "author": None,
                "reviewer": None,
                "question_stem_snapshot": question.stem,
                "answer_snapshot": "",
                "body": "此題目前以原 PDF 截圖作為陽明詳解依據，請優先看原始版面並協助回報校正。",
                "sections": [{
                    "kind": "detail",
                    "label": "待核對",
                    "text": "此題由前後題頁碼推定原始詳解位置，文字尚待校正。"
                }],
                "assets": [],
                "source_page_start": start_page,
                "source_page_end": end_page,
                "source_page_regions": [],
                "visual_fallback": True,
                "needs_review": True,
                "snapshot_audit": {
                    "locator": "neighbor_page_span",
                    "reason": "no_text_or_visual_candidate",
                    "source_file": source_file,
                    "source_page_start": start_page,
                    "source_page_end": end_page,
                    "matched_question_no": question.question_no,
                    "previous_question_no": row_question_no(previous_row) if previous_row else "",
                    "next_question_no": row_question_no(next_row) if next_row else "",
                },
            }
            rows.append(recovered)
            paper_rows.append(recovered)
            paper_rows.sort(key=row_question_no)
            by_question_id[question.question_id] = recovered
            added += 1

    rows.sort(
        key=lambda row: (
            str(row.get("exam_code") or ""),
            str(row.get("paper_code") or ""),
            row_question_no(row),
        )
    )
    return added


def build_snapshot_audit_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    audit_rows: list[dict[str, Any]] = []
    for row in rows:
        assets = row.get("assets") if isinstance(row.get("assets"), list) else []
        snapshot_assets = [
            asset
            for asset in assets
            if isinstance(asset, dict) and asset.get("kind") == "question_snapshot"
        ]
        audit = row.get("snapshot_audit") if isinstance(row.get("snapshot_audit"), dict) else {}
        audit_rows.append({
            "question_id": row.get("question_id") or "",
            "exam_code": row.get("exam_code") or "",
            "paper_code": row.get("paper_code") or "",
            "matched_question_no": row.get("matched_question_no") or row.get("extracted_question_no") or "",
            "source_file": audit.get("source_file") or str(row.get("source_file") or "").split(" :: ", 1)[0],
            "source_page_start": audit.get("source_page_start") or row.get("source_page_start") or "",
            "source_page_end": audit.get("source_page_end") or row.get("source_page_end") or "",
            "snapshot_region_count": audit.get("snapshot_region_count") or len(snapshot_assets),
            "snapshot_asset_count": len(snapshot_assets),
            "snapshot_source": audit.get("snapshot_source") or "",
            "visual_fallback": "yes" if row.get("visual_fallback") else "",
            "locator": audit.get("locator") or "",
            "match_status": row.get("match_status") or "",
            "match_strategy": row.get("match_strategy") or "",
        })
    return audit_rows


def build_source_metas_for_papers(
    paper_meta: dict[tuple[int, int, str], Any],
    represented_papers: set[tuple[str, str]],
) -> dict[tuple[str, str], Any]:
    return {
        (meta.exam_code, meta.paper_code): meta
        for meta in paper_meta.values()
        if (meta.exam_code, meta.paper_code) in represented_papers
    }


def attach_page_snapshot_fallbacks(
    rows: list[dict[str, Any]],
    quality_rows: list[dict[str, Any]],
    source_dir: Path,
    output_dir: Path,
    preview: Any,
    mode: str = "all",
) -> int:
    if mode == "none":
        return 0
    quality_asset_counts = {
        quality_row.get("question_id"): int(quality_row.get("asset_count") or 0)
        for quality_row in quality_rows
        if quality_row.get("question_id")
    }
    pdf_cache: dict[Path, Any] = {}
    added = 0

    def row_snapshot_regions(row: dict[str, Any], doc: Any, start_page: int, end_page: int) -> list[dict[str, Any]]:
        raw_regions = row.get("source_page_regions")
        regions: list[dict[str, Any]] = []
        current_qno = row_question_no(row)
        next_qno = current_qno + 1 if current_qno else 0

        def trim_before_next_question(page: Any, bbox: list[float]) -> list[float]:
            if not next_qno:
                return bbox
            rect = preview.fitz.Rect(*bbox)
            try:
                blocks = page.get_text("blocks", clip=rect)
            except TypeError:
                blocks = page.get_text("blocks")
            next_header_pattern = re.compile(rf"題\s*號\s*[:：]?\s*0*{next_qno}(?=\s|　|科|$)")
            next_top: float | None = None
            for block in blocks:
                try:
                    x0, y0, x1, y1, text = block[:5]
                except ValueError:
                    continue
                if y0 < bbox[1] or y0 > bbox[3]:
                    continue
                if next_header_pattern.search(str(text)):
                    next_top = float(y0) if next_top is None else min(next_top, float(y0))
            if next_top is None:
                return bbox
            trimmed = [bbox[0], bbox[1], bbox[2], max(bbox[1], next_top - 3)]
            return trimmed

        if isinstance(raw_regions, list):
            for raw_region in raw_regions:
                if not isinstance(raw_region, dict):
                    continue
                page_number = raw_region.get("page")
                bbox = raw_region.get("bbox")
                if not isinstance(page_number, int) or not isinstance(bbox, list) or len(bbox) != 4:
                    continue
                if page_number <= 0 or page_number > doc.page_count:
                    continue
                page_rect = doc[page_number - 1].rect
                clipped_bbox = [
                    max(float(page_rect.x0), float(bbox[0])),
                    max(float(page_rect.y0), float(bbox[1])),
                    min(float(page_rect.x1), float(bbox[2])),
                    min(float(page_rect.y1), float(bbox[3])),
                ]
                # Some PDFs expose only a tiny matched stem strip. Expanding it to
                # a full page caused covers/neighboring questions to be displayed
                # as authoritative explanations, so skip that unsafe region instead.
                if clipped_bbox[3] - clipped_bbox[1] < 24 or clipped_bbox[2] - clipped_bbox[0] < 40:
                    continue
                region_height = clipped_bbox[3] - clipped_bbox[1]
                if clipped_bbox[1] <= 80 and region_height < 110:
                    region_text = doc[page_number - 1].get_textbox(preview.fitz.Rect(*clipped_bbox))
                    if "題號" in region_text:
                        continue
                clipped_bbox = trim_before_next_question(doc[page_number - 1], clipped_bbox)
                if clipped_bbox[3] - clipped_bbox[1] < 24 or clipped_bbox[2] - clipped_bbox[0] < 40:
                    continue
                regions.append({"page": page_number, "bbox": clipped_bbox})
        if regions:
            return regions

        fallback_regions: list[dict[str, Any]] = []
        for page_number in range(start_page, min(end_page, doc.page_count) + 1):
            rect = doc[page_number - 1].rect
            fallback_regions.append({
                "page": page_number,
                "bbox": [rect.x0, rect.y0, rect.x1, rect.y1],
            })
        return fallback_regions

    try:
        for row in rows:
            question_id = row.get("question_id")
            if mode == "missing" and quality_asset_counts.get(question_id, 0) > 0:
                continue
            if row is None:
                continue
            source_file = str(row.get("source_file") or "").split(" :: ", 1)[0]
            pdf_path = source_dir / source_file
            if not pdf_path.exists():
                continue
            try:
                start_page = int(row.get("source_page_start") or 0)
                end_page = int(row.get("source_page_end") or start_page)
            except (TypeError, ValueError):
                continue
            if start_page <= 0 or end_page <= 0:
                continue
            assets = row.setdefault("assets", [])
            if mode == "all" and any(
                isinstance(asset, dict) and asset.get("kind") == "question_snapshot"
                for asset in assets
            ):
                continue
            if mode == "missing" and any(
                isinstance(asset, dict) and (asset.get("fallback") or asset.get("kind") == "page_snapshot")
                for asset in assets
            ):
                continue
            doc = pdf_cache.get(pdf_path)
            if doc is None:
                doc = preview.fitz.open(pdf_path)
                pdf_cache[pdf_path] = doc
            sections = row.setdefault("sections", [])
            qno = row.get("matched_question_no") or row.get("extracted_question_no") or row.get("question_no") or "unknown"
            snapshot_regions = row_snapshot_regions(row, doc, start_page, end_page)
            row.setdefault("snapshot_audit", {})
            if isinstance(row["snapshot_audit"], dict):
                row["snapshot_audit"].update({
                    "snapshot_region_count": len(snapshot_regions),
                    "snapshot_mode": mode,
                    "snapshot_source": "source_page_regions" if row.get("source_page_regions") else "full_page_fallback",
                    "source_file": source_file,
                    "source_page_start": start_page,
                    "source_page_end": end_page,
                })
            for region_index, region in enumerate(snapshot_regions, start=1):
                page_number = int(region["page"])
                if page_number <= 0 or page_number > doc.page_count:
                    continue
                page = doc[page_number - 1]
                src, width, height = preview.write_page_clip_asset(
                    pdf_path,
                    page,
                    page_number,
                    f"snapshot-q{qno}-p{page_number:04d}-{region_index:02d}",
                    region["bbox"],
                    output_dir,
                )
                if not src:
                    continue
                is_source_region_snapshot = bool(row.get("source_page_regions"))
                is_primary_snapshot = mode == "all" and is_source_region_snapshot
                assets.append({
                    "src": src,
                    "alt": f"{source_file} 第 {qno} 題原頁截圖",
                    "width": width,
                    "height": height,
                    "page": page_number,
                    "bbox": region["bbox"],
                    "kind": "question_snapshot" if is_primary_snapshot else "page_snapshot",
                    "fallback": not is_primary_snapshot,
                    "snapshotIndex": region_index,
                    "snapshotSource": "source_page_regions" if row.get("source_page_regions") else "full_page_fallback",
                })
                sections.append({
                    "kind": "image",
                    "label": "完整原頁截圖" if is_primary_snapshot else "原頁截圖",
                    "assetIndex": len(assets) - 1,
                    "page": page_number,
                    "fallback": not is_primary_snapshot,
                })
                added += 1
    finally:
        for doc in pdf_cache.values():
            doc.close()
    return added


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument(
        "--base-rows",
        type=Path,
        default=DEFAULT_BASE_ROWS,
        help="Optional complete consolidated rows JSON used to recover questions missed by visual extraction.",
    )
    parser.add_argument(
        "--no-base-row-merge",
        action="store_true",
        help="Disable recovering rows from --base-rows.",
    )
    parser.add_argument(
        "--no-neighbor-span-recovery",
        action="store_true",
        help="Disable visual-only placeholder rows for questions no extractor can locate.",
    )
    parser.add_argument(
        "--page-snapshot-mode",
        choices=["all", "missing", "none"],
        default="all",
        help="all: attach full per-question page snapshots to every matched row; missing: only rows without visual assets; none: disable snapshots.",
    )
    args = parser.parse_args()

    preview = load_preview_module()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    per_file_dir = args.output_dir / "per_file"
    per_file_dir.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(args.source_dir.glob("*.pdf"))
    if args.limit:
        pdfs = pdfs[: args.limit]
    processed_source_files = {pdf.name for pdf in pdfs}

    all_rows: list[dict[str, Any]] = []
    all_file_reports: list[dict[str, Any]] = []
    batch_rows: list[dict[str, Any]] = []

    for index, pdf in enumerate(pdfs, start=1):
        safe_name = preview.safe_cache_name(pdf)
        file_output_dir = per_file_dir / safe_name
        preview_json = file_output_dir / "yangming_preview_rows.json"
        print(f"[{index}/{len(pdfs)}] {pdf.name}", flush=True)
        if not args.skip_existing or not preview_json.exists():
            command = [
                sys.executable,
                str(PREVIEW_SCRIPT),
                "--source-dir",
                str(args.source_dir),
                "--output-dir",
                str(file_output_dir),
                "--ocr-cache-dir",
                str(args.output_dir / "ocr_text_cache"),
                "--only-file",
                pdf.name,
                "--extract-visual-assets",
                "--detect-tables",
            ]
            completed = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            log_path = file_output_dir / "run.log"
            file_output_dir.mkdir(parents=True, exist_ok=True)
            log_path.write_text(completed.stdout or "", encoding="utf-8")
            if completed.returncode != 0:
                batch_rows.append({
                    "file": pdf.name,
                    "status": "failed",
                    "returncode": completed.returncode,
                    "log": str(log_path.relative_to(args.output_dir)),
                })
                print(f"  failed, see {log_path}", flush=True)
                continue

        rows = json.loads(preview_json.read_text(encoding="utf-8")) if preview_json.exists() else []
        prefix_asset_paths(rows, f"per_file/{safe_name}/")
        consolidated_report_path = file_output_dir / "yangming_consolidated_report.json"
        file_report_path = file_output_dir / "yangming_file_report.json"
        file_reports = json.loads(file_report_path.read_text(encoding="utf-8")) if file_report_path.exists() else []
        all_rows.extend(rows)
        all_file_reports.extend(file_reports)
        counts = count_assets(rows)
        gap_rows = []
        quality_rows = []
        gap_path = file_output_dir / "yangming_gap_audit.csv"
        quality_path = file_output_dir / "yangming_content_quality_audit.csv"
        if gap_path.exists():
            gap_rows = list(csv.DictReader(gap_path.open(encoding="utf-8")))
        if quality_path.exists():
            quality_rows = list(csv.DictReader(quality_path.open(encoding="utf-8")))
        batch_rows.append({
            "file": pdf.name,
            "status": "ok",
            "rows": counts["rows"],
            "rows_with_assets": counts["rows_with_assets"],
            "assets": counts["assets"],
            "image_assets": counts["image_assets"],
            "table_assets": counts["table_assets"],
            "empty_asset_src": counts["empty_asset_src"],
            "gap_rows": len(gap_rows),
            "quality_rows": len(quality_rows),
            "log": str((file_output_dir / "run.log").relative_to(args.output_dir)),
            "consolidated_report": str(consolidated_report_path.relative_to(args.output_dir)),
        })
        print(
            f"  assets={counts['assets']} images={counts['image_assets']} tables={counts['table_assets']} "
            f"empty_src={counts['empty_asset_src']} gaps={len(gap_rows)} quality={len(quality_rows)}",
            flush=True,
        )

    _by_question, paper_meta, paper_questions = preview.load_audit()
    stems = preview.load_question_stems()
    paper_questions = preview.hydrate_paper_questions(paper_questions, stems)
    represented_papers = {
        (str(row.get("exam_code") or ""), str(row.get("paper_code") or ""))
        for row in all_rows
        if row.get("exam_code") and row.get("paper_code")
    }
    source_metas = build_source_metas_for_papers(paper_meta, represented_papers)
    consolidated_rows, consolidated_reports = preview.build_consolidated(all_rows, source_metas, paper_questions)
    base_rows_added = 0
    if not args.no_base_row_merge and args.base_rows and args.base_rows.exists():
        base_rows = load_json_rows(args.base_rows)
        scoped_base_rows = [
            row
            for row in base_rows
            if str(row.get("source_file") or "").split(" :: ", 1)[0] in processed_source_files
        ]
        represented_papers.update(
            (str(row.get("exam_code") or ""), str(row.get("paper_code") or ""))
            for row in scoped_base_rows
            if row.get("exam_code") and row.get("paper_code")
        )
        source_metas = build_source_metas_for_papers(paper_meta, represented_papers)
        base_rows_added = merge_base_rows(consolidated_rows, scoped_base_rows, processed_source_files)
        if base_rows_added:
            consolidated_reports = build_reports_for_rows(consolidated_rows, source_metas, paper_questions)
    neighbor_rows_added = 0
    if not args.no_neighbor_span_recovery:
        neighbor_rows_added = recover_uncovered_rows_from_neighbors(consolidated_rows, source_metas, paper_questions)
        if neighbor_rows_added:
            consolidated_reports = build_reports_for_rows(consolidated_rows, source_metas, paper_questions)
    gap_audit_rows = preview.build_gap_audit(all_rows, consolidated_reports, paper_questions)
    content_quality_rows = preview.build_content_quality_audit(consolidated_rows)
    fallback_assets_added = attach_page_snapshot_fallbacks(
        consolidated_rows,
        content_quality_rows,
        args.source_dir,
        args.output_dir / "assets",
        preview,
        args.page_snapshot_mode,
    )
    content_quality_rows = preview.build_content_quality_audit(consolidated_rows)

    (args.output_dir / "yangming_visual_preview_rows.json").write_text(
        json.dumps(all_rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_visual_consolidated_rows.json").write_text(
        json.dumps(consolidated_rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_visual_file_report.json").write_text(
        json.dumps(all_file_reports, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_visual_consolidated_report.json").write_text(
        json.dumps(consolidated_reports, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    write_csv(args.output_dir / "yangming_visual_batch_report.csv", batch_rows, [
        "file",
        "status",
        "returncode",
        "rows",
        "rows_with_assets",
        "assets",
        "image_assets",
        "table_assets",
        "empty_asset_src",
        "gap_rows",
        "quality_rows",
        "log",
        "consolidated_report",
    ])
    write_csv(args.output_dir / "yangming_visual_consolidated_report.csv", consolidated_reports, [
        "expected_paper",
        "roc_year",
        "round_no",
        "group",
        "expected_questions",
        "matched_question_count",
        "low_confidence_question_count",
        "safe_missing_question_count",
        "safe_missing_question_nos",
        "uncovered_question_count",
        "uncovered_question_nos",
    ])
    write_csv(args.output_dir / "yangming_snapshot_audit.csv", build_snapshot_audit_rows(consolidated_rows), [
        "question_id",
        "exam_code",
        "paper_code",
        "matched_question_no",
        "source_file",
        "source_page_start",
        "source_page_end",
        "snapshot_region_count",
        "snapshot_asset_count",
        "snapshot_source",
        "visual_fallback",
        "locator",
        "match_status",
        "match_strategy",
    ])
    preview.write_gap_audit(args.output_dir, gap_audit_rows)
    preview.write_content_quality_audit(args.output_dir, content_quality_rows)

    asset_counts = count_assets(consolidated_rows)
    summary = {
        "pdf_files": len(pdfs),
        "failed_files": sum(1 for row in batch_rows if row["status"] != "ok"),
        "preview_rows": len(all_rows),
        "consolidated_rows": len(consolidated_rows),
        "consolidated_safe_missing": sum(row["safe_missing_question_count"] for row in consolidated_reports),
        "consolidated_uncovered": sum(row["uncovered_question_count"] for row in consolidated_reports),
        "gap_audit_rows": len(gap_audit_rows),
        "content_quality_audit_rows": len(content_quality_rows),
        "fallback_page_assets_added": fallback_assets_added,
        "base_rows_path": str(args.base_rows) if args.base_rows else "",
        "base_rows_added": base_rows_added,
        "neighbor_rows_added": neighbor_rows_added,
        "page_snapshot_mode": args.page_snapshot_mode,
        **asset_counts,
    }
    (args.output_dir / "yangming_visual_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    return 0 if summary["failed_files"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
