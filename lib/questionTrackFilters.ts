import type { Question, SubjectName } from "@/types/quiz";

export const MICROBIOLOGY_SUBJECT = "微生物免疫學" as SubjectName;
export const BIOCHEMISTRY_SUBJECT = "生物化學" as SubjectName;

export type TrackSubject = typeof MICROBIOLOGY_SUBJECT;

export const SUBJECT_TRACKS = {
  [MICROBIOLOGY_SUBJECT]: [
    { key: "virus", label: "病毒" },
    { key: "bacteria", label: "細菌" },
    { key: "immunity", label: "免疫" }
  ]
} as const;

export type SubjectTrackKey<T extends TrackSubject = TrackSubject> =
  (typeof SUBJECT_TRACKS)[T][number]["key"];
type MicrobiologyTrackKey = "virus" | "bacteria" | "immunity";

const MICROBIOLOGY_KEYWORDS: Record<MicrobiologyTrackKey, string[]> = {
  virus: [
    "病毒",
    "virus",
    "viral",
    "viridae",
    "virinae",
    "phage",
    "rna virus",
    "dna virus",
    "hiv",
    "hbv",
    "hcv",
    "hav",
    "hev",
    "cmv",
    "ebv",
    "hsv",
    "vzv",
    "hpv",
    "influenza",
    "adenovirus",
    "enterovirus",
    "rotavirus",
    "rubella",
    "measles",
    "mumps",
    "rabies",
    "poliovirus",
    "coronavirus",
    "hepatitis",
    "retrovirus",
    "herpes",
    "poxvirus",
    "parvovirus",
    "togavirus",
    "flavivirus",
    "picornavirus",
    "orthomyxovirus",
    "paramyxovirus",
    "papillomavirus"
  ],
  bacteria: [
    "微生物",
    "microbiology",
    "microbe",
    "microbial",
    "細菌",
    "bacteria",
    "bacterial",
    "bacillus",
    "coccus",
    "菌",
    "桿菌",
    "球菌",
    "螺旋菌",
    "分枝桿菌",
    "抗酸菌",
    "革蘭",
    "gram",
    "staphylococcus",
    "streptococcus",
    "neisseria",
    "escherichia",
    "salmonella",
    "shigella",
    "vibrio",
    "clostridium",
    "corynebacterium",
    "listeria",
    "mycobacterium",
    "treponema",
    "borrelia",
    "leptospira",
    "chlamydia",
    "rickettsia",
    "mycoplasma",
    "pseudomonas",
    "klebsiella",
    "proteus",
    "bacteroides",
    "actinomyces",
    "nocardia",
    "真菌",
    "黴菌",
    "fung",
    "mycos",
    "candida",
    "cryptococcus",
    "aspergillus",
    "histoplasma",
    "coccidioides",
    "pneumocystis",
    "dermatophyte",
    "yeast",
    "mold",
    "抗菌",
    "滅菌",
    "消毒",
    "培養",
    "染色",
    "毒素"
  ],
  immunity: [
    "免疫",
    "immun",
    "antibody",
    "antigen",
    "mhc",
    "hla",
    "t cell",
    "b cell",
    "t細胞",
    "b細胞",
    "抗體",
    "抗原",
    "補體",
    "complement",
    "cytokine",
    "介白素",
    "interleukin",
    "巨噬",
    "macrophage",
    "樹突",
    "dendritic",
    "nk cell",
    "ige",
    "igg",
    "iga",
    "igm",
    "igd",
    "hypersensitivity",
    "過敏",
    "疫苗",
    "vaccine",
    "先天免疫",
    "後天免疫",
    "adaptive",
    "innate",
    "發炎",
    "inflammation",
    "移植",
    "transplant",
    "autoimmune",
    "自體免疫"
  ]
};

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("en-US");
}

export function isTrackSubject(subject?: string | null): subject is TrackSubject {
  return subject === MICROBIOLOGY_SUBJECT;
}

export function getSubjectTracks(subject: TrackSubject) {
  return SUBJECT_TRACKS[subject];
}

export function getAllSubjectTrackKeys<T extends TrackSubject>(subject: T): SubjectTrackKey<T>[] {
  return SUBJECT_TRACKS[subject].map((track) => track.key) as SubjectTrackKey<T>[];
}

function getQuestionSearchText(question: Question) {
  return normalizeSearchText(
    [
      question.chapter,
      question.section,
      question.testedConcept,
      question.stem,
      question.options.A,
      question.options.B,
      question.options.C,
      question.options.D,
      question.options.E,
      question.explanation,
      question.memoryTip,
      question.clinicalLink
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function getQuestionTrackKeys(question: Question): SubjectTrackKey[] {
  if (question.subject === MICROBIOLOGY_SUBJECT) {
    const text = getQuestionSearchText(question);
    const exactMatches = SUBJECT_TRACKS[MICROBIOLOGY_SUBJECT]
      .filter((track) => {
        if (track.key === "virus") return question.section.includes("病毒");
        if (track.key === "bacteria") {
          return (
            question.section.includes("細菌") ||
            question.section.includes("真菌") ||
            question.section.includes("微生物")
          );
        }
        return question.section.includes("免疫");
      })
      .map((track) => track.key);

    if (exactMatches.length > 0) return exactMatches;

    return SUBJECT_TRACKS[MICROBIOLOGY_SUBJECT]
      .filter((track) =>
        MICROBIOLOGY_KEYWORDS[track.key as MicrobiologyTrackKey].some((keyword: string) =>
          text.includes(keyword.toLocaleLowerCase("en-US"))
        )
      )
      .map((track) => track.key);
  }

  return [];
}

export function questionMatchesSubjectTracks(
  question: Question,
  subject: TrackSubject,
  selectedTrackKeys: string[]
) {
  if (question.subject !== subject) return false;
  const tracks = getSubjectTracks(subject);
  if (selectedTrackKeys.length === 0) return true;
  if (selectedTrackKeys.length === tracks.length) return true;
  const questionTrackKeys = getQuestionTrackKeys(question);
  return selectedTrackKeys.some((trackKey) => questionTrackKeys.includes(trackKey as SubjectTrackKey));
}

export function getSubjectTrackLabels(subject: TrackSubject, selectedTrackKeys: string[]) {
  return getSubjectTracks(subject)
    .filter((track) => selectedTrackKeys.includes(track.key))
    .map((track) => track.label);
}
