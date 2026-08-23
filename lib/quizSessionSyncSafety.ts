import type { Attempt } from "@/types/quiz";

export type SessionSyncCompleteness = {
  completedAt?: string | null;
  payloadCompletedAt?: string | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  payloadAttemptCount?: number | null;
  updatedAt?: string | null;
};

function attemptTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function hasCoveredEliminatedOptions(candidate: Attempt, required: Attempt) {
  const candidateOptions = new Set(candidate.eliminatedOptions ?? []);
  return (required.eliminatedOptions ?? []).every((option) =>
    candidateOptions.has(option)
  );
}

function hasSameAttemptContent(candidate: Attempt, required: Attempt) {
  return (
    candidate.selectedAnswer === required.selectedAnswer &&
    candidate.correctAnswer === required.correctAnswer &&
    candidate.isCorrect === required.isCorrect &&
    candidate.confidence === required.confidence &&
    candidate.errorType === required.errorType
  );
}

export function doesAttemptListCover(
  candidateAttempts: Attempt[],
  requiredAttempts: Attempt[]
) {
  const candidateByQuestionId = new Map(
    candidateAttempts.map((attempt) => [attempt.questionId, attempt] as const)
  );

  return requiredAttempts.every((requiredAttempt) => {
    const candidateAttempt = candidateByQuestionId.get(requiredAttempt.questionId);
    if (!candidateAttempt) return false;
    if (!hasCoveredEliminatedOptions(candidateAttempt, requiredAttempt)) {
      return false;
    }

    const candidateAnsweredAt = attemptTimestamp(candidateAttempt.answeredAt);
    const requiredAnsweredAt = attemptTimestamp(requiredAttempt.answeredAt);
    if (candidateAnsweredAt > requiredAnsweredAt) return true;

    return hasSameAttemptContent(candidateAttempt, requiredAttempt);
  });
}

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
