import type { QuizSession } from "@/types/quiz";

export type QuizSessionProgressPayload = Pick<
  QuizSession,
  | "currentQuestionIndex"
  | "isReviewingAnswer"
  | "optionEliminationMap"
  | "simulationElapsedSeconds"
  | "simulationTimerDurationSeconds"
>;

export function buildQuizSessionProgressPayload(
  session: QuizSession
): QuizSessionProgressPayload {
  return {
    currentQuestionIndex: session.completedAt ? undefined : session.currentQuestionIndex,
    isReviewingAnswer: session.completedAt ? undefined : session.isReviewingAnswer,
    optionEliminationMap: session.optionEliminationMap,
    simulationElapsedSeconds: session.simulationElapsedSeconds,
    simulationTimerDurationSeconds: session.simulationTimerDurationSeconds
  };
}

export function mergeQuizSessionProgressPayload(
  sessionPayload: Partial<QuizSession> | null | undefined,
  progressPayload: QuizSessionProgressPayload | null | undefined
): Partial<QuizSession> {
  if (!progressPayload) return sessionPayload ?? {};
  return {
    ...(sessionPayload ?? {}),
    ...progressPayload
  };
}

export function omitHeavySessionPayload<
  T extends { session_payload?: unknown }
>(row: T): Omit<T, "session_payload"> {
  const { session_payload: _sessionPayload, ...checkpointRow } = row;
  return checkpointRow;
}

function getStaticSessionPayload(payload: Partial<QuizSession> | null | undefined) {
  if (!payload) return {};
  const {
    currentQuestionIndex: _currentQuestionIndex,
    isReviewingAnswer: _isReviewingAnswer,
    optionEliminationMap: _optionEliminationMap,
    simulationElapsedSeconds: _simulationElapsedSeconds,
    simulationTimerDurationSeconds: _simulationTimerDurationSeconds,
    attempts: _attempts,
    ...staticPayload
  } = payload;
  return staticPayload;
}

export function hasQuizSessionDefinitionChanged(
  existingPayload: Partial<QuizSession> | null | undefined,
  incomingPayload: Partial<QuizSession> | null | undefined
) {
  return JSON.stringify(getStaticSessionPayload(existingPayload)) !==
    JSON.stringify(getStaticSessionPayload(incomingPayload));
}
