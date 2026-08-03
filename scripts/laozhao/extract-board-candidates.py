#!/usr/bin/env python3
"""Extract private, chapter-aligned board-frame candidates from local media.

The script reuses the existing slide detector for board ROI and sampled-frame
decoding. It selects real frames only; it does not reconstruct, inpaint, or
invent pixels. Occlusion is a motion/residual estimate and every result requires
human review before publication.
"""

import argparse
import hashlib
import importlib.util
import json
import math
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = (REPO_ROOT / "data" / "laozhao" / "staging").resolve()


@dataclass
class Sample:
    timestamp: float
    gray: np.ndarray
    sharpness: float
    content: float
    contrast: float
    occlusion: float = 0.0
    motion: float = 0.0
    score: float = 0.0


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("laozhao_external_capture", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"無法載入既有投影片工具：{path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def assert_private_output(path: Path) -> None:
    try:
        path.resolve().relative_to(PRIVATE_ROOT)
    except ValueError as exc:
        raise RuntimeError("板書候選只能輸出到 data/laozhao/staging/ 內。") from exc


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_video_duration(path: Path) -> float:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"無法開啟影片：{path}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    frame_count = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    return frame_count / fps if fps > 0 and frame_count > 0 else 0.0


def read_chapters(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("rightsStatus") != "private_only" or data.get("reviewStatus") != "draft":
        raise RuntimeError("章節檔必須是 private_only 且仍為 draft。")
    if not isinstance(data.get("sourceMediaSha256"), str) or len(data["sourceMediaSha256"]) != 64:
        raise RuntimeError("章節檔缺少來源影片 SHA-256。")
    chapters = data.get("chapters")
    if not isinstance(chapters, list) or not chapters:
        raise RuntimeError("章節檔沒有可用章節。")
    for index, chapter in enumerate(chapters):
        if chapter.get("position") != index:
            raise RuntimeError("章節 position 必須連續並由 0 開始。")
        start = chapter.get("startSec")
        end = chapter.get("endSec")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or end <= start:
            raise RuntimeError(f"章節 {index + 1} 的時間範圍無效。")
        if index and start < chapters[index - 1]["endSec"]:
            raise RuntimeError(f"章節 {index} 與 {index + 1} 重疊。")
    return data


def normalize(values: list[float], inverse: bool = False) -> list[float]:
    if not values:
        return []
    low = min(values)
    high = max(values)
    if math.isclose(low, high):
        result = [0.5 for _ in values]
    else:
        result = [(value - low) / (high - low) for value in values]
    return [1.0 - value for value in result] if inverse else result


def score_samples(samples: list[Sample], target_sec: float | None) -> None:
    for index, sample in enumerate(samples):
        left = max(0, index - 6)
        right = min(len(samples), index + 7)
        neighborhood = np.stack([item.gray for item in samples[left:right]], axis=0)
        median = np.median(neighborhood, axis=0).astype(np.uint8)
        residual = cv2.absdiff(sample.gray, median)
        sample.occlusion = float(np.mean(residual > 26))
        motions = []
        if index:
            motions.append(float(np.mean(cv2.absdiff(sample.gray, samples[index - 1].gray) > 20)))
        if index + 1 < len(samples):
            motions.append(float(np.mean(cv2.absdiff(sample.gray, samples[index + 1].gray) > 20)))
        sample.motion = sum(motions) / len(motions) if motions else 0.0

    content_scores = normalize([item.content for item in samples])
    sharpness_scores = normalize([item.sharpness for item in samples])
    contrast_scores = normalize([item.contrast for item in samples])
    clear_scores = normalize([item.occlusion for item in samples], inverse=True)
    still_scores = normalize([item.motion for item in samples], inverse=True)
    chapter_span = max(1.0, samples[-1].timestamp - samples[0].timestamp) if samples else 1.0

    for index, sample in enumerate(samples):
        target_bonus = 0.0
        if target_sec is not None:
            target_bonus = max(0.0, 1.0 - abs(sample.timestamp - target_sec) / chapter_span)
        sample.score = (
            content_scores[index] * 0.25
            + sharpness_scores[index] * 0.18
            + contrast_scores[index] * 0.12
            + clear_scores[index] * 0.30
            + still_scores[index] * 0.10
            + target_bonus * 0.05
        )


def choose_candidates(samples: list[Sample], maximum: int, target_sec: float | None) -> list[Sample]:
    if not samples:
        return []
    score_samples(samples, target_sec)
    bucket_count = min(maximum, max(1, math.ceil(len(samples) / 15)))
    selected = []
    for bucket in range(bucket_count):
        start = math.floor(bucket * len(samples) / bucket_count)
        end = math.floor((bucket + 1) * len(samples) / bucket_count)
        group = samples[start:max(start + 1, end)]
        selected.append(max(group, key=lambda item: item.score))
    if target_sec is not None:
        selected.append(min(samples, key=lambda item: abs(item.timestamp - target_sec)))
    selected.append(max(samples, key=lambda item: item.score))

    unique = []
    for candidate in sorted(selected, key=lambda item: item.score, reverse=True):
        if any(abs(candidate.timestamp - kept.timestamp) < 3 for kept in unique):
            continue
        if any(float(np.mean(cv2.absdiff(candidate.gray, kept.gray))) < 2.0 for kept in unique):
            continue
        unique.append(candidate)
        if len(unique) >= maximum:
            break
    return sorted(unique, key=lambda item: item.timestamp)


def extract_original_frame(video: Path, timestamp: float, box: tuple[int, int, int, int], output: Path) -> None:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"無法開啟影片：{video}")
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"無法讀取 {timestamp:.2f} 秒畫面。")
    x, y, width, height = box
    crop = frame[y : y + height, x : x + width]
    if crop.size == 0:
        crop = frame
    output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output), crop):
        raise RuntimeError(f"無法寫入畫面：{output}")


def make_contact_sheet(items: list[tuple[Path, str]], output: Path) -> None:
    if not items:
        return
    cell_width, cell_height, label_height = 480, 315, 35
    columns = 2
    rows = math.ceil(len(items) / columns)
    sheet = Image.new("RGB", (cell_width * columns, cell_height * rows), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (path, label) in enumerate(items):
        image = Image.open(path).convert("RGB")
        image.thumbnail((cell_width - 16, cell_height - label_height - 12), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_width
        y = (index // columns) * cell_height
        sheet.paste(image, (x + (cell_width - image.width) // 2, y + 6))
        draw.text((x + 10, y + cell_height - label_height + 7), label, fill="black")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def clock(seconds: float) -> str:
    whole = max(0, int(round(seconds)))
    return f"{whole // 3600:02d}-{(whole % 3600) // 60:02d}-{whole % 60:02d}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="已授權的本機影片檔")
    parser.add_argument("chapters", help="chapters.validated.private.json")
    parser.add_argument(
        "--capture-tool",
        default=os.environ.get("LAOZHAO_CAPTURE_TOOL", ""),
        help="既有 capture_slides.py 路徑",
    )
    parser.add_argument("--sample-every", type=float, default=1.0)
    parser.add_argument("--detect-width", type=int, default=640)
    parser.add_argument("--max-candidates", type=int, default=6)
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    chapter_path = Path(args.chapters).expanduser().resolve()
    capture_tool = Path(args.capture_tool).expanduser().resolve() if args.capture_tool else None
    if not source.is_file():
        raise SystemExit(f"找不到已授權影片：{source}")
    if not chapter_path.is_file():
        raise SystemExit(f"找不到已驗證章節：{chapter_path}")
    if capture_tool is None or not capture_tool.is_file():
        raise SystemExit("請用 --capture-tool 或 LAOZHAO_CAPTURE_TOOL 指定既有 capture_slides.py。")
    if args.sample_every < 0.5 or args.sample_every > 5:
        raise SystemExit("--sample-every 必須介於 0.5 到 5 秒。")
    if args.max_candidates < 1 or args.max_candidates > 12:
        raise SystemExit("--max-candidates 必須介於 1 到 12。")

    package = read_chapters(chapter_path)
    if sha256_file(source) != package["sourceMediaSha256"]:
        raise RuntimeError("來源影片 SHA-256 與逐字稿不一致，已停止擷取以避免用錯影片。")
    actual_duration = read_video_duration(source)
    expected_duration = float(package.get("durationSec") or 0)
    duration_tolerance = max(5.0, expected_duration * 0.01)
    if actual_duration <= 0 or abs(actual_duration - expected_duration) > duration_tolerance:
        raise RuntimeError("來源影片長度與官方 metadata 不一致，請先人工確認影片版本。")
    output_dir = chapter_path.parent / "board-candidates"
    assert_private_output(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    tool = load_module(capture_tool)
    board_box = tool.choose_crop_box(source)
    chapters = package["chapters"]
    samples_by_chapter: list[list[Sample]] = [[] for _ in chapters]
    chapter_index = 0
    scaled_board_box = None

    for timestamp, frame, scale in tool.iter_sampled_frames(source, args.sample_every, args.detect_width):
        while chapter_index < len(chapters) and timestamp >= chapters[chapter_index]["endSec"]:
            chapter_index += 1
        if chapter_index >= len(chapters):
            break
        chapter = chapters[chapter_index]
        if timestamp < chapter["startSec"]:
            continue
        if scaled_board_box is None:
            scaled_board_box = tool.scaled_box(board_box, scale)
        x, y, width, height = scaled_board_box
        crop = frame[y : y + height, x : x + width]
        if crop.size == 0:
            crop = frame
        gray = cv2.cvtColor(cv2.resize(crop, (160, 90), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        edges = cv2.Canny(blurred, 45, 140)
        content = float(np.mean(edges > 0))
        contrast = float(np.std(gray))
        samples_by_chapter[chapter_index].append(Sample(timestamp, blurred, sharpness, content, contrast))

    output_chapters = []
    for chapter, samples in zip(chapters, samples_by_chapter):
        target = chapter.get("representativeFrameTargetSec")
        selected = choose_candidates(samples, args.max_candidates, target)
        chapter_dir = output_dir / chapter["id"]
        candidate_rows = []
        contact_items = []
        for position, candidate in enumerate(selected, start=1):
            filename = f"candidate-{position:02d}-{clock(candidate.timestamp)}.png"
            image_path = chapter_dir / filename
            extract_original_frame(source, candidate.timestamp, board_box, image_path)
            label = f"{clock(candidate.timestamp).replace('-', ':')}  clear~{1 - candidate.occlusion:.2f}"
            contact_items.append((image_path, label))
            candidate_rows.append(
                {
                    "id": f"{chapter['id']}-frame-{position:02d}",
                    "timestampSec": round(candidate.timestamp, 3),
                    "imagePath": str(image_path.relative_to(output_dir)),
                    "selectionScore": round(candidate.score, 4),
                    "sceneResidualEstimate": round(candidate.occlusion, 4),
                    "motionEstimate": round(candidate.motion, 4),
                    "sharpness": round(candidate.sharpness, 2),
                    "actualFrame": True,
                    "composite": False,
                    "reviewStatus": "unreviewed",
                }
            )
        make_contact_sheet(contact_items, chapter_dir / "contact-sheet.jpg")
        output_chapters.append(
            {
                "chapterId": chapter["id"],
                "title": chapter["title"],
                "startSec": chapter["startSec"],
                "endSec": chapter["endSec"],
                "representativeFrameTargetSec": target,
                "candidates": candidate_rows,
            }
        )

    output = {
        "schemaVersion": "1.0.0",
        "pipelineVersion": "laozhao-board-candidates-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "videoId": package["videoId"],
        "videoTitle": package.get("videoTitle"),
        "sourceFingerprint": package["sourceFingerprint"],
        "sourceMediaSha256": package["sourceMediaSha256"],
        "sourceFilename": source.name,
        "rightsStatus": "private_only",
        "reviewStatus": "unreviewed",
        "requiresHumanReview": True,
        "selectionMethod": "real-frame motion/residual heuristic",
        "boardCrop": {"x": board_box[0], "y": board_box[1], "width": board_box[2], "height": board_box[3]},
        "chapters": output_chapters,
    }
    (output_dir / "index.private.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"已建立私人板書候選：{output_dir}")
    print(f"章節：{len(output_chapters)}")
    print(f"候選圖：{sum(len(item['candidates']) for item in output_chapters)}")
    print("所有候選仍需人工確認；本工具沒有重建、補畫或公開任何畫面。")


if __name__ == "__main__":
    main()
