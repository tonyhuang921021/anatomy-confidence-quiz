import { createHash } from "node:crypto";
import { validateLectureNotesReview } from "./lecture-notes-core.mjs";
import { validateAndNormalizeChapterDraft } from "./review-package-core.mjs";

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeBoardSelections(raw, { videoId, sourceFingerprint }) {
  if (raw === null || raw === undefined) return new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("板書選擇檔必須是 JSON 物件。");
  }
  if (raw.schemaVersion !== "1.0.0") throw new Error("板書選擇檔 schemaVersion 必須是 1.0.0。");
  if (raw.videoId !== videoId) throw new Error("板書選擇檔 videoId 與影片不一致。");
  if (raw.sourceFingerprint !== sourceFingerprint) throw new Error("板書選擇檔來源指紋不一致。");
  if (raw.reviewStatus !== "selected") throw new Error("板書選擇檔尚未標記為 selected。");
  if (!Array.isArray(raw.chapters)) throw new Error("板書選擇檔 chapters 格式無效。");

  const result = new Map();
  for (const chapter of raw.chapters) {
    if (!chapter || typeof chapter !== "object" || Array.isArray(chapter)) {
      throw new Error("板書選擇檔含有無效章節。");
    }
    if (typeof chapter.chapterId !== "string" || !chapter.chapterId) {
      throw new Error("板書選擇檔缺少 chapterId。");
    }
    if (!Array.isArray(chapter.frames)) throw new Error(`${chapter.chapterId} 的 frames 格式無效。`);
    const frames = chapter.frames.map((frame, index) => {
      if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 張板書格式無效。`);
      }
      if (typeof frame.candidateId !== "string" || !frame.candidateId) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 張板書缺少 candidateId。`);
      }
      if (typeof frame.sourcePath !== "string" || !frame.sourcePath) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 張板書缺少 sourcePath。`);
      }
      const timeSec = Number(frame.timeSec);
      if (!Number.isFinite(timeSec) || timeSec < 0) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 張板書時間無效。`);
      }
      return { candidateId: frame.candidateId, sourcePath: frame.sourcePath, timeSec };
    });
    if (frames.length > 3) throw new Error(`${chapter.chapterId} 最多選 3 張板書。`);
    result.set(chapter.chapterId, frames);
  }
  return result;
}

function notePageId(videoId, pdfPage) {
  return `${videoId}-notes-p${String(pdfPage).padStart(3, "0")}`;
}

function defaultNotePath(videoId, pdfPage) {
  return `/laozhao-preview/${videoId}/notes/page-${String(pdfPage).padStart(3, "0")}.jpg`;
}

function normalizeReferenceMap(raw, { videoId, selectedFrames, publicReferencePathFor }) {
  if (raw === null || raw === undefined) {
    return { chapterNotes: new Map(), boardNoteIds: new Map() };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("筆記對照檔必須是 JSON 物件。");
  }
  if (raw.schemaVersion !== "1.1.0") throw new Error("筆記對照檔 schemaVersion 必須是 1.1.0。");
  if (raw.videoId !== videoId) throw new Error("筆記對照檔 videoId 與影片不一致。");
  if (raw.visibility !== "private_reference_only") throw new Error("筆記對照檔必須維持 private_reference_only。");
  if (!raw.source || typeof raw.source !== "object" || Array.isArray(raw.source)) {
    throw new Error("筆記對照檔缺少來源資料。");
  }
  const sourceTitle = typeof raw.source.title === "string" ? raw.source.title.trim() : "";
  if (!sourceTitle) throw new Error("筆記對照檔缺少來源名稱。");

  const selectedFrameIds = new Set();
  for (const frames of selectedFrames.values()) {
    for (const frame of frames) selectedFrameIds.add(frame.candidateId);
  }
  const chapterNotes = new Map();
  const boardNoteIds = new Map();

  function addChapterNote(chapterId, pdfPage, pageRegion, matchedStructures) {
    if (typeof chapterId !== "string" || !chapterId) throw new Error("筆記對照缺少 chapterId。");
    if (!Number.isInteger(pdfPage) || pdfPage < 1) throw new Error(`${chapterId} 的筆記頁碼無效。`);
    const id = notePageId(videoId, pdfPage);
    const notes = chapterNotes.get(chapterId) ?? new Map();
    const existing = notes.get(id) ?? {
      id,
      src: publicReferencePathFor
        ? publicReferencePathFor({ videoId, pdfPage })
        : defaultNotePath(videoId, pdfPage),
      pdfPage,
      sourceTitle,
      pageRegions: new Set(),
      matchedStructures: new Set(),
      alt: `${sourceTitle}第 ${pdfPage} 頁`,
      visibility: "protected_preview"
    };
    if (typeof pageRegion === "string" && pageRegion.trim()) existing.pageRegions.add(pageRegion.trim());
    for (const structure of matchedStructures ?? []) {
      if (typeof structure === "string" && structure.trim()) existing.matchedStructures.add(structure.trim());
    }
    notes.set(id, existing);
    chapterNotes.set(chapterId, notes);
    return id;
  }

  if (!Array.isArray(raw.mappings)) throw new Error("筆記對照檔缺少章節頁面對照。");

  if (!Array.isArray(raw.boardFrameMappings)) throw new Error("筆記對照檔缺少逐張板書對照。");
  for (const mapping of raw.boardFrameMappings) {
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new Error("筆記對照檔含有無效板書對照。");
    }
    if (!selectedFrameIds.has(mapping.boardFrameId)) {
      throw new Error(`筆記對照包含未選取板書：${mapping.boardFrameId}`);
    }
    if (!Array.isArray(mapping.referenceImages) || mapping.referenceImages.length === 0) {
      throw new Error(`${mapping.boardFrameId} 沒有對應筆記圖。`);
    }
    const ids = [];
    for (const reference of mapping.referenceImages) {
      const id = addChapterNote(
        mapping.chapterId,
        reference.pdfPage,
        reference.pageRegion,
        reference.matchedStructures
      );
      if (!ids.includes(id)) ids.push(id);
    }
    boardNoteIds.set(mapping.boardFrameId, ids);
  }

  const normalizedChapterNotes = new Map();
  for (const [chapterId, notes] of chapterNotes.entries()) {
    normalizedChapterNotes.set(chapterId, [...notes.values()]
      .sort((left, right) => left.pdfPage - right.pdfPage)
      .map((note) => ({
        ...note,
        pageRegions: [...note.pageRegions],
        matchedStructures: [...note.matchedStructures]
      })));
  }
  return { chapterNotes: normalizedChapterNotes, boardNoteIds };
}

function normalizeCaptions(captions, durationSec) {
  if (!Array.isArray(captions) || captions.length === 0) throw new Error("壓縮字幕不可為空。");
  return captions.map((cue, index) => {
    if (!cue || typeof cue !== "object" || Array.isArray(cue)) {
      throw new Error(`第 ${index + 1} 段壓縮字幕格式無效。`);
    }
    const startSec = Number(cue.startSec);
    const endSec = Number(cue.endSec);
    const text = typeof cue.text === "string" ? cue.text.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec) {
      throw new Error(`第 ${index + 1} 段壓縮字幕時間無效。`);
    }
    if (endSec > durationSec + 0.5) throw new Error(`第 ${index + 1} 段壓縮字幕超出影片長度。`);
    if (!text || text.length > 240) throw new Error(`第 ${index + 1} 段壓縮字幕文字無效。`);
    if (index && startSec < Number(captions[index - 1].startSec)) {
      throw new Error(`第 ${index + 1} 段壓縮字幕未依時間排序。`);
    }
    const sourceSegmentStart = Number(cue.sourceSegmentStart);
    const sourceSegmentEnd = Number(cue.sourceSegmentEnd);
    const sourceSegmentCount = Number(cue.sourceSegmentCount);
    if (
      !Number.isInteger(sourceSegmentStart) || sourceSegmentStart < 1 ||
      !Number.isInteger(sourceSegmentEnd) || sourceSegmentEnd < sourceSegmentStart ||
      !Number.isInteger(sourceSegmentCount) || sourceSegmentCount < 1
    ) {
      throw new Error(`第 ${index + 1} 段壓縮字幕來源範圍無效。`);
    }
    return {
      id: `cue-${String(index + 1).padStart(5, "0")}`,
      startSec: Math.round(startSec * 1000) / 1000,
      endSec: Math.round(endSec * 1000) / 1000,
      text,
      sourceSegmentStart,
      sourceSegmentEnd,
      sourceSegmentCount
    };
  });
}

export function buildPreviewVideoContent({
  transcript,
  chapterDraft,
  captions,
  boardSelections = null,
  referenceMap = null,
  lectureNotes = null,
  publicBoardPathFor,
  publicReferencePathFor
}) {
  if (!transcript || typeof transcript !== "object" || Array.isArray(transcript)) {
    throw new Error("私人逐字稿格式無效。");
  }
  if (transcript.rightsStatus !== "private_only") throw new Error("私人逐字稿必須維持 private_only。");
  if (typeof transcript.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(transcript.sourceFingerprint)) {
    throw new Error("私人逐字稿缺少有效來源指紋。");
  }
  const durationSec = Number(transcript.durationSec);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error("私人逐字稿影片長度無效。");
  if (!Array.isArray(transcript.segments) || transcript.segments.length === 0) {
    throw new Error("私人逐字稿缺少原始字幕段落。");
  }
  const validation = validateAndNormalizeChapterDraft(chapterDraft, transcript);
  if (!validation.valid) throw new Error(`章節未通過驗證：${validation.errors.join("；")}`);
  const normalizedCaptions = normalizeCaptions(captions, durationSec);
  const selectedFrames = normalizeBoardSelections(boardSelections, {
    videoId: transcript.videoId,
    sourceFingerprint: transcript.sourceFingerprint
  });
  const references = normalizeReferenceMap(referenceMap, {
    videoId: transcript.videoId,
    selectedFrames,
    publicReferencePathFor
  });

  const chapters = validation.chapters.map((chapter) => {
    const frames = selectedFrames.get(chapter.id) ?? [];
    for (const frame of frames) {
      if (frame.timeSec < chapter.startSec || frame.timeSec >= chapter.endSec) {
        throw new Error(`${chapter.id} 的板書時間不在章節範圍內。`);
      }
    }
    return {
      id: chapter.id,
      title: chapter.title,
      startSec: chapter.startSec,
      endSec: chapter.endSec,
      summary: chapter.summary,
      tags: chapter.tags,
      representativeFrameTargetSec: chapter.representativeFrameTargetSec,
      boardFrames: frames.map((frame, index) => ({
        id: frame.candidateId,
        src: publicBoardPathFor
          ? publicBoardPathFor({ chapter, frame, index })
          : `/laozhao-preview/${transcript.videoId}/boards/${chapter.id}-${String(index + 1).padStart(2, "0")}.png`,
        timeSec: Math.round(frame.timeSec * 1000) / 1000,
        alt: `${chapter.title}板書${index + 1}`,
        referenceNoteIds: references.boardNoteIds.get(frame.candidateId) ?? []
      })),
      referenceNotes: references.chapterNotes.get(chapter.id) ?? [],
      reviewStatus: "draft"
    };
  });

  const content = {
    videoId: transcript.videoId,
    title: transcript.videoTitle,
    durationSec,
    sourceSegmentTotal: transcript.segments.length,
    reviewStatus: "draft",
    rightsStatus: "authorized",
    chapters,
    captions: normalizedCaptions
  };
  const normalizedLectureNotes = lectureNotes
    ? validateLectureNotesReview(
      content,
      lectureNotes.reviewStatus === "draft"
        ? { ...lectureNotes, unresolved: [] }
        : lectureNotes,
      { acceptedStatuses: ["validated", "draft"] }
    )
    : null;
  const completeContent = normalizedLectureNotes
    ? { ...content, lectureNotes: normalizedLectureNotes }
    : content;
  return { ...completeContent, contentFingerprint: sha256Json(completeContent) };
}

export function mergePreviewVideo(manifest, video) {
  const existing = manifest && typeof manifest === "object" && !Array.isArray(manifest)
    ? manifest
    : {};
  const videos = Array.isArray(existing.videos)
    ? existing.videos.filter((item) => item?.videoId !== video.videoId)
    : [];
  videos.push(video);
  videos.sort((left, right) => String(left.videoId).localeCompare(String(right.videoId)));
  return { schemaVersion: "1.0.0", visibility: "preview", videos };
}
