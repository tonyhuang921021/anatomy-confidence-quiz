from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCES_DIR = ROOT / "data" / "sources"

OPTION_KEYS = {"A", "B", "C", "D", "E"}
MED1_PAPER_CODES = {"1101", "1301", "5301"}
MED2_PAPER_CODES = {"2101", "2301", "6301"}


@dataclass(frozen=True)
class AuditRecord:
    canonical_id: str
    source_id: str
    group: str
    roc_year: int
    gregorian_year: int
    exam_code: str
    paper_code: str
    question_no: int
    source_name: str


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_exported_array_from_ts(path: Path, export_anchor: str) -> list[dict[str, Any]]:
    text = read_text(path)
    anchor_index = text.index(export_anchor)
    start = text.index("= [", anchor_index) + 2
    level = 0
    end = None
    for index, char in enumerate(text[start:], start):
        if char == "[":
            level += 1
        elif char == "]":
            level -= 1
            if level == 0:
                end = index
                break
    if end is None:
        raise ValueError(f"Could not find array end in {path}")
    return json.loads(text[start : end + 1])


def parse_exported_object_from_ts(path: Path, export_anchor: str) -> dict[str, Any]:
    text = read_text(path)
    anchor_index = text.index(export_anchor)
    start = text.index("= {", anchor_index) + 2
    level = 0
    end = None
    for index, char in enumerate(text[start:], start):
        if char == "{":
            level += 1
        elif char == "}":
            level -= 1
            if level == 0:
                end = index
                break
    if end is None:
        raise ValueError(f"Could not find object end in {path}")
    return json.loads(text[start : end + 1])


def parse_moex_id(value: str) -> tuple[str, str, int] | None:
    match = re.match(r"^MOEX-(\d+)[_-](\d+)-Q(\d+)$", value)
    if not match:
        return None
    exam_code, paper_code, question_no = match.groups()
    return exam_code, paper_code, int(question_no)


def to_answer_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item.strip():
                return item.strip()
    return ""


def to_option_key_array(value: Any) -> list[str]:
    if isinstance(value, list):
        values = value
    elif value:
        values = [value]
    else:
        values = []
    normalized: list[str] = []
    for item in values:
        text = to_answer_text(item)
        if text in OPTION_KEYS:
            normalized.append(text)
    return normalized


def normalize_canonical_id(
    *,
    source_id: str,
    exam_code: str | None,
    paper_code: str | None,
    question_no: int | None,
) -> tuple[str, str, str, int] | None:
    parsed = parse_moex_id(source_id)
    if parsed:
        parsed_exam_code, parsed_paper_code, parsed_question_no = parsed
        return (
            f"MOEX-{parsed_exam_code}-{parsed_paper_code}-Q{parsed_question_no:03d}",
            parsed_exam_code,
            parsed_paper_code,
            parsed_question_no,
        )

    if exam_code and paper_code and question_no is not None:
        exam_code_digits = re.sub(r"\D", "", exam_code)
        paper_code_digits = re.sub(r"\D", "", paper_code)
        if exam_code_digits and paper_code_digits:
            return (
                f"MOEX-{exam_code_digits}-{paper_code_digits}-Q{int(question_no):03d}",
                exam_code_digits,
                paper_code_digits,
                int(question_no),
            )

    return None


def infer_group(paper_code: str, fallback: str | None = None) -> str:
    if paper_code in MED1_PAPER_CODES:
        return "醫學（一）"
    if paper_code in MED2_PAPER_CODES:
        return "醫學（二）"
    return fallback or "未知"


def build_records() -> list[AuditRecord]:
    records: list[AuditRecord] = []

    anatomy_questions = parse_exported_array_from_ts(
        ROOT / "data" / "anatomyQuestions.ts",
        "export const anatomyQuestions: Question[] = [",
    )
    for raw in anatomy_questions:
        source_id = raw.get("id", "")
        parsed = normalize_canonical_id(
            source_id=source_id,
            exam_code=raw.get("examCode"),
            paper_code=raw.get("paperCode"),
            question_no=raw.get("originalQuestionNumber"),
        )
        if not parsed:
            continue
        canonical_id, exam_code, paper_code, question_no = parsed
        source_year = raw.get("sourceYear")
        if not isinstance(source_year, int):
            continue
        records.append(
            AuditRecord(
                canonical_id=canonical_id,
                source_id=source_id,
                group=infer_group(paper_code, "醫學（一）"),
                roc_year=int(exam_code[:3]),
                gregorian_year=source_year,
                exam_code=exam_code,
                paper_code=paper_code,
                question_no=question_no,
                source_name="anatomyQuestions.ts",
            )
        )

    remaining_obj = parse_exported_object_from_ts(
        ROOT / "data" / "sources" / "moex_med1_remaining_detailed_v4_merged_001_1827.ts",
        "export const moexMed1RemainingDetailedV4Merged0011827 = {",
    )
    for raw in remaining_obj["questions"]:
        accepted_answers = to_option_key_array(raw.get("correct_answers"))
        primary_answer = to_answer_text(raw.get("answer")) or (accepted_answers[0] if accepted_answers else "")
        if primary_answer not in OPTION_KEYS:
            continue
        parsed = normalize_canonical_id(
            source_id=raw["id"],
            exam_code=raw.get("exam_code"),
            paper_code=raw.get("paper_code"),
            question_no=raw.get("question_no"),
        )
        if not parsed:
            continue
        canonical_id, exam_code, paper_code, question_no = parsed
        gregorian_year = raw.get("exam_year_gregorian")
        if not isinstance(gregorian_year, int):
            continue
        records.append(
            AuditRecord(
                canonical_id=canonical_id,
                source_id=raw["id"],
                group="醫學（一）",
                roc_year=int(exam_code[:3]),
                gregorian_year=gregorian_year,
                exam_code=exam_code,
                paper_code=paper_code,
                question_no=question_no,
                source_name="moex_med1_remaining_detailed_v4_merged_001_1827.ts",
            )
        )

    missing_22_questions = parse_exported_array_from_ts(
        ROOT / "data" / "sources" / "moex_med1_missing_22_questions_detailed_v5.ts",
        "export const moexMed1Missing22QuestionsDetailedV5 = [",
    )
    for raw in missing_22_questions:
        answer_values = []
        for candidate in (raw.get("corrected_answer"), raw.get("official_answer")):
            answer_values.extend(to_option_key_array(candidate))
        primary_answer = answer_values[0] if answer_values else ""
        if primary_answer not in OPTION_KEYS:
            continue
        exam_code, paper_code = str(raw["exam_code"]).split("-")
        parsed = normalize_canonical_id(
            source_id=raw["id"],
            exam_code=exam_code,
            paper_code=paper_code,
            question_no=raw.get("question_no"),
        )
        if not parsed:
            continue
        canonical_id, exam_code, paper_code, question_no = parsed
        records.append(
            AuditRecord(
                canonical_id=canonical_id,
                source_id=raw["id"],
                group="醫學（一）",
                roc_year=int(raw["roc_year"]),
                gregorian_year=int(raw["year"]),
                exam_code=exam_code,
                paper_code=paper_code,
                question_no=question_no,
                source_name="moex_med1_missing_22_questions_detailed_v5.ts",
            )
        )

    requested_patch_obj = parse_exported_object_from_ts(
        ROOT / "data" / "sources" / "moex_med1_requested_71_questions_detailed_patch_v5.ts",
        "export const moexMed1Requested71QuestionsDetailedPatchV5 = {",
    )
    for raw in requested_patch_obj["questions"]:
        answer_values = to_option_key_array(raw.get("correct_answers"))
        fallback_answer = to_answer_text(raw.get("official_answer_raw"))
        primary_answer = answer_values[0] if answer_values else (fallback_answer if fallback_answer in OPTION_KEYS else "")
        if primary_answer not in OPTION_KEYS:
            continue
        parsed = normalize_canonical_id(
            source_id=raw["id"],
            exam_code=str(raw.get("exam_code")),
            paper_code=str(raw.get("paper_code")),
            question_no=raw.get("question_no"),
        )
        if not parsed:
            continue
        canonical_id, exam_code, paper_code, question_no = parsed
        records.append(
            AuditRecord(
                canonical_id=canonical_id,
                source_id=raw["id"],
                group="醫學（一）",
                roc_year=int(raw["exam_year_roc"]),
                gregorian_year=int(raw["exam_year_gregorian"]),
                exam_code=exam_code,
                paper_code=paper_code,
                question_no=question_no,
                source_name="moex_med1_requested_71_questions_detailed_patch_v5.ts",
            )
        )

    for file_name in (
        "moex_med1_missing_batch1_100030_1101_detailed.json",
        "moex_med1_missing_batch2_109020_1301_detailed.json",
        "moex_med1_missing_batch3_112020_1301_detailed.json",
    ):
        payload = json.loads((SOURCES_DIR / file_name).read_text(encoding="utf-8"))
        questions = payload["questions"] if isinstance(payload, dict) else payload
        for raw in questions:
            accepted_answers = to_option_key_array(raw.get("correct_answers"))
            primary_answer = to_answer_text(raw.get("answer")) or (accepted_answers[0] if accepted_answers else "")
            if primary_answer not in OPTION_KEYS:
                continue
            parsed = normalize_canonical_id(
                source_id=raw["id"],
                exam_code=str(raw.get("exam_code")),
                paper_code=str(raw.get("paper_code")),
                question_no=raw.get("question_no"),
            )
            if not parsed:
                continue
            canonical_id, exam_code, paper_code, question_no = parsed
            gregorian_year = raw.get("exam_year_gregorian")
            if not isinstance(gregorian_year, int):
                continue
            records.append(
                AuditRecord(
                    canonical_id=canonical_id,
                    source_id=raw["id"],
                    group="醫學（一）",
                    roc_year=int(exam_code[:3]),
                    gregorian_year=gregorian_year,
                    exam_code=exam_code,
                    paper_code=paper_code,
                    question_no=question_no,
                    source_name=file_name,
                )
            )

    stage2_payload = json.loads(
        (SOURCES_DIR / "moex_med_stage2_detailed_merged_001_3100_classified_v3.json").read_text(
            encoding="utf-8"
        )
    )
    for raw in stage2_payload["questions"]:
        answer_values: list[str] = []
        for candidate in (raw.get("corrected_answer"), raw.get("official_answer_raw"), raw.get("correct_answers")):
            answer_values.extend(to_option_key_array(candidate))
        primary_answer = answer_values[0] if answer_values else ""
        if primary_answer not in OPTION_KEYS:
            continue
        parsed = normalize_canonical_id(
            source_id=str(raw["id"]).replace("_", "-"),
            exam_code=None,
            paper_code=None,
            question_no=None,
        )
        if not parsed:
            continue
        canonical_id, exam_code, paper_code, question_no = parsed
        year = raw.get("year")
        if not isinstance(year, int):
            continue
        records.append(
            AuditRecord(
                canonical_id=canonical_id,
                source_id=raw["id"],
                group="醫學（二）",
                roc_year=int(exam_code[:3]),
                gregorian_year=year,
                exam_code=exam_code,
                paper_code=paper_code,
                question_no=question_no,
                source_name="moex_med_stage2_detailed_merged_001_3100_classified_v3.json",
            )
        )

    return records


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    records = build_records()

    by_question: dict[str, AuditRecord] = {}
    duplicate_sources: defaultdict[str, list[str]] = defaultdict(list)
    for record in records:
        if record.canonical_id in by_question:
            duplicate_sources[record.canonical_id].append(record.source_name)
            continue
        by_question[record.canonical_id] = record

    final_records = sorted(
        by_question.values(),
        key=lambda record: (record.roc_year, record.group, record.exam_code, record.paper_code, record.question_no),
    )

    by_paper: defaultdict[tuple[int, str, str, str], list[AuditRecord]] = defaultdict(list)
    by_year: defaultdict[tuple[int, int], list[AuditRecord]] = defaultdict(list)

    for record in final_records:
        by_paper[(record.roc_year, record.gregorian_year, record.group, f"{record.exam_code}-{record.paper_code}")].append(record)
        by_year[(record.roc_year, record.gregorian_year)].append(record)

    paper_rows: list[dict[str, Any]] = []
    for (roc_year, gregorian_year, group, paper_key), items in sorted(by_paper.items()):
        question_numbers = sorted(record.question_no for record in items)
        missing_numbers = [number for number in range(1, 101) if number not in set(question_numbers)]
        paper_rows.append(
            {
                "roc_year": roc_year,
                "gregorian_year": gregorian_year,
                "group": group,
                "paper_key": paper_key,
                "question_count": len(items),
                "expected_question_count": 100,
                "is_complete": "yes" if len(items) == 100 else "no",
                "missing_question_numbers": ",".join(str(number) for number in missing_numbers),
            }
        )

    year_rows: list[dict[str, Any]] = []
    for (roc_year, gregorian_year), items in sorted(by_year.items()):
        med1_count = sum(1 for record in items if record.group == "醫學（一）")
        med2_count = sum(1 for record in items if record.group == "醫學（二）")
        expected_total = 200 if roc_year == 115 else 400
        year_rows.append(
            {
                "roc_year": roc_year,
                "gregorian_year": gregorian_year,
                "med1_count": med1_count,
                "med2_count": med2_count,
                "total_count": len(items),
                "expected_total_count": expected_total,
                "is_complete": "yes" if len(items) == expected_total else "no",
            }
        )

    detailed_rows = [
        {
            "canonical_id": record.canonical_id,
            "source_id": record.source_id,
            "group": record.group,
            "roc_year": record.roc_year,
            "gregorian_year": record.gregorian_year,
            "exam_code": record.exam_code,
            "paper_code": record.paper_code,
            "question_no": record.question_no,
            "source_name": record.source_name,
        }
        for record in final_records
    ]

    write_csv(
        SOURCES_DIR / "question_bank_audit_by_paper.csv",
        paper_rows,
        [
            "roc_year",
            "gregorian_year",
            "group",
            "paper_key",
            "question_count",
            "expected_question_count",
            "is_complete",
            "missing_question_numbers",
        ],
    )
    write_csv(
        SOURCES_DIR / "question_bank_audit_by_year.csv",
        year_rows,
        [
            "roc_year",
            "gregorian_year",
            "med1_count",
            "med2_count",
            "total_count",
            "expected_total_count",
            "is_complete",
        ],
    )
    write_csv(
        SOURCES_DIR / "question_bank_audit_detailed.csv",
        detailed_rows,
        [
            "canonical_id",
            "source_id",
            "group",
            "roc_year",
            "gregorian_year",
            "exam_code",
            "paper_code",
            "question_no",
            "source_name",
        ],
    )

    summary = {
        "unique_question_count": len(final_records),
        "duplicate_source_count": len(duplicate_sources),
        "duplicate_examples": {
            canonical_id: [by_question[canonical_id].source_name, *sources[:4]]
            for canonical_id, sources in list(duplicate_sources.items())[:20]
        },
        "paper_count": len(paper_rows),
        "incomplete_paper_count": sum(1 for row in paper_rows if row["is_complete"] == "no"),
        "year_count": len(year_rows),
        "incomplete_year_count": sum(1 for row in year_rows if row["is_complete"] == "no"),
    }
    (SOURCES_DIR / "question_bank_audit_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
