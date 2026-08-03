export const LAOZHAO_SCHEMA_VERSION = "1.0.0" as const;
export const LAOZHAO_PLAYLIST_ID = "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t" as const;

export type RightsStatus =
  | "embed_only"
  | "authorized"
  | "private_only"
  | "blocked"
  | "unknown";

export type PublicRightsStatus = Extract<RightsStatus, "embed_only" | "authorized">;
export type VideoVisibility = "public" | "unlisted" | "private" | "unknown";
export type VideoAvailability = "available" | "unavailable";
export type ChapterReviewStatus = "reviewed" | "draft" | "rejected";

export interface Video {
  /** Stable public identifier. The first version intentionally equals youtubeId. */
  id: string;
  youtubeId: string;
  title: string;
  position: number;
  durationSec: number | null;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  visibility: VideoVisibility;
  availability: VideoAvailability;
  rightsStatus: RightsStatus;
}

export interface ChapterRecord {
  id: string;
  videoId: string;
  title: string;
  startSec: number;
  endSec: number | null;
  reviewStatus: ChapterReviewStatus;
  rightsStatus: RightsStatus;
}

export type ReviewedChapter = ChapterRecord & {
  reviewStatus: "reviewed";
  rightsStatus: PublicRightsStatus;
};

export interface CourseManifest {
  schemaVersion: typeof LAOZHAO_SCHEMA_VERSION;
  courseId: "laozhao-anatomy";
  title: string;
  playlistId: string;
  generatedAt: string;
  contentRevision: string;
  videos: Video[];
  chapters: ChapterRecord[];
}

export type ManifestIssueSeverity = "error" | "warning";

export interface ManifestValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: ManifestIssueSeverity;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationIssue[];
  warnings: ManifestValidationIssue[];
}

export interface VideoSearchHit {
  video: Video;
  matchedBy: Array<"title" | "chapter">;
  chapterIds: string[];
}

export interface PublicCourseVideo extends Video {
  displayIndex: number;
  chapters: ReviewedChapter[];
}

export interface PublicCourseView {
  courseId: "laozhao-anatomy";
  title: string;
  subtitle: string;
  description: string;
  generatedAt: string;
  videos: PublicCourseVideo[];
}

export interface ExternalSlideCue {
  videoId: string;
  startSec: number;
  sourcePath: string | null;
}

export interface ExternalTranscriptCue {
  videoId: string;
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Import output is deliberately private-only. It cannot be passed to the public
 * manifest without an explicit rights review and a separate publishing step.
 */
export interface PrivateImportedContent {
  videoId: string;
  source: "lecture_slides";
  publishable: false;
  rightsStatus: "private_only";
  slides: ExternalSlideCue[];
  transcript: Array<ExternalTranscriptCue & { rightsStatus: "private_only" }>;
}
