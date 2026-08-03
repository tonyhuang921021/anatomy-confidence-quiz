import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCourseManifest,
  fetchYouTubeJson,
  parseYouTubeDuration,
  validateGeneratedManifest
} from "./sync-youtube-playlist.mjs";

function mockResponse(status, payload, retryAfter = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "retry-after" ? retryAfter : null) },
    json: async () => payload
  };
}

test("YouTube duration 轉換為秒數", () => {
  assert.equal(parseYouTubeDuration("PT1H2M3S"), 3723);
  assert.equal(parseYouTubeDuration("bad"), null);
});

test("YouTube API 短暫限流會有限次重試", async () => {
  let calls = 0;
  const waits = [];
  const payload = await fetchYouTubeJson(
    "playlistItems",
    { key: "test-only", playlistId: "playlist" },
    {
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? mockResponse(429, { error: { message: "rate limited" } }, "0")
          : mockResponse(200, { items: [] });
      },
      sleep: async (ms) => waits.push(ms),
      maxAttempts: 3,
      timeoutMs: 100
    }
  );

  assert.deepEqual(payload, { items: [] });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [0]);
});

test("YouTube API 權限錯誤不會浪費配額重試", async () => {
  let calls = 0;
  const waits = [];

  await assert.rejects(
    () =>
      fetchYouTubeJson(
        "playlistItems",
        { key: "test-only", playlistId: "playlist" },
        {
          fetchImpl: async () => {
            calls += 1;
            return mockResponse(403, { error: { message: "forbidden" } });
          },
          sleep: async (ms) => waits.push(ms),
          maxAttempts: 3,
          timeoutMs: 100
        }
      ),
    /forbidden/
  );

  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
});

test("同步結果只接受指定播放清單與官方縮圖", () => {
  const detail = {
    id: "ATFBb25QRNw",
    snippet: {
      title: "2016DF01-01",
      channelTitle: "Allen Liu",
      thumbnails: { high: { url: "https://i.ytimg.com/vi/ATFBb25QRNw/hqdefault.jpg" } }
    },
    contentDetails: { duration: "PT10M" },
    status: { privacyStatus: "public", embeddable: true }
  };
  const manifest = buildCourseManifest({
    playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
    playlistItems: [{ videoId: "ATFBb25QRNw", position: 0, title: "fallback" }],
    videoDetails: new Map([[detail.id, detail]]),
    generatedAt: "2026-08-03T00:00:00.000Z",
    rightsConfirmed: true
  });

  assert.equal(validateGeneratedManifest(manifest).videos.length, 1);
  assert.throws(
    () => validateGeneratedManifest({ ...manifest, playlistId: "PL_WRONG" }),
    /播放清單 ID/
  );
  assert.throws(
    () =>
      validateGeneratedManifest({
        ...manifest,
        videos: [manifest.videos[0], { ...manifest.videos[0], id: "BBBBBBBBBBB", youtubeId: "BBBBBBBBBBB" }]
      }),
    /影片排序重複/
  );
});

test("同步保留下架影片，並拒絕未審核權利或超出長度的章節", () => {
  const manifest = buildCourseManifest({
    playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
    playlistItems: [{ videoId: "ATFBb25QRNw", position: 0, title: "已下架影片" }],
    videoDetails: new Map(),
    generatedAt: "2026-08-03T00:00:00.000Z",
    rightsConfirmed: true
  });

  assert.equal(validateGeneratedManifest(manifest).videos[0].availability, "unavailable");
  assert.throws(
    () =>
      validateGeneratedManifest({
        ...manifest,
        videos: [{ ...manifest.videos[0], durationSec: 60 }],
        chapters: [
          {
            id: "unsafe-chapter",
            videoId: "ATFBb25QRNw",
            title: "未確認章節",
            startSec: 60,
            endSec: null,
            reviewStatus: "reviewed",
            rightsStatus: "unknown"
          }
        ]
      }),
    /權利狀態尚未確認|起點超過影片長度/
  );
});

test("未明確確認授權時，同步結果會 fail closed", () => {
  const manifest = buildCourseManifest({
    playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
    playlistItems: [{ videoId: "ATFBb25QRNw", position: 0, title: "測試影片" }],
    videoDetails: new Map(),
    generatedAt: "2026-08-03T00:00:00.000Z"
  });

  assert.throws(() => validateGeneratedManifest(manifest), /權利狀態尚未確認/);
});

test("公開同步結果拒絕私人欄位與未審章節", () => {
  const manifest = buildCourseManifest({
    playlistId: "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t",
    playlistItems: [{ videoId: "ATFBb25QRNw", position: 0, title: "測試影片" }],
    videoDetails: new Map(),
    generatedAt: "2026-08-03T00:00:00.000Z",
    rightsConfirmed: true
  });

  assert.throws(
    () => validateGeneratedManifest({ ...manifest, transcript: "不可公開" }),
    /未允許的公開欄位/
  );
  assert.throws(
    () =>
      validateGeneratedManifest({
        ...manifest,
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
      }),
    /尚未審核/
  );
});
