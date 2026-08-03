import {
  getCourseManifest,
  getPublicVideos,
  getReviewedChapters
} from "@/lib/laozhao/content/repository";
import type { Video } from "@/lib/laozhao/types";
import type { LaoZhaoPreviewVideoContent } from "@/lib/laozhao/preview/types";

export type LaoZhaoChapterReviewStatus = "reviewed" | "draft";

export type LaoZhaoChapter = {
  stableId: string;
  title: string;
  startSec: number;
  endSec?: number;
  reviewStatus: LaoZhaoChapterReviewStatus;
  summary?: string;
  tags?: readonly string[];
  boardFrames?: readonly LaoZhaoBoardFrame[];
};

export type LaoZhaoBoardFrame = {
  id: string;
  src: string;
  timeSec: number;
  alt: string;
};

export type LaoZhaoCaption = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type LaoZhaoVideoStatus = "available" | "unavailable";

export type LaoZhaoVideo = {
  id: string;
  title: string;
  description?: string;
  durationSec: number;
  order: number;
  status: LaoZhaoVideoStatus;
  thumbnailUrl?: string;
  chapters?: readonly LaoZhaoChapter[];
  captions?: readonly LaoZhaoCaption[];
  previewMode?: boolean;
};

export type LaoZhaoContentRepository = {
  listVideos: () => readonly LaoZhaoVideo[];
  getVideo: (videoId: string) => LaoZhaoVideo | null;
};

function toPlayerVideo(video: Video, manifest: ReturnType<typeof getCourseManifest>): LaoZhaoVideo {
  return {
    id: video.id,
    title: video.title,
    durationSec: video.durationSec ?? 0,
    order: video.position,
    status: video.availability,
    thumbnailUrl: video.thumbnailUrl ?? undefined,
    chapters: getReviewedChapters(video.id, manifest).map((chapter) => ({
      stableId: chapter.id,
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.endSec ?? undefined,
      reviewStatus: "reviewed"
    }))
  };
}

export function withLaozhaoPreviewContent(
  video: LaoZhaoVideo,
  preview: LaoZhaoPreviewVideoContent | null
): LaoZhaoVideo {
  if (!preview || preview.videoId !== video.id) return video;
  return {
    ...video,
    chapters: preview.chapters.map((chapter) => ({
      stableId: chapter.id,
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.endSec,
      reviewStatus: "draft",
      summary: chapter.summary,
      tags: chapter.tags,
      boardFrames: chapter.boardFrames
    })),
    captions: preview.captions.map((caption) => ({
      id: caption.id,
      startSec: caption.startSec,
      endSec: caption.endSec,
      text: caption.text
    })),
    previewMode: true
  };
}

export function getLaozhaoContentRepository(): LaoZhaoContentRepository {
  const manifest = getCourseManifest();
  const videos = getPublicVideos(manifest).map((video) => toPlayerVideo(video, manifest));
  const videosById = new Map(videos.map((video) => [video.id, video]));

  return {
    listVideos: () => videos,
    getVideo: (videoId) => videosById.get(videoId) ?? null
  };
}
