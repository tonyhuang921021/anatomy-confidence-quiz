import assert from "node:assert/strict";
import test from "node:test";
import {
  compressCaptionSegments,
  createStableCueId,
  findCueAtTime,
  findCueIndexAtTime,
  isSentenceEnding,
  normalizeCaptionSegments,
  validateCaptionSegment
} from "./captions-core.mjs";

const options = {
  maxGapSec: 0.25,
  maxDurationSec: 10,
  maxTextLength: 100
};

test("驗證 start/end/text，並正規化文字但不接受空字串", () => {
  const valid = validateCaptionSegment({ start: 0, end: 1.25, text: "  The\n nerve  " });
  assert.deepEqual(valid, {
    valid: true,
    errors: [],
    normalized: { start: 0, end: 1.25, text: "The nerve" }
  });

  assert.equal(validateCaptionSegment({ start: -1, end: 1, text: "內容" }).valid, false);
  assert.equal(validateCaptionSegment({ start: 2, end: 2, text: "內容" }).valid, false);
  assert.equal(validateCaptionSegment({ start: 0, end: 1, text: "  " }).valid, false);
  assert.equal(validateCaptionSegment({ start: 0, end: 1, text: "" }).valid, false);
  assert.throws(
    () => normalizeCaptionSegments([{ start: 0, end: 1, text: "" }], { onInvalid: "throw" }),
    /text must not be empty/
  );
});

test("空白字幕片段會被批次壓縮流程略過", () => {
  const cues = compressCaptionSegments([
    { start: 0, end: 0.5, text: "" },
    { start: 0.6, end: 1.1, text: "有效內容" }
  ], options);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, "有效內容");
  assert.equal(cues[0].sourceSegmentStart, 1);
  assert.equal(cues[0].sourceSegmentEnd, 1);
  assert.equal(cues[0].sourceSegmentCount, 1);
});

test("中文相鄰片段可合併，但不跨越明顯句尾", () => {
  const cues = compressCaptionSegments([
    { start: 0, end: 0.5, text: "先找到腋動脈，" },
    { start: 0.55, end: 1, text: "再看它的分支" },
    { start: 1.05, end: 1.5, text: "這是第一個考點。" },
    { start: 1.55, end: 2, text: "接下來看腋靜脈" }
  ], options);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "先找到腋動脈，再看它的分支這是第一個考點。");
  assert.equal(cues[1].text, "接下來看腋靜脈");
  assert.equal(isSentenceEnding(cues[0].text), true);
});

test("英文片段以單一空格連接，句點後不再合併", () => {
  const cues = compressCaptionSegments([
    { start: 0, end: 0.7, text: "The nerve travels" },
    { start: 0.8, end: 1.4, text: "through the canal." },
    { start: 1.45, end: 2, text: "It exits later." }
  ], options);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "The nerve travels through the canal.");
  assert.equal(cues[1].text, "It exits later.");
});

test("重疊與逆序輸入會依時間排序、擴大範圍並保留來源數量", () => {
  const input = [
    { start: 1.1, end: 2, text: "第二段" },
    { start: 0, end: 1.2, text: "第一段" },
    { start: 0.9, end: 1.5, text: "重疊補字" }
  ];
  const cues = compressCaptionSegments(input, options);

  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 2);
  assert.equal(cues[0].text, "第一段重疊補字第二段");
  assert.equal(cues[0].sourceSegmentStart, 0);
  assert.equal(cues[0].sourceSegmentEnd, 2);
  assert.equal(cues[0].sourceSegmentCount, 3);
  assert.deepEqual(cues[0].sourceSegmentIndices, [0, 1, 2]);
  assert.deepEqual(input, [
    { start: 1.1, end: 2, text: "第二段" },
    { start: 0, end: 1.2, text: "第一段" },
    { start: 0.9, end: 1.5, text: "重疊補字" }
  ]);
});

test("長停頓、最大時長與最大文字長度都會阻止合併", () => {
  const cues = compressCaptionSegments([
    { start: 0, end: 0.8, text: "甲" },
    { start: 0.9, end: 1.7, text: "乙" },
    { start: 2.5, end: 3, text: "丙" },
    { start: 3.1, end: 5.2, text: "丁" },
    { start: 5.3, end: 5.8, text: "戊戊戊戊戊戊" }
  ], {
    maxGapSec: 0.2,
    maxDurationSec: 2,
    maxTextLength: 3
  });

  assert.deepEqual(cues.map(({ start, end, text }) => ({ start, end, text })), [
    { start: 0, end: 1.7, text: "甲乙" },
    { start: 2.5, end: 3, text: "丙" },
    { start: 3.1, end: 5.2, text: "丁" },
    { start: 5.3, end: 5.8, text: "戊戊戊戊戊戊" }
  ]);
});

test("穩定 ID 不依賴執行次數，且可由 cue 重新產生", () => {
  const segments = [
    { start: 4, end: 4.4, text: "A" },
    { start: 4.5, end: 5, text: "B" }
  ];
  const first = compressCaptionSegments(segments, options);
  const second = compressCaptionSegments(segments, options);

  assert.deepEqual(first, second);
  assert.match(first[0].id, /^cue-\d{9}-\d{9}-s\d{6}-e\d{6}$/);
  assert.equal(createStableCueId(first[0]), first[0].id);
});

test("目前 cue 查找使用半開區間與二分搜尋邊界", () => {
  const cues = compressCaptionSegments([
    { start: 0, end: 1, text: "一。" },
    { start: 1.05, end: 2, text: "二。" },
    { start: 2.05, end: 3, text: "三。" }
  ], { ...options, maxGapSec: 0.01 });

  assert.equal(findCueIndexAtTime(cues, -0.01), -1);
  assert.equal(findCueIndexAtTime(cues, 0), 0);
  assert.equal(findCueIndexAtTime(cues, 1), -1);
  assert.equal(findCueIndexAtTime(cues, 1.05), 1);
  assert.equal(findCueIndexAtTime(cues, 2.99), 2);
  assert.equal(findCueIndexAtTime(cues, 3), -1);
  assert.equal(findCueAtTime(cues, 1.5), cues[1]);
  assert.equal(findCueAtTime(cues, 3), null);
});
