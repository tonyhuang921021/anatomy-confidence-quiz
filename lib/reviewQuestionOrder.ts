import type { QuizSession, ReviewQuestionItem } from "../types/quiz";

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
  return items
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      latestReviewAttemptAt: latestAttemptByQuestionId.get(item.question.id)
    }))
    .sort((left, right) => {
      if (!left.latestReviewAttemptAt && right.latestReviewAttemptAt) return -1;
      if (left.latestReviewAttemptAt && !right.latestReviewAttemptAt) return 1;
      if (left.latestReviewAttemptAt && right.latestReviewAttemptAt) {
        const recencyOrder = left.latestReviewAttemptAt.localeCompare(right.latestReviewAttemptAt);
        if (recencyOrder !== 0) return recencyOrder;
      }
      return left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}
