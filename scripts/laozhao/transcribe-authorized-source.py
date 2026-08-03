#!/usr/bin/env python3
"""Run the existing MLX Whisper tool with an anatomy-specific prompt.

This wrapper does not download media and does not modify the external tool. The
caller must provide an authorized local source file and the path to the existing
transcribe_lecture_mlx.py script.
"""

import argparse
import hashlib
import importlib.util
import json
import math
import os
import re
import sys
from pathlib import Path


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


def add_source_identity(output: Path, source: Path, video_id: str) -> None:
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"轉錄工具沒有產生可解析的 JSON：{output}") from exc
    if not isinstance(payload, dict):
        raise SystemExit("Whisper 輸出必須是 JSON 物件，無法加入來源驗證資料。")
    payload = sanitize_json_value(payload)
    payload["_laozhao"] = {
        "videoId": video_id,
        "sourceMediaSha256": sha256_file(source),
        "sourceFilename": source.name,
        "sourceSizeBytes": source.stat().st_size,
    }
    temporary = output.with_name(f"{output.name}.tmp-{os.getpid()}")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="已授權的本機影片或音訊檔")
    parser.add_argument("out_json", help="私人 Whisper JSON 輸出路徑")
    parser.add_argument("--video-id", required=True, help="對應的 YouTube video ID")
    parser.add_argument(
        "--tool",
        default=os.environ.get("LAOZHAO_TRANSCRIBE_TOOL", ""),
        help="既有 transcribe_lecture_mlx.py 路徑",
    )
    parser.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
    parser.add_argument("--language", default="zh")
    args = parser.parse_args()

    if not YOUTUBE_ID_PATTERN.fullmatch(args.video_id):
        raise SystemExit("--video-id 必須是 11 字元的 YouTube video ID。")

    source = Path(args.source).expanduser().resolve()
    output = Path(args.out_json).expanduser().resolve()
    tool = Path(args.tool).expanduser().resolve() if args.tool else None
    if not source.is_file():
        raise SystemExit(f"找不到已授權來源檔：{source}")
    if tool is None or not tool.is_file():
        raise SystemExit("請用 --tool 或 LAOZHAO_TRANSCRIBE_TOOL 指定既有轉錄工具。")

    assert_private_output(output)
    output.parent.mkdir(parents=True, exist_ok=True)
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
        add_source_identity(output, source, args.video_id)
    finally:
        sys.argv = original_argv


if __name__ == "__main__":
    main()
