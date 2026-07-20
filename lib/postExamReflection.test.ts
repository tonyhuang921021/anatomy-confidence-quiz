import assert from "node:assert/strict";
import test from "node:test";
import { POST_EXAM_SEASON_SNAPSHOT } from "../data/postExamSeasonSnapshot";
import {
  POST_EXAM_CUTOFF_AT,
  POST_EXAM_MINIMUM_ATTEMPTS,
  buildPostExamCumulativePoints,
  buildPostExamPersonalSnapshot,
  getPostExamTotalAttempts,
  groupPostExamSimulationsByYear,
  inferPostExamSubject,
  isPostExamSnapshotEligible,
  mergePostExamSnapshotWithLocal,
  summarizeLocalPostExamSessions,
  validatePostExamSurveyAnswers
} from "./postExamReflection";
import type { QuizSession } from "../types/quiz";

function makeSession(overrides: Partial<QuizSession> = {}): QuizSession {
  return {
    id: "local-session-1",
    subject: "醫學（一）",
    startedAt: "2026-07-10T00:00:00.000Z",
    completedAt: "2026-07-10T01:00:00.000Z",
    settings: {
      mode: "simulation",
      questionCount: 100,
      selectedPaperKey: "AI-MED1-113115-HUMANLIKE-001",
      sessionName: "gpt5.6 出的醫學一"
    },
    questionOrder: Array.from({ length: 100 }, (_, index) =>
      `AI-MED1-113115-HUMANLIKE-001-Q${index + 1}`
    ),
    attempts: Array.from({ length: 100 }, (_, index) => ({
      questionId: `AI-MED1-113115-HUMANLIKE-001-Q${index + 1}`,
      selectedAnswer: "A" as const,
      correctAnswer: "A" as const,
      isCorrect: index < 72,
      confidence: 3 as const,
      answeredAt: `2026-07-10T00:${String(index % 60).padStart(2, "0")}:00.000Z`
    })),
    ...overrides
  };
}

test("全站固定日資料精確加總到國考截止時間", () => {
  assert.equal(
    POST_EXAM_SEASON_SNAPSHOT.daily.reduce((sum, point) => sum + point.attempts, 0),
    POST_EXAM_SEASON_SNAPSHOT.totalAttempts
  );
  assert.equal(
    POST_EXAM_SEASON_SNAPSHOT.daily.reduce((sum, point) => sum + point.correct, 0),
    POST_EXAM_SEASON_SNAPSHOT.correctAttempts
  );
  assert.equal(POST_EXAM_SEASON_SNAPSHOT.daily.at(-1)?.attempts, 4419);
});

test("截止時間之後的 session 不會進入個人快照", () => {
  const snapshot = buildPostExamPersonalSnapshot(
    [
      {
        session_id: "before",
        mode: "random",
        attempts: 10,
        correct_attempts: 8,
        completed_at: POST_EXAM_CUTOFF_AT
      },
      {
        session_id: "after",
        mode: "random",
        attempts: 10,
        correct_attempts: 9,
        completed_at: "2026-07-17T07:00:00.001Z"
      }
    ],
    []
  );
  assert.deepEqual(snapshot.sessions.map((session) => session.sessionId), ["before"]);
});

test("考後回顧資格嚴格要求超過 200 題", () => {
  const atThreshold = buildPostExamPersonalSnapshot(
    [
      {
        session_id: "exactly-200",
        mode: "random",
        attempts: POST_EXAM_MINIMUM_ATTEMPTS,
        correct_attempts: 150,
        completed_at: POST_EXAM_CUTOFF_AT
      }
    ],
    []
  );
  const overThreshold = buildPostExamPersonalSnapshot(
    [
      {
        session_id: "exactly-200",
        mode: "random",
        attempts: POST_EXAM_MINIMUM_ATTEMPTS,
        correct_attempts: 150,
        completed_at: POST_EXAM_CUTOFF_AT
      },
      {
        session_id: "one-more",
        mode: "random",
        attempts: 1,
        correct_attempts: 1,
        completed_at: POST_EXAM_CUTOFF_AT
      }
    ],
    []
  );

  assert.equal(getPostExamTotalAttempts(atThreshold.sessions), 200);
  assert.equal(isPostExamSnapshotEligible(atThreshold), false);
  assert.equal(getPostExamTotalAttempts(overThreshold.sessions), 201);
  assert.equal(isPostExamSnapshotEligible(overThreshold), true);
});

test("本機合併只補缺少的 session，不覆蓋同 ID 雲端紀錄", () => {
  const cloud = buildPostExamPersonalSnapshot(
    [
      {
        session_id: "same",
        mode: "simulation",
        attempts: 100,
        correct_attempts: 78,
        completed_at: "2026-07-10T01:00:00.000Z"
      }
    ],
    []
  );
  const merged = mergePostExamSnapshotWithLocal(cloud, {
    sessions: [
      {
        sessionId: "same",
        mode: "simulation",
        attempts: 6,
        correctAttempts: 5,
        completedAt: "2026-07-10T01:00:00.000Z"
      },
      {
        sessionId: "local-only",
        mode: "random",
        attempts: 12,
        correctAttempts: 9,
        completedAt: "2026-07-11T01:00:00.000Z"
      }
    ],
    simulations: []
  });
  assert.equal(merged.sessions.find((session) => session.sessionId === "same")?.attempts, 100);
  assert.equal(merged.sessions.find((session) => session.sessionId === "local-only")?.attempts, 12);
});

test("本機模擬考只收完整 100 題且高於 3 分", () => {
  const eligible = makeSession();
  const tooShort = makeSession({ id: "short", attempts: eligible.attempts.slice(0, 99) });
  const accidental = makeSession({
    id: "accidental",
    attempts: eligible.attempts.map((attempt, index) => ({
      ...attempt,
      isCorrect: index < 3
    }))
  });
  const summarized = summarizeLocalPostExamSessions([eligible, tooShort, accidental]);
  assert.deepEqual(summarized.simulations.map((session) => session.sessionId), ["local-session-1"]);
  assert.equal(summarized.simulations[0]?.score, 72);
});

test("早年與新版卷號都能分到醫學一、醫學二", () => {
  assert.equal(inferPostExamSubject("115020-1301"), "醫學（一）");
  assert.equal(inferPostExamSubject("107020-5301"), "醫學（一）");
  assert.equal(inferPostExamSubject("115020-2301"), "醫學（二）");
  assert.equal(inferPostExamSubject("107020-6301"), "醫學（二）");
});

test("模擬考回顧依考題年份把醫學一與醫學二排在同一組", () => {
  const groups = groupPostExamSimulationsByYear([
    {
      sessionId: "med1-2024",
      subject: "醫學（一）",
      paperKey: "113090-1301",
      paperLabel: "2024 第2次 醫學（一）",
      score: 78,
      completedAt: "2026-07-11T01:00:00.000Z"
    },
    {
      sessionId: "med2-2024",
      subject: "醫學（二）",
      paperKey: "113090-2301",
      paperLabel: "2024 第2次 醫學（二）",
      score: 81,
      completedAt: "2026-07-12T01:00:00.000Z"
    },
    {
      sessionId: "ai-med1",
      subject: "醫學（一）",
      paperKey: "AI-MED1-113115-HUMANLIKE-001",
      paperLabel: "gpt5.6 出的醫學一",
      score: 74,
      completedAt: "2026-07-13T01:00:00.000Z"
    }
  ]);

  assert.deepEqual(groups.map((group) => group.label), ["2024 年", "AI 模擬卷"]);
  assert.equal(groups[0]?.med1[0]?.sessionId, "med1-2024");
  assert.equal(groups[0]?.med2[0]?.sessionId, "med2-2024");
});

test("累積圖表依日期加總並保留精確正確率", () => {
  const points = buildPostExamCumulativePoints([
    {
      sessionId: "one",
      mode: "random",
      attempts: 10,
      correctAttempts: 7,
      completedAt: "2026-07-01T01:00:00.000Z"
    },
    {
      sessionId: "two",
      mode: "random",
      attempts: 10,
      correctAttempts: 8,
      completedAt: "2026-07-02T01:00:00.000Z"
    }
  ]);
  assert.equal(points.at(-1)?.cumulativeAttempts, 20);
  assert.equal(points.at(-1)?.cumulativeAccuracy, 75);
});

test("公開暱稱留白可匿名，明顯個資與非法分數會被阻擋", () => {
  const anonymous = validatePostExamSurveyAnswers({ publicAlias: "" });
  assert.equal(anonymous.data.publicAlias, "匿名考生");
  assert.deepEqual(anonymous.errors, {});

  const invalid = validatePostExamSurveyAnswers({
    publicAlias: "student@example.com",
    med1Score: 101,
    med2Score: 88
  });
  assert.ok(invalid.errors.publicAlias);
  assert.ok(invalid.errors.med1Score);
  assert.equal(invalid.data.med2Score, 88);

  for (const publicAlias of ["example.com", "@student_123", "IG student_123"]) {
    assert.ok(validatePostExamSurveyAnswers({ publicAlias }).errors.publicAlias);
  }
});

test("舊草稿的留下分數欄位不再影響分數與匿名分享設定", () => {
  const result = validatePostExamSurveyAnswers({
    discloseScores: false,
    shareScores: true,
    med1Score: 90,
    med2Score: 80
  });
  assert.equal(result.data.med1Score, 90);
  assert.equal(result.data.med2Score, 80);
  assert.equal(result.data.shareScores, true);
});

test("讀書建議與鼓勵保留段落換行並清除控制字元", () => {
  const result = validatePostExamSurveyAnswers({
    studyReflection: "第一段\r\n\r\n\r\n第二段\u0000",
    encouragement: "慢慢來\n你可以的"
  });
  assert.equal(result.data.studyReflection, "第一段\n\n第二段");
  assert.equal(result.data.encouragement, "慢慢來\n你可以的");
});
