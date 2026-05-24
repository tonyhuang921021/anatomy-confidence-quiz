import { importedCustomPaperQuestions } from "@/data/importedCustomPaperQuestions";
import type { CustomPaperDifficulty, Question, SubjectName } from "@/types/quiz";

export type BundledCustomPaperSeed = {
  paperCode: string;
  name: string;
  questionIds: string[];
  questions?: Question[];
  subjectFilters: SubjectName[];
  difficulty: CustomPaperDifficulty;
  isPublic: boolean;
  createdByEmail: string;
  createdByLabel: string;
};

export const bundledCustomPaperSeeds: BundledCustomPaperSeed[] = [
  {
    paperCode: "SQH10",
    name: "很難的解剖十題",
    questionIds: importedCustomPaperQuestions.map((question) => question.id),
    questions: importedCustomPaperQuestions,
    subjectFilters: ["解剖學"],
    difficulty: "hard",
    isPublic: false,
    createdByEmail: "tonyhuang921021@gmail.com",
    createdByLabel: "松鼠"
  }
];
