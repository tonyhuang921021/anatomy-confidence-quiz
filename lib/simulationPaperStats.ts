import type { QuizSession } from "@/types/quiz";

export const SIMULATION_PAPER_SCORE_BUCKETS = [
  { key: "score0To39", label: "0–39" },
  { key: "score40To59", label: "40–59" },
  { key: "score60To69", label: "60–69" },
  { key: "score70To79", label: "70–79" },
  { key: "score80To89", label: "80–89" },
  { key: "score90To100", label: "90–100" }
] as const;

export type SimulationPaperScoreBucketKey =
  (typeof SIMULATION_PAPER_SCORE_BUCKETS)[number]["key"];

export type SimulationPaperStats = {
  paperKey: string;
  sampleCount: number;
  averageScore: number | null;
  available: boolean;
  minimumSampleSize: number;
  unavailableReason?: string;
  buckets: Record<SimulationPaperScoreBucketKey, number>;
};

export type SimulationPaperScoreRow = {
  session_id: string;
  paper_key: string;
  score: number;
  completed_at: string;
};

export type SimulationTimerPresentation = {
  remainingSeconds: number;
  progressPercent: number;
  expired: boolean;
  canTogglePause: boolean;
  controlLabel: "暫停" | "繼續" | "計時已結束";
  statusMessage: string;
};

export function getSimulationTimerPresentation({
  durationSeconds,
  elapsedSeconds,
  paused
}: {
  durationSeconds: number;
  elapsedSeconds: number;
  paused: boolean;
}): SimulationTimerPresentation {
  const safeDuration = Math.max(1, Math.floor(durationSeconds));
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const expired = safeElapsed >= safeDuration;

  return {
    remainingSeconds: Math.max(0, safeDuration - safeElapsed),
    progressPercent: Math.min(100, Math.max(0, (safeElapsed / safeDuration) * 100)),
    expired,
    canTogglePause: !expired,
    controlLabel: expired ? "計時已結束" : paused ? "繼續" : "暫停",
    statusMessage: expired
      ? "計時已結束，不會自動交卷，可以繼續寫完。"
      : paused
        ? "已暫停，按繼續後才會接著計時。"
        : "只用來控時，不會自動交卷。"
  };
}

const SAFE_PAPER_KEY_PATTERN = /^[A-Z0-9-]{3,80}$/i;

export function isSafeSimulationPaperKey(value: string) {
  return SAFE_PAPER_KEY_PATTERN.test(value);
}

function inferPaperKeyFromQuestionIds(questionIds: string[]) {
  const paperKeys = new Set<string>();

  for (const questionId of questionIds) {
    const pastPaperMatch = questionId.match(/^MOEX-([^-]+)-([^-]+)-Q\d+$/);
    if (pastPaperMatch) {
      paperKeys.add(`${pastPaperMatch[1]}-${pastPaperMatch[2]}`);
    }

    const aiPaperMatch = questionId.match(/^(AI-[A-Z0-9-]+)-Q\d+$/);
    if (aiPaperMatch) {
      paperKeys.add(aiPaperMatch[1]);
    }
  }

  return paperKeys.size === 1 ? Array.from(paperKeys)[0] : undefined;
}

export function inferSimulationPaperKey(session: QuizSession) {
  const selectedPaperKey = session.settings?.selectedPaperKey?.trim();
  if (selectedPaperKey && isSafeSimulationPaperKey(selectedPaperKey)) {
    return selectedPaperKey;
  }

  return inferPaperKeyFromQuestionIds([
    ...(session.questionOrder ?? []),
    ...session.attempts.map((attempt) => attempt.questionId)
  ]);
}

export function buildSimulationPaperScoreRow(
  session: QuizSession
): SimulationPaperScoreRow | null {
  if (
    session.settings?.mode !== "simulation" ||
    !session.completedAt ||
    session.attempts.length !== 100
  ) {
    return null;
  }

  const paperKey = inferSimulationPaperKey(session);
  if (!paperKey) return null;

  const correctCount = session.attempts.filter((attempt) => attempt.isCorrect).length;
  const score = Math.round((correctCount / session.attempts.length) * 100);
  if (score <= 3) return null;

  return {
    session_id: session.id,
    paper_key: paperKey,
    score,
    completed_at: session.completedAt
  };
}
