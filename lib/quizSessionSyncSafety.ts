export type SessionSyncCompleteness = {
  completedAt?: string | null;
  payloadCompletedAt?: string | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  payloadAttemptCount?: number | null;
  updatedAt?: string | null;
};

function completedAttemptCount(value: SessionSyncCompleteness) {
  return Math.max(
    0,
    Number(value.payloadAttemptCount ?? 0),
    Number(value.correctCount ?? 0) + Number(value.wrongCount ?? 0)
  );
}

function timestampValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function shouldProtectExistingCompletedSession(
  existing: SessionSyncCompleteness | null | undefined,
  incoming: SessionSyncCompleteness
) {
  const existingCompleted = Boolean(existing?.completedAt || existing?.payloadCompletedAt);
  if (!existingCompleted) return false;

  const incomingCompleted = Boolean(incoming.completedAt || incoming.payloadCompletedAt);
  if (!incomingCompleted) return true;

  const existingAttempts = completedAttemptCount(existing ?? {});
  const incomingAttempts = completedAttemptCount(incoming);
  if (existingAttempts > incomingAttempts) return true;
  if (existingAttempts < incomingAttempts) return false;

  return timestampValue(existing?.updatedAt) > timestampValue(incoming.updatedAt);
}
