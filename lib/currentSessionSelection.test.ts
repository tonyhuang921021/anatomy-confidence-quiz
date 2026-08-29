import test from "node:test";
import assert from "node:assert/strict";
import type { Attempt, QuizSession } from "../types/quiz";
import {
  chooseMoreCompleteSessionForSameWork,
  getCurrentSessionWorkKey,
  isMeaningfullyMoreCompleteProgress
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

test("只有摘要計數時也沿用相同的完整度門檻", () => {
  assert.equal(isMeaningfullyMoreCompleteProgress(10, 8), false);
  assert.equal(isMeaningfullyMoreCompleteProgress(12, 8), true);
  assert.equal(isMeaningfullyMoreCompleteProgress(87, 2), true);
});

test("不同搜尋題組不會被當成同一份私人練習", () => {
  const first = makeSimulationSession({ id: "search-a", attemptCount: 1 });
  first.subject = "醫學（一）";
  first.settings = {
    mode: "search_practice",
    questionCount: 3,
    customPoolLabel: "搜尋私人練習",
    customQuestionIds: ["A1", "A2", "A3"]
  };
  first.questionOrder = ["A1", "A2", "A3"];

  const second = makeSimulationSession({ id: "search-b", attemptCount: 3 });
  second.subject = "醫學（一）";
  second.settings = {
    mode: "search_practice",
    questionCount: 3,
    customPoolLabel: "搜尋私人練習",
    customQuestionIds: ["B1", "B2", "B3"]
  };
  second.questionOrder = ["B1", "B2", "B3"];

  assert.notEqual(getCurrentSessionWorkKey(first), getCurrentSessionWorkKey(second));
  assert.equal(chooseMoreCompleteSessionForSameWork(first, [second]), null);
});
