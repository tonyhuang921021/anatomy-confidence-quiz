export const CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE = 60;

export type CloudSessionAttemptSummary = {
  id: string;
  questionCount?: number | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  payloadAttemptCount?: number | null;
};

export function getExpectedCloudAttemptCount(session: CloudSessionAttemptSummary) {
  const hasOutcomeCounts =
    typeof session.correctCount === "number" || typeof session.wrongCount === "number";

  if (hasOutcomeCounts) {
    return Math.max(0, (session.correctCount ?? 0) + (session.wrongCount ?? 0));
  }

  return Math.max(0, session.questionCount ?? 0);
}

export function getSessionIdsNeedingAttemptRows(sessions: CloudSessionAttemptSummary[]) {
  return sessions
    .filter(
      (session) =>
        Math.max(0, session.payloadAttemptCount ?? 0) < getExpectedCloudAttemptCount(session)
    )
    .map((session) => session.id);
}

export function buildCloudAttemptSessionChunks(
  sessionIds: string[],
  chunkSize = CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE
) {
  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueSessionIds.length; index += normalizedChunkSize) {
    chunks.push(uniqueSessionIds.slice(index, index + normalizedChunkSize));
  }

  return chunks;
}

export function findUnresolvedCompletedSessionIds(
  sessions: CloudSessionAttemptSummary[],
  attemptCounts: Iterable<readonly [string, number]>
) {
  const attemptCountBySession = new Map(attemptCounts);

  return sessions
    .filter((session) => {
      const expectedAttempts = getExpectedCloudAttemptCount(session);
      const resolvedAttempts = Math.max(
        Math.max(0, session.payloadAttemptCount ?? 0),
        Math.max(0, attemptCountBySession.get(session.id) ?? 0)
      );
      return resolvedAttempts < expectedAttempts;
    })
    .map((session) => session.id);
}
