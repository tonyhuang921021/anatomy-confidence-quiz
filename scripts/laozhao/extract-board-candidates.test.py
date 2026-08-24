#!/usr/bin/env python3
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import cv2
import numpy as np


SCRIPT_PATH = Path(__file__).with_name("extract-board-candidates.py")
SPEC = importlib.util.spec_from_file_location("laozhao_board_candidates", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

ADAPTER_PATH = Path(__file__).with_name("native-capture-adapter.py")
ADAPTER_SPEC = importlib.util.spec_from_file_location("laozhao_native_capture", ADAPTER_PATH)
ADAPTER = importlib.util.module_from_spec(ADAPTER_SPEC)
assert ADAPTER_SPEC.loader is not None
sys.modules[ADAPTER_SPEC.name] = ADAPTER
ADAPTER_SPEC.loader.exec_module(ADAPTER)


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

    def test_stationary_teacher_is_not_absorbed_by_temporal_median(self):
        clean = board_with_writing()
        occupied = clean.copy()
        cv2.ellipse(occupied, (80, 50), (30, 40), 0, 0, 360, 72, -1)
        samples = [make_sample(float(index), occupied) for index in range(8)]
        samples.append(make_sample(8.0, clean))

        contaminated_median = np.median(
            np.stack([item.gray for item in samples], axis=0), axis=0
        ).astype(np.uint8)
        temporal_only = MODULE.estimate_foreground_occlusion(samples[3].gray, contaminated_median)
        robust_reference = MODULE.build_board_reference([item.gray for item in samples])

        MODULE.score_samples(samples, target_sec=None)

        self.assertLess(temporal_only.occlusion, 0.08)
        self.assertLess(float(np.mean(cv2.absdiff(robust_reference, samples[-1].gray))), 2.0)
        self.assertGreater(samples[3].occlusion, 0.30)
        self.assertLess(samples[-1].occlusion, samples[3].occlusion - 0.20)
        self.assertGreater(samples[-1].score, samples[3].score)

    def test_content_rich_occluded_board_beats_nearly_empty_clear_board(self):
        blank = np.full((90, 160), 218, dtype=np.uint8)
        almost_blank = blank.copy()
        cv2.line(almost_blank, (18, 24), (42, 24), 45, 1, cv2.LINE_AA)
        complete = board_with_writing()
        occupied_complete = complete.copy()
        cv2.ellipse(occupied_complete, (116, 58), (18, 28), 0, 0, 360, 78, -1)
        samples = [
            make_sample(0.0, almost_blank),
            make_sample(1.0, occupied_complete),
            make_sample(2.0, occupied_complete),
        ]

        MODULE.score_samples(samples, target_sec=None)

        self.assertGreater(samples[1].occlusion, samples[0].occlusion)
        self.assertGreater(samples[1].content, samples[0].content * 2)
        self.assertGreater(samples[1].score, samples[0].score)
        selected = MODULE.choose_candidates(samples, maximum=1, target_sec=None)
        self.assertNotEqual(selected[0].timestamp, 0.0)

    def test_candidate_metrics_are_populated(self):
        clean = board_with_writing()
        samples = [make_sample(0.0, clean), make_sample(1.0, clean)]

        MODULE.score_samples(samples, target_sec=0.0)

        self.assertGreaterEqual(samples[0].board_background_coverage, 0.0)
        self.assertLessEqual(samples[0].board_background_coverage, 1.0)
        self.assertGreaterEqual(samples[0].foreground_component_count, 0)


class FakeCapture:
    def __init__(self, frames: list[np.ndarray], fps: float = 2.0):
        self.frames = frames
        self.fps = fps
        self.position = 0
        self.grabbed_index: int | None = None
        self.released = False

    def isOpened(self):
        return True

    def get(self, property_id):
        if property_id == cv2.CAP_PROP_FRAME_WIDTH:
            return self.frames[0].shape[1]
        if property_id == cv2.CAP_PROP_FRAME_HEIGHT:
            return self.frames[0].shape[0]
        if property_id == cv2.CAP_PROP_FRAME_COUNT:
            return len(self.frames)
        if property_id == cv2.CAP_PROP_FPS:
            return self.fps
        if property_id == cv2.CAP_PROP_POS_MSEC:
            return self.position / self.fps * 1000
        return 0

    def set(self, property_id, value):
        if property_id == cv2.CAP_PROP_POS_FRAMES:
            self.position = max(0, min(len(self.frames), int(value)))
            self.grabbed_index = None
        return True

    def grab(self):
        if self.position >= len(self.frames):
            return False
        self.grabbed_index = self.position
        self.position += 1
        return True

    def retrieve(self):
        if self.grabbed_index is None:
            return False, None
        return True, self.frames[self.grabbed_index].copy()

    def read(self):
        if self.position >= len(self.frames):
            return False, None
        frame = self.frames[self.position].copy()
        self.position += 1
        return True, frame

    def release(self):
        self.released = True


class NativeCaptureAdapterTest(unittest.TestCase):
    def test_scaled_box_preserves_positive_dimensions(self):
        self.assertEqual(ADAPTER.scaled_box((10, 20, 101, 51), 0.5), (5, 10, 50, 26))
        with self.assertRaises(ValueError):
            ADAPTER.scaled_box((0, 0, 10, 10), 0)

    def test_iter_sampled_frames_resizes_and_samples_sequentially(self):
        frames = [np.full((60, 120, 3), index, dtype=np.uint8) for index in range(8)]
        capture = FakeCapture(frames, fps=2.0)
        with mock.patch.object(ADAPTER.cv2, "VideoCapture", return_value=capture):
            sampled = list(ADAPTER.iter_sampled_frames("video.mp4", 1.0, 60))

        self.assertEqual([round(item[0], 3) for item in sampled], [0.0, 1.0, 2.0, 3.0])
        self.assertTrue(all(item[1].shape == (30, 60, 3) for item in sampled))
        self.assertTrue(all(item[2] == 0.5 for item in sampled))
        self.assertTrue(capture.released)

    def test_choose_crop_box_detects_large_board_in_original_coordinates(self):
        frames = []
        for index in range(7):
            frame = np.full((180, 320, 3), 232, dtype=np.uint8)
            cv2.rectangle(frame, (35, 24), (285, 158), (58, 91, 48), -1)
            cv2.putText(frame, f"A{index}", (80, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (220, 220, 220), 2)
            frames.append(frame)
        capture = FakeCapture(frames, fps=1.0)
        with mock.patch.object(ADAPTER.cv2, "VideoCapture", return_value=capture):
            x, y, width, height = ADAPTER.choose_crop_box("video.mp4")

        self.assertLessEqual(x, 35)
        self.assertLessEqual(y, 24)
        self.assertGreaterEqual(x + width, 285)
        self.assertGreaterEqual(y + height, 158)
        self.assertLess(width, 320)
        self.assertTrue(capture.released)

    def test_choose_crop_box_falls_back_to_full_frame_when_detection_is_weak(self):
        frames = [np.full((90, 160, 3), 235, dtype=np.uint8) for _ in range(7)]
        capture = FakeCapture(frames, fps=1.0)
        with mock.patch.object(ADAPTER.cv2, "VideoCapture", return_value=capture):
            self.assertEqual(ADAPTER.choose_crop_box("video.mp4"), (0, 0, 160, 90))

    def test_builtin_adapter_is_default_and_explicit_external_tool_still_loads(self):
        self.assertEqual(MODULE.resolve_capture_tool(""), ADAPTER_PATH.resolve())
        with tempfile.TemporaryDirectory() as directory:
            external = Path(directory) / "capture_tool.py"
            external.write_text(
                "def choose_crop_box(source): return (1, 2, 3, 4)\n"
                "def iter_sampled_frames(source, sample_every, detect_width): return iter(())\n"
                "def scaled_box(box, scale): return box\n",
                encoding="utf-8",
            )
            loaded = MODULE.load_module(MODULE.resolve_capture_tool(str(external)))
            self.assertEqual(loaded.choose_crop_box("video.mp4"), (1, 2, 3, 4))



if __name__ == "__main__":
    unittest.main()
