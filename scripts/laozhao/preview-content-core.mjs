import { createHash } from "node:crypto";
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
  publicBoardPathFor
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
        alt: `${chapter.title}板書${index + 1}`
      })),
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
  return { ...content, contentFingerprint: sha256Json(content) };
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
