import type { SavedQuestionRecord } from "@/types/quiz";

type TimestampedSyncRecord = {
  updatedAt: string;
};

export function chooseNewestTimestampedRecord<T extends TimestampedSyncRecord>(
  cloudRecord: T | undefined,
  localRecord: T | undefined
) {
  if (!cloudRecord) return localRecord ?? null;
  if (!localRecord) return cloudRecord;
  return localRecord.updatedAt > cloudRecord.updatedAt ? localRecord : cloudRecord;
}

export function mergeSavedQuestionSyncRecords(
  cloudRecord: SavedQuestionRecord | undefined,
  localRecord: SavedQuestionRecord | undefined
) {
  if (!cloudRecord) return localRecord ?? null;
  if (!localRecord) return cloudRecord;

  const lastAnsweredAt = [cloudRecord.lastAnsweredAt, localRecord.lastAnsweredAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    ...cloudRecord,
    source: cloudRecord.source ?? localRecord.source,
    addedAt:
      cloudRecord.addedAt <= localRecord.addedAt
        ? cloudRecord.addedAt
        : localRecord.addedAt,
    updatedAt:
      cloudRecord.updatedAt >= localRecord.updatedAt
        ? cloudRecord.updatedAt
        : localRecord.updatedAt,
    correctCount: Math.max(cloudRecord.correctCount, localRecord.correctCount),
    attempts: Math.max(cloudRecord.attempts, localRecord.attempts),
    lastAnsweredAt
  } satisfies SavedQuestionRecord;
}

export function shouldUpsertLocalRecord<T extends TimestampedSyncRecord>(
  localRecord: T,
  cloudRecord: T | undefined,
  recordsAreEqual: (left: T, right: T) => boolean
) {
  if (!cloudRecord) return true;
  if (recordsAreEqual(localRecord, cloudRecord)) return false;

  const timestampComparison = localRecord.updatedAt.localeCompare(cloudRecord.updatedAt);
  if (timestampComparison > 0) return true;
  if (timestampComparison < 0) return false;

  return true;
}

export function getCloudSyncRetryDelayMs(
  failureCount: number,
  options: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
    randomValue?: number;
  } = {}
) {
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 15_000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 5 * 60_000);
  const jitterRatio = Math.min(1, Math.max(0, options.jitterRatio ?? 0.2));
  const randomValue = Math.min(1, Math.max(0, options.randomValue ?? Math.random()));
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.max(0, Math.floor(failureCount))
  );
  const jitterMultiplier = 1 + (randomValue * 2 - 1) * jitterRatio;

  return Math.min(
    maxDelayMs,
    Math.max(baseDelayMs, Math.round(exponentialDelay * jitterMultiplier))
  );
}
