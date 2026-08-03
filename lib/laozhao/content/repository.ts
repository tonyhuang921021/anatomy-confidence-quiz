import { laozhaoCourseManifest } from "../../../data/laozhao/courseManifest";
import type {
  ChapterRecord,
  CourseManifest,
  PublicCourseView,
  ReviewedChapter,
  Video,
  VideoSearchHit
} from "../types";
import { isPublicVideo, isReviewedPublicChapter } from "./rights";
import { assertValidCourseManifest } from "./validator";

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("zh-Hant");
}

function getValidatedManifest(manifest: CourseManifest = laozhaoCourseManifest): CourseManifest {
  return assertValidCourseManifest(manifest);
}

export function getCourseManifest(): CourseManifest {
  return getValidatedManifest();
}

export function getPublicVideos(manifest: CourseManifest = laozhaoCourseManifest): Video[] {
  const validated = getValidatedManifest(manifest);
  return validated.videos
    .filter(isPublicVideo)
    .sort((left, right) => left.position - right.position);
}

export function getPublicCourseView(
  manifest: CourseManifest = laozhaoCourseManifest
): PublicCourseView {
  const validated = getValidatedManifest(manifest);
  const videos = getPublicVideos(validated).map((video, index) => ({
    id: video.id,
    youtubeId: video.youtubeId,
    title: video.title,
    position: video.position,
    durationSec: video.durationSec,
    thumbnailUrl: video.thumbnailUrl,
    channelTitle: video.channelTitle,
    visibility: video.visibility,
    availability: video.availability,
    rightsStatus: video.rightsStatus,
    displayIndex: index + 1,
    chapters: getReviewedChapters(video.id, validated).map((chapter) => ({
      id: chapter.id,
      videoId: chapter.videoId,
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.endSec,
      reviewStatus: chapter.reviewStatus,
      rightsStatus: chapter.rightsStatus
    }))
  }));

  return {
    courseId: "laozhao-anatomy",
    title: validated.title,
    subtitle: "官方影片目錄",
    description: "依官方播放清單排序，觀看位置、書籤與筆記只保存在這台裝置。",
    generatedAt: validated.generatedAt,
    videos
  };
}

export function getVideoById(
  videoId: string,
  manifest: CourseManifest = laozhaoCourseManifest
): Video | undefined {
  return getPublicVideos(manifest).find((video) => video.id === videoId);
}

export function getReviewedChapters(
  videoId: string,
  manifest: CourseManifest = laozhaoCourseManifest
): ReviewedChapter[] {
  const validated = getValidatedManifest(manifest);
  const video = validated.videos.find((item) => item.id === videoId);
  return validated.chapters
    .filter((chapter) => isReviewedPublicChapter(chapter, video))
    .filter((chapter) => chapter.videoId === videoId)
    .sort((left, right) => left.startSec - right.startSec);
}

export function getVideoStaticParams(
  manifest: CourseManifest = laozhaoCourseManifest
): Array<{ videoId: string }> {
  return getPublicVideos(manifest).map((video) => ({ videoId: video.id }));
}

export function getAdjacentVideos(
  videoId: string,
  manifest: CourseManifest = laozhaoCourseManifest
): { previous: Video | null; next: Video | null } {
  const videos = getPublicVideos(manifest);
  const index = videos.findIndex((video) => video.id === videoId);
  if (index < 0) return { previous: null, next: null };
  return {
    previous: videos[index - 1] ?? null,
    next: videos[index + 1] ?? null
  };
}

export function searchPublicVideos(
  query: string,
  manifest: CourseManifest = laozhaoCourseManifest
): VideoSearchHit[] {
  const validated = getValidatedManifest(manifest);
  const videos = getPublicVideos(validated);
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return videos.map((video) => ({ video, matchedBy: ["title"], chapterIds: [] }));
  }

  const chaptersByVideoId = new Map<string, ChapterRecord[]>();
  for (const chapter of validated.chapters) {
    const video = validated.videos.find((item) => item.id === chapter.videoId);
    if (!isReviewedPublicChapter(chapter, video)) continue;
    const chapters = chaptersByVideoId.get(chapter.videoId) ?? [];
    chapters.push(chapter);
    chaptersByVideoId.set(chapter.videoId, chapters);
  }

  return videos.flatMap((video) => {
    const titleMatches = normalizeQuery(video.title).includes(normalized);
    const chapterMatches = (chaptersByVideoId.get(video.id) ?? []).filter((chapter) =>
      normalizeQuery(chapter.title).includes(normalized)
    );
    if (!titleMatches && chapterMatches.length === 0) return [];
    return [
      {
        video,
        matchedBy: [
          ...(titleMatches ? (["title"] as const) : []),
          ...(chapterMatches.length > 0 ? (["chapter"] as const) : [])
        ],
        chapterIds: chapterMatches.map((chapter) => chapter.id)
      }
    ];
  });
}
