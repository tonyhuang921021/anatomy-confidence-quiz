import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviewVideoContent, mergePreviewVideo } from "./preview-content-core.mjs";
import { captionFingerprint } from "./subtitle-proofreading-core.mjs";

const fingerprint = "a".repeat(64);
const transcript = {
  videoId: "ATFBb25QRNw",
  videoTitle: "測試影片",
  durationSec: 120,
  sourceFingerprint: fingerprint,
  rightsStatus: "private_only",
  segments: [
    { start: 1, end: 3, text: "這是" },
    { start: 3, end: 5, text: "測試字幕" }
  ]
};
const chapterDraft = {
  schemaVersion: "1.0.0",
  videoId: transcript.videoId,
  sourceFingerprint: fingerprint,
  chapters: [
    {
      title: "第一章",
      startSec: 0,
      endSec: 120,
      summary: "章節摘要",
      tags: ["骨骼"],
      representativeFrameTargetSec: 90,
      reviewStatus: "draft"
    }
  ]
};
const captions = [{
  startSec: 1,
  endSec: 5,
  text: "這是測試字幕",
  sourceSegmentStart: 1,
  sourceSegmentEnd: 2,
  sourceSegmentCount: 2
}];

test("建立不含私人來源路徑的 Preview 影片內容", () => {
  const result = buildPreviewVideoContent({ transcript, chapterDraft, captions });
  assert.equal(result.rightsStatus, "authorized");
  assert.equal(result.reviewStatus, "draft");
  assert.equal(result.sourceSegmentTotal, 2);
  assert.equal(result.chapters[0].boardFrames.length, 0);
  assert.equal(result.chapters[0].referenceNotes.length, 0);
  assert.match(result.contentFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes("sourceMediaSha256"), false);
  assert.equal(JSON.stringify(result).includes("sourceFingerprint"), false);
});

test("只接受明確人工選定且相同來源的板書", () => {
  const selection = {
    schemaVersion: "1.0.0",
    videoId: transcript.videoId,
    sourceFingerprint: fingerprint,
    reviewStatus: "selected",
    chapters: [{
      chapterId: "ATFBb25QRNw-ch-001",
      frames: [{ candidateId: "frame-1", sourcePath: "private/frame.png", timeSec: 90 }]
    }]
  };
  const result = buildPreviewVideoContent({ transcript, chapterDraft, captions, boardSelections: selection });
  assert.equal(result.chapters[0].boardFrames[0].src, "/laozhao-preview/ATFBb25QRNw/boards/ATFBb25QRNw-ch-001-01.png");
  assert.deepEqual(result.chapters[0].boardFrames[0].referenceNoteIds, []);
  assert.throws(() => buildPreviewVideoContent({
    transcript,
    chapterDraft,
    captions,
    boardSelections: { ...selection, sourceFingerprint: "b".repeat(64) }
  }), /來源指紋/);
  assert.throws(() => buildPreviewVideoContent({
    transcript,
    chapterDraft,
    captions,
    boardSelections: {
      ...selection,
      chapters: [{
        ...selection.chapters[0],
        frames: [{ ...selection.chapters[0].frames[0], timeSec: 120 }]
      }]
    }
  }), /章節範圍/);
});

test("逐張板書會連到同章筆記頁且不暴露私人 PDF 路徑", () => {
  const selection = {
    schemaVersion: "1.0.0",
    videoId: transcript.videoId,
    sourceFingerprint: fingerprint,
    reviewStatus: "selected",
    chapters: [{
      chapterId: "ATFBb25QRNw-ch-001",
      frames: [{ candidateId: "frame-1", sourcePath: "private/frame.png", timeSec: 90 }]
    }]
  };
  const referenceMap = {
    schemaVersion: "1.1.0",
    videoId: transcript.videoId,
    visibility: "private_reference_only",
    source: { title: "測試筆記" },
    mappings: [{
      chapterIds: ["ATFBb25QRNw-ch-001"],
      pdfPages: [99],
      matchedStructures: ["只供人工章節參考"]
    }],
    boardFrameMappings: [{
      boardFrameId: "frame-1",
      chapterId: "ATFBb25QRNw-ch-001",
      videoTimeSec: 90,
      referenceImages: [{
        referenceImageId: "notes-p006-chest",
        pdfPage: 6,
        pageRegion: "上半部胸腔圖",
        matchedStructures: ["胸腔", "縱隔"]
      }]
    }]
  };
  const result = buildPreviewVideoContent({
    transcript,
    chapterDraft,
    captions,
    boardSelections: selection,
    referenceMap
  });
  assert.equal(result.chapters[0].referenceNotes[0].src, "/laozhao-preview/ATFBb25QRNw/notes/page-006.jpg");
  assert.equal(result.chapters[0].referenceNotes.length, 1);
  assert.deepEqual(result.chapters[0].boardFrames[0].referenceNoteIds, ["ATFBb25QRNw-notes-p006"]);
  assert.deepEqual(result.chapters[0].referenceNotes[0].pageRegions, ["上半部胸腔圖"]);
  assert.equal(result.chapters[0].referenceNotes.some((note) => note.pdfPage === 99), false);
  assert.equal(JSON.stringify(result).includes("reference-notes.pdf"), false);
});

test("重建單片內容時只替換同一 videoId", () => {
  const video = buildPreviewVideoContent({ transcript, chapterDraft, captions });
  const merged = mergePreviewVideo({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{ ...video, title: "舊版" }]
  }, video);
  assert.equal(merged.videos.length, 1);
  assert.equal(merged.videos[0].title, "測試影片");
});

test("已驗證列點講義會隨 Preview 重建並保持完整字幕覆蓋", () => {
  const notes = {
    schemaVersion: "1.0.0",
    videoId: transcript.videoId,
    captionFingerprint: captionFingerprint(captions.map((caption, index) => ({
      id: `cue-${String(index + 1).padStart(5, "0")}`,
      startSec: caption.startSec,
      endSec: caption.endSec,
      text: caption.text
    }))),
    reviewStatus: "validated",
    blocks: [{
      id: "teacher-1",
      chapterId: "ATFBb25QRNw-ch-001",
      provenance: "teacher",
      type: "bullets",
      title: "老師講授",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00001",
      points: [{ text: "完整保留測試字幕。", details: [] }]
    }],
    unresolved: []
  };
  const result = buildPreviewVideoContent({ transcript, chapterDraft, captions, lectureNotes: notes });
  assert.equal(result.lectureNotes.videoId, transcript.videoId);
  assert.equal(result.lectureNotes.reviewStatus, "draft");
  assert.equal(result.lectureNotes.blocks[0].sourceCaptionCount, 1);
});
