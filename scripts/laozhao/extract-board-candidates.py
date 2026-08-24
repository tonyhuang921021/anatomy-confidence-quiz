#!/usr/bin/env python3
from __future__ import annotations

"""Extract private, chapter-aligned board-frame candidates from local media.

The script reuses the existing slide detector for board ROI and sampled-frame
decoding. It selects real frames only; it does not reconstruct, inpaint, or
invent pixels. Foreground and occlusion are luminance/residual estimates, not
person or clothing detection, and every result requires human review before
publication.
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
NATIVE_CAPTURE_ADAPTER = Path(__file__).with_name("native-capture-adapter.py")


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
    foreground_area: float = 0.0
    largest_foreground_component: float = 0.0
    board_background_coverage: float = 0.0
    foreground_component_count: int = 0
    foreground_residual_area: float = 0.0


@dataclass(frozen=True)
class ForegroundEstimate:
    """Image-only foreground metrics for one board crop."""

    residual_area: float
    foreground_area: float
    largest_component: float
    background_coverage: float
    component_count: int
    occlusion: float


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("laozhao_external_capture", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"無法載入既有投影片工具：{path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def resolve_capture_tool(configured: str | None) -> Path:
    """Prefer an explicitly configured adapter, otherwise use the built-in one."""

    if configured:
        path = Path(configured).expanduser().resolve()
        if not path.is_file():
            raise SystemExit(f"找不到指定的板書擷取工具：{path}")
        return path
    if not NATIVE_CAPTURE_ADAPTER.is_file():
        raise SystemExit("找不到專案內建的 OpenCV 板書擷取工具。")
    return NATIVE_CAPTURE_ADAPTER


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


def clamp_unit(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def _odd_kernel_size(value: int, limit: int) -> int:
    """Return an odd morphology kernel that fits even tiny test images."""

    if limit < 3:
        return 1
    size = max(3, int(value))
    if size % 2 == 0:
        size += 1
    if size > limit:
        size = limit if limit % 2 else limit - 1
    return max(1, size)


def _uint8_gray(image: np.ndarray) -> np.ndarray:
    if image.ndim != 2:
        raise ValueError("板書前景估計需要單通道灰階影像。")
    if image.dtype == np.uint8:
        return image
    return cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)


def estimate_foreground_occlusion(
    gray: np.ndarray,
    background: np.ndarray | None = None,
) -> ForegroundEstimate:
    """Estimate board occlusion from a frame and a robust board reference.

    The reference is normally a temporal median of nearby board crops. A
    residual mask is opened to discard thin writing/pointer marks, closed to
    join a real foreground region, then reduced to large connected components.
    The background coverage uses local texture in the reference, so it is
    based on the board region rather than any particular foreground colour.
    """

    current = _uint8_gray(gray)
    if background is None:
        sigma = max(1.2, min(current.shape) * 0.035)
        reference = cv2.GaussianBlur(current, (0, 0), sigmaX=sigma)
    else:
        reference = _uint8_gray(background)
        if reference.shape != current.shape:
            reference = cv2.resize(reference, (current.shape[1], current.shape[0]), interpolation=cv2.INTER_AREA)

    current_smooth = cv2.GaussianBlur(current, (3, 3), 0)
    reference_smooth = cv2.GaussianBlur(reference, (3, 3), 0)
    residual = cv2.absdiff(current_smooth, reference_smooth)
    residual_values = residual.astype(np.float32)
    residual_median = float(np.median(residual_values))
    residual_mad = float(np.median(np.abs(residual_values - residual_median)))
    residual_threshold = max(10.0, residual_median + 5.0 * max(1.0, residual_mad))
    raw_mask = (residual.astype(np.float32) >= residual_threshold).astype(np.uint8) * 255

    minimum_dimension = min(current.shape)
    open_size = _odd_kernel_size(round(minimum_dimension * 0.025), minimum_dimension)
    close_size = _odd_kernel_size(round(minimum_dimension * 0.055), minimum_dimension)
    opened = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, np.ones((open_size, open_size), np.uint8))
    foreground_mask = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, np.ones((close_size, close_size), np.uint8))

    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground_mask, 8)
    total_pixels = float(current.size)
    minimum_component_area = max(32, int(round(total_pixels * 0.012)))
    component_areas = [
        float(stats[index, cv2.CC_STAT_AREA])
        for index in range(1, component_count)
        if int(stats[index, cv2.CC_STAT_AREA]) >= minimum_component_area
    ]
    foreground_area = sum(component_areas) / total_pixels if component_areas else 0.0
    largest_component = max(component_areas, default=0.0) / total_pixels

    texture_kernel_size = _odd_kernel_size(round(minimum_dimension * 0.045), minimum_dimension)
    reference_texture = cv2.morphologyEx(
        reference_smooth,
        cv2.MORPH_GRADIENT,
        np.ones((texture_kernel_size, texture_kernel_size), np.uint8),
    )
    texture_threshold = max(4.0, float(np.percentile(reference_texture, 65)))
    background_mask = (reference_texture <= texture_threshold) & (residual < residual_threshold)
    background_coverage = float(np.mean(background_mask))

    # Small ink has little area after morphology. A large component and loss of
    # board background both need to agree before the estimate becomes severe.
    area_signal = clamp_unit((foreground_area - 0.012) / 0.18)
    component_signal = clamp_unit(largest_component / 0.12)
    coverage_signal = clamp_unit((0.58 - background_coverage) / 0.58)
    occlusion = clamp_unit(
        area_signal * 0.55 + component_signal * 0.30 + coverage_signal * 0.15
    )
    return ForegroundEstimate(
        residual_area=float(np.mean(raw_mask > 0)),
        foreground_area=foreground_area,
        largest_component=largest_component,
        background_coverage=background_coverage,
        component_count=len(component_areas),
        occlusion=occlusion,
    )


def build_board_reference(images: list[np.ndarray]) -> np.ndarray:
    """Build a real-observation board reference resistant to a static teacher.

    A temporal median keeps whatever occupies a pixel in most samples. Instead,
    this reference first estimates the board's dominant luminance, then picks
    for each pixel the observed value closest to that board tone. No pixels are
    synthesised: every output value comes from one sampled frame. A teacher may
    therefore stand still for most of the window without becoming background,
    as long as the board is visible in at least one sampled frame.
    """

    if not images:
        raise ValueError("建立黑板參考至少需要一張影像。")
    stack = np.stack([_uint8_gray(image) for image in images], axis=0)
    quantized = np.clip(stack.astype(np.int16) // 8, 0, 31)
    histogram = np.bincount(quantized.ravel(), minlength=32)
    dominant_bin = int(np.argmax(histogram))
    dominant_values = stack[quantized == dominant_bin]
    board_level = (
        float(np.median(dominant_values))
        if dominant_values.size
        else float(np.median(stack))
    )
    distance = np.abs(stack.astype(np.float32) - board_level)
    closest = np.argmin(distance, axis=0)
    return np.take_along_axis(stack, closest[None, :, :], axis=0)[0]


def _absolute_quality(value: float, reference: float) -> float:
    return clamp_unit(value / reference) if reference > 0 else 0.0


def score_samples(samples: list[Sample], target_sec: float | None) -> None:
    chapter_reference = build_board_reference([sample.gray for sample in samples])
    for index, sample in enumerate(samples):
        left = max(0, index - 6)
        right = min(len(samples), index + 7)
        neighborhood_reference = build_board_reference(
            [item.gray for item in samples[left:right]]
        )
        local_foreground = estimate_foreground_occlusion(sample.gray, neighborhood_reference)
        chapter_foreground = estimate_foreground_occlusion(sample.gray, chapter_reference)
        foreground = (
            chapter_foreground
            if chapter_foreground.occlusion >= local_foreground.occlusion
            else local_foreground
        )
        sample.occlusion = foreground.occlusion
        sample.foreground_area = foreground.foreground_area
        sample.largest_foreground_component = foreground.largest_component
        sample.board_background_coverage = foreground.background_coverage
        sample.foreground_component_count = foreground.component_count
        sample.foreground_residual_area = foreground.residual_area
        motions = []
        if index:
            motions.append(float(np.mean(cv2.absdiff(sample.gray, samples[index - 1].gray) > 20)))
        if index + 1 < len(samples):
            motions.append(float(np.mean(cv2.absdiff(sample.gray, samples[index + 1].gray) > 20)))
        sample.motion = sum(motions) / len(motions) if motions else 0.0

    content_relative = normalize([item.content for item in samples])
    content_scores = [
        relative * 0.45 + _absolute_quality(item.content, 0.04) * 0.55
        for relative, item in zip(content_relative, samples)
    ]
    sharpness_relative = normalize([item.sharpness for item in samples])
    sharpness_scores = [
        relative * 0.65 + _absolute_quality(item.sharpness, 80.0) * 0.35
        for relative, item in zip(sharpness_relative, samples)
    ]
    contrast_relative = normalize([item.contrast for item in samples])
    contrast_scores = [
        relative * 0.55 + _absolute_quality(item.contrast, 28.0) * 0.45
        for relative, item in zip(contrast_relative, samples)
    ]
    clear_scores = [math.exp(-4.0 * clamp_unit(item.occlusion)) for item in samples]
    still_scores = [math.exp(-4.0 * clamp_unit(item.motion)) for item in samples]
    chapter_span = max(1.0, samples[-1].timestamp - samples[0].timestamp) if samples else 1.0
    maximum_content = max((item.content for item in samples), default=0.0)
    meaningful_content = max(0.012, maximum_content * 0.58)
    content_retention_scores = [
        clamp_unit(item.content / meaningful_content) if meaningful_content > 0 else 0.0
        for item in samples
    ]

    for index, sample in enumerate(samples):
        target_bonus = 0.0
        if target_sec is not None:
            target_bonus = max(0.0, 1.0 - abs(sample.timestamp - target_sec) / chapter_span)
        sparse_content_penalty = 0.0
        if maximum_content >= 0.018:
            sparse_content_penalty = clamp_unit(
                (maximum_content * 0.32 - sample.content) / (maximum_content * 0.32)
            ) * 0.24
        sample.score = (
            content_scores[index] * 0.26
            + content_retention_scores[index] * 0.12
            + sharpness_scores[index] * 0.15
            + contrast_scores[index] * 0.08
            + clear_scores[index] * 0.28
            + still_scores[index] * 0.07
            + target_bonus * 0.04
            - sparse_content_penalty
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
        help="選用的外部 capture_slides.py 路徑；留白時使用專案內建 OpenCV adapter",
    )
    parser.add_argument("--sample-every", type=float, default=1.0)
    parser.add_argument("--detect-width", type=int, default=640)
    parser.add_argument("--max-candidates", type=int, default=6)
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    chapter_path = Path(args.chapters).expanduser().resolve()
    capture_tool = resolve_capture_tool(args.capture_tool)
    if not source.is_file():
        raise SystemExit(f"找不到已授權影片：{source}")
    if not chapter_path.is_file():
        raise SystemExit(f"找不到已驗證章節：{chapter_path}")
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
                    "sceneResidualEstimate": round(candidate.foreground_residual_area, 4),
                    "foregroundResidualAreaEstimate": round(candidate.foreground_residual_area, 4),
                    "occlusionEstimate": round(candidate.occlusion, 4),
                    "foregroundAreaEstimate": round(candidate.foreground_area, 4),
                    "largestForegroundComponentEstimate": round(candidate.largest_foreground_component, 4),
                    "boardBackgroundCoverageEstimate": round(candidate.board_background_coverage, 4),
                    "foregroundComponentCount": candidate.foreground_component_count,
                    "motionEstimate": round(candidate.motion, 4),
                    "sharpness": round(candidate.sharpness, 2),
                    "content": round(candidate.content, 4),
                    "contrast": round(candidate.contrast, 2),
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
        "pipelineVersion": "laozhao-board-candidates-v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "videoId": package["videoId"],
        "videoTitle": package.get("videoTitle"),
        "sourceFingerprint": package["sourceFingerprint"],
        "sourceMediaSha256": package["sourceMediaSha256"],
        "sourceFilename": source.name,
        "rightsStatus": "private_only",
        "reviewStatus": "unreviewed",
        "requiresHumanReview": True,
        "selectionMethod": "real-frame clarity/content/foreground-occlusion/motion/target heuristic",
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
