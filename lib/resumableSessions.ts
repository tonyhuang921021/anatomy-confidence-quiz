import {
  getCurrentSessionWorkKey,
  isMeaningfullyMoreCompleteProgress
} from "./currentSessionSelection";
import type { QuizSession } from "../types/quiz";

export const MAX_RESUMABLE_SESSION_LIST = 8;

export type ResumableQuizSessionListItem = {
  session: QuizSession;
  answeredCount: number;
  totalCount: number;
  lastActivityAt: string;
  needsCloudHydration: boolean;
};

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

export function isResumableSessionHydrationComplete(
  session: QuizSession | null | undefined,
  expectedAnsweredCount: number
) {
  return Boolean(
    isResumableQuizSession(session) &&
      session.attempts.length >= Math.max(0, expectedAnsweredCount)
  );
}

export function createResumableQuizSessionListItem(
  session: QuizSession,
  overrides: Partial<Omit<ResumableQuizSessionListItem, "session">> = {}
): ResumableQuizSessionListItem {
  return {
    session,
    answeredCount: session.attempts.length,
    totalCount: Math.max(
      session.settings?.questionCount ?? 0,
      session.questionOrder?.length ?? 0,
      session.generatedQuestions?.length ?? 0
    ),
    lastActivityAt: getResumableSessionActivity(session),
    needsCloudHydration: false,
    ...overrides
  };
}

function preferredItem(
  left: ResumableQuizSessionListItem,
  right: ResumableQuizSessionListItem
) {
  if (right.answeredCount !== left.answeredCount) {
    return right.answeredCount > left.answeredCount ? right : left;
  }

  const leftIndex = left.session.currentQuestionIndex ?? 0;
  const rightIndex = right.session.currentQuestionIndex ?? 0;
  if (rightIndex !== leftIndex) return rightIndex > leftIndex ? right : left;

  if (right.lastActivityAt !== left.lastActivityAt) {
    return right.lastActivityAt > left.lastActivityAt ? right : left;
  }

  return left.needsCloudHydration && !right.needsCloudHydration ? right : left;
}

export function mergeResumableQuizSessionItems(
  items: Array<ResumableQuizSessionListItem | null | undefined>,
  limit = MAX_RESUMABLE_SESSION_LIST
) {
  const byId = new Map<string, ResumableQuizSessionListItem>();

  for (const item of items.filter(
    (candidate): candidate is ResumableQuizSessionListItem =>
      Boolean(candidate && !candidate.session.completedAt && candidate.totalCount > 0)
  )) {
    const id = getCanonicalResumableSessionId(item.session.id);
    const current = byId.get(id);
    byId.set(id, current ? preferredItem(current, item) : item);
  }

  const byWork = new Map<string, ResumableQuizSessionListItem>();
  for (const item of byId.values()) {
    const workKey = getCurrentSessionWorkKey(item.session);
    const key = workKey || `session:${getCanonicalResumableSessionId(item.session.id)}`;
    const current = byWork.get(key);
    byWork.set(key, current ? preferredItem(current, item) : item);
  }

  return Array.from(byWork.values())
    .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
    .slice(0, Math.max(1, limit));
}

export function chooseMoreCompleteResumableSessionItem(
  current: QuizSession,
  candidates: ResumableQuizSessionListItem[]
) {
  const currentId = getCanonicalResumableSessionId(current.id);
  const currentWorkKey = getCurrentSessionWorkKey(current);

  return candidates
    .filter((candidate) => {
      const candidateId = getCanonicalResumableSessionId(candidate.session.id);
      return (
        candidateId === currentId ||
        Boolean(
          currentWorkKey &&
            getCurrentSessionWorkKey(candidate.session) === currentWorkKey
        )
      );
    })
    .filter((candidate) =>
      isMeaningfullyMoreCompleteProgress(
        candidate.answeredCount,
        current.attempts.length
      )
    )
    .sort((left, right) => {
      if (right.answeredCount !== left.answeredCount) {
        return right.answeredCount - left.answeredCount;
      }
      return right.lastActivityAt.localeCompare(left.lastActivityAt);
    })[0] ?? null;
}

export function mergeResumableQuizSessions(
  localSessions: Array<QuizSession | null | undefined>,
  cloudSessions: Array<QuizSession | null | undefined>,
  limit = MAX_RESUMABLE_SESSION_LIST
) {
  return mergeResumableQuizSessionItems(
    [...localSessions, ...cloudSessions]
      .filter(isResumableQuizSession)
      .map((session) => createResumableQuizSessionListItem(session)),
    limit
  ).map((item) => item.session);
}
