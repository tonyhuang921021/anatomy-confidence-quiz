import type { StudyNoteSummary, SubjectName } from "@/types/quiz";

export const MICROBIOLOGY_IMMUNOLOGY_SUBJECT = "微生物免疫學" as SubjectName;

export type MicrobiologyImmunologyCategory = "virus" | "bacteria" | "immunity";

export const MICROBIOLOGY_IMMUNOLOGY_CATEGORIES: {
  id: MicrobiologyImmunologyCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "virus",
    label: "病毒",
    description: "病毒學、病毒疾病與病毒相關考點"
  },
  {
    id: "bacteria",
    label: "細菌",
    description: "細菌學、抗菌機轉與感染相關考點"
  },
  {
    id: "immunity",
    label: "免疫",
    description: "免疫學、免疫反應與未分到病毒/細菌的既有筆記"
  }
];

function includesAny(value: string | undefined, keywords: string[]) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function isMicrobiologyImmunologySubject(subject?: string | null) {
  return subject === MICROBIOLOGY_IMMUNOLOGY_SUBJECT;
}

export function getMicrobiologyImmunologyCategory(note: Pick<StudyNoteSummary, "collectionName" | "chapter" | "section">) {
  const values = [note.collectionName, note.chapter, note.section].filter(Boolean).join(" ");
  if (includesAny(values, ["病毒", "virus", "viral", "virology"])) return "virus";
  if (includesAny(values, ["細菌", "bacteria", "bacterial", "bacteriology"])) return "bacteria";
  return "immunity";
}

export function filterMicrobiologyImmunologyNotes<T extends Pick<StudyNoteSummary, "collectionName" | "chapter" | "section">>(
  notes: T[],
  category?: string | null
) {
  if (!category) return notes;
  if (!MICROBIOLOGY_IMMUNOLOGY_CATEGORIES.some((item) => item.id === category)) return notes;
  return notes.filter((note) => getMicrobiologyImmunologyCategory(note) === category);
}
