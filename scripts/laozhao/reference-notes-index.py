#!/usr/bin/env python3
from __future__ import annotations

"""Build a restartable, private reference-note index.

Reviewed page topics are the only evidence that can create automatic Preview
links. OCR deliberately produces *chapter candidates*, not approved
board-to-note links. Chapter order is a very small OCR tie-breaker only after
text evidence exists; it can never create a match on its own.

Large PDFs and all derived OCR stay outside the repository when callers point
``--cache-dir`` and ``--output`` at the private staging volume. Each page cache
is written atomically, so an interrupted run resumes from completed pages.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Sequence


CACHE_SCHEMA_VERSION = "1.0.0"
OUTPUT_SCHEMA_VERSION = "1.1.0"
MIN_EVIDENCE_SCORE = 0.46
MIN_CONFIDENCE = 0.72
MIN_RUNNER_UP_GAP = 0.13
CATALOG_SCHEMA_VERSION = "1.0.0"
CATALOG_MIN_CONFIDENCE = 0.82
CATALOG_MIN_RUNNER_UP_GAP = 0.08

# These broad labels are useful context but are never enough to bind a note page.
GENERIC_CATALOG_TERMS = {
    "上肢", "下肢", "前臂", "大腿", "小腿", "肌肉", "神經", "血管", "腦",
    "腦膜", "腦室", "腔室", "感覺", "運動", "系統", "解剖", "生理", "功能",
    "cns", "pns", "csf",
}


@dataclass(frozen=True)
class PageOcr:
    page: int
    text: str


@dataclass(frozen=True)
class ReviewedPageTopic:
    page: int
    page_region: str
    match_terms: tuple[str, ...]
    matched_structures: tuple[str, ...]


@dataclass(frozen=True)
class ChapterMatch:
    chapter_id: str
    pdf_page: int
    confidence: float
    evidence_score: float
    runner_up_gap: float
    matched_terms: tuple[str, ...]
    source_mode: str = "ocr_text_conservative_candidate"
    page_region: str = "OCR 文字證據候選，待人工確認"
    matched_structures: tuple[str, ...] = ()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}-{os.urandom(4).hex()}")
    try:
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def read_json(path: Path, label: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"無法讀取{label}：{path}") from error
    if not isinstance(payload, dict):
        raise RuntimeError(f"{label}必須是 JSON 物件：{path}")
    return payload


def command_output(command: Sequence[str], *, timeout: int = 180) -> str:
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "沒有錯誤訊息"
        raise RuntimeError(f"外部工具失敗：{' '.join(command[:2])}：{detail}")
    return result.stdout


def pdf_page_count(pdf_path: Path, pdfinfo_bin: str) -> int:
    output = command_output([pdfinfo_bin, str(pdf_path)])
    match = re.search(r"^Pages:\s*(\d+)\s*$", output, flags=re.MULTILINE)
    if not match:
        raise RuntimeError("無法從 PDF 讀取頁數。")
    page_count = int(match.group(1))
    if page_count < 1:
        raise RuntimeError("PDF 沒有可掃描頁面。")
    return page_count


def normalize_text(value: str) -> str:
    return re.sub(r"[^0-9a-z\u3400-\u9fff]+", "", value.lower())


def distinct_terms(values: Iterable[object]) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = normalize_text(value)
        if len(normalized) < 2 or normalized in seen:
            continue
        seen.add(normalized)
        terms.append(normalized)
    return terms


def chapter_terms(chapter: dict) -> list[str]:
    """Use explicit chapter language only; no inferred anatomy dictionary."""

    raw: list[object] = [chapter.get("title"), chapter.get("summary")]
    tags = chapter.get("tags")
    if isinstance(tags, list):
        raw.extend(tags)
    return distinct_terms(raw)


def chapter_search_text(chapter: dict) -> str:
    raw: list[object] = [chapter.get("title"), chapter.get("summary")]
    tags = chapter.get("tags")
    if isinstance(tags, list):
        raw.extend(tags)
    return normalize_text(" ".join(value for value in raw if isinstance(value, str)))


def chapter_primary_text(chapter: dict) -> str:
    raw: list[object] = [chapter.get("title")]
    tags = chapter.get("tags")
    if isinstance(tags, list):
        raw.extend(tags)
    return normalize_text(" ".join(value for value in raw if isinstance(value, str)))


def load_reviewed_page_catalog(
    path: Path,
    *,
    pdf_sha256: str,
    page_count: int,
) -> list[ReviewedPageTopic]:
    payload = read_json(path, "人工覆核筆記頁索引")
    if payload.get("schemaVersion") != CATALOG_SCHEMA_VERSION:
        raise RuntimeError(f"人工覆核筆記頁索引 schemaVersion 必須是 {CATALOG_SCHEMA_VERSION}。")
    if payload.get("reviewStatus") != "reviewed":
        raise RuntimeError("人工覆核筆記頁索引尚未標成 reviewed。")
    if payload.get("sourcePdfSha256") != pdf_sha256:
        raise RuntimeError("人工覆核筆記頁索引的 PDF 指紋與目前檔案不一致。")
    if payload.get("pageCount") != page_count:
        raise RuntimeError("人工覆核筆記頁索引的頁數與目前 PDF 不一致。")
    raw_pages = payload.get("pages")
    if not isinstance(raw_pages, list) or not raw_pages:
        raise RuntimeError("人工覆核筆記頁索引沒有任何頁面。")

    topics: list[ReviewedPageTopic] = []
    seen_pages: set[int] = set()
    for index, raw in enumerate(raw_pages):
        if not isinstance(raw, dict):
            raise RuntimeError(f"人工覆核筆記頁索引第 {index + 1} 筆格式不正確。")
        page = raw.get("page")
        if not isinstance(page, int) or page < 1 or page > page_count:
            raise RuntimeError(f"人工覆核筆記頁索引第 {index + 1} 筆頁碼不正確。")
        if page in seen_pages:
            raise RuntimeError(f"人工覆核筆記頁索引重複第 {page} 頁。")
        page_region = raw.get("pageRegion")
        if not isinstance(page_region, str) or not page_region.strip():
            raise RuntimeError(f"人工覆核筆記頁索引第 {page} 頁缺少 pageRegion。")
        match_terms = tuple(distinct_terms(raw.get("matchTerms") if isinstance(raw.get("matchTerms"), list) else []))
        structures = raw.get("matchedStructures")
        matched_structures = tuple(
            value.strip() for value in structures
            if isinstance(value, str) and value.strip()
        ) if isinstance(structures, list) else ()
        if not match_terms:
            raise RuntimeError(f"人工覆核筆記頁索引第 {page} 頁缺少明確 matchTerms。")
        if not matched_structures:
            raise RuntimeError(f"人工覆核筆記頁索引第 {page} 頁缺少 matchedStructures。")
        seen_pages.add(page)
        topics.append(ReviewedPageTopic(
            page=page,
            page_region=page_region.strip(),
            match_terms=match_terms,
            matched_structures=matched_structures,
        ))
    return sorted(topics, key=lambda item: item.page)


def catalog_term_weight(term: str) -> float:
    if term in GENERIC_CATALOG_TERMS:
        return 0.0
    length = len(term)
    if length >= 8:
        return 0.98
    if length >= 5:
        return 0.94
    if length >= 4:
        return 0.90
    if length >= 3:
        return 0.70
    return 0.0


def score_chapter_topic(chapter: dict, topic: ReviewedPageTopic) -> tuple[float, tuple[str, ...]]:
    text = chapter_search_text(chapter)
    primary_text = chapter_primary_text(chapter)
    matches = tuple(term for term in topic.match_terms if term in text and catalog_term_weight(term) > 0)
    if not matches:
        return 0.0, ()
    weights = sorted((catalog_term_weight(term) for term in matches), reverse=True)
    primary_matches = tuple(term for term in matches if term in primary_text)
    primary_weights = [catalog_term_weight(term) for term in primary_matches]
    # One specific title/tag phrase is enough. Summary-only evidence can explain a
    # chapter but cannot bind a page by itself; it needs independent primary evidence.
    has_specific_primary = any(weight >= 0.90 for weight in primary_weights)
    has_corroborated_primary = bool(primary_matches) and len(matches) >= 2
    if not has_specific_primary and not has_corroborated_primary:
        return 0.0, ()
    evidence = weights[0] if weights[0] >= 0.90 else 0.82
    evidence = min(0.99, evidence + min(0.05, max(0, len(weights) - 1) * 0.02))
    return evidence, matches


def select_reviewed_catalog_matches(
    chapters: Sequence[dict],
    topics: Sequence[ReviewedPageTopic],
) -> list[ChapterMatch]:
    matches: list[ChapterMatch] = []
    for chapter in chapters:
        chapter_id = chapter.get("id") or chapter.get("chapterId")
        if not isinstance(chapter_id, str) or not chapter_id:
            raise RuntimeError("章節缺少穩定 ID。")
        scored: list[tuple[float, ReviewedPageTopic, tuple[str, ...]]] = []
        for topic in topics:
            evidence, terms = score_chapter_topic(chapter, topic)
            if evidence >= CATALOG_MIN_CONFIDENCE:
                scored.append((evidence, topic, terms))
        if not scored:
            continue
        scored.sort(key=lambda item: (-item[0], item[1].page))
        best_evidence, best_topic, best_terms = scored[0]
        runner_up = scored[1][0] if len(scored) > 1 else 0.0
        gap = best_evidence - runner_up
        if runner_up > 0 and gap < CATALOG_MIN_RUNNER_UP_GAP:
            continue
        matches.append(ChapterMatch(
            chapter_id=chapter_id,
            pdf_page=best_topic.page,
            confidence=round(best_evidence, 4),
            evidence_score=round(best_evidence, 4),
            runner_up_gap=round(gap, 4),
            matched_terms=best_terms,
            source_mode="reviewed_page_topic_catalog",
            page_region=best_topic.page_region,
            matched_structures=best_topic.matched_structures,
        ))
    return matches


def term_evidence(term: str, page_text: str) -> float:
    """Return a conservative textual-evidence score for one term.

    Long terms are meaningful exact evidence. Short Chinese tags need at least
    two occurrences or a longer supporting term elsewhere in the same chapter.
    """

    occurrences = page_text.count(term)
    if occurrences == 0:
        return 0.0
    length = len(term)
    if length >= 7:
        return 1.0
    if length >= 5:
        return 0.86
    if length >= 4:
        return 0.70
    if length >= 3 and occurrences >= 2:
        return 0.52
    return 0.0


def score_chapter_page(chapter: dict, page: PageOcr) -> tuple[float, tuple[str, ...]]:
    text = normalize_text(page.text)
    if not text:
        return 0.0, ()
    matches: list[tuple[str, float]] = []
    for term in chapter_terms(chapter):
        score = term_evidence(term, text)
        if score > 0:
            matches.append((term, score))
    if not matches:
        return 0.0, ()

    matches.sort(key=lambda item: (-item[1], -len(item[0]), item[0]))
    # One exact long phrase is acceptable. Otherwise require corroboration.
    best = matches[0][1]
    if best < 0.86 and len(matches) < 2:
        return 0.0, ()
    evidence = min(1.0, best * 0.72 + sum(score for _, score in matches[1:]) * 0.28)
    return evidence, tuple(term for term, _ in matches)


def order_prior(chapter_position: int, chapter_total: int, page: int, page_total: int) -> float:
    """Weak ordering prior, intentionally capped far below admission thresholds."""

    if chapter_total <= 1 or page_total <= 1:
        return 0.0
    chapter_fraction = chapter_position / (chapter_total - 1)
    page_fraction = (page - 1) / (page_total - 1)
    return max(0.0, 0.04 * (1.0 - min(1.0, abs(chapter_fraction - page_fraction) * 2.0)))


def select_conservative_matches(chapters: Sequence[dict], pages: Sequence[PageOcr]) -> list[ChapterMatch]:
    if not pages:
        return []
    matches: list[ChapterMatch] = []
    for chapter_position, chapter in enumerate(chapters):
        chapter_id = chapter.get("id") or chapter.get("chapterId")
        if not isinstance(chapter_id, str) or not chapter_id:
            raise RuntimeError("章節缺少穩定 ID。")
        scored: list[tuple[float, float, PageOcr, tuple[str, ...]]] = []
        for page in pages:
            evidence, terms = score_chapter_page(chapter, page)
            if evidence < MIN_EVIDENCE_SCORE:
                continue
            scored.append((evidence + order_prior(chapter_position, len(chapters), page.page, len(pages)), evidence, page, terms))
        if not scored:
            continue
        scored.sort(key=lambda item: (-item[0], -item[1], item[2].page))
        _, best_evidence, best_page, best_terms = scored[0]
        runner_up_evidence = scored[1][1] if len(scored) > 1 else 0.0
        gap = best_evidence - runner_up_evidence
        confidence = min(1.0, best_evidence * 0.76 + min(0.24, gap * 1.35))
        if confidence < MIN_CONFIDENCE or gap < MIN_RUNNER_UP_GAP:
            continue
        matches.append(ChapterMatch(
            chapter_id=chapter_id,
            pdf_page=best_page.page,
            confidence=round(confidence, 4),
            evidence_score=round(best_evidence, 4),
            runner_up_gap=round(gap, 4),
            matched_terms=best_terms,
        ))
    return matches


def page_cache_path(cache_root: Path, pdf_sha256: str, page: int) -> Path:
    return cache_root / pdf_sha256 / "pages" / f"page-{page:04d}.json"


def load_cached_page(path: Path, *, pdf_sha256: str, page: int) -> PageOcr | None:
    if not path.is_file():
        return None
    try:
        payload = read_json(path, "OCR 快取")
    except RuntimeError:
        return None
    if (
        payload.get("schemaVersion") != CACHE_SCHEMA_VERSION
        or payload.get("sourcePdfSha256") != pdf_sha256
        or payload.get("page") != page
        or not isinstance(payload.get("text"), str)
    ):
        return None
    return PageOcr(page=page, text=payload["text"])


def render_and_ocr_page(
    pdf_path: Path,
    page: int,
    *,
    pdftoppm_bin: str,
    tesseract_bin: str,
    language: str,
    dpi: int,
) -> str:
    with tempfile.TemporaryDirectory(prefix="laozhao-reference-ocr-") as directory:
        prefix = Path(directory) / "page"
        command_output([
            pdftoppm_bin, "-f", str(page), "-l", str(page), "-r", str(dpi), "-png", str(pdf_path), str(prefix)
        ], timeout=300)
        images = sorted(Path(directory).glob("page-*.png"))
        if len(images) != 1:
            raise RuntimeError(f"PDF 第 {page} 頁轉圖失敗。")
        return command_output([tesseract_bin, str(images[0]), "stdout", "-l", language, "--psm", "6"], timeout=300).strip()


def scan_pdf_pages(
    pdf_path: Path,
    *,
    cache_dir: Path,
    pdf_sha256: str,
    page_count: int,
    pdftoppm_bin: str,
    tesseract_bin: str,
    language: str,
    dpi: int,
    renderer: Callable[..., str] = render_and_ocr_page,
) -> list[PageOcr]:
    pages: list[PageOcr] = []
    for page in range(1, page_count + 1):
        cache_path = page_cache_path(cache_dir, pdf_sha256, page)
        cached = load_cached_page(cache_path, pdf_sha256=pdf_sha256, page=page)
        if cached is not None:
            pages.append(cached)
            continue
        text = renderer(
            pdf_path,
            page,
            pdftoppm_bin=pdftoppm_bin,
            tesseract_bin=tesseract_bin,
            language=language,
            dpi=dpi,
        )
        payload = {
            "schemaVersion": CACHE_SCHEMA_VERSION,
            "sourcePdfSha256": pdf_sha256,
            "page": page,
            "ocrLanguage": language,
            "dpi": dpi,
            "generatedAt": utc_now(),
            "text": text,
            "textSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        }
        atomic_write_json(cache_path, payload)
        pages.append(PageOcr(page=page, text=text))
    atomic_write_json(cache_dir / pdf_sha256 / "manifest.json", {
        "schemaVersion": CACHE_SCHEMA_VERSION,
        "sourcePdf": pdf_path.name,
        "sourcePdfSha256": pdf_sha256,
        "pageCount": page_count,
        "ocrLanguage": language,
        "dpi": dpi,
        "updatedAt": utc_now(),
    })
    return pages


def normalize_chapters(payload: dict) -> tuple[str, list[dict]]:
    video_id = payload.get("videoId")
    chapters = payload.get("chapters")
    if not isinstance(video_id, str) or not video_id:
        raise RuntimeError("章節檔缺少 videoId。")
    if not isinstance(chapters, list) or not chapters:
        raise RuntimeError("章節檔沒有章節。")
    normalized: list[dict] = []
    for index, chapter in enumerate(chapters):
        if not isinstance(chapter, dict):
            raise RuntimeError(f"第 {index + 1} 章格式不正確。")
        chapter_id = chapter.get("id") or chapter.get("chapterId")
        if not isinstance(chapter_id, str) or not chapter_id:
            raise RuntimeError(f"第 {index + 1} 章缺少 ID。")
        normalized.append({**chapter, "id": chapter_id})
    return video_id, normalized


def build_candidate_map(
    *,
    pdf_path: Path,
    pdf_sha256: str,
    page_count: int,
    video_id: str,
    chapters: Sequence[dict],
    pages: Sequence[PageOcr] = (),
    reviewed_topics: Sequence[ReviewedPageTopic] = (),
    include_ocr_candidates: bool = True,
) -> dict:
    catalog_matches = select_reviewed_catalog_matches(chapters, reviewed_topics)
    catalog_chapter_ids = {match.chapter_id for match in catalog_matches}
    ocr_matches = select_conservative_matches(
        [chapter for chapter in chapters if chapter["id"] not in catalog_chapter_ids],
        pages,
    ) if include_ocr_candidates else []
    matches = [*catalog_matches, *ocr_matches]
    has_ocr_candidates = any(match.source_mode == "ocr_text_conservative_candidate" for match in matches)
    catalog_only = bool(reviewed_topics) and not include_ocr_candidates and not has_ocr_candidates
    mappings = []
    for match in matches:
        mappings.append({
            "chapterIds": [match.chapter_id],
            "pdfPages": [match.pdf_page],
            "matchedStructures": list(match.matched_structures or match.matched_terms),
            "pageRegion": match.page_region,
            "match": {
                "mode": match.source_mode,
                "confidence": match.confidence,
                "evidenceScore": match.evidence_score,
                "runnerUpGap": match.runner_up_gap,
                "matchedTerms": list(match.matched_terms),
                "orderPriorMax": 0.04 if match.source_mode == "ocr_text_conservative_candidate" else 0.0,
            },
        })
    return {
        "schemaVersion": OUTPUT_SCHEMA_VERSION,
        "visibility": "private_reference_only",
        "reviewStatus": "chapter_mapped_automatic_frame_binding" if catalog_only else "candidate",
        "requiresHumanReview": not catalog_only,
        "generatedAt": utc_now(),
        "videoId": video_id,
        "source": {
            "title": pdf_path.name,
            "sha256": pdf_sha256,
            "pageCount": page_count,
            "publicationPermission": "not_confirmed",
        },
        "mappings": mappings,
        "boardFrameMappings": [],
        "rejectedChapterIds": [
            chapter["id"] for chapter in chapters if chapter["id"] not in {match.chapter_id for match in matches}
        ],
        "policy": {
            "lowConfidence": "rejected",
            "reviewedCatalog": "automatic_preview_binding_allowed",
            "ocrEvidence": "candidate_only",
            "chapterOrder": "weak_prior_for_ocr_only",
            "automaticPublication": "prohibited",
        },
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="建立私人 PDF OCR 快取與保守章節筆記對照候選。")
    parser.add_argument("--pdf", required=True, type=Path, help="私人參考筆記 PDF")
    parser.add_argument("--chapters", required=True, type=Path, help="已驗證章節 JSON")
    parser.add_argument("--cache-dir", required=True, type=Path, help="PDF OCR 私人快取根目錄")
    parser.add_argument("--output", required=True, type=Path, help="私人候選對照 JSON")
    parser.add_argument("--catalog", type=Path, help="已人工覆核、帶 PDF 指紋的筆記頁主題索引")
    parser.add_argument("--skip-ocr", action="store_true", help="只用人工覆核頁面索引，不執行 OCR")
    parser.add_argument("--pdfinfo-bin", default="pdfinfo")
    parser.add_argument("--pdftoppm-bin", default="pdftoppm")
    parser.add_argument("--tesseract-bin", default="tesseract")
    parser.add_argument("--language", default="chi_tra+eng")
    parser.add_argument("--dpi", type=int, default=180)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    pdf_path = args.pdf.expanduser().resolve()
    chapters_path = args.chapters.expanduser().resolve()
    cache_dir = args.cache_dir.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    catalog_path = args.catalog.expanduser().resolve() if args.catalog else None
    if not pdf_path.is_file():
        raise RuntimeError(f"找不到 PDF：{pdf_path}")
    if not chapters_path.is_file():
        raise RuntimeError(f"找不到章節檔：{chapters_path}")
    if catalog_path is not None and not catalog_path.is_file():
        raise RuntimeError(f"找不到人工覆核筆記頁索引：{catalog_path}")
    if args.skip_ocr and catalog_path is None:
        raise RuntimeError("--skip-ocr 必須同時提供 --catalog。")
    if args.dpi < 72 or args.dpi > 600:
        raise RuntimeError("--dpi 必須介於 72 與 600。")
    chapter_payload = read_json(chapters_path, "章節檔")
    video_id, chapters = normalize_chapters(chapter_payload)
    fingerprint = sha256_file(pdf_path)
    page_count = pdf_page_count(pdf_path, args.pdfinfo_bin)
    reviewed_topics = load_reviewed_page_catalog(
        catalog_path,
        pdf_sha256=fingerprint,
        page_count=page_count,
    ) if catalog_path is not None else []
    pages = [] if args.skip_ocr else scan_pdf_pages(
        pdf_path,
        cache_dir=cache_dir,
        pdf_sha256=fingerprint,
        page_count=page_count,
        pdftoppm_bin=args.pdftoppm_bin,
        tesseract_bin=args.tesseract_bin,
        language=args.language,
        dpi=args.dpi,
    )
    result = build_candidate_map(
        pdf_path=pdf_path,
        pdf_sha256=fingerprint,
        page_count=page_count,
        video_id=video_id,
        chapters=chapters,
        pages=pages,
        reviewed_topics=reviewed_topics,
        include_ocr_candidates=not args.skip_ocr,
    )
    atomic_write_json(output_path, result)
    if args.skip_ocr:
        print("OCR：已略過（只使用人工覆核頁面索引）")
    else:
        print(f"OCR 快取：{len(pages)}/{page_count} 頁")
    print(f"人工覆核頁面：{len(reviewed_topics)} 頁")
    print(f"保守對照：{len(result['mappings'])}/{len(chapters)} 章")
    print(f"已拒絕低信心：{len(result['rejectedChapterIds'])} 章")
    print(f"已寫入：{output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
