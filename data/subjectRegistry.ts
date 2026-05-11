import {
  med1OutlinesBySubject,
  med1QuestionsBySubject
} from "@/data/med1QuestionBank";
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
  "醫學（一）": {
    subject: "醫學（一）",
    enabled: med1QuestionsBySubject["醫學（一）"].length > 0,
    label: "醫學（一）全科",
    chapters: med1OutlinesBySubject["醫學（一）"],
    questions: med1QuestionsBySubject["醫學（一）"]
  },
  "醫學（二）": {
    subject: "醫學（二）",
    enabled: med1QuestionsBySubject["醫學（二）"].length > 0,
    label: "醫學（二）全科",
    chapters: med1OutlinesBySubject["醫學（二）"],
    questions: med1QuestionsBySubject["醫學（二）"]
  },
  "解剖學": {
    subject: "解剖學",
    enabled: med1QuestionsBySubject["解剖學"].length > 0,
    label: "解剖學（含組織／胚胎）",
    chapters: med1OutlinesBySubject["解剖學"],
    questions: med1QuestionsBySubject["解剖學"]
  },
  "生理學": {
    subject: "生理學",
    enabled: med1QuestionsBySubject["生理學"].length > 0,
    label: "生理學",
    chapters: med1OutlinesBySubject["生理學"],
    questions: med1QuestionsBySubject["生理學"]
  },
  "生物化學": {
    subject: "生物化學",
    enabled: med1QuestionsBySubject["生物化學"].length > 0,
    label: "生物化學（含細胞／分子）",
    chapters: med1OutlinesBySubject["生物化學"],
    questions: med1QuestionsBySubject["生物化學"]
  },
  "藥理學": {
    subject: "藥理學",
    enabled: med1QuestionsBySubject["藥理學"].length > 0,
    label: "藥理學",
    chapters: med1OutlinesBySubject["藥理學"],
    questions: med1QuestionsBySubject["藥理學"]
  },
  "病理學": {
    subject: "病理學",
    enabled: med1QuestionsBySubject["病理學"].length > 0,
    label: "病理學",
    chapters: med1OutlinesBySubject["病理學"],
    questions: med1QuestionsBySubject["病理學"]
  },
  "微生物免疫學": {
    subject: "微生物免疫學",
    enabled: med1QuestionsBySubject["微生物免疫學"].length > 0,
    label: "微生物免疫學",
    chapters: med1OutlinesBySubject["微生物免疫學"],
    questions: med1QuestionsBySubject["微生物免疫學"]
  },
  "胚胎學": {
    subject: "胚胎學",
    enabled: med1QuestionsBySubject["胚胎學"].length > 0,
    label: "胚胎學",
    chapters: med1OutlinesBySubject["胚胎學"],
    questions: med1QuestionsBySubject["胚胎學"]
  },
  "組織學": {
    subject: "組織學",
    enabled: med1QuestionsBySubject["組織學"].length > 0,
    label: "組織學",
    chapters: med1OutlinesBySubject["組織學"],
    questions: med1QuestionsBySubject["組織學"]
  },
  "寄生蟲學": {
    subject: "寄生蟲學",
    enabled: med1QuestionsBySubject["寄生蟲學"].length > 0,
    label: "寄生蟲學",
    chapters: med1OutlinesBySubject["寄生蟲學"],
    questions: med1QuestionsBySubject["寄生蟲學"]
  },
  "公共衛生學": {
    subject: "公共衛生學",
    enabled: med1QuestionsBySubject["公共衛生學"].length > 0,
    label: "公共衛生學（歸醫學二）",
    chapters: med1OutlinesBySubject["公共衛生學"],
    questions: med1QuestionsBySubject["公共衛生學"]
  },
  "細胞生物學": {
    subject: "細胞生物學",
    enabled: med1QuestionsBySubject["細胞生物學"].length > 0,
    label: "細胞生物學",
    chapters: med1OutlinesBySubject["細胞生物學"],
    questions: med1QuestionsBySubject["細胞生物學"]
  },
  "分子生物學": {
    subject: "分子生物學",
    enabled: med1QuestionsBySubject["分子生物學"].length > 0,
    label: "分子生物學",
    chapters: med1OutlinesBySubject["分子生物學"],
    questions: med1QuestionsBySubject["分子生物學"]
  },
  "其他醫學一": {
    subject: "其他醫學一",
    enabled: med1QuestionsBySubject["其他醫學一"].length > 0,
    label: "其他醫學一",
    chapters: med1OutlinesBySubject["其他醫學一"],
    questions: med1QuestionsBySubject["其他醫學一"]
  }
};

export const enabledSubjects = Object.values(subjectRegistry).filter((item) => item.enabled);
