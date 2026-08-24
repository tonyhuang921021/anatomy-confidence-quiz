#!/usr/bin/env python3
from __future__ import annotations

"""Small OpenCV capture adapter used when no external slide tool is configured."""

from pathlib import Path
from typing import Iterator

import cv2
import numpy as np


Box = tuple[int, int, int, int]


def _open_video(source: Path | str):
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        capture.release()
        raise RuntimeError(f"無法開啟影片：{source}")
    return capture


def _video_size(capture) -> tuple[int, int]:
    width = int(round(float(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)))
    height = int(round(float(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)))
    if width <= 0 or height <= 0:
        raise RuntimeError("無法讀取影片尺寸。")
    return width, height


def _resize_for_detection(frame: np.ndarray, detect_width: int) -> tuple[np.ndarray, float]:
    height, width = frame.shape[:2]
    if width <= detect_width:
        return frame, 1.0
    scale = detect_width / width
    resized = cv2.resize(
        frame,
        (detect_width, max(1, int(round(height * scale)))),
        interpolation=cv2.INTER_AREA,
    )
    return resized, scale


def scaled_box(box: Box, scale: float) -> Box:
    """Scale an original-resolution crop box for a sampled detection frame."""

    if not np.isfinite(scale) or scale <= 0:
        raise ValueError("scale 必須是大於 0 的有限數值。")
    x, y, width, height = box
    if x < 0 or y < 0 or width <= 0 or height <= 0:
        raise ValueError("裁切範圍必須位於非負座標且寬高大於 0。")
    return (
        max(0, int(round(x * scale))),
        max(0, int(round(y * scale))),
        max(1, int(round(width * scale))),
        max(1, int(round(height * scale))),
    )


def iter_sampled_frames(
    source: Path | str,
    sample_every: float,
    detect_width: int,
) -> Iterator[tuple[float, np.ndarray, float]]:
    """Yield sequentially sampled BGR frames without loading the video into memory."""

    if not np.isfinite(sample_every) or sample_every <= 0:
        raise ValueError("sample_every 必須大於 0。")
    if detect_width <= 0:
        raise ValueError("detect_width 必須大於 0。")

    capture = _open_video(source)
    try:
        source_width, _ = _video_size(capture)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        if not np.isfinite(fps) or fps <= 0:
            fps = 0.0
        scale = min(1.0, detect_width / source_width)
        next_sample = 0.0
        frame_index = 0

        while capture.grab():
            position_msec = float(capture.get(cv2.CAP_PROP_POS_MSEC) or 0)
            timestamp = frame_index / fps if fps > 0 else position_msec / 1000.0
            if timestamp + 1e-6 < next_sample:
                frame_index += 1
                continue

            ok, frame = capture.retrieve()
            if not ok or frame is None:
                frame_index += 1
                continue
            resized, actual_scale = _resize_for_detection(frame, detect_width)
            yield float(timestamp), resized, actual_scale

            skipped_intervals = max(1, int((timestamp - next_sample) // sample_every) + 1)
            next_sample += skipped_intervals * sample_every
            frame_index += 1
    finally:
        capture.release()


def _representative_frame(source: Path | str, sample_count: int = 7) -> tuple[np.ndarray, float]:
    capture = _open_video(source)
    try:
        width, height = _video_size(capture)
        frame_count = int(round(float(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)))
        frames: list[np.ndarray] = []
        if frame_count > 1:
            positions = np.linspace(0.08, 0.92, sample_count)
            for position in positions:
                capture.set(cv2.CAP_PROP_POS_FRAMES, int(round((frame_count - 1) * float(position))))
                ok, frame = capture.read()
                if ok and frame is not None:
                    resized, scale = _resize_for_detection(frame, 640)
                    frames.append(resized)
        else:
            ok, frame = capture.read()
            if ok and frame is not None:
                resized, scale = _resize_for_detection(frame, 640)
                frames.append(resized)

        if not frames:
            raise RuntimeError(f"無法讀取影片畫面：{source}")
        common_height = min(frame.shape[0] for frame in frames)
        common_width = min(frame.shape[1] for frame in frames)
        aligned = [frame[:common_height, :common_width] for frame in frames]
        representative = np.median(np.stack(aligned, axis=0), axis=0).astype(np.uint8)
        return representative, common_width / width
    finally:
        capture.release()


def _board_box_from_frame(frame: np.ndarray) -> Box | None:
    """Find a large board-like surface, returning None when evidence is weak."""

    height, width = frame.shape[:2]
    hsv = cv2.cvtColor(cv2.GaussianBlur(frame, (5, 5), 0), cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    chromatic_board = (saturation >= 32) & (value >= 22) & (value <= 215)
    dark_board = (value >= 22) & (value <= 125)
    mask = ((chromatic_board | dark_board).astype(np.uint8)) * 255

    minimum = min(width, height)
    open_size = max(3, int(round(minimum * 0.012)))
    close_size = max(5, int(round(minimum * 0.045)))
    open_size += 1 - open_size % 2
    close_size += 1 - close_size % 2
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((open_size, open_size), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((close_size, close_size), np.uint8))

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    frame_area = float(width * height)
    best: tuple[float, Box] | None = None
    for contour in contours:
        contour_area = float(cv2.contourArea(contour))
        x, y, box_width, box_height = cv2.boundingRect(contour)
        box_area = float(box_width * box_height)
        area_ratio = contour_area / frame_area
        box_ratio = box_area / frame_area
        if area_ratio < 0.16 or box_ratio > 0.97 or box_width < width * 0.42 or box_height < height * 0.28:
            continue
        fill_ratio = contour_area / box_area if box_area else 0.0
        aspect_ratio = box_width / max(1, box_height)
        if fill_ratio < 0.42 or aspect_ratio < 1.05:
            continue
        center_x = x + box_width / 2
        center_y = y + box_height / 2
        center_distance = abs(center_x / width - 0.5) + abs(center_y / height - 0.5)
        score = area_ratio * 0.65 + fill_ratio * 0.25 + max(0.0, 1.0 - center_distance) * 0.10
        if best is None or score > best[0]:
            best = (score, (x, y, box_width, box_height))

    if best is None:
        return None
    x, y, box_width, box_height = best[1]
    margin_x = int(round(width * 0.012))
    margin_y = int(round(height * 0.012))
    left = max(0, x - margin_x)
    top = max(0, y - margin_y)
    right = min(width, x + box_width + margin_x)
    bottom = min(height, y + box_height + margin_y)
    return left, top, right - left, bottom - top


def choose_crop_box(source: Path | str) -> Box:
    """Choose a conservative original-resolution board ROI.

    Weak or ambiguous detection deliberately falls back to the full frame so a
    native fallback can never silently discard board content.
    """

    representative, scale = _representative_frame(source)
    detected = _board_box_from_frame(representative)
    original_height, original_width = representative.shape[:2]
    if detected is None:
        return 0, 0, int(round(original_width / scale)), int(round(original_height / scale))
    inverse_scale = 1.0 / scale
    return scaled_box(detected, inverse_scale)
