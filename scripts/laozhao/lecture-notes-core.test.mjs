import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLectureNotesPackage,
  validateLectureNotesReview
} from "./lecture-notes-core.mjs";
import { captionFingerprint } from "./subtitle-proofreading-core.mjs";

const video = {
  videoId: "ATFBb25QRNw",
  title: "測試影片",
  chapters: [
    { id: "chapter-1", title: "第一章", startSec: 0, endSec: 10, summary: "第一章摘要", tags: [] },
    { id: "chapter-2", title: "第二章", startSec: 10, endSec: 20, summary: "第二章摘要", tags: [] }
  ],
  captions: [
    { id: "cue-00001", startSec: 0, endSec: 4, text: "老師先講第一點。" },
    { id: "cue-00002", startSec: 4, endSec: 9, text: "接著補充一個例子。" },
    { id: "cue-00003", startSec: 10, endSec: 14, text: "第二章比較兩個構造。" },
    { id: "cue-00004", startSec: 14, endSec: 19, text: "最後提醒容易混淆處。" }
  ]
};

function review() {
  return {
    schemaVersion: "1.0.0",
    videoId: video.videoId,
    captionFingerprint: captionFingerprint(video.captions),
    reviewStatus: "lecture_notes_candidate",
    blocks: [
      {
        id: "teacher-1",
        chapterId: "chapter-1",
        provenance: "teacher",
        type: "bullets",
        title: "第一章重點",
        sourceCaptionStart: "cue-00001",
        sourceCaptionEnd: "cue-00002",
        points: [{ text: "保留第一點與例子。", details: [] }]
      },
      {
        id: "supplement-1",
        chapterId: "chapter-1",
        provenance: "supplement",
        type: "bullets",
        title: "補充",
        afterBlockId: "teacher-1",
        points: [{ text: "補充背景。", details: [] }]
      },
      {
        id: "teacher-2",
        chapterId: "chapter-2",
        provenance: "teacher",
        type: "table",
        title: "構造比較",
        sourceCaptionStart: "cue-00003",
        sourceCaptionEnd: "cue-00004",
        columns: ["構造", "重點"],
        rows: [["甲", "第一個構造"], ["乙", "第二個構造"]]
      }
    ],
    unresolved: []
  };
}

test("講義可完整涵蓋字幕並區分老師講授與補充", () => {
  const result = validateLectureNotesReview(video, review());
  assert.equal(result.blocks.length, 3);
  assert.equal(result.blocks[0].startSec, 0);
  assert.equal(result.blocks[0].sourceCaptionCount, 2);
  assert.equal(result.blocks[1].provenance, "supplement");
  assert.equal(result.blocks[2].endSec, 19);
});

test("字幕有缺口、跨章與未解疑點都會阻擋匯入", () => {
  const missing = review();
  missing.blocks[0].sourceCaptionEnd = "cue-00001";
  assert.throws(() => validateLectureNotesReview(video, missing), /字幕缺口或重複/);

  const crossing = review();
  crossing.blocks[0].sourceCaptionEnd = "cue-00003";
  assert.throws(() => validateLectureNotesReview(video, crossing), /跨越章節/);

  const unresolved = review();
  unresolved.unresolved = [{ captionId: "cue-00002", issue: "術語待確認" }];
  assert.throws(() => validateLectureNotesReview(video, unresolved), /待確認/);
});

test("講義整理包包含完整覆蓋、補充與表格規則", () => {
  const output = buildLectureNotesPackage(video);
  assert.match(output, /不能漏掉老師講過的內容/);
  assert.match(output, /provenance=supplement/);
  assert.match(output, /type=table/);
  assert.match(output, /不能只把字幕範圍標上去卻省略內容/);
  assert.match(output, /最多涵蓋 14 段字幕/);
  assert.match(output, /"sourceCaptionStart": "cue-00001"/);
  assert.match(output, /"sourceCaptionEnd": "cue-00004"/);
  assert.match(output, /cue-00004/);
});

test("章節切在字幕中間時依字幕中點歸屬，不誤判為跨章", () => {
  const boundaryVideo = {
    ...video,
    captions: [
      { id: "cue-00001", startSec: 0, endSec: 9, text: "第一章內容。" },
      { id: "cue-00002", startSec: 9, endSec: 13, text: "第二章開場。" },
      { id: "cue-00003", startSec: 13, endSec: 19, text: "第二章內容。" }
    ]
  };
  const boundaryReview = {
    schemaVersion: "1.0.0",
    videoId: boundaryVideo.videoId,
    captionFingerprint: captionFingerprint(boundaryVideo.captions),
    reviewStatus: "lecture_notes_candidate",
    blocks: [
      {
        id: "teacher-1",
        chapterId: "chapter-1",
        provenance: "teacher",
        type: "bullets",
        title: "第一章",
        sourceCaptionStart: "cue-00001",
        sourceCaptionEnd: "cue-00001",
        points: [{ text: "第一章內容。", details: [] }]
      },
      {
        id: "teacher-2",
        chapterId: "chapter-2",
        provenance: "teacher",
        type: "bullets",
        title: "第二章",
        sourceCaptionStart: "cue-00002",
        sourceCaptionEnd: "cue-00003",
        points: [{ text: "第二章內容。", details: [] }]
      }
    ],
    unresolved: []
  };

  const result = validateLectureNotesReview(boundaryVideo, boundaryReview);
  assert.equal(result.blocks[1].chapterId, "chapter-2");
  assert.equal(result.blocks[1].sourceCaptionCount, 2);
});

test("單一老師講授區塊過長會被拒絕，避免把整章假裝成摘要", () => {
  const longVideo = {
    ...video,
    chapters: [{ id: "chapter-1", title: "第一章", startSec: 0, endSec: 60, summary: "摘要", tags: [] }],
    captions: Array.from({ length: 15 }, (_, index) => ({
      id: `cue-${String(index + 1).padStart(5, "0")}`,
      startSec: index * 2,
      endSec: index * 2 + 1,
      text: `老師講第 ${index + 1} 個重點。`
    }))
  };
  const longReview = {
    schemaVersion: "1.0.0",
    videoId: longVideo.videoId,
    captionFingerprint: captionFingerprint(longVideo.captions),
    reviewStatus: "lecture_notes_candidate",
    blocks: [{
      id: "teacher-long",
      chapterId: "chapter-1",
      provenance: "teacher",
      type: "bullets",
      title: "過長摘要",
      sourceCaptionStart: "cue-00001",
      sourceCaptionEnd: "cue-00015",
      points: [{ text: "把整章濃縮成一點。", details: [] }]
    }],
    unresolved: []
  };
  assert.throws(() => validateLectureNotesReview(longVideo, longReview), /最多只能涵蓋 14 段/);
});
