#!/usr/bin/env python3
import importlib.util
import math
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("transcribe-authorized-source.py")
SPEC = importlib.util.spec_from_file_location("laozhao_transcribe", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SanitizeJsonValueTest(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
