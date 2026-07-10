import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeMastery,
  estimateExamPassProbability,
  type MasteryAnswerInput
} from "./masteryAnalysis";

function makeAnswers(
  groups: Array<{ count: number; isCorrect: boolean; confidence: number }>
): MasteryAnswerInput[] {
  let nextId = 1;
  return groups.flatMap((group) =>
    Array.from({ length: group.count }, () => ({
      questionId: `q-${nextId++}`,
      isCorrect: group.isCorrect,
      confidence: group.confidence
    }))
  );
}

test("全部信心 4 且答對時，掌握指標全滿", () => {
  const analysis = analyzeMastery(makeAnswers([{ count: 10, isCorrect: true, confidence: 4 }]));

  assert.equal(analysis.accuracyPercent, 100);
  assert.equal(analysis.stableMasteryPercent, 100);
  assert.equal(analysis.calibratedMasteryPercent, 100);
  assert.equal(analysis.highConfidenceErrorPercent, 0);
  assert.equal(analysis.guessingRiskPercent, 0);
  assert.equal(analysis.masteryLevel.label, "穩定掌握");
});

test("全部信心 4 但答錯時，高信心錯誤率為 100 並提醒錯誤自信", () => {
  const analysis = analyzeMastery(makeAnswers([{ count: 10, isCorrect: false, confidence: 4 }]));

  assert.equal(analysis.accuracyPercent, 0);
  assert.equal(analysis.stableMasteryPercent, 0);
  assert.equal(analysis.calibratedMasteryPercent, 0);
  assert.equal(analysis.highConfidenceErrorPercent, 100);
  assert.equal(analysis.masteryLevel.label, "基礎缺口明顯");
  assert.ok(analysis.summarySentences.join(" ").includes("錯誤自信"));
});

test("表面 50% 但校準後掌握低的案例符合公式", () => {
  const analysis = analyzeMastery(
    makeAnswers([
      { count: 2, isCorrect: true, confidence: 4 },
      { count: 2, isCorrect: false, confidence: 4 },
      { count: 2, isCorrect: true, confidence: 2 },
      { count: 2, isCorrect: false, confidence: 2 }
    ])
  );

  assert.equal(analysis.accuracyPercent, 50);
  assert.equal(analysis.calibratedMasteryPercent, 25);
  assert.equal(analysis.stableMasteryPercent, 25);
  assert.equal(analysis.highConfidenceErrorPercent, 50);
  assert.equal(analysis.guessingRiskPercent, 50);
  assert.ok(analysis.summarySentences.join(" ").includes("校準後掌握約 25%"));
});

test("沒有信心 4 題時，高信心錯誤率為 null", () => {
  const analysis = analyzeMastery(
    makeAnswers([
      { count: 3, isCorrect: true, confidence: 2 },
      { count: 2, isCorrect: false, confidence: 2 }
    ])
  );

  assert.equal(analysis.counts[4].total, 0);
  assert.equal(analysis.highConfidenceErrorRate, null);
  assert.equal(analysis.highConfidenceErrorPercent, null);
});

test("沒有答對題時，猜對風險率為 null", () => {
  const analysis = analyzeMastery(
    makeAnswers([
      { count: 3, isCorrect: false, confidence: 1 },
      { count: 2, isCorrect: false, confidence: 4 }
    ])
  );

  assert.equal(analysis.correct, 0);
  assert.equal(analysis.guessingRiskRate, null);
  assert.equal(analysis.guessingRiskPercent, null);
});

test("信心缺失或不在 1-4 時，不納入校準但保留答對率", () => {
  const analysis = analyzeMastery([
    { questionId: "q-1", isCorrect: true, confidence: 4 },
    { questionId: "q-2", isCorrect: true, confidence: 5 },
    { questionId: "q-3", isCorrect: false, confidence: null }
  ]);

  assert.equal(analysis.total, 3);
  assert.equal(analysis.accuracyPercent, 67);
  assert.equal(analysis.confidenceEligibleTotal, 1);
  assert.equal(analysis.missingConfidenceCount, 2);
  assert.equal(analysis.calibratedMasteryPercent, 100);
  assert.equal(analysis.hasMissingConfidence, true);
});

test("正式考估計固定以 100 題與 60 題及格計算，8 題樣本會提示題數不足", () => {
  const estimate = estimateExamPassProbability(8, 4);

  assert.equal(estimate.examQuestionCount, 100);
  assert.equal(estimate.passQuestionCount, 60);
  assert.equal(estimate.expectedExamScoreRounded, 50);
  assert.ok(estimate.predictivePassProbabilityPercent >= 25);
  assert.ok(estimate.predictivePassProbabilityPercent <= 35);
  assert.equal(estimate.reliabilityLevel, "insufficient");
  assert.equal(estimate.sampleWarning, "題數不足，機率僅供參考");
});

test("完整 100 題剛好 60 題正確時，本次達標但下一份正式考不是 100% 及格", () => {
  const estimate = estimateExamPassProbability(100, 60);

  assert.equal(estimate.currentMockScore, 60);
  assert.equal(estimate.currentMockPassed, true);
  assert.ok(estimate.predictivePassProbabilityPercent < 100);
  assert.ok(estimate.predictivePassProbabilityPercent >= 45);
  assert.ok(estimate.predictivePassProbabilityPercent <= 65);
});

test("完整 100 題答對 70 題時，正式考及格機率偏高", () => {
  const estimate = estimateExamPassProbability(100, 70);

  assert.equal(estimate.currentMockPassed, true);
  assert.ok(estimate.predictivePassProbabilityPercent >= 85);
  assert.equal(estimate.passBadgeLabel, "及格把握高");
});

test("完整 100 題答對 50 題時，正式考及格風險偏高", () => {
  const estimate = estimateExamPassProbability(100, 50);

  assert.equal(estimate.currentMockPassed, false);
  assert.ok(estimate.predictivePassProbabilityPercent < 45);
  assert.equal(estimate.passBadgeLabel, "及格風險偏高");
});

test("答對率達標但高信心錯誤偏高時，摘要提醒正式考分數可能被高估", () => {
  const analysis = analyzeMastery(
    makeAnswers([
      { count: 50, isCorrect: true, confidence: 4 },
      { count: 15, isCorrect: true, confidence: 2 },
      { count: 35, isCorrect: false, confidence: 4 }
    ])
  );

  assert.equal(analysis.accuracyPercent, 65);
  assert.ok((analysis.highConfidenceErrorRate ?? 0) >= 0.3);
  assert.ok(analysis.summarySentences.join(" ").includes("正式考分數可能被高估"));
});

test("結果頁弱點會把不同舊小節但相同 primaryTag 的題目合併", () => {
  const analysis = analyzeMastery([
    {
      questionId: "q-renal-1",
      isCorrect: false,
      confidence: 4,
      question: {
        id: "q-renal-1",
        subject: "生理學",
        chapter: "泌尿",
        section: "腎小球",
        primaryTag: "腎臟生理"
      }
    },
    {
      questionId: "q-renal-2",
      isCorrect: true,
      confidence: 2,
      question: {
        id: "q-renal-2",
        subject: "生理學",
        chapter: "體液",
        section: "清除率",
        primaryTag: "腎臟生理"
      }
    }
  ]);

  assert.equal(analysis.topicStats.length, 1);
  assert.equal(analysis.topicStats[0].label, "腎臟生理");
  assert.equal(analysis.topicStats[0].usesPrimaryTag, true);
  assert.equal(analysis.topicStats[0].total, 2);
});
