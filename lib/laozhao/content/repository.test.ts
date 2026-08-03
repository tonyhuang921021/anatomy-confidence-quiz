import assert from "node:assert/strict";
import test from "node:test";
import type { CourseManifest } from "../types";
import {
  getAdjacentVideos,
  getPublicCourseView,
  getReviewedChapters,
  getVideoStaticParams,
  searchPublicVideos
} from "./repository";

const baseVideo = {
  id: "ATFBb25QRNw",
  youtubeId: "ATFBb25QRNw",
  title: "第一部影片",
  position: 0,
  durationSec: 600,
  thumbnailUrl: null,
  channelTitle: "測試頻道",
  visibility: "public" as const,
  availability: "available" as const,
  rightsStatus: "embed_only" as const
};

const manifest: CourseManifest = {
  schemaVersion: "1.0.0",
  courseId: "laozhao-anatomy",
  title: "老趙解剖學",
  playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
  generatedAt: "2026-08-03T00:00:00.000Z",
  contentRevision: "repository-test",
  videos: [
    baseVideo,
    {
      ...baseVideo,
      id: "BBBBBBBBBBB",
      youtubeId: "BBBBBBBBBBB",
      title: "第二部影片",
      position: 1
    },
    {
      ...baseVideo,
      id: "CCCCCCCCCCC",
      youtubeId: "CCCCCCCCCCC",
      title: "已下架但保留在官方清單的影片",
      position: 2,
      availability: "unavailable"
    },
    {
      ...baseVideo,
      id: "DDDDDDDDDDD",
      youtubeId: "DDDDDDDDDDD",
      title: "官方清單中的 unlisted 影片",
      position: 3,
      visibility: "unlisted"
    },
    {
      ...baseVideo,
      id: "EEEEEEEEEEE",
      youtubeId: "EEEEEEEEEEE",
      title: "無法取得 metadata 的舊影片",
      position: 4,
      visibility: "unknown",
      availability: "unavailable"
    },
    {
      ...baseVideo,
      id: "FFFFFFFFFFF",
      youtubeId: "FFFFFFFFFFF",
      title: "私人影片不公開",
      position: 5,
      visibility: "private",
      availability: "unavailable",
      rightsStatus: "private_only"
    }
  ],
  chapters: [
    {
      id: "reviewed-chapter",
      videoId: "ATFBb25QRNw",
      title: "已審核章節",
      startSec: 10,
      endSec: 30,
      reviewStatus: "reviewed",
      rightsStatus: "embed_only"
    }
  ]
};

test("搜尋只會命中影片標題與已審核章節", () => {
  assert.equal(searchPublicVideos("已審核章節", manifest).length, 1);
  assert.equal(searchPublicVideos("不存在的章節", manifest).length, 0);
  assert.equal(searchPublicVideos("第一部影片", manifest)[0]?.matchedBy.includes("title"), true);
});

test("章節與 generateStaticParams 只回傳公開資料", () => {
  assert.deepEqual(getReviewedChapters("ATFBb25QRNw", manifest).map((chapter) => chapter.id), ["reviewed-chapter"]);
  assert.deepEqual(getVideoStaticParams(manifest), [
    { videoId: "ATFBb25QRNw" },
    { videoId: "BBBBBBBBBBB" },
    { videoId: "CCCCCCCCCCC" },
    { videoId: "DDDDDDDDDDD" },
    { videoId: "EEEEEEEEEEE" }
  ]);
});

test("前後影片依官方 position 排序", () => {
  assert.deepEqual(getAdjacentVideos("ATFBb25QRNw", manifest), {
    previous: null,
    next: manifest.videos[1]
  });
  assert.deepEqual(getAdjacentVideos("BBBBBBBBBBB", manifest), {
    previous: manifest.videos[0],
    next: manifest.videos[2]
  });
});

test("公開課程 view 只含可公開影片與已審核章節", () => {
  const view = getPublicCourseView(manifest);
  assert.equal(view.videos.length, 5);
  assert.equal(view.videos[0]?.displayIndex, 1);
  assert.deepEqual(view.videos[0]?.chapters.map((chapter) => chapter.id), ["reviewed-chapter"]);
  assert.equal(view.videos[2]?.availability, "unavailable");
  assert.equal(view.videos.some((video) => video.id === "FFFFFFFFFFF"), false);
});
