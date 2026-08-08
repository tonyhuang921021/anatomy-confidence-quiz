import { createHash } from "node:crypto";
import type {
  LaoZhaoPreviewCaption,
  LaoZhaoPreviewChapter,
  LaoZhaoPreviewLectureBlock,
  LaoZhaoPreviewLectureNotes,
  LaoZhaoPreviewManifest,
  LaoZhaoPreviewReferenceNote,
  LaoZhaoPreviewVideoContent
} from "./types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_TEACHER_CAPTION_SPAN = 14;
const MAX_OUTLINE_CAPTION_SPAN = 32;
const LECTURE_POINT_KINDS = new Set(["standard", "teacher_note", "exam_focus", "mnemonic", "warning"]);
const MAX_LECTURE_POINT_DEPTH = 3;
const MAX_LECTURE_POINT_CHILDREN = 10;
const MAX_LECTURE_POINT_NODES = 80;

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

function captionFingerprint(captions: readonly LaoZhaoPreviewCaption[]) {
  return createHash("sha256").update(JSON.stringify(captions.map((caption) => ({
    id: caption.id,
    startSec: caption.startSec,
    endSec: caption.endSec,
    text: caption.text
  })))).digest("hex");
}

function assertSameSecond(value: unknown, expected: number, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value - expected) > 0.001) {
    throw new Error(`${label}與來源字幕不一致。`);
  }
}

function chapterForCaption(
  chapters: readonly LaoZhaoPreviewChapter[],
  caption: LaoZhaoPreviewCaption
) {
  const midpoint = (caption.startSec + caption.endSec) / 2;
  const directMatch = chapters.find((chapter, index) => (
    midpoint >= chapter.startSec
      && (midpoint < chapter.endSec || (index === chapters.length - 1 && midpoint <= chapter.endSec))
  ));
  if (directMatch) return directMatch;

  let bestMatch: LaoZhaoPreviewChapter | null = null;
  let bestOverlap = 0;
  for (const chapter of chapters) {
    const overlap = Math.max(
      0,
      Math.min(caption.endSec, chapter.endSec) - Math.max(caption.startSec, chapter.startSec)
    );
    if (overlap > bestOverlap) {
      bestMatch = chapter;
      bestOverlap = overlap;
    }
  }
  return bestMatch;
}

function captionsBelongToChapter(
  chapters: readonly LaoZhaoPreviewChapter[],
  captions: readonly LaoZhaoPreviewCaption[],
  startIndex: number,
  endIndex: number,
  chapterId: string
) {
  for (let index = startIndex; index <= endIndex; index += 1) {
    if (chapterForCaption(chapters, captions[index])?.id !== chapterId) return false;
  }
  return true;
}

function validateLecturePoint(
  raw: unknown,
  label: string,
  depth: number,
  state: { count: number }
) {
  if (!isRecord(raw)) throw new Error(`${label}格式無效。`);
  state.count += 1;
  if (state.count > MAX_LECTURE_POINT_NODES) {
    throw new Error(`${label}所屬區塊的條列節點過多。`);
  }
  assertText(raw.text, label, depth === 0 ? 320 : 260);
  const kind = raw.kind ?? "standard";
  if (typeof kind !== "string" || !LECTURE_POINT_KINDS.has(kind)) {
    throw new Error(`${label}標記類型無效。`);
  }
  const details = raw.details ?? [];
  if (!Array.isArray(details) || details.length > 8) {
    throw new Error(`${label}舊式子項目格式無效。`);
  }
  details.forEach((detail, detailIndex) => (
    assertText(detail, `${label}舊式子項目 ${detailIndex + 1}`, 260)
  ));
  const children = raw.children ?? [];
  if (!Array.isArray(children) || children.length > MAX_LECTURE_POINT_CHILDREN) {
    throw new Error(`${label}下層項目格式無效。`);
  }
  if (depth >= MAX_LECTURE_POINT_DEPTH && children.length > 0) {
    throw new Error(`${label}超過四層共筆結構。`);
  }
  children.forEach((child, childIndex) => (
    validateLecturePoint(child, `${label}下層項目 ${childIndex + 1}`, depth + 1, state)
  ));
}

function validateLectureBlockContent(raw: Record<string, unknown>, label: string) {
  if (raw.type === "bullets") {
    if (!Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > 12) {
      throw new Error(`${label}列點數量無效。`);
    }
    const state = { count: 0 };
    for (const [pointIndex, point] of raw.points.entries()) {
      validateLecturePoint(point, `${label}第 ${pointIndex + 1} 點`, 0, state);
    }
    const tables = raw.tables ?? [];
    if (!Array.isArray(tables) || tables.length > 4) {
      throw new Error(`${label}內嵌表格數量無效。`);
    }
    for (const [tableIndex, table] of tables.entries()) {
      if (!isRecord(table)) throw new Error(`${label}第 ${tableIndex + 1} 張表格格式無效。`);
      assertText(table.title, `${label}第 ${tableIndex + 1} 張表格標題`, 120);
      validateLectureBlockContent({
        type: "table",
        columns: table.columns,
        rows: table.rows
      }, `${label}第 ${tableIndex + 1} 張表格`);
    }
    return;
  }
  if (raw.type !== "table") throw new Error(`${label}類型無效。`);
  if (!Array.isArray(raw.columns) || raw.columns.length < 2 || raw.columns.length > 6) {
    throw new Error(`${label}表格欄數無效。`);
  }
  raw.columns.forEach((column, index) => assertText(column, `${label}第 ${index + 1} 欄`, 80));
  if (!Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > 24) {
    throw new Error(`${label}表格列數無效。`);
  }
  for (const [rowIndex, row] of raw.rows.entries()) {
    if (!Array.isArray(row) || row.length !== raw.columns.length) {
      throw new Error(`${label}第 ${rowIndex + 1} 列欄數不一致。`);
    }
    row.forEach((cell, columnIndex) => (
      assertText(cell, `${label}第 ${rowIndex + 1} 列第 ${columnIndex + 1} 欄`, 220)
    ));
  }
}

function validateLectureNotes(
  raw: unknown,
  videoId: string,
  chapters: readonly LaoZhaoPreviewChapter[],
  captions: readonly LaoZhaoPreviewCaption[]
): LaoZhaoPreviewLectureNotes {
  if (!isRecord(raw)) throw new Error("Preview 列點講義不是物件。");
  if (raw.schemaVersion !== "1.0.0") throw new Error("Preview 列點講義 schemaVersion 無效。");
  if (raw.videoId !== videoId) throw new Error("Preview 列點講義 videoId 不一致。");
  if (raw.reviewStatus !== "draft") throw new Error("Preview 列點講義必須維持 draft。");
  if (raw.captionFingerprint !== captionFingerprint(captions)) {
    throw new Error("Preview 列點講義不是針對目前字幕版本。");
  }
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
    throw new Error("Preview 列點講義區塊不可為空。");
  }

  const captionIndex = new Map(captions.map((caption, index) => [caption.id, index]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const blockIds = new Set<string>();
  const teacherBlocks = new Map<string, LaoZhaoPreviewLectureBlock>();
  let expectedTeacherStart = 0;

  for (const [index, block] of raw.blocks.entries()) {
    const label = `Preview 第 ${index + 1} 個講義區塊`;
    if (!isRecord(block)) throw new Error(`${label}格式無效。`);
    assertText(block.id, `${label} id`, 100);
    if (blockIds.has(block.id as string)) throw new Error(`${label} id 重複。`);
    blockIds.add(block.id as string);
    assertText(block.chapterId, `${label} chapterId`, 100);
    assertText(block.title, `${label}標題`, 120);
    validateLectureBlockContent(block, label);
    const chapter = chapterById.get(block.chapterId as string);
    if (!chapter) throw new Error(`${label}找不到對應章節。`);

    if (block.provenance === "teacher") {
      assertText(block.sourceCaptionStart, `${label}來源起點`, 80);
      assertText(block.sourceCaptionEnd, `${label}來源終點`, 80);
      const startIndex = captionIndex.get(block.sourceCaptionStart as string);
      const endIndex = captionIndex.get(block.sourceCaptionEnd as string);
      if (startIndex === undefined || endIndex === undefined || endIndex < startIndex) {
        throw new Error(`${label}字幕範圍無效。`);
      }
      if (startIndex !== expectedTeacherStart) {
        throw new Error(`${label}前有字幕缺口、重疊或倒序。`);
      }
      const sourceCaptionCount = endIndex - startIndex + 1;
      if (block.sourceFormat !== undefined && block.sourceFormat !== "timecoded_outline") {
        throw new Error(`${label}來源格式無效。`);
      }
      const captionSpanLimit = block.sourceFormat === "timecoded_outline"
        ? MAX_OUTLINE_CAPTION_SPAN
        : MAX_TEACHER_CAPTION_SPAN;
      if (sourceCaptionCount > captionSpanLimit) {
        throw new Error(`${label}超過 ${captionSpanLimit} 段字幕。`);
      }
      if (block.sourceCaptionCount !== sourceCaptionCount) {
        throw new Error(`${label}來源字幕數量不一致。`);
      }
      const firstCaption = captions[startIndex];
      const lastCaption = captions[endIndex];
      assertSameSecond(block.startSec, firstCaption.startSec, `${label}起點`);
      assertSameSecond(block.endSec, lastCaption.endSec, `${label}終點`);
      if (!captionsBelongToChapter(chapters, captions, startIndex, endIndex, chapter.id)) {
        throw new Error(`${label}跨越章節。`);
      }
      teacherBlocks.set(block.id as string, block as unknown as LaoZhaoPreviewLectureBlock);
      expectedTeacherStart = endIndex + 1;
      continue;
    }

    if (block.provenance !== "supplement") throw new Error(`${label}來源標示無效。`);
    assertText(block.afterBlockId, `${label}對應講授區塊`, 100);
    const parent = teacherBlocks.get(block.afterBlockId as string);
    if (!parent) throw new Error(`${label}沒有對應的前置老師講授區塊。`);
    if (block.chapterId !== parent.chapterId) throw new Error(`${label}與對應講授區塊不在同章。`);
    assertSameSecond(block.startSec, parent.startSec, `${label}起點`);
    assertSameSecond(block.endSec, parent.endSec, `${label}終點`);
  }

  if (expectedTeacherStart !== captions.length) {
    throw new Error(`Preview 列點講義未完整涵蓋 ${captions[expectedTeacherStart]?.id ?? "最後一段"} 之後的字幕。`);
  }
  return raw as unknown as LaoZhaoPreviewLectureNotes;
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
  if (!Array.isArray(raw.referenceNotes)) throw new Error(`第 ${index + 1} 章筆記圖片格式不正確。`);
  const referenceNoteIds = new Set<string>();
  const referenceNotes = raw.referenceNotes.map((note, noteIndex) => {
    if (!isRecord(note)) throw new Error(`第 ${index + 1} 章第 ${noteIndex + 1} 頁筆記不是物件。`);
    assertText(note.id, `第 ${index + 1} 章筆記 id`, 100);
    assertText(note.src, `第 ${index + 1} 章筆記路徑`, 300);
    assertText(note.sourceTitle, `第 ${index + 1} 章筆記來源`, 160);
    assertText(note.alt, `第 ${index + 1} 章筆記替代文字`, 180);
    if (!Number.isInteger(note.pdfPage) || (note.pdfPage as number) < 1) {
      throw new Error(`第 ${index + 1} 章筆記頁碼無效。`);
    }
    if (!(note.src as string).startsWith("/laozhao-preview/") || !(note.src as string).endsWith(".jpg")) {
      throw new Error(`第 ${index + 1} 章筆記必須位於專用 Preview JPG 路徑。`);
    }
    if (note.visibility !== "protected_preview") {
      throw new Error(`第 ${index + 1} 章筆記必須維持 protected_preview。`);
    }
    for (const [key, label] of [
      ["pageRegions", "頁內位置"],
      ["matchedStructures", "吻合構造"]
    ] as const) {
      if (!Array.isArray(note[key]) || note[key].length === 0 || note[key].some((item) => (
        typeof item !== "string" || !item.trim() || item.length > 80
      ))) {
        throw new Error(`第 ${index + 1} 章筆記${label}格式不正確。`);
      }
    }
    if (referenceNoteIds.has(note.id as string)) {
      throw new Error(`第 ${index + 1} 章筆記 id 重複：${note.id}`);
    }
    referenceNoteIds.add(note.id as string);
    return note as unknown as LaoZhaoPreviewReferenceNote;
  });
  const referencedNoteIds = new Set<string>();
  for (const [frameIndex, frame] of raw.boardFrames.entries()) {
    if (!isRecord(frame)) throw new Error(`第 ${index + 1} 章第 ${frameIndex + 1} 張板書不是物件。`);
    assertText(frame.id, `第 ${index + 1} 章板書 id`, 100);
    assertText(frame.src, `第 ${index + 1} 章板書路徑`, 300);
    assertText(frame.alt, `第 ${index + 1} 章板書替代文字`, 180);
    assertSeconds(frame.timeSec, `第 ${index + 1} 章板書時間`, durationSec);
    if (!(frame.src as string).startsWith("/laozhao-preview/")) {
      throw new Error(`第 ${index + 1} 章板書必須位於專用 Preview 路徑。`);
    }
    if (!Array.isArray(frame.referenceNoteIds) || frame.referenceNoteIds.some((noteId) => (
      typeof noteId !== "string" || !referenceNoteIds.has(noteId)
    ))) {
      throw new Error(`第 ${index + 1} 章板書的筆記對照無效。`);
    }
    if (new Set(frame.referenceNoteIds).size !== frame.referenceNoteIds.length) {
      throw new Error(`第 ${index + 1} 章第 ${frameIndex + 1} 張板書的筆記對照重複。`);
    }
    for (const noteId of frame.referenceNoteIds) referencedNoteIds.add(noteId);
  }
  for (const note of referenceNotes) {
    if (!referencedNoteIds.has(note.id)) {
      throw new Error(`第 ${index + 1} 章筆記 ${note.id} 沒有對應板書。`);
    }
  }
  return { ...raw, referenceNotes } as unknown as LaoZhaoPreviewChapter;
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
  const referenceNotePaths = new Map<string, string>();
  let previousChapter: LaoZhaoPreviewChapter | null = null;
  const validatedChapters: LaoZhaoPreviewChapter[] = [];
  for (const [index, chapter] of raw.chapters.entries()) {
    previousChapter = validateChapter(chapter, index, raw.durationSec, previousChapter);
    validatedChapters.push(previousChapter);
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
    for (const note of previousChapter.referenceNotes) {
      const existingPath = referenceNotePaths.get(note.id);
      if (existingPath && existingPath !== note.src) {
        throw new Error(`Preview 筆記 ${note.id} 對應到不同檔案。`);
      }
      referenceNotePaths.set(note.id, note.src);
    }
  }
  const captionIds = new Set<string>();
  let previousCaption: LaoZhaoPreviewCaption | null = null;
  const validatedCaptions: LaoZhaoPreviewCaption[] = [];
  for (const [index, caption] of raw.captions.entries()) {
    previousCaption = validateCaption(caption, index, raw.durationSec, previousCaption);
    validatedCaptions.push(previousCaption);
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
  if (raw.lectureNotes !== undefined) {
    validateLectureNotes(raw.lectureNotes, raw.videoId as string, validatedChapters, validatedCaptions);
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
