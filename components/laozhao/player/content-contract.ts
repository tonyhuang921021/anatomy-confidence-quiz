import {
  getCourseManifest,
  getPublicVideos,
  getReviewedChapters
} from "@/lib/laozhao/content/repository";
import type { Video } from "@/lib/laozhao/types";

export type LaoZhaoChapterReviewStatus = "reviewed" | "draft";

export type LaoZhaoChapter = {
  stableId: string;
  title: string;
  startSec: number;
  endSec?: number;
  reviewStatus: LaoZhaoChapterReviewStatus;
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

export function getLaozhaoContentRepository(): LaoZhaoContentRepository {
  const manifest = getCourseManifest();
  const videos = getPublicVideos(manifest).map((video) => toPlayerVideo(video, manifest));
  const videosById = new Map(videos.map((video) => [video.id, video]));

  return {
    listVideos: () => videos,
    getVideo: (videoId) => videosById.get(videoId) ?? null
  };
}
