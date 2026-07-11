import { getCurrentSessionWorkKey } from "./currentSessionSelection";
import type { QuizSession } from "../types/quiz";

export const MAX_RESUMABLE_SESSION_LIST = 8;

export function getCanonicalResumableSessionId(sessionId: string) {
  return sessionId.replace(/^user-[^:]+:/, "");
}

export function getResumableSessionActivity(session: QuizSession) {
  return (
    session.attempts
      .map((attempt) => attempt.answeredAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? session.startedAt ?? ""
  );
}

export function isResumableQuizSession(session?: QuizSession | null): session is QuizSession {
  return Boolean(
    session &&
      !session.completedAt &&
      (session.questionOrder?.length ?? session.generatedQuestions?.length ?? 0) > 0
  );
}

function preferredSession(left: QuizSession, right: QuizSession) {
  if (right.attempts.length !== left.attempts.length) {
    return right.attempts.length > left.attempts.length ? right : left;
  }

  const leftIndex = left.currentQuestionIndex ?? 0;
  const rightIndex = right.currentQuestionIndex ?? 0;
  if (rightIndex !== leftIndex) return rightIndex > leftIndex ? right : left;

  return getResumableSessionActivity(right) > getResumableSessionActivity(left)
    ? right
    : left;
}

export function mergeResumableQuizSessions(
  localSessions: Array<QuizSession | null | undefined>,
  cloudSessions: Array<QuizSession | null | undefined>,
  limit = MAX_RESUMABLE_SESSION_LIST
) {
  const byId = new Map<string, QuizSession>();

  for (const session of [...localSessions, ...cloudSessions].filter(isResumableQuizSession)) {
    const id = getCanonicalResumableSessionId(session.id);
    const current = byId.get(id);
    byId.set(id, current ? preferredSession(current, session) : session);
  }

  const byWork = new Map<string, QuizSession>();
  for (const session of byId.values()) {
    const workKey = getCurrentSessionWorkKey(session);
    const key = workKey || `session:${getCanonicalResumableSessionId(session.id)}`;
    const current = byWork.get(key);
    byWork.set(key, current ? preferredSession(current, session) : session);
  }

  return Array.from(byWork.values())
    .sort((left, right) =>
      getResumableSessionActivity(right).localeCompare(getResumableSessionActivity(left))
    )
    .slice(0, Math.max(1, limit));
}
