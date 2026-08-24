#!/usr/bin/env python3
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("reference-notes-index.py")
SPEC = importlib.util.spec_from_file_location("laozhao_reference_notes_index", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ConservativeMatchingTest(unittest.TestCase):
    def test_long_explicit_phrase_is_accepted_when_next_page_is_clearly_weaker(self):
        chapters = [{
            "id": "video-ch-001",
            "title": "顱內壓升高與腦疝",
            "summary": "腦疝的臨床表現與分型",
            "tags": ["顱內壓", "腦疝"],
        }]
        pages = [
            MODULE.PageOcr(1, "胸腔與心臟的血管走向。"),
            MODULE.PageOcr(2, "顱內壓升高與腦疝。腦疝會造成瞳孔變化。"),
        ]

        matches = MODULE.select_conservative_matches(chapters, pages)

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].pdf_page, 2)
        self.assertIn("顱內壓升高與腦疝", matches[0].matched_terms)

    def test_single_short_tag_and_order_cannot_force_a_match(self):
        chapters = [{"id": "video-ch-001", "title": "腦", "summary": "", "tags": ["腦"]}]
        pages = [MODULE.PageOcr(1, "腦的簡短標記。")]

        self.assertEqual(MODULE.select_conservative_matches(chapters, pages), [])


class ReviewedCatalogMatchingTest(unittest.TestCase):
    def test_specific_reviewed_term_can_bind_without_ocr(self):
        chapters = [{
            "id": "video-ch-001",
            "title": "股三角、闊筋膜與隱靜脈孔",
            "summary": "整理股三角邊界與內容物。",
            "tags": ["股三角", "大隱靜脈"],
        }]
        topics = [MODULE.ReviewedPageTopic(
            page=50,
            page_region="整頁：股三角與大腿筋膜空間",
            match_terms=("股三角", "隱靜脈孔"),
            matched_structures=("股三角", "隱靜脈孔"),
        )]

        matches = MODULE.select_reviewed_catalog_matches(chapters, topics)

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].pdf_page, 50)
        self.assertEqual(matches[0].source_mode, "reviewed_page_topic_catalog")

    def test_generic_term_alone_never_binds(self):
        chapters = [{"id": "video-ch-001", "title": "前臂總覽", "summary": "", "tags": []}]
        topics = [MODULE.ReviewedPageTopic(
            page=46,
            page_region="整頁",
            match_terms=("前臂",),
            matched_structures=("前臂",),
        )]

        self.assertEqual(MODULE.select_reviewed_catalog_matches(chapters, topics), [])

    def test_two_independent_short_terms_can_bind(self):
        chapters = [{"id": "video-ch-001", "title": "魚際肌與骨間肌", "summary": "", "tags": []}]
        topics = [MODULE.ReviewedPageTopic(
            page=47,
            page_region="整頁：手部內在肌",
            match_terms=("魚際肌", "骨間肌"),
            matched_structures=("魚際肌", "骨間肌"),
        )]

        matches = MODULE.select_reviewed_catalog_matches(chapters, topics)

        self.assertEqual(len(matches), 1)
        self.assertGreaterEqual(matches[0].confidence, MODULE.CATALOG_MIN_CONFIDENCE)

    def test_equal_evidence_on_two_pages_is_rejected_as_ambiguous(self):
        chapters = [{"id": "video-ch-001", "title": "股三角", "summary": "", "tags": []}]
        topics = [
            MODULE.ReviewedPageTopic(50, "上半頁", ("股三角",), ("股三角",)),
            MODULE.ReviewedPageTopic(51, "下半頁", ("股三角",), ("股三角",)),
        ]

        self.assertEqual(MODULE.select_reviewed_catalog_matches(chapters, topics), [])

    def test_summary_only_specific_term_does_not_bind_a_page(self):
        chapters = [{
            "id": "video-ch-001",
            "title": "下肢腔室總覽",
            "summary": "後面會提到膕窩。",
            "tags": ["下肢腔室"],
        }]
        topics = [MODULE.ReviewedPageTopic(
            52,
            "上半頁：膕窩",
            ("膕窩",),
            ("膕窩",),
        )]

        self.assertEqual(MODULE.select_reviewed_catalog_matches(chapters, topics), [])

    def test_catalog_rejects_pdf_fingerprint_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps({
                "schemaVersion": "1.0.0",
                "reviewStatus": "reviewed",
                "sourcePdfSha256": "a" * 64,
                "pageCount": 147,
                "pages": [{
                    "page": 46,
                    "pageRegion": "整頁",
                    "matchTerms": ["六個伸肌間隔"],
                    "matchedStructures": ["六個伸肌間隔"],
                }],
            }, ensure_ascii=False), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "PDF 指紋"):
                MODULE.load_reviewed_page_catalog(path, pdf_sha256="b" * 64, page_count=147)

    def test_reviewed_catalog_output_remains_private_but_needs_no_second_mapping_review(self):
        result = MODULE.build_candidate_map(
            pdf_path=Path("reference.pdf"),
            pdf_sha256="a" * 64,
            page_count=147,
            video_id="wVYO5pZ0GjQ",
            chapters=[{"id": "wVYO5pZ0GjQ-ch-001", "title": "六個伸肌間隔", "summary": "", "tags": []}],
            reviewed_topics=[MODULE.ReviewedPageTopic(
                46,
                "整頁：前臂肌群與伸肌間隔",
                ("六個伸肌間隔",),
                ("六個伸肌間隔",),
            )],
            include_ocr_candidates=False,
        )

        self.assertEqual(result["visibility"], "private_reference_only")
        self.assertEqual(result["reviewStatus"], "chapter_mapped_automatic_frame_binding")
        self.assertFalse(result["requiresHumanReview"])
        self.assertEqual(result["source"]["publicationPermission"], "not_confirmed")
        self.assertEqual(result["boardFrameMappings"], [])
        self.assertEqual(result["mappings"][0]["match"]["mode"], "reviewed_page_topic_catalog")

    def test_ambiguous_pages_are_rejected_even_when_textual_evidence_exists(self):
        chapters = [{
            "id": "video-ch-001",
            "title": "腕隧道與屈肌支持帶",
            "summary": "正中神經通過腕隧道",
            "tags": ["腕隧道", "正中神經"],
        }]
        pages = [
            MODULE.PageOcr(1, "腕隧道與屈肌支持帶，正中神經通過腕隧道。"),
            MODULE.PageOcr(2, "腕隧道與屈肌支持帶，正中神經通過腕隧道。"),
        ]

        self.assertEqual(MODULE.select_conservative_matches(chapters, pages), [])


class RestartableOcrCacheTest(unittest.TestCase):
    def test_completed_pages_are_reused_and_changed_pdf_uses_separate_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / "notes.pdf"
            pdf.write_bytes(b"reference PDF v1")
            fingerprint = MODULE.sha256_file(pdf)
            calls = []

            def renderer(_pdf, page, **_kwargs):
                calls.append(page)
                return f"第 {page} 頁 顱內壓升高與腦疝"

            first = MODULE.scan_pdf_pages(
                pdf,
                cache_dir=root / "cache",
                pdf_sha256=fingerprint,
                page_count=2,
                pdftoppm_bin="unused",
                tesseract_bin="unused",
                language="chi_tra+eng",
                dpi=180,
                renderer=renderer,
            )
            second = MODULE.scan_pdf_pages(
                pdf,
                cache_dir=root / "cache",
                pdf_sha256=fingerprint,
                page_count=2,
                pdftoppm_bin="unused",
                tesseract_bin="unused",
                language="chi_tra+eng",
                dpi=180,
                renderer=renderer,
            )
            self.assertEqual(calls, [1, 2])
            self.assertEqual([page.text for page in second], [page.text for page in first])

            pdf.write_bytes(b"reference PDF v2")
            changed_fingerprint = MODULE.sha256_file(pdf)
            MODULE.scan_pdf_pages(
                pdf,
                cache_dir=root / "cache",
                pdf_sha256=changed_fingerprint,
                page_count=2,
                pdftoppm_bin="unused",
                tesseract_bin="unused",
                language="chi_tra+eng",
                dpi=180,
                renderer=renderer,
            )
            self.assertEqual(calls, [1, 2, 1, 2])
            self.assertTrue((root / "cache" / fingerprint / "pages" / "page-0001.json").is_file())
            self.assertTrue((root / "cache" / changed_fingerprint / "pages" / "page-0001.json").is_file())

    def test_candidate_output_never_marks_pages_as_public_or_approved(self):
        result = MODULE.build_candidate_map(
            pdf_path=Path("reference.pdf"),
            pdf_sha256="a" * 64,
            page_count=4,
            video_id="ATFBb25QRNw",
            chapters=[{"id": "ATFBb25QRNw-ch-001", "title": "顱內壓升高與腦疝", "summary": "", "tags": []}],
            pages=[MODULE.PageOcr(1, "顱內壓升高與腦疝。")],
        )

        self.assertEqual(result["visibility"], "private_reference_only")
        self.assertEqual(result["reviewStatus"], "candidate")
        self.assertEqual(result["source"]["publicationPermission"], "not_confirmed")
        self.assertEqual(result["boardFrameMappings"], [])
        self.assertTrue(result["requiresHumanReview"])


if __name__ == "__main__":
    unittest.main()
