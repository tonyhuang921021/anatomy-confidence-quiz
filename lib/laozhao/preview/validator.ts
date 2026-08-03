import type {
  LaoZhaoPreviewCaption,
  LaoZhaoPreviewChapter,
  LaoZhaoPreviewManifest,
  LaoZhaoPreviewVideoContent
} from "./types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`${label}格式不正確。`);
  }
}

function assertSeconds(value: unknown, label: string, durationSec: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > durationSec + 0.5) {
    throw new Error(`${label}不在影片範圍內。`);
  }
}

function validateCaption(
  raw: unknown,
  index: number,
  durationSec: number,
  previous: LaoZhaoPreviewCaption | null
): LaoZhaoPreviewCaption {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 段字幕不是物件。`);
  assertText(raw.id, `第 ${index + 1} 段字幕 id`, 80);
  assertText(raw.text, `第 ${index + 1} 段字幕文字`, 240);
  assertSeconds(raw.startSec, `第 ${index + 1} 段字幕起點`, durationSec);
  assertSeconds(raw.endSec, `第 ${index + 1} 段字幕終點`, durationSec);
  if ((raw.endSec as number) <= (raw.startSec as number)) {
    throw new Error(`第 ${index + 1} 段字幕終點必須晚於起點。`);
  }
  if (previous && (raw.startSec as number) < previous.startSec) {
    throw new Error(`第 ${index + 1} 段字幕未依時間排序。`);
  }
  for (const key of ["sourceSegmentStart", "sourceSegmentEnd", "sourceSegmentCount"] as const) {
    if (!Number.isInteger(raw[key]) || (raw[key] as number) < 1) {
      throw new Error(`第 ${index + 1} 段字幕的 ${key} 無效。`);
    }
  }
  if ((raw.sourceSegmentEnd as number) < (raw.sourceSegmentStart as number)) {
    throw new Error(`第 ${index + 1} 段字幕的來源範圍無效。`);
  }
  if ((raw.sourceSegmentCount as number) !== (raw.sourceSegmentEnd as number) - (raw.sourceSegmentStart as number) + 1) {
    throw new Error(`第 ${index + 1} 段字幕的來源數量不一致。`);
  }
  if (previous && (raw.sourceSegmentStart as number) !== previous.sourceSegmentEnd + 1) {
    throw new Error(`第 ${index + 1} 段字幕的來源範圍不連續。`);
  }
  return raw as unknown as LaoZhaoPreviewCaption;
}

function validateChapter(
  raw: unknown,
  index: number,
  durationSec: number,
  previous: LaoZhaoPreviewChapter | null
): LaoZhaoPreviewChapter {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 章不是物件。`);
  assertText(raw.id, `第 ${index + 1} 章 id`, 80);
  assertText(raw.title, `第 ${index + 1} 章標題`, 100);
  assertText(raw.summary, `第 ${index + 1} 章摘要`, 600);
  assertSeconds(raw.startSec, `第 ${index + 1} 章起點`, durationSec);
  assertSeconds(raw.endSec, `第 ${index + 1} 章終點`, durationSec);
  if ((raw.endSec as number) <= (raw.startSec as number)) {
    throw new Error(`第 ${index + 1} 章終點必須晚於起點。`);
  }
  if (previous && (raw.startSec as number) < previous.endSec) {
    throw new Error(`第 ${index} 章與第 ${index + 1} 章重疊或倒序。`);
  }
  if (raw.reviewStatus !== "draft") throw new Error(`第 ${index + 1} 章必須維持 draft。`);
  if (!Array.isArray(raw.tags) || raw.tags.some((tag) => typeof tag !== "string" || tag.length > 40)) {
    throw new Error(`第 ${index + 1} 章標籤格式不正確。`);
  }
  if (
    raw.representativeFrameTargetSec !== null &&
    (typeof raw.representativeFrameTargetSec !== "number" ||
      raw.representativeFrameTargetSec < (raw.startSec as number) ||
      raw.representativeFrameTargetSec >= (raw.endSec as number))
  ) {
    throw new Error(`第 ${index + 1} 章代表畫面時間不在章節內。`);
  }
  if (!Array.isArray(raw.boardFrames)) throw new Error(`第 ${index + 1} 章板書圖片格式不正確。`);
  for (const [frameIndex, frame] of raw.boardFrames.entries()) {
    if (!isRecord(frame)) throw new Error(`第 ${index + 1} 章第 ${frameIndex + 1} 張板書不是物件。`);
    assertText(frame.id, `第 ${index + 1} 章板書 id`, 100);
    assertText(frame.src, `第 ${index + 1} 章板書路徑`, 300);
    assertText(frame.alt, `第 ${index + 1} 章板書替代文字`, 180);
    assertSeconds(frame.timeSec, `第 ${index + 1} 章板書時間`, durationSec);
    if (!(frame.src as string).startsWith("/laozhao-preview/")) {
      throw new Error(`第 ${index + 1} 章板書必須位於專用 Preview 路徑。`);
    }
  }
  return raw as unknown as LaoZhaoPreviewChapter;
}

function validateVideo(raw: unknown): LaoZhaoPreviewVideoContent {
  if (!isRecord(raw)) throw new Error("Preview 影片資料不是物件。");
  if (!VIDEO_ID_PATTERN.test(String(raw.videoId ?? ""))) throw new Error("Preview videoId 格式無效。");
  assertText(raw.title, "Preview 影片標題", 160);
  if (typeof raw.durationSec !== "number" || !Number.isFinite(raw.durationSec) || raw.durationSec <= 0) {
    throw new Error("Preview 影片長度無效。");
  }
  if (!Number.isInteger(raw.sourceSegmentTotal) || (raw.sourceSegmentTotal as number) < 1) {
    throw new Error("Preview 原始字幕段數無效。");
  }
  if (!SHA256_PATTERN.test(String(raw.contentFingerprint ?? ""))) throw new Error("Preview 內容指紋無效。");
  if (raw.reviewStatus !== "draft") throw new Error("Preview 內容必須維持 draft。");
  if (raw.rightsStatus !== "authorized") throw new Error("Preview 內容缺少授權標記。");
  if (!Array.isArray(raw.chapters) || raw.chapters.length === 0) throw new Error("Preview 章節不可為空。");
  if (!Array.isArray(raw.captions) || raw.captions.length === 0) throw new Error("Preview 字幕不可為空。");

  const chapterIds = new Set<string>();
  const boardIds = new Set<string>();
  const boardPaths = new Set<string>();
  let previousChapter: LaoZhaoPreviewChapter | null = null;
  for (const [index, chapter] of raw.chapters.entries()) {
    previousChapter = validateChapter(chapter, index, raw.durationSec, previousChapter);
    if (chapterIds.has(previousChapter.id)) throw new Error(`Preview 章節 id 重複：${previousChapter.id}`);
    chapterIds.add(previousChapter.id);
    for (const frame of previousChapter.boardFrames) {
      if (frame.timeSec < previousChapter.startSec || frame.timeSec >= previousChapter.endSec) {
        throw new Error(`${previousChapter.id} 的板書時間不在章節內。`);
      }
      if (boardIds.has(frame.id)) throw new Error(`Preview 板書 id 重複：${frame.id}`);
      if (boardPaths.has(frame.src)) throw new Error(`Preview 板書路徑重複：${frame.src}`);
      boardIds.add(frame.id);
      boardPaths.add(frame.src);
    }
  }
  const captionIds = new Set<string>();
  let previousCaption: LaoZhaoPreviewCaption | null = null;
  for (const [index, caption] of raw.captions.entries()) {
    previousCaption = validateCaption(caption, index, raw.durationSec, previousCaption);
    if (captionIds.has(previousCaption.id)) throw new Error(`Preview 字幕 id 重複：${previousCaption.id}`);
    captionIds.add(previousCaption.id);
  }
  const firstCaption = raw.captions[0] as LaoZhaoPreviewCaption;
  if (firstCaption.sourceSegmentStart !== 1) {
    throw new Error("Preview 字幕來源必須從第 1 段開始。");
  }
  if (previousCaption?.sourceSegmentEnd !== raw.sourceSegmentTotal) {
    throw new Error("Preview 字幕未完整涵蓋原始逐字稿。");
  }
  return raw as unknown as LaoZhaoPreviewVideoContent;
}

export function parseLaoZhaoPreviewManifest(raw: unknown): LaoZhaoPreviewManifest {
  if (!isRecord(raw) || raw.schemaVersion !== "1.0.0" || raw.visibility !== "preview") {
    throw new Error("老趙 Preview manifest 格式無效。");
  }
  if (!Array.isArray(raw.videos)) throw new Error("老趙 Preview videos 格式無效。");
  const videos = raw.videos.map(validateVideo);
  const ids = new Set<string>();
  for (const video of videos) {
    if (ids.has(video.videoId)) throw new Error(`老趙 Preview 重複影片：${video.videoId}`);
    ids.add(video.videoId);
  }
  return { schemaVersion: "1.0.0", visibility: "preview", videos };
}

export function isLaoZhaoPreviewEnabled(env: Record<string, string | undefined> = process.env) {
  return env.LAOZHAO_PREVIEW_CONTENT === "1" && env.VERCEL_ENV !== "production";
}
