#!/usr/bin/env python3
"""Transcribe authorized local media with MLX Whisper.

The wrapper can still call the legacy ``transcribe_lecture_mlx.py`` tool, but it
also has a native path so the 30-video workflow does not depend on another
workspace. Source media and transcript output remain inside private staging.
"""

import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import subprocess
import sys
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional


REPO_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = (REPO_ROOT / "data" / "laozhao" / "staging").resolve()


ANATOMY_PROMPT = (
    "這是台灣醫師國考的一階人體解剖學課程，老師以繁體中文授課，並混用英文與拉丁文。"
    "常見主題包含大體解剖、神經解剖、胚胎學、組織學、頭頸、胸腔、腹腔、骨盆、"
    "上肢、下肢、腦神經、周邊神經、動脈、靜脈、淋巴與臨床定位。"
    "請保留 anatomical terms、muscle、nerve、artery、vein、foramen、canal、"
    "plexus、dermatome、branchial arch 等英文或拉丁文原詞，不要自行改寫醫學名詞。"
)
YOUTUBE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
DEFAULT_SEGMENT_SECONDS = 15 * 60
DEFAULT_SEGMENT_OVERLAP_SECONDS = 5


def load_existing_tool(path: Path):
    spec = importlib.util.spec_from_file_location("laozhao_external_transcriber", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"無法載入既有轉錄工具：{path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def assert_private_output(path: Path) -> None:
    try:
        path.resolve().relative_to(PRIVATE_ROOT)
    except ValueError as exc:
        raise SystemExit("逐字稿只能輸出到 data/laozhao/staging/ 內。") from exc


def assert_raw_transcript_output(path: Path) -> None:
    """Keep raw Whisper output distinct from the normalized transcript contract."""

    reserved_names = {
        "transcript.private.json",
        "captions.reviewed.private.json",
        "chapters.validated.private.json",
        "lecture-notes.validated.private.json",
    }
    if path.name in reserved_names:
        raise SystemExit(
            "原始 Whisper 輸出不可使用正式內容檔名；請輸出成 whisper.raw.json，"
            "再執行 package:laozhao-transcript 正規化。"
        )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sanitize_json_value(value):
    """Replace non-standard JSON floats without changing transcript text."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, list):
        return [sanitize_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: sanitize_json_value(item) for key, item in value.items()}
    return value


def write_json_atomic(output: Path, payload: dict) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f"{output.name}.tmp-{os.getpid()}")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(output)


def checkpoint_root_for(output: Path) -> Path:
    return output.parent / f"{output.stem}.checkpoints"


def source_identity(source: Path, video_id: str) -> dict:
    return {
        "videoId": video_id,
        "sourceMediaSha256": sha256_file(source),
        "sourceFilename": source.name,
        "sourceSizeBytes": source.stat().st_size,
    }


def checkpoint_job_payload(identity: dict, model: str, language: str, segment_seconds: int, overlap_seconds: int, duration_seconds: float) -> dict:
    return {
        "schemaVersion": "1.0.0",
        "source": identity,
        "model": model,
        "language": language,
        "segmentSeconds": segment_seconds,
        "overlapSeconds": overlap_seconds,
        "durationSeconds": duration_seconds,
    }


def assert_matching_checkpoint_job(checkpoint_root: Path, job: dict) -> None:
    manifest = checkpoint_root / "job.json"
    if not manifest.exists():
        write_json_atomic(manifest, job)
        return
    try:
        existing = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"分段轉錄 checkpoint 設定檔無法讀取：{manifest}") from exc
    if existing != job:
        raise SystemExit(
            "既有 checkpoint 與目前影片、模型或分段設定不一致；為避免混用舊逐字稿，請改用新的輸出檔名。"
        )


def media_duration_seconds(source: Path) -> float:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        duration = float(completed.stdout.strip())
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        raise SystemExit("無法讀取影片時長，無法建立可續跑的 MLX Whisper 分段轉錄。") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise SystemExit("影片時長無效，無法建立可續跑的 MLX Whisper 分段轉錄。")
    return duration


def build_segment_plan(duration_seconds: float, segment_seconds: int, overlap_seconds: int) -> List[Dict]:
    if not math.isfinite(duration_seconds) or duration_seconds <= 0:
        raise ValueError("duration_seconds 必須是正數")
    if segment_seconds <= 0:
        raise ValueError("segment_seconds 必須大於 0")
    if overlap_seconds < 0 or overlap_seconds >= segment_seconds:
        raise ValueError("overlap_seconds 必須大於等於 0 且小於 segment_seconds")

    plan = []
    logical_start = 0.0
    index = 0
    while logical_start < duration_seconds:
        logical_end = min(duration_seconds, logical_start + segment_seconds)
        window_start = max(0.0, logical_start - overlap_seconds)
        window_end = min(duration_seconds, logical_end + overlap_seconds)
        plan.append(
            {
                "index": index,
                "logicalStartSec": logical_start,
                "logicalEndSec": logical_end,
                "windowStartSec": window_start,
                "windowEndSec": window_end,
            }
        )
        logical_start = logical_end
        index += 1
    return plan


def checkpoint_path(checkpoint_root: Path, index: int) -> Path:
    return checkpoint_root / f"segment-{index:04d}.json"


def read_completed_checkpoint(path: Path, job: dict, segment: dict) -> Optional[Dict]:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"分段轉錄 checkpoint 無法讀取：{path}") from exc
    if not isinstance(payload, dict) or payload.get("job") != job or payload.get("segment") != segment:
        raise SystemExit(f"分段轉錄 checkpoint 與目前工作不一致：{path}")
    transcript = payload.get("transcript")
    if not isinstance(transcript, dict) or not isinstance(transcript.get("segments"), list):
        raise SystemExit(f"分段轉錄 checkpoint 缺少有效的 Whisper segments：{path}")
    return transcript


def extract_audio_segment(source: Path, output: Path, segment: dict) -> None:
    duration = segment["windowEndSec"] - segment["windowStartSec"]
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{segment['windowStartSec']:.3f}",
                "-t",
                f"{duration:.3f}",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                str(output),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"無法擷取第 {segment['index'] + 1} 段音訊，checkpoint 已保留。") from exc


def shift_segment_timestamps(segment: dict, offset_seconds: float) -> dict:
    shifted = deepcopy(segment)
    for key in ("start", "end"):
        if isinstance(shifted.get(key), (int, float)):
            shifted[key] = round(float(shifted[key]) + offset_seconds, 3)
    words = shifted.get("words")
    if isinstance(words, list):
        for word in words:
            if isinstance(word, dict):
                for key in ("start", "end"):
                    if isinstance(word.get(key), (int, float)):
                        word[key] = round(float(word[key]) + offset_seconds, 3)
    return shifted


def is_likely_transcript_loop(text: object) -> bool:
    if not isinstance(text, str):
        return False
    compact = re.sub(r"[\s、，,。！？!?；;：:]+", "", text)
    if len(compact) < 8:
        return False
    maximum = min(32, len(compact) // 4)
    for unit_length in range(1, maximum + 1):
        unit = compact[:unit_length]
        repeat_count, remainder = divmod(len(compact), unit_length)
        threshold = 4 if remainder == 0 else 8
        if repeat_count < threshold:
            continue
        if unit * repeat_count + unit[:remainder] == compact:
            return True
    return False


def stitch_checkpoint_boundaries(segments: List[Dict]) -> List[Dict]:
    """Remove cross-checkpoint containment and trim only the overlapping tail.

    Whisper may return one long segment at the start of a checkpoint while the
    preceding checkpoint contains several shorter segments for the same audio.
    Midpoint ownership alone keeps both versions.  Resolve only those
    cross-checkpoint collisions; overlaps produced inside one Whisper pass are
    preserved for later review.
    """

    stitched: List[Dict] = []
    for raw in sorted(
        segments,
        key=lambda item: (
            float(item.get("start", 0)),
            float(item.get("end", 0)),
            int(item.get("_checkpointIndex", 0)),
        ),
    ):
        current = deepcopy(raw)
        keep_current = True
        while stitched and float(current["start"]) < float(stitched[-1]["end"]):
            previous = stitched[-1]
            if current.get("_checkpointIndex") == previous.get("_checkpointIndex"):
                break

            if float(current["end"]) <= float(previous["end"]):
                keep_current = False
                break

            overlap_start = float(current["start"])
            if overlap_start <= float(previous["start"]) + 0.05:
                stitched.pop()
                continue

            previous["end"] = round(overlap_start, 3)
            words = previous.get("words")
            if isinstance(words, list):
                previous["words"] = [
                    word for word in words
                    if not isinstance(word, dict)
                    or not isinstance(word.get("start"), (int, float))
                    or float(word["start"]) < overlap_start
                ]
            break

        if keep_current:
            stitched.append(current)

    for segment in stitched:
        segment.pop("_checkpointIndex", None)
    return stitched


def merge_checkpoint_transcripts(plan: List[Dict], checkpoints: List[Dict]) -> Dict:
    if len(plan) != len(checkpoints):
        raise ValueError("分段計畫與 checkpoint 數量不一致")
    if not checkpoints:
        raise ValueError("沒有可合併的分段逐字稿")

    merged_segments = []
    for segment_plan, checkpoint in zip(plan, checkpoints):
        for raw_segment in checkpoint.get("segments", []):
            if not isinstance(raw_segment, dict):
                continue
            if is_likely_transcript_loop(raw_segment.get("text")):
                continue
            shifted = shift_segment_timestamps(raw_segment, segment_plan["windowStartSec"])
            start = shifted.get("start")
            end = shifted.get("end")
            if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
                continue
            midpoint = (float(start) + float(end)) / 2
            is_final_segment = segment_plan["index"] == len(plan) - 1
            if midpoint < segment_plan["logicalStartSec"]:
                continue
            if midpoint >= segment_plan["logicalEndSec"] and not is_final_segment:
                continue
            shifted["_checkpointIndex"] = segment_plan["index"]
            merged_segments.append(shifted)

    merged_segments = stitch_checkpoint_boundaries(merged_segments)
    for index, segment in enumerate(merged_segments):
        segment["id"] = index
    first = deepcopy(checkpoints[0])
    first["segments"] = merged_segments
    first["text"] = "".join(str(segment.get("text", "")) for segment in merged_segments).strip()
    return sanitize_json_value(first)


def native_transcribe_payload(source: Path, model: str, language: str, transcribe_fn=None):
    if transcribe_fn is None:
        try:
            from mlx_whisper import transcribe as transcribe_fn
        except ImportError as exc:
            raise SystemExit(
                "目前的 Python 無法載入 mlx_whisper；請先執行老趙工具環境安裝。"
            ) from exc

    payload = transcribe_fn(
        str(source),
        path_or_hf_repo=model,
        language=language,
        initial_prompt=ANATOMY_PROMPT,
        word_timestamps=False,
        verbose=True,
    )
    if not isinstance(payload, dict):
        raise SystemExit("MLX Whisper 沒有回傳可保存的 JSON 物件。")
    return sanitize_json_value(payload)


def run_native_transcriber(
    source: Path,
    output: Path,
    model: str,
    language: str,
    video_id: str,
    segment_seconds: int = DEFAULT_SEGMENT_SECONDS,
    overlap_seconds: int = DEFAULT_SEGMENT_OVERLAP_SECONDS,
    transcribe_fn=None,
    duration_fn=media_duration_seconds,
    extract_fn=extract_audio_segment,
) -> None:
    """Transcribe long media in restartable chunks and only merge when complete."""
    duration_seconds = duration_fn(source)
    identity = source_identity(source, video_id)
    job = checkpoint_job_payload(
        identity,
        model,
        language,
        segment_seconds,
        overlap_seconds,
        duration_seconds,
    )
    plan = build_segment_plan(duration_seconds, segment_seconds, overlap_seconds)
    checkpoint_root = checkpoint_root_for(output)
    checkpoint_root.mkdir(parents=True, exist_ok=True)
    assert_matching_checkpoint_job(checkpoint_root, job)

    checkpoints = []
    for segment in plan:
        path = checkpoint_path(checkpoint_root, segment["index"])
        completed = read_completed_checkpoint(path, job, segment)
        if completed is not None:
            checkpoints.append(completed)
            continue

        with tempfile.TemporaryDirectory(prefix="laozhao-transcribe-") as temporary_directory:
            audio_path = Path(temporary_directory) / f"segment-{segment['index']:04d}.wav"
            extract_fn(source, audio_path, segment)
            payload = native_transcribe_payload(audio_path, model, language, transcribe_fn=transcribe_fn)
        write_json_atomic(
            path,
            {
                "schemaVersion": "1.0.0",
                "job": job,
                "segment": segment,
                "transcript": payload,
            },
        )
        checkpoints.append(payload)

    write_json_atomic(output, merge_checkpoint_transcripts(plan, checkpoints))


def add_source_identity(output: Path, source: Path, video_id: str) -> None:
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"轉錄工具沒有產生可解析的 JSON：{output}") from exc
    if not isinstance(payload, dict):
        raise SystemExit("Whisper 輸出必須是 JSON 物件，無法加入來源驗證資料。")
    payload = sanitize_json_value(payload)
    payload["_laozhao"] = source_identity(source, video_id)
    write_json_atomic(output, payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="已授權的本機影片或音訊檔")
    parser.add_argument("out_json", help="私人 Whisper JSON 輸出路徑")
    parser.add_argument("--video-id", required=True, help="對應的 YouTube video ID")
    parser.add_argument(
        "--tool",
        default=os.environ.get("LAOZHAO_TRANSCRIBE_TOOL", ""),
        help="選用的既有 transcribe_lecture_mlx.py 路徑；未提供時使用內建 MLX Whisper",
    )
    parser.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
    parser.add_argument("--language", default="zh")
    parser.add_argument(
        "--segment-seconds",
        type=int,
        default=DEFAULT_SEGMENT_SECONDS,
        help="內建 MLX Whisper 單段秒數；每段完成即建立可續跑 checkpoint",
    )
    parser.add_argument(
        "--segment-overlap-seconds",
        type=int,
        default=DEFAULT_SEGMENT_OVERLAP_SECONDS,
        help="相鄰 checkpoint 音訊重疊秒數，用於避免切段漏字",
    )
    args = parser.parse_args()

    if not YOUTUBE_ID_PATTERN.fullmatch(args.video_id):
        raise SystemExit("--video-id 必須是 11 字元的 YouTube video ID。")

    source = Path(args.source).expanduser().resolve()
    output = Path(args.out_json).expanduser().resolve()
    tool = Path(args.tool).expanduser().resolve() if args.tool else None
    if not source.is_file():
        raise SystemExit(f"找不到已授權來源檔：{source}")
    if tool is not None and not tool.is_file():
        raise SystemExit(f"找不到指定的既有轉錄工具：{tool}")
    if args.segment_seconds <= 0:
        raise SystemExit("--segment-seconds 必須大於 0。")
    if args.segment_overlap_seconds < 0 or args.segment_overlap_seconds >= args.segment_seconds:
        raise SystemExit("--segment-overlap-seconds 必須大於等於 0 且小於 --segment-seconds。")

    assert_private_output(output)
    assert_raw_transcript_output(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if tool is None:
        run_native_transcriber(
            source,
            output,
            args.model,
            args.language,
            args.video_id,
            args.segment_seconds,
            args.segment_overlap_seconds,
        )
    else:
        module = load_existing_tool(tool)
        module.PROMPT = ANATOMY_PROMPT
        module.FIXUPS = {}
        original_argv = sys.argv
        try:
            sys.argv = [
                str(tool),
                str(source),
                str(output),
                "--model",
                args.model,
                "--language",
                args.language,
            ]
            module.main()
        finally:
            sys.argv = original_argv
    add_source_identity(output, source, args.video_id)


if __name__ == "__main__":
    main()
