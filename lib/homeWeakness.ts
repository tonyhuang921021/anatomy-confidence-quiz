import { questionWeaknessIndex } from "@/data/questionWeaknessIndex";

export type HomeWeaknessAttempt = {
  questionId: string;
  isCorrect: boolean;
  confidence?: number | null;
};

export type HomeWeakSectionInsight = {
  chapter: string;
  section: string;
  total: number;
  wrong: number;
  correctRate: number;
  wrongRate: number;
  lowConfidence: number;
  overconfidence: number;
  evidenceScore: number;
};

export const MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS = 10;
export const MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS = 2;
export const MAX_ROTATING_WEAK_SECTIONS = 5;
export const MAX_HOME_WEAKNESS_ATTEMPTS = 500;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function getHomeWeakSectionInsight(attempts: HomeWeaknessAttempt[]): {
  totalAttempts: number;
  insights: HomeWeakSectionInsight[];
} {
  const questionMap = new Map<string, { chapter: string; section: string }>(
    questionWeaknessIndex.map(([id, chapter, section]) => [id, { chapter, section }] as const)
  );
  const sectionMap = new Map<string, HomeWeakSectionInsight>();
  let totalAttempts = 0;

  for (const attempt of attempts.slice(0, MAX_HOME_WEAKNESS_ATTEMPTS)) {
    const question = questionMap.get(attempt.questionId);
    if (!question) continue;
    totalAttempts += 1;

    const key = `${question.chapter}__${question.section}`;
    const current =
      sectionMap.get(key) ??
      ({
        chapter: question.chapter,
        section: question.section,
        total: 0,
        wrong: 0,
        correctRate: 0,
        wrongRate: 0,
        lowConfidence: 0,
        overconfidence: 0,
        evidenceScore: 0
      } satisfies HomeWeakSectionInsight);

    const confidence = Number(attempt.confidence ?? 0);
    current.total += 1;
    current.wrong += attempt.isCorrect ? 0 : 1;
    current.lowConfidence += confidence <= 2 ? 1 : 0;
    current.overconfidence += !attempt.isCorrect && confidence >= 4 ? 1 : 0;
    sectionMap.set(key, current);
  }

  const ranked = Array.from(sectionMap.values())
    .filter((item) => item.total >= MIN_SECTION_ATTEMPTS_FOR_DIAGNOSIS)
    .map((item) => {
      const wrongRate = item.total === 0 ? 0 : round((item.wrong / item.total) * 100);
      const correctRate = item.total === 0 ? 0 : round(100 - wrongRate);
      const lowConfidenceRate = item.total === 0 ? 0 : (item.lowConfidence / item.total) * 100;
      const overconfidenceRate = item.total === 0 ? 0 : (item.overconfidence / item.total) * 100;
      const evidenceScore =
        wrongRate * 0.62 +
        lowConfidenceRate * 0.24 +
        overconfidenceRate * 0.14 +
        Math.min(item.total, 8) * 1.8;

      return {
        ...item,
        correctRate,
        wrongRate,
        evidenceScore: round(evidenceScore)
      };
    })
    .sort(
      (a, b) =>
        b.evidenceScore - a.evidenceScore ||
        b.wrongRate - a.wrongRate ||
        b.total - a.total ||
        a.section.localeCompare(b.section)
    );

  return {
    totalAttempts,
    insights: totalAttempts >= MIN_TOTAL_ATTEMPTS_FOR_DIAGNOSIS ? ranked : []
  };
}
