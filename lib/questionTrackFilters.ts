import { getQuestionPrimaryTag } from "./analysisPrimaryTag";
import type { Question, SubjectName } from "../types/quiz";

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

const MICROBIOLOGY_PRIMARY_TAG_TRACKS: Record<MicrobiologyTrackKey, string[]> = {
  virus: ["病毒學－", "微生物免疫學－抗病毒藥物"],
  bacteria: [
    "細菌學－",
    "真菌學－",
    "微生物免疫學－抗菌藥物",
    "微生物免疫學－抗真菌藥物",
    "微生物免疫學－正常菌相與宿主互動"
  ],
  immunity: [
    "免疫學－",
    "微生物免疫學－免疫器官與造血分化",
    "微生物免疫學－免疫調節治療"
  ]
};

export function isTrackSubject(subject?: string | null): subject is TrackSubject {
  return subject === MICROBIOLOGY_SUBJECT;
}

export function getSubjectTracks(subject: TrackSubject) {
  return SUBJECT_TRACKS[subject];
}

export function getAllSubjectTrackKeys<T extends TrackSubject>(subject: T): SubjectTrackKey<T>[] {
  return SUBJECT_TRACKS[subject].map((track) => track.key) as SubjectTrackKey<T>[];
}

export function getQuestionTrackKeys(question: Question): SubjectTrackKey[] {
  if (question.subject === MICROBIOLOGY_SUBJECT) {
    const primaryTag = getQuestionPrimaryTag(question)?.replace(/\s+/g, "") ?? "";
    return SUBJECT_TRACKS[MICROBIOLOGY_SUBJECT]
      .filter((track) =>
        MICROBIOLOGY_PRIMARY_TAG_TRACKS[track.key as MicrobiologyTrackKey].some((prefix) =>
          primaryTag.startsWith(prefix.replace(/\s+/g, ""))
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
