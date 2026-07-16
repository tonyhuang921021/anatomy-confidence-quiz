import type { QuizSession, ReviewQuestionItem } from "../types/quiz";

const NEARBY_REVIEW_WINDOW_MS = 6 * 60 * 60 * 1000;

type ReviewOrderEntry = {
  item: ReviewQuestionItem;
  originalIndex: number;
  latestQuestionAttemptAt?: number;
  latestReviewAttemptAt?: number;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function interleaveNearbyReviewItems(entries: ReviewOrderEntry[], seed: string) {
  const entriesBySubject = new Map<string, ReviewOrderEntry[]>();

  for (const entry of entries) {
    const subjectEntries = entriesBySubject.get(entry.item.question.subject) ?? [];
    subjectEntries.push(entry);
    entriesBySubject.set(entry.item.question.subject, subjectEntries);
  }

  for (const subjectEntries of entriesBySubject.values()) {
    subjectEntries.sort((left, right) => {
      const leftHash = stableHash(`${seed}:${left.item.question.id}`);
      const rightHash = stableHash(`${seed}:${right.item.question.id}`);
      return leftHash - rightHash || left.originalIndex - right.originalIndex;
    });
  }

  const subjects = Array.from(entriesBySubject.keys()).sort(
    (left, right) => stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`)
  );
  const subjectIndexes = new Map(subjects.map((subject) => [subject, 0]));
  const result: ReviewOrderEntry[] = [];

  while (result.length < entries.length) {
    for (const subject of subjects) {
      const subjectEntries = entriesBySubject.get(subject) ?? [];
      const subjectIndex = subjectIndexes.get(subject) ?? 0;
      const nextEntry = subjectEntries[subjectIndex];
      if (!nextEntry) continue;
      result.push(nextEntry);
      subjectIndexes.set(subject, subjectIndex + 1);
    }
  }

  return result;
}

function buildAttemptBuckets(
  entries: ReviewOrderEntry[],
  getAttemptAt: (entry: ReviewOrderEntry) => number | undefined
) {
  const sortedEntries = [...entries].sort((left, right) => {
    const recencyOrder = (getAttemptAt(left) ?? 0) - (getAttemptAt(right) ?? 0);
    return recencyOrder || left.originalIndex - right.originalIndex;
  });
  const buckets: Array<{ startedAt: number; entries: ReviewOrderEntry[] }> = [];

  for (const entry of sortedEntries) {
    const attemptedAt = getAttemptAt(entry) ?? 0;
    const currentBucket = buckets.at(-1);
    if (!currentBucket || attemptedAt - currentBucket.startedAt > NEARBY_REVIEW_WINDOW_MS) {
      buckets.push({ startedAt: attemptedAt, entries: [entry] });
    } else {
      currentBucket.entries.push(entry);
    }
  }

  return buckets;
}

export function buildLatestReviewAttemptMap(
  sessions: QuizSession[],
  poolLabels: readonly string[]
) {
  const allowedPoolLabels = new Set(poolLabels);
  const latestAttemptByQuestionId = new Map<string, string>();

  for (const session of sessions) {
    if (session.settings?.mode !== "review") continue;
    if (!allowedPoolLabels.has(session.settings.customPoolLabel ?? "")) continue;

    for (const attempt of session.attempts) {
      const previous = latestAttemptByQuestionId.get(attempt.questionId);
      if (!previous || attempt.answeredAt > previous) {
        latestAttemptByQuestionId.set(attempt.questionId, attempt.answeredAt);
      }
    }
  }

  return latestAttemptByQuestionId;
}

export function orderReviewItemsForNextRound(
  items: ReviewQuestionItem[],
  latestAttemptByQuestionId: ReadonlyMap<string, string>
) {
  const entries = items.map((item, originalIndex): ReviewOrderEntry => {
    const latestAttempt = latestAttemptByQuestionId.get(item.question.id);
    const parsedAttemptAt = latestAttempt ? Date.parse(latestAttempt) : Number.NaN;
    const parsedQuestionAttemptAt = item.history.lastAttemptedAt
      ? Date.parse(item.history.lastAttemptedAt)
      : Number.NaN;
    return {
      item,
      originalIndex,
      latestQuestionAttemptAt: Number.isFinite(parsedQuestionAttemptAt)
        ? parsedQuestionAttemptAt
        : undefined,
      latestReviewAttemptAt: Number.isFinite(parsedAttemptAt) ? parsedAttemptAt : undefined
    };
  });
  const freshEntries = entries.filter((entry) => entry.latestReviewAttemptAt === undefined);
  const reviewedEntries = entries.filter((entry) => entry.latestReviewAttemptAt !== undefined);
  const freshBuckets = buildAttemptBuckets(
    freshEntries,
    (entry) => entry.latestQuestionAttemptAt
  );
  const reviewedBuckets = buildAttemptBuckets(
    reviewedEntries,
    (entry) => entry.latestReviewAttemptAt
  );

  return [
    // Never-reviewed questions stay first, but a newly missed question should not immediately repeat.
    ...freshBuckets.flatMap((bucket) =>
      interleaveNearbyReviewItems(
        bucket.entries,
        bucket.startedAt === 0 ? "fresh" : `fresh:${bucket.startedAt}`
      )
    ),
    ...reviewedBuckets.flatMap((bucket) =>
      interleaveNearbyReviewItems(bucket.entries, `reviewed:${bucket.startedAt}`)
    )
  ].map(({ item }) => item);
}
