function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function selectedFrames(boardSelection, errors) {
  const frames = new Map();
  if (!isRecord(boardSelection) || !Array.isArray(boardSelection.chapters)) {
    errors.push("板書選擇檔格式無效。");
    return frames;
  }
  for (const chapter of boardSelection.chapters) {
    if (!isRecord(chapter) || typeof chapter.chapterId !== "string" || !Array.isArray(chapter.frames)) {
      errors.push("板書選擇檔含有無效章節。");
      continue;
    }
    for (const frame of chapter.frames) {
      if (!isRecord(frame) || typeof frame.candidateId !== "string") {
        errors.push(`${chapter.chapterId} 含有無效板書。`);
        continue;
      }
      if (frames.has(frame.candidateId)) {
        errors.push(`板書 ID 重複：${frame.candidateId}`);
        continue;
      }
      frames.set(frame.candidateId, {
        chapterId: chapter.chapterId,
        timeSec: Number(frame.timeSec)
      });
    }
  }
  return frames;
}

export function validateReferenceMap(referenceMap, boardSelection) {
  const errors = [];
  if (!isRecord(referenceMap)) {
    return { valid: false, errors: ["筆記對照檔必須是 JSON 物件。"], stats: null, canPublishReferenceImages: false };
  }
  if (referenceMap.schemaVersion !== "1.1.0") errors.push("筆記對照檔 schemaVersion 必須是 1.1.0。");
  if (referenceMap.visibility !== "private_reference_only") errors.push("筆記對照檔必須維持 private_reference_only。");
  if (!isRecord(referenceMap.source) || !validSha256(referenceMap.source.sha256)) {
    errors.push("筆記對照檔缺少有效來源 PDF 指紋。");
  }
  const pageCount = Number(referenceMap.source?.pageCount);
  if (!Number.isInteger(pageCount) || pageCount < 1) errors.push("筆記對照檔 pageCount 無效。");
  if (referenceMap.videoId !== boardSelection?.videoId) errors.push("筆記對照檔與板書選擇檔 videoId 不一致。");

  const selected = selectedFrames(boardSelection, errors);
  const mappings = Array.isArray(referenceMap.boardFrameMappings)
    ? referenceMap.boardFrameMappings
    : [];
  if (mappings.length === 0) errors.push("筆記對照檔沒有逐張板書對照。");
  const mappedIds = new Set();
  const referenceImageIds = new Set();
  const pages = new Set();

  for (const [index, mapping] of mappings.entries()) {
    if (!isRecord(mapping) || typeof mapping.boardFrameId !== "string") {
      errors.push(`第 ${index + 1} 筆板書對照格式無效。`);
      continue;
    }
    if (mappedIds.has(mapping.boardFrameId)) errors.push(`板書對照重複：${mapping.boardFrameId}`);
    mappedIds.add(mapping.boardFrameId);
    const frame = selected.get(mapping.boardFrameId);
    if (!frame) {
      errors.push(`筆記對照包含未選取板書：${mapping.boardFrameId}`);
    } else {
      if (mapping.chapterId !== frame.chapterId) errors.push(`${mapping.boardFrameId} 的章節不一致。`);
      if (!Number.isFinite(mapping.videoTimeSec) || Math.abs(mapping.videoTimeSec - frame.timeSec) > 0.001) {
        errors.push(`${mapping.boardFrameId} 的時間碼不一致。`);
      }
    }
    if (!Array.isArray(mapping.referenceImages) || mapping.referenceImages.length === 0) {
      errors.push(`${mapping.boardFrameId} 沒有對應筆記圖。`);
      continue;
    }
    for (const reference of mapping.referenceImages) {
      if (!isRecord(reference) || typeof reference.referenceImageId !== "string" || !reference.referenceImageId) {
        errors.push(`${mapping.boardFrameId} 含有無效筆記圖 ID。`);
        continue;
      }
      referenceImageIds.add(reference.referenceImageId);
      if (!Number.isInteger(reference.pdfPage) || reference.pdfPage < 1 || reference.pdfPage > pageCount) {
        errors.push(`${reference.referenceImageId} 的 PDF 頁碼超出範圍。`);
      } else {
        pages.add(reference.pdfPage);
      }
      if (typeof reference.pageRegion !== "string" || !reference.pageRegion.trim()) {
        errors.push(`${reference.referenceImageId} 缺少頁內圖示位置。`);
      }
      if (!Array.isArray(reference.matchedStructures) || reference.matchedStructures.length === 0) {
        errors.push(`${reference.referenceImageId} 缺少吻合構造。`);
      }
    }
  }

  for (const frameId of selected.keys()) {
    if (!mappedIds.has(frameId)) errors.push(`選定板書尚未對照筆記：${frameId}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      selectedBoardFrames: selected.size,
      mappedBoardFrames: mappedIds.size,
      referenceImages: referenceImageIds.size,
      pdfPages: [...pages].sort((left, right) => left - right)
    },
    canPublishReferenceImages: referenceMap.source?.publicationPermission === "confirmed"
  };
}
