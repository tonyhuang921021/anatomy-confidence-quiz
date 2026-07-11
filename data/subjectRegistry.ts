import {
  med1OutlinesBySubject,
  med1QuestionsBySubject
} from "@/data/med1QuestionBank";
import type { Question, SubjectName } from "@/types/quiz";

export const MED1_SUBJECTS: SubjectName[] = ["解剖學", "組織學", "胚胎學", "生理學", "生物化學"];
export const MED2_SUBJECTS: SubjectName[] = ["微生物免疫學", "寄生蟲學", "公共衛生學", "藥理學", "病理學"];
export const HIDDEN_MULTI_ENTRY_SUBJECTS: SubjectName[] = ["細胞生物學", "分子生物學", "其他醫學一"];

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

function createSubjectRegistryItem(subject: SubjectName, label: string): SubjectRegistryItem {
  return {
    subject,
    enabled: med1QuestionsBySubject[subject].length > 0,
    label,
    get chapters() {
      return med1OutlinesBySubject[subject];
    },
    get questions() {
      return med1QuestionsBySubject[subject];
    }
  };
}

export const subjectRegistry: Record<SubjectName, SubjectRegistryItem> = {
  "醫學（一）": createSubjectRegistryItem("醫學（一）", "醫學（一）全科"),
  "醫學（二）": createSubjectRegistryItem("醫學（二）", "醫學（二）全科"),
  "解剖學": createSubjectRegistryItem("解剖學", "解剖學"),
  "生理學": createSubjectRegistryItem("生理學", "生理學"),
  "生物化學": createSubjectRegistryItem("生物化學", "生物化學"),
  "藥理學": createSubjectRegistryItem("藥理學", "藥理學"),
  "病理學": createSubjectRegistryItem("病理學", "病理學"),
  "微生物免疫學": createSubjectRegistryItem("微生物免疫學", "微生物免疫學"),
  "胚胎學": createSubjectRegistryItem("胚胎學", "胚胎學"),
  "組織學": createSubjectRegistryItem("組織學", "組織學"),
  "寄生蟲學": createSubjectRegistryItem("寄生蟲學", "寄生蟲學"),
  "公共衛生學": createSubjectRegistryItem("公共衛生學", "公共衛生學（歸醫學二）"),
  "細胞生物學": createSubjectRegistryItem("細胞生物學", "細胞生物學"),
  "分子生物學": createSubjectRegistryItem("分子生物學", "分子生物學"),
  "其他醫學一": createSubjectRegistryItem("其他醫學一", "其他醫學一")
};

export const enabledSubjects = Object.values(subjectRegistry).filter((item) => item.enabled);
