import type { Question } from "../types/quiz";

export type ValidMasteryConfidence = 1 | 2 | 3 | 4;

export type MasteryAnswerInput = {
  questionId: string;
  isCorrect: boolean;
  confidence?: number | null;
  questionNumber?: number;
  question?: Pick<Question, "id" | "subject" | "chapter" | "section"> | null;
};

export type MasteryCategoryKey =
  | "stable_mastery"
  | "near_mastery"
  | "guessing_risk"
  | "overconfidence_error"
  | "shaky_concept"
  | "basic_gap";

export type ConfidenceCalibrationStatus =
  | "校準正常"
  | "偏高估"
  | "偏低估"
  | "樣本少"
  | "目前沒有此類題目";

export type MasteryCategory = {
  key: MasteryCategoryKey;
  label: string;
  description: string;
  action: string;
  count: number;
  percent: number | null;
  tone: "emerald" | "sky" | "yellow" | "rose" | "orange" | "slate";
  questionIds: string[];
};

export type MasteryReviewItem = {
  questionId: string;
  questionNumber?: number;
  confidence: ValidMasteryConfidence;
  isCorrect: boolean;
  categoryKey: MasteryCategoryKey;
  categoryLabel: string;
  priority: number;
};

export type ConfidenceLayerStats = {
  confidence: ValidMasteryConfidence;
  expectedProbability: number;
  total: number;
  correct: number;
  wrong: number;
  observedAccuracy: number | null;
  observedAccuracyPercent: number | null;
  status: ConfidenceCalibrationStatus;
};

export type MasteryTopicStats = {
  key: string;
  subject: string;
  chapter: string;
  section: string;
  total: number;
  correct: number;
  accuracy: number | null;
  accuracyPercent: number | null;
  calibratedMasteryIndex: number | null;
  calibratedMasteryPercent: number | null;
  overconfidenceCount: number;
  guessingRiskCount: number;
  questionIds: string[];
};

export type ExamPassReliabilityLevel = "insufficient" | "low" | "medium" | "high";

export type ExamPassBadgeLabel =
  | "及格把握高"
  | "有機會，但仍需穩定"
  | "五五波"
  | "及格風險偏高";

export type ExamPassEstimate = {
  examQuestionCount: number;
  passThreshold: number;
  passQuestionCount: number;
  sampleQuestionCount: number;
  sampleCorrectCount: number;
  priorAlpha: number;
  priorBeta: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorMeanAccuracy: number;
  posteriorMeanAccuracyPercent: number;
  abilityAbovePassProbability: number;
  abilityAbovePassProbabilityPercent: number;
  predictivePassProbability: number;
  predictivePassProbabilityPercent: number;
  expectedExamScore: number;
  expectedExamScoreRounded: number;
  scoreRange80: [number, number];
  scoreRange90: [number, number];
  reliabilityLevel: ExamPassReliabilityLevel;
  reliabilityMessage: string;
  passBadgeLabel: ExamPassBadgeLabel;
  sampleWarning: string | null;
  currentMockScore: number | null;
  currentMockPassed: boolean | null;
};

export type MasteryAnalysis = {
  total: number;
  correct: number;
  wrong: number;
  confidenceEligibleTotal: number;
  missingConfidenceCount: number;
  hasMissingConfidence: boolean;
  counts: Record<
    ValidMasteryConfidence,
    {
      correct: number;
      wrong: number;
      total: number;
    }
  >;
  accuracy: number | null;
  accuracyPercent: number | null;
  stableMasteryRate: number | null;
  stableMasteryPercent: number | null;
  calibratedMasteryIndex: number | null;
  calibratedMasteryPercent: number | null;
  highConfidenceErrorRate: number | null;
  highConfidenceErrorPercent: number | null;
  overconfidenceShare: number | null;
  overconfidenceSharePercent: number | null;
  guessingRiskRate: number | null;
  guessingRiskPercent: number | null;
  unstableCorrectRate: number | null;
  unstableCorrectPercent: number | null;
  basicGapRate: number | null;
  basicGapPercent: number | null;
  shakyConceptRate: number | null;
  shakyConceptPercent: number | null;
  brierScore: number | null;
  calibrationScore: number | null;
  calibrationPercent: number | null;
  confidenceBias: number | null;
  confidenceBiasPercent: number | null;
  calibrationLabel: "良好" | "偏高估" | "偏低估" | "題數較少" | "資料不足";
  biasLabel: "信心大致準確" | "偏高估自己" | "偏低估自己" | "題數較少" | "資料不足";
  masteryLevel: {
    label: string;
    description: string;
  };
  examPassEstimate: ExamPassEstimate;
  sampleMessage: string;
  summarySentences: string[];
  confidenceLayers: ConfidenceLayerStats[];
  categories: MasteryCategory[];
  reviewItems: MasteryReviewItem[];
  reviewCount: number;
  topicStats: MasteryTopicStats[];
};

export const confidenceExpectedProbability: Record<ValidMasteryConfidence, number> = {
  1: 0.25,
  2: 0.5,
  3: 0.75,
  4: 0.9
};

export const EXAM_QUESTION_COUNT = 100;
export const PASS_THRESHOLD = 0.6;
export const PASS_QUESTION_COUNT = 60;

const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;
const confidenceValues: ValidMasteryConfidence[] = [1, 2, 3, 4];

const categoryDefinitions: Record<
  MasteryCategoryKey,
  Omit<MasteryCategory, "count" | "percent" | "questionIds">
> = {
  stable_mastery: {
    key: "stable_mastery",
    label: "穩定掌握",
    description: "有信心且答對，可先略過，考前快速掃過即可。",
    action: "可先略過",
    tone: "emerald"
  },
  near_mastery: {
    key: "near_mastery",
    label: "接近掌握",
    description: "方向正確，但還沒到完全穩。建議補上關鍵辨別點。",
    action: "補辨別點",
    tone: "sky"
  },
  guessing_risk: {
    key: "guessing_risk",
    label: "猜對風險",
    description: "雖然答對，但信心偏低，可能是猜對或還不穩。",
    action: "考前快掃",
    tone: "yellow"
  },
  overconfidence_error: {
    key: "overconfidence_error",
    label: "錯誤自信",
    description: "最優先處理。這代表你很確定的觀念其實是錯的。",
    action: "最優先處理",
    tone: "rose"
  },
  shaky_concept: {
    key: "shaky_concept",
    label: "概念不穩",
    description: "你可能掌握大方向，但被細節、陷阱或鑑別點影響。",
    action: "抓陷阱邊界",
    tone: "orange"
  },
  basic_gap: {
    key: "basic_gap",
    label: "基礎缺口",
    description: "正常的不熟或不會，需要回到基礎觀念。",
    action: "回補核心概念",
    tone: "slate"
  }
};

const categoryOrder: MasteryCategoryKey[] = [
  "overconfidence_error",
  "shaky_concept",
  "basic_gap",
  "guessing_risk",
  "near_mastery",
  "stable_mastery"
];

export function safeDivide(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: number | null) {
  return value === null ? null : Math.round(value * 100);
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

const lanczosCoefficients = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7
];

function logGamma(value: number): number {
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  const z = value - 1;
  let x = 0.9999999999998099;
  for (let index = 0; index < lanczosCoefficients.length; index += 1) {
    x += lanczosCoefficients[index] / (z + index + 1);
  }

  const t = z + lanczosCoefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logCombination(n: number, k: number) {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function logBeta(alpha: number, beta: number) {
  return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
}

function betaContinuedFraction(alpha: number, beta: number, x: number) {
  const maxIterations = 200;
  const epsilon = 3e-12;
  const tiny = 1e-30;
  const qab = alpha + beta;
  const qap = alpha + 1;
  const qam = alpha - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (beta - m) * x) / ((qam + m2) * (alpha + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    aa = (-(alpha + m) * (qab + m) * x) / ((alpha + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }

  return h;
}

function regularizedIncompleteBeta(x: number, alpha: number, beta: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const logTerm =
    logGamma(alpha + beta) -
    logGamma(alpha) -
    logGamma(beta) +
    alpha * Math.log(x) +
    beta * Math.log1p(-x);
  const betaTerm = Math.exp(logTerm);

  if (x < (alpha + 1) / (alpha + beta + 2)) {
    return clamp((betaTerm * betaContinuedFraction(alpha, beta, x)) / alpha, 0, 1);
  }

  return clamp(1 - (betaTerm * betaContinuedFraction(beta, alpha, 1 - x)) / beta, 0, 1);
}

function getPredictiveQuantile(probabilities: number[], quantile: number) {
  let cumulative = 0;
  for (let score = 0; score < probabilities.length; score += 1) {
    cumulative += probabilities[score];
    if (cumulative >= quantile) return score;
  }
  return probabilities.length - 1;
}

function getExamPassReliability(sampleQuestionCount: number): Pick<
  ExamPassEstimate,
  "reliabilityLevel" | "reliabilityMessage" | "sampleWarning"
> {
  if (sampleQuestionCount < 10) {
    return {
      reliabilityLevel: "insufficient",
      reliabilityMessage: "本次題數太少，及格機率僅供參考。",
      sampleWarning: "題數不足，機率僅供參考"
    };
  }
  if (sampleQuestionCount < 30) {
    return {
      reliabilityLevel: "low",
      reliabilityMessage: "題數偏少，機率波動較大，建議累積更多題目。",
      sampleWarning: null
    };
  }
  if (sampleQuestionCount < EXAM_QUESTION_COUNT) {
    return {
      reliabilityLevel: "medium",
      reliabilityMessage: "可作為初步判斷，但仍建議搭配完整 100 題模擬考。",
      sampleWarning: null
    };
  }
  return {
    reliabilityLevel: "high",
    reliabilityMessage: "本次題數已達正式考規模，可作為較穩定的及格機率估計。",
    sampleWarning: null
  };
}

function getExamPassBadgeLabel(passProbability: number): ExamPassBadgeLabel {
  if (passProbability >= 0.85) return "及格把握高";
  if (passProbability >= 0.65) return "有機會，但仍需穩定";
  if (passProbability >= 0.45) return "五五波";
  return "及格風險偏高";
}

export function estimateExamPassProbability(
  sampleQuestionCount: number,
  sampleCorrectCount: number,
  options: {
    examQuestionCount?: number;
    passQuestionCount?: number;
    priorAlpha?: number;
    priorBeta?: number;
  } = {}
): ExamPassEstimate {
  const examQuestionCount = options.examQuestionCount ?? EXAM_QUESTION_COUNT;
  const passQuestionCount = options.passQuestionCount ?? PASS_QUESTION_COUNT;
  const priorAlpha = options.priorAlpha ?? PRIOR_ALPHA;
  const priorBeta = options.priorBeta ?? PRIOR_BETA;
  const posteriorAlpha = priorAlpha + sampleCorrectCount;
  const posteriorBeta = priorBeta + sampleQuestionCount - sampleCorrectCount;
  const posteriorMeanAccuracy = posteriorAlpha / (posteriorAlpha + posteriorBeta);
  const logDenominator = logBeta(posteriorAlpha, posteriorBeta);
  const logProbabilities = Array.from({ length: examQuestionCount + 1 }, (_, score) =>
    logCombination(examQuestionCount, score) +
    logBeta(score + posteriorAlpha, examQuestionCount - score + posteriorBeta) -
    logDenominator
  );
  const maxLogProbability = Math.max(...logProbabilities);
  const weights = logProbabilities.map((logProbability) => Math.exp(logProbability - maxLogProbability));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const probabilities = weights.map((weight) => weight / totalWeight);
  const predictivePassProbability = probabilities
    .slice(passQuestionCount)
    .reduce((sum, probability) => sum + probability, 0);
  const expectedExamScore = probabilities.reduce(
    (sum, probability, score) => sum + score * probability,
    0
  );
  const reliability = getExamPassReliability(sampleQuestionCount);
  const abilityAbovePassProbability = 1 - regularizedIncompleteBeta(
    PASS_THRESHOLD,
    posteriorAlpha,
    posteriorBeta
  );

  return {
    examQuestionCount,
    passThreshold: PASS_THRESHOLD,
    passQuestionCount,
    sampleQuestionCount,
    sampleCorrectCount,
    priorAlpha,
    priorBeta,
    posteriorAlpha,
    posteriorBeta,
    posteriorMeanAccuracy,
    posteriorMeanAccuracyPercent: toPercent(posteriorMeanAccuracy) ?? 0,
    abilityAbovePassProbability,
    abilityAbovePassProbabilityPercent: toPercent(abilityAbovePassProbability) ?? 0,
    predictivePassProbability,
    predictivePassProbabilityPercent: toPercent(predictivePassProbability) ?? 0,
    expectedExamScore: roundToOneDecimal(expectedExamScore),
    expectedExamScoreRounded: Math.round(expectedExamScore),
    scoreRange80: [
      getPredictiveQuantile(probabilities, 0.1),
      getPredictiveQuantile(probabilities, 0.9)
    ],
    scoreRange90: [
      getPredictiveQuantile(probabilities, 0.05),
      getPredictiveQuantile(probabilities, 0.95)
    ],
    ...reliability,
    passBadgeLabel: getExamPassBadgeLabel(predictivePassProbability),
    currentMockScore: sampleQuestionCount === EXAM_QUESTION_COUNT ? sampleCorrectCount : null,
    currentMockPassed:
      sampleQuestionCount === EXAM_QUESTION_COUNT ? sampleCorrectCount >= passQuestionCount : null
  };
}

function isValidConfidence(confidence: number | null | undefined): confidence is ValidMasteryConfidence {
  return confidenceValues.includes(confidence as ValidMasteryConfidence);
}

function getMasteryCategoryKey(isCorrect: boolean, confidence: ValidMasteryConfidence): MasteryCategoryKey {
  if (isCorrect && confidence === 4) return "stable_mastery";
  if (isCorrect && confidence === 3) return "near_mastery";
  if (isCorrect) return "guessing_risk";
  if (confidence === 4) return "overconfidence_error";
  if (confidence === 3) return "shaky_concept";
  return "basic_gap";
}

export function getMasteryCategoryLabelForAnswer(answer: {
  isCorrect: boolean;
  confidence?: number | null;
}) {
  if (!isValidConfidence(answer.confidence)) return "信心資料不足";
  return categoryDefinitions[getMasteryCategoryKey(answer.isCorrect, answer.confidence)].label;
}

function getReviewPriority(isCorrect: boolean, confidence: ValidMasteryConfidence) {
  if (!isCorrect && confidence === 4) return 100;
  if (!isCorrect && confidence === 3) return 80;
  if (!isCorrect && confidence === 2) return 60;
  if (!isCorrect && confidence === 1) return 50;
  if (isCorrect && confidence === 1) return 40;
  if (isCorrect && confidence === 2) return 35;
  if (isCorrect && confidence === 3) return 20;
  return 0;
}

function getLayerStatus(
  total: number,
  observedAccuracy: number | null,
  expectedProbability: number
): ConfidenceCalibrationStatus {
  if (total === 0) return "目前沒有此類題目";
  if (total < 3) return "樣本少";
  if (observedAccuracy === null) return "目前沒有此類題目";
  if (observedAccuracy < expectedProbability - 0.15) return "偏高估";
  if (observedAccuracy > expectedProbability + 0.15) return "偏低估";
  return "校準正常";
}

function getMasteryLevel(calibratedMasteryPercent: number | null) {
  if (calibratedMasteryPercent === null) {
    return {
      label: "資料不足",
      description: "缺少可用的信心資料，先看答對率與錯題回顧。"
    };
  }
  if (calibratedMasteryPercent < 30) {
    return {
      label: "基礎缺口明顯",
      description: "目前真實掌握偏低，建議先處理錯誤自信與基礎缺口。"
    };
  }
  if (calibratedMasteryPercent < 50) {
    return {
      label: "掌握不穩",
      description: "表面成績可能有一部分來自不穩答對，需要回補關鍵概念。"
    };
  }
  if (calibratedMasteryPercent < 70) {
    return {
      label: "部分掌握",
      description: "已經有一部分穩住，但仍有幾類題目值得優先複習。"
    };
  }
  if (calibratedMasteryPercent < 85) {
    return {
      label: "掌握良好",
      description: "整體方向不錯，優先補少數高風險題即可。"
    };
  }
  return {
    label: "穩定掌握",
    description: "整體掌握穩定，可以把重點放在少數不熟題與考前維持。"
  };
}

function getSampleMessage(total: number) {
  if (total < 10) return "本次題數較少，百分比波動較大，建議累積更多題目後再判斷趨勢。";
  if (total < 30) return "本次題數可供初步判斷，但仍建議搭配多次測驗趨勢。";
  return "題數足夠，可作為本次單元掌握度的參考。";
}

function buildSummarySentences(params: {
  accuracyPercent: number | null;
  calibratedMasteryPercent: number | null;
  examPassEstimate: ExamPassEstimate;
  highConfidenceWrongCount: number;
  guessingRiskRate: number | null;
  highConfidenceErrorRate: number | null;
}) {
  const {
    accuracyPercent,
    calibratedMasteryPercent,
    examPassEstimate,
    highConfidenceWrongCount,
    guessingRiskRate,
    highConfidenceErrorRate
  } = params;

  if (accuracyPercent === null) return ["目前沒有可分析的題目。"];
  const masteryClause =
    calibratedMasteryPercent === null
      ? "但信心資料不足，暫時無法估算校準後掌握"
      : `校準後掌握約 ${calibratedMasteryPercent}%`;
  const sentences = [
    `本次答對率為 ${accuracyPercent}%，${masteryClause}；模型預估若正式考卷與本次練習相近，達到 ${PASS_QUESTION_COUNT} / ${EXAM_QUESTION_COUNT} 的機率約為 ${examPassEstimate.predictivePassProbabilityPercent}%。`,
    `預估正式考分數約為 ${examPassEstimate.expectedExamScoreRounded} 分，80% 可能範圍為 ${examPassEstimate.scoreRange80[0]}–${examPassEstimate.scoreRange80[1]} 分。`
  ];

  if (examPassEstimate.sampleQuestionCount < 10) {
    sentences.push(
      `但本次只有 ${examPassEstimate.sampleQuestionCount} 題，百分比波動很大，建議累積更多題目或完成一次 100 題模擬考後再判斷。`
    );
  } else if (examPassEstimate.sampleQuestionCount < EXAM_QUESTION_COUNT) {
    sentences.push("目前題數尚未達完整正式考規模，因此機率應視為初步估計。");
  }

  if (calibratedMasteryPercent !== null && calibratedMasteryPercent <= accuracyPercent - 10) {
    sentences.push("代表有些答對題仍不穩，或存在高信心答錯，因此真實掌握度低於表面成績。");
  }
  if (highConfidenceWrongCount > 0) {
    sentences.push(
      `最優先處理的是 ${highConfidenceWrongCount} 題信心 4 但答錯的題目，這類題代表錯誤自信。`
    );
  }
  if (guessingRiskRate !== null && guessingRiskRate >= 0.3) {
    sentences.push("答對題中有不少低信心題，建議快速回顧，避免下次換問法失分。");
  }
  if (highConfidenceErrorRate !== null && highConfidenceErrorRate >= 0.3) {
    sentences.push("此外，高信心錯誤率偏高，代表有些自認會的觀念其實不穩，正式考分數可能被高估。");
  }
  if (
    calibratedMasteryPercent !== null &&
    calibratedMasteryPercent < 60 &&
    examPassEstimate.predictivePassProbability >= 0.65
  ) {
    sentences.push("雖然及格機率看起來不低，但穩定掌握尚未達 60%，建議不要只看表面分數。");
  }
  if (
    calibratedMasteryPercent !== null &&
    calibratedMasteryPercent >= 85 &&
    highConfidenceErrorRate !== null &&
    highConfidenceErrorRate <= 0.1
  ) {
    sentences.push("整體掌握穩定，可以把重點放在少數不熟題與考前維持。");
  }

  return sentences;
}

function calculateCalibratedMastery(
  counts: MasteryAnalysis["counts"],
  confidenceEligibleTotal: number
) {
  if (confidenceEligibleTotal === 0) return null;
  const correctCredit =
    0.25 * counts[1].correct +
    0.5 * counts[2].correct +
    0.75 * counts[3].correct +
    counts[4].correct;
  const riskPenalty = 0.25 * counts[3].wrong + 0.5 * counts[4].wrong;
  return clamp((correctCredit - riskPenalty) / confidenceEligibleTotal, 0, 1);
}

function getEmptyCounts(): MasteryAnalysis["counts"] {
  return {
    1: { correct: 0, wrong: 0, total: 0 },
    2: { correct: 0, wrong: 0, total: 0 },
    3: { correct: 0, wrong: 0, total: 0 },
    4: { correct: 0, wrong: 0, total: 0 }
  };
}

function analyzeTopicStats(answers: MasteryAnswerInput[]): MasteryTopicStats[] {
  const topicMap = new Map<
    string,
    {
      subject: string;
      chapter: string;
      section: string;
      answers: MasteryAnswerInput[];
      questionIds: string[];
    }
  >();

  for (const answer of answers) {
    const question = answer.question;
    if (!question?.subject || !question.chapter || !question.section) continue;
    const key = `${question.subject}__${question.chapter}__${question.section}`;
    const current =
      topicMap.get(key) ??
      {
        subject: question.subject,
        chapter: question.chapter,
        section: question.section,
        answers: [],
        questionIds: []
      };
    current.answers.push(answer);
    current.questionIds.push(answer.questionId);
    topicMap.set(key, current);
  }

  return Array.from(topicMap.entries())
    .map(([key, topic]) => {
      const counts = getEmptyCounts();
      let confidenceEligibleTotal = 0;
      let correct = 0;
      let guessingRiskCount = 0;
      let overconfidenceCount = 0;

      for (const answer of topic.answers) {
        if (answer.isCorrect) correct += 1;
        if (!isValidConfidence(answer.confidence)) continue;
        const layer = counts[answer.confidence];
        if (answer.isCorrect) layer.correct += 1;
        else layer.wrong += 1;
        layer.total += 1;
        confidenceEligibleTotal += 1;
        if (answer.isCorrect && answer.confidence <= 2) guessingRiskCount += 1;
        if (!answer.isCorrect && answer.confidence === 4) overconfidenceCount += 1;
      }

      const accuracy = safeDivide(correct, topic.answers.length);
      const calibratedMasteryIndex = calculateCalibratedMastery(counts, confidenceEligibleTotal);

      return {
        key,
        subject: topic.subject,
        chapter: topic.chapter,
        section: topic.section,
        total: topic.answers.length,
        correct,
        accuracy,
        accuracyPercent: toPercent(accuracy),
        calibratedMasteryIndex,
        calibratedMasteryPercent: toPercent(calibratedMasteryIndex),
        overconfidenceCount,
        guessingRiskCount,
        questionIds: topic.questionIds
      };
    })
    .sort((left, right) => {
      const leftMastery = left.calibratedMasteryIndex ?? 1;
      const rightMastery = right.calibratedMasteryIndex ?? 1;
      return (
        leftMastery - rightMastery ||
        right.overconfidenceCount - left.overconfidenceCount ||
        right.total - left.total ||
        left.key.localeCompare(right.key)
      );
    });
}

export function analyzeMastery(answers: MasteryAnswerInput[]): MasteryAnalysis {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const wrong = total - correct;
  const accuracy = safeDivide(correct, total);
  const counts = getEmptyCounts();
  const categoryBuckets = new Map<MasteryCategoryKey, string[]>(
    categoryOrder.map((key) => [key, []])
  );
  const reviewItems: MasteryReviewItem[] = [];
  let confidenceEligibleTotal = 0;
  let brierTotal = 0;
  let predictedTotal = 0;
  let actualTotal = 0;

  for (const answer of answers) {
    if (!isValidConfidence(answer.confidence)) continue;
    confidenceEligibleTotal += 1;
    const layer = counts[answer.confidence];
    if (answer.isCorrect) layer.correct += 1;
    else layer.wrong += 1;
    layer.total += 1;

    const predictedProbability = confidenceExpectedProbability[answer.confidence];
    const actual = answer.isCorrect ? 1 : 0;
    brierTotal += (predictedProbability - actual) ** 2;
    predictedTotal += predictedProbability;
    actualTotal += actual;

    const categoryKey = getMasteryCategoryKey(answer.isCorrect, answer.confidence);
    categoryBuckets.get(categoryKey)?.push(answer.questionId);
    reviewItems.push({
      questionId: answer.questionId,
      questionNumber: answer.questionNumber,
      confidence: answer.confidence,
      isCorrect: answer.isCorrect,
      categoryKey,
      categoryLabel: categoryDefinitions[categoryKey].label,
      priority: getReviewPriority(answer.isCorrect, answer.confidence)
    });
  }

  const missingConfidenceCount = total - confidenceEligibleTotal;
  const calibratedMasteryIndex = calculateCalibratedMastery(counts, confidenceEligibleTotal);
  const brierScore = safeDivide(brierTotal, confidenceEligibleTotal);
  const calibrationScore = brierScore === null ? null : clamp(1 - brierScore / 0.81, 0, 1);
  const predictedMean = safeDivide(predictedTotal, confidenceEligibleTotal);
  const confidenceActualAccuracy = safeDivide(actualTotal, confidenceEligibleTotal);
  const confidenceBias =
    predictedMean === null || confidenceActualAccuracy === null
      ? null
      : predictedMean - confidenceActualAccuracy;

  const confidenceLayers = confidenceValues.map((confidence) => {
    const layer = counts[confidence];
    const observedAccuracy = safeDivide(layer.correct, layer.total);
    const expectedProbability = confidenceExpectedProbability[confidence];
    return {
      confidence,
      expectedProbability,
      total: layer.total,
      correct: layer.correct,
      wrong: layer.wrong,
      observedAccuracy,
      observedAccuracyPercent: toPercent(observedAccuracy),
      status: getLayerStatus(layer.total, observedAccuracy, expectedProbability)
    };
  });

  const categories = categoryOrder.map((key) => {
    const questionIds = categoryBuckets.get(key) ?? [];
    return {
      ...categoryDefinitions[key],
      count: questionIds.length,
      percent: toPercent(safeDivide(questionIds.length, confidenceEligibleTotal)),
      questionIds
    };
  });

  const sortedReviewItems = reviewItems.sort(
    (left, right) =>
      right.priority - left.priority ||
      (left.questionNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.questionNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.questionId.localeCompare(right.questionId)
  );

  const highConfidenceErrorRate = safeDivide(counts[4].wrong, counts[4].total);
  const guessingRiskRate = safeDivide(counts[1].correct + counts[2].correct, correct);
  const accuracyPercent = toPercent(accuracy);
  const calibratedMasteryPercent = toPercent(calibratedMasteryIndex);
  const masteryLevel = getMasteryLevel(calibratedMasteryPercent);
  const examPassEstimate = estimateExamPassProbability(total, correct);

  let calibrationLabel: MasteryAnalysis["calibrationLabel"] = "資料不足";
  let biasLabel: MasteryAnalysis["biasLabel"] = "資料不足";
  if (confidenceEligibleTotal > 0 && confidenceEligibleTotal < 10) {
    calibrationLabel = "題數較少";
    biasLabel = "題數較少";
  } else if (confidenceBias !== null) {
    if (confidenceBias >= 0.15) {
      calibrationLabel = "偏高估";
      biasLabel = "偏高估自己";
    } else if (confidenceBias <= -0.15) {
      calibrationLabel = "偏低估";
      biasLabel = "偏低估自己";
    } else {
      calibrationLabel = "良好";
      biasLabel = "信心大致準確";
    }
  }

  return {
    total,
    correct,
    wrong,
    confidenceEligibleTotal,
    missingConfidenceCount,
    hasMissingConfidence: missingConfidenceCount > 0,
    counts,
    accuracy,
    accuracyPercent,
    stableMasteryRate: safeDivide(counts[4].correct, confidenceEligibleTotal),
    stableMasteryPercent: toPercent(safeDivide(counts[4].correct, confidenceEligibleTotal)),
    calibratedMasteryIndex,
    calibratedMasteryPercent,
    highConfidenceErrorRate,
    highConfidenceErrorPercent: toPercent(highConfidenceErrorRate),
    overconfidenceShare: safeDivide(counts[4].wrong, confidenceEligibleTotal),
    overconfidenceSharePercent: toPercent(safeDivide(counts[4].wrong, confidenceEligibleTotal)),
    guessingRiskRate,
    guessingRiskPercent: toPercent(guessingRiskRate),
    unstableCorrectRate: safeDivide(
      counts[1].correct + counts[2].correct + counts[3].correct,
      correct
    ),
    unstableCorrectPercent: toPercent(
      safeDivide(counts[1].correct + counts[2].correct + counts[3].correct, correct)
    ),
    basicGapRate: safeDivide(counts[1].wrong + counts[2].wrong, confidenceEligibleTotal),
    basicGapPercent: toPercent(safeDivide(counts[1].wrong + counts[2].wrong, confidenceEligibleTotal)),
    shakyConceptRate: safeDivide(counts[3].wrong, confidenceEligibleTotal),
    shakyConceptPercent: toPercent(safeDivide(counts[3].wrong, confidenceEligibleTotal)),
    brierScore,
    calibrationScore,
    calibrationPercent: toPercent(calibrationScore),
    confidenceBias,
    confidenceBiasPercent: toPercent(confidenceBias),
    calibrationLabel,
    biasLabel,
    masteryLevel,
    examPassEstimate,
    sampleMessage: examPassEstimate.reliabilityMessage || getSampleMessage(total),
    summarySentences: buildSummarySentences({
      accuracyPercent,
      calibratedMasteryPercent,
      examPassEstimate,
      highConfidenceWrongCount: counts[4].wrong,
      guessingRiskRate,
      highConfidenceErrorRate
    }),
    confidenceLayers,
    categories,
    reviewItems: sortedReviewItems,
    reviewCount: sortedReviewItems.filter((item) => item.priority > 0).length,
    topicStats: analyzeTopicStats(answers)
  };
}
