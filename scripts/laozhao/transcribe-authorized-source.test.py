#!/usr/bin/env python3
import importlib.util
import json
import math
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("transcribe-authorized-source.py")
SPEC = importlib.util.spec_from_file_location("laozhao_transcribe", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SanitizeJsonValueTest(unittest.TestCase):
    def test_loop_detection_accepts_a_partial_final_unit_without_matching_normal_repetition(self):
        self.assertTrue(MODULE.is_likely_transcript_loop("大山" * 12 + "大"))
        self.assertTrue(MODULE.is_likely_transcript_loop("幫" * 20))
        self.assertFalse(MODULE.is_likely_transcript_loop("這個很重要" * 2))

    def test_raw_transcript_cannot_overwrite_normalized_contract(self):
        with self.assertRaisesRegex(SystemExit, "whisper.raw.json"):
            MODULE.assert_raw_transcript_output(Path("transcript.private.json"))

        MODULE.assert_raw_transcript_output(Path("whisper.raw.json"))

    def test_replaces_nested_non_finite_floats(self):
        source = {
            "segments": [
                {"text": "臂神經叢", "avg_logprob": math.nan},
                {"temperature": math.inf},
            ]
        }

        sanitized = MODULE.sanitize_json_value(source)

        self.assertEqual(sanitized["segments"][0]["text"], "臂神經叢")
        self.assertIsNone(sanitized["segments"][0]["avg_logprob"])
        self.assertIsNone(sanitized["segments"][1]["temperature"])

    def test_native_transcription_uses_anatomy_prompt_without_changing_segments(self):
        calls = []

        def fake_transcribe(source, **kwargs):
            calls.append((source, kwargs))
            return {
                "text": "臂神經叢。",
                "segments": [{"id": 0, "start": 0.0, "end": 1.5, "text": "臂神經叢。"}],
                "language": "zh",
            }

        payload = MODULE.native_transcribe_payload(
            Path("authorized-source.mp4"),
            "mlx-community/whisper-large-v3-turbo",
            "zh",
            transcribe_fn=fake_transcribe,
        )

        self.assertEqual(payload["segments"][0]["text"], "臂神經叢。")
        self.assertEqual(calls[0][0], "authorized-source.mp4")
        self.assertEqual(calls[0][1]["language"], "zh")
        self.assertEqual(calls[0][1]["initial_prompt"], MODULE.ANATOMY_PROMPT)
        self.assertFalse(calls[0][1]["word_timestamps"])


class RestartableNativeTranscriptionTest(unittest.TestCase):
    def test_segment_plan_has_overlapping_windows_and_contiguous_ownership(self):
        plan = MODULE.build_segment_plan(35, 15, 2)

        self.assertEqual(
            plan,
            [
                {
                    "index": 0,
                    "logicalStartSec": 0.0,
                    "logicalEndSec": 15.0,
                    "windowStartSec": 0.0,
                    "windowEndSec": 17.0,
                },
                {
                    "index": 1,
                    "logicalStartSec": 15.0,
                    "logicalEndSec": 30.0,
                    "windowStartSec": 13.0,
                    "windowEndSec": 32.0,
                },
                {
                    "index": 2,
                    "logicalStartSec": 30.0,
                    "logicalEndSec": 35.0,
                    "windowStartSec": 28.0,
                    "windowEndSec": 35.0,
                },
            ],
        )

    def test_completed_checkpoints_are_reused_and_merge_absolute_timestamps(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "authorized-source.mp4"
            source.write_bytes(b"authorized media")
            output = root / "review-package" / "transcript.private.json"
            extraction_calls = []
            transcription_calls = []

            def fake_extract(_, audio_path, segment):
                extraction_calls.append(segment["index"])
                audio_path.write_bytes(b"wav")

            def fake_transcribe(audio_path, **_kwargs):
                audio_path = Path(audio_path)
                transcription_calls.append(audio_path.name)
                index = int(audio_path.stem.split("-")[-1])
                return {
                    "text": f"第 {index} 段",
                    "segments": [{"id": 99, "start": 3.0, "end": 6.0, "text": f"第 {index} 段"}],
                }

            MODULE.run_native_transcriber(
                source,
                output,
                "test-model",
                "zh",
                "ATFBb25QRNw",
                segment_seconds=15,
                overlap_seconds=2,
                transcribe_fn=fake_transcribe,
                duration_fn=lambda _: 35,
                extract_fn=fake_extract,
            )

            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(extraction_calls, [0, 1, 2])
            self.assertEqual(len(payload["segments"]), 3)
            self.assertEqual([item["id"] for item in payload["segments"]], [0, 1, 2])
            self.assertEqual([item["start"] for item in payload["segments"]], [3.0, 16.0, 31.0])

            MODULE.run_native_transcriber(
                source,
                output,
                "test-model",
                "zh",
                "ATFBb25QRNw",
                segment_seconds=15,
                overlap_seconds=2,
                transcribe_fn=fake_transcribe,
                duration_fn=lambda _: 35,
                extract_fn=fake_extract,
            )
            self.assertEqual(extraction_calls, [0, 1, 2])
            self.assertEqual(len(transcription_calls), 3)

    def test_merge_removes_contained_boundary_segments_and_trims_partial_overlap(self):
        plan = MODULE.build_segment_plan(30, 15, 2)
        checkpoints = [
            {
                "text": "前段",
                "segments": [
                    {"start": 12.0, "end": 14.0, "text": "前段開頭"},
                    {"start": 14.0, "end": 16.0, "text": "前段接縫"},
                ],
            },
            {
                "text": "後段",
                "segments": [
                    {"start": 1.0, "end": 12.0, "text": "後段完整句"},
                ],
            },
        ]

        merged = MODULE.merge_checkpoint_transcripts(plan, checkpoints)

        self.assertEqual(
            [(item["start"], item["end"], item["text"]) for item in merged["segments"]],
            [
                (12.0, 14.0, "前段開頭"),
                (14.0, 25.0, "後段完整句"),
            ],
        )
        self.assertNotIn("_checkpointIndex", merged["segments"][-1])

    def test_looping_boundary_hallucination_cannot_replace_valid_segment(self):
        plan = MODULE.build_segment_plan(30, 15, 2)
        checkpoints = [
            {
                "text": "有效內容",
                "segments": [
                    {"start": 12.0, "end": 16.0, "text": "頸神經襻是 loop"},
                ],
            },
            {
                "text": "循環幻覺",
                "segments": [
                    {"start": 1.0, "end": 12.0, "text": "幫" * 100},
                ],
            },
        ]

        merged = MODULE.merge_checkpoint_transcripts(plan, checkpoints)

        self.assertEqual(
            [(item["start"], item["end"], item["text"]) for item in merged["segments"]],
            [(12.0, 16.0, "頸神經襻是 loop")],
        )

    def test_interrupted_run_keeps_completed_checkpoint_for_resume(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "authorized-source.mp4"
            source.write_bytes(b"authorized media")
            output = root / "review-package" / "transcript.private.json"
            calls = []

            def fake_extract(_, audio_path, _segment):
                audio_path.write_bytes(b"wav")

            def interrupted_transcribe(audio_path, **_kwargs):
                audio_path = Path(audio_path)
                index = int(audio_path.stem.split("-")[-1])
                calls.append(index)
                if index == 1:
                    raise RuntimeError("interrupted")
                return {"segments": [{"start": 3, "end": 6, "text": f"段 {index}"}]}

            with self.assertRaisesRegex(RuntimeError, "interrupted"):
                MODULE.run_native_transcriber(
                    source,
                    output,
                    "test-model",
                    "zh",
                    "ATFBb25QRNw",
                    segment_seconds=15,
                    overlap_seconds=2,
                    transcribe_fn=interrupted_transcribe,
                    duration_fn=lambda _: 35,
                    extract_fn=fake_extract,
                )

            checkpoint_root = MODULE.checkpoint_root_for(output)
            self.assertTrue(MODULE.checkpoint_path(checkpoint_root, 0).exists())
            self.assertFalse(output.exists())

            def resumed_transcribe(audio_path, **_kwargs):
                audio_path = Path(audio_path)
                index = int(audio_path.stem.split("-")[-1])
                calls.append(index)
                return {"segments": [{"start": 3, "end": 6, "text": f"段 {index}"}]}

            MODULE.run_native_transcriber(
                source,
                output,
                "test-model",
                "zh",
                "ATFBb25QRNw",
                segment_seconds=15,
                overlap_seconds=2,
                transcribe_fn=resumed_transcribe,
                duration_fn=lambda _: 35,
                extract_fn=fake_extract,
            )
            self.assertEqual(calls, [0, 1, 1, 2])
            self.assertTrue(output.exists())


if __name__ == "__main__":
    unittest.main()
