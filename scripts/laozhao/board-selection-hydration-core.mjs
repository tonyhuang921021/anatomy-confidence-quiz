import { extname, posix } from "node:path";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeRelativePng(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.includes("\\")) return false;
  const normalized = posix.normalize(value);
  return normalized === value
    && !normalized.startsWith("../")
    && !normalized.split("/").includes("..")
    && extname(normalized).toLowerCase() === ".png";
}

export function buildBoardSelectionHydrationPlan(selection, candidateIndex) {
  const errors = [];
  if (!isRecord(selection) || !Array.isArray(selection.chapters)) {
    return { valid: false, errors: ["板書選擇檔缺少 chapters。"], crop: null, frames: [] };
  }
  if (!isRecord(candidateIndex) || !Array.isArray(candidateIndex.chapters)) {
    return { valid: false, errors: ["板書候選索引缺少 chapters。"], crop: null, frames: [] };
  }
  if (selection.videoId !== candidateIndex.videoId) errors.push("板書選擇與候選索引的 videoId 不一致。");
  if (selection.sourceFingerprint !== candidateIndex.sourceFingerprint) {
    errors.push("板書選擇與候選索引的來源指紋不一致。");
  }

  const crop = candidateIndex.boardCrop;
  if (
    !isRecord(crop)
    || ![crop.x, crop.y, crop.width, crop.height].every(Number.isInteger)
    || crop.x < 0
    || crop.y < 0
    || crop.width <= 0
    || crop.height <= 0
  ) {
    errors.push("板書候選索引缺少有效 boardCrop。");
  }

  const indexedChapters = new Map(candidateIndex.chapters.map((chapter) => [chapter.chapterId, chapter]));
  const seenIds = new Set();
  const seenPaths = new Set();
  const frames = [];
  for (const chapter of selection.chapters) {
    if (!isRecord(chapter) || typeof chapter.chapterId !== "string" || !Array.isArray(chapter.frames)) {
      errors.push("板書選擇章節格式無效。");
      continue;
    }
    const indexedChapter = indexedChapters.get(chapter.chapterId);
    if (!indexedChapter) errors.push(`${chapter.chapterId} 不在目前章節索引中。`);
    for (const frame of chapter.frames) {
      if (!isRecord(frame) || typeof frame.candidateId !== "string" || !frame.candidateId) {
        errors.push(`${chapter.chapterId} 含有無效板書 ID。`);
        continue;
      }
      if (seenIds.has(frame.candidateId)) errors.push(`板書 ID 重複：${frame.candidateId}`);
      seenIds.add(frame.candidateId);
      const pathIsSafe = safeRelativePng(frame.sourcePath);
      if (!pathIsSafe) {
        errors.push(`${frame.candidateId} 的 sourcePath 不安全或不是 PNG。`);
      }
      if (pathIsSafe && !frame.sourcePath.startsWith(`${chapter.chapterId}/`)) {
        errors.push(`${frame.candidateId} 的 sourcePath 不屬於所列章節。`);
      }
      if (pathIsSafe) {
        if (seenPaths.has(frame.sourcePath)) errors.push(`板書輸出路徑重複：${frame.sourcePath}`);
        seenPaths.add(frame.sourcePath);
      }
      const timeSec = Number(frame.timeSec);
      if (!Number.isFinite(timeSec) || timeSec < 0) {
        errors.push(`${frame.candidateId} 缺少有效時間碼。`);
      } else if (
        indexedChapter
        && (timeSec < Number(indexedChapter.startSec) || timeSec > Number(indexedChapter.endSec))
      ) {
        errors.push(`${frame.candidateId} 的時間碼超出章節範圍。`);
      }
      frames.push({
        candidateId: frame.candidateId,
        chapterId: chapter.chapterId,
        sourcePath: frame.sourcePath,
        timeSec
      });
    }
  }

  return { valid: errors.length === 0, errors, crop, frames };
}
