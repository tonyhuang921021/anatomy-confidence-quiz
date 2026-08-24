import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLectureNotesPackage,
  convertChapterLectureReview,
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

function chapterReview() {
  return {
    schemaVersion: "1.0.0",
    videoId: video.videoId,
    captionFingerprint: captionFingerprint(video.captions),
    chapters: [
      {
        chapterId: "chapter-1",
        title: "第一章",
        startSec: 0,
        endSec: 10,
        sections: [{
          title: "一、第一章重點",
          startSec: 0,
          points: [{
            text: "老師先建立主概念。",
            kind: "standard",
            startSec: 0,
            children: [{
              text: "再補充一個例子。",
              kind: "teacher_note",
              startSec: 4,
              children: []
            }]
          }],
          tables: [{
            title: "概念比較",
            headers: ["項目", "內容"],
            rows: [["主概念", "先建立架構"], ["例子", "再補充細節"]]
          }]
        }]
      },
      {
        chapterId: "chapter-2",
        title: "第二章",
        startSec: 10,
        endSec: 20,
        sections: [{
          title: "二、第二章重點",
          startSec: 10,
          points: [{
            text: "比較兩個構造並提醒易混淆處。",
            kind: "exam_focus",
            startSec: 10,
            children: []
          }],
          tables: []
        }]
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

test("章節式共筆可轉成逐段覆蓋講義並保留內嵌表格", () => {
  const converted = convertChapterLectureReview(video, chapterReview());
  assert.equal(converted.blocks.length, 2);
  assert.equal(converted.blocks[0].title, "第一章重點");
  assert.equal(converted.blocks[0].sourceFormat, "timecoded_outline");
  assert.deepEqual(converted.blocks[0].tables?.[0]?.columns, ["項目", "內容"]);
  assert.equal(converted.blocks[0].points[0].children[0].kind, "teacher_note");
  assert.equal(converted.blocks[1].sourceCaptionStart, "cue-00003");

  const validated = validateLectureNotesReview(video, chapterReview());
  assert.equal(validated.blocks[0].sourceCaptionCount, 2);
  assert.equal(validated.blocks[0].tables?.[0]?.rows.length, 2);

  const wrongFingerprint = chapterReview();
  wrongFingerprint.captionFingerprint = "0".repeat(64);
  assert.throws(() => convertChapterLectureReview(video, wrongFingerprint), /不是針對目前這版字幕/);

  const wrongChapter = chapterReview();
  wrongChapter.chapters[1].chapterId = "chapter-missing";
  assert.throws(() => convertChapterLectureReview(video, wrongChapter), /chapterId/);
});

test("共筆條列可保留四層結構與少量師說標記", () => {
  const nested = review();
  nested.blocks[0].points = [{
    text: "人體構造依層級組成。",
    details: [],
    children: [{
      text: "分子組成胞器。",
      details: [],
      children: [{
        text: "胞器再組成細胞。",
        details: [],
        children: [{
          text: "這是建立系統架構的第一步。",
          details: [],
          kind: "teacher_note"
        }]
      }]
    }]
  }];
  const result = validateLectureNotesReview(video, nested);
  assert.equal(result.blocks[0].points[0].children[0].children[0].children[0].kind, "teacher_note");

  const tooDeep = review();
  tooDeep.blocks[0].points = [{
    text: "第一層",
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
  }];
  assert.throws(() => validateLectureNotesReview(video, tooDeep), /超過四層/);

  const invalidKind = review();
  invalidKind.blocks[0].points = [{ text: "不合法標記", kind: "ai_summary" }];
  assert.throws(() => validateLectureNotesReview(video, invalidKind), /標記類型無效/);
});

test("共筆條列允許對應單一區塊 14 段字幕但阻擋第 15 個子項", () => {
  const accepted = review();
  accepted.blocks[0].points = [{
    text: "本區塊整理。",
    children: Array.from({ length: 14 }, (_, index) => ({ text: `第 ${index + 1} 個子項。` }))
  }];
  assert.equal(validateLectureNotesReview(video, accepted).blocks[0].points[0].children.length, 14);

  const rejected = review();
  rejected.blocks[0].points = [{
    text: "本區塊整理。",
    children: Array.from({ length: 15 }, (_, index) => ({ text: `第 ${index + 1} 個子項。` }))
  }];
  assert.throws(() => validateLectureNotesReview(video, rejected), /下層項目格式無效/);
});

test("講義保留粗體、字幕證據與有來源的老師強調", () => {
  const emphasizedVideo = {
    ...video,
    captions: video.captions.map((caption, index) => (
      index === 0 ? { ...caption, text: "這很重要，一定要記住第一點。" } : caption
    ))
  };
  const candidate = review();
  candidate.captionFingerprint = captionFingerprint(emphasizedVideo.captions);
  candidate.blocks[0].teacherEmphasis = [{
    phrase: "這很重要",
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001"
  }];
  candidate.blocks[0].points = [{
    text: "一定要記住第一點。",
    textRuns: [
      { text: "一定要記住", strong: true },
      { text: "第一點。", strong: false }
    ],
    details: [],
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001",
    teacherEmphasis: [{
      phrase: "這很重要",
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001"
    }]
  }];

  const result = validateLectureNotesReview(emphasizedVideo, candidate);
  const point = result.blocks[0].points[0];
  assert.deepEqual(point.textRuns, candidate.blocks[0].points[0].textRuns);
  assert.equal(point.evidenceStartCue, "cue-00001");
  assert.equal(point.teacherEmphasis[0].phrase, "這很重要");
  assert.equal(result.blocks[0].teacherEmphasis[0].phrase, "這很重要");

  const outside = structuredClone(candidate);
  outside.blocks[0].points[0].evidenceStartCue = "cue-00003";
  outside.blocks[0].points[0].evidenceEndCue = "cue-00003";
  assert.throws(() => validateLectureNotesReview(emphasizedVideo, outside), /超出所屬講義區塊/);

  const forged = structuredClone(candidate);
  forged.blocks[0].points[0].teacherEmphasis[0].evidenceStartCue = "cue-00002";
  forged.blocks[0].points[0].teacherEmphasis[0].evidenceEndCue = "cue-00002";
  assert.throws(() => validateLectureNotesReview(emphasizedVideo, forged), /沒有字幕中的明確強調訊號/);

  const forgedBlock = structuredClone(candidate);
  forgedBlock.blocks[0].teacherEmphasis[0].evidenceStartCue = "cue-00002";
  forgedBlock.blocks[0].teacherEmphasis[0].evidenceEndCue = "cue-00002";
  assert.throws(() => validateLectureNotesReview(emphasizedVideo, forgedBlock), /沒有字幕中的明確強調訊號/);
});

test("補充內容的下層列點也不能冒充老師強調", () => {
  const candidate = review();
  candidate.blocks[1].points[0].teacherEmphasis = [{
    phrase: "很重要",
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001"
  }];
  assert.throws(() => validateLectureNotesReview(video, candidate), /補充內容，不能標示為老師強調/);
});

test("老師說一定要完成某件事會被視為明確強調", () => {
  const emphasizedVideo = {
    ...video,
    captions: video.captions.map((caption, index) => (
      index === 0 ? { ...caption, text: "這三張圖一定要配好。" } : caption
    ))
  };
  const candidate = review();
  candidate.captionFingerprint = captionFingerprint(emphasizedVideo.captions);
  candidate.blocks[0].points = [{
    text: "三張圖要能互相配對。",
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001",
    teacherEmphasis: [{
      phrase: "一定要",
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001"
    }]
  }];

  const result = validateLectureNotesReview(emphasizedVideo, candidate);
  assert.equal(result.blocks[0].points[0].teacherEmphasis[0].phrase, "一定要");
});

test("混淆提醒、出題紀錄與星號標記都保留為老師強調", () => {
  for (const [sourceText, phrase] of [
    ["名稱不可混淆。", "不可混淆"],
    ["此項曾出題。", "曾出題"],
    ["講義上兩個星號就是這兩句。", "星號"]
  ]) {
    const emphasizedVideo = {
      ...video,
      captions: video.captions.map((caption, index) => (
        index === 0 ? { ...caption, text: sourceText } : caption
      ))
    };
    const candidate = review();
    candidate.captionFingerprint = captionFingerprint(emphasizedVideo.captions);
    candidate.blocks[0].points = [{
      text: sourceText,
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001",
      teacherEmphasis: [{
        phrase,
        evidenceStartCue: "cue-00001",
        evidenceEndCue: "cue-00001"
      }]
    }];
    const result = validateLectureNotesReview(emphasizedVideo, candidate);
    assert.equal(result.blocks[0].points[0].teacherEmphasis[0].phrase, phrase);
  }
});

test("老師說背好會被視為明確強調", () => {
  const emphasizedVideo = {
    ...video,
    captions: video.captions.map((caption, index) => (
      index === 0 ? { ...caption, text: "這個構造要背好。" } : caption
    ))
  };
  const candidate = review();
  candidate.captionFingerprint = captionFingerprint(emphasizedVideo.captions);
  candidate.blocks[0].points = [{
    text: "這個構造要背好。",
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001",
    teacherEmphasis: [{
      phrase: "背好",
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001"
    }]
  }];
  const result = validateLectureNotesReview(emphasizedVideo, candidate);
  assert.equal(result.blocks[0].points[0].teacherEmphasis[0].phrase, "背好");
});

test("老師說小心會被視為明確強調", () => {
  const emphasizedVideo = {
    ...video,
    captions: video.captions.map((caption, index) => (
      index === 0 ? { ...caption, text: "小心：這個構造不要混淆。" } : caption
    ))
  };
  const candidate = review();
  candidate.captionFingerprint = captionFingerprint(emphasizedVideo.captions);
  candidate.blocks[0].points = [{
    text: "這個構造不要混淆。",
    evidenceStartCue: "cue-00001",
    evidenceEndCue: "cue-00001",
    teacherEmphasis: [{
      phrase: "小心",
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001"
    }]
  }];
  const result = validateLectureNotesReview(emphasizedVideo, candidate);
  assert.equal(result.blocks[0].points[0].teacherEmphasis[0].phrase, "小心");
});

test("否定重要性、一般重要部位與很好背好比不會被誤認為強調", () => {
  for (const text of ["這段比較不重要。", "請避開重要部位。", "這個很好背好比。"] ) {
    const neutralVideo = {
      ...video,
      captions: video.captions.map((caption, index) => (
        index === 0 ? { ...caption, text } : caption
      ))
    };
    const candidate = review();
    candidate.captionFingerprint = captionFingerprint(neutralVideo.captions);
    candidate.blocks[0].points = [{
      text,
      evidenceStartCue: "cue-00001",
      evidenceEndCue: "cue-00001",
      teacherEmphasis: [{
        phrase: "重要",
        evidenceStartCue: "cue-00001",
        evidenceEndCue: "cue-00001"
      }]
    }];
    assert.throws(() => validateLectureNotesReview(neutralVideo, candidate), /沒有字幕中的明確強調訊號/);
  }
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
  const output = buildLectureNotesPackage({
    ...video,
    lectureNotes: validateLectureNotesReview(video, review())
  });
  assert.match(output, /不能漏掉老師講過的內容/);
  assert.match(output, /provenance=supplement/);
  assert.match(output, /type=table/);
  assert.match(output, /不能只標字幕範圍卻省略內容/);
  assert.match(output, /最多涵蓋 14 段字幕/);
  assert.match(output, /每層最多 14 個子項/);
  assert.match(output, /共筆式列點講義/);
  assert.match(output, /不要反覆寫『老師說』/);
  assert.match(output, /children 依內容關係往下展開/);
  assert.match(output, /目前逐段核對講義（完整性檢查用）/);
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

  const reviewedOutline = {
    ...longReview,
    blocks: [{ ...longReview.blocks[0], sourceFormat: "timecoded_outline" }]
  };
  const result = validateLectureNotesReview(longVideo, reviewedOutline);
  assert.equal(result.blocks[0].sourceCaptionCount, 15);
});
