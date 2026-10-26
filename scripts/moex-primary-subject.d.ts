import type { SubjectName } from "../types/quiz";
export const SUBJECT_REGROUPING_EXAM_CODE: number;
export function getMoexPrimarySubject(questionId: string): SubjectName;
export function getMoexPaperGroup(questionId: string): "醫學一" | "醫學二";
export function parseMoexQuestionIdentity(questionId: string): {examCode:number;paperCode:string;questionNumber:number};
