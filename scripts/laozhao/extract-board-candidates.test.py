#!/usr/bin/env python3
import importlib.util
import sys
import unittest
from pathlib import Path

import cv2
import numpy as np


SCRIPT_PATH = Path(__file__).with_name("extract-board-candidates.py")
SPEC = importlib.util.spec_from_file_location("laozhao_board_candidates", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def board_with_writing() -> np.ndarray:
    board = np.full((90, 160), 218, dtype=np.uint8)
    cv2.rectangle(board, (4, 4), (155, 85), 195, 1)
    cv2.putText(board, "A -> B", (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, 40, 2, cv2.LINE_AA)
    cv2.line(board, (18, 52), (112, 52), 55, 2, cv2.LINE_AA)
    cv2.circle(board, (128, 62), 12, 45, 2, cv2.LINE_AA)
    return board


def make_sample(timestamp: float, image: np.ndarray) -> object:
    gray = cv2.GaussianBlur(image, (3, 3), 0)
    edges = cv2.Canny(gray, 45, 140)
    return MODULE.Sample(
        timestamp=timestamp,
        gray=gray,
        sharpness=float(cv2.Laplacian(gray, cv2.CV_64F).var()),
        content=float(np.mean(edges > 0)),
        contrast=float(np.std(gray)),
    )


class BoardCandidateScoringTest(unittest.TestCase):
    def test_clean_board_outscores_large_foreground_occlusion(self):
        clean = board_with_writing()
        occluded = clean.copy()
        cv2.ellipse(occluded, (78, 48), (34, 42), 0, 0, 360, 75, -1)
        samples = [
            make_sample(0.0, clean),
            make_sample(1.0, occluded),
            make_sample(2.0, clean),
        ]

        MODULE.score_samples(samples, target_sec=None)

        self.assertGreater(samples[1].largest_foreground_component, 0.10)
        self.assertGreater(samples[1].occlusion, samples[0].occlusion + 0.25)
        self.assertGreater(samples[0].score, samples[1].score)

    def test_small_handwriting_is_not_marked_as_large_foreground(self):
        clean = board_with_writing()
        sparse_ink = clean.copy()
        cv2.line(sparse_ink, (24, 72), (45, 72), 45, 1, cv2.LINE_AA)
        cv2.line(sparse_ink, (48, 72), (60, 67), 45, 1, cv2.LINE_AA)
        samples = [
            make_sample(0.0, clean),
            make_sample(1.0, sparse_ink),
            make_sample(2.0, clean),
        ]

        MODULE.score_samples(samples, target_sec=None)

        self.assertLess(samples[1].foreground_area, 0.03)
        self.assertLess(samples[1].occlusion, 0.12)

    def test_blank_board_does_not_win_over_content(self):
        clean = board_with_writing()
        blank = np.full_like(clean, 218)
        samples = [
            make_sample(0.0, clean),
            make_sample(1.0, blank),
            make_sample(2.0, clean),
        ]

        MODULE.score_samples(samples, target_sec=None)

        self.assertEqual(samples[1].content, 0.0)
        self.assertGreater(samples[0].score, samples[1].score)
        self.assertGreater(samples[2].score, samples[1].score)

    def test_candidate_metrics_are_populated(self):
        clean = board_with_writing()
        samples = [make_sample(0.0, clean), make_sample(1.0, clean)]

        MODULE.score_samples(samples, target_sec=0.0)

        self.assertGreaterEqual(samples[0].board_background_coverage, 0.0)
        self.assertLessEqual(samples[0].board_background_coverage, 1.0)
        self.assertGreaterEqual(samples[0].foreground_component_count, 0)


if __name__ == "__main__":
    unittest.main()
