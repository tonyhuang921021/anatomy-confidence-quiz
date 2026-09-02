import type { Attempt, OptionKey, QuizSession } from "../types/quiz";

export const CURRENT_ANSWER_KEY_REVISION = "moex-115090-appeal-v1";
export const CURRENT_ANSWER_KEY_REVISION_APPLIED_AT = "2026-09-02";

type AnswerKeyRevisionRule = {
  acceptedAnswers: readonly OptionKey[] | "all";
};

const ANSWER_KEY_REVISION_RULES: Readonly<Record<string, AnswerKeyRevisionRule>> = {
  "MOEX-115090-1301-Q063": { acceptedAnswers: ["B", "D"] },
  "MOEX-115090-1301-Q066": { acceptedAnswers: "all" },
  "MOEX-115090-2301-Q014": { acceptedAnswers: "all" },
  "MOEX-115090-2301-Q025": { acceptedAnswers: "all" },
  "MOEX-115090-2301-Q055": { acceptedAnswers: "all" },
  "MOEX-115090-2301-Q068": { acceptedAnswers: "all" },
  "MOEX-115090-2301-Q095": { acceptedAnswers: ["A", "D"] },
  "MOEX-115090-2301-Q098": { acceptedAnswers: "all" }
};

export const ANSWER_KEY_REVISION_QUESTION_IDS = Object.freeze(
  Object.keys(ANSWER_KEY_REVISION_RULES)
);

export function hasAnswerKeyRevision(questionId: string) {
  return Boolean(ANSWER_KEY_REVISION_RULES[questionId]);
}

export function getRegradedCorrectness(
  questionId: string,
  selectedAnswer: OptionKey,
  fallback: boolean
) {
  const rule = ANSWER_KEY_REVISION_RULES[questionId];
  if (!rule) return fallback;
  if (rule.acceptedAnswers === "all") return true;
  return rule.acceptedAnswers.includes(selectedAnswer);
}

export function regradeAttemptForCurrentAnswerKey<T extends Attempt>(attempt: T): T {
  const isCorrect = getRegradedCorrectness(
    attempt.questionId,
    attempt.selectedAnswer,
    attempt.isCorrect
  );

  if (isCorrect === attempt.isCorrect) {
    return attempt;
  }

  return {
    ...attempt,
    isCorrect,
    errorType: isCorrect ? undefined : attempt.errorType
  };
}

export function regradeSessionForCurrentAnswerKey<T extends QuizSession>(
  session: T
): T & QuizSession {
  const previousCorrectCount = session.attempts.filter((attempt) => attempt.isCorrect).length;
  let changed = false;
  const attempts = session.attempts.map((attempt) => {
    const regraded = regradeAttemptForCurrentAnswerKey(attempt);
    if (regraded !== attempt) changed = true;
    return regraded;
  });

  if (!changed) return session;

  const regradedCorrectCount = attempts.filter((attempt) => attempt.isCorrect).length;
  const scoreRevisions = Array.isArray(session.scoreRevisions)
    ? session.scoreRevisions.filter(
        (revision) =>
          revision &&
          typeof revision.revisionId === "string" &&
          Number.isFinite(revision.previousCorrectCount) &&
          Number.isFinite(revision.regradedCorrectCount) &&
          Number.isFinite(revision.totalCount)
      )
    : [];
  const hasCurrentRevision = scoreRevisions.some(
    (revision) => revision.revisionId === CURRENT_ANSWER_KEY_REVISION
  );

  return {
    ...session,
    attempts,
    scoreRevisions: hasCurrentRevision
      ? scoreRevisions
      : [
          ...scoreRevisions,
          {
            revisionId: CURRENT_ANSWER_KEY_REVISION,
            previousCorrectCount,
            regradedCorrectCount,
            totalCount: attempts.length,
            appliedAt: CURRENT_ANSWER_KEY_REVISION_APPLIED_AT
          }
        ]
  };
}
