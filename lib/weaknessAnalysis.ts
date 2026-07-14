import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import type {
  Attempt,
  Question,
  QuizSession,
  QuizSettings,
  SubjectName
} from "../types/quiz";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_DAYS = 14;

type QuestionHistory = {
  attempts: Attempt[];
  latestAttempt: Attempt;
  wrongCount: number;
};

export type WeaknessDataStatus = "尚無近期紀錄" | "資料有限" | "可分析" | "資料充足";
export type WeaknessEvidence = "中" | "高";

export type WeaknessSubjectSummary = {
  subject: SubjectName;
  uniqueQuestions: number;
  correct: number;
  wrong: number;
  correctRate: number;
  certainWrong: number;
  uncertainCorrect: number;
  eligibleConceptCount: number;
  dataStatus: WeaknessDataStatus;
};

export type WeaknessConcept = {
  primaryTag: string;
  subject: SubjectName;
  uniqueQuestions: number;
  correct: number;
  wrong: number;
  correctRate: number;
  repeatedWrong: number;
  certainWrong: number;
  uncertainCorrect: number;
  evidence: WeaknessEvidence;
  availableQuestionCount: number;
  score: number;
};

export type WeaknessAnalysisResult = {
  cutoffAt: string;
  dataThrough: string | null;
  totalHistoryAttempts: number;
  recentUniqueQuestions: number;
  subjectSummaries: WeaknessSubjectSummary[];
  concepts: WeaknessConcept[];
};

type WeaknessPracticeSettingsInput = {
  subject: SubjectName;
  primaryTag: string;
  questionOrder: string[];
  customPoolLabel?: string;
};

type WeaknessAnalysisInput = {
  questions: Question[];
  sessions: Pick<QuizSession, "id" | "attempts">[];
  selectedSubjects: SubjectName[];
  now?: Date;
  recentDays?: number;
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function conceptKey(subject: SubjectName, primaryTag: string) {
  return `${subject}\u0000${primaryTag}`;
}

function attemptTime(attempt?: Attempt | null) {
  if (!attempt) return null;
  const value = new Date(attempt.answeredAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function isExplicitUncertain(attempt: Attempt) {
  return attempt.confidence >= 1 && attempt.confidence <= 3;
}

function isExplicitCertain(attempt: Attempt) {
  return attempt.confidence === 5;
}

function getDataStatus(uniqueQuestions: number): WeaknessDataStatus {
  if (uniqueQuestions === 0) return "尚無近期紀錄";
  if (uniqueQuestions < 5) return "資料有限";
  if (uniqueQuestions < 12) return "可分析";
  return "資料充足";
}

function dedupeSessionAttempts(
  sessions: Pick<QuizSession, "id" | "attempts">[],
  questionMap: Map<string, Question>
) {
  const deduped: Attempt[] = [];

  for (const session of sessions) {
    const latestByQuestion = new Map<string, Attempt>();
    for (const attempt of session.attempts) {
      if (!questionMap.has(attempt.questionId) || attemptTime(attempt) === null) continue;
      const current = latestByQuestion.get(attempt.questionId);
      if (!current || (attemptTime(attempt) ?? 0) >= (attemptTime(current) ?? 0)) {
        latestByQuestion.set(attempt.questionId, attempt);
      }
    }
    deduped.push(...latestByQuestion.values());
  }

  return deduped;
}

function buildQuestionHistory(attempts: Attempt[]) {
  const attemptsByQuestion = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    const bucket = attemptsByQuestion.get(attempt.questionId) ?? [];
    bucket.push(attempt);
    attemptsByQuestion.set(attempt.questionId, bucket);
  }

  const history = new Map<string, QuestionHistory>();
  for (const [questionId, questionAttempts] of attemptsByQuestion) {
    const sorted = [...questionAttempts].sort(
      (left, right) => (attemptTime(left) ?? 0) - (attemptTime(right) ?? 0)
    );
    const latestAttempt = sorted.at(-1);
    if (!latestAttempt) continue;
    history.set(questionId, {
      attempts: sorted,
      latestAttempt,
      wrongCount: sorted.filter((attempt) => !attempt.isCorrect).length
    });
  }
  return history;
}

function latestRecentAttempts(history: Map<string, QuestionHistory>, cutoffMs: number) {
  const recent = new Map<string, Attempt>();
  for (const [questionId, item] of history) {
    const recentAttempt = [...item.attempts]
      .reverse()
      .find((attempt) => (attemptTime(attempt) ?? 0) >= cutoffMs);
    if (recentAttempt) recent.set(questionId, recentAttempt);
  }
  return recent;
}

export function analyzeRecentWeakness({
  questions,
  sessions,
  selectedSubjects,
  now = new Date(),
  recentDays = DEFAULT_RECENT_DAYS
}: WeaknessAnalysisInput): WeaknessAnalysisResult {
  const eligibleQuestions = questions.filter(
    (question) => question.sourceType !== "AI_GENERATED"
  );
  const questionMap = new Map(
    eligibleQuestions.map((question) => [question.id, question] as const)
  );
  const attempts = dedupeSessionAttempts(sessions, questionMap);
  const history = buildQuestionHistory(attempts);
  const cutoffMs = now.getTime() - recentDays * DAY_MS;
  const recentByQuestion = latestRecentAttempts(history, cutoffMs);
  const recentItems = Array.from(recentByQuestion.entries())
    .map(([questionId, attempt]) => {
      const question = questionMap.get(questionId);
      return question ? { question, attempt } : null;
    })
    .filter((item): item is { question: Question; attempt: Attempt } => Boolean(item));

  const availableQuestionCountByTag = new Map<string, number>();
  for (const question of eligibleQuestions) {
    const primaryTag = getQuestionPrimaryTag(question);
    if (!primaryTag) continue;
    const key = conceptKey(question.subject, primaryTag);
    availableQuestionCountByTag.set(
      key,
      (availableQuestionCountByTag.get(key) ?? 0) + 1
    );
  }

  const conceptCandidates: WeaknessConcept[] = [];
  const eligibleConceptCountBySubject = new Map<SubjectName, number>();
  const recentBySubject = new Map<SubjectName, typeof recentItems>();
  for (const item of recentItems) {
    const bucket = recentBySubject.get(item.question.subject) ?? [];
    bucket.push(item);
    recentBySubject.set(item.question.subject, bucket);
  }

  for (const subject of selectedSubjects) {
    const subjectItems = recentBySubject.get(subject) ?? [];
    const subjectWrongRate =
      subjectItems.length === 0
        ? 0
        : subjectItems.filter((item) => !item.attempt.isCorrect).length / subjectItems.length;
    const tagBuckets = new Map<string, typeof subjectItems>();

    for (const item of subjectItems) {
      const primaryTag = getQuestionPrimaryTag(item.question);
      if (!primaryTag) continue;
      const bucket = tagBuckets.get(primaryTag) ?? [];
      bucket.push(item);
      tagBuckets.set(primaryTag, bucket);
    }

    for (const [primaryTag, items] of tagBuckets) {
      const wrong = items.filter((item) => !item.attempt.isCorrect).length;
      const uncertainCorrect = items.filter(
        (item) => item.attempt.isCorrect && isExplicitUncertain(item.attempt)
      ).length;
      const certainWrong = items.filter(
        (item) => !item.attempt.isCorrect && isExplicitCertain(item.attempt)
      ).length;
      const repeatedWrong = items.filter((item) => {
        const itemHistory = history.get(item.question.id);
        return !item.attempt.isCorrect && (itemHistory?.wrongCount ?? 0) >= 2;
      }).length;
      const hasDistributedErrorEvidence = wrong >= 2;
      const hasDistributedUncertaintyEvidence = uncertainCorrect >= 3;
      const isEligible =
        items.length >= 5 &&
        (hasDistributedErrorEvidence || hasDistributedUncertaintyEvidence);
      if (!isEligible) continue;

      const regularizedWrongRate = (wrong + subjectWrongRate * 3) / (items.length + 3);
      const score =
        regularizedWrongRate * 100 +
        Math.min(4, repeatedWrong) * 4 +
        certainWrong * 3 +
        uncertainCorrect;
      const evidence: WeaknessEvidence =
        items.length >= 12 && wrong + uncertainCorrect >= 4 ? "高" : "中";

      conceptCandidates.push({
        primaryTag,
        subject,
        uniqueQuestions: items.length,
        correct: items.length - wrong,
        wrong,
        correctRate: round(((items.length - wrong) / items.length) * 100),
        repeatedWrong,
        certainWrong,
        uncertainCorrect,
        evidence,
        availableQuestionCount:
          availableQuestionCountByTag.get(conceptKey(subject, primaryTag)) ?? 0,
        score: round(score)
      });
      eligibleConceptCountBySubject.set(
        subject,
        (eligibleConceptCountBySubject.get(subject) ?? 0) + 1
      );
    }
  }

  const subjectSummaries = selectedSubjects.map((subject) => {
    const items = recentBySubject.get(subject) ?? [];
    const wrong = items.filter((item) => !item.attempt.isCorrect).length;
    return {
      subject,
      uniqueQuestions: items.length,
      correct: items.length - wrong,
      wrong,
      correctRate: items.length === 0 ? 0 : round(((items.length - wrong) / items.length) * 100),
      certainWrong: items.filter(
        (item) => !item.attempt.isCorrect && isExplicitCertain(item.attempt)
      ).length,
      uncertainCorrect: items.filter(
        (item) => item.attempt.isCorrect && isExplicitUncertain(item.attempt)
      ).length,
      eligibleConceptCount: eligibleConceptCountBySubject.get(subject) ?? 0,
      dataStatus: getDataStatus(items.length)
    } satisfies WeaknessSubjectSummary;
  });

  const dataThroughMs = attempts.reduce(
    (latest, attempt) => Math.max(latest, attemptTime(attempt) ?? 0),
    0
  );

  return {
    cutoffAt: new Date(cutoffMs).toISOString(),
    dataThrough: dataThroughMs > 0 ? new Date(dataThroughMs).toISOString() : null,
    totalHistoryAttempts: attempts.length,
    recentUniqueQuestions: recentItems.length,
    subjectSummaries,
    concepts: conceptCandidates
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.wrong - left.wrong ||
          right.repeatedWrong - left.repeatedWrong ||
          left.primaryTag.localeCompare(right.primaryTag)
      )
  };
}

export function buildWeaknessPracticeSettings({
  subject,
  primaryTag,
  questionOrder,
  customPoolLabel
}: WeaknessPracticeSettingsInput): QuizSettings {
  return {
    mode: "random",
    questionCount: questionOrder.length,
    sessionName: primaryTag,
    stopAfterReview: true,
    subjectFilter: subject,
    subjectFilters: [subject],
    excludeAiGenerated: true,
    customQuestionIds: questionOrder,
    priorityQuestionIds: questionOrder,
    customPoolLabel: customPoolLabel ?? `考前弱點：${primaryTag}`,
    strictCustomQuestionPool: true,
    preserveCustomQuestionOrder: true,
    enableConfidenceCalibration: true
  };
}

type WeaknessQuestionOrderInput = {
  questions: Question[];
  sessions: Pick<QuizSession, "id" | "attempts">[];
  subject: SubjectName;
  primaryTag: string;
  questionIds?: string[];
  prioritizeUnseen?: boolean;
};

export function buildWeaknessQuestionOrder({
  questions,
  sessions,
  subject,
  primaryTag,
  questionIds,
  prioritizeUnseen = false
}: WeaknessQuestionOrderInput) {
  const explicitQuestionIds = questionIds ? new Set(questionIds) : null;
  const candidates = questions.filter(
    (question) =>
      question.sourceType !== "AI_GENERATED" &&
      question.subject === subject &&
      (explicitQuestionIds
        ? explicitQuestionIds.has(question.id)
        : getQuestionPrimaryTag(question) === primaryTag)
  );
  const questionMap = new Map(candidates.map((question) => [question.id, question] as const));
  const history = buildQuestionHistory(dedupeSessionAttempts(sessions, questionMap));
  const byYear = new Map<number, Question[]>();

  for (const question of candidates) {
    const year = question.sourceYear ?? 0;
    const bucket = byYear.get(year) ?? [];
    bucket.push(question);
    byYear.set(year, bucket);
  }

  const order: string[] = [];
  const years = Array.from(byYear.keys()).sort((left, right) => right - left);

  for (const year of years) {
    const questionsInYear = byYear.get(year) ?? [];
    const unseen = questionsInYear
      .filter((question) => !history.has(question.id))
      .sort((left, right) => (left.originalQuestionNumber ?? 0) - (right.originalQuestionNumber ?? 0));
    const risky = questionsInYear
      .filter((question) => {
        const item = history.get(question.id);
        return Boolean(item && (!item.latestAttempt.isCorrect || isExplicitUncertain(item.latestAttempt)));
      })
      .sort((left, right) => {
        const leftHistory = history.get(left.id);
        const rightHistory = history.get(right.id);
        return (
          (rightHistory?.wrongCount ?? 0) - (leftHistory?.wrongCount ?? 0) ||
          (attemptTime(leftHistory?.latestAttempt) ?? 0) -
            (attemptTime(rightHistory?.latestAttempt) ?? 0)
        );
      });
    const stableSeen = questionsInYear
      .filter((question) => {
        const item = history.get(question.id);
        return Boolean(item && item.latestAttempt.isCorrect && !isExplicitUncertain(item.latestAttempt));
      })
      .sort(
        (left, right) =>
          (attemptTime(history.get(left.id)?.latestAttempt) ?? 0) -
          (attemptTime(history.get(right.id)?.latestAttempt) ?? 0)
      );

    while (unseen.length > 0 || risky.length > 0) {
      for (let index = 0; index < 2 && unseen.length > 0; index += 1) {
        const question = unseen.shift();
        if (question) order.push(question.id);
      }
      const riskyQuestion = risky.shift();
      if (riskyQuestion) order.push(riskyQuestion.id);
      if (unseen.length === 0 && risky.length > 0) {
        order.push(...risky.splice(0).map((question) => question.id));
      }
    }
    order.push(...stableSeen.map((question) => question.id));
  }

  const unseenOrder = order.filter((questionId) => !history.has(questionId));
  const seenOrder = order.filter((questionId) => history.has(questionId));

  if (prioritizeUnseen) return [...unseenOrder, ...seenOrder];

  const mixedOrder: string[] = [];
  const unseenBurstSizes = [2, 3];
  let unseenIndex = 0;
  let seenIndex = 0;
  let burstIndex = 0;

  while (unseenIndex < unseenOrder.length && seenIndex < seenOrder.length) {
    const burstSize = unseenBurstSizes[burstIndex % unseenBurstSizes.length];
    for (
      let index = 0;
      index < burstSize && unseenIndex < unseenOrder.length;
      index += 1
    ) {
      mixedOrder.push(unseenOrder[unseenIndex]);
      unseenIndex += 1;
    }

    mixedOrder.push(seenOrder[seenIndex]);
    seenIndex += 1;
    burstIndex += 1;
  }

  return [
    ...mixedOrder,
    ...unseenOrder.slice(unseenIndex),
    ...seenOrder.slice(seenIndex)
  ];
}
