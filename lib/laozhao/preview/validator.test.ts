import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import previewManifest from "../../../data/laozhao/previewContent.generated.json";
import { isLaoZhaoPreviewEnabled, parseLaoZhaoPreviewManifest } from "./validator";

const validVideo = {
  videoId: "ATFBb25QRNw",
  title: "2016DF01-01",
  durationSec: 120,
  sourceSegmentTotal: 2,
  contentFingerprint: "b".repeat(64),
  reviewStatus: "draft",
  rightsStatus: "authorized",
  chapters: [
    {
      id: "ATFBb25QRNw-ch-001",
      title: "測試章節",
      startSec: 0,
      endSec: 120,
      summary: "測試摘要",
      tags: ["解剖"],
      representativeFrameTargetSec: 80,
      boardFrames: [],
      referenceNotes: [],
      reviewStatus: "draft"
    }
  ],
  captions: [
    {
      id: "cue-00001",
      startSec: 1,
      endSec: 4,
      text: "測試字幕",
      sourceSegmentStart: 1,
      sourceSegmentEnd: 2,
      sourceSegmentCount: 2
    }
  ]
} as const;

function previewCaptionFingerprint(captions: readonly {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}[]) {
  return createHash("sha256").update(JSON.stringify(captions.map((caption) => ({
    id: caption.id,
    startSec: caption.startSec,
    endSec: caption.endSec,
    text: caption.text
  })))).digest("hex");
}

function videoWithLectureNotes() {
  const captions = [
    {
      id: "cue-00001",
      startSec: 1,
      endSec: 4,
      text: "老師先講第一點。",
      sourceSegmentStart: 1,
      sourceSegmentEnd: 1,
      sourceSegmentCount: 1
    },
    {
      id: "cue-00002",
      startSec: 4,
      endSec: 8,
      text: "老師接著講例外。",
      sourceSegmentStart: 2,
      sourceSegmentEnd: 2,
      sourceSegmentCount: 1
    }
  ] as const;
  return {
    ...validVideo,
    captions,
    lectureNotes: {
      schemaVersion: "1.0.0",
      videoId: validVideo.videoId,
      captionFingerprint: previewCaptionFingerprint(captions),
      reviewStatus: "draft",
      blocks: [
        {
          id: "teacher-1",
          chapterId: validVideo.chapters[0].id,
          provenance: "teacher",
          type: "bullets",
          title: "第一點",
          sourceCaptionStart: "cue-00001",
          sourceCaptionEnd: "cue-00001",
          sourceCaptionCount: 1,
          startSec: 1,
          endSec: 4,
          points: [{ text: "老師先講第一點。", details: [] }]
        },
        {
          id: "supplement-1",
          chapterId: validVideo.chapters[0].id,
          provenance: "supplement",
          type: "table",
          title: "補充比較",
          afterBlockId: "teacher-1",
          startSec: 1,
          endSec: 4,
          columns: ["項目", "內容"],
          rows: [["背景", "協助理解的補充。"]]
        },
        {
          id: "teacher-2",
          chapterId: validVideo.chapters[0].id,
          provenance: "teacher",
          type: "bullets",
          title: "例外",
          sourceCaptionStart: "cue-00002",
          sourceCaptionEnd: "cue-00002",
          sourceCaptionCount: 1,
          startSec: 4,
          endSec: 8,
          points: [{ text: "老師接著講例外。", details: [] }]
        }
      ]
    }
  } as const;
}

test("Preview 只有明確開啟且不是 production 才能使用", () => {
  assert.equal(isLaoZhaoPreviewEnabled({ LAOZHAO_PREVIEW_CONTENT: "1", VERCEL_ENV: "preview" }), true);
  assert.equal(isLaoZhaoPreviewEnabled({ LAOZHAO_PREVIEW_CONTENT: "1", VERCEL_ENV: "production" }), false);
  assert.equal(isLaoZhaoPreviewEnabled({ VERCEL_ENV: "preview" }), false);
});

test("解析有效的 Preview manifest", () => {
  const manifest = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [validVideo]
  });
  assert.equal(manifest.videos[0]?.videoId, "ATFBb25QRNw");
});

test("阻擋 production 權利狀態與重疊章節", () => {
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{ ...validVideo, rightsStatus: "private_only" }]
  }), /授權/);

  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...validVideo,
      chapters: [
        validVideo.chapters[0],
        { ...validVideo.chapters[0], id: "ATFBb25QRNw-ch-002", startSec: 119 }
      ]
    }]
  }), /重疊或倒序/);
});

test("公開 manifest 不需要原始來源指紋", () => {
  const manifest = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [validVideo]
  });
  assert.equal("sourceFingerprint" in manifest.videos[0], false);
});

test("第一支影片鎖定完整章節、字幕來源與板書數量", () => {
  const manifest = parseLaoZhaoPreviewManifest(previewManifest);
  const video = manifest.videos.find((item) => item.videoId === "ATFBb25QRNw");
  assert.ok(video);
  assert.equal(video.chapters.length, 24);
  assert.equal(video.captions.length, 1017);
  assert.equal(video.sourceSegmentTotal, 4946);
  assert.equal(video.captions[0]?.sourceSegmentStart, 1);
  assert.equal(video.captions.at(-1)?.sourceSegmentEnd, 4946);
  assert.equal(video.chapters.reduce((total, chapter) => total + chapter.boardFrames.length, 0), 22);
  assert.equal(new Set(video.chapters.flatMap((chapter) => chapter.referenceNotes.map((note) => note.src))).size, 7);
  assert.equal(video.chapters.flatMap((chapter) => chapter.boardFrames).every((frame) => frame.referenceNoteIds.length > 0), true);
  assert.equal(video.chapters.every((chapter) => {
    const referencedNoteIds = new Set(chapter.boardFrames.flatMap((frame) => frame.referenceNoteIds));
    return chapter.referenceNotes.every((note) => referencedNoteIds.has(note.id));
  }), true);
});

test("阻擋沒有逐張板書對應的孤立筆記", () => {
  const orphanNote = {
    id: "ATFBb25QRNw-notes-p006",
    src: "/laozhao-preview/ATFBb25QRNw/notes/page-006.jpg",
    pdfPage: 6,
    sourceTitle: "測試筆記",
    pageRegions: ["上半部"],
    matchedStructures: ["胸腔"],
    alt: "測試筆記第 6 頁",
    visibility: "protected_preview"
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...validVideo,
      chapters: [{ ...validVideo.chapters[0], referenceNotes: [orphanNote] }]
    }]
  }), /沒有對應板書/);
});

test("阻擋字幕來源缺口、重複板書與章節外板書", () => {
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...validVideo,
      captions: [
        validVideo.captions[0],
        { ...validVideo.captions[0], id: "cue-00002", sourceSegmentStart: 4, sourceSegmentEnd: 4, sourceSegmentCount: 1 }
      ],
      sourceSegmentTotal: 4
    }]
  }), /不連續/);

  const duplicateFrame = {
    id: "frame-1",
    src: "/laozhao-preview/ATFBb25QRNw/boards/frame-1.png",
    timeSec: 30,
    alt: "測試板書",
    referenceNoteIds: []
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...validVideo,
      chapters: [{
        ...validVideo.chapters[0],
        boardFrames: [duplicateFrame, { ...duplicateFrame, src: "/laozhao-preview/ATFBb25QRNw/boards/frame-2.png" }]
      }]
    }]
  }), /板書 id 重複/);

  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...validVideo,
      chapters: [{ ...validVideo.chapters[0], boardFrames: [{ ...duplicateFrame, timeSec: 120 }] }]
    }]
  }), /板書時間不在章節內/);
});

test("列點講義必須完整覆蓋老師字幕並明確綁定補充", () => {
  const source = videoWithLectureNotes();
  const parsed = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [source]
  });
  assert.equal(parsed.videos[0]?.lectureNotes?.blocks.length, 3);

  const missingTeacher = {
    ...source,
    lectureNotes: {
      ...source.lectureNotes,
      blocks: source.lectureNotes.blocks.slice(0, 2)
    }
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [missingTeacher]
  }), /未完整涵蓋/);

  const orphanSupplement = {
    ...source,
    lectureNotes: {
      ...source.lectureNotes,
      blocks: source.lectureNotes.blocks.map((block) => (
        block.id === "supplement-1" ? { ...block, afterBlockId: "teacher-missing" } : block
      ))
    }
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [orphanSupplement]
  }), /沒有對應的前置老師講授區塊/);
});
