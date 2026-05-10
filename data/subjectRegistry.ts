import { anatomyOutline, anatomyQuestions } from "@/data/anatomyQuestions";
import type { Question, SubjectName } from "@/types/quiz";

export type SubjectRegistryItem = {
  subject: SubjectName;
  enabled: boolean;
  label: string;
  chapters: readonly {
    chapter: string;
    sections: readonly string[];
  }[];
  questions: Question[];
};

export const subjectRegistry: Record<SubjectName, SubjectRegistryItem> = {
  "解剖學": {
    subject: "解剖學",
    enabled: true,
    label: "解剖學",
    chapters: anatomyOutline,
    questions: anatomyQuestions
  },
  "生理學": {
    subject: "生理學",
    enabled: false,
    label: "生理學",
    chapters: [],
    questions: []
  },
  "生物化學": {
    subject: "生物化學",
    enabled: false,
    label: "生物化學",
    chapters: [],
    questions: []
  },
  "藥理學": {
    subject: "藥理學",
    enabled: false,
    label: "藥理學",
    chapters: [],
    questions: []
  },
  "病理學": {
    subject: "病理學",
    enabled: false,
    label: "病理學",
    chapters: [],
    questions: []
  },
  "微生物免疫學": {
    subject: "微生物免疫學",
    enabled: false,
    label: "微生物免疫學",
    chapters: [],
    questions: []
  },
  "胚胎學": {
    subject: "胚胎學",
    enabled: false,
    label: "胚胎學",
    chapters: [],
    questions: []
  },
  "組織學": {
    subject: "組織學",
    enabled: false,
    label: "組織學",
    chapters: [],
    questions: []
  }
};

export const enabledSubjects = Object.values(subjectRegistry).filter((item) => item.enabled);
