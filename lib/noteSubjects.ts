import { MED1_SUBJECTS, MED2_SUBJECTS, subjectRegistry } from "@/data/subjectRegistry";
import type { SubjectName } from "@/types/quiz";

export const NOTE_SUBJECTS: SubjectName[] = [...MED1_SUBJECTS, ...MED2_SUBJECTS];

export function getNoteSubjectItem(subject: SubjectName | string) {
  return subjectRegistry[subject as SubjectName];
}

export function isNoteSubject(subject: string): subject is SubjectName {
  return NOTE_SUBJECTS.includes(subject as SubjectName);
}
