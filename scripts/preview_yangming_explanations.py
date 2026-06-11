#!/usr/bin/env python3
"""Preview extraction for Yangming medical board explanations.

This script intentionally does not write to Supabase. It scans local PDFs,
extracts per-question explanation candidates, maps them to local MOEX question
IDs when possible, and writes JSON/CSV reports for review.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import tempfile
import hashlib
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = Path("/Users/huangguanlun/Downloads/陽明詳解")
DEFAULT_OUTPUT_DIR = ROOT / "reports" / "yangming_import_preview"
AUDIT_CSV = ROOT / "data" / "sources" / "question_bank_audit_detailed.csv"
PDFTOPPM = Path("/opt/homebrew/bin/pdftoppm")
TESSERACT = Path("/opt/homebrew/bin/tesseract")
OCR_FALLBACK_FILENAMES = {
    "104-2醫學(一).pdf",
    "104-2醫學(二).pdf",
    "106-1醫學(一).pdf",
    "106-1醫學(二).pdf",
}
OCR_QUESTION_MARKER_RE = re.compile(r"(?:題目|題幹)(?![\w\u4e00-\u9fff])\s*[|:：]?")


@dataclass(frozen=True)
class PaperMeta:
    roc_year: int
    round_no: int
    group: str
    exam_code: str
    paper_code: str


@dataclass(frozen=True)
class PaperQuestion:
    question_no: int
    question_id: str
    stem: str


def normalize_text(value: str) -> str:
    value = value.replace("\u3000", " ").replace("\ufeff", "")
    value = value.replace("題⽬", "題目").replace("科⽬", "科目")
    value = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_for_match(value: str) -> str:
    value = normalize_text(value)
    value = value.replace("（", "(").replace("）", ")")
    value = value.replace("：", ":").replace("，", ",").replace("。", ".")
    value = value.replace("？", "?").replace("；", ";")
    value = re.sub(r"^(?:醫學\s*[一二(（）)]\s*)?", " ", value)
    value = value.strip()
    value = re.sub(r"^(?:解剖學|生理學|生物化學|組織學|胚胎學|微生物|免疫|藥理|病理|公衛|公共衛生|寄生蟲)\s*", " ", value)
    value = re.sub(r"(?:撰寫|校稿|筆者|製稿|審稿)\s*[:：]?\s*[^\s,，。:：]{1,8}", " ", value)
    value = re.sub(r"關鍵字\s*", " ", value)
    value = re.sub(r"^(?:題目|題幹)\s*[:：]?", " ", value)
    value = re.sub(r"(?<!\w)[A-D][.．、]\s*", " ", value)
    value = re.sub(r"\b(?:Ans|KEY|Key)\b\s*[:：]?", " ", value)
    value = re.sub(r"(?:答案|解答|公告答案|簡解|簡答|詳解|補充|參考資料|出處)\s*[:：]?", " ", value)
    value = re.sub(r"\d{2,3}\s*年\s*第\s*[一二12]\s*次\s*醫師考試", " ", value)
    value = re.sub(r"(?<!\d)0?(?:100|[1-9][0-9]?)(?:題|[.、．])?", " ", value)
    value = re.sub(r"[^\w\u4e00-\u9fff]+", "", value.lower())
    return value


def strip_prompt_noise(value: str) -> str:
    value = normalize_text(value)
    value = re.sub(r"^題幹\s*", "", value)
    value = re.sub(r"^題目\s*", "", value)
    value = re.sub(r"^\d+\s*[.、]?\s*", "", value)
    return value.strip()


def get_field(row: dict[str, str], name: str) -> str:
    return row.get(name) or row.get(f"\ufeff{name}") or ""


def load_audit() -> tuple[
    dict[tuple[str, str, int], str],
    dict[tuple[int, int, str], PaperMeta],
    dict[tuple[str, str], list[PaperQuestion]],
]:
    by_question: dict[tuple[str, str, int], str] = {}
    papers_by_year_group: dict[tuple[int, str], list[tuple[str, str]]] = {}
    paper_questions: dict[tuple[str, str], list[PaperQuestion]] = {}

    with AUDIT_CSV.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            canonical_id = get_field(row, "canonical_id")
            group = get_field(row, "group")
            exam_code = get_field(row, "exam_code")
            paper_code = get_field(row, "paper_code")
            question_no = int(get_field(row, "question_no") or "0")
            roc_year = int(get_field(row, "roc_year") or "0")
            if not canonical_id or not exam_code or not paper_code or question_no <= 0:
                continue

            by_question[(exam_code, paper_code, question_no)] = canonical_id
            paper_questions.setdefault((exam_code, paper_code), []).append(PaperQuestion(
                question_no=question_no,
                question_id=canonical_id,
                stem="",
            ))
            papers_by_year_group.setdefault((roc_year, group), [])
            paper_pair = (exam_code, paper_code)
            if paper_pair not in papers_by_year_group[(roc_year, group)]:
                papers_by_year_group[(roc_year, group)].append(paper_pair)

    paper_meta: dict[tuple[int, int, str], PaperMeta] = {}
    for (roc_year, group), pairs in papers_by_year_group.items():
        for round_index, (exam_code, paper_code) in enumerate(sorted(pairs), start=1):
            paper_meta[(roc_year, round_index, group)] = PaperMeta(
                roc_year=roc_year,
                round_no=round_index,
                group=group,
                exam_code=exam_code,
                paper_code=paper_code,
            )

    for key, questions in paper_questions.items():
        paper_questions[key] = sorted(questions, key=lambda question: question.question_no)

    return by_question, paper_meta, paper_questions


def iter_question_source_objects(value: Any):
    if isinstance(value, list):
        for item in value:
            yield from iter_question_source_objects(item)
    elif isinstance(value, dict):
        if "id" in value and "stem" in value:
            yield value
        for nested in value.values():
            if isinstance(nested, (list, dict)):
                yield from iter_question_source_objects(nested)


def load_question_stems() -> dict[str, str]:
    stems: dict[str, str] = {}
    for path in (ROOT / "data" / "sources").glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for question in iter_question_source_objects(payload):
            question_id = str(question.get("id") or "").strip()
            stem = str(question.get("stem") or "").strip()
            if question_id and stem:
                stems.setdefault(question_id, normalize_text(stem))
                stems.setdefault(question_id.replace("_", "-"), normalize_text(stem))
    return stems


def hydrate_paper_questions(
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    stems: dict[str, str],
) -> dict[tuple[str, str], list[PaperQuestion]]:
    hydrated: dict[tuple[str, str], list[PaperQuestion]] = {}
    for key, questions in paper_questions.items():
        hydrated[key] = [
            PaperQuestion(
                question_no=question.question_no,
                question_id=question.question_id,
                stem=stems.get(question.question_id, ""),
            )
            for question in questions
        ]
    return hydrated


def parse_file_meta(path: Path, paper_meta: dict[tuple[int, int, str], PaperMeta]) -> PaperMeta | None:
    name = path.name
    compact_name = re.sub(r"\s+", "", name)
    fixed_name_meta = {
        "1-1_醫學一總檔.pdf": (113, 2, "醫學（一）"),
        "2-1_醫學二總檔.pdf": (113, 2, "醫學（二）"),
    }
    if compact_name in fixed_name_meta:
        return paper_meta.get(fixed_name_meta[compact_name])

    match = re.search(r"(?P<roc>\d{3})\s*[-－]\s*(?P<round>[12]).*?醫學\s*[（(]?(?P<exam>[一二])", name)
    if not match:
        match = re.search(r"(?P<roc>\d{3})\s*[-－]\s*(?P<round>[12]).*?醫學(?P<exam>[一二])", name)
    if not match:
        return None

    roc_year = int(match.group("roc"))
    round_no = int(match.group("round"))
    group = f"醫學（{match.group('exam')}）"
    return paper_meta.get((roc_year, round_no, group))


PAGE_PAPER_META_RE = re.compile(
    r"(?P<roc>\d{3})\s*年\s*第?\s*(?P<round>[一二12])\s*次\s*醫師考試\s*[|｜]\s*醫師\s*[（(]\s*(?P<exam>[一二12])\s*[）)]"
)
PAGE_ROUND_TEXT_TO_NO = {"一": 1, "二": 2, "1": 1, "2": 2}
PAGE_EXAM_TEXT_TO_GROUP = {"一": "醫學（一）", "二": "醫學（二）", "1": "醫學（一）", "2": "醫學（二）"}


def page_paper_meta_counts(path: Path, paper_meta: dict[tuple[int, int, str], PaperMeta]) -> Counter[tuple[int, int, str]]:
    counts: Counter[tuple[int, int, str]] = Counter()
    try:
        doc = fitz.open(path)
    except Exception:
        return counts
    try:
        for page in doc:
            text = page.get_text("text") or ""
            match = PAGE_PAPER_META_RE.search(text)
            if not match:
                continue
            round_no = PAGE_ROUND_TEXT_TO_NO.get(match.group("round"))
            group = PAGE_EXAM_TEXT_TO_GROUP.get(match.group("exam"))
            if not round_no or not group:
                continue
            key = (int(match.group("roc")), round_no, group)
            if key in paper_meta:
                counts[key] += 1
    finally:
        doc.close()
    return counts


def has_conflicting_page_metas(path: Path, paper_meta: dict[tuple[int, int, str], PaperMeta]) -> tuple[bool, dict[str, int]]:
    counts = page_paper_meta_counts(path, paper_meta)
    significant = {key: count for key, count in counts.items() if count >= 2}
    summary = {f"{key[0]}-{key[1]}-{key[2]}": count for key, count in sorted(counts.items())}
    return len(significant) >= 2, summary


def text_from_block(block: dict[str, Any]) -> str:
    return "".join(
        span.get("text", "")
        for line in block.get("lines", [])
        for span in line.get("spans", [])
    )


QUESTION_SPLIT_RE = re.compile(
    r"(?=(?:醫學\s*[（(]?[一二][）)]?\s*(?:[^0-9]{0,40})?)?"
    r"(?:(?:撰寫|筆者)\s*[:：]?\s*[^\s]+\s*)?"
    r"(?<!\d)0?(?:100|[1-9][0-9]?)(?!\d)[.．]?\s*"
    r"題目[:：]?)"
)


def split_multi_question_text(text: str) -> list[str]:
    starts = [match.start() for match in QUESTION_SPLIT_RE.finditer(text)]
    starts = [position for position in starts if position > 0]
    if not starts:
        return [text]

    chunks: list[str] = []
    cursor = 0
    for position in starts:
        chunk = normalize_text(text[cursor:position])
        if chunk:
            chunks.append(chunk)
        cursor = position
    tail = normalize_text(text[cursor:])
    if tail:
        chunks.append(tail)
    return chunks


def write_image_asset(
    path: Path,
    page_index: int,
    block_index: int,
    block: dict[str, Any],
    image_output_dir: Path | None,
) -> str:
    if not image_output_dir:
        return ""
    image_bytes = block.get("image")
    if not isinstance(image_bytes, bytes) or not image_bytes:
        return ""
    ext = str(block.get("ext") or "png").lower().replace("jpeg", "jpg")
    digest = hashlib.sha1(image_bytes).hexdigest()[:12]
    source_dir = image_output_dir / safe_cache_name(path)
    source_dir.mkdir(parents=True, exist_ok=True)
    filename = f"p{page_index:04d}-b{block_index:03d}-{digest}.{ext}"
    output_path = source_dir / filename
    if not output_path.exists():
        output_path.write_bytes(image_bytes)
    return f"assets/{source_dir.name}/{filename}"


def write_page_clip_asset(
    path: Path,
    page: fitz.Page,
    page_index: int,
    label: str,
    bbox: list[float],
    image_output_dir: Path | None,
) -> tuple[str, int, int]:
    if not image_output_dir or len(bbox) != 4:
        return "", 0, 0
    page_rect = page.rect
    rect = fitz.Rect(*bbox)
    rect = fitz.Rect(
        max(page_rect.x0, rect.x0),
        max(page_rect.y0, rect.y0),
        min(page_rect.x1, rect.x1),
        min(page_rect.y1, rect.y1),
    )
    if rect.is_empty or rect.width < 40 or rect.height < 24:
        return "", 0, 0
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
    image_bytes = pixmap.tobytes("png")
    digest = hashlib.sha1(image_bytes).hexdigest()[:12]
    source_dir = image_output_dir / safe_cache_name(path)
    source_dir.mkdir(parents=True, exist_ok=True)
    filename = f"p{page_index:04d}-{label}-{digest}.png"
    output_path = source_dir / filename
    if not output_path.exists():
        output_path.write_bytes(image_bytes)
    return f"assets/{source_dir.name}/{filename}", pixmap.width, pixmap.height


def extract_items(
    path: Path,
    page_start: int | None = None,
    page_end: int | None = None,
    image_output_dir: Path | None = None,
    detect_tables: bool = False,
) -> list[dict[str, Any]]:
    doc = fitz.open(path)
    items: list[dict[str, Any]] = []
    start = max(1, page_start or 1)
    end = min(doc.page_count, page_end or doc.page_count)
    for page_index in range(start, end + 1):
        page = doc[page_index - 1]
        page_items: list[dict[str, Any]] = []
        tables = []
        if image_output_dir and detect_tables:
            try:
                tables = page.find_tables().tables
            except Exception:
                tables = []
        for table_index, table in enumerate(tables):
            bbox = [round(float(value), 2) for value in table.bbox]
            if len(bbox) != 4 or (bbox[2] - bbox[0] < 80) or (bbox[3] - bbox[1] < 32):
                continue
            src, width, height = write_page_clip_asset(
                path,
                page,
                page_index,
                f"table-{table_index:03d}",
                bbox,
                image_output_dir,
            )
            try:
                rows = table.extract()
            except Exception:
                rows = []
            page_items.append({
                "type": "table",
                "page": page_index,
                "block": -1000 + table_index,
                "split": 0,
                "bbox": bbox,
                "src": src,
                "width": width,
                "height": height,
                "rows": rows,
            })
        for block_index, block in enumerate(page.get_text("dict").get("blocks", [])):
            bbox = [round(float(value), 2) for value in block.get("bbox", [])]
            if block.get("type") == 0:
                text = normalize_text(text_from_block(block))
                if not text:
                    continue
                for split_index, split_text in enumerate(split_multi_question_text(text)):
                    page_items.append({
                        "type": "text",
                        "page": page_index,
                        "block": block_index,
                        "split": split_index,
                        "bbox": bbox,
                        "text": split_text,
                    })
            elif block.get("type") == 1:
                width = int(block.get("width") or 0)
                height = int(block.get("height") or 0)
                # Ignore tiny header/footer decorative images.
                if width < 80 or height < 40:
                    continue
                page_items.append({
                    "type": "image",
                    "page": page_index,
                    "block": block_index,
                    "bbox": bbox,
                    "src": write_image_asset(path, page_index, block_index, block, image_output_dir),
                    "width": width,
                    "height": height,
                    "ext": block.get("ext") or "png",
                })
        page_items.sort(key=lambda item: (
            float(item.get("bbox", [0, 0, 0, 0])[1]) if item.get("bbox") else 0,
            float(item.get("bbox", [0, 0, 0, 0])[0]) if item.get("bbox") else 0,
            0 if item["type"] == "text" else 1,
            int(item.get("block") or 0),
        ))
        items.extend(page_items)
    return items


def ngrams(value: str, size: int = 3) -> set[str]:
    if not value:
        return set()
    if len(value) <= size:
        return {value}
    return {value[index : index + size] for index in range(len(value) - size + 1)}


def similarity_score(extracted_stem: str, expected_stem: str) -> float:
    extracted = normalize_for_match(extracted_stem)
    expected = normalize_for_match(expected_stem)
    if not extracted or not expected:
        return 0.0

    # Most extraction errors happen at the section boundary, so compare the
    # opening heavily while still keeping a full-string overlap guard.
    extracted_head = extracted[:260]
    expected_head = expected[:260]
    sequence = SequenceMatcher(None, expected_head, extracted_head).ratio()

    extracted_grams = ngrams(extracted_head)
    expected_grams = ngrams(expected_head)
    overlap = 0.0
    if extracted_grams and expected_grams:
        overlap = len(extracted_grams & expected_grams) / max(len(expected_grams), 1)

    containment = 0.0
    shortest = min(len(extracted_head), len(expected_head))
    if shortest >= 18 and (expected_head[:shortest] in extracted_head or extracted_head[:shortest] in expected_head):
        containment = 0.86

    return max(sequence, overlap, containment)


def best_paper_match(
    extracted_stem: str,
    questions: list[PaperQuestion],
    extracted_qno: int | None,
) -> tuple[PaperQuestion | None, float, float, int | None]:
    best: tuple[PaperQuestion | None, float, float, int | None] = (None, 0.0, 0.0, None)
    for question in questions:
        base_score = similarity_score(extracted_stem, question.stem)
        qno_bonus = 0.035 if extracted_qno == question.question_no else 0.0
        score = min(base_score + qno_bonus, 1.0)
        if score > best[1]:
            best = (question, score, base_score, question.question_no)
    return best


def classify_match(
    matched_question: PaperQuestion | None,
    score: float,
    base_score: float,
    extracted_qno: int | None,
    parsed: dict[str, Any],
) -> tuple[str, str]:
    if not matched_question:
        return "missing_question", "no_question_id"
    if score >= 0.5 or (extracted_qno == matched_question.question_no and base_score >= 0.34):
        return "matched", "stem_similarity"

    # Some Yangming PDFs split the question stem away from the answer/detail
    # blocks. If the file section is already tied to a specific paper and the
    # extracted question number lands on the same local question number, answer
    # or detail content is enough for a safe positional match. Empty shells stay
    # low confidence so they can still be audited.
    body_len = len(str(parsed.get("body") or ""))
    has_answer = bool(str(parsed.get("answer_snapshot") or "").strip())
    if extracted_qno == matched_question.question_no and (has_answer or body_len >= 80):
        return "matched", "exact_question_number"

    return "low_confidence", "low_similarity"


def is_cover_or_footer(text: str) -> bool:
    return bool(
        re.fullmatch(r"\d+", text)
        or "國立陽明交通大學醫學系" in text
        or re.search(r"\d{3}\s*年第[一二]次醫師考試", text)
        or text.startswith("此表格寬度")
    )


def find_table_starts(items: list[dict[str, Any]]) -> list[tuple[int, int]]:
    def append_start(index: int, qno: int):
        if not (1 <= qno <= 100):
            return
        if starts and starts[-1][0] == index:
            return
        starts.append((index, qno))

    starts: list[tuple[int, int]] = []
    for index, item in enumerate(items):
        if item["type"] != "text":
            continue
        text = item["text"]
        match = re.search(r"(?:^|\s)題號\s*([0-9]{1,3})(?:\D|$)", item["text"])
        if match:
            append_start(index, int(match.group(1)))
            continue

        numbered_header = re.search(r"(?:^|\s)第\s*0?([0-9]{1,3})\s*題(?:\s|$)", text)
        if numbered_header:
            append_start(index, int(numbered_header.group(1)))
            continue

        writer_prefixed = re.search(
            r"(?:撰寫|校稿|筆者)\s*[:：]?\s*[^\s]+\s+0?([0-9]{1,3})(?!\d)\s*[.、．]?\s*(?=\D)",
            text[:180],
        )
        if writer_prefixed:
            append_start(index, int(writer_prefixed.group(1)))
            continue

        question_label_prefixed = re.match(r"^0?([0-9]{1,3})[.、．]?\s*(?:題目|題目[:：])\s*", text)
        if question_label_prefixed:
            append_start(index, int(question_label_prefixed.group(1)))
            continue

        category_prefixed = re.match(r"^0?([0-9]{1,3})(?!\d)\s+類別\s+", text)
        if category_prefixed:
            append_start(index, int(category_prefixed.group(1)))
            continue

        author_after_qno = re.match(r"^0?([0-9]{1,3})(?!\d)\s+(?:撰寫人|撰寫|審稿人|審稿)\s*[:：]?", text)
        if author_after_qno:
            append_start(index, int(author_after_qno.group(1)))
            continue

        subject_prefixed = re.search(
            r"^(?:醫學\s*[（(]?[一二][）)]?.{0,90}?|.{0,40}?(?:撰寫|筆者|製稿|校稿).{0,70}?)"
            r"\s0?([0-9]{1,3})(?!\d)\s*[.、．]?\s*(?=\D)",
            text[:180],
        )
        if subject_prefixed and any(marker in text[:220] for marker in ["撰寫", "筆者", "製稿", "校稿", "Ans", "答案", "下列", "有關", "何者"]):
            append_start(index, int(subject_prefixed.group(1)))
            continue

        embedded_question_label = re.search(
            r"(?<!\d)0?([1-9][0-9]?|100)(?!\d)[.、．]?\s*(?:題目[:：]?|下列|有關|關於)",
            text[:140],
        )
        if embedded_question_label and (
            "醫學" in text[:80]
            or "題目" in text[:140]
            or any(marker in text[:140] for marker in ["下列", "有關", "關於"])
        ):
            append_start(index, int(embedded_question_label.group(1)))
            continue

        if text == "題號":
            for next_item in items[index + 1 : index + 5]:
                if next_item["type"] == "text" and re.fullmatch(r"[0-9]{1,3}", next_item["text"]):
                    append_start(index, int(next_item["text"]))
                    break
            continue

        standalone_question_no = re.fullmatch(r"0?([0-9]{1,3})[.．]?", text)
        if standalone_question_no:
            nearby_tokens = [
                next_item["text"]
                for next_item in items[index + 1 : index + 8]
                if next_item["type"] == "text"
            ]
            nearby_compact = "".join(nearby_tokens)
            if nearby_compact.startswith("題目") or nearby_compact.startswith(".題目") or nearby_compact.startswith("．題目"):
                append_start(index, int(standalone_question_no.group(1)))
            continue

        legacy_match = re.match(r"^([0-9]{1,3})[.、．]?\s*(\D.+)", text)
        option_count = len(re.findall(r"(?:[A-D][.．、]|\([A-D]\))", text))
        if legacy_match and option_count >= 3:
            append_start(index, int(legacy_match.group(1)))
            continue

        if legacy_match:
            nearby_tokens = [
                next_item["text"]
                for next_item in items[index : index + 10]
                if next_item["type"] == "text"
            ]
            nearby_compact = " ".join(nearby_tokens)
            nearby_option_count = len(re.findall(r"(?:[A-D][.．、]|\([A-D]\))", nearby_compact))
        if legacy_match and nearby_option_count >= 3:
            append_start(index, int(legacy_match.group(1)))
            continue
        if legacy_match and (
            any(marker in text for marker in ["下列", "有關", "何者", "哪一", "何種"])
            or any(marker in text for marker in ["筆者", "撰寫", "校稿", "科目"])
            or (nearby_option_count >= 2 and any(marker in nearby_compact for marker in ["答案", "解答", "詳解", "ANS", "Ans"]))
        ):
            qno = int(legacy_match.group(1))
            append_start(index, qno)
    return starts


def split_inline_markers(text: str) -> list[tuple[str, str]]:
    markers = [
        ("stem", "題幹"),
        ("stem", "題目"),
        ("answer", "公告答案"),
        ("answer", "答案"),
        ("answer", "解答"),
        ("answer", "Ans"),
        ("brief", "簡解"),
        ("detail", "詳解"),
        ("key", "KEY"),
        ("key", "Key"),
        ("supplement", "補充"),
        ("reference", "參考資料"),
        ("reference", "參考資料"),
        ("reference", "出處"),
        ("author", "解題者"),
    ]
    pattern = "|".join(re.escape(label) for _, label in markers)
    parts = re.split(f"({pattern})", text)
    result: list[tuple[str, str]] = []
    current_kind = "text"
    marker_map = {label: kind for kind, label in markers}
    for part in parts:
        if not part:
            continue
        if part in marker_map:
            current_kind = marker_map[part]
            if part == "KEY":
                result.append(("key", "KEY"))
            continue
        result.append((current_kind, part))
    return result


def add_section(sections: list[dict[str, Any]], kind: str, label: str, text: str | None = None):
    if text is not None:
        text = normalize_text(text)
        if not text:
            return
    if sections and sections[-1].get("kind") == kind and sections[-1].get("label") == label and text:
        sections[-1]["text"] = normalize_text(f"{sections[-1].get('text', '')}\n{text}")
        return
    section: dict[str, Any] = {"kind": kind, "label": label}
    if text:
        section["text"] = text
    sections.append(section)


def trim_at_next_question_boundary(text: str, qno: int | None) -> tuple[str, bool]:
    if not qno or qno >= 100:
        return text, False
    next_qno = qno + 1
    match = re.search(
        rf"(?<!\d){next_qno}\s+(?=(?:下列|下列|有關|關於|何者|哪一|何種|第一型|[A-Za-z][A-Za-z ]{{2,}}|[\u4e00-\u9fff]{{2,}}))",
        text,
    )
    if not match:
        return text, False

    tail = text[match.start(): match.start() + 280]
    looks_like_question = (
        len(re.findall(r"(?:\([A-D]\)|[A-D][.．、])", tail)) >= 2
        or any(marker in tail for marker in ["下列", "下列", "有關", "關於", "何者", "哪一", "何種", "錯誤", "病人"])
    )
    if not looks_like_question:
        return text, False
    return normalize_text(text[:match.start()]), True


def detect_asset_question_no(item: dict[str, Any]) -> int | None:
    rows = item.get("rows") if isinstance(item.get("rows"), list) else []
    for row in rows:
        cells = [str(cell or "") for cell in row] if isinstance(row, list) else []
        label_indexes = [
            index
            for index, cell in enumerate(cells)
            if re.search(r"題\s*號|題號", cell)
        ]
        for label_index in label_indexes:
            for cell in cells[label_index + 1: label_index + 8]:
                match = re.search(r"\b0*(\d{1,3})\b", cell)
                if match:
                    return int(match.group(1))

    combined_rows = " ".join(
        str(cell or "")
        for row in rows
        if isinstance(row, list)
        for cell in row
    )
    inline_match = re.search(r"題\s*號\s*0*(\d{1,3})", combined_rows)
    return int(inline_match.group(1)) if inline_match else None


def chunk_page_regions(chunk: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return coarse per-page regions for the parsed question chunk.

    These regions are used to keep an original screenshot for each matched
    explanation. The OCR/text parse is useful for search, but the screenshot is
    the source of truth when tables, images, or line breaks are imperfect.
    """
    by_page: dict[int, list[float]] = {}
    for item in chunk:
        page = item.get("page")
        bbox = item.get("bbox")
        if not isinstance(page, int) or not isinstance(bbox, list) or len(bbox) != 4:
            continue
        try:
            x0, y0, x1, y1 = (float(value) for value in bbox)
        except (TypeError, ValueError):
            continue
        if (x1 - x0) < 20 or (y1 - y0) < 8:
            continue
        current = by_page.get(page)
        if current:
            current[0] = min(current[0], x0)
            current[1] = min(current[1], y0)
            current[2] = max(current[2], x1)
            current[3] = max(current[3], y1)
        else:
            by_page[page] = [x0, y0, x1, y1]

    regions: list[dict[str, Any]] = []
    for page in sorted(by_page):
        x0, y0, x1, y1 = by_page[page]
        regions.append({
            "page": page,
            "bbox": [
                round(x0 - 10, 2),
                round(y0 - 10, 2),
                round(x1 + 10, 2),
                round(y1 + 10, 2),
            ],
        })
    return regions


def item_bbox(item: dict[str, Any]) -> list[float] | None:
    bbox = item.get("bbox")
    if not isinstance(bbox, list) or len(bbox) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(value) for value in bbox)
    except (TypeError, ValueError):
        return None
    if (x1 - x0) < 20 or (y1 - y0) < 8:
        return None
    return [x0, y0, x1, y1]


def chunk_boundary_page_regions(
    items: list[dict[str, Any]],
    start_index: int,
    end_index: int,
) -> list[dict[str, Any]]:
    """Capture the original PDF span from question N to before question N+1.

    Text/table extraction can miss lines inside scanned or mixed-layout
    explanations. For the visual fallback, the safest source of truth is the
    geometric region between adjacent detected question starts. Wide x bounds
    are intentional; write_page_clip_asset clamps them to the actual page.
    """
    if start_index < 0 or start_index >= len(items):
        return []

    chunk = items[start_index:end_index]
    if not chunk:
        return []

    page_numbers = sorted({
        item.get("page")
        for item in chunk
        if isinstance(item.get("page"), int)
    })
    if not page_numbers:
        return []

    start_item = items[start_index]
    start_page = start_item.get("page")
    start_box = item_bbox(start_item)
    next_item = items[end_index] if end_index < len(items) else None
    next_page = next_item.get("page") if isinstance(next_item, dict) else None
    next_box = item_bbox(next_item) if isinstance(next_item, dict) else None

    regions: list[dict[str, Any]] = []
    for page in page_numbers:
        page_items = [item for item in chunk if item.get("page") == page and item_bbox(item)]
        if not page_items:
            continue
        valid_boxes = [bbox for bbox in (item_bbox(item) for item in page_items) if bbox]
        if not valid_boxes:
            continue

        top = min(bbox[1] for bbox in valid_boxes)
        bottom = max(bbox[3] for bbox in valid_boxes)

        if page == start_page and start_box:
            top = start_box[1]
        elif page != start_page:
            top = 0

        if next_box and next_page == page:
            bottom = next_box[1]
        elif next_box and isinstance(next_page, int) and page < next_page:
            bottom = 10000

        if bottom <= top:
            bottom = max(bbox[3] for bbox in valid_boxes)

        regions.append({
            "page": page,
            "bbox": [
                0,
                round(max(0, top - 8), 2),
                10000,
                round(bottom + 8, 2),
            ],
        })

    return regions


def parse_table_chunk(chunk: list[dict[str, Any]], source_label: str, fallback_qno: int | None = None) -> dict[str, Any]:
    header = next((item["text"] for item in chunk[:4] if item["type"] == "text" and "題號" in item["text"]), "")
    q_match = re.search(r"題號\s*([0-9]{1,3})", header)
    qno = int(q_match.group(1)) if q_match else fallback_qno

    if qno:
        trimmed_chunk: list[dict[str, Any]] = []
        for item in chunk:
            if item["type"] != "text":
                trimmed_chunk.append(item)
                continue
            trimmed_text, reached_next_question = trim_at_next_question_boundary(item["text"], qno)
            if trimmed_text:
                trimmed_item = dict(item)
                trimmed_item["text"] = trimmed_text
                trimmed_chunk.append(trimmed_item)
            if reached_next_question:
                break
        chunk = trimmed_chunk

    author = None
    reviewer = None
    header_context = " ".join(item["text"] for item in chunk[:8] if item["type"] == "text")
    new_author = re.search(r"撰寫\s*[:：]?\s*([^\s]+)\s*校稿\s*[:：]?\s*([^\s]+)", header_context)
    writer_only = re.search(r"(?:筆者|撰寫)\s*[:：]?\s*([^\s]+)", header_context)
    old_author = re.search(r"製稿\s*(.*?)審稿\s*(.*?)(?:題目|題幹|$)", header_context)
    subject_author = re.search(
        r"第\s*0?\d+\s*題\s*(?:解剖|生理|生化|組織|胚胎|微生物|免疫|藥理|病理|公衛|公共衛生|寄生蟲)\s*([^\s]+)",
        header_context,
    )
    if new_author:
        author = new_author.group(1).strip()
        reviewer = new_author.group(2).strip()
    elif old_author:
        author = normalize_text(old_author.group(1))
        reviewer = normalize_text(old_author.group(2))
    elif writer_only:
        author = writer_only.group(1).strip()
    elif subject_author:
        author = subject_author.group(1).strip()

    sections: list[dict[str, Any]] = []
    assets: list[dict[str, Any]] = []
    current_kind = "text"
    current_label = "詳解"
    stem_parts: list[str] = []
    answer = ""
    body_parts: list[str] = []

    def is_questionish(value: str) -> bool:
        return any(marker in value for marker in ["下列", "有關", "何者", "哪一", "何種", "最可能", "最不"])

    def append_marked(kind: str, label: str, value: str):
        nonlocal answer, current_kind, current_label
        value = normalize_text(value)
        if not value:
            current_kind, current_label = kind, label
            return
        current_kind, current_label = kind, label
        if kind == "stem":
            stem_parts.append(strip_prompt_noise(value))
        elif kind == "answer":
            answer = normalize_text(re.sub(r"^[:：]?\s*", "", value))
        elif kind in {"brief", "detail", "key", "supplement", "reference"}:
            add_section(sections, kind, label, value)
            body_parts.append(value)

    marker_labels = ["Ans", "答案", "解答", "公告答案", "Key", "KEY", "簡解", "簡答", "詳解", "補充", "Ref", "參考資料", "參考資料", "出處"]

    for item_index, item in enumerate(chunk):
        if item["type"] in {"image", "table"}:
            asset_qno = detect_asset_question_no(item)
            if qno and asset_qno and asset_qno != qno:
                continue
            asset_label = "表格" if item["type"] == "table" else "圖片"
            assets.append({
                "src": item.get("src") or "",
                "alt": f"{source_label} 第 {qno or '?'} 題{asset_label}",
                "width": item["width"],
                "height": item["height"],
                "page": item["page"],
                "bbox": item["bbox"],
                "kind": item["type"],
                "rows": item.get("rows") or [],
            })
            sections.append({
                "kind": "image",
                "label": asset_label if item["type"] == "table" else current_label,
                "assetIndex": len(assets) - 1,
                "page": item["page"],
            })
            continue

        text = item["text"]
        if is_cover_or_footer(text) or text == header:
            continue
        if qno and re.fullmatch(str(qno), text):
            continue
        if any(label in text for label in marker_labels):
            segments = split_inline_markers(text)
            if len(segments) > 1:
                for kind, segment in segments:
                    segment = normalize_text(segment)
                    if not segment:
                        continue
                    if kind == "author":
                        continue
                    if kind == "text":
                        if qno and item_index <= 8 and not stem_parts:
                            leading_segment = re.search(
                                rf"(?:^|\s){qno}(?!\d)\s*[.、．]?\s*(\D.+)",
                                segment,
                            )
                            if leading_segment:
                                current_kind, current_label = "stem", "題幹"
                                stem_parts.append(strip_prompt_noise(leading_segment.group(1)))
                                continue
                        if current_kind == "stem" or (not answer and not sections and (stem_parts or is_questionish(segment))):
                            stem_parts.append(strip_prompt_noise(segment))
                        continue
                    label = {
                        "stem": "題幹",
                        "answer": "答案",
                        "brief": "簡解",
                        "detail": "詳解",
                        "key": "KEY",
                        "supplement": "補充",
                        "reference": "參考資料",
                    }[kind]
                    append_marked(kind, label, segment)
                continue

        leading_question = re.match(rf"^{qno}[.、．]?\s*(\D.+)", text) if qno else None
        if not leading_question and qno and item_index <= 8 and not stem_parts:
            leading_question = re.search(rf"(?:^|\s){qno}(?!\d)\s*[.、．]?\s*(\D.+)", text)
        if leading_question:
            current_kind, current_label = "stem", "題幹"
            stem_parts.append(strip_prompt_noise(leading_question.group(1)))
            continue
        if text in {"題幹", "題目"}:
            current_kind, current_label = "stem", "題幹"
            continue
        if text.startswith("題幹") or text.startswith("題目"):
            current_kind, current_label = "stem", "題幹"
            stem_parts.append(strip_prompt_noise(text))
            continue
        if text.startswith("答案") or text.startswith("解答") or text.startswith("Ans") or text.startswith("公告答案"):
            answer = normalize_text(re.sub(r"^(答案|解答|Ans|公告答案)\s*[:：]?\s*", "", text))
            current_kind, current_label = "answer", "答案"
            continue
        if text == "簡解" or text.startswith("簡解") or text == "簡答" or text.startswith("簡答"):
            current_kind, current_label = "brief", "簡解"
            tail = normalize_text(re.sub(r"^(簡解|簡答)\s*[:：]?\s*", "", text))
            if tail:
                add_section(sections, current_kind, current_label, tail)
                body_parts.append(tail)
            continue
        if text == "詳解" or text.startswith("詳解") or text.startswith("Key") or text.startswith("KEY"):
            current_kind, current_label = ("key", "KEY") if text.lower().startswith("key") else ("detail", "詳解")
            tail = normalize_text(re.sub(r"^(詳解|Key|KEY)\s*[:：]?\s*", "", text))
            if tail:
                if tail == "KEY":
                    current_kind, current_label = "key", "KEY"
                else:
                    add_section(sections, current_kind, current_label, tail)
                    body_parts.append(tail)
            continue
        if text == "補充" or text.startswith("補充"):
            current_kind, current_label = "supplement", "補充"
            tail = normalize_text(text.replace("補充", "", 1))
            if tail:
                add_section(sections, current_kind, current_label, tail)
                body_parts.append(tail)
            continue
        if text.startswith("Ref") or text.startswith("參考資料") or text.startswith("參考資料") or text.startswith("出處"):
            current_kind, current_label = "reference", "參考資料"
            tail = normalize_text(re.sub(r"^(Ref|參考資料|參考資料|出處)\s*[:：]?\s*", "", text))
            if tail:
                add_section(sections, current_kind, current_label, tail)
                body_parts.append(tail)
            continue

        if current_kind == "text" and not answer and not sections and (stem_parts or is_questionish(text)):
            current_kind, current_label = "stem", "題幹"
            stem_parts.append(strip_prompt_noise(text))
        elif current_kind == "stem":
            stem_parts.append(text)
        elif current_kind in {"brief", "detail", "key", "supplement"}:
            add_section(sections, current_kind, current_label, text)
            body_parts.append(text)

    return {
        "question_no": qno,
        "author": author,
        "reviewer": reviewer,
        "question_stem_snapshot": strip_prompt_noise(" ".join(stem_parts)),
        "answer_snapshot": answer,
        "sections": sections,
        "assets": assets,
        "body": normalize_text("\n".join(body_parts)),
        "source_page_start": chunk[0]["page"] if chunk else None,
        "source_page_end": chunk[-1]["page"] if chunk else None,
        "source_page_regions": chunk_page_regions(chunk),
    }


def parse_items_for_meta(
    items: list[dict[str, Any]],
    source_file: str,
    meta: PaperMeta,
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    source_label: str | None = None,
) -> list[dict[str, Any]]:
    starts = find_table_starts(items)
    raw_rows: list[dict[str, Any]] = []
    source_label = source_label or f"{meta.roc_year} 年第 {meta.round_no} 次 {meta.group}"
    expected_questions = paper_questions.get((meta.exam_code, meta.paper_code), [])
    for start_index, (item_index, qno) in enumerate(starts):
        end = starts[start_index + 1][0] if start_index + 1 < len(starts) else len(items)
        chunk = items[item_index:end]
        boundary_regions = chunk_boundary_page_regions(items, item_index, end)
        parsed = parse_table_chunk(chunk, source_label, qno)
        if boundary_regions:
            parsed["source_page_regions"] = boundary_regions
        extracted_qno = int(parsed["question_no"] or qno or 0) or None
        extracted_stem = parsed["question_stem_snapshot"]
        matched_question, score, base_score, matched_qno = best_paper_match(extracted_stem, expected_questions, extracted_qno)
        status, match_strategy = classify_match(matched_question, score, base_score, extracted_qno, parsed)
        raw_rows.append({
            "question_id": matched_question.question_id if matched_question else None,
            "match_status": status,
            "match_strategy": match_strategy,
            "match_score": round(score, 3),
            "base_match_score": round(base_score, 3),
            "extracted_question_no": extracted_qno,
            "matched_question_no": matched_qno,
            "source_file": source_file,
            "source_label": source_label,
            "exam_code": meta.exam_code,
            "paper_code": meta.paper_code,
            **parsed,
        })

    best_by_question_id: dict[str, dict[str, Any]] = {}
    unmatched_rows: list[dict[str, Any]] = []
    for row in raw_rows:
        question_id = str(row.get("question_id") or "")
        if not question_id:
            unmatched_rows.append(row)
            continue
        current = best_by_question_id.get(question_id)
        if not current:
            best_by_question_id[question_id] = row
            continue
        current_score = float(current.get("match_score") or 0)
        row_score = float(row.get("match_score") or 0)
        current_body_len = len(str(current.get("body") or ""))
        row_body_len = len(str(row.get("body") or ""))
        current_stem_len = len(str(current.get("question_stem_snapshot") or ""))
        row_stem_len = len(str(row.get("question_stem_snapshot") or ""))
        if (row_score, row_stem_len, row_body_len) > (current_score, current_stem_len, current_body_len):
            best_by_question_id[question_id] = row

    rows = sorted(best_by_question_id.values(), key=lambda row: int(row.get("matched_question_no") or 0))
    for row in rows:
        question_id = row.get("question_id")
        row["question_no"] = row.get("matched_question_no")
        row["raw_candidate_count"] = len([candidate for candidate in raw_rows if candidate.get("question_id") == question_id])
        row["duplicate_candidate_count"] = max(0, row["raw_candidate_count"] - 1)
    rows.extend(unmatched_rows)
    return rows


def parse_table_pdf(
    path: Path,
    meta: PaperMeta,
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    image_output_dir: Path | None = None,
    detect_tables: bool = False,
) -> list[dict[str, Any]]:
    return parse_items_for_meta(
        extract_items(path, image_output_dir=image_output_dir, detect_tables=detect_tables),
        path.name,
        meta,
        paper_questions,
    )


def safe_cache_name(path: Path) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", path.stem).strip("_") or "pdf"
    digest = hashlib.sha1(path.name.encode("utf-8")).hexdigest()[:10]
    return f"{safe}-{digest}"


def ocr_pdf_pages(path: Path, cache_dir: Path) -> list[str]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{safe_cache_name(path)}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))
    if not PDFTOPPM.exists() or not TESSERACT.exists():
        return []

    doc = fitz.open(path)
    page_texts: list[str] = []
    with tempfile.TemporaryDirectory(prefix="yangming-ocr-") as temp_dir:
        temp_path = Path(temp_dir)
        for page_no in range(1, doc.page_count + 1):
            prefix = temp_path / f"page-{page_no:03d}"
            subprocess.run(
                [
                    str(PDFTOPPM),
                    "-f",
                    str(page_no),
                    "-l",
                    str(page_no),
                    "-r",
                    "200",
                    "-png",
                    str(path),
                    str(prefix),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            images = sorted(temp_path.glob(f"page-{page_no:03d}-*.png"))
            if not images:
                page_texts.append("")
                continue
            completed = subprocess.run(
                [
                    str(TESSERACT),
                    str(images[0]),
                    "stdout",
                    "-l",
                    "chi_tra+eng",
                    "--psm",
                    "6",
                ],
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
            )
            page_texts.append(normalize_text(completed.stdout or ""))
    cache_path.write_text(json.dumps(page_texts, ensure_ascii=False, indent=2), encoding="utf-8")
    return page_texts


def monotonic_starts(starts: list[tuple[int, int]]) -> list[tuple[int, int]]:
    filtered: list[tuple[int, int]] = []
    next_qno = 1
    for item_index, qno in starts:
        if qno < next_qno:
            continue
        if qno > 100:
            continue
        filtered.append((item_index, qno))
        next_qno = qno + 1
    return filtered


def split_ocr_question_chunks(
    page_texts: list[str],
    guided_starts: list[tuple[int, int, int]] | None = None,
) -> list[list[dict[str, Any]]]:
    if guided_starts:
        chunks: list[list[dict[str, Any]]] = []
        starts_by_page: dict[int, list[tuple[int, int]]] = {}
        for page, item_index, qno in guided_starts:
            starts_by_page.setdefault(page, []).append((item_index, qno))

        def add_chunk(page: int, qno: int, text: str):
            text = normalize_text(text)
            if not text:
                return
            chunks.append([{
                "type": "text",
                "page": page,
                "block": 0,
                "split": 0,
                "bbox": [],
                "text": f"{qno}. {text}",
            }])

        for page in sorted(starts_by_page):
            starts = sorted(starts_by_page[page])
            qnos = [qno for _item_index, qno in starts]
            text = normalize_text(page_texts[page - 1] if page - 1 < len(page_texts) else "")
            if not text:
                continue

            # OCR fallback text is page-level, while the vector PDF often has
            # several questions on one page. Split repeated 題目/題幹 markers on
            # the same page and assign them back to the guided question numbers
            # by order. This prevents page 49/50/51 style duplicates from all
            # inheriting the first question on that page.
            marker_positions = [match.start() for match in OCR_QUESTION_MARKER_RE.finditer(text)]
            if len(marker_positions) >= len(qnos):
                for index, qno in enumerate(qnos):
                    start = marker_positions[index]
                    end = marker_positions[index + 1] if index + 1 < len(marker_positions) else len(text)
                    add_chunk(page, qno, text[start:end])
                continue

            if len(qnos) == 1:
                marker = OCR_QUESTION_MARKER_RE.search(text)
                if marker:
                    text = text[marker.start():]
                add_chunk(page, qnos[0], text)
                continue

            # If OCR dropped some markers, keep the first safely split question
            # and leave the rest as auditable low-confidence rows instead of
            # duplicating the whole page across all question numbers.
            if marker_positions:
                add_chunk(page, qnos[0], text[marker_positions[0]:])
            for qno in qnos[1:]:
                add_chunk(page, qno, "")
        return chunks

    chunks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_qno = 0

    def append_text(page: int, text: str):
        text = normalize_text(text)
        if not text:
            return
        current.append({
            "type": "text",
            "page": page,
            "block": 0,
            "split": 0,
            "bbox": [],
            "text": text,
        })

    for page_index, raw_text in enumerate(page_texts, start=1):
        text = normalize_text(raw_text)
        if not text:
            continue
        starts = [match.start() for match in OCR_QUESTION_MARKER_RE.finditer(text)]
        if not starts:
            if current:
                append_text(page_index, text)
            continue

        cursor = 0
        for start in starts:
            before = text[cursor:start]
            if before and current:
                append_text(page_index, before)
            if current:
                chunks.append(current)
            current_qno += 1
            current = [{
                "type": "text",
                "page": page_index,
                "block": 0,
                "split": 0,
                "bbox": [],
                "text": f"{current_qno}. {text[start:]}",
            }]
            cursor = len(text)
        tail = text[cursor:]
        if tail and current:
            append_text(page_index, tail)
    if current:
        chunks.append(current)
    return chunks


def parse_ocr_pdf(
    path: Path,
    meta: PaperMeta,
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    cache_dir: Path,
) -> list[dict[str, Any]]:
    page_texts = ocr_pdf_pages(path, cache_dir)
    if not page_texts:
        return []
    raw_items = extract_items(path)
    guided_starts = [
        (raw_items[item_index]["page"], item_index, qno)
        for item_index, qno in monotonic_starts(find_table_starts(raw_items))
        if raw_items[item_index]["type"] == "text"
    ]
    expected_questions = paper_questions.get((meta.exam_code, meta.paper_code), [])
    rows: list[dict[str, Any]] = []
    source_label = f"{meta.roc_year} 年第 {meta.round_no} 次 {meta.group}（OCR 補洞）"
    source_file = f"{path.name} :: OCR"
    chunks = split_ocr_question_chunks(page_texts, guided_starts)
    for index, chunk in enumerate(chunks, start=1):
        fallback_qno = None
        qno_match = re.match(r"^([0-9]{1,3})[.、．]?", chunk[0]["text"]) if chunk else None
        if qno_match:
            fallback_qno = int(qno_match.group(1))
        parsed = parse_table_chunk(chunk, source_label, fallback_qno or index)
        extracted_qno = int(parsed["question_no"] or fallback_qno or index or 0) or None
        extracted_stem = parsed["question_stem_snapshot"]
        matched_question, score, base_score, matched_qno = best_paper_match(extracted_stem, expected_questions, extracted_qno)
        status, match_strategy = classify_match(matched_question, score, base_score, extracted_qno, parsed)
        rows.append({
            "question_id": matched_question.question_id if matched_question else None,
            "match_status": status,
            "match_strategy": match_strategy,
            "match_score": round(score, 3),
            "base_match_score": round(base_score, 3),
            "extracted_question_no": extracted_qno,
            "matched_question_no": matched_qno,
            "source_file": source_file,
            "source_label": source_label,
            "exam_code": meta.exam_code,
            "paper_code": meta.paper_code,
            **parsed,
        })
    return rows


ROUND_TEXT_TO_NO = {
    "1": 1,
    "2": 2,
    "一": 1,
    "二": 2,
}


def parse_titled_meta(title: str, paper_meta: dict[tuple[int, int, str], PaperMeta]) -> PaperMeta | None:
    match = re.search(
        r"(?P<roc>\d{3})\s*[（(]?\s*(?P<round>[一二12])\s*[）)]?.*?醫學\s*[（(]?(?P<exam>[一二])",
        title,
    )
    if not match:
        return None
    roc_year = int(match.group("roc"))
    round_no = ROUND_TEXT_TO_NO.get(match.group("round"))
    if not round_no:
        return None
    group = f"醫學（{match.group('exam')}）"
    return paper_meta.get((roc_year, round_no, group))


def parse_content_meta(
    items: list[dict[str, Any]],
    paper_meta: dict[tuple[int, int, str], PaperMeta],
    filename: str = "",
) -> PaperMeta | None:
    text = " ".join(item["text"] for item in items[:80] if item["type"] == "text")
    text = normalize_text(text)
    match = re.search(
        r"(?P<roc>\d{3})\s*年\s*第\s*(?P<round>[一二12])\s*次.*?"
        r"(?:醫師|醫學)\s*[（(]?\s*(?P<exam>[一二12])\s*[）)]?",
        text,
    )
    if not match:
        return None
    filename_group = None
    if "醫學二" in filename or "醫學(二)" in filename or "醫學（二）" in filename:
        filename_group = "二"
    elif "醫學一" in filename or "醫學(一)" in filename or "醫學（一）" in filename:
        filename_group = "一"
    exam_text = filename_group or match.group("exam")
    exam = "一" if exam_text == "1" else "二" if exam_text == "2" else exam_text
    round_no = ROUND_TEXT_TO_NO.get(match.group("round"))
    if not round_no:
        return None
    return paper_meta.get((int(match.group("roc")), round_no, f"醫學（{exam}）"))


def first_positive_page(entries: list[list[Any]], min_level: int = 1) -> int | None:
    for level, _title, page in entries:
        if level < min_level:
            continue
        if isinstance(page, int) and page > 0:
            return page
    return None


def parse_bookmark_sections(
    path: Path,
    paper_meta: dict[tuple[int, int, str], PaperMeta],
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    image_output_dir: Path | None = None,
    detect_tables: bool = False,
) -> list[tuple[PaperMeta, list[dict[str, Any]], dict[str, Any]]]:
    doc = fitz.open(path)
    toc = doc.get_toc(simple=True)
    if not toc:
        return []

    top_indices = [index for index, entry in enumerate(toc) if entry[0] == 1]
    parsed: list[tuple[PaperMeta, list[dict[str, Any]], dict[str, Any]]] = []
    for top_offset, top_index in enumerate(top_indices):
        next_top_index = top_indices[top_offset + 1] if top_offset + 1 < len(top_indices) else len(toc)
        section_entries = toc[top_index:next_top_index]
        title = str(toc[top_index][1])
        meta = parse_titled_meta(title, paper_meta)
        if not meta or meta.roc_year < 100:
            continue

        start_page = (
            first_positive_page(section_entries, min_level=3)
            or first_positive_page(section_entries, min_level=2)
            or first_positive_page(section_entries)
        )
        following_entries = toc[next_top_index:] if next_top_index < len(toc) else []
        next_start_page = (
            first_positive_page(following_entries, min_level=3)
            or first_positive_page(following_entries, min_level=2)
            or first_positive_page(following_entries)
        )
        if not start_page:
            continue
        end_page = (next_start_page - 1) if next_start_page else doc.page_count
        if end_page < start_page:
            end_page = start_page

        source_file = f"{path.name} :: {title}"
        source_label = f"{meta.roc_year} 年第 {meta.round_no} 次 {meta.group}（書籤版）"
        items = extract_items(path, start_page, end_page, image_output_dir, detect_tables)
        rows = parse_items_for_meta(items, source_file, meta, paper_questions, source_label)
        rows.extend(parse_bookmark_toc_rows(
            items,
            section_entries,
            f"{source_file} :: TOC",
            source_label,
            meta,
            paper_questions,
        ))
        parsed.append((meta, rows, {
            "file": source_file,
            "status": "parsed_bookmark_section",
            "page_start": start_page,
            "page_end": end_page,
        }))
    return parsed


def question_no_from_title(title: str) -> int | None:
    match = re.match(r"\s*0?([0-9]{1,3})(?!\d)\s*[.、．]?", normalize_text(title))
    if not match:
        return None
    qno = int(match.group(1))
    return qno if 1 <= qno <= 100 else None


def stem_from_bookmark_title(title: str) -> str:
    return strip_prompt_noise(re.sub(r"^\s*0?[0-9]{1,3}\s*[.、．]?\s*", "", normalize_text(title)))


def find_bookmark_item_index(items: list[dict[str, Any]], qno: int, title_stem: str, start_at: int = 0) -> int | None:
    title_key = normalize_for_match(title_stem)[:80]
    for index in range(start_at, len(items)):
        item = items[index]
        if item["type"] != "text":
            continue
        text = item["text"]
        text_key = normalize_for_match(text)
        if title_key and len(title_key) >= 18 and title_key in text_key:
            return index
        if re.match(rf"^\s*0?{qno}(?!\d)\s*[.、．]?\s*", text):
            return index
    return None


def parse_bookmark_toc_rows(
    items: list[dict[str, Any]],
    section_entries: list[list[Any]],
    source_file: str,
    source_label: str,
    meta: PaperMeta,
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
) -> list[dict[str, Any]]:
    toc_questions: list[dict[str, Any]] = []
    for entry in section_entries:
        level, title, page = entry
        if level != 3 or not isinstance(page, int) or page <= 0:
            continue
        qno = question_no_from_title(str(title))
        if not qno:
            continue
        toc_questions.append({
            "question_no": qno,
            "title": str(title),
            "stem": stem_from_bookmark_title(str(title)),
            "page": page,
        })
    if not toc_questions:
        return []

    expected_questions = paper_questions.get((meta.exam_code, meta.paper_code), [])
    by_qno = {question.question_no: question for question in expected_questions}
    rows: list[dict[str, Any]] = []
    last_start_index = 0
    for index, toc_question in enumerate(toc_questions):
        qno = int(toc_question["question_no"])
        start_index = find_bookmark_item_index(items, qno, str(toc_question["stem"]), last_start_index)
        if start_index is None:
            start_index = next(
                (
                    item_index
                    for item_index, item in enumerate(items)
                    if item["type"] == "text" and item.get("page") >= toc_question["page"]
                ),
                0,
            )
        next_question = toc_questions[index + 1] if index + 1 < len(toc_questions) else None
        end_index = len(items)
        if next_question:
            found_end = find_bookmark_item_index(
                items,
                int(next_question["question_no"]),
                str(next_question["stem"]),
                start_index + 1,
            )
            if found_end is not None:
                end_index = found_end
            else:
                end_index = next(
                    (
                        item_index
                        for item_index, item in enumerate(items[start_index + 1 :], start=start_index + 1)
                        if item.get("page") >= next_question["page"]
                    ),
                    len(items),
                )
        last_start_index = max(start_index, end_index - 1)
        chunk = items[start_index:end_index]
        parsed = parse_table_chunk(chunk, source_label, qno)
        if toc_question["stem"]:
            parsed["question_stem_snapshot"] = str(toc_question["stem"])
        parsed["question_no"] = qno
        matched_question = by_qno.get(qno)
        score = similarity_score(parsed["question_stem_snapshot"], matched_question.stem) if matched_question else 0.0
        base_score = score
        status, match_strategy = classify_match(matched_question, score, base_score, qno, parsed)
        rows.append({
            "question_id": matched_question.question_id if matched_question else None,
            "match_status": status,
            "match_strategy": f"bookmark_toc_{match_strategy}",
            "match_score": round(score, 3),
            "base_match_score": round(base_score, 3),
            "extracted_question_no": qno,
            "matched_question_no": qno if matched_question else None,
            "source_file": source_file,
            "source_label": source_label,
            "exam_code": meta.exam_code,
            "paper_code": meta.paper_code,
            **parsed,
        })
    return rows


def parse_content_inferred_pdf(
    path: Path,
    paper_meta: dict[tuple[int, int, str], PaperMeta],
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    image_output_dir: Path | None = None,
    detect_tables: bool = False,
) -> tuple[PaperMeta, list[dict[str, Any]]] | None:
    probe_items = extract_items(path, 1, min(12, fitz.open(path).page_count))
    meta = parse_content_meta(probe_items, paper_meta, path.name)
    if not meta:
        all_probe_items = extract_items(path)
        starts = find_table_starts(all_probe_items)
        if len(starts) >= 2:
            start_index, qno = starts[0]
            end_index = starts[1][0]
            parsed = parse_table_chunk(all_probe_items[start_index:end_index], "probe", qno)
            best_candidate: tuple[float, PaperQuestion | None, tuple[str, str] | None] = (0.0, None, None)
            for key, questions in paper_questions.items():
                matched_question, score, _base_score, _matched_qno = best_paper_match(
                    parsed["question_stem_snapshot"],
                    questions,
                    int(parsed["question_no"] or qno or 0) or None,
                )
                if matched_question and score > best_candidate[0]:
                    best_candidate = (score, matched_question, key)
            pair_meta = {
                (candidate.exam_code, candidate.paper_code): candidate
                for candidate in paper_meta.values()
            }
            if best_candidate[0] >= 0.92 and best_candidate[2]:
                meta = pair_meta.get(best_candidate[2])
    if not meta:
        return None
    source_label = f"{meta.roc_year} 年第 {meta.round_no} 次 {meta.group}（合併檔）"
    return meta, parse_items_for_meta(
        extract_items(path, image_output_dir=image_output_dir, detect_tables=detect_tables),
        path.name,
        meta,
        paper_questions,
        source_label,
    )


def row_rank(row: dict[str, Any]) -> tuple[int, int, float, int, int]:
    status_rank = {"matched": 2, "low_confidence": 1, "missing_question": 0}.get(str(row.get("match_status")), 0)
    sections = row.get("sections") if isinstance(row.get("sections"), list) else []
    assets = row.get("assets") if isinstance(row.get("assets"), list) else []
    body_len = len(str(row.get("body") or ""))
    content_score = min(body_len, 1200) + (len(sections) * 35) + (len(assets) * 160)
    toc_penalty = -500 if ":: TOC" in str(row.get("source_file") or "") and content_score < 260 else 0
    return (
        status_rank,
        content_score + toc_penalty,
        float(row.get("match_score") or 0),
        len(str(row.get("question_stem_snapshot") or "")),
        body_len,
    )


def build_source_report(
    file_name: str,
    status: str,
    meta: PaperMeta,
    rows: list[dict[str, Any]],
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    expected_questions = paper_questions.get((meta.exam_code, meta.paper_code), [])
    matched_question_nos = {
        int(row["matched_question_no"])
        for row in rows
        if row.get("match_status") == "matched" and row.get("matched_question_no")
    }
    low_confidence_question_nos = {
        int(row["matched_question_no"])
        for row in rows
        if row.get("match_status") == "low_confidence" and row.get("matched_question_no")
    }
    covered_question_nos = matched_question_nos | low_confidence_question_nos
    missing_question_nos = [
        question.question_no
        for question in expected_questions
        if question.question_no not in matched_question_nos
    ]
    uncovered_question_nos = [
        question.question_no
        for question in expected_questions
        if question.question_no not in covered_question_nos
    ]
    report = {
        "file": file_name,
        "status": status,
        "expected_paper": f"{meta.exam_code}-{meta.paper_code}",
        "expected_questions": len(expected_questions),
        "extracted": len(rows),
        "matched": sum(1 for row in rows if row["match_status"] == "matched"),
        "low_confidence": sum(1 for row in rows if row["match_status"] == "low_confidence"),
        "missing_question": sum(1 for row in rows if row["match_status"] == "missing_question"),
        "matched_question_count": len(matched_question_nos),
        "low_confidence_question_count": len(low_confidence_question_nos),
        "missing_question_count": len(missing_question_nos),
        "missing_question_nos": " ".join(str(qno) for qno in missing_question_nos),
        "uncovered_question_count": len(uncovered_question_nos),
        "uncovered_question_nos": " ".join(str(qno) for qno in uncovered_question_nos),
    }
    if extra:
        report.update(extra)
    return report


def build_consolidated(
    rows: list[dict[str, Any]],
    source_metas: dict[tuple[str, str], PaperMeta],
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    best_by_question_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        question_id = str(row.get("question_id") or "")
        if not question_id:
            continue
        current = best_by_question_id.get(question_id)
        if not current or row_rank(row) > row_rank(current):
            best_by_question_id[question_id] = row

    consolidated_rows = sorted(
        best_by_question_id.values(),
        key=lambda row: (
            str(row.get("exam_code") or ""),
            str(row.get("paper_code") or ""),
            int(row.get("matched_question_no") or 0),
        ),
    )

    consolidated_reports: list[dict[str, Any]] = []
    for key, meta in sorted(source_metas.items()):
        expected_questions = paper_questions.get(key, [])
        matched_nos: set[int] = set()
        low_nos: set[int] = set()
        for question in expected_questions:
            row = best_by_question_id.get(question.question_id)
            if not row:
                continue
            if row.get("match_status") == "matched":
                matched_nos.add(question.question_no)
            elif row.get("match_status") == "low_confidence":
                low_nos.add(question.question_no)
        safe_missing = [q.question_no for q in expected_questions if q.question_no not in matched_nos]
        uncovered = [q.question_no for q in expected_questions if q.question_no not in matched_nos and q.question_no not in low_nos]
        consolidated_reports.append({
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
    return consolidated_rows, consolidated_reports


def split_question_nos(value: Any) -> list[int]:
    return [
        int(part)
        for part in str(value or "").split()
        if part.isdigit()
    ]


def compact_preview(value: Any, limit: int = 120) -> str:
    text = normalize_text(str(value or ""))
    if len(text) <= limit:
        return text
    return f"{text[:limit - 1]}…"


def gap_issue_type(
    qno: int,
    uncovered_nos: set[int],
    candidates: list[dict[str, Any]],
) -> str:
    if qno not in uncovered_nos:
        return "low_confidence_only"
    if not candidates:
        return "no_nearby_candidate"
    if any(
        int(candidate.get("extracted_question_no") or 0) == qno
        and int(candidate.get("matched_question_no") or 0) != qno
        for candidate in candidates
    ):
        return "extracted_number_maps_elsewhere"
    if any(
        int(candidate.get("matched_question_no") or 0) == qno
        and candidate.get("match_status") == "low_confidence"
        for candidate in candidates
    ):
        return "low_confidence_candidate"
    return "adjacent_gap"


def build_gap_audit(
    rows: list[dict[str, Any]],
    consolidated_reports: list[dict[str, Any]],
    paper_questions: dict[tuple[str, str], list[PaperQuestion]],
) -> list[dict[str, Any]]:
    rows_by_paper: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        key = (str(row.get("exam_code") or ""), str(row.get("paper_code") or ""))
        rows_by_paper.setdefault(key, []).append(row)

    audit_rows: list[dict[str, Any]] = []
    for report in consolidated_reports:
        missing_nos = split_question_nos(report.get("safe_missing_question_nos"))
        if not missing_nos:
            continue
        exam_code, paper_code = str(report["expected_paper"]).split("-", 1)
        key = (exam_code, paper_code)
        questions_by_no = {
            question.question_no: question
            for question in paper_questions.get(key, [])
        }
        paper_rows = rows_by_paper.get(key, [])
        uncovered_nos = set(split_question_nos(report.get("uncovered_question_nos")))
        for qno in missing_nos:
            candidates = [
                row for row in paper_rows
                if (
                    row.get("matched_question_no")
                    and abs(int(row.get("matched_question_no") or 0) - qno) <= 2
                )
                or (
                    row.get("extracted_question_no")
                    and abs(int(row.get("extracted_question_no") or 0) - qno) <= 2
                )
            ]
            candidates = sorted(
                candidates,
                key=lambda row: (
                    int(row.get("extracted_question_no") or -999) == qno,
                    int(row.get("matched_question_no") or -999) == qno,
                    row_rank(row),
                    len(str(row.get("body") or "")),
                ),
                reverse=True,
            )
            top = candidates[0] if candidates else {}
            nearby = []
            for candidate in candidates[:5]:
                nearby.append(
                    " | ".join([
                        f"ex={candidate.get('extracted_question_no')}",
                        f"match={candidate.get('matched_question_no')}",
                        f"status={candidate.get('match_status')}",
                        f"score={candidate.get('match_score')}",
                        f"page={candidate.get('source_page_start')}-{candidate.get('source_page_end')}",
                        compact_preview(candidate.get("question_stem_snapshot"), 70),
                    ])
                )
            expected_question = questions_by_no.get(qno)
            audit_rows.append({
                "expected_paper": report["expected_paper"],
                "roc_year": report["roc_year"],
                "round_no": report["round_no"],
                "group": report["group"],
                "question_no": qno,
                "question_id": expected_question.question_id if expected_question else "",
                "issue_type": gap_issue_type(qno, uncovered_nos, candidates),
                "expected_stem": expected_question.stem if expected_question else "",
                "top_candidate_source_file": top.get("source_file", ""),
                "top_candidate_source_label": top.get("source_label", ""),
                "top_candidate_extracted_qno": top.get("extracted_question_no", ""),
                "top_candidate_matched_qno": top.get("matched_question_no", ""),
                "top_candidate_status": top.get("match_status", ""),
                "top_candidate_strategy": top.get("match_strategy", ""),
                "top_candidate_score": top.get("match_score", ""),
                "top_candidate_page_start": top.get("source_page_start", ""),
                "top_candidate_page_end": top.get("source_page_end", ""),
                "top_candidate_stem": top.get("question_stem_snapshot", ""),
                "top_candidate_answer": top.get("answer_snapshot", ""),
                "top_candidate_body_preview": compact_preview(top.get("body"), 220),
                "nearby_candidates": "\n".join(nearby),
            })
    return audit_rows


def write_gap_audit(output_dir: Path, gap_rows: list[dict[str, Any]]):
    fieldnames = [
        "expected_paper",
        "roc_year",
        "round_no",
        "group",
        "question_no",
        "question_id",
        "issue_type",
        "expected_stem",
        "top_candidate_source_file",
        "top_candidate_source_label",
        "top_candidate_extracted_qno",
        "top_candidate_matched_qno",
        "top_candidate_status",
        "top_candidate_strategy",
        "top_candidate_score",
        "top_candidate_page_start",
        "top_candidate_page_end",
        "top_candidate_stem",
        "top_candidate_answer",
        "top_candidate_body_preview",
        "nearby_candidates",
    ]
    with (output_dir / "yangming_gap_audit.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in gap_rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})

    lines = [
        "# Yangming Explanation Gap Audit",
        "",
        "This report lists questions that are not safely matched yet. Use it to inspect candidates before importing anything into production.",
        "",
    ]
    by_issue: dict[str, int] = {}
    for row in gap_rows:
        by_issue[str(row["issue_type"])] = by_issue.get(str(row["issue_type"]), 0) + 1
    lines.append("## Summary")
    for issue, count in sorted(by_issue.items()):
        lines.append(f"- {issue}: {count}")
    lines.append("")
    for row in gap_rows:
        lines.append(f"## {row['expected_paper']} Q{row['question_no']} · {row['issue_type']}")
        lines.append(f"- question_id: {row.get('question_id') or 'missing in audit'}")
        lines.append(f"- expected: {compact_preview(row.get('expected_stem'), 180)}")
        if row.get("top_candidate_source_file"):
            lines.append(
                "- top candidate: "
                f"{row.get('top_candidate_source_file')} "
                f"ex={row.get('top_candidate_extracted_qno')} "
                f"match={row.get('top_candidate_matched_qno')} "
                f"status={row.get('top_candidate_status')} "
                f"score={row.get('top_candidate_score')} "
                f"page={row.get('top_candidate_page_start')}-{row.get('top_candidate_page_end')}"
            )
            lines.append(f"- candidate stem: {compact_preview(row.get('top_candidate_stem'), 180)}")
            lines.append(f"- body preview: {compact_preview(row.get('top_candidate_body_preview'), 180)}")
        else:
            lines.append("- top candidate: none")
        lines.append("")
    (output_dir / "yangming_gap_audit.md").write_text("\n".join(lines), encoding="utf-8")


def build_content_quality_audit(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    audit_rows: list[dict[str, Any]] = []
    for row in rows:
        status = str(row.get("match_status") or "")
        if status not in {"matched", "low_confidence"}:
            continue
        body = normalize_text(str(row.get("body") or ""))
        sections = row.get("sections") if isinstance(row.get("sections"), list) else []
        assets = row.get("assets") if isinstance(row.get("assets"), list) else []
        issue = ""
        if not body and not sections and not assets:
            issue = "empty_explanation"
        elif len(body) < 25 and not assets:
            issue = "very_short_explanation"
        if not issue:
            continue
        audit_rows.append({
            "expected_paper": f"{row.get('exam_code')}-{row.get('paper_code')}",
            "question_no": row.get("matched_question_no") or row.get("extracted_question_no") or "",
            "question_id": row.get("question_id") or "",
            "issue_type": issue,
            "match_status": status,
            "match_strategy": row.get("match_strategy") or "",
            "match_score": row.get("match_score") or "",
            "source_file": row.get("source_file") or "",
            "source_page_start": row.get("source_page_start") or "",
            "source_page_end": row.get("source_page_end") or "",
            "stem_preview": compact_preview(row.get("question_stem_snapshot"), 180),
            "answer_snapshot": compact_preview(row.get("answer_snapshot"), 160),
            "body_preview": compact_preview(body, 220),
            "section_count": len(sections),
            "asset_count": len(assets),
        })
    return sorted(
        audit_rows,
        key=lambda item: (
            str(item["expected_paper"]),
            int(item["question_no"] or 0),
            str(item["issue_type"]),
        ),
    )


def write_content_quality_audit(output_dir: Path, quality_rows: list[dict[str, Any]]):
    fieldnames = [
        "expected_paper",
        "question_no",
        "question_id",
        "issue_type",
        "match_status",
        "match_strategy",
        "match_score",
        "source_file",
        "source_page_start",
        "source_page_end",
        "stem_preview",
        "answer_snapshot",
        "body_preview",
        "section_count",
        "asset_count",
    ]
    with (output_dir / "yangming_content_quality_audit.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in quality_rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})

    issue_counts: dict[str, int] = {}
    for row in quality_rows:
        issue = str(row["issue_type"])
        issue_counts[issue] = issue_counts.get(issue, 0) + 1
    lines = [
        "# Yangming Explanation Content Quality Audit",
        "",
        "This report lists matched rows whose explanation content is empty or too short for safe production import.",
        "",
        "## Summary",
    ]
    for issue, count in sorted(issue_counts.items()):
        lines.append(f"- {issue}: {count}")
    lines.append("")
    for row in quality_rows[:250]:
        lines.append(f"## {row['expected_paper']} Q{row['question_no']} · {row['issue_type']}")
        lines.append(f"- question_id: {row.get('question_id')}")
        lines.append(f"- source: {row.get('source_file')} page={row.get('source_page_start')}-{row.get('source_page_end')}")
        lines.append(f"- match: {row.get('match_status')} {row.get('match_strategy')} score={row.get('match_score')}")
        lines.append(f"- stem: {row.get('stem_preview')}")
        if row.get("answer_snapshot"):
            lines.append(f"- answer: {row.get('answer_snapshot')}")
        if row.get("body_preview"):
            lines.append(f"- body: {row.get('body_preview')}")
        lines.append("")
    if len(quality_rows) > 250:
        lines.append(f"... {len(quality_rows) - 250} more rows in CSV.")
    (output_dir / "yangming_content_quality_audit.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument(
        "--only-file",
        action="append",
        default=[],
        help="Only parse PDFs whose filename contains this value. May be passed multiple times.",
    )
    parser.add_argument(
        "--ocr-cache-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR / "ocr_text_cache",
        help="Shared OCR text cache directory.",
    )
    parser.add_argument(
        "--extract-visual-assets",
        action="store_true",
        help="Export PDF image blocks and detected tables into assets/ and attach them to rows.",
    )
    parser.add_argument(
        "--detect-tables",
        action="store_true",
        help="When visual assets are enabled, crop PyMuPDF-detected tables as image assets.",
    )
    args = parser.parse_args()

    _by_question, paper_meta, paper_questions = load_audit()
    stems = load_question_stems()
    paper_questions = hydrate_paper_questions(paper_questions, stems)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    image_output_dir = args.output_dir / "assets" if args.extract_visual_assets else None

    all_rows: list[dict[str, Any]] = []
    file_reports: list[dict[str, Any]] = []
    source_metas: dict[tuple[str, str], PaperMeta] = {}
    pdfs = sorted(args.source_dir.glob("*.pdf"))
    if args.only_file:
        pdfs = [
            path for path in pdfs
            if any(needle in path.name for needle in args.only_file)
        ]
    if args.limit:
        pdfs = pdfs[: args.limit]

    for path in pdfs:
        has_conflict, page_meta_summary = has_conflicting_page_metas(path, paper_meta)
        if has_conflict:
            file_reports.append({
                "file": path.name,
                "status": "mixed_page_metas_skipped",
                "extracted": 0,
                "page_meta_summary": page_meta_summary,
            })
            continue
        meta = parse_file_meta(path, paper_meta)
        if not meta:
            bookmark_sections = parse_bookmark_sections(
                path,
                paper_meta,
                paper_questions,
                image_output_dir,
                args.extract_visual_assets and args.detect_tables,
            )
            if bookmark_sections:
                for section_meta, rows, extra in bookmark_sections:
                    all_rows.extend(rows)
                    source_metas[(section_meta.exam_code, section_meta.paper_code)] = section_meta
                    file_reports.append(build_source_report(
                        str(extra["file"]),
                        str(extra["status"]),
                        section_meta,
                        rows,
                        paper_questions,
                        {key: value for key, value in extra.items() if key not in {"file", "status"}},
                    ))
                continue

            inferred = parse_content_inferred_pdf(
                path,
                paper_meta,
                paper_questions,
                image_output_dir,
                args.extract_visual_assets and args.detect_tables,
            )
            if inferred:
                inferred_meta, rows = inferred
                all_rows.extend(rows)
                source_metas[(inferred_meta.exam_code, inferred_meta.paper_code)] = inferred_meta
                file_reports.append(build_source_report(
                    path.name,
                    "parsed_content_inferred_combined",
                    inferred_meta,
                    rows,
                    paper_questions,
                ))
                continue

            file_reports.append({
                "file": path.name,
                "status": "unsupported_filename_or_combined_book",
                "extracted": 0,
            })
            continue
        rows = parse_table_pdf(
            path,
            meta,
            paper_questions,
            image_output_dir,
            args.extract_visual_assets and args.detect_tables,
        )
        all_rows.extend(rows)
        source_metas[(meta.exam_code, meta.paper_code)] = meta
        file_reports.append(build_source_report(
            path.name,
            "parsed_table_format",
            meta,
            rows,
            paper_questions,
        ))
        if path.name in OCR_FALLBACK_FILENAMES:
            ocr_rows = parse_ocr_pdf(path, meta, paper_questions, args.ocr_cache_dir)
            all_rows.extend(ocr_rows)
            file_reports.append(build_source_report(
                f"{path.name} :: OCR",
                "parsed_ocr_fallback",
                meta,
                ocr_rows,
                paper_questions,
            ))

    consolidated_rows, consolidated_reports = build_consolidated(all_rows, source_metas, paper_questions)
    gap_audit_rows = build_gap_audit(all_rows, consolidated_reports, paper_questions)
    content_quality_rows = build_content_quality_audit(consolidated_rows)

    (args.output_dir / "yangming_preview_rows.json").write_text(
        json.dumps(all_rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_consolidated_rows.json").write_text(
        json.dumps(consolidated_rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_file_report.json").write_text(
        json.dumps(file_reports, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (args.output_dir / "yangming_consolidated_report.json").write_text(
        json.dumps(consolidated_reports, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    with (args.output_dir / "yangming_file_report.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "file",
            "status",
            "expected_paper",
            "expected_questions",
            "extracted",
            "matched",
            "low_confidence",
            "missing_question",
            "matched_question_count",
            "low_confidence_question_count",
            "missing_question_count",
            "missing_question_nos",
            "uncovered_question_count",
            "uncovered_question_nos",
            "page_start",
            "page_end",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in file_reports:
            writer.writerow({field: row.get(field, "") for field in fieldnames})
    with (args.output_dir / "yangming_consolidated_report.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
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
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in consolidated_reports:
            writer.writerow({field: row.get(field, "") for field in fieldnames})
    write_gap_audit(args.output_dir, gap_audit_rows)
    write_content_quality_audit(args.output_dir, content_quality_rows)

    print(f"PDF files: {len(pdfs)}")
    print(f"Extracted rows: {len(all_rows)}")
    print(f"Matched: {sum(1 for row in all_rows if row['match_status'] == 'matched')}")
    print(f"Low confidence: {sum(1 for row in all_rows if row['match_status'] == 'low_confidence')}")
    print(f"Missing question: {sum(1 for row in all_rows if row['match_status'] == 'missing_question')}")
    print(f"Consolidated rows: {len(consolidated_rows)}")
    print(f"Consolidated safe missing: {sum(row['safe_missing_question_count'] for row in consolidated_reports)}")
    print(f"Consolidated uncovered: {sum(row['uncovered_question_count'] for row in consolidated_reports)}")
    print(f"Gap audit rows: {len(gap_audit_rows)}")
    print(f"Content quality audit rows: {len(content_quality_rows)}")
    print(f"Report: {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
