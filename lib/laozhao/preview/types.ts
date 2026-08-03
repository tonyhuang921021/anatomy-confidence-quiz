export type LaoZhaoPreviewBoardFrame = {
  id: string;
  src: string;
  timeSec: number;
  alt: string;
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
};

export type LaoZhaoPreviewManifest = {
  schemaVersion: "1.0.0";
  visibility: "preview";
  videos: readonly LaoZhaoPreviewVideoContent[];
};
