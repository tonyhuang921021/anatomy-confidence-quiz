import { getPastPaperOptions, getQuestionsForPastPaper, getAISimulationPaperOptions, getQuestionsForAISimulationPaper } from "@/data/med1QuestionBank";
import type { QuizSession } from "@/types/quiz";
import { inferSimulationPaperKey } from "./simulationPaperStats";
import type { ComparisonPaper } from "./simulationSubjectComparison";

let catalog: Map<string, ComparisonPaper> | undefined;
export function getComparisonPaper(key: string): ComparisonPaper | null {
  if (!catalog) {
    catalog = new Map();
    for (const option of getPastPaperOptions("全部")) {
      if (!option.isComplete || ![80,100].includes(option.questionCount)) continue;
      const questions = getQuestionsForPastPaper(option.key,"全部");
      if (questions.length === option.questionCount && new Set(questions.map(q=>q.id)).size === questions.length) catalog.set(option.key,{key:option.key,questions});
    }
    for (const option of getAISimulationPaperOptions("全部")) {
      if (option.isComplete === false || option.questionCount !== 100) continue;
      const questions = getQuestionsForAISimulationPaper(option.key,"全部");
      if (questions.length === option.questionCount && new Set(questions.map(q=>q.id)).size === questions.length) catalog.set(option.key,{key:option.key,questions});
    }
  }
  return catalog.get(key) ?? null;
}

export function getSessionComparisonPaper(session: QuizSession): ComparisonPaper | null {
  if (session.settings?.mode !== "simulation") return null;
  const key = inferSimulationPaperKey(session);
  return key ? getComparisonPaper(key) : null;
}
