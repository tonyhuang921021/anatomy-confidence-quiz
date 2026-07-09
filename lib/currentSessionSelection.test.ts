import test from "node:test";
import assert from "node:assert/strict";
import type { Attempt, QuizSession } from "../types/quiz";
import {
  chooseMoreCompleteSessionForSameWork,
  getCurrentSessionWorkKey
} from "./currentSessionSelection";

function makeAttempts(count: number, startedAt: string): Attempt[] {
  const started = new Date(startedAt).getTime();
  return Array.from({ length: count }, (_, index) => ({
    questionId: `MOEX-113090-1301-Q${String(index + 1).padStart(3, "0")}`,
    selectedAnswer: "A",
    correctAnswer: "A",
    isCorrect: true,
    confidence: 4,
    answeredAt: new Date(started + (index + 1) * 1000).toISOString()
  }));
}

function makeSimulationSession(
  overrides: Partial<QuizSession> & {
    id: string;
    sessionName?: string;
    selectedPaperKey?: string;
    attemptCount?: number;
  }
): QuizSession {
  const {
    attemptCount,
    currentQuestionIndex,
    selectedPaperKey: overrideSelectedPaperKey,
    sessionName: overrideSessionName,
    startedAt: overrideStartedAt,
    ...sessionOverrides
  } = overrides;
  const startedAt = overrideStartedAt ?? "2026-07-09T01:28:19.937Z";
  const sessionName = overrideSessionName ?? "2024 第2次 醫學（一） 1301";
  const selectedPaperKey = overrideSelectedPaperKey ?? "2024-2-1301";
  return {
    ...sessionOverrides,
    subject: "醫學（一）",
    startedAt,
    settings: {
      mode: "simulation",
      questionCount: 100,
      subjectFilter: "醫學（一）",
      paperMode: "past_paper",
      sessionName,
      selectedPaperKey
    },
    questionOrder: Array.from({ length: 100 }, (_, index) => (
      `MOEX-113090-1301-Q${String(index + 1).padStart(3, "0")}`
    )),
    currentQuestionIndex: currentQuestionIndex ?? 0,
    attempts: makeAttempts(attemptCount ?? 0, startedAt)
  };
}

test("同一份考卷雲端進度較完整時，較完整的 session 會勝出", () => {
  const localDuplicate = makeSimulationSession({
    id: "user-u1:session-new",
    startedAt: "2026-07-09T03:48:39.869Z",
    currentQuestionIndex: 1,
    attemptCount: 2
  });
  const remoteOriginal = makeSimulationSession({
    id: "user-u1:session-original",
    startedAt: "2026-07-09T01:28:19.937Z",
    currentQuestionIndex: 87,
    attemptCount: 87
  });

  assert.equal(
    getCurrentSessionWorkKey(localDuplicate),
    getCurrentSessionWorkKey(remoteOriginal)
  );
  assert.equal(
    chooseMoreCompleteSessionForSameWork(localDuplicate, [localDuplicate, remoteOriginal])?.id,
    remoteOriginal.id
  );
});

test("不同考卷即使候選比較完整也不會互相覆蓋", () => {
  const current = makeSimulationSession({
    id: "user-u1:session-current",
    selectedPaperKey: "2024-2-1301",
    sessionName: "2024 第2次 醫學（一） 1301",
    attemptCount: 2
  });
  const otherPaper = makeSimulationSession({
    id: "user-u1:session-other",
    selectedPaperKey: "2023-2-1301",
    sessionName: "2023 第2次 醫學（一） 1301",
    attemptCount: 87
  });

  assert.equal(chooseMoreCompleteSessionForSameWork(current, [otherPaper]), null);
});

test("同一份考卷但候選比較短時不會覆蓋目前 session", () => {
  const current = makeSimulationSession({
    id: "user-u1:session-current",
    attemptCount: 50
  });
  const shorter = makeSimulationSession({
    id: "user-u1:session-shorter",
    attemptCount: 2
  });

  assert.equal(chooseMoreCompleteSessionForSameWork(current, [shorter]), null);
});

test("同一份考卷但候選只多一兩題時不會覆蓋目前 session", () => {
  const current = makeSimulationSession({
    id: "user-u1:session-current",
    attemptCount: 8
  });
  const onlySlightlyLonger = makeSimulationSession({
    id: "user-u1:session-slightly-longer",
    attemptCount: 10
  });

  assert.equal(chooseMoreCompleteSessionForSameWork(current, [onlySlightlyLonger]), null);
});
