import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimulationPaperScoreRow,
  getSimulationTimerPresentation,
  inferSimulationPaperKey
} from "./simulationPaperStats";
import type { Attempt, QuizSession, QuizSettings } from "../types/quiz";

function makeAttempts(count: number, correctCount: number, prefix = "Q"): Attempt[] {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `${prefix}${String(index + 1).padStart(3, "0")}`,
    selectedAnswer: index < correctCount ? "A" : "B",
    correctAnswer: "A",
    isCorrect: index < correctCount,
    confidence: 3,
    answeredAt: `2026-07-14T01:${String(index % 60).padStart(2, "0")}:00.000Z`
  }));
}

function makeSession(
  overrides: Omit<Partial<QuizSession>, "settings"> & {
    settings?: Partial<QuizSettings>;
  } = {}
): QuizSession {
  const settings: QuizSettings = {
    mode: "simulation",
    questionCount: 100,
    subjectFilter: "醫學（一）",
    paperMode: "ai_paper",
    selectedPaperKey: "AI-MED1-113115-HUMANLIKE-002",
    ...overrides.settings
  };

  return {
    id: "session-1",
    subject: "解剖學",
    startedAt: "2026-07-14T00:00:00.000Z",
    completedAt: "2026-07-14T02:00:00.000Z",
    attempts: makeAttempts(100, 84),
    ...overrides,
    settings
  };
}

test("完整模擬考只產生一筆不含個資的分數摘要", () => {
  assert.deepEqual(buildSimulationPaperScoreRow(makeSession()), {
    session_id: "session-1",
    paper_key: "AI-MED1-113115-HUMANLIKE-002",
    score: 84,
    completed_at: "2026-07-14T02:00:00.000Z"
  });
});

test("三分以下、未完成與非模擬考不進入公開統計", () => {
  assert.equal(
    buildSimulationPaperScoreRow(
      makeSession({ attempts: makeAttempts(100, 3) })
    ),
    null
  );
  assert.equal(
    buildSimulationPaperScoreRow(
      makeSession({ completedAt: undefined })
    ),
    null
  );
  assert.equal(
    buildSimulationPaperScoreRow(
      makeSession({ settings: { mode: "random" } })
    ),
    null
  );
});

test("舊紀錄缺少 selectedPaperKey 時可由 AI 題號還原卷別", () => {
  const attempts = makeAttempts(
    100,
    70,
    "AI-MED1-113115-HUMANLIKE-002-Q"
  );
  const session = makeSession({
    attempts,
    questionOrder: attempts.map((attempt) => attempt.questionId),
    settings: { selectedPaperKey: undefined }
  });

  assert.equal(
    inferSimulationPaperKey(session),
    "AI-MED1-113115-HUMANLIKE-002"
  );
});

test("舊考古卷題號可還原 examCode 與 paperCode", () => {
  const attempts = makeAttempts(100, 70, "MOEX-105100-5301-Q");
  const session = makeSession({
    attempts,
    questionOrder: attempts.map((attempt) => attempt.questionId),
    settings: { selectedPaperKey: undefined }
  });

  assert.equal(inferSimulationPaperKey(session), "105100-5301");
});

test("官方不同考試軌道保留完整卷別識別", () => {
  const attempts = makeAttempts(3, 2, "MOEX-C101-095030-S1001-HIGHGENERAL-Q");
  const session = makeSession({ attempts, questionOrder: attempts.map((a) => a.questionId), settings: { selectedPaperKey: undefined } });
  assert.equal(inferSimulationPaperKey(session), "MOEX-C101-095030-S1001-HIGHGENERAL");
  session.questionOrder?.push("MOEX-C117-095030-S1001-STAGE1-Q001");
  assert.equal(inferSimulationPaperKey(session), undefined);
});

test("模擬考倒數歸零後不再提供暫停控制", () => {
  const presentation = getSimulationTimerPresentation({
    durationSeconds: 7_200,
    elapsedSeconds: 7_201,
    paused: false
  });

  assert.equal(presentation.remainingSeconds, 0);
  assert.equal(presentation.progressPercent, 100);
  assert.equal(presentation.expired, true);
  assert.equal(presentation.canTogglePause, false);
  assert.equal(presentation.controlLabel, "計時已結束");
  assert.match(presentation.statusMessage, /可以繼續寫完/);
});

test("模擬考倒數仍在進行時保留暫停與繼續語意", () => {
  assert.equal(
    getSimulationTimerPresentation({
      durationSeconds: 7_200,
      elapsedSeconds: 60,
      paused: false
    }).controlLabel,
    "暫停"
  );
  assert.equal(
    getSimulationTimerPresentation({
      durationSeconds: 7_200,
      elapsedSeconds: 60,
      paused: true
    }).controlLabel,
    "繼續"
  );
});

test("已知 80 題原卷完整作答後統計正確率，缺題、重複或空白不算完整", () => {
  const key = "MOEX-C217-091030-S4004-STAGE1";
  const attempts = makeAttempts(80, 61, `${key}-Q`);
  const session = makeSession({ attempts, questionOrder: attempts.map((a) => a.questionId), settings: { paperMode: "past_paper", selectedPaperKey: key, questionCount: 80 } });
  assert.equal(buildSimulationPaperScoreRow(session)?.score, 76); // 61/80 = 76.25%, rounded to stored integer percentage.
  assert.equal(buildSimulationPaperScoreRow({ ...session, attempts: attempts.slice(0, 79) }), null);
  assert.equal(buildSimulationPaperScoreRow({ ...session, attempts: [...attempts.slice(0, 79), attempts[0]] }), null);
  assert.equal(buildSimulationPaperScoreRow({ ...session, attempts: attempts.map((a, i) => i === 0 ? { ...a, selectedAnswer: "" as Attempt["selectedAnswer"] } : a) }), null);
  assert.equal(buildSimulationPaperScoreRow({ ...session, settings: { ...session.settings!, selectedPaperKey: "MOEX-C101-091030-S4004-HIGHGENERAL" } }), null);
  assert.equal(buildSimulationPaperScoreRow({ ...session, settings: { ...session.settings!, selectedPaperKey: undefined } })?.paper_key, key);
});
