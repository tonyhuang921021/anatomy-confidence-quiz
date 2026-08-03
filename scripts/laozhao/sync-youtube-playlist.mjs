import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_PLAYLIST_ID = "PL-PlecnICedO0RMacJnAnyYRIHlf0M01t";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_FETCH_ATTEMPTS = 4;
const YOUTUBE_FETCH_TIMEOUT_MS = 20_000;
const YOUTUBE_RETRY_BASE_MS = 500;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const VIDEO_VISIBILITIES = new Set(["public", "unlisted", "private", "unknown"]);
const VIDEO_AVAILABILITIES = new Set(["available", "unavailable"]);
const RIGHTS_STATUSES = new Set(["embed_only", "authorized", "private_only", "blocked", "unknown"]);
const CHAPTER_REVIEW_STATUSES = new Set(["reviewed", "draft", "rejected"]);
const PUBLIC_RIGHTS_STATUSES = new Set(["embed_only", "authorized"]);
const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "courseId",
  "title",
  "playlistId",
  "generatedAt",
  "contentRevision",
  "videos",
  "chapters"
]);
const VIDEO_KEYS = new Set([
  "id",
  "youtubeId",
  "title",
  "position",
  "durationSec",
  "thumbnailUrl",
  "channelTitle",
  "visibility",
  "availability",
  "rightsStatus"
]);
const CHAPTER_KEYS = new Set([
  "id",
  "videoId",
  "title",
  "startSec",
  "endSec",
  "reviewStatus",
  "rightsStatus"
]);
const OFFICIAL_THUMBNAIL_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "i1.ytimg.com",
  "i2.ytimg.com",
  "i3.ytimg.com",
  "i4.ytimg.com"
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    args[key] = argv[index + 1]?.startsWith("--") ? true : argv[++index];
  }
  return args;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少環境變數 ${name}。`);
  return value;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function retryDelayMs(response, attempt) {
  const retryAfterSeconds = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(10_000, retryAfterSeconds * 1_000);
  }
  return Math.min(4_000, YOUTUBE_RETRY_BASE_MS * 2 ** attempt);
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function fetchYouTubeJson(
  pathname,
  params,
  {
    fetchImpl = fetch,
    sleep = delay,
    maxAttempts = YOUTUBE_FETCH_ATTEMPTS,
    timeoutMs = YOUTUBE_FETCH_TIMEOUT_MS
  } = {}
) {
  const url = new URL(`${YOUTUBE_API_BASE}/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (response.ok && !payload.error) return payload;

      const message = payload?.error?.message ?? `YouTube API HTTP ${response.status}`;
      lastError = new Error(message);
      if (!isRetryableStatus(response.status)) {
        lastError.retryable = false;
        throw lastError;
      }
      if (attempt === maxAttempts - 1) throw lastError;
      await sleep(retryDelayMs(response, attempt));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.retryable === false) throw lastError;
      if (attempt === maxAttempts - 1) break;
      await sleep(YOUTUBE_RETRY_BASE_MS * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  const reason = lastError?.name === "AbortError" ? "請求逾時" : lastError?.message ?? "未知錯誤";
  throw new Error(`無法讀取 YouTube API：${reason}`);
}

async function fetchAllPlaylistItems(apiKey, playlistId) {
  const items = [];
  let pageToken;
  const seenPageTokens = new Set();
  do {
    if (pageToken && seenPageTokens.has(pageToken)) {
      throw new Error("YouTube playlist 分頁 token 重複，已停止同步以避免無限迴圈。");
    }
    if (pageToken) seenPageTokens.add(pageToken);
    const payload = await fetchYouTubeJson("playlistItems", {
      part: "snippet,contentDetails",
      maxResults: 50,
      playlistId,
      pageToken,
      key: apiKey
    });
    for (const item of payload.items ?? []) {
      const videoId = item?.contentDetails?.videoId ?? item?.snippet?.resourceId?.videoId;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
      items.push({
        videoId,
        position: Number.isInteger(item?.snippet?.position) ? item.snippet.position : items.length,
        title: typeof item?.snippet?.title === "string" ? item.snippet.title : videoId
      });
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return items.filter((item, index, all) => all.findIndex((candidate) => candidate.videoId === item.videoId) === index);
}

async function fetchVideoDetails(apiKey, videoIds) {
  const details = new Map();
  for (let index = 0; index < videoIds.length; index += 50) {
    const batch = videoIds.slice(index, index + 50);
    const payload = await fetchYouTubeJson("videos", {
      part: "snippet,contentDetails,status",
      id: batch.join(","),
      key: apiKey
    });
    for (const item of payload.items ?? []) {
      if (typeof item?.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(item.id)) details.set(item.id, item);
    }
  }
  return details;
}

export function parseYouTubeDuration(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : null;
}

function chooseThumbnail(thumbnails) {
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails?.[key]?.url;
    if (typeof url === "string" && url.startsWith("https://")) return url;
  }
  return null;
}

function isOfficialThumbnail(value, videoId) {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      OFFICIAL_THUMBNAIL_HOSTS.has(url.hostname) &&
      url.pathname.includes(`/vi/${videoId}/`)
    );
  } catch {
    return false;
  }
}

function visibilityFor(status) {
  if (status === "public" || status === "unlisted" || status === "private") return status;
  return "unknown";
}

function assertKnownKeys(value, allowedKeys, label) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new Error(`${label} 含有未允許的公開欄位：${key}`);
  }
}

function buildContentRevision(playlistId, videos, chapters = []) {
  const contentFingerprint = JSON.stringify({ playlistId, videos, chapters });
  return `youtube-${createHash("sha256").update(contentFingerprint).digest("hex").slice(0, 16)}`;
}

export function buildCourseManifest({ playlistId, playlistItems, videoDetails, generatedAt, rightsConfirmed = false }) {
  const videos = playlistItems.map((item, index) => {
    const detail = videoDetails.get(item.videoId);
    const status = detail?.status;
    const visibility = visibilityFor(status?.privacyStatus);
    const availability = detail && status?.embeddable !== false && visibility !== "private" ? "available" : "unavailable";
    return {
      id: item.videoId,
      youtubeId: item.videoId,
      title: typeof detail?.snippet?.title === "string" ? detail.snippet.title : item.title,
      position: Number.isInteger(item.position) ? item.position : index,
      durationSec: parseYouTubeDuration(detail?.contentDetails?.duration),
      thumbnailUrl: chooseThumbnail(detail?.snippet?.thumbnails),
      channelTitle: typeof detail?.snippet?.channelTitle === "string" ? detail.snippet.channelTitle : null,
      visibility,
      availability,
      rightsStatus: visibility === "private" ? "private_only" : rightsConfirmed ? "embed_only" : "unknown"
    };
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    courseId: "laozhao-anatomy",
    title: "老趙解剖學",
    playlistId,
    generatedAt,
    contentRevision: buildContentRevision(playlistId, videos),
    videos,
    chapters: []
  };
}

export function validateGeneratedManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("同步結果不是有效物件。");
  assertKnownKeys(manifest, MANIFEST_KEYS, "manifest");
  if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error("manifest schema version 無效。");
  if (manifest.courseId !== "laozhao-anatomy") throw new Error("courseId 無效。");
  if (typeof manifest.title !== "string" || !manifest.title.trim()) throw new Error("課程標題不可空白。");
  if (manifest.playlistId !== DEFAULT_PLAYLIST_ID) throw new Error("播放清單 ID 與指定官方清單不符。");
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) throw new Error("generatedAt 必須是有效日期。");
  if (typeof manifest.contentRevision !== "string" || !manifest.contentRevision.trim()) {
    throw new Error("contentRevision 不可空白。");
  }
  if (!Array.isArray(manifest.videos) || manifest.videos.length === 0) throw new Error("官方播放清單沒有可匯入影片。");
  if (!Array.isArray(manifest.chapters)) throw new Error("章節資料格式無效。");

  const ids = new Set();
  const positions = new Set();
  const videosById = new Map();
  for (const [index, video] of manifest.videos.entries()) {
    if (!video || typeof video !== "object") throw new Error(`第 ${index + 1} 筆影片資料無效。`);
    assertKnownKeys(video, VIDEO_KEYS, `影片 ${index + 1}`);
    if (!YOUTUBE_ID_PATTERN.test(video.id) || video.youtubeId !== video.id) {
      throw new Error(`第 ${index + 1} 筆影片 ID 無效。`);
    }
    if (ids.has(video.id)) throw new Error(`影片 ID 重複：${video.id}`);
    ids.add(video.id);
    if (typeof video.title !== "string" || !video.title.trim()) throw new Error(`影片 ${video.id} 缺少標題。`);
    if (!Number.isInteger(video.position) || video.position < 0) throw new Error(`影片 ${video.id} 的排序無效。`);
    if (positions.has(video.position)) throw new Error(`影片排序重複：${video.position}`);
    positions.add(video.position);
    if (video.durationSec !== null && (!Number.isInteger(video.durationSec) || video.durationSec < 0)) {
      throw new Error(`影片 ${video.id} 的長度無效。`);
    }
    if (!isOfficialThumbnail(video.thumbnailUrl, video.youtubeId)) throw new Error(`影片 ${video.id} 的縮圖不是官方 YouTube 網域。`);
    if (video.channelTitle !== null && (typeof video.channelTitle !== "string" || !video.channelTitle.trim())) {
      throw new Error(`影片 ${video.id} 的頻道名稱無效。`);
    }
    if (!VIDEO_VISIBILITIES.has(video.visibility)) throw new Error(`影片 ${video.id} 的公開狀態無效。`);
    if (!VIDEO_AVAILABILITIES.has(video.availability)) throw new Error(`影片 ${video.id} 的可用狀態無效。`);
    if (!RIGHTS_STATUSES.has(video.rightsStatus) || video.rightsStatus === "unknown") {
      throw new Error(`影片 ${video.id} 的權利狀態尚未確認。`);
    }
    videosById.set(video.id, video);
  }

  const chapterIds = new Set();
  const chaptersByVideoId = new Map();
  for (const [index, chapter] of manifest.chapters.entries()) {
    if (!chapter || typeof chapter !== "object" || !ids.has(chapter.videoId)) {
      throw new Error("章節指向不在播放清單中的影片。");
    }
    assertKnownKeys(chapter, CHAPTER_KEYS, `章節 ${index + 1}`);
    if (typeof chapter.id !== "string" || !STABLE_ID_PATTERN.test(chapter.id)) {
      throw new Error(`第 ${index + 1} 筆章節 ID 無效。`);
    }
    if (chapterIds.has(chapter.id)) throw new Error(`章節 ID 重複：${chapter.id}`);
    chapterIds.add(chapter.id);
    if (typeof chapter.title !== "string" || !chapter.title.trim()) throw new Error(`章節 ${chapter.id} 缺少標題。`);
    if (!Number.isInteger(chapter.startSec) || chapter.startSec < 0) throw new Error(`章節 ${chapter.id} 的起點無效。`);
    if (chapter.endSec !== null && (!Number.isInteger(chapter.endSec) || chapter.endSec <= chapter.startSec)) {
      throw new Error(`章節 ${chapter.id} 的終點無效。`);
    }
    if (!CHAPTER_REVIEW_STATUSES.has(chapter.reviewStatus)) throw new Error(`章節 ${chapter.id} 的審核狀態無效。`);
    if (chapter.reviewStatus !== "reviewed") throw new Error(`章節 ${chapter.id} 尚未審核，不可進公開 manifest。`);
    if (!RIGHTS_STATUSES.has(chapter.rightsStatus) || chapter.rightsStatus === "unknown") {
      throw new Error(`章節 ${chapter.id} 的權利狀態尚未確認。`);
    }
    if (!PUBLIC_RIGHTS_STATUSES.has(chapter.rightsStatus)) {
      throw new Error(`章節 ${chapter.id} 不具可公開權利狀態。`);
    }
    const video = videosById.get(chapter.videoId);
    if (video.durationSec !== null && chapter.startSec >= video.durationSec) {
      throw new Error(`章節 ${chapter.id} 的起點超過影片長度。`);
    }
    if (video.durationSec !== null && chapter.endSec !== null && chapter.endSec > video.durationSec) {
      throw new Error(`章節 ${chapter.id} 的終點超過影片長度。`);
    }
    const videoChapters = chaptersByVideoId.get(chapter.videoId) ?? [];
    const previous = videoChapters.at(-1);
    if (previous && chapter.startSec <= previous.startSec) {
      throw new Error(`影片 ${chapter.videoId} 的章節未依時間排序。`);
    }
    if (previous && previous.endSec !== null && chapter.startSec < previous.endSec) {
      throw new Error(`影片 ${chapter.videoId} 的章節時間重疊。`);
    }
    videoChapters.push(chapter);
    chaptersByVideoId.set(chapter.videoId, videoChapters);
  }
  return manifest;
}

async function loadExistingChapters(pathname, videoIds) {
  try {
    const parsed = JSON.parse(await readFile(pathname, "utf8"));
    if (!Array.isArray(parsed?.chapters)) return [];
    return parsed.chapters
      .filter(
        (chapter) =>
          chapter &&
          typeof chapter === "object" &&
          videoIds.has(chapter.videoId) &&
          chapter.reviewStatus === "reviewed" &&
          PUBLIC_RIGHTS_STATUSES.has(chapter.rightsStatus)
      )
      .map((chapter) => ({
        id: chapter.id,
        videoId: chapter.videoId,
        title: chapter.title,
        startSec: chapter.startSec,
        endSec: chapter.endSec,
        reviewStatus: "reviewed",
        rightsStatus: chapter.rightsStatus
      }));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function syncPlaylist({
  apiKey,
  playlistId,
  outputPath,
  existingManifestPath = outputPath,
  rightsConfirmed = false
}) {
  const playlistItems = await fetchAllPlaylistItems(apiKey, playlistId);
  const videoDetails = await fetchVideoDetails(apiKey, playlistItems.map((item) => item.videoId));
  const generatedAt = new Date().toISOString();
  const manifest = buildCourseManifest({
    playlistId,
    playlistItems,
    videoDetails,
    generatedAt,
    rightsConfirmed
  });
  const chapters = await loadExistingChapters(resolve(existingManifestPath), new Set(manifest.videos.map((video) => video.id)));
  const output = validateGeneratedManifest({
    ...manifest,
    chapters,
    contentRevision: buildContentRevision(playlistId, manifest.videos, chapters)
  });
  const resolvedOutput = resolve(outputPath);
  const temporaryOutput = `${resolvedOutput}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(resolvedOutput), { recursive: true });
  try {
    await writeFile(temporaryOutput, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await rename(temporaryOutput, resolvedOutput);
  } catch (error) {
    await rm(temporaryOutput, { force: true });
    throw error;
  }
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = requiredEnv("YOUTUBE_DATA_API_KEY");
  const rightsConfirmed = process.env.LAOZHAO_CONTENT_RIGHTS_CONFIRMED?.trim() === "true";
  if (!rightsConfirmed) {
    throw new Error("同步前必須確認內容授權，並設定 LAOZHAO_CONTENT_RIGHTS_CONFIRMED=true。");
  }
  const playlistId = process.env.LAOZHAO_PLAYLIST_ID?.trim() || DEFAULT_PLAYLIST_ID;
  if (playlistId !== DEFAULT_PLAYLIST_ID) throw new Error("LAOZHAO_PLAYLIST_ID 與指定官方播放清單不符。");
  const outputPath = args.output || process.env.LAOZHAO_MANIFEST_OUTPUT || "data/laozhao/courseManifest.generated.json";
  const existingManifestPath = args.existing || process.env.LAOZHAO_EXISTING_MANIFEST || outputPath;
  const manifest = await syncPlaylist({
    apiKey,
    playlistId,
    outputPath,
    existingManifestPath,
    rightsConfirmed
  });
  console.log(`已同步 ${manifest.videos.length} 部影片，contentRevision=${manifest.contentRevision}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
