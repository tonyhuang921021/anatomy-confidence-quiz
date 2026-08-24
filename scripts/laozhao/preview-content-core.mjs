import { createHash } from "node:crypto";
import { validateLectureNotesReview } from "./lecture-notes-core.mjs";
import { validateAndNormalizeChapterDraft } from "./review-package-core.mjs";
import { captionFingerprint } from "./subtitle-proofreading-core.mjs";

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

function normalizeBoardCandidates(raw, { videoId, sourceFingerprint }) {
  if (raw === null || raw === undefined) return new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("板書候選檔必須是 JSON 物件。");
  }
  if (raw.schemaVersion !== "1.0.0") throw new Error("板書候選檔 schemaVersion 必須是 1.0.0。");
  if (raw.videoId !== videoId) throw new Error("板書候選檔 videoId 與影片不一致。");
  if (raw.sourceFingerprint !== sourceFingerprint) throw new Error("板書候選檔來源指紋不一致。");
  if (!Array.isArray(raw.chapters)) throw new Error("板書候選檔 chapters 格式無效。");

  const result = new Map();
  for (const chapter of raw.chapters) {
    if (!chapter || typeof chapter !== "object" || Array.isArray(chapter)) {
      throw new Error("板書候選檔含有無效章節。");
    }
    if (typeof chapter.chapterId !== "string" || !chapter.chapterId) {
      throw new Error("板書候選檔缺少 chapterId。");
    }
    if (!Array.isArray(chapter.candidates)) {
      throw new Error(`${chapter.chapterId} 的 candidates 格式無效。`);
    }
    const candidates = chapter.candidates.map((candidate, index) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 個板書候選格式無效。`);
      }
      if (typeof candidate.id !== "string" || !candidate.id) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 個板書候選缺少 id。`);
      }
      if (typeof candidate.imagePath !== "string" || !candidate.imagePath) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 個板書候選缺少 imagePath。`);
      }
      const timestampSec = Number(candidate.timestampSec);
      if (!Number.isFinite(timestampSec) || timestampSec < 0) {
        throw new Error(`${chapter.chapterId} 第 ${index + 1} 個板書候選時間無效。`);
      }
      return {
        id: candidate.id,
        imagePath: candidate.imagePath,
        timestampSec,
        selectionScore: Number.isFinite(Number(candidate.selectionScore))
          ? Number(candidate.selectionScore)
          : 0,
        occlusionEstimate: Number.isFinite(Number(candidate.occlusionEstimate))
          ? Number(candidate.occlusionEstimate)
          : 1,
        foregroundAreaEstimate: Number.isFinite(Number(candidate.foregroundAreaEstimate))
          ? Number(candidate.foregroundAreaEstimate)
          : 1,
        motionEstimate: Number.isFinite(Number(candidate.motionEstimate))
          ? Number(candidate.motionEstimate)
          : 1,
        contentEstimate: Number.isFinite(Number(candidate.content))
          ? Number(candidate.content)
          : null,
        sharpness: Number.isFinite(Number(candidate.sharpness)) ? Number(candidate.sharpness) : 0,
        actualFrame: candidate.actualFrame !== false,
        composite: candidate.composite === true,
        reviewStatus: candidate.reviewStatus
      };
    });
    result.set(chapter.chapterId, candidates);
  }
  return result;
}

function compareBoardCandidates(left, right) {
  const visibilityTier = (candidate) => {
    if (candidate.occlusionEstimate <= 0.2) return 0;
    if (candidate.occlusionEstimate <= 0.4) return 1;
    if (candidate.occlusionEstimate <= 0.65) return 2;
    return 3;
  };
  const quality = (candidate) => (
    candidate.selectionScore * 100
    - candidate.occlusionEstimate * 18
    - candidate.foregroundAreaEstimate * 6
    - candidate.motionEstimate * 2
  );
  return visibilityTier(left) - visibilityTier(right)
    || quality(right) - quality(left)
    || right.sharpness - left.sharpness
    || left.timestampSec - right.timestampSec
    || left.id.localeCompare(right.id);
}

function meaningfulBoardCandidates(candidates) {
  const eligible = candidates.filter((item) => (
    item.actualFrame
    && !item.composite
    && item.reviewStatus !== "rejected"
  ));
  const measuredContent = eligible
    .map((item) => item.contentEstimate)
    .filter((value) => Number.isFinite(value));
  if (measuredContent.length === 0) return eligible;

  const maximumContent = Math.max(...measuredContent);
  const contentFloor = Math.min(0.08, Math.max(0.05, maximumContent * 0.55));
  const meaningful = eligible.filter((item) => (
    item.contentEstimate === null || item.contentEstimate >= contentFloor
  ));
  if (meaningful.length > 0) return meaningful;

  // Extremely sparse chapters still need one real frame. Keep only the most
  // informative measured frames instead of falling back to a blank target shot.
  return eligible.filter((item) => (
    item.contentEstimate === null || item.contentEstimate >= maximumContent * 0.9
  ));
}

function chapterReferenceGroups(referenceMap, chapterId) {
  if (!Array.isArray(referenceMap?.mappings)) return [];
  return referenceMap.mappings.filter((mapping) => (
    Array.isArray(mapping?.chapterIds)
    && mapping.chapterIds.includes(chapterId)
    && Array.isArray(mapping.pdfPages)
    && mapping.pdfPages.length > 0
  ));
}

function automaticReferenceImages({ videoId, frame, chapterId, referenceMap }) {
  const groups = chapterReferenceGroups(referenceMap, chapterId);
  const references = new Map();
  for (const group of groups) {
    for (const pdfPage of group.pdfPages) {
      const page = Number(pdfPage);
      if (!Number.isInteger(page) || page < 1) continue;
      const id = `${videoId}-${frame.candidateId}-notes-p${String(page).padStart(3, "0")}`;
      const existing = references.get(page) ?? {
        referenceImageId: id,
        pdfPage: page,
        pageRegions: new Set(),
        matchedStructures: new Set()
      };
      if (typeof group.pageRegion === "string" && group.pageRegion.trim()) {
        existing.pageRegions.add(group.pageRegion.trim());
      }
      for (const structure of group.matchedStructures ?? []) {
        if (typeof structure === "string" && structure.trim()) {
          existing.matchedStructures.add(structure.trim());
        }
      }
      references.set(page, existing);
    }
  }
  return [...references.values()].map((reference) => ({
    referenceImageId: reference.referenceImageId,
    pdfPage: reference.pdfPage,
    pageRegion: [...reference.pageRegions].join("；") || "本章相關內容",
    matchedStructures: [...reference.matchedStructures]
  }));
}

export function deriveAutomaticPreviewMaterials({
  videoId,
  sourceFingerprint,
  boardSelection = null,
  boardCandidates = null,
  referenceMap = null
}) {
  const candidatesByChapter = normalizeBoardCandidates(boardCandidates, { videoId, sourceFingerprint });
  if (candidatesByChapter.size === 0) {
    return { boardSelection, referenceMap, autoSelectedCount: 0, autoMappedCount: 0 };
  }

  const effectiveSelection = boardSelection
    ? {
        ...boardSelection,
        chapters: Array.isArray(boardSelection.chapters) ? boardSelection.chapters.map((chapter) => ({
          ...chapter,
          frames: Array.isArray(chapter.frames) ? [...chapter.frames] : chapter.frames
        })) : boardSelection.chapters
      }
    : {
        schemaVersion: "1.0.0",
        videoId,
        sourceFingerprint,
        reviewStatus: "selected",
        chapters: []
      };
  if (!Array.isArray(effectiveSelection.chapters)) {
    return { boardSelection, referenceMap, autoSelectedCount: 0, autoMappedCount: 0 };
  }

  const chaptersById = new Map(effectiveSelection.chapters.map((chapter) => [chapter.chapterId, chapter]));
  const usedFrameIds = new Set(effectiveSelection.chapters.flatMap((chapter) => (
    Array.isArray(chapter.frames) ? chapter.frames.map((frame) => frame.candidateId) : []
  )));
  let autoSelectedCount = 0;
  for (const [chapterId, candidates] of candidatesByChapter.entries()) {
    const chapter = chaptersById.get(chapterId);
    if (chapter && Array.isArray(chapter.frames) && chapter.frames.length > 0) continue;
    if (referenceMap && chapterReferenceGroups(referenceMap, chapterId).length === 0) continue;
    const candidate = meaningfulBoardCandidates(candidates)
      .sort(compareBoardCandidates)[0];
    if (!candidate || usedFrameIds.has(candidate.id)) continue;
    const frame = {
      candidateId: candidate.id,
      sourcePath: candidate.imagePath,
      timeSec: candidate.timestampSec,
      selectionMode: "automatic_fallback"
    };
    if (chapter) {
      chapter.frames = [frame];
      chapter.selectionMode = "automatic_fallback";
    } else {
      effectiveSelection.chapters.push({
        chapterId,
        frames: [frame],
        selectionMode: "automatic_fallback"
      });
    }
    usedFrameIds.add(candidate.id);
    autoSelectedCount += 1;
  }

  if (!referenceMap) {
    return { boardSelection: effectiveSelection, referenceMap, autoSelectedCount, autoMappedCount: 0 };
  }

  const existingMappings = Array.isArray(referenceMap.boardFrameMappings)
    ? [...referenceMap.boardFrameMappings]
    : [];
  const mappedFrameIds = new Set(existingMappings.map((mapping) => mapping?.boardFrameId));
  let autoMappedCount = 0;
  for (const chapter of effectiveSelection.chapters) {
    for (const frame of Array.isArray(chapter.frames) ? chapter.frames : []) {
      if (mappedFrameIds.has(frame.candidateId)) continue;
      const referenceImages = automaticReferenceImages({
        videoId,
        frame,
        chapterId: chapter.chapterId,
        referenceMap
      });
      if (referenceImages.length === 0) continue;
      existingMappings.push({
        boardFrameId: frame.candidateId,
        chapterId: chapter.chapterId,
        videoTimeSec: Number(frame.timeSec),
        referenceImages,
        mappingMode: "automatic_chapter_fallback"
      });
      mappedFrameIds.add(frame.candidateId);
      autoMappedCount += 1;
    }
  }

  return {
    boardSelection: effectiveSelection,
    referenceMap: { ...referenceMap, boardFrameMappings: existingMappings },
    autoSelectedCount,
    autoMappedCount
  };
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
    // 保留校訂字幕原本的臺灣中文標點；這些文字會參與講義的字幕指紋。
    const text = typeof cue.text === "string" ? cue.text.replace(/\s+/g, " ").trim() : "";
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

export function validateReviewedCaptionsForPreview(transcript, reviewedPackage) {
  if (!reviewedPackage || typeof reviewedPackage !== "object" || Array.isArray(reviewedPackage)) {
    throw new Error("已驗證字幕格式無效。");
  }
  if (reviewedPackage.schemaVersion !== "1.0.0") {
    throw new Error("已驗證字幕 schemaVersion 必須是 1.0.0。");
  }
  if (reviewedPackage.videoId !== transcript.videoId) {
    throw new Error("已驗證字幕 videoId 與影片不一致。");
  }
  if (reviewedPackage.sourceFingerprint !== transcript.sourceFingerprint) {
    throw new Error("已驗證字幕來源指紋與逐字稿不一致。");
  }
  if (reviewedPackage.reviewStatus !== "validated") {
    throw new Error("字幕尚未通過完整驗證，不能建立 Preview。");
  }
  const captions = normalizeCaptions(reviewedPackage.captions, Number(transcript.durationSec));
  if (reviewedPackage.captionFingerprint !== captionFingerprint(captions)) {
    throw new Error("已驗證字幕內容指紋不一致。");
  }
  return captions;
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
