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
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_SCRIPT = ROOT / "scripts" / "preview_yangming_explanations.py"
DEFAULT_SOURCE_DIR = Path("/Users/huangguanlun/Downloads/陽明詳解")
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "yangming_import_preview" / "visual_full"


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
        if isinstance(raw_regions, list):
            for raw_region in raw_regions:
                if not isinstance(raw_region, dict):
                    continue
                page_number = raw_region.get("page")
                bbox = raw_region.get("bbox")
                if not isinstance(page_number, int) or not isinstance(bbox, list) or len(bbox) != 4:
                    continue
                regions.append({"page": page_number, "bbox": bbox})
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
                is_primary_snapshot = mode == "all"
                assets.append({
                    "src": src,
                    "alt": f"{source_file} 第 {qno} 題原頁截圖",
                    "width": width,
                    "height": height,
                    "page": page_number,
                    "bbox": region["bbox"],
                    "kind": "question_snapshot" if is_primary_snapshot else "page_snapshot",
                    "fallback": not is_primary_snapshot,
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
    source_metas = {
        key: meta
        for key, meta in paper_meta.items()
        if key in represented_papers
    }
    consolidated_rows, consolidated_reports = preview.build_consolidated(all_rows, source_metas, paper_questions)
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
