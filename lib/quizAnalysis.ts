import { anatomyOutline } from "@/data/anatomyQuestions";
import {
  Attempt,
  ChapterCompletionStats,
  CompletionStatsBundle,
  CompletionStatus,
  OverallCompletionStats,
  Question,
  QuestionHistoryStats,
  QuizMode,
  QuizSettings,
  ReviewQuestionItem,
  SectionCompletionStats,
  SectionStats,
  SubjectName,
  SummaryStats
} from "@/types/quiz";

type SectionAggregate = {
  chapter: string;
  section: string;
  attempts: Attempt[];
  uniqueQuestionIds: Set<string>;
  correctCount: number;
  confidenceTotal: number;
  lastAttemptedAt?: string;
};

const round = (value: number) => Math.round(value * 10) / 10;

const getConfidenceLabel = (confidence: number) => {
  switch (confidence) {
    case 1:
      return "完全用猜的";
    case 2:
      return "有印象但不會推";
    case 3:
      return "兩個選項猶豫";
    case 4:
      return "正常有把握";
    case 5:
      return "我很確定";
    default:
      return "未設定";
  }
};

const getStatus = (completionRate: number, masteryScore: number): CompletionStatus => {
  if (completionRate === 0) return "未開始";
  if (completionRate < 80) return "進行中";
  if (masteryScore < 70) return "已完成但不穩";
  return "已完成且穩定";
};

export function calculateSummary(attempts: Attempt[], questions: Question[]): SummaryStats {
  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.isCorrect).length;
  const wrong = total - correct;
  const averageConfidence =
    total === 0 ? 0 : round(attempts.reduce((sum, attempt) => sum + attempt.confidence, 0) / total);
  const overconfidenceCount = attempts.filter(
    (attempt) => !attempt.isCorrect && attempt.confidence >= 4
  ).length;
  const guessRiskCount = attempts.filter(
    (attempt) => attempt.isCorrect && attempt.confidence <= 2
  ).length;
  const priorityWeaknessCount = attempts.filter(
    (attempt) => !attempt.isCorrect && attempt.confidence <= 2
  ).length;

  return {
    total: questions.length > 0 ? total : 0,
    correct,
    wrong,
    correctRate: total === 0 ? 0 : round((correct / total) * 100),
    averageConfidence,
    overconfidenceCount,
    guessRiskCount,
    priorityWeaknessCount
  };
}

export function calculateSectionStats(attempts: Attempt[], questions: Question[]): SectionStats[] {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const sections = new Map<string, SectionStats>();

  attempts.forEach((attempt) => {
    const question = questionMap.get(attempt.questionId);
    if (!question) return;
    const key = `${question.chapter}__${question.section}`;
    const current =
      sections.get(key) ??
      ({
        chapter: question.chapter,
        section: question.section,
        total: 0,
        correct: 0,
        wrong: 0,
        averageConfidence: 0,
        lowConfidence: 0,
        overconfidence: 0,
        guessRisk: 0,
        priorityScore: 0
      } satisfies SectionStats);

    current.total += 1;
    current.correct += attempt.isCorrect ? 1 : 0;
    current.wrong += attempt.isCorrect ? 0 : 1;
    current.averageConfidence += attempt.confidence;
    current.lowConfidence += attempt.confidence <= 2 ? 1 : 0;
    current.overconfidence += !attempt.isCorrect && attempt.confidence >= 4 ? 1 : 0;
    current.guessRisk += attempt.isCorrect && attempt.confidence <= 2 ? 1 : 0;
    current.priorityScore =
      current.wrong * 3 +
      current.lowConfidence * 2 +
      current.overconfidence * 4 +
      current.guessRisk * 2;

    sections.set(key, current);
  });

  return Array.from(sections.values())
    .map((stat) => ({
      ...stat,
      averageConfidence: stat.total === 0 ? 0 : round(stat.averageConfidence / stat.total)
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.chapter.localeCompare(b.chapter));
}

export function getTopWeakSections(sectionStats: SectionStats[], limit = 3) {
  return [...sectionStats]
    .sort((a, b) => b.priorityScore - a.priorityScore || b.wrong - a.wrong)
    .slice(0, limit);
}

function buildSectionAggregates(questions: Question[], allAttempts: Attempt[]) {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const sectionMap = new Map<string, SectionAggregate>();

  anatomyOutline.forEach(({ chapter, sections }) => {
    sections.forEach((section) => {
      sectionMap.set(`${chapter}__${section}`, {
        chapter,
        section,
        attempts: [],
        uniqueQuestionIds: new Set<string>(),
        correctCount: 0,
        confidenceTotal: 0
      });
    });
  });

  allAttempts.forEach((attempt) => {
    const question = questionMap.get(attempt.questionId);
    if (!question) return;
    const key = `${question.chapter}__${question.section}`;
    const aggregate = sectionMap.get(key);
    if (!aggregate) return;
    aggregate.attempts.push(attempt);
    aggregate.uniqueQuestionIds.add(attempt.questionId);
    aggregate.correctCount += attempt.isCorrect ? 1 : 0;
    aggregate.confidenceTotal += attempt.confidence;
    if (!aggregate.lastAttemptedAt || attempt.answeredAt > aggregate.lastAttemptedAt) {
      aggregate.lastAttemptedAt = attempt.answeredAt;
    }
  });

  return sectionMap;
}

function toSectionCompletionStats(
  questions: Question[],
  sectionMap: Map<string, SectionAggregate>
): SectionCompletionStats[] {
  const bankCount = new Map<string, number>();

  anatomyOutline.forEach(({ chapter, sections }) => {
    sections.forEach((section) => {
      bankCount.set(`${chapter}__${section}`, 0);
    });
  });

  questions.forEach((question) => {
    const key = `${question.chapter}__${question.section}`;
    bankCount.set(key, (bankCount.get(key) ?? 0) + 1);
  });

  return Array.from(sectionMap.values()).map((aggregate) => {
    const key = `${aggregate.chapter}__${aggregate.section}`;
    const totalQuestionsInBank = bankCount.get(key) ?? 0;
    const attemptedQuestions = aggregate.uniqueQuestionIds.size;
    const completionRate =
      totalQuestionsInBank === 0 ? 0 : round((attemptedQuestions / totalQuestionsInBank) * 100);
    const correctRate =
      aggregate.attempts.length === 0
        ? 0
        : round((aggregate.correctCount / aggregate.attempts.length) * 100);
    const averageConfidence =
      aggregate.attempts.length === 0
        ? 0
        : round(aggregate.confidenceTotal / aggregate.attempts.length);
    const normalizedConfidence = (averageConfidence / 5) * 100;
    const masteryScore = round(
      completionRate * 0.4 + correctRate * 0.4 + normalizedConfidence * 0.2
    );

    return {
      chapter: aggregate.chapter,
      section: aggregate.section,
      totalQuestionsInBank,
      attemptedQuestions,
      completionRate,
      correctRate,
      averageConfidence,
      masteryScore,
      status: getStatus(completionRate, masteryScore),
      lastAttemptedAt: aggregate.lastAttemptedAt
    };
  });
}

function calculateChapterStats(sections: SectionCompletionStats[]): ChapterCompletionStats[] {
  return anatomyOutline.map(({ chapter }) => {
    const chapterSections = sections.filter((section) => section.chapter === chapter);
    const totalQuestionsInBank = chapterSections.reduce(
      (sum, section) => sum + section.totalQuestionsInBank,
      0
    );
    const attemptedQuestions = chapterSections.reduce(
      (sum, section) => sum + section.attemptedQuestions,
      0
    );
    const completionRate =
      totalQuestionsInBank === 0 ? 0 : round((attemptedQuestions / totalQuestionsInBank) * 100);
    const correctRate =
      chapterSections.length === 0
        ? 0
        : round(
            chapterSections.reduce((sum, section) => sum + section.correctRate, 0) /
              chapterSections.length
          );
    const averageConfidence =
      chapterSections.length === 0
        ? 0
        : round(
            chapterSections.reduce((sum, section) => sum + section.averageConfidence, 0) /
              chapterSections.length
          );
    const normalizedConfidence = (averageConfidence / 5) * 100;
    const masteryScore = round(
      completionRate * 0.4 + correctRate * 0.4 + normalizedConfidence * 0.2
    );

    return {
      chapter,
      totalQuestionsInBank,
      attemptedQuestions,
      completionRate,
      correctRate,
      averageConfidence,
      masteryScore,
      status: getStatus(completionRate, masteryScore),
      sections: chapterSections,
    };
  });
}

export function calculateOverallCompletion(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[]
): OverallCompletionStats {
  const allAttempts = allSessions.flatMap((session) => session.attempts);
  const uniqueAttempted = new Set(allAttempts.map((attempt) => attempt.questionId)).size;
  const correctRate =
    allAttempts.length === 0
      ? 0
      : round((allAttempts.filter((attempt) => attempt.isCorrect).length / allAttempts.length) * 100);
  const averageConfidence =
    allAttempts.length === 0
      ? 0
      : round(allAttempts.reduce((sum, attempt) => sum + attempt.confidence, 0) / allAttempts.length);
  const completionRate =
    questions.length === 0 ? 0 : round((uniqueAttempted / questions.length) * 100);
  const normalizedConfidence = (averageConfidence / 5) * 100;
  const masteryScore = round(completionRate * 0.4 + correctRate * 0.4 + normalizedConfidence * 0.2);

  return {
    totalQuestionsInBank: questions.length,
    attemptedQuestions: uniqueAttempted,
    completionRate,
    correctRate,
    averageConfidence,
    masteryScore
  };
}

export function calculateCompletionStats(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[]
): CompletionStatsBundle {
  const allAttempts = allSessions.flatMap((session) => session.attempts);
  const sectionMap = buildSectionAggregates(questions, allAttempts);
  const sections = toSectionCompletionStats(questions, sectionMap).sort(
    (a, b) => a.chapter.localeCompare(b.chapter) || a.section.localeCompare(b.section)
  );
  const chapters = calculateChapterStats(sections);
  const overall = calculateOverallCompletion(questions, allSessions);

  return { overall, chapters, sections };
}

export function getLowCompletionSections(sectionStats: SectionCompletionStats[], limit = 5) {
  return [...sectionStats]
    .sort((a, b) => a.completionRate - b.completionRate || a.masteryScore - b.masteryScore)
    .slice(0, limit);
}

export function getUnstableCompletedSections(sectionStats: SectionCompletionStats[], limit = 5) {
  return sectionStats
    .filter((section) => section.completionRate >= 80 && section.masteryScore < 70)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, limit);
}

export function getTopMasteredSections(sectionStats: SectionCompletionStats[], limit = 5) {
  return [...sectionStats]
    .filter((section) => section.attemptedQuestions > 0)
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .slice(0, limit);
}

export function getNextRecommendedSections(
  sectionStats: SectionCompletionStats[],
  limit = 5
) {
  return [...sectionStats]
    .filter((section) => section.totalQuestionsInBank > 0)
    .map((section) => ({
      ...section,
      recommendationScore:
        (100 - section.completionRate) * 0.45 +
        (100 - section.masteryScore) * 0.45 +
        (section.averageConfidence > 0 ? 5 - section.averageConfidence : 3) * 6
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit);
}

export function generateAIPrompt(
  attempts: Attempt[],
  questions: Question[],
  allSessions: { attempts: Attempt[] }[]
) {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const subjectLabel = (() => {
    const subjects = Array.from(
      new Set(
        attempts
          .map((attempt) => questionMap.get(attempt.questionId)?.subject)
          .filter((value): value is SubjectName => Boolean(value))
      )
    );

    if (subjects.length === 0) return "解剖學";
    if (subjects.length === 1) return subjects[0];
    return "醫學（一）";
  })();
  const summary = calculateSummary(attempts, questions);
  const sectionStats = calculateSectionStats(attempts, questions);
  const topWeakSections = getTopWeakSections(sectionStats, 3);
  const completionStats = calculateCompletionStats(questions, allSessions);
  const lowCompletionSections = getLowCompletionSections(completionStats.sections, 5);
  const unstableSections = getUnstableCompletedSections(completionStats.sections, 5);

  const attemptLines = attempts.map((attempt, index) => {
    const question = questionMap.get(attempt.questionId);
    if (!question) return "";
    return [
      `${index + 1}. 題號：${question.id}`,
      `來源：${question.sourceType ?? (question.source === "past-exam-inspired" ? "PAST_EXAM_STYLE" : question.source === "ai-generated" ? "AI_GENERATED" : "LOCAL_BANK")}`,
      `來源註記：${question.sourceCitation ?? "未提供"}`,
      `chapter：${question.chapter}`,
      `section：${question.section}`,
      `testedConcept：${question.testedConcept}`,
      `我的答案：${attempt.selectedAnswer}`,
      `正確答案：${attempt.correctAnswer}`,
      `是否答對：${attempt.isCorrect ? "答對" : "答錯"}`,
      `confidence：${attempt.confidence}`,
      `信心文字：${getConfidenceLabel(attempt.confidence)}`,
      `errorType：${attempt.errorType ?? "未填"}`,
      `explanation 摘要：${question.explanation}`
    ].join("｜");
  });

  const chapterLines = completionStats.chapters.map((chapter) => {
    return `${chapter.chapter}：completionRate ${chapter.completionRate}%｜masteryScore ${chapter.masteryScore}｜status ${chapter.status}`;
  });

  const sectionLines = completionStats.sections.map((section) => {
    return `${section.chapter} / ${section.section}：completionRate ${section.completionRate}%｜correctRate ${section.correctRate}%｜averageConfidence ${section.averageConfidence}｜masteryScore ${section.masteryScore}｜status ${section.status}`;
  });

  const weakLines = topWeakSections.map((section) => {
    return `${section.chapter} / ${section.section}：priorityScore ${section.priorityScore}｜wrong ${section.wrong}｜averageConfidence ${section.averageConfidence}`;
  });

  const lowCompletionLines = lowCompletionSections.map((section) => {
    return `${section.chapter} / ${section.section}：completionRate ${section.completionRate}%｜masteryScore ${section.masteryScore}`;
  });

  const unstableLines = unstableSections.map((section) => {
    return `${section.chapter} / ${section.section}：completionRate ${section.completionRate}%｜masteryScore ${section.masteryScore}`;
  });

  const overconfidenceLines = attempts
    .filter((attempt) => !attempt.isCorrect && attempt.confidence >= 4)
    .map((attempt) => {
      const question = questionMap.get(attempt.questionId);
      if (!question) return "";
      return `${question.chapter} / ${question.section}｜${question.testedConcept}｜答錯但信心高（${attempt.confidence}）｜我的答案 ${attempt.selectedAnswer}｜正解 ${attempt.correctAnswer}`;
    })
    .filter(Boolean);

  const priorityWeaknessLines = attempts
    .filter((attempt) => !attempt.isCorrect && attempt.confidence <= 2)
    .map((attempt) => {
      const question = questionMap.get(attempt.questionId);
      if (!question) return "";
      return `${question.chapter} / ${question.section}｜${question.testedConcept}｜答錯且低信心（${attempt.confidence}）｜錯因 ${attempt.errorType ?? "未填"}`;
    })
    .filter(Boolean);

  const wrongLines = attempts
    .filter((attempt) => !attempt.isCorrect)
    .map((attempt) => {
      const question = questionMap.get(attempt.questionId);
      if (!question) return "";
      return `${question.chapter} / ${question.section}｜${question.testedConcept}｜信心 ${attempt.confidence}｜我的答案 ${attempt.selectedAnswer}｜正解 ${attempt.correctAnswer}｜錯因 ${attempt.errorType ?? "未填"}`;
    })
    .filter(Boolean);

  const lowConfidenceLines = attempts
    .filter((attempt) => attempt.confidence <= 3)
    .map((attempt) => {
      const question = questionMap.get(attempt.questionId);
      if (!question) return "";
      return `${question.chapter} / ${question.section}｜${question.testedConcept}｜${attempt.isCorrect ? "答對但沒信心" : "答錯且沒信心"}（${attempt.confidence}）｜我的答案 ${attempt.selectedAnswer}｜正解 ${attempt.correctAnswer}`;
    })
    .filter(Boolean);

  const confidenceScopedWeaknessLines = topWeakSections.map((section) => {
    const relatedAttempts = attempts.filter((attempt) => {
      const question = questionMap.get(attempt.questionId);
      return question?.chapter === section.chapter && question.section === section.section;
    });

    const lowestConfidence = relatedAttempts.length
      ? Math.min(...relatedAttempts.map((attempt) => attempt.confidence))
      : 4;
    const lowConfidenceWrongCount = relatedAttempts.filter(
      (attempt) => !attempt.isCorrect && attempt.confidence <= 2
    ).length;

    let scope = "單一知識點";
    let scopeInstruction = "請只補最直接的 testedConcept，外加 1 個最容易混淆的相鄰考點。";

    if (lowestConfidence === 1 || lowConfidenceWrongCount >= 2) {
      scope = "整個相關段落";
      scopeInstruction =
        "請從這個 section 的基礎架構開始補，帶到整段相關觀念、常考比較與典型陷阱。";
    } else if (lowestConfidence === 2) {
      scope = "相關考點群";
      scopeInstruction =
        "請以 testedConcept 為核心，延伸到同一 section 最常一起考的相關考點群，但不要擴張到整個章節。";
    } else if (lowestConfidence === 3) {
      scope = "單一知識點加相鄰考點";
      scopeInstruction =
        "請聚焦在這題對應知識點，並補 1 到 2 個最常一起混淆的相鄰考點。";
    }

    return `${section.chapter} / ${section.section}｜建議補強層級：${scope}｜最低信心 ${lowestConfidence}｜低信心答錯 ${lowConfidenceWrongCount} 題｜補法：${scopeInstruction}`;
  });

  return `以下是我的${subjectLabel}醫師國考測驗紀錄。請你只做「弱點知識補強」，不要稱讚我、不要總結我哪裡做得不錯、不要輸出太多與補弱無關的分析，也不要重複貼回原始統計。

回答規則：
1. 必須覆蓋我所有答錯題，以及所有低信心題（confidence <= 3），不能漏掉任何一題。
2. 如果多題屬於同一個 testedConcept 或同一組高度相關觀念，可以合併講解，但要在標題中清楚列出你正在講哪些題目或哪些 testedConcept。
3. 不要先寫整體表現總結，直接從需要補的題目或觀念開始講。
4. 每一組輸出的補強範圍要依我的信心程度決定：
   - 如果建議補強層級是「單一知識點」，就只補那個 testedConcept，不要擴寫太多。
   - 如果建議補強層級是「單一知識點加相鄰考點」，就補核心知識點外加 1 到 2 個常混淆考點。
   - 如果建議補強層級是「相關考點群」，就補同一 section 常一起考的考點群，但不要講整個章節。
   - 如果建議補強層級是「整個相關段落」，就從基礎架構開始補到該段落的高頻觀念與陷阱。
5. 每一組只回答以下內容：
   - 這一題或這一組題為什麼需要補
   - 30 秒核心觀念
   - 國考高頻考點
   - 最常錯的陷阱與混淆點
   - 容易混淆比較表
   - 快速記憶法
   - 3 題立即小測驗（附答案）
6. 如果我有錯誤自信，請特別指出我觀念錯在哪裡。
7. 如果我有低信心答錯，請用更基礎、可快速重建的方式教。
8. 如果我有低信心但答對的題，請一起補講，因為代表我會做但不穩。
9. 你可以依照「所有錯題」與「所有低信心題」整理成有條理的段落，但不要只挑前幾個 section 來講。
10. 不要另外安排鼓勵、讀書計畫、人格分析、整體優缺點、稱讚或與弱點無關的延伸內容。
11. 請用台灣醫學生準備醫師國考一階的語氣與深度回答，重點放在知識本身，越精準越好。

以下是本輪整體統計：
總題數：${summary.total}
答對題數：${summary.correct}
答對率：${summary.correctRate}%
平均信心：${summary.averageConfidence}
錯誤自信數：${summary.overconfidenceCount}
猜對風險數：${summary.guessRiskCount}
優先補弱數：${summary.priorityWeaknessCount}

以下是本輪作答紀錄：
${attemptLines.join("\n")}

以下是所有答錯題：
${wrongLines.join("\n") || "目前沒有資料"}

以下是錯誤自信題：
${overconfidenceLines.join("\n") || "目前沒有資料"}

以下是優先補弱題：
${priorityWeaknessLines.join("\n") || "目前沒有資料"}

以下是低信心題（包含答對但不穩）：
${lowConfidenceLines.join("\n") || "目前沒有資料"}

以下是依信心程度建議的補強範圍：
${confidenceScopedWeaknessLines.join("\n") || "目前沒有資料"}

以下是目前完成度統計：
整體 anatomy completionRate：${completionStats.overall.completionRate}%
整體 masteryScore：${completionStats.overall.masteryScore}

各 chapter completion：
${chapterLines.join("\n")}

各 section completion：
${sectionLines.join("\n")}

以下是最需要補弱的小節：
${weakLines.join("\n") || "目前沒有資料"}

以下是完成度最低的小節：
${lowCompletionLines.join("\n") || "目前沒有資料"}

以下是已完成但不穩的小節：
${unstableLines.join("\n") || "目前沒有資料"}

請直接開始輸出「最需要補的知識」，不要先寫客套開場。`;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  mode: "weakness",
  questionCount: 10,
  subjectFilter: "解剖學",
  excludeAiGenerated: true,
  feedbackMode: "full",
  paperMode: "random_set"
};

export function getModeLabel(mode: QuizMode) {
  switch (mode) {
    case "random":
      return "隨機刷題";
    case "weakness":
      return "弱點補強";
    case "review":
      return "錯題複習";
    case "simulation":
      return "模擬考模式";
    default:
      return "測驗";
  }
}

export function buildQuestionHistoryMap(allSessions: { attempts: Attempt[] }[]) {
  const map = new Map<string, QuestionHistoryStats>();

  allSessions.forEach((session) => {
    session.attempts.forEach((attempt) => {
      const current =
        map.get(attempt.questionId) ??
        ({
          questionId: attempt.questionId,
          attempts: 0,
          wrong: 0,
          correct: 0,
          lowConfidence: 0,
          overconfidence: 0
        } satisfies QuestionHistoryStats);

      current.attempts += 1;
      current.correct += attempt.isCorrect ? 1 : 0;
      current.wrong += attempt.isCorrect ? 0 : 1;
      current.lowConfidence += attempt.confidence <= 2 ? 1 : 0;
      current.overconfidence += !attempt.isCorrect && attempt.confidence >= 4 ? 1 : 0;
      current.latestErrorType = attempt.errorType ?? current.latestErrorType;

      if (!current.lastAttemptedAt || attempt.answeredAt > current.lastAttemptedAt) {
        current.lastAttemptedAt = attempt.answeredAt;
      }

      map.set(attempt.questionId, current);
    });
  });

  return map;
}

function normalizeQuestionCount(questionCount: number, max: number) {
  return Math.max(1, Math.min(questionCount, max));
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getPrioritizedFreshPool(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[]
) {
  const historyMap = buildQuestionHistoryMap(allSessions);
  const unseen = shuffle(questions.filter((question) => !historyMap.has(question.id)));
  const seen = shuffle(
    questions.filter((question) => historyMap.has(question.id))
  ).sort((a, b) => {
    const attemptedAtA = historyMap.get(a.id)?.lastAttemptedAt ?? "";
    const attemptedAtB = historyMap.get(b.id)?.lastAttemptedAt ?? "";
    return attemptedAtA.localeCompare(attemptedAtB);
  });

  return [...unseen, ...seen];
}

function diversifyBySection<T extends { question: Question; score: number }>(
  items: T[],
  count: number,
  candidateMultiplier = 4
) {
  const candidateCount = Math.min(items.length, Math.max(count * candidateMultiplier, count));
  const candidatePool = shuffle(items.slice(0, candidateCount));
  const sectionBuckets = new Map<string, T[]>();

  candidatePool.forEach((item) => {
    const key = `${item.question.chapter}__${item.question.section}`;
    const bucket = sectionBuckets.get(key) ?? [];
    bucket.push(item);
    sectionBuckets.set(key, bucket);
  });

  const result: T[] = [];

  while (result.length < count && sectionBuckets.size > 0) {
    const sectionKeys = shuffle(Array.from(sectionBuckets.keys()));

    for (const key of sectionKeys) {
      const bucket = sectionBuckets.get(key);
      if (!bucket || bucket.length === 0) {
        sectionBuckets.delete(key);
        continue;
      }

      const nextItem = bucket.shift();
      if (nextItem) {
        result.push(nextItem);
      }

      if (bucket.length === 0) {
        sectionBuckets.delete(key);
      }

      if (result.length >= count) {
        break;
      }
    }
  }

  return result;
}

function buildQuestionScoreMap(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[],
  settings: QuizSettings
) {
  const completion = calculateCompletionStats(questions, allSessions);
  const completionMap = new Map(
    completion.sections.map((section) => [`${section.chapter}__${section.section}`, section] as const)
  );
  const historyMap = buildQuestionHistoryMap(allSessions);

  return shuffle(questions).map((question) => {
    const sectionStats = completionMap.get(`${question.chapter}__${question.section}`);
    const history = historyMap.get(question.id);
    const completionPenalty = 100 - (sectionStats?.completionRate ?? 0);
    const masteryPenalty = 100 - (sectionStats?.masteryScore ?? 0);
    const wrongWeight = (history?.wrong ?? 0) * 28;
    const lowConfidenceWeight = (history?.lowConfidence ?? 0) * 14;
    const overconfidenceWeight = (history?.overconfidence ?? 0) * 20;
    const unseenBonus = history ? 0 : 26;
    const seenPenalty = history ? 60 : 0;
    const pastExamBonus = question.sourceType === "MOEX_PAST_EXAM" ? 8 : 0;
    const chapterMatchBonus = settings.chapter && settings.chapter === question.chapter ? 18 : 0;
    const sectionMatchBonus = settings.section && settings.section === question.section ? 28 : 0;
    const reviewBonus = settings.mode === "review" && history && history.wrong > 0 ? 48 : 0;

    return {
      question,
      history,
      score:
        completionPenalty * 0.35 +
        masteryPenalty * 0.35 +
        wrongWeight +
        lowConfidenceWeight +
        overconfidenceWeight +
        unseenBonus +
        pastExamBonus +
        chapterMatchBonus +
        sectionMatchBonus +
        reviewBonus -
        seenPenalty
    };
  });
}

function filterQuestionPool(questions: Question[], settings: QuizSettings) {
  return questions.filter((question) => {
    if (settings.excludeAiGenerated && question.sourceType === "AI_GENERATED") return false;
    if (settings.chapter && question.chapter !== settings.chapter) return false;
    if (settings.section && question.section !== settings.section) return false;
    return true;
  });
}

export function createQuestionOrder(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[],
  settings: QuizSettings
) {
  const filtered = filterQuestionPool(questions, settings);
  const sourcePool = filtered.length > 0 ? filtered : settings.excludeAiGenerated ? [] : questions;
  if (sourcePool.length === 0) return [];

  const count = normalizeQuestionCount(settings.questionCount, sourcePool.length);
  const scored = buildQuestionScoreMap(sourcePool, allSessions, settings);

  if (settings.mode === "random") {
    return getPrioritizedFreshPool(sourcePool, allSessions)
      .slice(0, count)
      .map((question) => question.id);
  }

  if (settings.mode === "simulation") {
    const simulationPool =
      settings.paperMode === "past_paper" || settings.paperMode === "random_past_paper"
        ? sourcePool
        : shuffle(sourcePool);

    return simulationPool.slice(0, count).map((question) => question.id);
  }

  if (settings.mode === "review") {
    const reviewFirst = scored
      .filter((item) => (item.history?.wrong ?? 0) > 0 || (item.history?.lowConfidence ?? 0) > 0)
      .sort((a, b) => b.score - a.score);

    const fallback = scored
      .filter((item) => !reviewFirst.some((reviewItem) => reviewItem.question.id === item.question.id))
      .sort((a, b) => b.score - a.score);

    return [...diversifyBySection(reviewFirst, count, 3), ...diversifyBySection(fallback, count, 3)]
      .slice(0, count)
      .map((item) => item.question.id);
  }

  return diversifyBySection(
    scored.sort((a, b) => b.score - a.score),
    count,
    4
  ).map((item) => item.question.id);
}

export function getReviewQuestionItems(
  questions: Question[],
  allSessions: { attempts: Attempt[] }[],
  limit = 20
): ReviewQuestionItem[] {
  const historyMap = buildQuestionHistoryMap(allSessions);

  return questions
    .map((question) => {
      const history = historyMap.get(question.id);
      if (!history || (history.wrong === 0 && history.lowConfidence === 0)) return null;
      const riskScore =
        history.wrong * 4 + history.lowConfidence * 2 + history.overconfidence * 3 - history.correct;
      return { question, history, riskScore };
    })
    .filter((item): item is ReviewQuestionItem => Boolean(item))
    .sort((a, b) => b.riskScore - a.riskScore || b.history.wrong - a.history.wrong)
    .slice(0, limit);
}

export function getReviewSnapshot(reviewItems: ReviewQuestionItem[]) {
  return {
    total: reviewItems.length,
    overconfidence: reviewItems.filter((item) => item.history.overconfidence > 0).length,
    lowConfidence: reviewItems.filter((item) => item.history.lowConfidence > 0).length,
    wrongHeavy: reviewItems.filter((item) => item.history.wrong >= 2).length
  };
}

export { getConfidenceLabel };
