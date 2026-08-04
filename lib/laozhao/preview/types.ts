export type LaoZhaoPreviewBoardFrame = {
  id: string;
  src: string;
  timeSec: number;
  alt: string;
  referenceNoteIds: readonly string[];
};

export type LaoZhaoPreviewReferenceNote = {
  id: string;
  src: string;
  pdfPage: number;
  sourceTitle: string;
  pageRegions: readonly string[];
  matchedStructures: readonly string[];
  alt: string;
  visibility: "protected_preview";
};

export type LaoZhaoPreviewChapter = {
  id: string;
  title: string;
  startSec: number;
  endSec: number;
  summary: string;
  tags: readonly string[];
  representativeFrameTargetSec: number | null;
  boardFrames: readonly LaoZhaoPreviewBoardFrame[];
  referenceNotes: readonly LaoZhaoPreviewReferenceNote[];
  reviewStatus: "draft";
};

export type LaoZhaoPreviewCaption = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  sourceSegmentStart: number;
  sourceSegmentEnd: number;
  sourceSegmentCount: number;
};

export type LaoZhaoPreviewLecturePoint = {
  text: string;
  details: readonly string[];
};

type LaoZhaoPreviewLectureBlockBase = {
  id: string;
  chapterId: string;
  title: string;
  startSec: number;
  endSec: number;
};

type LaoZhaoPreviewLectureTeacherSource = {
  provenance: "teacher";
  sourceCaptionStart: string;
  sourceCaptionEnd: string;
  sourceCaptionCount: number;
};

type LaoZhaoPreviewLectureSupplementSource = {
  provenance: "supplement";
  afterBlockId: string;
};

type LaoZhaoPreviewLectureBulletContent = {
  type: "bullets";
  points: readonly LaoZhaoPreviewLecturePoint[];
};

type LaoZhaoPreviewLectureTableContent = {
  type: "table";
  columns: readonly string[];
  rows: readonly (readonly string[])[];
};

export type LaoZhaoPreviewLectureBlock = LaoZhaoPreviewLectureBlockBase &
  (LaoZhaoPreviewLectureTeacherSource | LaoZhaoPreviewLectureSupplementSource) &
  (LaoZhaoPreviewLectureBulletContent | LaoZhaoPreviewLectureTableContent);

export type LaoZhaoPreviewLectureNotes = {
  schemaVersion: "1.0.0";
  videoId: string;
  captionFingerprint: string;
  reviewStatus: "draft";
  blocks: readonly LaoZhaoPreviewLectureBlock[];
};

export type LaoZhaoPreviewVideoContent = {
  videoId: string;
  title: string;
  durationSec: number;
  sourceSegmentTotal: number;
  contentFingerprint: string;
  reviewStatus: "draft";
  rightsStatus: "authorized";
  chapters: readonly LaoZhaoPreviewChapter[];
  captions: readonly LaoZhaoPreviewCaption[];
  lectureNotes?: LaoZhaoPreviewLectureNotes;
};

export type LaoZhaoPreviewManifest = {
  schemaVersion: "1.0.0";
  visibility: "preview";
  videos: readonly LaoZhaoPreviewVideoContent[];
};
