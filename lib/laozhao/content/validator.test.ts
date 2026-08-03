import assert from "node:assert/strict";
import test from "node:test";
import type { CourseManifest } from "../types";
import { assertValidCourseManifest, validateCourseManifest } from "./validator";

function makeManifest(overrides: Partial<CourseManifest> = {}): CourseManifest {
  return {
    schemaVersion: "1.0.0",
    courseId: "laozhao-anatomy",
    title: "老趙解剖學",
    playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
    generatedAt: "2026-08-01T00:00:00.000Z",
    contentRevision: "test-revision",
    videos: [
      {
        id: "ATFBb25QRNw",
        youtubeId: "ATFBb25QRNw",
        title: "測試影片",
        position: 0,
        durationSec: 600,
        thumbnailUrl: null,
        channelTitle: "測試頻道",
        visibility: "public",
        availability: "available",
        rightsStatus: "embed_only"
      }
    ],
    chapters: [],
    ...overrides
  };
}

test("manifest 會拒絕重複影片 ID", () => {
  const manifest = makeManifest({
    videos: [
      makeManifest().videos[0],
      { ...makeManifest().videos[0], title: "重複影片" }
    ]
  });
  const result = validateCourseManifest(manifest, { now: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "duplicate_video_id"));
});

test("合法 YouTube ID 可以底線或連字號開頭", () => {
  const manifest = makeManifest();
  manifest.videos[0].id = "_Tl81s-Inys";
  manifest.videos[0].youtubeId = "_Tl81s-Inys";
  manifest.videos[0].thumbnailUrl = "https://i.ytimg.com/vi/_Tl81s-Inys/hqdefault.jpg";

  assert.equal(validateCourseManifest(manifest).valid, true);
});

test("manifest 不接受空白播放清單", () => {
  const result = validateCourseManifest(makeManifest({ videos: [] }), {
    now: new Date("2026-08-03T00:00:00.000Z")
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "videos_empty"));
});

test("manifest 會拒絕重複影片順序", () => {
  const manifest = makeManifest({
    videos: [
      makeManifest().videos[0],
      {
        ...makeManifest().videos[0],
        id: "BBBBBBBBBBB",
        youtubeId: "BBBBBBBBBBB",
        position: 0
      }
    ]
  });
  const result = validateCourseManifest(manifest, { now: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "duplicate_video_position"));
});

test("manifest 會拒絕超出影片長度的章節時間", () => {
  const manifest = makeManifest({
    chapters: [
      {
        id: "chapter-1",
        videoId: "ATFBb25QRNw",
        title: "超出範圍",
        startSec: 590,
        endSec: 610,
        reviewStatus: "reviewed",
        rightsStatus: "embed_only"
      }
    ]
  });
  const result = validateCourseManifest(manifest, { now: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "chapter_end_after_video"));
});

test("manifest 會拒絕未排序或重疊的章節", () => {
  const manifest = makeManifest({
    chapters: [
      {
        id: "chapter-1",
        videoId: "ATFBb25QRNw",
        title: "第一節",
        startSec: 30,
        endSec: 90,
        reviewStatus: "reviewed",
        rightsStatus: "embed_only"
      },
      {
        id: "chapter-2",
        videoId: "ATFBb25QRNw",
        title: "第二節",
        startSec: 60,
        endSec: 120,
        reviewStatus: "reviewed",
        rightsStatus: "embed_only"
      }
    ]
  });
  const result = validateCourseManifest(manifest, { now: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "chapter_overlap"));

  const unsorted = validateCourseManifest(
    makeManifest({ chapters: [...manifest.chapters].reverse() }),
    { now: new Date("2026-08-03T00:00:00.000Z") }
  );
  assert.equal(unsorted.valid, false);
  assert.ok(unsorted.errors.some((issue) => issue.code === "chapters_not_sorted"));
});

test("metadata 超過 21 天警告，超過 30 天只在老趙發布檢查 fail closed", () => {
  const manifest = makeManifest({ generatedAt: "2026-07-01T00:00:00.000Z" });
  const warning = validateCourseManifest(manifest, { now: new Date("2026-07-23T00:00:00.000Z") });
  assert.equal(warning.valid, true);
  assert.ok(warning.warnings.some((issue) => issue.code === "metadata_refresh_due"));

  const stale = validateCourseManifest(manifest, { now: new Date("2026-08-02T00:00:00.000Z") });
  assert.equal(stale.valid, true);
  assert.ok(stale.warnings.some((issue) => issue.code === "stale_metadata"));

  const releaseCheck = validateCourseManifest(manifest, {
    now: new Date("2026-08-02T00:00:00.000Z"),
    enforceFreshness: true
  });
  assert.equal(releaseCheck.valid, false);
  assert.ok(releaseCheck.errors.some((issue) => issue.code === "stale_metadata"));
});

test("同一版 metadata 到期時只在建置流程警告一次", () => {
  const manifest = makeManifest({
    generatedAt: "2026-07-01T00:00:00.000Z",
    contentRevision: "warning-once-revision"
  });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...values: unknown[]) => warnings.push(values.join(" "));
  try {
    assertValidCourseManifest(manifest, { now: new Date("2026-07-23T00:00:00.000Z") });
    assertValidCourseManifest(manifest, { now: new Date("2026-07-23T00:00:00.000Z") });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /超過 21 天/);
});

test("unknown rights status 不能進入可驗證 manifest", () => {
  const manifest = makeManifest({
    videos: [{ ...makeManifest().videos[0], rightsStatus: "unknown" }]
  });
  const result = validateCourseManifest(manifest, { now: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "unresolved_video_rights"));
});

test("公開 manifest 拒絕未審章節與未允許欄位", () => {
  const draftManifest = makeManifest({
    chapters: [
      {
        id: "draft-chapter",
        videoId: "ATFBb25QRNw",
        title: "未審章節",
        startSec: 0,
        endSec: 30,
        reviewStatus: "draft",
        rightsStatus: "private_only"
      }
    ]
  });
  const draftResult = validateCourseManifest(draftManifest, {
    now: new Date("2026-08-03T00:00:00.000Z")
  });
  assert.equal(draftResult.valid, false);
  assert.ok(
    draftResult.errors.some((issue) => issue.code === "unreviewed_chapter_in_public_manifest")
  );

  const leakedField = {
    ...makeManifest(),
    videos: [{ ...makeManifest().videos[0], sourcePath: "/private/source.mp4" }]
  };
  const leakedResult = validateCourseManifest(leakedField, {
    now: new Date("2026-08-03T00:00:00.000Z")
  });
  assert.equal(leakedResult.valid, false);
  assert.ok(leakedResult.errors.some((issue) => issue.code === "unexpected_public_field"));
});

test("只接受指定播放清單與 YouTube 官方縮圖", () => {
  const wrongPlaylist = validateCourseManifest(
    makeManifest({ playlistId: "PL_OTHER_PLAYLIST_123" }),
    { now: new Date("2026-08-03T00:00:00.000Z") }
  );
  assert.equal(wrongPlaylist.valid, false);
  assert.ok(wrongPlaylist.errors.some((issue) => issue.code === "invalid_playlist_id"));

  const externalThumbnail = validateCourseManifest(
    makeManifest({
      videos: [{ ...makeManifest().videos[0], thumbnailUrl: "https://example.com/vi/ATFBb25QRNw/hq.jpg" }]
    }),
    { now: new Date("2026-08-03T00:00:00.000Z") }
  );
  assert.equal(externalThumbnail.valid, false);
  assert.ok(externalThumbnail.errors.some((issue) => issue.code === "invalid_thumbnail_url"));
});
