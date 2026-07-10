export const CLOUD_ATTEMPT_SESSION_FETCH_CHUNK_SIZE = 60;

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
  sessions: Array<{ id: string; questionCount?: number | null }>,
  attemptSessionIds: Iterable<string>,
  payloadSessionIds: Iterable<string>
) {
  const attemptIds = new Set(attemptSessionIds);
  const payloadIds = new Set(payloadSessionIds);

  return sessions
    .filter((session) => {
      const expectedAttempts = Math.max(0, session.questionCount ?? 0);
      return expectedAttempts > 0 && !attemptIds.has(session.id) && !payloadIds.has(session.id);
    })
    .map((session) => session.id);
}
