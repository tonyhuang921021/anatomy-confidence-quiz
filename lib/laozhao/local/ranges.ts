import { createLaoZhaoInvalidDataError } from "./errors";
import type { LaoZhaoProgressRecord, WatchedRange } from "./types";

const RANGE_MERGE_GAP_SEC = 0.25;

function finiteNonNegative(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw createLaoZhaoInvalidDataError(`${fieldName} 必須是大於等於 0 的有限數字。`);
  }
  return value;
}

function normalizeVideoId(videoId: string) {
  const normalized = videoId.trim();
  if (!normalized) {
    throw createLaoZhaoInvalidDataError("videoId 不可為空白。", "read");
  }
  return normalized;
}

export function normalizeWatchedRanges(
  ranges: WatchedRange[],
  durationSec = 0
): WatchedRange[] {
  if (!Array.isArray(ranges)) {
    throw createLaoZhaoInvalidDataError("watchedRanges 必須是陣列。", "read");
  }

  const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const normalized = ranges
    .map((range) => {
      const startSec = finiteNonNegative(Number(range.startSec), "watchedRanges.startSec");
      const endSec = finiteNonNegative(Number(range.endSec), "watchedRanges.endSec");
      const clampedStart = duration > 0 ? Math.min(startSec, duration) : startSec;
      const clampedEnd = duration > 0 ? Math.min(endSec, duration) : endSec;
      return { startSec: clampedStart, endSec: clampedEnd };
    })
    .filter((range) => range.endSec > range.startSec);

  normalized.sort((left, right) => {
    if (left.startSec !== right.startSec) return left.startSec - right.startSec;
    return left.endSec - right.endSec;
  });

  const merged: WatchedRange[] = [];
  for (const range of normalized) {
    const previous = merged[merged.length - 1];
    if (!previous || range.startSec > previous.endSec + RANGE_MERGE_GAP_SEC) {
      merged.push({ ...range });
      continue;
    }
    previous.endSec = Math.max(previous.endSec, range.endSec);
  }

  return merged;
}

export function mergeWatchedRanges(
  existingRanges: WatchedRange[],
  incomingRanges: WatchedRange[],
  durationSec = 0
) {
  return normalizeWatchedRanges([...existingRanges, ...incomingRanges], durationSec);
}

export function normalizeProgressRecord(record: LaoZhaoProgressRecord): LaoZhaoProgressRecord {
  const videoId = normalizeVideoId(record.videoId);
  const durationSec = finiteNonNegative(Number(record.durationSec), "durationSec");
  const lastPositionSec = Math.min(
    finiteNonNegative(Number(record.lastPositionSec), "lastPositionSec"),
    durationSec > 0 ? durationSec : Number.POSITIVE_INFINITY
  );
  const updatedAt = finiteNonNegative(Number(record.updatedAt), "updatedAt");

  return {
    videoId,
    lastPositionSec,
    durationSec,
    watchedRanges: normalizeWatchedRanges(record.watchedRanges, durationSec),
    ended: Boolean(record.ended),
    updatedAt
  };
}

export function mergeProgressRecords(
  existing: LaoZhaoProgressRecord | null | undefined,
  incoming: LaoZhaoProgressRecord
): LaoZhaoProgressRecord {
  const normalizedIncoming = normalizeProgressRecord(incoming);
  if (!existing) return normalizedIncoming;

  const normalizedExisting = normalizeProgressRecord(existing);
  if (normalizedExisting.videoId !== normalizedIncoming.videoId) {
    throw createLaoZhaoInvalidDataError("不能合併不同 videoId 的作答進度。", "write");
  }

  const durationSec = Math.max(normalizedExisting.durationSec, normalizedIncoming.durationSec);
  const latest =
    normalizedIncoming.updatedAt >= normalizedExisting.updatedAt
      ? normalizedIncoming
      : normalizedExisting;

  return {
    videoId: normalizedIncoming.videoId,
    lastPositionSec: Math.min(
      latest.lastPositionSec,
      durationSec > 0 ? durationSec : Number.POSITIVE_INFINITY
    ),
    durationSec,
    watchedRanges: mergeWatchedRanges(
      normalizedExisting.watchedRanges,
      normalizedIncoming.watchedRanges,
      durationSec
    ),
    ended: normalizedExisting.ended || normalizedIncoming.ended,
    updatedAt: Math.max(normalizedExisting.updatedAt, normalizedIncoming.updatedAt)
  };
}
