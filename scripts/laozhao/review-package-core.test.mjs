import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClock,
  isLikelyTranscriptLoop,
  normalizeTranscriptSegments,
  transcriptToMarkdown,
  validateAndNormalizeChapterDraft
} from "./review-package-core.mjs";

test("只排除四次以上的完整重複循環，不誤刪正常重述", () => {
  assert.equal(isLikelyTranscriptLoop("缺了解剖、缺了解剖、缺了解剖、缺了解剖"), true);
  assert.equal(isLikelyTranscriptLoop("臂神經叢分成根、幹、束與分支"), false);
  assert.equal(isLikelyTranscriptLoop("這個很重要、這個很重要"), false);
});

test("逐字稿時間可正規化並保留繁中醫學文字", () => {
  const result = normalizeTranscriptSegments(
    {
      segments: [
        { start: 0, end: 2.5, text: "  brachial   plexus 臂神經叢 " },
        { start: "00:00:03", end: "00:00:07.250", text: "第二段" }
      ]
    },
    { durationSec: 20 }
  );
  assert.equal(result.segments.length, 2);
  assert.equal(result.segments[0].text, "brachial plexus 臂神經叢");
  assert.equal(result.segments[1].endSec, 7.25);
  assert.equal(formatClock(3723.4), "01:02:03");
});

test("交給 Chat 的檔案帶來源指紋、規則與逐段時間碼", () => {
  const markdown = transcriptToMarkdown({
    videoId: "ATFBb25QRNw",
    videoTitle: "示範影片",
    durationSec: 600,
    sourceFingerprint: "abc123",
    segments: [{ startSec: 5, endSec: 10, text: "腕隧道內容" }]
  });
  assert.match(markdown, /逐字稿指紋：`abc123`/);
  assert.match(markdown, /只輸出一個 JSON 物件/);
  assert.match(markdown, /\[00:00:05–00:00:10\] 腕隧道內容/);
});

const transcript = {
  videoId: "ATFBb25QRNw",
  videoTitle: "示範影片",
  durationSec: 600,
  sourceFingerprint: "fingerprint"
};

test("Chat 章節草稿通過後會產生穩定 ID 且維持 private_only", () => {
  const result = validateAndNormalizeChapterDraft(
    {
      schemaVersion: "1.0.0",
      videoId: "ATFBb25QRNw",
      sourceFingerprint: "fingerprint",
      chapters: [
        {
          title: "臂神經叢",
          startSec: 0,
          endSec: 300,
          summary: "根、幹、束與分支。",
          tags: ["上肢", "臂神經叢", "上肢"],
          representativeFrameTargetSec: 280,
          reviewStatus: "draft"
        },
        {
          title: "腋動脈",
          startSec: 300,
          endSec: 600,
          summary: "分段與分支。",
          tags: ["上肢"],
          representativeFrameTargetSec: null,
          reviewStatus: "draft"
        }
      ]
    },
    transcript
  );
  assert.equal(result.valid, true);
  assert.equal(result.chapters[0].id, "ATFBb25QRNw-ch-001");
  assert.equal(result.chapters[0].rightsStatus, "private_only");
  assert.deepEqual(result.chapters[0].tags, ["上肢", "臂神經叢"]);
});

test("錯版逐字稿或重疊章節會被擋下", () => {
  const result = validateAndNormalizeChapterDraft(
    {
      schemaVersion: "1.0.0",
      videoId: "ATFBb25QRNw",
      sourceFingerprint: "wrong",
      chapters: [
        { title: "第一章", startSec: 0, endSec: 350, reviewStatus: "draft" },
        { title: "第二章", startSec: 300, endSec: 600, reviewStatus: "draft" }
      ]
    },
    transcript
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("指紋不一致")));
  assert.ok(result.errors.some((error) => error.includes("時間重疊")));
});

test("板書目標時間等於章節終點時會被擋下", () => {
  const result = validateAndNormalizeChapterDraft(
    {
      schemaVersion: "1.0.0",
      videoId: "ATFBb25QRNw",
      sourceFingerprint: "fingerprint",
      chapters: [
        {
          title: "臂神經叢",
          startSec: 0,
          endSec: 300,
          representativeFrameTargetSec: 300,
          reviewStatus: "draft"
        }
      ]
    },
    transcript
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("representativeFrameTargetSec")));
});
