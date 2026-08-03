import type {
  ChapterRecord,
  PublicRightsStatus,
  ReviewedChapter,
  Video
} from "../types";

const PUBLIC_RIGHTS: ReadonlySet<PublicRightsStatus> = new Set(["embed_only", "authorized"]);

export function hasPublicRights(rightsStatus: string): rightsStatus is PublicRightsStatus {
  return PUBLIC_RIGHTS.has(rightsStatus as PublicRightsStatus);
}

export function isPublicVideo(video: Video): boolean {
  const isListableVisibility =
    video.visibility === "public" ||
    video.visibility === "unlisted" ||
    (video.visibility === "unknown" && video.availability === "unavailable");
  return (
    isListableVisibility &&
    hasPublicRights(video.rightsStatus)
  );
}

export function isReviewedPublicChapter(
  chapter: ChapterRecord,
  video: Video | undefined
): chapter is ReviewedChapter {
  return (
    video !== undefined &&
    isPublicVideo(video) &&
    chapter.reviewStatus === "reviewed" &&
    hasPublicRights(chapter.rightsStatus)
  );
}
