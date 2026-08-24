import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClock,
  isKnownWhisperHallucination,
  isLikelyTranscriptLoop,
  normalizeTranscriptSegments,
  trimSuspiciousTerminalRepeatRun,
  transcriptToMarkdown,
  validateAndNormalizeChapterDraft
} from "./review-package-core.mjs";

test("只排除四次以上的完整重複循環，不誤刪正常重述", () => {
  assert.equal(isLikelyTranscriptLoop("缺了解剖、缺了解剖、缺了解剖、缺了解剖"), true);
  assert.equal(isLikelyTranscriptLoop("幫幫幫幫幫幫幫幫"), true);
  assert.equal(isLikelyTranscriptLoop("大山大山大山大山大山大山大山大山大"), true);
  assert.equal(isLikelyTranscriptLoop("臂神經叢分成根、幹、束與分支"), false);
  assert.equal(isLikelyTranscriptLoop("這個很重要、這個很重要"), false);
});

test("精確排除已知 Whisper 片頭幻覺，不用模糊關鍵字誤傷課程", () => {
  assert.equal(isKnownWhisperHallucination("请不吝点赞 订阅 转发 打赏支持明镜与点点栏目"), true);
  assert.equal(isKnownWhisperHallucination("請不吝點讚、訂閱、轉發、打賞支持明鏡與點點欄目。"), true);
  assert.equal(isKnownWhisperHallucination("請看明鏡下方的丘腦圖。"), false);
});

test("只移除影片尾端且帶 Whisper 異常訊號的短句循環", () => {
  const suspiciousTail = Array.from({ length: 5 }, (_, index) => ({
    startSec: 95 + index,
    endSec: 96 + index,
    text: "快快",
    _whisperSuspicious: true
  }));
  const trimmed = trimSuspiciousTerminalRepeatRun([
    { startSec: 90, endSec: 95, text: "謝謝各位", _whisperSuspicious: false },
    ...suspiciousTail
  ], { durationSec: 100 });
  assert.equal(trimmed.removedCount, 5);
  assert.deepEqual(trimmed.segments.map((segment) => segment.text), ["謝謝各位"]);

  const noModelEvidence = trimSuspiciousTerminalRepeatRun(
    suspiciousTail.map((segment) => ({ ...segment, _whisperSuspicious: false })),
    { durationSec: 100 }
  );
  assert.equal(noModelEvidence.removedCount, 0);

  const middleRepeat = trimSuspiciousTerminalRepeatRun(suspiciousTail.map((segment, index) => ({
    ...segment,
    startSec: 40 + index,
    endSec: 41 + index
  })), { durationSec: 100 });
  assert.equal(middleRepeat.removedCount, 0);
});

test("正規化會保留正常片尾並去除有模型證據的尾端幻覺", () => {
  const result = normalizeTranscriptSegments({
    segments: [
      { start: 90, end: 95, text: "謝謝各位", avg_logprob: -0.2, compression_ratio: 1.1, temperature: 0 },
      ...Array.from({ length: 5 }, (_, index) => ({
        start: 95 + index,
        end: 96 + index,
        text: "快快",
        avg_logprob: -1.5,
        compression_ratio: 20,
        temperature: 1
      }))
    ]
  }, { durationSec: 100 });
  assert.deepEqual(result.segments.map((segment) => segment.text), ["謝謝各位"]);
  assert.ok(result.warnings.some((warning) => warning.includes("片尾 5 段短句重複")));
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
