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

test("Preview 接受四層共筆清單並阻擋錯誤標記與第五層", () => {
  const source = videoWithLectureNotes();
  const nestedBlocks = source.lectureNotes.blocks.map((block) => (
    block.id === "teacher-1"
      ? {
          ...block,
          points: [{
            text: "第一層",
            details: [],
            children: [{
              text: "第二層",
              details: [],
              children: [{
                text: "第三層",
                details: [],
                children: [{
                  text: "第四層",
                  details: [],
                  kind: "teacher_note"
                }]
              }]
            }]
          }]
        }
      : block
  ));
  const nested = {
    ...source,
    lectureNotes: {
      ...source.lectureNotes,
      blocks: nestedBlocks
    }
  } as const;
  const parsed = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [nested]
  });
  const firstBlock = parsed.videos[0]?.lectureNotes?.blocks[0];
  assert.equal(firstBlock?.type === "bullets" ? firstBlock.points[0]?.children?.[0]?.children?.[0]?.children?.[0]?.kind : null, "teacher_note");

  const fifthLevel = {
    ...nested,
    lectureNotes: {
      ...nested.lectureNotes,
      blocks: nested.lectureNotes.blocks.map((block) => (
        block.id === "teacher-1" && block.type === "bullets"
          ? {
              ...block,
              points: [{
                ...block.points[0],
                children: [{
                  text: "第二層",
                  children: [{
                    text: "第三層",
                    children: [{
                      text: "第四層",
                      children: [{ text: "第五層" }]
                    }]
                  }]
                }]
              }]
            }
          : block
      ))
    }
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [fifthLevel]
  }), /超過四層/);

  const invalidKind = {
    ...nested,
    lectureNotes: {
      ...nested.lectureNotes,
      blocks: nested.lectureNotes.blocks.map((block) => (
        block.id === "teacher-1" && block.type === "bullets"
          ? { ...block, points: [{ text: "不合法標記", kind: "ai_summary" }] }
          : block
      ))
    }
  };
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [invalidKind]
  }), /標記類型無效/);
});

test("Preview 可解析共筆條列內的比較表格", () => {
  const source = videoWithLectureNotes();
  const blocks = source.lectureNotes.blocks.map((block) => (
    block.id === "teacher-1" && block.type === "bullets"
      ? {
          ...block,
          sourceFormat: "timecoded_outline",
          tables: [{
            title: "概念比較",
            columns: ["項目", "內容"],
            rows: [["第一點", "建立概念"], ["例外", "補充辨析"]]
          }]
        }
      : block
  ));
  const parsed = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...source,
      lectureNotes: { ...source.lectureNotes, blocks }
    }]
  });
  const firstBlock = parsed.videos[0]?.lectureNotes?.blocks[0];
  assert.equal(firstBlock?.type === "bullets" ? firstBlock.tables?.[0]?.rows.length : 0, 2);

  const invalidBlocks = blocks.map((block) => (
    block.id === "teacher-1" && block.type === "bullets"
      ? { ...block, tables: [{ title: "壞表格", columns: ["只有一欄"], rows: [["內容"]] }] }
      : block
  ));
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [{
      ...source,
      lectureNotes: { ...source.lectureNotes, blocks: invalidBlocks }
    }]
  }), /表格欄數無效/);
});

test("章節時間切在字幕內時依字幕中點歸屬，真正跨章仍會阻擋", () => {
  const captions = [
    {
      id: "cue-00001",
      startSec: 0,
      endSec: 9,
      text: "第一章內容。",
      sourceSegmentStart: 1,
      sourceSegmentEnd: 1,
      sourceSegmentCount: 1
    },
    {
      id: "cue-00002",
      startSec: 9,
      endSec: 13,
      text: "第二章開場。",
      sourceSegmentStart: 2,
      sourceSegmentEnd: 2,
      sourceSegmentCount: 1
    },
    {
      id: "cue-00003",
      startSec: 13,
      endSec: 19,
      text: "第二章內容。",
      sourceSegmentStart: 3,
      sourceSegmentEnd: 3,
      sourceSegmentCount: 1
    }
  ] as const;
  const chapters = [
    {
      ...validVideo.chapters[0],
      id: "ATFBb25QRNw-ch-001",
      title: "第一章",
      startSec: 0,
      endSec: 8,
      representativeFrameTargetSec: 4
    },
    {
      ...validVideo.chapters[0],
      id: "ATFBb25QRNw-ch-002",
      title: "第二章",
      startSec: 8,
      endSec: 20,
      representativeFrameTargetSec: 12
    }
  ] as const;
  const teacherBlocks = [
    {
      id: "teacher-1",
      chapterId: chapters[0].id,
      provenance: "teacher",
      type: "bullets",
      title: "第一章",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00001",
      sourceCaptionCount: 1,
      startSec: 0,
      endSec: 9,
      points: [{ text: "第一章內容。", details: [] }]
    },
    {
      id: "teacher-2",
      chapterId: chapters[1].id,
      provenance: "teacher",
      type: "bullets",
      title: "第二章",
      sourceCaptionStart: "cue-00002",
      sourceCaptionEnd: "cue-00003",
      sourceCaptionCount: 2,
      startSec: 9,
      endSec: 19,
      points: [{ text: "第二章內容。", details: [] }]
    }
  ] as const;
  const source = {
    ...validVideo,
    durationSec: 20,
    sourceSegmentTotal: 3,
    chapters,
    captions,
    lectureNotes: {
      schemaVersion: "1.0.0",
      videoId: validVideo.videoId,
      captionFingerprint: previewCaptionFingerprint(captions),
      reviewStatus: "draft",
      blocks: teacherBlocks
    }
  } as const;

  const parsed = parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [source]
  });
  assert.equal(parsed.videos[0]?.lectureNotes?.blocks.length, 2);

  const crossChapter = {
    ...source,
    lectureNotes: {
      ...source.lectureNotes,
      blocks: [
        {
          ...teacherBlocks[0],
          sourceCaptionEnd: "cue-00002",
          sourceCaptionCount: 2,
          endSec: 13
        },
        {
          ...teacherBlocks[1],
          sourceCaptionStart: "cue-00003",
          sourceCaptionCount: 1,
          startSec: 13
        }
      ]
    }
  } as const;
  assert.throws(() => parseLaoZhaoPreviewManifest({
    schemaVersion: "1.0.0",
    visibility: "preview",
    videos: [crossChapter]
  }), /跨越章節/);
});
